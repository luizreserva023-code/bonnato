import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import { calculateConfiguredProductPrice, createOrderItemConfigurationSnapshot } from "../domains/catalog/pricing.ts";
import { getConfiguredCatalogProduct } from "../domains/catalog/repository.ts";
import { resolveRequiredStoreId } from "../storeUtils.ts";
import { getDb } from "../db.ts";
import {
  flavorSizePrices,
  categories,
  modifierSizeRules,
  multiFlavorSettings,
  productFlavors,
  productOptionGroups,
  productOptions,
  productSizes,
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
  modifierGroups: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    required: z.boolean().default(false),
    minSelections: z.number().int().min(0).max(50).default(0),
    maxSelections: z.number().int().min(1).max(50).default(1),
    freeSelections: z.number().int().min(0).max(50).default(0),
    options: z.array(z.object({
      name: z.string().trim().min(1).max(160),
      price: moneySchema,
      maxQuantity: z.number().int().min(1).max(99).default(1),
    })).min(1).max(100),
  })).max(30).default([]),
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
          const inserted = await tx.insert(products).values(productData).$returningId();
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
          }).$returningId();
          if (inserted[0]?.id) sizeIds.push(inserted[0].id);
        }

        for (const [groupIndex, group] of input.modifierGroups.entries()) {
          const insertedGroup = await tx.insert(productOptionGroups).values({
            storeId, productId, name: group.name, kind: group.maxSelections === 1 ? "single" : "multiple",
            required: group.required, minSelections: group.required ? Math.max(1, group.minSelections) : group.minSelections,
            maxSelections: group.maxSelections, freeSelections: group.freeSelections, sortOrder: groupIndex, active: true,
          }).$returningId();
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
            const insertedFlavor = await tx.insert(productFlavors).values({ storeId, productId, name: flavor.name, sortOrder: flavorIndex, active: true }).$returningId();
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
