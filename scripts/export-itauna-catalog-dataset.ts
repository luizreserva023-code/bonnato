import "../server/_core/loadEnv.ts";
import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import {
  categories, products, productImages, productSizes, productVariants,
  productAvailability, productOptionGroups, productOptions, modifierSizeRules,
  multiFlavorSettings, productFlavors, flavorSizePrices,
  productCombos, comboGroups, comboGroupItems,
} from "../drizzle/schema.ts";

const db = await getDb();
if (!db) throw new Error("DB unavailable");
const storeId = 2;
const productRows = await db.select().from(products).where(and(
  eq(products.storeId, storeId),
  eq(products.externalSource, "pedir_delivery"),
));
const productIds = new Set(productRows.map((row) => row.id));

const filterProduct = <T extends { productId: number }>(rows: T[]) =>
  rows.filter((row) => productIds.has(row.productId));
const dataset = {
  version: 1,
  storeId,
  exportedAt: new Date().toISOString(),
  categories: await db.select().from(categories).where(and(
    eq(categories.storeId, storeId),
    eq(categories.externalSource, "pedir_delivery"),
  )),
  products: productRows,
  productImages: filterProduct(await db.select().from(productImages).where(eq(productImages.storeId, storeId))),
  productSizes: filterProduct(await db.select().from(productSizes).where(eq(productSizes.storeId, storeId))),
  productVariants: filterProduct(await db.select().from(productVariants).where(eq(productVariants.storeId, storeId))),
  productAvailability: filterProduct(await db.select().from(productAvailability).where(eq(productAvailability.storeId, storeId))),
  productOptionGroups: filterProduct(await db.select().from(productOptionGroups).where(eq(productOptionGroups.storeId, storeId))),
  multiFlavorSettings: filterProduct(await db.select().from(multiFlavorSettings).where(eq(multiFlavorSettings.storeId, storeId))),
  productFlavors: filterProduct(await db.select().from(productFlavors).where(eq(productFlavors.storeId, storeId))),
  productCombos: filterProduct(await db.select().from(productCombos).where(eq(productCombos.storeId, storeId))),
  productOptions: await db.select().from(productOptions).where(eq(productOptions.storeId, storeId)),
  modifierSizeRules: await db.select().from(modifierSizeRules).where(eq(modifierSizeRules.storeId, storeId)),
  flavorSizePrices: await db.select().from(flavorSizePrices).where(eq(flavorSizePrices.storeId, storeId)),
  comboGroups: await db.select().from(comboGroups).where(eq(comboGroups.storeId, storeId)),
  comboGroupItems: await db.select().from(comboGroupItems).where(eq(comboGroupItems.storeId, storeId)),
};
fs.writeFileSync("C:\\Users\\luisg\\Documents\\New project\\bonatto-mobile-app\\.tmp\\prod-import\\itauna-catalog-dataset.json", JSON.stringify(dataset), "utf8");
console.log(JSON.stringify({
  path: "C:\\Users\\luisg\\Documents\\New project\\bonatto-mobile-app\\.tmp\\prod-import\\itauna-catalog-dataset.json",
  bytes: fs.statSync("C:\\Users\\luisg\\Documents\\New project\\bonatto-mobile-app\\.tmp\\prod-import\\itauna-catalog-dataset.json").size,
  counts: Object.fromEntries(Object.entries(dataset)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => [key, (value as unknown[]).length])),
}));
process.exit(0);
