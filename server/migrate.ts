import "./_core/loadEnv.ts";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const connectionString = process.env.DATABASE_URL?.trim();
const host = process.env.DATABASE_HOST?.trim();
const user = process.env.DATABASE_USER?.trim();
const password = process.env.DATABASE_PASSWORD?.trim();
const database = process.env.DATABASE_NAME?.trim() || "bonatto";
const port = process.env.DATABASE_PORT?.trim() || "5432";

function buildUrl() {
  if (connectionString) return connectionString;
  if (!host || !user || !password) {
    throw new Error("PostgreSQL connection is not configured");
  }
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const url = buildUrl();
const hostname = new URL(url).hostname.toLowerCase();
const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
const sslMode = (process.env.DATABASE_SSL_MODE ?? "").toLowerCase();
const requiresSsl = !isLocal && (sslMode === "require" || sslMode === "required");

const pool = new Pool({
  connectionString: url,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
});

try {
  const db = drizzle(pool);
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle", "migrations"),
  });
  console.log("[migrate] PostgreSQL migrations applied");
} finally {
  await pool.end();
}
