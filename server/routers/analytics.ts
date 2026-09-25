import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import { getTodayStartUtc, getNDaysAgoStartUtc } from "../../shared/timezone.ts";
import { resolveRequiredStoreId, resolveStoreId } from "../storeUtils.ts";
import {
  getAnalyticsDataStart,
  getCustomerOverview,
  getMarketingOverview,
  getMenuFunnel,
  getOperationsOverview,
  getProductPerformance,
  getProductTimeSeries,
  getSalesDistribution,
  getSalesOverview,
  getSalesTimeSeries,
  recordAnalyticsEvent,
} from "../services/analytics.ts";
import { getMenuRecommendations } from "../services/menuRecommendations.ts";
import { menuRecommendationDismissals, storeAuditLogs, users } from "../../drizzle/schema.ts";
import { getDb } from "../db.ts";
import { recordStoreAudit } from "../storeAudit.ts";

const eventTypeSchema = z.enum([
  "STORE_VIEW", "MENU_VIEW", "CATEGORY_VIEW", "PRODUCT_VIEW",
  "ADD_TO_CART", "REMOVE_FROM_CART", "CART_VIEW",
  "CHECKOUT_STARTED", "CHECKOUT_STEP_COMPLETED",
  "ORDER_CREATED", "ORDER_PAID", "ORDER_CONFIRMED", "ORDER_PREPARING",
  "ORDER_READY", "ORDER_DISPATCHED", "ORDER_COMPLETED", "ORDER_CANCELLED",
]);

const publicTrackSchema = z.object({
  eventId: z.string().trim().min(8).max(96),
  eventType: eventTypeSchema,
  occurredAt: z.coerce.date().optional(),
  storeId: z.number().int().positive(),
  sessionId: z.string().trim().min(8).max(96),
  visitorId: z.string().trim().min(8).max(96).optional(),
  productId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  orderId: z.number().int().positive().optional(),
  source: z.string().trim().max(80).optional(),
  utmSource: z.string().trim().max(160).optional(),
  utmMedium: z.string().trim().max(160).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
  deviceType: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

const periodSchema = z.object({
  storeId: z.number().int().positive().optional(),
  period: z.enum(["today", "7d", "30d", "90d", "custom"]).default("7d"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

function resolvePeriod(input: z.infer<typeof periodSchema>) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (input.period === "custom") {
    if (!input.startDate || !input.endDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Informe data inicial e final." });
    }
    startDate = input.startDate;
    endDate = input.endDate;
  } else if (input.period === "today") {
    startDate = getTodayStartUtc(now);
    endDate = now;
  } else {
    const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
    startDate = getNDaysAgoStartUtc(days - 1, now);
    endDate = now;
  }

  if (!(startDate < endDate)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Período inválido." });
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  const previousEndDate = new Date(startDate.getTime());
  const previousStartDate = new Date(previousEndDate.getTime() - durationMs);

  return { startDate, endDate, previousStartDate, previousEndDate };
}

export const analyticsRouter = router({
  track: publicProcedure
    .input(publicTrackSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await recordAnalyticsEvent({
          ...input,
          customerId: ctx.user?.id ?? null,
        });
      } catch (error) {
        // Analytics é best-effort: nunca impedir navegação/compra.
        console.error("[analytics.track] best-effort tracking failed:", error);
        return { recorded: false };
      }
    }),

  overview: staffProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const period = resolvePeriod(input);

      const currentInput = { storeId, startDate: period.startDate, endDate: period.endDate };
      const previousInput = {
        storeId,
        startDate: period.previousStartDate,
        endDate: period.previousEndDate,
      };

      const [
        sales,
        previousSales,
        customers,
        previousCustomers,
        funnel,
        previousFunnel,
        marketing,
        dataAvailableFrom,
      ] = await Promise.all([
        getSalesOverview(currentInput),
        getSalesOverview(previousInput),
        getCustomerOverview(currentInput),
        getCustomerOverview(previousInput),
        getMenuFunnel(currentInput),
        getMenuFunnel(previousInput),
        getMarketingOverview(currentInput),
        getAnalyticsDataStart(storeId),
      ]);

      return {
        scope: { storeId: storeId ?? null, ...period, dataAvailableFrom },
        sales,
        previousSales,
        customers,
        previousCustomers,
        funnel,
        previousFunnel,
        marketing,
      };
    }),



  performance: staffProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const period = resolvePeriod(input);
      const current = { storeId, startDate: period.startDate, endDate: period.endDate };
      const previous = { storeId, startDate: period.previousStartDate, endDate: period.previousEndDate };

      const [
        sales,
        previousSales,
        series,
        previousSeries,
        distribution,
        operations,
        previousOperations,
        customers,
        previousCustomers,
        marketing,
        funnel,
        previousFunnel,
        dataAvailableFrom,
      ] = await Promise.all([
        getSalesOverview(current),
        getSalesOverview(previous),
        getSalesTimeSeries(current),
        getSalesTimeSeries(previous),
        getSalesDistribution(current),
        getOperationsOverview(current),
        getOperationsOverview(previous),
        getCustomerOverview(current),
        getCustomerOverview(previous),
        getMarketingOverview(current),
        getMenuFunnel(current),
        getMenuFunnel(previous),
        getAnalyticsDataStart(storeId),
      ]);

      return {
        scope: {
          storeId: storeId ?? null,
          ...period,
          dataAvailableFrom,
          timezone: "America/Sao_Paulo" as const,
        },
        sales,
        previousSales,
        series,
        previousSeries,
        distribution,
        operations,
        previousOperations,
        customers,
        previousCustomers,
        marketing,
        funnel,
        previousFunnel,
      };
    }),

  recommendations: staffProcedure
    .input(periodSchema.extend({
      storeId: z.number().int().positive(),
      limit: z.number().int().min(1).max(50).default(12),
    }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const period = resolvePeriod(input);
      const recommendations = await getMenuRecommendations({
        storeId,
        startDate: period.startDate,
        endDate: period.endDate,
        limit: input.limit,
      });
      return {
        scope: { storeId, ...period },
        recommendations,
      };
    }),

  dismissRecommendation: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      recommendationKey: z.string().trim().min(4).max(220),
      ruleType: z.enum([
        "MISSING_IMAGE",
        "MISSING_DESCRIPTION",
        "PAUSED_BEST_SELLER",
        "HIGH_VIEWS_LOW_CONVERSION",
        "HIGH_CONVERSION_LOW_EXPOSURE",
        "LOW_PERFORMANCE",
        "HIGH_CART_ABANDONMENT",
        "PRODUCT_WITHOUT_COMPLEMENTS",
      ]),
      productId: z.number().int().positive().optional(),
      categoryId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      await db
        .insert(menuRecommendationDismissals)
        .values({
          storeId,
          recommendationKey: input.recommendationKey,
          ruleType: input.ruleType,
          productId: input.productId ?? null,
          categoryId: input.categoryId ?? null,
          dismissedByUserId: ctx.user.id,
        })
        .onConflictDoNothing({
          target: [menuRecommendationDismissals.storeId, menuRecommendationDismissals.recommendationKey],
        });

      await recordStoreAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "menu.recommendation.dismiss",
        resourceType: "menu_recommendation",
        resourceId: input.recommendationKey,
        metadata: {
          ruleType: input.ruleType,
          productId: input.productId ?? null,
          categoryId: input.categoryId ?? null,
        },
      });

      return { success: true };
    }),

  productDetail: staffProcedure
    .input(periodSchema.extend({
      storeId: z.number().int().positive(),
      productId: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const period = resolvePeriod(input);

      const productRows = await getProductPerformance({
        storeId,
        productId: input.productId,
        startDate: period.startDate,
        endDate: period.endDate,
        limit: 1,
      });
      const product = productRows[0];
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado nesta unidade." });
      }

      const [series, categoryRows] = await Promise.all([
        getProductTimeSeries({
          storeId,
          productId: input.productId,
          startDate: period.startDate,
          endDate: period.endDate,
        }),
        getProductPerformance({
          storeId,
          categoryId: product.categoryId,
          startDate: period.startDate,
          endDate: period.endDate,
          limit: 500,
        }),
      ]);

      const ranking = [...categoryRows]
        .sort((a, b) => b.soldQuantity - a.soldQuantity || b.revenue - a.revenue || b.buyerSessions - a.buyerSessions);
      const rankIndex = ranking.findIndex((row) => row.id === input.productId);

      return {
        scope: { storeId, ...period },
        product,
        series,
        categoryRank: {
          position: rankIndex >= 0 ? rankIndex + 1 : null,
          total: ranking.length,
        },
      };
    }),

  menu: staffProcedure
    .input(periodSchema.extend({
      search: z.string().trim().max(160).optional(),
      categoryId: z.number().int().positive().optional(),
      status: z.enum(["all", "active", "paused"]).default("all"),
      limit: z.number().int().min(1).max(500).default(200),
    }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const period = resolvePeriod(input);

      const [products, funnel, dataAvailableFrom] = await Promise.all([
        getProductPerformance({
          storeId,
          startDate: period.startDate,
          endDate: period.endDate,
          search: input.search,
          categoryId: input.categoryId,
          status: input.status,
          limit: input.limit,
        }),
        getMenuFunnel({ storeId, startDate: period.startDate, endDate: period.endDate }),
        getAnalyticsDataStart(storeId),
      ]);

      return {
        scope: { storeId: storeId ?? null, ...period, dataAvailableFrom },
        funnel,
        products,
      };
    }),

  auditLog: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(10).max(100).default(25),
      search: z.string().trim().max(120).optional(),
      action: z.string().trim().max(120).optional(),
      resourceType: z.string().trim().max(80).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const conditions = [];
      if (storeId) conditions.push(eq(storeAuditLogs.storeId, storeId));
      if (input.action) conditions.push(ilike(storeAuditLogs.action, `%${input.action}%`));
      if (input.resourceType) conditions.push(ilike(storeAuditLogs.resourceType, `%${input.resourceType}%`));
      if (input.search) {
        const q = `%${input.search}%`;
        conditions.push(or(
          ilike(storeAuditLogs.action, q),
          ilike(storeAuditLogs.resourceType, q),
          ilike(storeAuditLogs.resourceId, q),
          ilike(users.name, q),
          ilike(users.email, q),
        )!);
      }
      const where = conditions.length ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;

      const [rows, totalRows] = await Promise.all([
        db.select({
          id: storeAuditLogs.id,
          storeId: storeAuditLogs.storeId,
          actorUserId: storeAuditLogs.actorUserId,
          actorName: users.name,
          actorEmail: users.email,
          action: storeAuditLogs.action,
          resourceType: storeAuditLogs.resourceType,
          resourceId: storeAuditLogs.resourceId,
          requestId: storeAuditLogs.requestId,
          ipAddress: storeAuditLogs.ipAddress,
          metadata: storeAuditLogs.metadata,
          createdAt: storeAuditLogs.createdAt,
        })
          .from(storeAuditLogs)
          .leftJoin(users, eq(users.id, storeAuditLogs.actorUserId))
          .where(where)
          .orderBy(desc(storeAuditLogs.createdAt), desc(storeAuditLogs.id))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(storeAuditLogs)
          .leftJoin(users, eq(users.id, storeAuditLogs.actorUserId))
          .where(where),
      ]);

      const total = totalRows[0]?.count ?? 0;
      return {
        rows,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        },
      };
    }),
});
