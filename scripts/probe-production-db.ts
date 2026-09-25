import "../server/_core/loadEnv.ts";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mysql = require("C:/Users/luisg/AppData/Local/Temp/mysql2probe/node_modules/mysql2/promise.js");

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 10_000,
});

for (const query of [
  "SELECT id,name,slug,city FROM stores ORDER BY id",
  "SELECT storeId,COUNT(*) n FROM products GROUP BY storeId ORDER BY storeId",
  "SELECT storeId,COUNT(*) n FROM categories GROUP BY storeId ORDER BY storeId",
]) {
  const [rows] = await connection.query(query);
  console.log(JSON.stringify(rows));
}
await connection.end();
