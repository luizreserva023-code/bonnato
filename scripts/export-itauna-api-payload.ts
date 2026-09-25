import "../server/_core/loadEnv.ts";
import { and, eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import {
  categories,
  flavorSizePrices,
  multiFlavorSettings,
  productFlavors,
  productOptionGroups,
  productOptions,
  products,
  productSizes,
  stores,
} from "../drizzle/schema.ts";

const db=await getDb(); if(!db) throw new Error("DB unavailable");
const [store]=await db.select().from(stores).where(eq(stores.slug,"itauna")).limit(1);
if(!store) throw new Error("Itauna missing");

const cats=await db.select().from(categories).where(and(eq(categories.storeId,store.id),eq(categories.externalSource,"pedir_delivery")));
const catById=new Map(cats.map(c=>[c.id,c]));
const ps=await db.select().from(products).where(and(eq(products.storeId,store.id),eq(products.externalSource,"pedir_delivery")));
const out:any[]=[];
for(const p of ps){
  const cat=catById.get(p.categoryId); if(!cat) continue;
  const sizes=await db.select().from(productSizes).where(and(eq(productSizes.storeId,store.id),eq(productSizes.productId,p.id))).orderBy(productSizes.sortOrder);
  const groups=await db.select().from(productOptionGroups).where(and(eq(productOptionGroups.storeId,store.id),eq(productOptionGroups.productId,p.id))).orderBy(productOptionGroups.sortOrder);
  const modifiers=[] as any[];
  for(const g of groups){
    const opts=await db.select().from(productOptions).where(and(eq(productOptions.storeId,store.id),eq(productOptions.groupId,g.id))).orderBy(productOptions.sortOrder);
    if(!opts.length) continue;
    modifiers.push({
      name:g.name,
      description:g.description,
      required:Boolean(g.required),
      minSelections:Number(g.minSelections??0),
      maxSelections:Number(g.maxSelections??1),
      freeSelections:Number(g.freeSelections??0),
      allowRepeatedOptions:Boolean(g.allowRepeatedOptions),
      active:Boolean(g.active),
      options:opts.map(o=>({
        name:o.name,
        description:o.description,
        price:String(o.priceDelta??"0.00"),
        maxQuantity:Number(o.maxQuantity??1),
        active:Boolean(o.active),
      })),
    });
  }
  const flavors=await db.select().from(productFlavors).where(and(eq(productFlavors.storeId,store.id),eq(productFlavors.productId,p.id))).orderBy(productFlavors.sortOrder);
  const flavorSettingsRows=await db.select().from(multiFlavorSettings).where(and(eq(multiFlavorSettings.storeId,store.id),eq(multiFlavorSettings.productId,p.id))).limit(1);
  const flavorPayload=[] as any[];
  for(const f of flavors){
    const prices=[] as string[];
    for(const s of sizes){
      const [fp]=await db.select().from(flavorSizePrices).where(and(eq(flavorSizePrices.storeId,store.id),eq(flavorSizePrices.flavorId,f.id),eq(flavorSizePrices.productSizeId,s.id))).limit(1);
      prices.push(String(fp?.price??s.price??p.price));
    }
    flavorPayload.push({name:f.name,prices});
  }
  out.push({
    sourceProductId:p.id,
    categoryName:cat.name,
    categorySortOrder:Number(cat.sortOrder??0),
    categoryDescription:cat.description,
    categoryImageUrl:cat.imageUrl,
    name:p.name,
    shortDescription:p.shortDescription,
    description:p.description,
    price:String(p.price),
    imageUrl:p.imageUrl,
    sku:p.sku,
    productType:p.productType,
    editorialStatus:p.active?"published":"draft",
    preparationTime:p.preparationTime,
    minQuantity:Number(p.minQuantity??1),
    maxQuantity:Number(p.maxQuantity??99),
    couponEligible:Boolean(p.couponEligible),
    pointsEligible:Boolean(p.pointsEligible),
    featured:Boolean(p.featured),
    sizes:sizes.map(s=>({
      name:s.name,
      price:String(s.price),
      promotionalPrice:s.promotionalPrice?String(s.promotionalPrice):null,
      serves:s.serves??null,
      minFlavors:s.minFlavors??null,
      maxFlavors:s.maxFlavors??null,
    })),
    modifierGroups:modifiers,
    flavorSettings:flavorSettingsRows[0]?{
      enabled:Boolean(flavorSettingsRows[0].enabled),
      pricingRule:flavorSettingsRows[0].pricingRule,
      allowRepeatedFlavors:Boolean(flavorSettingsRows[0].allowRepeatedFlavors),
    }:null,
    flavors:flavorPayload,
  });
}
console.log(JSON.stringify({categories:cats.map(c=>({name:c.name,slug:c.slug,description:c.description,imageUrl:c.imageUrl,sortOrder:Number(c.sortOrder??0)})),products:out}));
process.exit(0);