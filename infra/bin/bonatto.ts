#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { BonattoStack } from "../lib/bonatto-stack";

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "sa-east-1",
};

new BonattoStack(app, "BonattoProduction", {
  env,
  stage: "production",
});

new BonattoStack(app, "BonattoStaging", {
  env,
  stage: "staging",
});
