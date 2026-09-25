import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db.ts";
import {
  categories,
  comboGroupItems,
  comboGroups,
  flavorSizePrices,
  modifierSizeRules,
  multiFlavorSettings,
  productAvailability,
  productCombos,
  productDrafts,
  productFlavors,
  productImages,
  productIngredients,
  productOptionGroups,
  productOptions,
  productSizes,
  productVariants,
  products,
} from "../../../drizzle/schema.ts";

export type CatalogReplicationScope = "product" | "category" | "catalog";
export type CatalogReplicationMode = "merge" | "replace";

export type CatalogReplicationInput = {
  sourceStoreId: number;
  targetStoreId: number;
  scope: CatalogReplicationScope;
  mode: CatalogReplicationMode;
  productId?: number;
  categoryId?: number;
};

export type CatalogReplicationResult = {
  targetStoreId: number;
  categoriesCopied: number;
  productsCopied: number;
  productsUpdated: number;
  archivedProducts: number;
  warnings: string[];
};

function productKey(categoryId: number, name: string) {
  return `${categoryId}::${name.trim().toLocaleLowerCase("pt-BR")}`;
}

export async function replicateCatalogToStore(
  input: CatalogReplicationInput,
): Promise<CatalogReplicationResult> {
  if (input.sourceStoreId === input.targetStoreId) {
    throw new Error("A loja de origem e a loja de destino precisam ser diferentes.");
  }

  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  return db.transaction(async (tx) => {
    const warnings: string[] = [];
    let archivedProducts = 0;

    const sourceCategoriesAll = await tx
      .select()
      .from(categories)
      .where(eq(categories.storeId, input.sourceStoreId));

    const sourceProductsAll = await tx
      .select()
      .from(products)
      .where(eq(products.storeId, input.sourceStoreId));

    let sourceProducts = sourceProductsAll;
    let sourceCategories = sourceCategoriesAll;

    if (input.scope === "product") {
      const sourceProduct = sourceProductsAll.find((row) => row.id === input.productId);
      if (!sourceProduct) throw new Error("Produto de origem não encontrado.");
      sourceProducts = [sourceProduct];
      sourceCategories = sourceCategoriesAll.filter((row) => row.id === sourceProduct.categoryId);
    } else if (input.scope === "category") {
      const sourceCategory = sourceCategoriesAll.find((row) => row.id === input.categoryId);
      if (!sourceCategory) throw new Error("Categoria de origem não encontrada.");
      sourceCategories = [sourceCategory];
      sourceProducts = sourceProductsAll.filter((row) => row.categoryId === sourceCategory.id);
    }

    if (!sourceCategories.length) {
      throw new Error("Nenhuma categoria encontrada para sincronizar.");
    }

    if (input.scope === "catalog" && input.mode === "replace") {
      const targetProducts = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.storeId, input.targetStoreId));

      archivedProducts = targetProducts.length;

      await tx
        .update(products)
        .set({
          active: false,
          editorialStatus: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(products.storeId, input.targetStoreId));

      await tx
        .update(categories)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(categories.storeId, input.targetStoreId));
    }

    const targetCategories = await tx
      .select()
      .from(categories)
      .where(eq(categories.storeId, input.targetStoreId));

    const categoryMap = new Map<number, number>();

    for (const sourceCategory of sourceCategories) {
      const existing = targetCategories.find((row) => row.slug === sourceCategory.slug);
      if (existing) {
        await tx
          .update(categories)
          .set({
            name: sourceCategory.name,
            description: sourceCategory.description,
            imageUrl: sourceCategory.imageUrl,
            icon: sourceCategory.icon,
            sortOrder: sourceCategory.sortOrder,
            active: sourceCategory.active,
            externalSource: null,
            externalMerchantId: null,
            externalId: null,
            updatedAt: new Date(),
          })
          .where(eq(categories.id, existing.id));
        categoryMap.set(sourceCategory.id, existing.id);
      } else {
        const [created] = await tx
          .insert(categories)
          .values({
            storeId: input.targetStoreId,
            name: sourceCategory.name,
            slug: sourceCategory.slug,
            description: sourceCategory.description,
            imageUrl: sourceCategory.imageUrl,
            icon: sourceCategory.icon,
            externalSource: null,
            externalMerchantId: null,
            externalId: null,
            sortOrder: sourceCategory.sortOrder,
            active: sourceCategory.active,
          })
          .returning({ id: categories.id });
        if (!created) throw new Error(`Não foi possível criar a categoria ${sourceCategory.name}.`);
        categoryMap.set(sourceCategory.id, created.id);
      }
    }

    const targetProductsBefore = await tx
      .select()
      .from(products)
      .where(eq(products.storeId, input.targetStoreId));

    const targetBySku = new Map(
      targetProductsBefore
        .filter((row) => row.sku)
        .map((row) => [String(row.sku), row]),
    );
    const targetByCategoryAndName = new Map(
      targetProductsBefore.map((row) => [productKey(row.categoryId, row.name), row]),
    );

    const productMap = new Map<number, number>();
    let productsCopied = 0;
    let productsUpdated = 0;

    for (const sourceProduct of sourceProducts) {
      const targetCategoryId = categoryMap.get(sourceProduct.categoryId);
      if (!targetCategoryId) {
        warnings.push(`Categoria ausente para ${sourceProduct.name}; produto ignorado.`);
        continue;
      }

      const existing =
        (sourceProduct.sku ? targetBySku.get(sourceProduct.sku) : undefined)
        ?? targetByCategoryAndName.get(productKey(targetCategoryId, sourceProduct.name));

      const baseValues = {
        categoryId: targetCategoryId,
        name: sourceProduct.name,
        description: sourceProduct.description,
        price: sourceProduct.price,
        imageUrl: sourceProduct.imageUrl,
        externalSource: null,
        externalMerchantId: null,
        externalId: null,
        externalCode: sourceProduct.externalCode,
        sku: sourceProduct.sku,
        shortDescription: sourceProduct.shortDescription,
        productType: sourceProduct.productType,
        pricingEngine: sourceProduct.pricingEngine,
        editorialStatus: sourceProduct.editorialStatus,
        preparationTime: sourceProduct.preparationTime,
        allergenNotice: sourceProduct.allergenNotice,
        nutritionalInfo: sourceProduct.nutritionalInfo,
        tags: sourceProduct.tags,
        minQuantity: sourceProduct.minQuantity,
        maxQuantity: sourceProduct.maxQuantity,
        couponEligible: sourceProduct.couponEligible,
        pointsEligible: sourceProduct.pointsEligible,
        scheduledPublishAt: sourceProduct.scheduledPublishAt,
        publishedAt: sourceProduct.publishedAt,
        archivedAt: sourceProduct.archivedAt,
        active: sourceProduct.active,
        featured: sourceProduct.featured,
        sortOrder: sourceProduct.sortOrder,
        updatedAt: new Date(),
      };

      if (existing) {
        await tx
          .update(products)
          .set({
            ...baseValues,
            version: Math.max(existing.version + 1, sourceProduct.version),
          })
          .where(eq(products.id, existing.id));
        productMap.set(sourceProduct.id, existing.id);
        productsUpdated += 1;
      } else {
        const [created] = await tx
          .insert(products)
          .values({
            storeId: input.targetStoreId,
            ...baseValues,
            version: sourceProduct.version,
          })
          .returning({ id: products.id });
        if (!created) throw new Error(`Não foi possível copiar o produto ${sourceProduct.name}.`);
        productMap.set(sourceProduct.id, created.id);
        productsCopied += 1;
      }
    }

    const sourceProductsById = new Map(sourceProductsAll.map((row) => [row.id, row]));
    const refreshedTargetProducts = await tx
      .select()
      .from(products)
      .where(eq(products.storeId, input.targetStoreId));
    const refreshedTargetBySku = new Map(
      refreshedTargetProducts.filter((row) => row.sku).map((row) => [String(row.sku), row.id]),
    );
    const refreshedTargetByName = new Map<string, number>();
    for (const row of refreshedTargetProducts) {
      const key = row.name.trim().toLocaleLowerCase("pt-BR");
      if (!refreshedTargetByName.has(key)) refreshedTargetByName.set(key, row.id);
    }

    const resolveTargetProductId = (sourceProductId: number | null) => {
      if (!sourceProductId) return null;
      const directlyMapped = productMap.get(sourceProductId);
      if (directlyMapped) return directlyMapped;
      const source = sourceProductsById.get(sourceProductId);
      if (!source) return null;
      if (source.sku && refreshedTargetBySku.has(source.sku)) {
        return refreshedTargetBySku.get(source.sku) ?? null;
      }
      return refreshedTargetByName.get(source.name.trim().toLocaleLowerCase("pt-BR")) ?? null;
    };

    const mappedTargetProductIds = Array.from(productMap.values());
    if (mappedTargetProductIds.length) {
      // Remove variants of every product that will be synchronized before
      // recreating any SKU. This avoids transient unique conflicts between
      // two products that are both part of the same replication transaction.
      await tx.delete(productVariants).where(and(
        eq(productVariants.storeId, input.targetStoreId),
        inArray(productVariants.productId, mappedTargetProductIds),
      ));
    }

    const remainingTargetVariants = await tx
      .select({ sku: productVariants.sku })
      .from(productVariants)
      .where(eq(productVariants.storeId, input.targetStoreId));
    const usedVariantSkus = new Set(
      remainingTargetVariants.flatMap((variant) => variant.sku ? [variant.sku] : []),
    );

    const globalSizeMap = new Map<number, number>();

    for (const sourceProduct of sourceProducts) {
      const targetProductId = productMap.get(sourceProduct.id);
      if (!targetProductId) continue;

      const targetGroupIds = (await tx
        .select({ id: productOptionGroups.id })
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.storeId, input.targetStoreId),
          eq(productOptionGroups.productId, targetProductId),
        ))).map((row) => row.id);

      const targetSizeIds = (await tx
        .select({ id: productSizes.id })
        .from(productSizes)
        .where(and(
          eq(productSizes.storeId, input.targetStoreId),
          eq(productSizes.productId, targetProductId),
        ))).map((row) => row.id);

      const targetFlavorIds = (await tx
        .select({ id: productFlavors.id })
        .from(productFlavors)
        .where(and(
          eq(productFlavors.storeId, input.targetStoreId),
          eq(productFlavors.productId, targetProductId),
        ))).map((row) => row.id);

      const targetComboIds = (await tx
        .select({ id: productCombos.id })
        .from(productCombos)
        .where(and(
          eq(productCombos.storeId, input.targetStoreId),
          eq(productCombos.productId, targetProductId),
        ))).map((row) => row.id);

      const targetComboGroupIds = targetComboIds.length
        ? (await tx
            .select({ id: comboGroups.id })
            .from(comboGroups)
            .where(and(
              eq(comboGroups.storeId, input.targetStoreId),
              inArray(comboGroups.comboId, targetComboIds),
            ))).map((row) => row.id)
        : [];

      if (targetComboGroupIds.length) {
        await tx.delete(comboGroupItems).where(and(
          eq(comboGroupItems.storeId, input.targetStoreId),
          inArray(comboGroupItems.groupId, targetComboGroupIds),
        ));
      }
      if (targetComboIds.length) {
        await tx.delete(comboGroups).where(and(
          eq(comboGroups.storeId, input.targetStoreId),
          inArray(comboGroups.comboId, targetComboIds),
        ));
      }
      await tx.delete(productCombos).where(and(
        eq(productCombos.storeId, input.targetStoreId),
        eq(productCombos.productId, targetProductId),
      ));

      if (targetGroupIds.length) {
        const targetOptionIds = (await tx
          .select({ id: productOptions.id })
          .from(productOptions)
          .where(and(
            eq(productOptions.storeId, input.targetStoreId),
            inArray(productOptions.groupId, targetGroupIds),
          ))).map((row) => row.id);

        if (targetOptionIds.length) {
          await tx.delete(modifierSizeRules).where(and(
            eq(modifierSizeRules.storeId, input.targetStoreId),
            inArray(modifierSizeRules.modifierOptionId, targetOptionIds),
          ));
        }
        await tx.delete(productOptions).where(and(
          eq(productOptions.storeId, input.targetStoreId),
          inArray(productOptions.groupId, targetGroupIds),
        ));
      }
      await tx.delete(productOptionGroups).where(and(
        eq(productOptionGroups.storeId, input.targetStoreId),
        eq(productOptionGroups.productId, targetProductId),
      ));

      if (targetFlavorIds.length) {
        await tx.delete(flavorSizePrices).where(and(
          eq(flavorSizePrices.storeId, input.targetStoreId),
          inArray(flavorSizePrices.flavorId, targetFlavorIds),
        ));
      }
      await tx.delete(productFlavors).where(and(
        eq(productFlavors.storeId, input.targetStoreId),
        eq(productFlavors.productId, targetProductId),
      ));
      await tx.delete(multiFlavorSettings).where(and(
        eq(multiFlavorSettings.storeId, input.targetStoreId),
        eq(multiFlavorSettings.productId, targetProductId),
      ));

      if (targetSizeIds.length) {
        await tx.delete(modifierSizeRules).where(and(
          eq(modifierSizeRules.storeId, input.targetStoreId),
          inArray(modifierSizeRules.productSizeId, targetSizeIds),
        ));
      }
      await tx.delete(productSizes).where(and(
        eq(productSizes.storeId, input.targetStoreId),
        eq(productSizes.productId, targetProductId),
      ));

      await tx.delete(productAvailability).where(and(
        eq(productAvailability.storeId, input.targetStoreId),
        eq(productAvailability.productId, targetProductId),
      ));
      await tx.delete(productImages).where(and(
        eq(productImages.storeId, input.targetStoreId),
        eq(productImages.productId, targetProductId),
      ));
      await tx.delete(productVariants).where(and(
        eq(productVariants.storeId, input.targetStoreId),
        eq(productVariants.productId, targetProductId),
      ));
      await tx.delete(productIngredients).where(eq(productIngredients.productId, targetProductId));
      await tx.delete(productDrafts).where(and(
        eq(productDrafts.storeId, input.targetStoreId),
        eq(productDrafts.productId, targetProductId),
      ));

      const sourceSizes = await tx
        .select()
        .from(productSizes)
        .where(and(
          eq(productSizes.storeId, input.sourceStoreId),
          eq(productSizes.productId, sourceProduct.id),
        ));

      const localSizeMap = new Map<number, number>();
      for (const size of sourceSizes) {
        const [created] = await tx.insert(productSizes).values({
          storeId: input.targetStoreId,
          productId: targetProductId,
          name: size.name,
          internalCode: size.internalCode,
          description: size.description,
          price: size.price,
          promotionalPrice: size.promotionalPrice,
          promotionStartsAt: size.promotionStartsAt,
          promotionEndsAt: size.promotionEndsAt,
          serves: size.serves,
          minFlavors: size.minFlavors,
          maxFlavors: size.maxFlavors,
          maxAddons: size.maxAddons,
          preparationTime: size.preparationTime,
          active: size.active,
          sortOrder: size.sortOrder,
        }).returning({ id: productSizes.id });
        if (created) {
          localSizeMap.set(size.id, created.id);
          globalSizeMap.set(size.id, created.id);
        }
      }

      const sourceImages = await tx
        .select()
        .from(productImages)
        .where(and(
          eq(productImages.storeId, input.sourceStoreId),
          eq(productImages.productId, sourceProduct.id),
        ));
      if (sourceImages.length) {
        await tx.insert(productImages).values(sourceImages.map((image) => ({
          storeId: input.targetStoreId,
          productId: targetProductId,
          imageUrl: image.imageUrl,
          altText: image.altText,
          kind: image.kind,
          sortOrder: image.sortOrder,
          active: image.active,
        })));
      }

      const sourceVariants = await tx
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.storeId, input.sourceStoreId),
          eq(productVariants.productId, sourceProduct.id),
        ));
      for (const variant of sourceVariants) {
        let variantSku = variant.sku;
        if (variantSku && usedVariantSkus.has(variantSku)) {
          warnings.push(`SKU da variação "${variant.name}" de ${sourceProduct.name} já existe em outro item do destino; a variação foi copiada sem SKU.`);
          variantSku = null;
        }

        await tx.insert(productVariants).values({
          storeId: input.targetStoreId,
          productId: targetProductId,
          name: variant.name,
          sku: variantSku,
          price: variant.price,
          promotionalPrice: variant.promotionalPrice,
          active: variant.active,
          sortOrder: variant.sortOrder,
        });
        if (variantSku) usedVariantSkus.add(variantSku);
      }

      const sourceGroups = await tx
        .select()
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.storeId, input.sourceStoreId),
          eq(productOptionGroups.productId, sourceProduct.id),
        ));
      const sourceGroupIds = sourceGroups.map((row) => row.id);
      const sourceOptions = sourceGroupIds.length
        ? await tx.select().from(productOptions).where(and(
            eq(productOptions.storeId, input.sourceStoreId),
            inArray(productOptions.groupId, sourceGroupIds),
          ))
        : [];

      const optionMap = new Map<number, number>();
      for (const group of sourceGroups) {
        const [createdGroup] = await tx.insert(productOptionGroups).values({
          storeId: input.targetStoreId,
          productId: targetProductId,
          name: group.name,
          kind: group.kind,
          description: group.description,
          required: group.required,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          freeSelections: group.freeSelections,
          allowRepeatedOptions: group.allowRepeatedOptions,
          appliesToAllSizes: group.appliesToAllSizes,
          sortOrder: group.sortOrder,
          active: group.active,
        }).returning({ id: productOptionGroups.id });
        if (!createdGroup) continue;

        for (const option of sourceOptions.filter((row) => row.groupId === group.id)) {
          const linkedProductId = resolveTargetProductId(option.linkedProductId);
          if (option.linkedProductId && !linkedProductId) {
            warnings.push(`Vínculo "${option.name}" de ${sourceProduct.name} aponta para um produto que não existe no destino.`);
          }
          const [createdOption] = await tx.insert(productOptions).values({
            storeId: input.targetStoreId,
            groupId: createdGroup.id,
            name: option.name,
            description: option.description,
            priceDelta: option.priceDelta,
            linkedProductId,
            ingredientId: null,
            ingredientQuantity: null,
            imageUrl: option.imageUrl,
            maxQuantity: option.maxQuantity,
            allowRepeat: option.allowRepeat,
            sortOrder: option.sortOrder,
            active: option.active,
          }).returning({ id: productOptions.id });
          if (createdOption) optionMap.set(option.id, createdOption.id);
        }
      }

      if (optionMap.size && localSizeMap.size) {
        const sourceRules = await tx.select().from(modifierSizeRules).where(and(
          eq(modifierSizeRules.storeId, input.sourceStoreId),
          inArray(modifierSizeRules.modifierOptionId, Array.from(optionMap.keys())),
        ));
        const rules = sourceRules.flatMap((rule) => {
          const modifierOptionId = optionMap.get(rule.modifierOptionId);
          const productSizeId = localSizeMap.get(rule.productSizeId);
          return modifierOptionId && productSizeId ? [{
            storeId: input.targetStoreId,
            modifierOptionId,
            productSizeId,
            enabled: rule.enabled,
            priceOverride: rule.priceOverride,
            maxQuantityOverride: rule.maxQuantityOverride,
          }] : [];
        });
        if (rules.length) await tx.insert(modifierSizeRules).values(rules);
      }

      const [sourceFlavorSettings] = await tx
        .select()
        .from(multiFlavorSettings)
        .where(and(
          eq(multiFlavorSettings.storeId, input.sourceStoreId),
          eq(multiFlavorSettings.productId, sourceProduct.id),
        ))
        .limit(1);
      if (sourceFlavorSettings) {
        await tx.insert(multiFlavorSettings).values({
          storeId: input.targetStoreId,
          productId: targetProductId,
          enabled: sourceFlavorSettings.enabled,
          pricingRule: sourceFlavorSettings.pricingRule,
          allowRepeatedFlavors: sourceFlavorSettings.allowRepeatedFlavors,
          visualDivisions: sourceFlavorSettings.visualDivisions,
        });
      }

      const sourceFlavors = await tx
        .select()
        .from(productFlavors)
        .where(and(
          eq(productFlavors.storeId, input.sourceStoreId),
          eq(productFlavors.productId, sourceProduct.id),
        ));
      const localFlavorMap = new Map<number, number>();
      for (const flavor of sourceFlavors) {
        const [createdFlavor] = await tx.insert(productFlavors).values({
          storeId: input.targetStoreId,
          productId: targetProductId,
          name: flavor.name,
          description: flavor.description,
          imageUrl: flavor.imageUrl,
          ingredients: flavor.ingredients,
          removableIngredients: flavor.removableIngredients,
          active: flavor.active,
          sortOrder: flavor.sortOrder,
        }).returning({ id: productFlavors.id });
        if (createdFlavor) localFlavorMap.set(flavor.id, createdFlavor.id);
      }

      if (localFlavorMap.size && localSizeMap.size) {
        const sourcePrices = await tx.select().from(flavorSizePrices).where(and(
          eq(flavorSizePrices.storeId, input.sourceStoreId),
          inArray(flavorSizePrices.flavorId, Array.from(localFlavorMap.keys())),
        ));
        const prices = sourcePrices.flatMap((price) => {
          const flavorId = localFlavorMap.get(price.flavorId);
          const productSizeId = localSizeMap.get(price.productSizeId);
          return flavorId && productSizeId ? [{
            storeId: input.targetStoreId,
            flavorId,
            productSizeId,
            price: price.price,
            active: price.active,
          }] : [];
        });
        if (prices.length) await tx.insert(flavorSizePrices).values(prices);
      }

      const sourceAvailability = await tx
        .select()
        .from(productAvailability)
        .where(and(
          eq(productAvailability.storeId, input.sourceStoreId),
          eq(productAvailability.productId, sourceProduct.id),
        ));
      if (sourceAvailability.length) {
        await tx.insert(productAvailability).values(sourceAvailability.map((rule) => ({
          storeId: input.targetStoreId,
          productId: targetProductId,
          weekday: rule.weekday,
          startTime: rule.startTime,
          endTime: rule.endTime,
          startsAt: rule.startsAt,
          expiresAt: rule.expiresAt,
          channel: rule.channel,
          unavailableBehavior: rule.unavailableBehavior,
          stockLimit: rule.stockLimit,
          pausedUntil: rule.pausedUntil,
          active: rule.active,
        })));
      }
    }

    // Combos are cloned after all products/sizes so cross-product references can be remapped.
    for (const sourceProduct of sourceProducts) {
      const targetProductId = productMap.get(sourceProduct.id);
      if (!targetProductId) continue;

      const [sourceCombo] = await tx
        .select()
        .from(productCombos)
        .where(and(
          eq(productCombos.storeId, input.sourceStoreId),
          eq(productCombos.productId, sourceProduct.id),
        ))
        .limit(1);
      if (!sourceCombo) continue;

      const [createdCombo] = await tx.insert(productCombos).values({
        storeId: input.targetStoreId,
        productId: targetProductId,
        name: sourceCombo.name,
        description: sourceCombo.description,
        active: sourceCombo.active,
      }).returning({ id: productCombos.id });
      if (!createdCombo) continue;

      const sourceGroups = await tx
        .select()
        .from(comboGroups)
        .where(and(
          eq(comboGroups.storeId, input.sourceStoreId),
          eq(comboGroups.comboId, sourceCombo.id),
        ));
      for (const group of sourceGroups) {
        const [createdGroup] = await tx.insert(comboGroups).values({
          storeId: input.targetStoreId,
          comboId: createdCombo.id,
          name: group.name,
          required: group.required,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
          active: group.active,
        }).returning({ id: comboGroups.id });
        if (!createdGroup) continue;

        const sourceItems = await tx
          .select()
          .from(comboGroupItems)
          .where(and(
            eq(comboGroupItems.storeId, input.sourceStoreId),
            eq(comboGroupItems.groupId, group.id),
          ));

        const targetItems = sourceItems.flatMap((item) => {
          const productId = resolveTargetProductId(item.productId);
          if (!productId) {
            warnings.push(`Item de combo do produto ${sourceProduct.name} não existe no destino e foi ignorado.`);
            return [];
          }
          const sizeId = item.sizeId ? globalSizeMap.get(item.sizeId) ?? null : null;
          if (item.sizeId && !sizeId) {
            warnings.push(`Tamanho de um item do combo ${sourceProduct.name} não existe no destino e foi removido do vínculo.`);
          }
          return [{
            storeId: input.targetStoreId,
            groupId: createdGroup.id,
            productId,
            sizeId,
            priceDelta: item.priceDelta,
            active: item.active,
          }];
        });
        if (targetItems.length) await tx.insert(comboGroupItems).values(targetItems);
      }
    }

    return {
      targetStoreId: input.targetStoreId,
      categoriesCopied: categoryMap.size,
      productsCopied,
      productsUpdated,
      archivedProducts,
      warnings,
    };
  });
}
