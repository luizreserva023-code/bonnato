process.env.RUNTIME_SCHEMA_MIGRATIONS = "true";
await import("../server/_core/loadEnv.ts");

const [{ getDb, ensureRuntimeSchema }, { ensureRestaurantNetworkSchema }, { ensureIfoodIntegrationSchema }] =
  await Promise.all([
    import("../server/db.ts"),
    import("../server/restaurantNetwork.ts"),
    import("../server/ifoodIntegration.ts"),
  ]);

const db = await getDb();
if (!db) throw new Error("Database unavailable for migration");

await ensureRuntimeSchema(db);
await ensureRestaurantNetworkSchema();
await ensureIfoodIntegrationSchema();
console.log("Runtime schema migrations completed.");
process.exit(0);
