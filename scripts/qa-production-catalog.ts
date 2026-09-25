import {
  carouselImages,
  categories,
  comboGroupItems,
  comboGroups,
  flavorSizePrices,
  menuSlides,
  orders,
  productCombos,
  productFlavors,
  productOptionGroups,
  productOptions,
  productSizes,
  products,
  storeSettings,
  storeTrackingSettings,
  stores,
} from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { getConfiguredCatalogProduct } from "../server/domains/catalog/repository.ts";
import { calculateConfiguredProductPrice } from "../server/domains/catalog/pricing.ts";

const db = await getDb();
if (!db) throw new Error("DB unavailable");

const storeRows = await db.select().from(stores).orderBy(stores.id);
const targetStores = storeRows.filter((store) =>
  /ita[uú]na|mateus leme|juatuba/i.test(`${store.name} ${store.displayName ?? ""} ${store.slug} ${store.city}`)
);
const targetIds = new Set(targetStores.map((store) => store.id));
const issues: Array<{ severity: "error" | "warning"; storeId?: number; productId?: number; message: string }> = [];

if (targetStores.length !== 3) {
  issues.push({ severity: "error", message: `Esperadas 3 unidades Bonatto; encontradas ${targetStores.length}: ${targetStores.map((s) => s.name).join(", ")}` });
}

const [
  productRows, categoryRows, sizeRows, groupRows, optionRows, flavorRows,
  flavorPriceRows, productComboRows, comboGroupRows, comboItemRows,
  slideRows, carouselRows, settingRows, trackingRows, orderRows,
] = await Promise.all([
  db.select().from(products),
  db.select().from(categories),
  db.select().from(productSizes),
  db.select().from(productOptionGroups),
  db.select().from(productOptions),
  db.select().from(productFlavors),
  db.select().from(flavorSizePrices),
  db.select().from(productCombos),
  db.select().from(comboGroups),
  db.select().from(comboGroupItems),
  db.select().from(menuSlides),
  db.select().from(carouselImages),
  db.select().from(storeSettings),
  db.select().from(storeTrackingSettings),
  db.select({ id: orders.id, storeId: orders.storeId, status: orders.status }).from(orders),
]);
const productsById = new Map(productRows.map((row) => [row.id, row]));
const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
const sizesById = new Map(sizeRows.map((row) => [row.id, row]));
const groupsById = new Map(groupRows.map((row) => [row.id, row]));
const flavorsById = new Map(flavorRows.map((row) => [row.id, row]));
const productCombosById = new Map(productComboRows.map((row) => [row.id, row]));
const comboGroupsById = new Map(comboGroupRows.map((row) => [row.id, row]));

for (const product of productRows.filter((row) => targetIds.has(row.storeId))) {
  const category = categoriesById.get(product.categoryId);
  if (!category || category.storeId !== product.storeId) {
    issues.push({ severity: "error", storeId: product.storeId, productId: product.id, message: `Produto "${product.name}" referencia categoria de outra loja ou inexistente.` });
  }
}

for (const row of sizeRows.filter((row) => targetIds.has(row.storeId))) {
  const product = productsById.get(row.productId);
  if (!product || product.storeId !== row.storeId) issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: "Tamanho aponta para produto de outra loja/inexistente." });
}
for (const row of groupRows.filter((row) => targetIds.has(row.storeId))) {
  const product = productsById.get(row.productId);
  if (!product || product.storeId !== row.storeId) issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: "Grupo de adicionais aponta para produto de outra loja/inexistente." });
  const activeOptions = optionRows.filter((option) => option.groupId === row.id && option.storeId === row.storeId && option.active);
  if (row.active && row.required && activeOptions.length < Math.max(1, row.minSelections)) {
    issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: `Grupo obrigatório "${row.name}" não possui opções suficientes.` });
  }
  if (row.minSelections > row.maxSelections) issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: `Grupo "${row.name}" tem mínimo maior que máximo.` });
}
for (const row of optionRows.filter((row) => targetIds.has(row.storeId))) {
  const group = groupsById.get(row.groupId);
  if (!group || group.storeId !== row.storeId) issues.push({ severity: "error", storeId: row.storeId, message: `Adicional "${row.name}" aponta para grupo de outra loja/inexistente.` });
}
for (const row of flavorRows.filter((row) => targetIds.has(row.storeId))) {
  const product = productsById.get(row.productId);
  if (!product || product.storeId !== row.storeId) issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: `Sabor "${row.name}" aponta para produto de outra loja/inexistente.` });
}
for (const row of flavorPriceRows.filter((row) => targetIds.has(row.storeId))) {
  const flavor = flavorsById.get(row.flavorId);
  const size = sizesById.get(row.productSizeId);
  if (!flavor || !size || flavor.storeId !== row.storeId || size.storeId !== row.storeId || flavor.productId !== size.productId) {
    issues.push({ severity: "error", storeId: row.storeId, message: "Preço de sabor/tamanho cruza produtos ou lojas diferentes." });
  }
}
for (const row of productComboRows.filter((row) => targetIds.has(row.storeId))) {
  const product = productsById.get(row.productId);
  if (!product || product.storeId !== row.storeId) issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: "Configuração de combo cruza loja/produto." });
}
for (const row of comboGroupRows.filter((row) => targetIds.has(row.storeId))) {
  const combo = productCombosById.get(row.comboId);
  if (!combo || combo.storeId !== row.storeId) issues.push({ severity: "error", storeId: row.storeId, message: `Grupo de combo "${row.name}" cruza loja.` });
  const activeItems = comboItemRows.filter((item) => item.groupId === row.id && item.storeId === row.storeId && item.active);
  if (row.active && row.required && activeItems.length < Math.max(1, row.minSelections)) {
    issues.push({ severity: "error", storeId: row.storeId, message: `Grupo obrigatório de combo "${row.name}" não possui itens suficientes.` });
  }
}
for (const row of comboItemRows.filter((row) => targetIds.has(row.storeId))) {
  const group = comboGroupsById.get(row.groupId);
  const product = productsById.get(row.productId);
  if (!group || group.storeId !== row.storeId || !product || product.storeId !== row.storeId) {
    issues.push({ severity: "error", storeId: row.storeId, productId: row.productId, message: "Item de combo referencia grupo/produto de outra loja." });
  }
}
for (const store of targetStores) {
  const configured = productRows.filter((p) => p.storeId === store.id && p.active && p.pricingEngine === "configured_v2");
  for (const product of configured) {
    try {
      const catalog = await getConfiguredCatalogProduct({ storeId: store.id, productId: product.id });
      const size = catalog.sizes.find((item) => item.active) ?? null;
      const selection: any = { quantity: 1, channel: "delivery", now: new Date() };
      if (size) selection.sizeId = size.id;

      if (catalog.flavorSettings?.enabled) {
        const min = Math.max(1, size?.minFlavors ?? 1);
        const eligible = catalog.flavors.filter((flavor) => flavor.active && (!size || flavor.pricesBySize[size.id] != null));
        selection.flavorIds = eligible.slice(0, min).map((flavor) => flavor.id);
        if (eligible.length < min) issues.push({ severity: "error", storeId: store.id, productId: product.id, message: `"${product.name}" exige ${min} sabor(es), mas não há sabores/preços suficientes no tamanho ${size?.name ?? "padrão"}.` });
        if (size) {
          for (const flavor of catalog.flavors.filter((f) => f.active)) {
            if (flavor.pricesBySize[size.id] == null) issues.push({ severity: "warning", storeId: store.id, productId: product.id, message: `"${product.name}" / ${size.name}: sabor "${flavor.name}" sem preço.` });
          }
        }
      }

      selection.modifiers = [];
      for (const group of catalog.modifierGroups.filter((g) => g.active && g.required)) {
        const min = Math.max(1, group.minSelections);
        const choices = group.options.filter((option) => option.active).slice(0, min);
        selection.modifiers.push(...choices.map((option) => ({ groupId: group.id, optionId: option.id, quantity: 1 })));
      }

      selection.combos = [];
      for (const group of catalog.comboGroups.filter((g) => g.active && g.required)) {
        const min = Math.max(1, group.minSelections);
        const choices = group.items.filter((item) => item.active).slice(0, min);
        selection.combos.push(...choices.map((item) => ({ groupId: group.id, itemId: item.id, quantity: 1 })));
      }

      const result = calculateConfiguredProductPrice(catalog, selection);
      if (result.validationErrors.length) {
        issues.push({ severity: "error", storeId: store.id, productId: product.id, message: `"${product.name}" falhou no caminho mínimo válido: ${result.validationErrors.join(" | ")}` });
      }
    } catch (error) {
      issues.push({ severity: "error", storeId: store.id, productId: product.id, message: `Falha ao carregar "${product.name}": ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}
for (const row of [...slideRows, ...carouselRows, ...settingRows, ...trackingRows]) {
  if (!targetIds.has(row.storeId) && row.storeId !== 0) {
    issues.push({ severity: "warning", storeId: row.storeId, message: `Registro de configuração/visual pertence a storeId fora das 3 unidades: ${row.storeId}.` });
  }
}
for (const order of orderRows) {
  if (order.storeId != null && !targetIds.has(order.storeId)) {
    issues.push({ severity: "warning", storeId: order.storeId, message: `Pedido #${order.id} pertence a storeId fora das 3 unidades.` });
  }
}

const summary = targetStores.map((store) => {
  const storeProducts = productRows.filter((p) => p.storeId === store.id);
  const byType = Object.fromEntries(
    ["simple", "sizes", "buildable", "multi_flavor", "combo"].map((type) => [type, storeProducts.filter((p) => p.productType === type).length]),
  );
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    city: store.city,
    products: storeProducts.length,
    activeProducts: storeProducts.filter((p) => p.active).length,
    configuredV2: storeProducts.filter((p) => p.pricingEngine === "configured_v2").length,
    byType,
    categories: categoryRows.filter((c) => c.storeId === store.id).length,
    slides: slideRows.filter((row) => row.storeId === store.id).length,
    carousel: carouselRows.filter((row) => row.storeId === store.id).length,
    settings: settingRows.filter((row) => row.storeId === store.id).length,
    trackingConfigured: trackingRows.some((row) => row.storeId === store.id),
    orders: orderRows.filter((row) => row.storeId === store.id).length,
  };
});

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  stores: summary,
  issueCounts: {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  },
  issues,
}, null, 2));
