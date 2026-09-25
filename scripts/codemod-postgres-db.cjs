const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "../server/db.ts");
let src = fs.readFileSync(file, "utf8");

src = src.replace('import { drizzle } from "drizzle-orm/mysql2";', 'import { drizzle } from "drizzle-orm/node-postgres";');
src = src.replace('import { createPool, type Pool } from "mysql2/promise";', 'import { Pool } from "pg";');
src = src.replace('import { shouldRunRuntimeSchemaMigrations } from "./runtimeSchema.ts";\n', "");

const start = src.indexOf("function buildConnectionStringFromParts()");
const reset = src.indexOf("function resetDbState()");
if (start < 0 || reset < 0) throw new Error("Connection block not found");

const connectionBlock = `function buildConnectionStringFromParts(): string | null {
  const host = process.env.DATABASE_HOST?.trim();
  const user = process.env.DATABASE_USER?.trim();
  const password = process.env.DATABASE_PASSWORD?.trim();
  const database = process.env.DATABASE_NAME?.trim() || "bonatto";
  const port = process.env.DATABASE_PORT?.trim() || "5432";
  if (!host || !user || !password) return null;

  const url = new URL(\`postgresql://\${encodeURIComponent(user)}:\${encodeURIComponent(password)}@\${host}:\${port}/\${database}\`);
  const sslMode = process.env.DATABASE_SSL_MODE?.trim().toLowerCase();
  if (sslMode === "require" || sslMode === "required") url.searchParams.set("sslmode", "require");
  return url.toString();
}

function normalizeDatabaseUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const normalized = rawUrl.trim();
  if (!normalized) return null;
  if (/^mysql:/i.test(normalized)) throw new Error("DATABASE_URL must use postgresql://, not mysql://");
  return normalized.replace(/^postgres:\/\//i, "postgresql://").replace(/[?&]ssl-mode=REQUIRED/gi, (m) => m.startsWith("?") ? "?sslmode=require" : "&sslmode=require");
}

function buildPostgresPool(connectionString: string) {
  const sslMode = (process.env.DATABASE_SSL_MODE ?? "").trim().toLowerCase();
  const requiresSsl = sslMode === "require" || sslMode === "required" || /[?&]sslmode=require/i.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on("error", (error) => {
    console.error("[Database] Pool error:", error);
    resetDbState();
  });
  return pool;
}

`;

src = src.slice(0, start) + connectionBlock + src.slice(reset);
const schemaStart = src.indexOf("async function hasColumn(");
const getDbStart = src.indexOf("export async function getDb()");
if (schemaStart < 0 || getDbStart < 0) throw new Error("Runtime schema block not found");
src = src.slice(0, schemaStart) + src.slice(getDbStart);

const getDbEnd = src.indexOf("// --- USERS", src.indexOf("export async function getDb()"));
if (getDbEnd < 0) throw new Error("getDb end not found");
const newGetDb = `export async function getDb() {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL) || buildConnectionStringFromParts();
  if (!_db && !_pool && connectionString) {
    try {
      _pool = buildPostgresPool(connectionString);
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      resetDbState();
    }
  }
  return _db;
}

`;
src = src.slice(0, src.indexOf("export async function getDb()")) + newGetDb + src.slice(getDbEnd);

fs.writeFileSync(file, src);
console.log("Refactored", file);
