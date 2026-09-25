import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as iam from "aws-cdk-lib/aws-iam";
import * as eb from "aws-cdk-lib/aws-elasticbeanstalk";
import * as assets from "aws-cdk-lib/aws-s3-assets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

export type BonattoStage = "production" | "staging";

export interface BonattoStackProps extends cdk.StackProps {
  stage?: BonattoStage;
}

export class BonattoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: BonattoStackProps) {
    super(scope, id, props);

    const stage = props?.stage ?? "production";
    const isProduction = stage === "production";
    const resourcePrefix = `bonatto-${stage}`;
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    const appSg = new ec2.SecurityGroup(this, "AppSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "Bonatto Elastic Beanstalk application",
    });
    appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP from CloudFront");

    const dbSg = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      allowAllOutbound: false,
      description: "Bonatto private PostgreSQL",
    });
    dbSg.addIngressRule(appSg, ec2.Port.tcp(5432), "PostgreSQL from Bonatto application");

    const database = new rds.DatabaseInstance(this, "Database", {
      vpc,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of("18.6", "18"),
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO,
      ),
      credentials: rds.Credentials.fromGeneratedSecret("bonatto_app"),
      databaseName: "bonatto",
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSg],
      backupRetention: cdk.Duration.days(isProduction ? 1 : 1),
      deletionProtection: isProduction,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      autoMinorVersionUpgrade: true,
    });

    const jwtSecret = new secretsmanager.Secret(this, "JwtSecret", {
      description: `Bonatto ${stage} session signing secret`,
      generateSecretString: {
        secretStringTemplate: "{}",
        generateStringKey: "value",
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    const ec2Role = new iam.Role(this, "BeanstalkEc2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSElasticBeanstalkWebTier"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });
    const instanceProfile = new iam.CfnInstanceProfile(this, "BeanstalkInstanceProfile", {
      roles: [ec2Role.roleName],
    });

    const serviceRole = new iam.Role(this, "BeanstalkServiceRole", {
      assumedBy: new iam.ServicePrincipal("elasticbeanstalk.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSElasticBeanstalkEnhancedHealth"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy"),
      ],
    });

    const bundle = new assets.Asset(this, "ApplicationBundle", {
      path: path.resolve(__dirname, "..", "..", ".deploy-bundle"),
    });

    const application = new eb.CfnApplication(this, "Application", {
      applicationName: resourcePrefix,
      description: `Bonatto ${stage} application`,
    });

    const version = new eb.CfnApplicationVersion(this, "ApplicationVersion", {
      applicationName: application.ref,
      sourceBundle: {
        s3Bucket: bundle.s3BucketName,
        s3Key: bundle.s3ObjectKey,
      },
    });
    version.addDependency(application);

    const subnets = vpc.publicSubnets.slice(0, 2).map((s) => s.subnetId).join(",");
    const dbPasswordRef = `{{resolve:secretsmanager:${database.secret!.secretArn}:SecretString:password}}`;
    const jwtRef = `{{resolve:secretsmanager:${jwtSecret.secretArn}:SecretString:value}}`;

    const cnamePrefix = isProduction
      ? `bonatto-${this.account.slice(-6)}`
      : `bonatto-staging-${this.account.slice(-6)}`;

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(`${cnamePrefix}.${this.region}.elasticbeanstalk.com`, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 80,
        }),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: `Bonatto ${stage} HTTPS distribution`,
    });

    const environment = new eb.CfnEnvironment(this, "Environment", {
      applicationName: application.ref,
      environmentName: resourcePrefix,
      cnamePrefix,
      solutionStackName: "64bit Amazon Linux 2023 v6.11.8 running Node.js 22",
      versionLabel: version.ref,
      optionSettings: [
        { namespace: "aws:elasticbeanstalk:environment", optionName: "EnvironmentType", value: "SingleInstance" },
        { namespace: "aws:elasticbeanstalk:environment", optionName: "ServiceRole", value: serviceRole.roleArn },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "IamInstanceProfile", value: instanceProfile.ref },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "SecurityGroups", value: appSg.securityGroupId },
        { namespace: "aws:autoscaling:launchconfiguration", optionName: "InstanceType", value: isProduction ? "t3.small" : "t3.micro" },
        { namespace: "aws:ec2:vpc", optionName: "VPCId", value: vpc.vpcId },
        { namespace: "aws:ec2:vpc", optionName: "Subnets", value: subnets },
        { namespace: "aws:ec2:vpc", optionName: "AssociatePublicIpAddress", value: "true" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "NODE_ENV", value: "production" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "APP_STAGE", value: stage },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "PORT", value: "8080" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DATABASE_HOST", value: database.dbInstanceEndpointAddress },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DATABASE_PORT", value: database.dbInstanceEndpointPort },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DATABASE_NAME", value: "bonatto" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DATABASE_USER", value: "bonatto_app" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DATABASE_PASSWORD", value: dbPasswordRef },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "DATABASE_SSL_MODE", value: "require" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "JWT_SECRET", value: jwtRef },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "ENABLE_PERSISTENT_JOBS", value: "false" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "ENABLE_OUTBOX_JOBS", value: isProduction ? "true" : "false" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "TWO_FACTOR_FEATURE_ENABLED", value: "false" },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "PUBLIC_APP_URL", value: `https://${distribution.distributionDomainName}` },
        { namespace: "aws:elasticbeanstalk:application:environment", optionName: "ALLOWED_ORIGIN_HOSTS", value: isProduction ? "bonatto-pizza.netlify.app" : distribution.distributionDomainName }
      ],
    });
    environment.addDependency(version);
    environment.addDependency(instanceProfile);

    new cdk.CfnOutput(this, "PublicUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "BeanstalkUrl", {
      value: `http://${cnamePrefix}.${this.region}.elasticbeanstalk.com`,
    });
    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: database.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: database.secret!.secretArn,
    });
  }
}
