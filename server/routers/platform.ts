import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  comboGroupItems,
  comboGroups,
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
  tenantAuditLogs,
  tenantDomains,
  tenantPlans,
  tenantSubscriptions,
  tenants,
} from "../../drizzle/schema.ts";
import { getDb } from "../db.ts";
import { resolveRequiredStoreId } from "../storeUtils.ts";
import { recordTenantAudit } from "../tenantAudit.ts";
import { platformAdminProcedure, protectedProcedure, publicProcedure, router, staffProcedure } from "../_core/trpc.ts";

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

export const platformRouter = router({
  tenancy: router({
    plans: platformAdminProcedure.query(async () => {
      const rows = await (await requireDb()).select().from(tenantPlans).orderBy(asc(tenantPlans.monthlyPrice), asc(tenantPlans.id));
      return rows.map((plan) => ({ ...plan, entitlements: parseObject(plan.entitlements), limits: parseObject(plan.limits) }));
    }),
    overview: platformAdminProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso exclusivo da administração da plataforma." });
      const db = await requireDb();
      const tenantRows = await db.select().from(tenants).orderBy(asc(tenants.displayName));
      const domains = await db.select().from(tenantDomains).orderBy(asc(tenantDomains.hostname));
      const planRows = await db.select().from(tenantPlans).orderBy(asc(tenantPlans.monthlyPrice), asc(tenantPlans.id));
      const plans = planRows.map((plan) => ({
        ...plan,
        entitlements: parseObject(plan.entitlements),
        limits: parseObject(plan.limits),
      }));
      const subscriptions = await db.select().from(tenantSubscriptions);
      const storeRows = await db.select({ id: stores.id, tenantKey: stores.tenantKey, name: stores.name, active: stores.active }).from(stores);
      return tenantRows.map((tenant) => ({
        ...tenant,
        domains: domains.filter((domain) => domain.tenantId === tenant.id),
        stores: storeRows.filter((store) => store.tenantKey === tenant.tenantKey),
        subscription: subscriptions.find((subscription) => subscription.tenantId === tenant.id) ?? null,
        plans,
      }));
    }),
    saveTenant: platformAdminProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      tenantKey: z.string().trim().min(3).max(100).regex(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/),
      legalName: z.string().trim().min(2).max(200),
      displayName: z.string().trim().min(2).max(200),
      document: z.string().trim().max(32).optional(),
      status: z.enum(["setup_pending", "active", "suspended", "cancelled"]),
      planId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await requireDb();
      const values = { tenantKey: input.tenantKey, legalName: input.legalName, displayName: input.displayName, document: input.document ?? null, status: input.status };
      let tenantId = input.id;
      if (tenantId) {
        await db.update(tenants).set(values).where(eq(tenants.id, tenantId));
      } else {
        const [result] = await db.insert(tenants).values({ ...values, ownerUserId: ctx.user.id });
        tenantId = Number((result as { insertId?: number }).insertId);
      }
      if (!tenantId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a empresa." });
      if (input.planId) await db.insert(tenantSubscriptions).values({ tenantId, planId: input.planId, status: "trialing" }).onDuplicateKeyUpdate({ set: { planId: input.planId, updatedAt: new Date() } });
      await recordTenantAudit({ tenantId, actorUserId: ctx.user.id, action: input.id ? "tenant.updated" : "tenant.created", resourceType: "tenant", resourceId: tenantId, metadata: { status: input.status, planId: input.planId ?? null } });
      return { id: tenantId };
    }),
    addDomain: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), hostname: z.string().trim().min(4).max(255), kind: z.enum(["platform_subdomain", "custom_domain"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const hostname = input.hostname.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").replace(/:\d+$/, "");
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) throw new TRPCError({ code: "BAD_REQUEST", message: "Domínio inválido." });
      const db = await requireDb();
      const verificationToken = `bonatto-verify-${nanoid(32)}`;
      const [result] = await db.insert(tenantDomains).values({ tenantId: input.tenantId, hostname, kind: input.kind, verificationToken });
      const domainId = Number((result as { insertId?: number }).insertId);
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "domain.created", resourceType: "tenant_domain", resourceId: domainId, metadata: { hostname, kind: input.kind } });
      return { id: domainId, hostname, verificationToken, dns: { type: "TXT", name: `_bonatto-verification.${hostname}`, value: verificationToken } };
    }),
    setDomainStatus: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), domainId: z.number().int().positive(), status: z.enum(["pending", "verifying", "verified", "active", "failed", "disabled"]), error: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await requireDb();
      const now = new Date();
      await db.update(tenantDomains).set({ status: input.status, verifiedAt: input.status === "verified" || input.status === "active" ? now : undefined, activatedAt: input.status === "active" ? now : undefined, lastError: input.error ?? null }).where(and(eq(tenantDomains.id, input.domainId), eq(tenantDomains.tenantId, input.tenantId)));
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "domain.status_changed", resourceType: "tenant_domain", resourceId: input.domainId, metadata: { status: input.status } });
      return { ok: true };
    }),
    savePlan: platformAdminProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      code: z.string().trim().min(2).max(64).regex(/^[a-z0-9][a-z0-9_-]+$/),
      name: z.string().trim().min(2).max(120),
      monthlyPrice: z.number().min(0).max(1_000_000),
      entitlements: z.record(z.string().min(1).max(80), z.boolean()),
      limits: z.record(z.string().min(1).max(80), z.number().int().min(-1).max(100_000_000)),
      active: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const values = {
        code: input.code,
        name: input.name,
        monthlyPrice: input.monthlyPrice.toFixed(2),
        entitlements: JSON.stringify(input.entitlements),
        limits: JSON.stringify(input.limits),
        active: input.active,
      };
      let planId = input.id;
      if (planId) {
        await db.update(tenantPlans).set(values).where(eq(tenantPlans.id, planId));
      } else {
        const [result] = await db.insert(tenantPlans).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
        planId = Number((result as { insertId?: number }).insertId ?? 0);
        if (!planId) {
          const [existing] = await db.select({ id: tenantPlans.id }).from(tenantPlans).where(eq(tenantPlans.code, input.code)).limit(1);
          planId = existing?.id;
        }
      }
      if (!planId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar o plano." });
      return { id: planId, changedBy: ctx.user.id };
    }),
    setSubscription: platformAdminProcedure.input(z.object({
      tenantId: z.number().int().positive(),
      planId: z.number().int().positive(),
      status: z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]),
      trialDays: z.number().int().min(0).max(365).default(0),
      graceDays: z.number().int().min(0).max(90).default(0),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [planRows, tenantRows] = await Promise.all([
        db.select({ id: tenantPlans.id }).from(tenantPlans).where(eq(tenantPlans.id, input.planId)).limit(1),
        db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, input.tenantId)).limit(1),
      ]);
      if (!planRows[0] || !tenantRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa ou plano não encontrado." });
      const now = Date.now();
      const trialEndsAt = input.trialDays ? new Date(now + input.trialDays * 86_400_000) : null;
      const graceEndsAt = input.graceDays ? new Date(now + input.graceDays * 86_400_000) : null;
      await db.insert(tenantSubscriptions).values({ tenantId: input.tenantId, planId: input.planId, status: input.status, trialEndsAt, graceEndsAt }).onDuplicateKeyUpdate({ set: { planId: input.planId, status: input.status, trialEndsAt, graceEndsAt, updatedAt: new Date() } });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "subscription.updated", resourceType: "tenant_subscription", resourceId: input.tenantId, metadata: { planId: input.planId, status: input.status, trialDays: input.trialDays, graceDays: input.graceDays } });
      return { ok: true };
    }),
    audit: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return (await requireDb()).select().from(tenantAuditLogs).where(eq(tenantAuditLogs.tenantId, input.tenantId)).orderBy(desc(tenantAuditLogs.createdAt)).limit(input.limit);
    }),
  }),
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
        const [result] = await db.insert(productOptionGroups).values(data);
        return { id: Number((result as { insertId?: number }).insertId ?? 0) };
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
        const [result] = await db.insert(productOptions).values(data);
        return { id: Number((result as { insertId?: number }).insertId ?? 0) };
      }),
  }),

  operations: router({
    board: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const activeOrders = await db.select().from(orders).where(and(eq(orders.storeId, input.storeId), inArray(orders.status, ["pending", "confirmed", "preparing"]))).orderBy(asc(orders.createdAt)).limit(500);
      if (activeOrders.length) {
        await db.insert(kitchenTickets).values(activeOrders.map((order) => ({ storeId: input.storeId, orderId: order.id, status: order.status === "preparing" ? "preparing" as const : "queued" as const, startedAt: order.preparingAt, promisedAt: order.predictedReadyAt }))).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
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
        await db.update(kitchenTickets).set({ status: input.status, priority: input.priority ?? ticket.priority, startedAt: input.status === "preparing" ? ticket.startedAt ?? now : ticket.startedAt, readyAt: input.status === "ready" ? now : ticket.readyAt, completedAt: input.status === "completed" ? now : ticket.completedAt }).where(eq(kitchenTickets.id, ticket.id));
        if (input.status === "preparing") await db.update(orders).set({ status: "preparing", preparingAt: now }).where(and(eq(orders.id, ticket.orderId), eq(orders.storeId, input.storeId)));
        if (input.status === "ready") await db.update(orders).set({ readyAt: now }).where(and(eq(orders.id, ticket.orderId), eq(orders.storeId, input.storeId)));
        if (input.status === "cancelled") await db.update(orders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(orders.id, ticket.orderId), eq(orders.storeId, input.storeId)));
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
      await db.insert(growthSettings).values({ storeId: input.storeId, cashbackPercent: input.cashbackPercent.toFixed(2), pointsPerReal: input.pointsPerReal.toFixed(3), referralReferrerPoints: input.referralReferrerPoints, referralReferredPoints: input.referralReferredPoints, npsEnabled: input.npsEnabled }).onDuplicateKeyUpdate({ set: { cashbackPercent: input.cashbackPercent.toFixed(2), pointsPerReal: input.pointsPerReal.toFixed(3), referralReferrerPoints: input.referralReferrerPoints, referralReferredPoints: input.referralReferredPoints, npsEnabled: input.npsEnabled, updatedAt: new Date() } });
      return { ok: true };
    }),
    rewards: publicProcedure.input(storeInput).query(async ({ input }) => (await requireDb()).select().from(rewardCatalog).where(and(eq(rewardCatalog.storeId, input.storeId), eq(rewardCatalog.active, true))).orderBy(asc(rewardCatalog.pointsCost))),
    createReward: staffProcedure.input(z.object({ storeId: z.number().int().positive(), name: z.string().min(1).max(160), description: z.string().optional(), rewardType: z.enum(["discount", "product", "free_delivery", "cashback"]), pointsCost: z.number().int().min(0), value: z.number().min(0), productId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [result] = await db.insert(rewardCatalog).values({ ...input, description: input.description ?? null, productId: input.productId ?? null, value: input.value.toFixed(2) });
      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
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
      await db.insert(npsResponses).values({ ...input, userId: ctx.user.id, comment: input.comment ?? null }).onDuplicateKeyUpdate({ set: { score: input.score, comment: input.comment ?? null } });
      return { ok: true };
    }),
    myReferral: protectedProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [existing] = await db.select().from(referrals).where(and(eq(referrals.storeId, input.storeId), eq(referrals.referrerUserId, ctx.user.id), eq(referrals.status, "pending"))).limit(1);
      if (existing) return existing;
      const code = `IND${ctx.user.id}${nanoid(6)}`.toUpperCase();
      const [result] = await db.insert(referrals).values({ storeId: input.storeId, referrerUserId: ctx.user.id, code });
      return { id: Number((result as { insertId?: number }).insertId ?? 0), storeId: input.storeId, referrerUserId: ctx.user.id, code, status: "pending" as const };
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
      await db.insert(integrationConnections).values(data).onDuplicateKeyUpdate({ set: { status: data.status, config: data.config, credentialsRef: data.credentialsRef, lastSuccessAt: data.lastSuccessAt, lastFailureAt: data.lastFailureAt, updatedAt: now } });
      return { ok: true };
    }),
  }),

  intelligence: router({
    dashboard: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [demandResult] = await db.execute(sql`SELECT DAYOFWEEK(createdAt) weekday, HOUR(createdAt) hour, COUNT(*) orders, ROUND(SUM(total),2) revenue FROM orders WHERE storeId = ${input.storeId} AND status <> 'cancelled' AND createdAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) GROUP BY DAYOFWEEK(createdAt), HOUR(createdAt) ORDER BY orders DESC LIMIT 24`);
      const [productResult] = await db.execute(sql`SELECT oi.productId, oi.productName, SUM(oi.quantity) quantity, ROUND(SUM(oi.subtotal),2) revenue, SUM(CASE WHEN o.status='cancelled' THEN oi.quantity ELSE 0 END) cancelledQuantity FROM order_items oi INNER JOIN orders o ON o.id=oi.orderId WHERE o.storeId=${input.storeId} AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) GROUP BY oi.productId, oi.productName ORDER BY revenue DESC LIMIT 50`);
      const [summaryResult] = await db.execute(sql`SELECT COUNT(*) totalOrders, ROUND(COALESCE(SUM(total),0),2) revenue, ROUND(COALESCE(AVG(total),0),2) averageTicket, SUM(status='cancelled') cancelledOrders, ROUND(COALESCE(AVG(TIMESTAMPDIFF(MINUTE, confirmedAt, readyAt)),0),1) averageKitchenMinutes FROM orders WHERE storeId=${input.storeId} AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
      const suggestions = await db.select().from(intelligenceSuggestions).where(and(eq(intelligenceSuggestions.storeId, input.storeId), eq(intelligenceSuggestions.status, "new"))).orderBy(desc(intelligenceSuggestions.createdAt)).limit(20);
      return {
        demand: demandResult as unknown as unknown[],
        products: productResult as unknown as unknown[],
        summary: (summaryResult as unknown as unknown[])[0] ?? {},
        suggestions,
      };
    }),
    generateSuggestions: staffProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [peakRows] = await db.execute(sql`SELECT DAYOFWEEK(createdAt) weekday, HOUR(createdAt) hour, COUNT(*) count FROM orders WHERE storeId=${input.storeId} AND status <> 'cancelled' AND createdAt >= DATE_SUB(NOW(), INTERVAL 60 DAY) GROUP BY DAYOFWEEK(createdAt), HOUR(createdAt) ORDER BY count DESC LIMIT 1`);
      const [riskRows] = await db.execute(sql`SELECT name, currentStock, minimumStock FROM ingredients WHERE storeId=${input.storeId} AND currentStock <= minimumStock ORDER BY (minimumStock-currentStock) DESC LIMIT 5`);
      const peak = (peakRows as unknown as Array<Record<string, unknown>>)[0];
      const risks = riskRows as unknown as Array<Record<string, unknown>>;
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
