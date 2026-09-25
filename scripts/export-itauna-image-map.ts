import "../server/_core/loadEnv.ts";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { products } from "../drizzle/schema.ts";
import fs from "node:fs";

const db = await getDb();
if (!db) throw new Error("DB unavailable");
const rows = await db.select({
  externalId: products.externalId,
  imageUrl: products.imageUrl,
}).from(products).where(and(
  eq(products.storeId, 2),
  eq(products.externalSource, "pedir_delivery"),
  isNotNull(products.imageUrl),
));
const map = Object.fromEntries(
  rows.filter(r => r.externalId && r.imageUrl).map(r => [r.externalId!, r.imageUrl!]),
);
fs.writeFileSync("C:\\Users\\luisg\\Documents\\New project\\bonatto-mobile-app\\.tmp\\prod-import\\image-map.json", JSON.stringify(map), "utf8");
console.log(JSON.stringify({ entries: Object.keys(map).length, bytes: fs.statSync("C:\\Users\\luisg\\Documents\\New project\\bonatto-mobile-app\\.tmp\\prod-import\\image-map.json").size }));
process.exit(0);
