import dotenv from "dotenv";
dotenv.config({ path: "vercel.production.env", override: true, quiet: true });
const { getDb } = await import("../server/db.ts");
const { stores, products } = await import("../drizzle/schema.ts");
const { eq, sql } = await import("drizzle-orm");

const db = await getDb();
if (!db) throw new Error("DB unavailable");
const storeRows = await db.select({ id: stores.id, name: stores.name, slug: stores.slug }).from(stores).orderBy(stores.id);
const counts = await db.select({
  storeId: products.storeId,
  count: sql<number>`count(*)::int`,
}).from(products).where(eq(products.active, true)).groupBy(products.storeId);
console.log(JSON.stringify({
  stores: storeRows,
  counts: Object.fromEntries(counts.map((r:any)=>[r.storeId, Number(r.count)])),
}));
process.exit(0);
