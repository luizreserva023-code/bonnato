import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  comboGroupItems,
  comboGroups,
  eventOutbox,
  growthSettings,
  ingredients,
  integrationConnections,
  intelligenceSuggestions,
  kitchenTickets,
  npsResponses,
  orderItems,
  orders,
  productCombos,
  productOptionGroups,
  productOptions,
  products,
  referrals,
  rewardCatalog,
  stores,
} from "../../drizzle/schema.ts";
import { getDb, updateOrderStatusGuarded } from "../db.ts";
import { applyOrderStatusLifecycle } from "../orderLifecycle.ts";
import { resolveRequiredStoreId } from "../storeUtils.ts";
import { protectedProcedure, publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import { reliabilityRouter } from "./reliability.ts";

const storeInput = z.object({ storeId: z.number().int().positive() });
const groupKind = z.enum(["single", "multiple", "flavor", "size", "edge"]);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

async function scopedStoreId(user: { id: number; role: string }, storeId: number) {
  return resolveRequiredStoreId(user, storeId);
}

function parseObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export const operationsRouter = router({
  commerce: router({
    configuration: publicProcedure
      .input(z.object({ storeId: z.number().int().positive(), productId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [product] = await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId), eq(products.active, true))).limit(1);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado nesta loja." });

        const groups = await db.select().from(productOptionGroups)
          .where(and(eq(productOptionGroups.storeId, input.storeId), eq(productOptionGroups.productId, input.productId), eq(productOptionGroups.active, true)))
          .orderBy(asc(productOptionGroups.sortOrder), asc(productOptionGroups.id));
        const options = groups.length
          ? await db.select().from(productOptions)
              .where(and(eq(productOptions.storeId, input.storeId), inArray(productOptions.groupId, groups.map((group) => group.id)), eq(productOptions.active, true)))
              .orderBy(asc(productOptions.sortOrder), asc(productOptions.id))
          : [];
        const [combo] = await db.select().from(productCombos)
          .where(and(eq(productCombos.storeId, input.storeId), eq(productCombos.productId, input.productId), eq(productCombos.active, true))).limit(1);
        const comboGroupRows = combo
          ? await db.select().from(comboGroups).where(and(eq(comboGroups.storeId, input.storeId), eq(comboGroups.comboId, combo.id))).orderBy(asc(comboGroups.sortOrder))
          : [];
        const comboItems = comboGroupRows.length
          ? await db.select({ item: comboGroupItems, product: products }).from(comboGroupItems)
              .innerJoin(products, eq(products.id, comboGroupItems.productId))
              .where(and(eq(comboGroupItems.storeId, input.storeId), inArray(comboGroupItems.groupId, comboGroupRows.map((group) => group.id)), eq(comboGroupItems.active, true)))
          : [];
        return {
          product,
          groups: groups.map((group) => ({ ...group, options: options.filter((option) => option.groupId === group.id) })),
          combo: combo ? { ...combo, groups: comboGroupRows.map((group) => ({ ...group, items: comboItems.filter((row) => row.item.groupId === group.id) })) } : null,
        };
      }),

    adminConfiguration: staffProcedure
      .input(z.object({ storeId: z.number().int().positive(), productId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await scopedStoreId(ctx.user, input.storeId);
        const db = await requireDb();
        const groups = await db.select().from(productOptionGroups).where(and(eq(productOptionGroups.storeId, input.storeId), eq(productOptionGroups.productId, input.productId))).orderBy(asc(productOptionGroups.sortOrder));
        const options = groups.length ? await db.select().from(productOptions).where(and(eq(productOptions.storeId, input.storeId), inArray(productOptions.groupId, groups.map((group) => group.id)))).orderBy(asc(productOptions.sortOrder)) : [];
        return groups.map((group) => ({ ...group, options: options.filter((option) => option.groupId === group.id) }));
      }),

    saveGroup: staffProcedure
      .input(z.object({
        id: z.number().int().positive().optional(), storeId: z.number().int().positive(), productId: z.number().int().positive(), name: z.string().min(1).max(120),
        kind: groupKind.default("multiple"), required: z.boolean().default(false), minSelections: z.number().int().min(0).default(0), maxSelections: z.number().int().min(1).max(20).default(1),
        sortOrder: z.number().int().default(0), active: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        await scopedStoreId(ctx.user, input.storeId);
        if (input.minSelections > input.maxSelections) throw new TRPCError({ code: "BAD_REQUEST", message: "O mínimo não pode superar o máximo." });
        const db = await requireDb();
        const data = { storeId: input.storeId, productId: input.productId, name: input.name, kind: input.kind, required: input.required, minSelections: input.minSelections, maxSelections: input.maxSelections, sortOrder: input.sortOrder, active: input.active };
        if (input.id) {
          await db.update(productOptionGroups).set(data).where(and(eq(productOptionGroups.id, input.id), eq(productOptionGroups.storeId, input.storeId)));
          return { id: input.id };
        }
        const [created] = await db.insert(productOptionGroups).values(data).returning({ id: productOptionGroups.id });
        return { id: created.id };
      }),

    saveOption: staffProcedure
      .input(z.object({
        id: z.number().int().positive().optional(), storeId: z.number().int().positive(), groupId: z.number().int().positive(), name: z.string().min(1).max(160), description: z.string().max(500).optional(),
        priceDelta: z.number().min(0).default(0), linkedProductId: z.number().int().positive().optional(), ingredientId: z.number().int().positive().optional(), ingredientQuantity: z.number().positive().optional(),
        imageUrl: z.string().max(2000).optional(), sortOrder: z.number().int().default(0), active: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        await scopedStoreId(ctx.user, input.storeId);
        const db = await requireDb();
        const [group] = await db.select().from(productOptionGroups).where(and(eq(productOptionGroups.id, input.groupId), eq(productOptionGroups.storeId, input.storeId))).limit(1);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Grupo de opções não encontrado." });
        const data = { storeId: input.storeId, groupId: input.groupId, name: input.name, description: input.description ?? null, priceDelta: input.priceDelta.toFixed(2), linkedProductId: input.linkedProductId ?? null, ingredientId: input.ingredientId ?? null, ingredientQuantity: input.ingredientQuantity?.toFixed(3) ?? null, imageUrl: input.imageUrl ?? null, sortOrder: input.sortOrder, active: input.active };
        if (input.id) {
          await db.update(productOptions).set(data).where(and(eq(productOptions.id, input.id), eq(productOptions.storeId, input.storeId)));
          return { id: input.id };
        }
        const [created] = await db.insert(productOptions).values(data).returning({ id: productOptions.id });
        return { id: created.id };
      }),
  }),

  operations: router({
    board: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const activeOrders = await db.select().from(orders).where(and(eq(orders.storeId, input.storeId), inArray(orders.status, ["pending", "confirmed", "preparing"]))).orderBy(asc(orders.createdAt)).limit(500);
      if (activeOrders.length) {
        await db.insert(kitchenTickets)
          .values(activeOrders.map((order) => ({ storeId: input.storeId, orderId: order.id, status: order.status === "preparing" ? "preparing" as const : "queued" as const, startedAt: order.preparingAt, promisedAt: order.predictedReadyAt })))
          .onConflictDoUpdate({ target: [kitchenTickets.storeId, kitchenTickets.orderId], set: { updatedAt: new Date() } });
      }
      const tickets = await db.select().from(kitchenTickets).where(and(eq(kitchenTickets.storeId, input.storeId), inArray(kitchenTickets.status, ["queued", "preparing", "ready"]))).orderBy(asc(kitchenTickets.createdAt));
      const orderIds = tickets.map((ticket) => ticket.orderId);
      const ticketOrders = orderIds.length ? await db.select().from(orders).where(inArray(orders.id, orderIds)) : [];
      const items = orderIds.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)) : [];
      const now = Date.now();
      return tickets.map((ticket) => {
        const order = ticketOrders.find((row) => row.id === ticket.orderId);
        const elapsedMinutes = Math.max(0, Math.floor((now - new Date(ticket.createdAt).getTime()) / 60000));
        const promised = ticket.promisedAt ? new Date(ticket.promisedAt).getTime() : new Date(ticket.createdAt).getTime() + 40 * 60000;
        return { ...ticket, order, items: items.filter((item) => item.orderId === ticket.orderId), elapsedMinutes, delayed: now > promised, slaRemainingMinutes: Math.ceil((promised - now) / 60000) };
      });
    }),

    transitionTicket: staffProcedure
      .input(z.object({ storeId: z.number().int().positive(), ticketId: z.number().int().positive(), status: z.enum(["queued", "preparing", "ready", "completed", "cancelled"]), priority: z.enum(["normal", "high", "urgent"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        await scopedStoreId(ctx.user, input.storeId);
        const db = await requireDb();
        const [ticket] = await db.select().from(kitchenTickets).where(and(eq(kitchenTickets.id, input.ticketId), eq(kitchenTickets.storeId, input.storeId))).limit(1);
        if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket de cozinha não encontrado." });
        const now = new Date();

        if (input.status === "preparing") {
          const transition = await updateOrderStatusGuarded(
            ticket.orderId,
            "preparing",
            ["pending", "confirmed"],
            {
              actorUserId: ctx.user.id,
              source: ctx.user.role === "manager" ? "manager" : "admin",
              notes: "Cozinha iniciou o preparo",
            },
          );
          if (!transition.ok) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "O pedido não pode entrar em preparo a partir do status atual." });
          }
          if (transition.previous) {
            await applyOrderStatusLifecycle(ticket.orderId, transition.previous, "preparing", {
              actorUserId: ctx.user.id,
              source: ctx.user.role === "manager" ? "manager" : "admin",
              notes: "Cozinha iniciou o preparo",
              skipStageLog: true,
              skipStatusTimestamp: true,
            });
          }
        }

        if (input.status === "ready") {
          await db.transaction(async (tx) => {
            const [readyOrder] = await tx
              .update(orders)
              .set({ readyAt: now, updatedAt: now })
              .where(and(
                eq(orders.id, ticket.orderId),
                eq(orders.storeId, input.storeId),
                eq(orders.status, "preparing"),
              ))
              .returning({ id: orders.id, orderNumber: orders.orderNumber });

            if (!readyOrder) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Somente pedidos em preparo podem ser marcados como prontos." });
            }

            await tx
              .insert(eventOutbox)
              .values({
                eventKey: `order.ready:${ticket.orderId}`,
                eventType: "order.ready",
                aggregateType: "order",
                aggregateId: String(ticket.orderId),
                storeId: input.storeId,
                payload: JSON.stringify({
                  orderId: ticket.orderId,
                  orderNumber: readyOrder.orderNumber,
                  readyAt: now.toISOString(),
                }),
                status: "pending",
                availableAt: now,
              })
              .onConflictDoNothing({ target: eventOutbox.eventKey });
          });
        }

        if (input.status === "cancelled") {
          const transition = await updateOrderStatusGuarded(
            ticket.orderId,
            "cancelled",
            ["pending", "confirmed", "preparing"],
            {
              actorUserId: ctx.user.id,
              source: ctx.user.role === "manager" ? "manager" : "admin",
              notes: "Cancelado pela operação da cozinha",
              cancellationReasonCode: "operational",
              cancellationReason: "Cancelado pela operação da cozinha",
            },
          );
          if (!transition.ok) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "O pedido não pode ser cancelado a partir do status atual." });
          }
          if (transition.previous) {
            await applyOrderStatusLifecycle(ticket.orderId, transition.previous, "cancelled", {
              actorUserId: ctx.user.id,
              source: ctx.user.role === "manager" ? "manager" : "admin",
              notes: "Cancelado pela operação da cozinha",
              skipStageLog: true,
              skipStatusTimestamp: true,
            });
          }
        }

        await db
          .update(kitchenTickets)
          .set({
            status: input.status,
            priority: input.priority ?? ticket.priority,
            startedAt: input.status === "preparing" ? ticket.startedAt ?? now : ticket.startedAt,
            readyAt: input.status === "ready" ? now : ticket.readyAt,
            completedAt: input.status === "completed" ? now : ticket.completedAt,
            updatedAt: now,
          })
          .where(eq(kitchenTickets.id, ticket.id));

        return { ok: true };
      }),

    stockRisk: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const rows = await db.select().from(ingredients).where(eq(ingredients.storeId, input.storeId)).orderBy(asc(ingredients.currentStock));
      return rows.map((ingredient) => {
        const current = Number(ingredient.currentStock);
        const minimum = Number(ingredient.minimumStock);
        return { ...ingredient, currentStockNumber: current, minStockNumber: minimum, critical: current <= minimum, suggestedPurchase: Math.max(0, minimum * 2 - current) };
      });
    }),
  }),

  growth: router({
    settings: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [settings] = await db.select().from(growthSettings).where(eq(growthSettings.storeId, input.storeId)).limit(1);
      return settings ?? { storeId: input.storeId, cashbackPercent: "0", pointsPerReal: "1", referralReferrerPoints: 100, referralReferredPoints: 50, npsEnabled: true, config: null };
    }),
    saveSettings: staffProcedure.input(z.object({ storeId: z.number().int().positive(), cashbackPercent: z.number().min(0).max(30), pointsPerReal: z.number().min(0).max(100), referralReferrerPoints: z.number().int().min(0), referralReferredPoints: z.number().int().min(0), npsEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      await db.insert(growthSettings)
        .values({ storeId: input.storeId, cashbackPercent: input.cashbackPercent.toFixed(2), pointsPerReal: input.pointsPerReal.toFixed(3), referralReferrerPoints: input.referralReferrerPoints, referralReferredPoints: input.referralReferredPoints, npsEnabled: input.npsEnabled })
        .onConflictDoUpdate({ target: growthSettings.storeId, set: { cashbackPercent: input.cashbackPercent.toFixed(2), pointsPerReal: input.pointsPerReal.toFixed(3), referralReferrerPoints: input.referralReferrerPoints, referralReferredPoints: input.referralReferredPoints, npsEnabled: input.npsEnabled, updatedAt: new Date() } });
      return { ok: true };
    }),
    rewards: publicProcedure.input(storeInput).query(async ({ input }) => (await requireDb()).select().from(rewardCatalog).where(and(eq(rewardCatalog.storeId, input.storeId), eq(rewardCatalog.active, true))).orderBy(asc(rewardCatalog.pointsCost))),
    createReward: staffProcedure.input(z.object({ storeId: z.number().int().positive(), name: z.string().min(1).max(160), description: z.string().optional(), rewardType: z.enum(["discount", "product", "free_delivery", "cashback"]), pointsCost: z.number().int().min(0), value: z.number().min(0), productId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [created] = await db.insert(rewardCatalog).values({ ...input, description: input.description ?? null, productId: input.productId ?? null, value: input.value.toFixed(2) }).returning({ id: rewardCatalog.id });
      return { id: created.id };
    }),
    updateReward: staffProcedure.input(z.object({
      storeId: z.number().int().positive(),
      id: z.number().int().positive(),
      active: z.boolean().optional(),
      name: z.string().min(1).max(160).optional(),
      description: z.string().max(500).nullable().optional(),
      pointsCost: z.number().int().min(0).optional(),
      value: z.number().min(0).optional(),
    })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const { id, storeId, value, ...changes } = input;
      await (await requireDb()).update(rewardCatalog).set({
        ...changes,
        ...(value !== undefined ? { value: value.toFixed(2) } : {}),
      }).where(and(eq(rewardCatalog.id, id), eq(rewardCatalog.storeId, storeId)));
      return { ok: true };
    }),
    submitNps: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), orderId: z.number().int().positive(), score: z.number().int().min(0).max(10), comment: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [order] = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.storeId, input.storeId), eq(orders.userId, ctx.user.id), eq(orders.status, "delivered"))).limit(1);
      if (!order) throw new TRPCError({ code: "FORBIDDEN", message: "Pedido entregue não encontrado para esta conta." });
      await db.insert(npsResponses)
        .values({ ...input, userId: ctx.user.id, comment: input.comment ?? null })
        .onConflictDoUpdate({ target: [npsResponses.storeId, npsResponses.orderId], set: { score: input.score, comment: input.comment ?? null } });
      return { ok: true };
    }),
    myReferral: protectedProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [existing] = await db.select().from(referrals).where(and(eq(referrals.storeId, input.storeId), eq(referrals.referrerUserId, ctx.user.id), eq(referrals.status, "pending"))).limit(1);
      if (existing) return existing;
      const code = `IND${ctx.user.id}${nanoid(6)}`.toUpperCase();
      const [created] = await db.insert(referrals).values({ storeId: input.storeId, referrerUserId: ctx.user.id, code }).returning({ id: referrals.id });
      return { id: created.id, storeId: input.storeId, referrerUserId: ctx.user.id, code, status: "pending" as const };
    }),
  }),

  integrations: router({
    health: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const connections = await (await requireDb()).select().from(integrationConnections).where(eq(integrationConnections.storeId, input.storeId)).orderBy(asc(integrationConnections.provider));
      return { connections, healthy: connections.filter((item) => item.status === "connected").length, degraded: connections.filter((item) => item.status === "degraded" || item.status === "error").length, disconnected: connections.filter((item) => item.status === "disconnected").length };
    }),
    saveConnection: staffProcedure.input(z.object({ storeId: z.number().int().positive(), provider: z.string().min(2).max(64), status: z.enum(["disconnected", "connecting", "connected", "degraded", "error"]), config: z.record(z.string(), z.unknown()).optional(), credentialsRef: z.string().max(191).optional() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const now = new Date();
      const data = { storeId: input.storeId, provider: input.provider, status: input.status, config: input.config ? JSON.stringify(input.config) : null, credentialsRef: input.credentialsRef ?? null, lastSuccessAt: input.status === "connected" ? now : null, lastFailureAt: input.status === "error" ? now : null };
      await db.insert(integrationConnections)
        .values(data)
        .onConflictDoUpdate({ target: [integrationConnections.storeId, integrationConnections.provider], set: { status: data.status, config: data.config, credentialsRef: data.credentialsRef, lastSuccessAt: data.lastSuccessAt, lastFailureAt: data.lastFailureAt, updatedAt: now } });
      return { ok: true };
    }),
  }),

  reliability: reliabilityRouter,

  intelligence: router({
    dashboard: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const demandResult = await db.execute(sql`SELECT EXTRACT(ISODOW FROM "createdAt")::int AS weekday, EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::int AS orders, ROUND(COALESCE(SUM("total"), 0)::numeric, 2) AS revenue FROM "orders" WHERE "storeId" = ${input.storeId} AND "status" <> 'cancelled' AND "createdAt" >= NOW() - INTERVAL '90 days' GROUP BY EXTRACT(ISODOW FROM "createdAt"), EXTRACT(HOUR FROM "createdAt") ORDER BY orders DESC LIMIT 24`);
      const productResult = await db.execute(sql`SELECT oi."productId", oi."productName", SUM(oi."quantity")::int AS quantity, ROUND(COALESCE(SUM(oi."subtotal"), 0)::numeric, 2) AS revenue, SUM(CASE WHEN o."status"='cancelled' THEN oi."quantity" ELSE 0 END)::int AS "cancelledQuantity" FROM "order_items" oi INNER JOIN "orders" o ON o."id"=oi."orderId" WHERE o."storeId"=${input.storeId} AND o."createdAt" >= NOW() - INTERVAL '90 days' GROUP BY oi."productId", oi."productName" ORDER BY revenue DESC LIMIT 50`);
      const summaryResult = await db.execute(sql`SELECT COUNT(*)::int AS "totalOrders", ROUND(COALESCE(SUM("total"),0)::numeric,2) AS revenue, ROUND(COALESCE(AVG("total"),0)::numeric,2) AS "averageTicket", COUNT(*) FILTER (WHERE "status"='cancelled')::int AS "cancelledOrders", ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM ("readyAt" - "confirmedAt")) / 60) FILTER (WHERE "confirmedAt" IS NOT NULL AND "readyAt" IS NOT NULL),0)::numeric,1) AS "averageKitchenMinutes" FROM "orders" WHERE "storeId"=${input.storeId} AND "createdAt" >= NOW() - INTERVAL '30 days'`);
      const suggestions = await db.select().from(intelligenceSuggestions).where(and(eq(intelligenceSuggestions.storeId, input.storeId), eq(intelligenceSuggestions.status, "new"))).orderBy(desc(intelligenceSuggestions.createdAt)).limit(20);
      return {
        demand: demandResult.rows,
        products: productResult.rows,
        summary: summaryResult.rows[0] ?? {},
        suggestions,
      };
    }),
    generateSuggestions: staffProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const peakResult = await db.execute(sql`SELECT EXTRACT(ISODOW FROM "createdAt")::int AS weekday, EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::int AS count FROM "orders" WHERE "storeId"=${input.storeId} AND "status" <> 'cancelled' AND "createdAt" >= NOW() - INTERVAL '60 days' GROUP BY EXTRACT(ISODOW FROM "createdAt"), EXTRACT(HOUR FROM "createdAt") ORDER BY count DESC LIMIT 1`);
      const riskResult = await db.execute(sql`SELECT "name", "currentStock", "minimumStock" FROM "ingredients" WHERE "storeId"=${input.storeId} AND "currentStock" <= "minimumStock" ORDER BY ("minimumStock" - "currentStock") DESC LIMIT 5`);
      const peak = peakResult.rows[0] as Record<string, unknown> | undefined;
      const risks = riskResult.rows as Array<Record<string, unknown>>;
      const generated = [
        peak ? { kind: "demand" as const, title: "Preparar operação para o próximo pico", description: `O maior pico recente ocorreu no dia ${peak.weekday}, às ${peak.hour}h, com ${peak.count} ${Number(peak.count) === 1 ? "pedido" : "pedidos"}. Antecipe massa, embalagem e equipe.`, confidence: "82.00", payload: JSON.stringify(peak) } : null,
        risks.length ? { kind: "purchase" as const, title: "Reposição prioritária de estoque", description: `${risks.length} ingredientes estão no nível mínimo ou abaixo. Gere uma compra antes do próximo pico.`, confidence: "95.00", payload: JSON.stringify(risks) } : null,
      ].filter(Boolean) as Array<{ kind: "demand" | "purchase"; title: string; description: string; confidence: string; payload: string }>;
      if (generated.length) {
        const generatedKinds = generated.map((item) => item.kind);
        await db.update(intelligenceSuggestions).set({ status: "dismissed", updatedAt: new Date() }).where(and(eq(intelligenceSuggestions.storeId, input.storeId), eq(intelligenceSuggestions.status, "new"), inArray(intelligenceSuggestions.kind, generatedKinds)));
        await db.insert(intelligenceSuggestions).values(generated.map((item) => ({ ...item, storeId: input.storeId })));
      }
      return { created: generated.length };
    }),
    updateSuggestion: staffProcedure.input(z.object({ storeId: z.number().int().positive(), id: z.number().int().positive(), status: z.enum(["accepted", "dismissed", "applied"]) })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      await (await requireDb()).update(intelligenceSuggestions).set({ status: input.status }).where(and(eq(intelligenceSuggestions.id, input.id), eq(intelligenceSuggestions.storeId, input.storeId)));
      return { ok: true };
    }),
  }),
});
