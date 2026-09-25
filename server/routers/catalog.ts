import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import { calculateConfiguredProductPrice, createOrderItemConfigurationSnapshot } from "../domains/catalog/pricing.ts";
import { getConfiguredCatalogProduct } from "../domains/catalog/repository.ts";
import { replicateCatalogToStore } from "../domains/catalog/replication.ts";
import { resolveRequiredStoreId } from "../storeUtils.ts";
import { getDb } from "../db.ts";
import { recordStoreAudit } from "../storeAudit.ts";
import {
  flavorSizePrices,
  categories,
  modifierSizeRules,
  multiFlavorSettings,
  productFlavors,
  productOptionGroups,
  productOptions,
  productSizes,
  productAvailability,
  productAuditLogs,
  products,
} from "../../drizzle/schema.ts";

export const selectionSchema = z.object({
  quantity: z.number().int().min(1).max(999),
  sizeId: z.number().int().positive().optional().nullable(),
  flavorIds: z.array(z.number().int().positive()).max(12).optional(),
  modifiers: z.array(z.object({
    groupId: z.number().int().positive(),
    optionId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
  })).max(100).optional(),
  combos: z.array(z.object({
    groupId: z.number().int().positive(),
    itemId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
  })).max(100).optional(),
  upsells: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
  })).max(20).optional(),
  removedIngredients: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  channel: z.enum(["delivery", "pickup", "dine_in", "counter"]),
});

export const catalogOrderConfigurationSchema = selectionSchema.omit({ quantity: true, channel: true });

const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Informe um valor valido");

const modifierOptionEditorSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  price: moneySchema,
  maxQuantity: z.number().int().min(1).max(99).default(1),
  active: z.boolean().default(true),
});

const modifierGroupEditorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).max(50).default(0),
  maxSelections: z.number().int().min(1).max(50).default(1),
  freeSelections: z.number().int().min(0).max(50).default(0),
  allowRepeatedOptions: z.boolean().default(false),
  active: z.boolean().default(true),
  options: z.array(modifierOptionEditorSchema).min(1).max(100),
}).superRefine((group, ctx) => {
  if (group.minSelections > group.maxSelections) {
    ctx.addIssue({ code: "custom", path: ["minSelections"], message: "A quantidade mínima não pode ser maior que a máxima." });
  }
  if (group.freeSelections > group.maxSelections) {
    ctx.addIssue({ code: "custom", path: ["freeSelections"], message: "A quantidade gratuita não pode ser maior que a máxima." });
  }
  if (group.required && group.minSelections < 1) {
    ctx.addIssue({ code: "custom", path: ["minSelections"], message: "Grupo obrigatório precisa exigir pelo menos uma seleção." });
  }
});

const editorProductSchema = z.object({
  storeId: z.number().int().positive(),
  productId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(200),
  shortDescription: z.string().trim().max(320).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  price: moneySchema,
  imageUrl: z.string().trim().max(2048).optional().nullable(),
  sku: z.string().trim().max(128).optional().nullable(),
  productType: z.enum(["simple", "sizes", "buildable", "multi_flavor", "combo"]),
  editorialStatus: z.enum(["draft", "published"]),
  preparationTime: z.number().int().min(0).max(600).optional().nullable(),
  minQuantity: z.number().int().min(1).max(999).default(1),
  maxQuantity: z.number().int().min(1).max(999).default(99),
  couponEligible: z.boolean().default(true),
  pointsEligible: z.boolean().default(true),
  featured: z.boolean().default(false),
  sizes: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    price: moneySchema,
    promotionalPrice: moneySchema.optional().nullable(),
    serves: z.number().int().min(1).max(50).optional().nullable(),
    minFlavors: z.number().int().min(1).max(12).optional().nullable(),
    maxFlavors: z.number().int().min(1).max(12).optional().nullable(),
  })).max(20).default([]),
  modifierGroups: z.array(modifierGroupEditorSchema).max(30).default([]),
  flavorSettings: z.object({
    enabled: z.boolean(),
    pricingRule: z.enum(["highest_price", "average_price", "proportional_price", "size_fixed_price", "base_plus_difference"]),
    allowRepeatedFlavors: z.boolean().default(false),
  }).optional().nullable(),
  flavors: z.array(z.object({
    name: z.string().trim().min(1).max(160),
    prices: z.array(moneySchema).max(20),
  })).max(100).default([]),
}).superRefine((value, ctx) => {
  if (value.maxQuantity < value.minQuantity) {
    ctx.addIssue({ code: "custom", path: ["maxQuantity"], message: "A quantidade maxima deve ser maior que a minima" });
  }
  if (["sizes", "multi_flavor"].includes(value.productType) && value.sizes.length === 0) {
    ctx.addIssue({ code: "custom", path: ["sizes"], message: "Cadastre pelo menos um tamanho" });
  }
  if (value.productType === "multi_flavor" && value.flavors.length < 2) {
    ctx.addIssue({ code: "custom", path: ["flavors"], message: "Cadastre pelo menos dois sabores" });
  }
  value.modifierGroups.forEach((group, index) => {
    if (group.maxSelections < group.minSelections) {
      ctx.addIssue({ code: "custom", path: ["modifierGroups", index, "maxSelections"], message: "O maximo deve ser maior que o minimo" });
    }
  });
});

export const catalogRouter = router({
  configuration: publicProcedure
    .input(z.object({ storeId: z.number().int().positive(), productId: z.number().int().positive() }))
    .query(({ input }) => getConfiguredCatalogProduct(input)),

  calculatePrice: publicProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      productId: z.number().int().positive(),
      selection: selectionSchema,
    }))
    .mutation(async ({ input }) => {
      const product = await getConfiguredCatalogProduct({ storeId: input.storeId, productId: input.productId });
      return calculateConfiguredProductPrice(product, input.selection);
    }),

  adminConfiguration: staffProcedure
    .input(z.object({ storeId: z.number().int().positive(), productId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return getConfiguredCatalogProduct({ storeId, productId: input.productId, includeInactive: true });
    }),

  duplicateProduct: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      productId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const duplicated = await db.transaction(async (tx) => {
        const [source] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, input.productId), eq(products.storeId, storeId)))
          .limit(1);
        if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado nesta unidade." });

        const duplicateName = `Cópia de ${source.name}`.slice(0, 200);
        const [copy] = await tx.insert(products).values({
          storeId,
          categoryId: source.categoryId,
          name: duplicateName,
          description: source.description,
          price: source.price,
          imageUrl: source.imageUrl,
          sku: null,
          shortDescription: source.shortDescription,
          productType: source.productType,
          pricingEngine: source.pricingEngine,
          editorialStatus: "draft",
          preparationTime: source.preparationTime,
          allergenNotice: source.allergenNotice,
          nutritionalInfo: source.nutritionalInfo,
          tags: source.tags,
          minQuantity: source.minQuantity,
          maxQuantity: source.maxQuantity,
          couponEligible: source.couponEligible,
          pointsEligible: source.pointsEligible,
          version: 1,
          active: false,
          featured: false,
          sortOrder: source.sortOrder + 1,
        }).returning({ id: products.id, name: products.name });
        if (!copy) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível duplicar o produto." });

        const sourceSizes = await tx.select().from(productSizes)
          .where(and(eq(productSizes.storeId, storeId), eq(productSizes.productId, source.id)));
        const sizeMap = new Map<number, number>();
        for (const size of sourceSizes) {
          const [created] = await tx.insert(productSizes).values({
            storeId,
            productId: copy.id,
            name: size.name,
            internalCode: null,
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
          if (created) sizeMap.set(size.id, created.id);
        }

        const sourceGroups = await tx.select().from(productOptionGroups)
          .where(and(eq(productOptionGroups.storeId, storeId), eq(productOptionGroups.productId, source.id)));
        const sourceGroupIds = sourceGroups.map((group) => group.id);
        const sourceOptions = sourceGroupIds.length
          ? await tx.select().from(productOptions).where(and(
              eq(productOptions.storeId, storeId),
              inArray(productOptions.groupId, sourceGroupIds),
            ))
          : [];
        const optionMap = new Map<number, number>();

        for (const group of sourceGroups) {
          const [createdGroup] = await tx.insert(productOptionGroups).values({
            storeId,
            productId: copy.id,
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
            const [createdOption] = await tx.insert(productOptions).values({
              storeId,
              groupId: createdGroup.id,
              name: option.name,
              description: option.description,
              priceDelta: option.priceDelta,
              linkedProductId: option.linkedProductId,
              ingredientId: option.ingredientId,
              ingredientQuantity: option.ingredientQuantity,
              imageUrl: option.imageUrl,
              maxQuantity: option.maxQuantity,
              allowRepeat: option.allowRepeat,
              sortOrder: option.sortOrder,
              active: option.active,
            }).returning({ id: productOptions.id });
            if (createdOption) optionMap.set(option.id, createdOption.id);
          }
        }

        if (optionMap.size && sizeMap.size) {
          const sourceRules = await tx.select().from(modifierSizeRules).where(and(
            eq(modifierSizeRules.storeId, storeId),
            inArray(modifierSizeRules.modifierOptionId, Array.from(optionMap.keys())),
          ));
          const clonedRules = sourceRules.flatMap((rule) => {
            const modifierOptionId = optionMap.get(rule.modifierOptionId);
            const productSizeId = sizeMap.get(rule.productSizeId);
            return modifierOptionId && productSizeId ? [{
              storeId,
              modifierOptionId,
              productSizeId,
              enabled: rule.enabled,
              priceOverride: rule.priceOverride,
              maxQuantityOverride: rule.maxQuantityOverride,
            }] : [];
          });
          if (clonedRules.length) await tx.insert(modifierSizeRules).values(clonedRules);
        }

        const [sourceFlavorSettings] = await tx.select().from(multiFlavorSettings)
          .where(and(eq(multiFlavorSettings.storeId, storeId), eq(multiFlavorSettings.productId, source.id)))
          .limit(1);
        if (sourceFlavorSettings) {
          await tx.insert(multiFlavorSettings).values({
            storeId,
            productId: copy.id,
            enabled: sourceFlavorSettings.enabled,
            pricingRule: sourceFlavorSettings.pricingRule,
            allowRepeatedFlavors: sourceFlavorSettings.allowRepeatedFlavors,
            visualDivisions: sourceFlavorSettings.visualDivisions,
          });
        }

        const sourceFlavors = await tx.select().from(productFlavors)
          .where(and(eq(productFlavors.storeId, storeId), eq(productFlavors.productId, source.id)));
        const flavorMap = new Map<number, number>();
        for (const flavor of sourceFlavors) {
          const [createdFlavor] = await tx.insert(productFlavors).values({
            storeId,
            productId: copy.id,
            name: flavor.name,
            description: flavor.description,
            imageUrl: flavor.imageUrl,
            ingredients: flavor.ingredients,
            removableIngredients: flavor.removableIngredients,
            active: flavor.active,
            sortOrder: flavor.sortOrder,
          }).returning({ id: productFlavors.id });
          if (createdFlavor) flavorMap.set(flavor.id, createdFlavor.id);
        }

        if (flavorMap.size && sizeMap.size) {
          const sourcePrices = await tx.select().from(flavorSizePrices).where(and(
            eq(flavorSizePrices.storeId, storeId),
            inArray(flavorSizePrices.flavorId, Array.from(flavorMap.keys())),
          ));
          const clonedPrices = sourcePrices.flatMap((price) => {
            const flavorId = flavorMap.get(price.flavorId);
            const productSizeId = sizeMap.get(price.productSizeId);
            return flavorId && productSizeId ? [{
              storeId,
              flavorId,
              productSizeId,
              price: price.price,
              active: price.active,
            }] : [];
          });
          if (clonedPrices.length) await tx.insert(flavorSizePrices).values(clonedPrices);
        }

        const sourceAvailability = await tx.select().from(productAvailability)
          .where(and(eq(productAvailability.storeId, storeId), eq(productAvailability.productId, source.id)));
        if (sourceAvailability.length) {
          await tx.insert(productAvailability).values(sourceAvailability.map((rule) => ({
            storeId,
            productId: copy.id,
            weekday: rule.weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
            startsAt: rule.startsAt,
            expiresAt: rule.expiresAt,
            channel: rule.channel,
            unavailableBehavior: rule.unavailableBehavior,
            stockLimit: rule.stockLimit,
            pausedUntil: null,
            active: rule.active,
          })));
        }

        await tx.insert(productAuditLogs).values({
          storeId,
          productId: copy.id,
          actorUserId: ctx.user.id,
          action: "duplicate",
          fieldName: "sourceProductId",
          previousValue: String(source.id),
          newValue: String(copy.id),
        });

        return copy;
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "product.duplicate",
        resourceType: "product",
        resourceId: String(duplicated.id),
        metadata: { sourceProductId: input.productId, duplicatedProductId: duplicated.id },
      });

      return duplicated;
    }),

  replicateAcrossStores: staffProcedure
    .input(z.object({
      sourceStoreId: z.number().int().positive(),
      targetStoreIds: z.array(z.number().int().positive()).min(1).max(20),
      scope: z.enum(["product", "category", "catalog"]),
      mode: z.enum(["merge", "replace"]).default("merge"),
      productId: z.number().int().positive().optional(),
      categoryId: z.number().int().positive().optional(),
    }).superRefine((value, ctx) => {
      if (value.scope === "product" && !value.productId) {
        ctx.addIssue({ code: "custom", path: ["productId"], message: "Selecione o produto que será copiado." });
      }
      if (value.scope === "category" && !value.categoryId) {
        ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Selecione a categoria que será copiada." });
      }
      if (value.scope !== "catalog" && value.mode === "replace") {
        ctx.addIssue({ code: "custom", path: ["mode"], message: "Substituir o cardápio só é permitido na cópia do cardápio completo." });
      }
      if (value.targetStoreIds.includes(value.sourceStoreId)) {
        ctx.addIssue({ code: "custom", path: ["targetStoreIds"], message: "A loja de origem não pode ser também destino." });
      }
      if (new Set(value.targetStoreIds).size !== value.targetStoreIds.length) {
        ctx.addIssue({ code: "custom", path: ["targetStoreIds"], message: "Não repita a mesma loja de destino." });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      const sourceStoreId = await resolveRequiredStoreId(ctx.user, input.sourceStoreId);
      const targetStoreIds: number[] = [];
      for (const requestedTargetStoreId of input.targetStoreIds) {
        targetStoreIds.push(await resolveRequiredStoreId(ctx.user, requestedTargetStoreId));
      }

      const results = [];
      for (const targetStoreId of targetStoreIds) {
        const result = await replicateCatalogToStore({
          sourceStoreId,
          targetStoreId,
          scope: input.scope,
          mode: input.scope === "catalog" ? input.mode : "merge",
          productId: input.productId,
          categoryId: input.categoryId,
        });
        results.push(result);

        await recordStoreAudit({
          storeId: targetStoreId,
          actorUserId: ctx.user.id,
          action: "catalog.replicate",
          resourceType: input.scope,
          resourceId: String(input.productId ?? input.categoryId ?? sourceStoreId),
          metadata: {
            sourceStoreId,
            targetStoreId,
            scope: input.scope,
            mode: input.scope === "catalog" ? input.mode : "merge",
            categoriesCopied: result.categoriesCopied,
            productsCopied: result.productsCopied,
            productsUpdated: result.productsUpdated,
            archivedProducts: result.archivedProducts,
            warningCount: result.warnings.length,
          },
        });
      }

      return {
        sourceStoreId,
        scope: input.scope,
        mode: input.scope === "catalog" ? input.mode : "merge",
        results,
      };
    }),

  adminProductSummaries: staffProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const rows = await db
        .select({
          productId: products.id,
          modifierGroupCount: sql<number>`COUNT(DISTINCT ${productOptionGroups.id})`,
        })
        .from(products)
        .leftJoin(productOptionGroups, and(
          eq(productOptionGroups.productId, products.id),
          eq(productOptionGroups.storeId, storeId),
          eq(productOptionGroups.active, true),
        ))
        .where(eq(products.storeId, storeId))
        .groupBy(products.id);

      return rows.map((row) => ({
        productId: row.productId,
        modifierGroupCount: Number(row.modifierGroupCount ?? 0),
      }));
    }),


  adminProductAvailability: staffProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      return db
        .select({
          id: productAvailability.id,
          productId: productAvailability.productId,
          weekday: productAvailability.weekday,
          startTime: productAvailability.startTime,
          endTime: productAvailability.endTime,
          channel: productAvailability.channel,
          stockLimit: productAvailability.stockLimit,
          pausedUntil: productAvailability.pausedUntil,
          active: productAvailability.active,
        })
        .from(productAvailability)
        .where(and(
          eq(productAvailability.storeId, storeId),
          eq(productAvailability.active, true),
        ));
    }),

  adminModifierGroups: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      search: z.string().trim().max(120).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const rows = await db
        .select({
          id: productOptionGroups.id,
          productId: productOptionGroups.productId,
          productName: products.name,
          name: productOptionGroups.name,
          kind: productOptionGroups.kind,
          description: productOptionGroups.description,
          required: productOptionGroups.required,
          minSelections: productOptionGroups.minSelections,
          maxSelections: productOptionGroups.maxSelections,
          freeSelections: productOptionGroups.freeSelections,
          allowRepeatedOptions: productOptionGroups.allowRepeatedOptions,
          active: productOptionGroups.active,
          sortOrder: productOptionGroups.sortOrder,
        })
        .from(productOptionGroups)
        .innerJoin(products, and(
          eq(products.id, productOptionGroups.productId),
          eq(products.storeId, storeId),
        ))
        .where(and(
          eq(productOptionGroups.storeId, storeId),
          input.search
            ? sql`LOWER(${productOptionGroups.name}) LIKE ${`%${input.search.toLowerCase()}%`}`
            : undefined,
        ))
        .orderBy(productOptionGroups.name, products.name);

      const groupIds = rows.map((row) => row.id);
      const optionRows = groupIds.length
        ? await db
            .select({
              id: productOptions.id,
              groupId: productOptions.groupId,
              name: productOptions.name,
              description: productOptions.description,
              price: productOptions.priceDelta,
              maxQuantity: productOptions.maxQuantity,
              allowRepeat: productOptions.allowRepeat,
              active: productOptions.active,
              sortOrder: productOptions.sortOrder,
            })
            .from(productOptions)
            .where(and(
              eq(productOptions.storeId, storeId),
              inArray(productOptions.groupId, groupIds),
            ))
            .orderBy(productOptions.groupId, productOptions.sortOrder, productOptions.id)
        : [];

      const optionsByGroup = new Map<number, typeof optionRows>();
      for (const option of optionRows) {
        const current = optionsByGroup.get(option.groupId) ?? [];
        current.push(option);
        optionsByGroup.set(option.groupId, current);
      }

      const logical = new Map<string, {
        key: string;
        name: string;
        kind: string;
        description: string | null;
        required: boolean;
        minSelections: number;
        maxSelections: number;
        freeSelections: number;
        allowRepeatedOptions: boolean;
        productCount: number;
        optionCount: number;
        activeInstances: number;
        totalInstances: number;
        options: Array<{
          id: number;
          name: string;
          description: string | null;
          price: string;
          maxQuantity: number;
          allowRepeat: boolean;
          active: boolean;
          sortOrder: number;
        }>;
        products: Array<{ id: number; name: string; groupId: number; active: boolean }>;
      }>();

      for (const row of rows) {
        const groupOptions = optionsByGroup.get(row.id) ?? [];
        const optionSignature = groupOptions
          .map((option) => [
            option.name.trim().toLowerCase(),
            Number(option.price).toFixed(2),
            option.maxQuantity,
            option.allowRepeat ? "1" : "0",
            option.active ? "1" : "0",
          ].join("~"))
          .join("||");
        const key = [
          row.name.trim().toLowerCase(),
          row.kind,
          row.required ? "1" : "0",
          row.minSelections,
          row.maxSelections,
          row.freeSelections,
          row.allowRepeatedOptions ? "1" : "0",
          optionSignature,
        ].join("|");
        const current = logical.get(key) ?? {
          key,
          name: row.name,
          kind: row.kind,
          description: row.description ?? null,
          required: row.required,
          minSelections: row.minSelections,
          maxSelections: row.maxSelections,
          freeSelections: row.freeSelections,
          allowRepeatedOptions: row.allowRepeatedOptions,
          productCount: 0,
          optionCount: groupOptions.length,
          activeInstances: 0,
          totalInstances: 0,
          options: groupOptions,
          products: [],
        };
        current.productCount += 1;
        current.totalInstances += 1;
        if (row.active) current.activeInstances += 1;
        current.products.push({ id: row.productId, name: row.productName, groupId: row.id, active: row.active });
        logical.set(key, current);
      }

      return Array.from(logical.values())
        .map((group) => ({
          ...group,
          groupIds: group.products.map((product) => product.groupId),
          productIds: group.products.map((product) => product.id),
          products: group.products.slice(0, 12),
          active: group.activeInstances === group.totalInstances,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }),



  createLogicalModifierGroup: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      targetProductIds: z.array(z.number().int().positive()).min(1).max(200),
      group: modifierGroupEditorSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const targetIds = Array.from(new Set(input.targetProductIds));
      const targetProducts = await db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.id, targetIds)));
      if (targetProducts.length !== targetIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Há produtos fora da unidade selecionada." });
      }

      const createdGroupIds: number[] = [];
      await db.transaction(async (tx) => {
        for (const product of targetProducts) {
          const [duplicate] = await tx
            .select({ id: productOptionGroups.id })
            .from(productOptionGroups)
            .where(and(
              eq(productOptionGroups.storeId, storeId),
              eq(productOptionGroups.productId, product.id),
              sql`LOWER(${productOptionGroups.name}) = ${input.group.name.toLowerCase()}`,
            ))
            .limit(1);
          if (duplicate) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `O produto "${product.name}" já possui um grupo chamado "${input.group.name}".`,
            });
          }

          const [created] = await tx
            .insert(productOptionGroups)
            .values({
              storeId,
              productId: product.id,
              name: input.group.name,
              description: input.group.description || null,
              kind: input.group.maxSelections === 1 ? "single" : "multiple",
              required: input.group.required,
              minSelections: input.group.required ? Math.max(1, input.group.minSelections) : input.group.minSelections,
              maxSelections: input.group.maxSelections,
              freeSelections: input.group.freeSelections,
              allowRepeatedOptions: input.group.allowRepeatedOptions,
              active: input.group.active,
              sortOrder: 0,
            })
            .returning({ id: productOptionGroups.id });

          if (!created?.id) continue;
          createdGroupIds.push(created.id);
          await tx.insert(productOptions).values(input.group.options.map((option, optionIndex) => ({
            storeId,
            groupId: created.id,
            name: option.name,
            description: option.description || null,
            priceDelta: option.price,
            maxQuantity: option.maxQuantity,
            allowRepeat: option.maxQuantity > 1 || input.group.allowRepeatedOptions,
            sortOrder: optionIndex,
            active: option.active,
          })));
        }
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "catalog.modifier_group.create",
        resourceType: "modifier_group",
        resourceId: createdGroupIds.join(","),
        metadata: {
          name: input.group.name,
          targetProductIds: targetIds,
          optionCount: input.group.options.length,
        },
      });

      return { success: true, created: createdGroupIds.length, groupIds: createdGroupIds };
    }),

  updateLogicalModifierGroup: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      groupIds: z.array(z.number().int().positive()).min(1).max(200),
      group: modifierGroupEditorSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const groupIds = Array.from(new Set(input.groupIds));
      const currentGroups = await db
        .select({ id: productOptionGroups.id, productId: productOptionGroups.productId })
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.storeId, storeId),
          inArray(productOptionGroups.id, groupIds),
        ));

      if (currentGroups.length !== groupIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Há grupos de complementos fora da unidade selecionada." });
      }

      await db.transaction(async (tx) => {
        for (const [groupIndex, current] of currentGroups.entries()) {
          await tx
            .update(productOptionGroups)
            .set({
              name: input.group.name,
              description: input.group.description || null,
              kind: input.group.maxSelections === 1 ? "single" : "multiple",
              required: input.group.required,
              minSelections: input.group.required ? Math.max(1, input.group.minSelections) : input.group.minSelections,
              maxSelections: input.group.maxSelections,
              freeSelections: input.group.freeSelections,
              allowRepeatedOptions: input.group.allowRepeatedOptions,
              active: input.group.active,
              updatedAt: new Date(),
            })
            .where(and(
              eq(productOptionGroups.id, current.id),
              eq(productOptionGroups.storeId, storeId),
            ));

          await tx
            .delete(productOptions)
            .where(and(
              eq(productOptions.storeId, storeId),
              eq(productOptions.groupId, current.id),
            ));

          await tx.insert(productOptions).values(input.group.options.map((option, optionIndex) => ({
            storeId,
            groupId: current.id,
            name: option.name,
            description: option.description || null,
            priceDelta: option.price,
            maxQuantity: option.maxQuantity,
            allowRepeat: option.maxQuantity > 1 || input.group.allowRepeatedOptions,
            sortOrder: optionIndex,
            active: option.active,
          })));
        }
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "catalog.modifier_group.update",
        resourceType: "modifier_group",
        resourceId: groupIds.join(","),
        metadata: {
          groupIds,
          productIds: currentGroups.map((group) => group.productId),
          name: input.group.name,
          optionCount: input.group.options.length,
        },
      });

      return { success: true, updatedGroups: currentGroups.length };
    }),

  setLogicalModifierGroupActive: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      groupIds: z.array(z.number().int().positive()).min(1).max(200),
      active: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
      const groupIds = Array.from(new Set(input.groupIds));

      const existing = await db
        .select({ id: productOptionGroups.id })
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.storeId, storeId),
          inArray(productOptionGroups.id, groupIds),
        ));
      if (existing.length !== groupIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Há grupos inválidos para esta unidade." });
      }

      await db
        .update(productOptionGroups)
        .set({ active: input.active, updatedAt: new Date() })
        .where(and(
          eq(productOptionGroups.storeId, storeId),
          inArray(productOptionGroups.id, groupIds),
        ));

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: input.active ? "catalog.modifier_group.activate" : "catalog.modifier_group.pause",
        resourceType: "modifier_group",
        resourceId: groupIds.join(","),
        metadata: { groupIds, active: input.active },
      });

      return { success: true, count: groupIds.length };
    }),

  attachLogicalModifierGroup: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      sourceGroupId: z.number().int().positive(),
      targetProductIds: z.array(z.number().int().positive()).min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const [source] = await db
        .select()
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.id, input.sourceGroupId),
          eq(productOptionGroups.storeId, storeId),
        ))
        .limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Grupo de complementos não encontrado." });

      const sourceOptions = await db
        .select()
        .from(productOptions)
        .where(and(
          eq(productOptions.storeId, storeId),
          eq(productOptions.groupId, source.id),
        ))
        .orderBy(productOptions.sortOrder, productOptions.id);

      const targetIds = Array.from(new Set(input.targetProductIds));
      const targetProducts = await db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.id, targetIds)));
      if (targetProducts.length !== targetIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Há produtos fora da unidade selecionada." });
      }

      let attached = 0;
      let skipped = 0;

      await db.transaction(async (tx) => {
        for (const product of targetProducts) {
          const [alreadyExists] = await tx
            .select({ id: productOptionGroups.id })
            .from(productOptionGroups)
            .where(and(
              eq(productOptionGroups.storeId, storeId),
              eq(productOptionGroups.productId, product.id),
              sql`LOWER(${productOptionGroups.name}) = ${source.name.toLowerCase()}`,
            ))
            .limit(1);

          if (alreadyExists) {
            skipped += 1;
            continue;
          }

          const [createdGroup] = await tx
            .insert(productOptionGroups)
            .values({
              storeId,
              productId: product.id,
              name: source.name,
              kind: source.kind,
              description: source.description,
              required: source.required,
              minSelections: source.minSelections,
              maxSelections: source.maxSelections,
              freeSelections: source.freeSelections,
              allowRepeatedOptions: source.allowRepeatedOptions,
              appliesToAllSizes: source.appliesToAllSizes,
              sortOrder: source.sortOrder,
              active: source.active,
            })
            .returning({ id: productOptionGroups.id });

          if (!createdGroup?.id) continue;
          if (sourceOptions.length) {
            await tx.insert(productOptions).values(sourceOptions.map((option) => ({
              storeId,
              groupId: createdGroup.id,
              name: option.name,
              description: option.description,
              priceDelta: option.priceDelta,
              linkedProductId: option.linkedProductId,
              ingredientId: option.ingredientId,
              ingredientQuantity: option.ingredientQuantity,
              imageUrl: option.imageUrl,
              maxQuantity: option.maxQuantity,
              allowRepeat: option.allowRepeat,
              sortOrder: option.sortOrder,
              active: option.active,
            })));
          }
          attached += 1;
        }
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "catalog.modifier_group.attach",
        resourceType: "modifier_group",
        resourceId: source.id,
        metadata: { targetProductIds: targetIds, attached, skipped, name: source.name },
      });

      return { success: true, attached, skipped };
    }),

  removeModifierGroupLinks: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      groupIds: z.array(z.number().int().positive()).min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
      const groupIds = Array.from(new Set(input.groupIds));

      const existing = await db
        .select({ id: productOptionGroups.id, productId: productOptionGroups.productId, name: productOptionGroups.name })
        .from(productOptionGroups)
        .where(and(
          eq(productOptionGroups.storeId, storeId),
          inArray(productOptionGroups.id, groupIds),
        ));
      if (existing.length !== groupIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Há vínculos inválidos para esta unidade." });
      }

      await db.transaction(async (tx) => {
        await tx.delete(productOptions).where(and(
          eq(productOptions.storeId, storeId),
          inArray(productOptions.groupId, groupIds),
        ));
        await tx.delete(productOptionGroups).where(and(
          eq(productOptionGroups.storeId, storeId),
          inArray(productOptionGroups.id, groupIds),
        ));
      });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "catalog.modifier_group.detach",
        resourceType: "modifier_group",
        resourceId: groupIds.join(","),
        metadata: {
          groupIds,
          productIds: existing.map((group) => group.productId),
          names: Array.from(new Set(existing.map((group) => group.name))),
        },
      });

      return { success: true, removed: groupIds.length };
    }),

  adminPreview: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      productId: z.number().int().positive(),
      selection: selectionSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const product = await getConfiguredCatalogProduct({ storeId, productId: input.productId, includeInactive: true });
      const pricing = calculateConfiguredProductPrice(product, input.selection);
      return {
        pricing,
        snapshot: createOrderItemConfigurationSnapshot(product, input.selection, pricing),
      };
    }),

  saveProduct: staffProcedure
    .input(editorProductSchema)
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponivel" });

      return db.transaction(async (tx) => {
        const [category] = await tx.select({ id: categories.id }).from(categories)
          .where(and(eq(categories.id, input.categoryId), eq(categories.storeId, storeId), eq(categories.active, true))).limit(1);
        if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma categoria ativa desta loja" });

        let productId = input.productId;
        if (productId) {
          const [existing] = await tx.select({ id: products.id }).from(products)
            .where(and(eq(products.id, productId), eq(products.storeId, storeId))).limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Produto nao encontrado nesta loja" });
        }

        const productData = {
          storeId,
          categoryId: input.categoryId,
          name: input.name,
          shortDescription: input.shortDescription || null,
          description: input.description || null,
          price: input.price,
          imageUrl: input.imageUrl || null,
          sku: input.sku || null,
          productType: input.productType,
          pricingEngine: input.productType === "simple" ? "legacy_v1" as const : "configured_v2" as const,
          editorialStatus: input.editorialStatus,
          preparationTime: input.preparationTime ?? null,
          minQuantity: input.minQuantity,
          maxQuantity: input.maxQuantity,
          couponEligible: input.couponEligible,
          pointsEligible: input.pointsEligible,
          featured: input.featured,
          active: input.editorialStatus === "published",
          publishedAt: input.editorialStatus === "published" ? new Date() : null,
        };

        if (productId) {
          await tx.update(products).set({ ...productData, version: sql`${products.version} + 1` }).where(and(eq(products.id, productId), eq(products.storeId, storeId)));
        } else {
          const inserted = await tx.insert(products).values(productData).returning({ id: products.id });
          productId = inserted[0]?.id;
        }
        if (!productId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Nao foi possivel identificar o produto salvo" });

        const previousGroups = await tx.select({ id: productOptionGroups.id }).from(productOptionGroups)
          .where(and(eq(productOptionGroups.storeId, storeId), eq(productOptionGroups.productId, productId)));
        const previousGroupIds = previousGroups.map((group) => group.id);
        if (previousGroupIds.length) {
          const previousOptions = await tx.select({ id: productOptions.id }).from(productOptions)
            .where(and(eq(productOptions.storeId, storeId), inArray(productOptions.groupId, previousGroupIds)));
          const previousOptionIds = previousOptions.map((option) => option.id);
          if (previousOptionIds.length) await tx.delete(modifierSizeRules).where(and(eq(modifierSizeRules.storeId, storeId), inArray(modifierSizeRules.modifierOptionId, previousOptionIds)));
          await tx.delete(productOptions).where(and(eq(productOptions.storeId, storeId), inArray(productOptions.groupId, previousGroupIds)));
          await tx.delete(productOptionGroups).where(and(eq(productOptionGroups.storeId, storeId), eq(productOptionGroups.productId, productId)));
        }

        const previousFlavors = await tx.select({ id: productFlavors.id }).from(productFlavors)
          .where(and(eq(productFlavors.storeId, storeId), eq(productFlavors.productId, productId)));
        const previousFlavorIds = previousFlavors.map((flavor) => flavor.id);
        if (previousFlavorIds.length) await tx.delete(flavorSizePrices).where(and(eq(flavorSizePrices.storeId, storeId), inArray(flavorSizePrices.flavorId, previousFlavorIds)));
        await tx.delete(productFlavors).where(and(eq(productFlavors.storeId, storeId), eq(productFlavors.productId, productId)));
        await tx.delete(multiFlavorSettings).where(and(eq(multiFlavorSettings.storeId, storeId), eq(multiFlavorSettings.productId, productId)));
        await tx.delete(productSizes).where(and(eq(productSizes.storeId, storeId), eq(productSizes.productId, productId)));

        const sizeIds: number[] = [];
        for (const [index, size] of input.sizes.entries()) {
          const inserted = await tx.insert(productSizes).values({
            storeId, productId, name: size.name, price: size.price,
            promotionalPrice: size.promotionalPrice || null, serves: size.serves ?? null,
            minFlavors: size.minFlavors ?? null, maxFlavors: size.maxFlavors ?? null,
            sortOrder: index, active: true,
          }).returning({ id: productSizes.id });
          if (inserted[0]?.id) sizeIds.push(inserted[0].id);
        }

        for (const [groupIndex, group] of input.modifierGroups.entries()) {
          const insertedGroup = await tx.insert(productOptionGroups).values({
            storeId, productId, name: group.name, kind: group.maxSelections === 1 ? "single" : "multiple",
            required: group.required, minSelections: group.required ? Math.max(1, group.minSelections) : group.minSelections,
            maxSelections: group.maxSelections, freeSelections: group.freeSelections, sortOrder: groupIndex, active: true,
          }).returning({ id: productOptionGroups.id });
          const groupId = insertedGroup[0]?.id;
          if (!groupId) continue;
          await tx.insert(productOptions).values(group.options.map((option, optionIndex) => ({
            storeId, groupId, name: option.name, priceDelta: option.price,
            maxQuantity: option.maxQuantity, allowRepeat: option.maxQuantity > 1, sortOrder: optionIndex, active: true,
          })));
        }

        if (input.productType === "multi_flavor" && input.flavorSettings) {
          await tx.insert(multiFlavorSettings).values({ storeId, productId, ...input.flavorSettings, visualDivisions: true });
          for (const [flavorIndex, flavor] of input.flavors.entries()) {
            const insertedFlavor = await tx.insert(productFlavors).values({ storeId, productId, name: flavor.name, sortOrder: flavorIndex, active: true }).returning({ id: productFlavors.id });
            const flavorId = insertedFlavor[0]?.id;
            if (!flavorId) continue;
            const prices = flavor.prices.map((price, sizeIndex) => sizeIds[sizeIndex] ? ({
              storeId, flavorId, productSizeId: sizeIds[sizeIndex], price, active: true,
            }) : null).filter((value): value is NonNullable<typeof value> => Boolean(value));
            if (prices.length) await tx.insert(flavorSizePrices).values(prices);
          }
        }

        return { id: productId, status: input.editorialStatus };
      });
    }),
});
