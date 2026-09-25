import "../server/_core/loadEnv.ts";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { storagePutAdapter } from "../server/adapters/storage.ts";
import {
  categories,
  comboGroups,
  comboGroupItems,
  flavorSizePrices,
  multiFlavorSettings,
  productCombos,
  productFlavors,
  productImages,
  productOptionGroups,
  productOptions,
  products,
  productSizes,
  stores,
} from "../drizzle/schema.ts";

const SOURCE_URL = "https://cardapio.multipedidos.com.br/bonattopizzaitauna/cardapio.json";
const SOURCE_IMAGE_BASE = "https://images.multipedidos.com.br/products";
const SOURCE = "pedir_delivery";
const MERCHANT_ID = "955";
const TARGET_STORE_SLUG = "itauna";

type AnyRow = Record<string, any>;

function activeOf(row: AnyRow | null | undefined) {
  if (!row) return false;
  return row.available !== false
    && row.available !== 0
    && row.unavailable !== true
    && row.unavailable !== 1
    && row.unavailableByTemplate !== true;
}

function trim(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanHtml(value: unknown): string | null {
  if (value == null) return null;
  let text = String(value).trim();
  if (!text) return null;
  if (text.startsWith('"') && text.endsWith('"')) {
    try { text = JSON.parse(text); } catch {}
  }
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return text || null;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 88) || "categoria";
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function collectImageHashes(value: unknown, out = new Set<string>()) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectImageHashes(item, out);
    return out;
  }
  for (const [key, child] of Object.entries(value as AnyRow)) {
    if (
      key === "image"
      && typeof child === "string"
      && /^[A-Za-z0-9_-]{16,128}$/.test(child)
    ) {
      out.add(child);
    } else {
      collectImageHashes(child, out);
    }
  }
  return out;
}

async function fetchSourceImage(hash: string) {
  for (const folder of ["products", "flavors"]) {
    for (const variant of ["lg", "thumb"]) {
      const url = `https://images.multipedidos.com.br/${folder}/${hash}/${variant}_${hash}.jpg`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const body = Buffer.from(await response.arrayBuffer());
      if (!body.length) continue;
      return {
        body,
        contentType: response.headers.get("content-type") || "image/jpeg",
        sourceUrl: url,
      };
    }
  }
  throw new Error(`image not found: ${hash}`);
}

async function uploadImages(menu: AnyRow) {
  const hashes = [...collectImageHashes(menu)];
  const result = new Map<string, string>();
  const failures: Array<{ hash: string; error: string }> = [];
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= hashes.length) return;
      const hash = hashes[index];
      try {
        const image = await fetchSourceImage(hash);
        const saved = await storagePutAdapter(
          `menu-imports/itauna/pedir-delivery/${hash}.jpg`,
          image.body,
          image.contentType,
        );
        result.set(hash, saved.url);
        console.log(`[image ${index + 1}/${hashes.length}] ok ${hash.slice(0, 10)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ hash, error: message });
        result.set(hash, `${SOURCE_IMAGE_BASE}/${hash}/lg_${hash}.jpg`);
        console.warn(`[image ${index + 1}/${hashes.length}] fallback ${hash.slice(0, 10)}: ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, hashes.length || 1) }, () => worker()));
  return { imageMap: result, imageFailures: failures, imageCount: hashes.length };
}

function imageUrl(imageMap: Map<string, string>, hash: unknown) {
  if (typeof hash !== "string" || !hash) return null;
  return imageMap.get(hash) ?? `${SOURCE_IMAGE_BASE}/${hash}/lg_${hash}.jpg`;
}

function pricingRuleFor(source: AnyRow) {
  switch (source.priceBehavior) {
    case "average":
      return "average_price" as const;
    case "highest":
      return "highest_price" as const;
    case "incremental":
      return "base_plus_difference" as const;
    default:
      return "highest_price" as const;
  }
}

function optionKindFromSource(extra: AnyRow) {
  return Number(extra.type) === 1 ? "single" as const : "multiple" as const;
}

function flavorCategoriesForSize(menu: AnyRow, size: AnyRow) {
  const categoryById = new Map<number, AnyRow>(
    (menu.pizzas?.flavorCategories ?? []).map((category: AnyRow) => [Number(category.id), category]),
  );
  const bindings = Array.isArray(size.flavors) ? size.flavors : [];
  return bindings
    .map((binding: AnyRow) => ({
      binding,
      category: categoryById.get(Number(binding.flavorCategoryID)),
    }))
    .filter((entry: AnyRow) => Boolean(entry.category));
}

function flavorRowsForSize(menu: AnyRow, size: AnyRow) {
  const seen = new Set<number>();
  const rows: Array<{ flavor: AnyRow; binding: AnyRow }> = [];
  for (const { binding, category } of flavorCategoriesForSize(menu, size)) {
    for (const flavor of category.flavors ?? []) {
      const id = Number(flavor.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({ flavor, binding });
    }
  }
  return rows;
}

function sourceFlavorPrice(size: AnyRow, binding: AnyRow, flavorId: number) {
  const prices: number[] = [];
  for (const fraction of binding.fractions ?? []) {
    for (const exception of fraction.exception ?? []) {
      if (Number(exception.flavorID) !== flavorId) continue;
      const value = Number(exception.price);
      if (Number.isFinite(value)) prices.push(value);
    }
  }
  if (prices.length) {
    if (size.priceBehavior === "average") {
      return prices[0];
    }
    if (size.priceBehavior === "highest") {
      return Math.max(...prices);
    }
    return prices[0];
  }
  return Number(size.price ?? 0);
}

function pizzaExtraDefinitions(menu: AnyRow) {
  const result = new Map<number, { kind: "edge" | "single" | "multiple"; row: AnyRow }>();
  for (const row of menu.pizzas?.extras?.crust ?? []) {
    result.set(Number(row.id), { kind: "edge", row });
  }
  for (const row of menu.pizzas?.extras?.dough ?? []) {
    result.set(Number(row.id), { kind: "single", row });
  }
  for (const row of menu.pizzas?.extras?.additionalToppings ?? []) {
    result.set(Number(row.id), { kind: "multiple", row });
  }
  return result;
}

function sourceMenuExtras(menu: AnyRow) {
  return new Map<number, AnyRow>(
    (Array.isArray(menu.extras) ? menu.extras : []).map((extra: AnyRow) => [Number(extra.id), extra]),
  );
}

async function clearConfiguredProduct(tx: any, storeId: number, productId: number) {
  const flavorIds = await tx
    .select({ id: productFlavors.id })
    .from(productFlavors)
    .where(and(eq(productFlavors.storeId, storeId), eq(productFlavors.productId, productId)));
  if (flavorIds.length) {
    await tx.delete(flavorSizePrices).where(and(
      eq(flavorSizePrices.storeId, storeId),
      inArray(flavorSizePrices.flavorId, flavorIds.map((row: AnyRow) => row.id)),
    ));
  }

  const groupIds = await tx
    .select({ id: productOptionGroups.id })
    .from(productOptionGroups)
    .where(and(eq(productOptionGroups.storeId, storeId), eq(productOptionGroups.productId, productId)));
  if (groupIds.length) {
    await tx.delete(productOptions).where(and(
      eq(productOptions.storeId, storeId),
      inArray(productOptions.groupId, groupIds.map((row: AnyRow) => row.id)),
    ));
  }

  const comboRows = await tx
    .select({ id: productCombos.id })
    .from(productCombos)
    .where(and(eq(productCombos.storeId, storeId), eq(productCombos.productId, productId)));
  if (comboRows.length) {
    const comboIds = comboRows.map((row: AnyRow) => row.id);
    const comboGroupRows = await tx
      .select({ id: comboGroups.id })
      .from(comboGroups)
      .where(and(eq(comboGroups.storeId, storeId), inArray(comboGroups.comboId, comboIds)));
    if (comboGroupRows.length) {
      await tx.delete(comboGroupItems).where(and(
        eq(comboGroupItems.storeId, storeId),
        inArray(comboGroupItems.groupId, comboGroupRows.map((row: AnyRow) => row.id)),
      ));
      await tx.delete(comboGroups).where(and(
        eq(comboGroups.storeId, storeId),
        inArray(comboGroups.id, comboGroupRows.map((row: AnyRow) => row.id)),
      ));
    }
    await tx.delete(productCombos).where(and(
      eq(productCombos.storeId, storeId),
      eq(productCombos.productId, productId),
    ));
  }

  await Promise.all([
    tx.delete(productImages).where(and(eq(productImages.storeId, storeId), eq(productImages.productId, productId))),
    tx.delete(productSizes).where(and(eq(productSizes.storeId, storeId), eq(productSizes.productId, productId))),
    tx.delete(productFlavors).where(and(eq(productFlavors.storeId, storeId), eq(productFlavors.productId, productId))),
    tx.delete(multiFlavorSettings).where(and(eq(multiFlavorSettings.storeId, storeId), eq(multiFlavorSettings.productId, productId))),
    tx.delete(productOptionGroups).where(and(eq(productOptionGroups.storeId, storeId), eq(productOptionGroups.productId, productId))),
  ]);
}

async function ensureCategory(tx: any, input: {
  storeId: number;
  name: string;
  externalId: string;
  sortOrder: number;
  active: boolean;
  description?: string | null;
  imageUrl?: string | null;
}) {
  const [existing] = await tx
    .select()
    .from(categories)
    .where(and(
      eq(categories.storeId, input.storeId),
      eq(categories.externalSource, SOURCE),
      eq(categories.externalMerchantId, MERCHANT_ID),
      eq(categories.externalId, input.externalId),
    ))
    .limit(1);

  const values = {
    storeId: input.storeId,
    name: trim(input.name, 100),
    slug: slugify(input.name),
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    externalSource: SOURCE,
    externalMerchantId: MERCHANT_ID,
    externalId: input.externalId,
    sortOrder: input.sortOrder,
    active: input.active,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await tx
      .update(categories)
      .set(values)
      .where(eq(categories.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await tx.insert(categories).values(values).returning();
  return created;
}

async function ensureProduct(tx: any, values: AnyRow) {
  const [existing] = await tx
    .select()
    .from(products)
    .where(and(
      eq(products.storeId, values.storeId),
      eq(products.externalSource, SOURCE),
      eq(products.externalMerchantId, MERCHANT_ID),
      eq(products.externalId, values.externalId),
    ))
    .limit(1);

  if (existing) {
    const [updated] = await tx.update(products).set({
      ...values,
      updatedAt: new Date(),
      version: Number(existing.version ?? 1) + 1,
    }).where(eq(products.id, existing.id)).returning();
    return updated;
  }
  const [created] = await tx.insert(products).values(values).returning();
  return created;
}

async function addPrimaryImage(tx: any, storeId: number, productId: number, url: string | null, altText: string) {
  if (!url) return;
  await tx.insert(productImages).values({
    storeId,
    productId,
    imageUrl: url,
    altText: trim(altText, 240),
    kind: "primary",
    sortOrder: 0,
    active: true,
  });
}

async function addMenuExtraGroup(
  tx: any,
  storeId: number,
  productId: number,
  extra: AnyRow,
  imageMap: Map<string, string>,
  sortOrder: number,
) {
  if (!extra) return;
  const kind = optionKindFromSource(extra);
  const options = Array.isArray(extra.options) ? extra.options : [];
  const required = Boolean(extra.required);
  const [group] = await tx.insert(productOptionGroups).values({
    storeId,
    productId,
    name: trim(extra.name || "Complementos", 120),
    kind,
    description: cleanHtml(extra.description),
    required,
    minSelections: required ? 1 : 0,
    maxSelections: kind === "single" ? 1 : Math.max(1, options.length),
    freeSelections: 0,
    allowRepeatedOptions: false,
    appliesToAllSizes: true,
    sortOrder,
    active: true,
  }).returning();

  if (!group || !options.length) return;
  await tx.insert(productOptions).values(options.map((option: AnyRow, index: number) => ({
    storeId,
    groupId: group.id,
    name: trim(option.name || `Opção ${index + 1}`, 160),
    description: cleanHtml(option.description),
    priceDelta: money(option.price),
    imageUrl: imageUrl(imageMap, option.image),
    maxQuantity: 1,
    allowRepeat: false,
    sortOrder: Number(option.assortment ?? index),
    active: activeOf(option),
  })));
}

async function addReferencedMenuExtras(
  tx: any,
  menu: AnyRow,
  storeId: number,
  productId: number,
  extraIds: unknown,
  imageMap: Map<string, string>,
  startingSortOrder = 50,
) {
  const extras = sourceMenuExtras(menu);
  const ids = Array.isArray(extraIds) ? extraIds : [];
  let offset = 0;
  for (const rawId of ids) {
    const extra = extras.get(Number(rawId));
    if (!extra) continue;
    await addMenuExtraGroup(tx, storeId, productId, extra, imageMap, startingSortOrder + offset++);
  }
}

async function addPizzaExtraGroups(
  tx: any,
  menu: AnyRow,
  size: AnyRow,
  storeId: number,
  productId: number,
  imageMap: Map<string, string>,
) {
  const definitions = pizzaExtraDefinitions(menu);
  const specs: Array<{
    ids: number[];
    exceptionRows: AnyRow[];
    kind: "edge" | "single" | "multiple";
    defaultName: string;
    sortBase: number;
  }> = [
    {
      ids: (size.crustCategories ?? []).map(Number),
      exceptionRows: size.crustExceptions ?? [],
      kind: "edge",
      defaultName: "Borda",
      sortBase: 100,
    },
    {
      ids: (size.doughCategories ?? []).map(Number),
      exceptionRows: size.doughExceptions ?? [],
      kind: "single",
      defaultName: "Massa / Turbine seu pedido",
      sortBase: 120,
    },
    {
      ids: (size.additionalToppingsCategories ?? []).map(Number),
      exceptionRows: size.additionalToppingsExceptions ?? [],
      kind: "multiple",
      defaultName: "Adicionais",
      sortBase: 140,
    },
  ];

  for (const spec of specs) {
    for (let categoryIndex = 0; categoryIndex < spec.ids.length; categoryIndex++) {
      const categoryId = spec.ids[categoryIndex];
      const entry = definitions.get(categoryId);
      if (!entry) continue;
      const row = entry.row;
      const options = Array.isArray(row.options) ? row.options : [];
      const required = spec.kind !== "multiple";
      const [group] = await tx.insert(productOptionGroups).values({
        storeId,
        productId,
        name: trim(row.name || spec.defaultName, 120),
        kind: spec.kind,
        description: cleanHtml(row.description),
        required,
        minSelections: required ? 1 : 0,
        maxSelections: spec.kind === "multiple" ? Math.max(1, options.length) : 1,
        freeSelections: 0,
        allowRepeatedOptions: false,
        appliesToAllSizes: true,
        sortOrder: spec.sortBase + categoryIndex,
        active: true,
      }).returning();

      const exceptionByItem = new Map<number, AnyRow>(
        (spec.exceptionRows ?? []).map((item: AnyRow) => [Number(item.itemID), item]),
      );
      if (!group || !options.length) continue;
      await tx.insert(productOptions).values(options.map((option: AnyRow, index: number) => {
        const exception = exceptionByItem.get(Number(option.id));
        const resolvedPrice = exception?.price ?? option.price ?? row.price ?? 0;
        const available = exception
          ? activeOf({ available: exception.available })
          : activeOf(option);
        return {
          storeId,
          groupId: group.id,
          name: trim(option.name || `Opção ${index + 1}`, 160),
          description: cleanHtml(option.description),
          priceDelta: money(resolvedPrice),
          imageUrl: imageUrl(imageMap, option.image),
          maxQuantity: 1,
          allowRepeat: false,
          sortOrder: Number(option.assortment ?? index),
          active: available,
        };
      }));
    }
  }
}

console.log("[import] baixando cardápio de origem...");
const sourceResponse = await fetch(SOURCE_URL, { headers: { "cache-control": "no-cache" } });
if (!sourceResponse.ok) throw new Error(`Falha ao baixar cardápio: HTTP ${sourceResponse.status}`);
const sourcePayload = await sourceResponse.json() as AnyRow;
const cardapio = sourcePayload.cardapio;
const menu = cardapio?.menu;
if (!menu) throw new Error("Estrutura de menu não encontrada no JSON de origem.");

const db = await getDb();
if (!db) throw new Error("Banco de dados indisponível.");

const [targetStore] = await db.select().from(stores).where(eq(stores.slug, TARGET_STORE_SLUG)).limit(1);
if (!targetStore) throw new Error(`Loja alvo "${TARGET_STORE_SLUG}" não encontrada.`);
const storeId = targetStore.id;

console.log(`[import] loja alvo: ${targetStore.name} (#${storeId})`);
console.log("[import] copiando imagens para o storage...");
const { imageMap, imageFailures, imageCount } = await uploadImages(menu);
console.log(`[import] imagens processadas: ${imageCount}; fallback externo: ${imageFailures.length}`);

const report = {
  storeId,
  store: targetStore.name,
  categories: 0,
  generalProducts: 0,
  pizzaProducts: 0,
  comboProducts: 0,
  activeProducts: 0,
  inactiveProducts: 0,
  flavors: 0,
  optionGroups: 0,
  options: 0,
  copiedImages: imageCount - imageFailures.length,
  imageFallbacks: imageFailures.length,
};

await db.transaction(async (tx) => {
  const categoryMap = new Map<string, number>();

  const comboCategoryName = trim(cardapio.info?.combo_category_name || "PROMOÇÕES DO DIA", 100);
  const pizzaCategoryName = trim(cardapio.info?.pizza_category_name || "PIZZAS", 100);

  const comboCategory = await ensureCategory(tx, {
    storeId,
    name: comboCategoryName,
    externalId: "category:combos",
    sortOrder: 0,
    active: true,
  });
  categoryMap.set("combos", comboCategory.id);
  report.categories++;

  const pizzaCategory = await ensureCategory(tx, {
    storeId,
    name: pizzaCategoryName,
    externalId: "category:pizzas",
    sortOrder: 1,
    active: true,
  });
  categoryMap.set("pizzas", pizzaCategory.id);
  report.categories++;

  for (const category of menu.general ?? []) {
    const created = await ensureCategory(tx, {
      storeId,
      name: category.name,
      externalId: `category:general:${category.id}`,
      sortOrder: Number(category.assortment ?? 0) + 2,
      active: activeOf(category),
      description: cleanHtml(category.description),
      imageUrl: imageUrl(imageMap, category.image),
    });
    categoryMap.set(`general:${category.id}`, created.id);
    report.categories++;
  }

  for (const category of menu.general ?? []) {
    const categoryId = categoryMap.get(`general:${category.id}`);
    if (!categoryId) continue;

    for (const sourceProduct of category.products ?? []) {
      const isActive = activeOf(sourceProduct) && activeOf(category);
      const product = await ensureProduct(tx, {
        storeId,
        categoryId,
        name: trim(sourceProduct.name, 200),
        description: cleanHtml(sourceProduct.description),
        price: money(sourceProduct.price),
        imageUrl: imageUrl(imageMap, sourceProduct.image),
        externalSource: SOURCE,
        externalMerchantId: MERCHANT_ID,
        externalId: `general:${sourceProduct.id}`,
        externalCode: trim(sourceProduct.pdvCode || sourceProduct.productCode || "", 128) || null,
        sku: null,
        shortDescription: trim(sourceProduct.tag || "", 320) || null,
        productType: "simple",
        pricingEngine: "configured_v2",
        editorialStatus: "published",
        tags: JSON.stringify({
          source: SOURCE,
          sourceType: "general",
          sourceId: sourceProduct.id,
          oldPrice: sourceProduct.oldPrice ?? null,
        }),
        active: isActive,
        featured: Boolean(sourceProduct.featured),
        sortOrder: Number(sourceProduct.assortment ?? 0),
        publishedAt: new Date(),
      });

      await clearConfiguredProduct(tx, storeId, product.id);
      await addPrimaryImage(tx, storeId, product.id, imageUrl(imageMap, sourceProduct.image), sourceProduct.name);
      await addReferencedMenuExtras(tx, menu, storeId, product.id, sourceProduct.extras, imageMap, 50);

      report.generalProducts++;
      if (isActive) report.activeProducts++; else report.inactiveProducts++;

      const sourceExtras = Array.isArray(sourceProduct.extras) ? sourceProduct.extras : [];
      report.optionGroups += sourceExtras.filter((id: unknown) => sourceMenuExtras(menu).has(Number(id))).length;
      for (const id of sourceExtras) {
        report.options += sourceMenuExtras(menu).get(Number(id))?.options?.length ?? 0;
      }
    }
  }

  const pizzaCategoryId = categoryMap.get("pizzas");
  if (!pizzaCategoryId) throw new Error("Categoria de pizzas não criada.");

  for (const size of menu.pizzas?.sizes ?? []) {
    const isActive = activeOf(size);
    const flavors = flavorRowsForSize(menu, size);
    const product = await ensureProduct(tx, {
      storeId,
      categoryId: pizzaCategoryId,
      name: trim(size.name, 200),
      description: cleanHtml(size.description),
      price: money(size.price),
      imageUrl: imageUrl(imageMap, size.image),
      externalSource: SOURCE,
      externalMerchantId: MERCHANT_ID,
      externalId: `pizza:${size.id}`,
      externalCode: `pizza-size:${size.id}`,
      sku: null,
      shortDescription: trim(size.tag || "", 320) || null,
      productType: flavors.length ? "multi_flavor" : "simple",
      pricingEngine: "configured_v2",
      editorialStatus: "published",
      tags: JSON.stringify({
        source: SOURCE,
        sourceType: "pizza",
        sourceId: size.id,
        oldPrice: size.oldPrice ?? null,
        priceBehavior: size.priceBehavior ?? null,
      }),
      active: isActive,
      featured: false,
      sortOrder: Number(size.assortment ?? 0),
      publishedAt: new Date(),
    });

    await clearConfiguredProduct(tx, storeId, product.id);
    await addPrimaryImage(tx, storeId, product.id, imageUrl(imageMap, size.image), size.name);

    if (flavors.length) {
      const [createdSize] = await tx.insert(productSizes).values({
        storeId,
        productId: product.id,
        name: trim(size.name, 120),
        internalCode: `pedir:${size.id}`,
        description: cleanHtml(size.description),
        price: money(size.price),
        promotionalPrice: null,
        minFlavors: Math.max(1, Number(size.minFlavors ?? 1)),
        maxFlavors: Math.max(1, Number(size.maxFlavors ?? 1)),
        maxAddons: null,
        active: isActive,
        sortOrder: 0,
      }).returning();

      await tx.insert(multiFlavorSettings).values({
        storeId,
        productId: product.id,
        enabled: true,
        pricingRule: pricingRuleFor(size),
        allowRepeatedFlavors: false,
        visualDivisions: true,
      });

      for (let flavorIndex = 0; flavorIndex < flavors.length; flavorIndex++) {
        const { flavor, binding } = flavors[flavorIndex];
        const [createdFlavor] = await tx.insert(productFlavors).values({
          storeId,
          productId: product.id,
          name: trim(flavor.name, 160),
          description: cleanHtml(flavor.description),
          imageUrl: imageUrl(imageMap, flavor.image),
          ingredients: cleanHtml(flavor.description),
          removableIngredients: null,
          active: activeOf(flavor),
          sortOrder: Number(flavor.assortment ?? flavorIndex),
        }).returning();

        await tx.insert(flavorSizePrices).values({
          storeId,
          flavorId: createdFlavor.id,
          productSizeId: createdSize.id,
          price: money(sourceFlavorPrice(size, binding, Number(flavor.id))),
          active: activeOf(flavor),
        });
        report.flavors++;
      }
    }

    await addPizzaExtraGroups(tx, menu, size, storeId, product.id, imageMap);
    await addReferencedMenuExtras(tx, menu, storeId, product.id, size.extras, imageMap, 180);

    const pizzaExtraCount =
      (size.crustCategories?.length ?? 0)
      + (size.doughCategories?.length ?? 0)
      + (size.additionalToppingsCategories?.length ?? 0);
    report.optionGroups += pizzaExtraCount;
    report.optionGroups += (Array.isArray(size.extras) ? size.extras : []).length;

    for (const id of size.crustCategories ?? []) {
      report.options += pizzaExtraDefinitions(menu).get(Number(id))?.row?.options?.length ?? 0;
    }
    for (const id of size.doughCategories ?? []) {
      report.options += pizzaExtraDefinitions(menu).get(Number(id))?.row?.options?.length ?? 0;
    }
    for (const id of size.additionalToppingsCategories ?? []) {
      report.options += pizzaExtraDefinitions(menu).get(Number(id))?.row?.options?.length ?? 0;
    }
    for (const id of size.extras ?? []) {
      report.options += sourceMenuExtras(menu).get(Number(id))?.options?.length ?? 0;
    }

    report.pizzaProducts++;
    if (isActive) report.activeProducts++; else report.inactiveProducts++;
  }

  const comboCategoryId = categoryMap.get("combos");
  if (!comboCategoryId) throw new Error("Categoria de promoções não criada.");
  const pizzaSizeById = new Map<number, AnyRow>(
    (menu.pizzas?.sizes ?? []).map((size: AnyRow) => [Number(size.id), size]),
  );

  for (const combo of menu.combos ?? []) {
    const isActive = activeOf(combo);
    const product = await ensureProduct(tx, {
      storeId,
      categoryId: comboCategoryId,
      name: trim(combo.name, 200),
      description: cleanHtml(combo.description),
      price: money(combo.price),
      imageUrl: imageUrl(imageMap, combo.image),
      externalSource: SOURCE,
      externalMerchantId: MERCHANT_ID,
      externalId: `combo:${combo.id}`,
      externalCode: `combo:${combo.id}`,
      sku: null,
      shortDescription: trim(combo.tag || "", 320) || null,
      productType: "combo",
      pricingEngine: "configured_v2",
      editorialStatus: "published",
      tags: JSON.stringify({
        source: SOURCE,
        sourceType: "combo",
        sourceId: combo.id,
        oldPrice: combo.oldPrice ?? null,
      }),
      active: isActive,
      featured: false,
      sortOrder: Number(combo.assortment ?? 0),
      publishedAt: new Date(),
    });

    await clearConfiguredProduct(tx, storeId, product.id);
    await addPrimaryImage(tx, storeId, product.id, imageUrl(imageMap, combo.image), combo.name);
    await tx.insert(productCombos).values({
      storeId,
      productId: product.id,
      name: trim(combo.name, 160),
      description: cleanHtml(combo.description),
      active: isActive,
    });

    let componentIndex = 0;
    for (const rawSizeId of combo.pizzaSizes ?? []) {
      const sourceSize = pizzaSizeById.get(Number(rawSizeId));
      if (!sourceSize) continue;
      const flavorRows = flavorRowsForSize(menu, sourceSize);
      if (!flavorRows.length) continue;

      const maxSelections = Math.max(1, Number(sourceSize.maxFlavors ?? 1));
      const minSelections = Math.min(
        maxSelections,
        Math.max(1, Number(sourceSize.minFlavors ?? 1)),
      );
      const [group] = await tx.insert(productOptionGroups).values({
        storeId,
        productId: product.id,
        name: trim(
          `Pizza ${componentIndex + 1} — ${sourceSize.name}`,
          120,
        ),
        kind: "flavor",
        description: cleanHtml(sourceSize.description),
        required: true,
        minSelections,
        maxSelections,
        freeSelections: 0,
        allowRepeatedOptions: false,
        appliesToAllSizes: true,
        sortOrder: 10 + componentIndex,
        active: true,
      }).returning();

      if (group) {
        await tx.insert(productOptions).values(flavorRows.map(({ flavor, binding }, flavorIndex) => {
          const referencePrice = sourceFlavorPrice(sourceSize, binding, Number(flavor.id));
          const base = Number(sourceSize.price ?? 0);
          const safeDelta = maxSelections === 1
            ? Math.max(0, referencePrice - base)
            : 0;
          const sourceDescription = cleanHtml(flavor.description);
          const priceReference = Number.isFinite(referencePrice)
            ? `Preço de referência no menu original: R$ ${referencePrice.toFixed(2).replace(".", ",")}.`
            : "";
          return {
            storeId,
            groupId: group.id,
            name: trim(flavor.name, 160),
            description: [sourceDescription, priceReference].filter(Boolean).join("\n") || null,
            priceDelta: money(safeDelta),
            imageUrl: imageUrl(imageMap, flavor.image),
            maxQuantity: 1,
            allowRepeat: false,
            sortOrder: Number(flavor.assortment ?? flavorIndex),
            active: activeOf(flavor),
          };
        }));
        report.optionGroups++;
        report.options += flavorRows.length;
      }
      componentIndex++;
    }

    await addReferencedMenuExtras(tx, menu, storeId, product.id, combo.extras, imageMap, 100);
    for (const id of combo.extras ?? []) {
      const extra = sourceMenuExtras(menu).get(Number(id));
      if (!extra) continue;
      report.optionGroups++;
      report.options += extra.options?.length ?? 0;
    }

    report.comboProducts++;
    if (isActive) report.activeProducts++; else report.inactiveProducts++;
  }
});

const finalCounts = await Promise.all([
  db.select().from(categories).where(and(eq(categories.storeId, storeId), eq(categories.externalSource, SOURCE))),
  db.select().from(products).where(and(eq(products.storeId, storeId), eq(products.externalSource, SOURCE))),
  db.select().from(productSizes).where(eq(productSizes.storeId, storeId)),
  db.select().from(productFlavors).where(eq(productFlavors.storeId, storeId)),
  db.select().from(productOptionGroups).where(eq(productOptionGroups.storeId, storeId)),
  db.select().from(productOptions).where(eq(productOptions.storeId, storeId)),
]);

console.log("[import] concluído.");
console.log("IMPORT_REPORT=" + JSON.stringify({
  ...report,
  dbCounts: {
    categories: finalCounts[0].length,
    products: finalCounts[1].length,
    sizes: finalCounts[2].length,
    flavors: finalCounts[3].length,
    optionGroups: finalCounts[4].length,
    options: finalCounts[5].length,
  },
  imageFailureHashes: imageFailures.map((item) => item.hash),
}));
process.exit(0);
