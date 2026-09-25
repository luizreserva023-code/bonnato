import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  comboGroupItems,
  comboGroups,
  flavorSizePrices,
  modifierSizeRules,
  multiFlavorSettings,
  productAvailability,
  productCombos,
  productFlavors,
  productOptionGroups,
  productOptions,
  productSizes,
  products,
  upsells,
} from "../../../drizzle/schema.ts";
import type { ConfiguredCatalogProduct } from "../../../shared/catalog.ts";
import { getDb } from "../../db.ts";

export async function getConfiguredCatalogProduct(input: {
  storeId: number;
  productId: number;
  includeInactive?: boolean;
}): Promise<ConfiguredCatalogProduct> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

  const productConditions = [eq(products.id, input.productId), eq(products.storeId, input.storeId)];
  if (!input.includeInactive) productConditions.push(eq(products.active, true));
  const [product] = await db.select().from(products).where(and(...productConditions)).limit(1);
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado nesta loja." });

  const [sizes, groups, flavorSettingsRows, flavors, availability, comboRows, upsellRows] = await Promise.all([
    db.select().from(productSizes).where(and(eq(productSizes.storeId, input.storeId), eq(productSizes.productId, input.productId))).orderBy(asc(productSizes.sortOrder), asc(productSizes.id)),
    db.select().from(productOptionGroups).where(and(eq(productOptionGroups.storeId, input.storeId), eq(productOptionGroups.productId, input.productId))).orderBy(asc(productOptionGroups.sortOrder), asc(productOptionGroups.id)),
    db.select().from(multiFlavorSettings).where(and(eq(multiFlavorSettings.storeId, input.storeId), eq(multiFlavorSettings.productId, input.productId))).limit(1),
    db.select().from(productFlavors).where(and(eq(productFlavors.storeId, input.storeId), eq(productFlavors.productId, input.productId))).orderBy(asc(productFlavors.sortOrder), asc(productFlavors.id)),
    db.select().from(productAvailability).where(and(eq(productAvailability.storeId, input.storeId), eq(productAvailability.productId, input.productId))),
    db.select().from(productCombos).where(and(eq(productCombos.storeId, input.storeId), eq(productCombos.productId, input.productId))).limit(1),
    db.select().from(upsells).where(and(
      eq(upsells.storeId, input.storeId),
      or(eq(upsells.triggerProductId, input.productId), isNull(upsells.triggerProductId)),
      input.includeInactive ? undefined : eq(upsells.active, true),
    )),
  ]);

  const options = groups.length
    ? await db.select().from(productOptions).where(and(eq(productOptions.storeId, input.storeId), inArray(productOptions.groupId, groups.map((group) => group.id)))).orderBy(asc(productOptions.sortOrder), asc(productOptions.id))
    : [];
  const sizeRules = options.length
    ? await db.select().from(modifierSizeRules).where(and(eq(modifierSizeRules.storeId, input.storeId), inArray(modifierSizeRules.modifierOptionId, options.map((option) => option.id))))
    : [];
  const flavorPrices = flavors.length
    ? await db.select().from(flavorSizePrices).where(and(eq(flavorSizePrices.storeId, input.storeId), inArray(flavorSizePrices.flavorId, flavors.map((flavor) => flavor.id))))
    : [];

  const combo = comboRows[0];
  const comboGroupRows = combo
    ? await db.select().from(comboGroups).where(and(eq(comboGroups.storeId, input.storeId), eq(comboGroups.comboId, combo.id))).orderBy(asc(comboGroups.sortOrder), asc(comboGroups.id))
    : [];
  const comboItems = comboGroupRows.length
    ? await db.select().from(comboGroupItems).where(and(eq(comboGroupItems.storeId, input.storeId), inArray(comboGroupItems.groupId, comboGroupRows.map((group) => group.id))))
    : [];

  const suggestedProductIds = Array.from(new Set(upsellRows.map((upsell) => upsell.suggestedProductId)));
  const suggestedProducts = suggestedProductIds.length
    ? await db.select().from(products).where(and(eq(products.storeId, input.storeId), inArray(products.id, suggestedProductIds)))
    : [];

  return {
    id: product.id,
    storeId: product.storeId,
    name: product.name,
    basePrice: Number(product.price),
    productType: product.productType,
    pricingEngine: product.pricingEngine,
    active: product.active,
    minQuantity: product.minQuantity,
    maxQuantity: product.maxQuantity,
    sizes: sizes.map((size) => ({
      id: size.id,
      name: size.name,
      price: Number(size.price),
      promotionalPrice: size.promotionalPrice == null ? null : Number(size.promotionalPrice),
      promotionStartsAt: size.promotionStartsAt,
      promotionEndsAt: size.promotionEndsAt,
      minFlavors: size.minFlavors,
      maxFlavors: size.maxFlavors,
      maxAddons: size.maxAddons,
      active: size.active,
    })),
    modifierGroups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      freeSelections: group.freeSelections,
      allowRepeatedOptions: group.allowRepeatedOptions,
      active: group.active,
      options: options.filter((option) => option.groupId === group.id).map((option) => ({
        id: option.id,
        name: option.name,
        price: Number(option.priceDelta),
        active: option.active,
        maxQuantity: option.maxQuantity,
        allowRepeat: option.allowRepeat,
        sizeRules: sizeRules.filter((rule) => rule.modifierOptionId === option.id).map((rule) => ({
          sizeId: rule.productSizeId,
          enabled: rule.enabled,
          priceOverride: rule.priceOverride == null ? null : Number(rule.priceOverride),
          maxQuantityOverride: rule.maxQuantityOverride,
        })),
      })),
    })),
    flavors: flavors.map((flavor) => ({
      id: flavor.id,
      name: flavor.name,
      active: flavor.active,
      pricesBySize: Object.fromEntries(flavorPrices.filter((price) => price.flavorId === flavor.id && price.active).map((price) => [price.productSizeId, Number(price.price)])),
    })),
    flavorSettings: flavorSettingsRows[0] ? {
      enabled: flavorSettingsRows[0].enabled,
      pricingRule: flavorSettingsRows[0].pricingRule,
      allowRepeatedFlavors: flavorSettingsRows[0].allowRepeatedFlavors,
    } : null,
    comboGroups: comboGroupRows.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      active: group.active,
      items: comboItems.filter((item) => item.groupId === group.id).map((item) => ({
        id: item.id,
        productId: item.productId,
        sizeId: item.sizeId,
        price: Number(item.priceDelta),
        active: item.active,
      })),
    })),
    upsellOffers: upsellRows.flatMap((upsell) => {
      const suggested = suggestedProducts.find((candidate) => candidate.id === upsell.suggestedProductId);
      if (!suggested || (!input.includeInactive && !suggested.active)) return [];
      const base = Number(suggested.price);
      const discount = Math.min(100, Math.max(0, upsell.discountPercent ?? 0));
      return [{ productId: suggested.id, name: suggested.name, price: Math.round(base * (1 - discount / 100) * 100) / 100, active: upsell.active && suggested.active }];
    }),
    availability: availability.map((rule) => ({
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
      startsAt: rule.startsAt,
      expiresAt: rule.expiresAt,
      channel: rule.channel,
      stockLimit: rule.stockLimit,
      pausedUntil: rule.pausedUntil,
      active: rule.active,
    })),
  };
}
