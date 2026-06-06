import "dotenv/config";
import { bootstrapAdminAndDriver } from "../server/bootstrapAccess";

async function main() {
  const result = await bootstrapAdminAndDriver({
    adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
    adminName: process.env.BOOTSTRAP_ADMIN_NAME,
    adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    driverName: process.env.BOOTSTRAP_DRIVER_NAME,
    driverPhone: process.env.BOOTSTRAP_DRIVER_PHONE ?? null,
  });

  console.log(
    JSON.stringify(result, null, 2)
  );
}

main().catch((error) => {
  console.error("[bootstrap-access] erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
