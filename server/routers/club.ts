import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";

import { fireJourneyTrigger } from "../automation.ts";
import { getDb } from "../db.ts";
import { protectedProcedure, publicProcedure, router, staffProcedure } from "../_core/trpc.ts";
import { clubPayments, customerStoreAccounts, users } from "../../drizzle/schema.ts";
import { sendWhatsApp } from "../whatsapp.ts";
import {
  getClubConfig,
  getClubPlanConfig,
  saveClubConfig,
  type ClubConfig,
  type ClubPlanId,
} from "../lib/club-config.ts";
import { getPaymentSettingsAdmin } from "../lib/payment-config.ts";
import { generatePixCode, generatePixQrCodeUrl } from "../lib/pix.ts";
import { getBonattoRuntimeByStoreId } from "../bonattoRuntime.ts";
import { getCustomerStoreAccount } from "../db.ts";
import { assertStoreEntityAccess, resolveRequiredStoreId } from "../storeUtils.ts";

const clubPlanSchema = z.object({
  id: z.enum(["bonattao", "basico"]),
  name: z.string().min(1).max(80),
  badge: z.string().min(1).max(40),
  price: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  freeDelivery: z.boolean(),
  freePizzaPerMonth: z.boolean(),
  description: z.string().min(1).max(180),
  benefits: z.array(z.string().min(1).max(160)).min(1).max(8),
});

const clubConfigSchema = z.object({
  badgeLabel: z.string().min(1).max(80),
  sectionTitle: z.string().min(1).max(80),
  sectionSubtitle: z.string().min(1).max(180),
  ctaLabel: z.string().min(1).max(80),
  disclaimer: z.string().min(1).max(180),
  highlightItems: z.array(z.string().min(1).max(120)).min(1).max(8),
  checkoutTitle: z.string().min(1).max(80),
  checkoutSubtitle: z.string().min(1).max(180),
  checkoutDiscountLabel: z.string().min(1).max(80),
  checkoutDeliveryLabel: z.string().min(1).max(80),
  checkoutFreePizzaLabel: z.string().min(1).max(120),
  profileGuestTitle: z.string().min(1).max(80),
  profileGuestSubtitle: z.string().min(1).max(180),
  profileBenefitsTitle: z.string().min(1).max(80),
  profilePrimaryActionLabel: z.string().min(1).max(80),
  successTitle: z.string().min(1).max(80),
  successSubtitle: z.string().min(1).max(180),
  popularPlanId: z.enum(["bonattao", "basico"]),
  plans: z.array(clubPlanSchema).length(2),
});

function ensureClubPlanIds(config: ClubConfig): ClubPlanId[] {
  return config.plans.map((plan) => plan.id) as ClubPlanId[];
}

async function assertClubStore(storeId: number) {
  const tenant = await getBonattoRuntimeByStoreId(storeId);
  if (!tenant || tenant.status !== "active" || !tenant.features.club) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O clube nao esta disponivel nesta loja." });
  }
  return tenant;
}

type ClubAccountUpdate = Partial<Pick<
  typeof customerStoreAccounts.$inferInsert,
  "clubPlan" | "clubStatus" | "clubStartDate" | "clubNextBillingDate" | "clubFreePizzaUsed" | "clubFreePizzaResetAt"
>>;

async function updateClubAccount(userId: number, storeId: number, data: ClubAccountUpdate) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const account = await getCustomerStoreAccount(userId, storeId);
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Conta do cliente nao encontrada." });
  await db.update(customerStoreAccounts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customerStoreAccounts.id, account.id));
  return { ...account, ...data };
}

export const clubRouter = router({
  getPlans: publicProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input }) => {
    await assertClubStore(input.storeId);
    const config = await getClubConfig(input.storeId);
    return config.plans;
  }),

  getPublicConfig: publicProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input }) => {
    await assertClubStore(input.storeId);
    return getClubConfig(input.storeId);
  }),

  getAdminConfig: staffProcedure
    .input(z.object({ storeId: z.number().optional() }))
    .query(async ({ input, ctx }) => getClubConfig(await resolveRequiredStoreId(ctx.user, input.storeId))),

  saveAdminConfig: staffProcedure
    .input(clubConfigSchema.extend({ storeId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const ids = ensureClubPlanIds(input);
      if (!ids.includes("bonattao") || !ids.includes("basico")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Os dois planos base precisam existir." });
      }

      const { storeId: _storeId, ...config } = input;
      await saveClubConfig(config, storeId);
      return { ok: true };
    }),

  getMyPlan: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
    await assertClubStore(input.storeId);
    const account = await getCustomerStoreAccount(ctx.user.id, input.storeId);
    if (!account?.clubPlan || !account.clubStatus) return null;

    const planDetails = await getClubPlanConfig(account.clubPlan, input.storeId);
    return {
      plan: account.clubPlan,
      status: account.clubStatus,
      startDate: account.clubStartDate,
      nextBillingDate: account.clubNextBillingDate,
      freePizzaUsed: account.clubFreePizzaUsed,
      freePizzaResetAt: account.clubFreePizzaResetAt,
      planDetails,
    };
  }),

  subscribe: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive(), plan: z.enum(["bonattao", "basico"]) }))
    .mutation(async ({ input, ctx }) => {
      await assertClubStore(input.storeId);
      const planDetails = await getClubPlanConfig(input.plan, input.storeId);
      if (!planDetails) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plano de assinatura inválido." });
      }

      const paymentSettings = await getPaymentSettingsAdmin(input.storeId);
      if (!paymentSettings.availability.club.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Os pagamentos do clube ainda não foram configurados.",
        });
      }
      const pixKey = paymentSettings.pixKey.trim();
      if (!pixKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure a chave PIX na aba de pagamentos do admin.",
        });
      }
      const txId = `CLUBE${ctx.user.id}${Date.now()}`.substring(0, 25);

      const pixCode = generatePixCode(
        pixKey,
        paymentSettings.config.pix.merchantName,
        planDetails.price,
        txId,
        paymentSettings.config.pix.merchantCity,
      );
      const pixQrCode = generatePixQrCodeUrl(pixCode);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [payment] = await db.insert(clubPayments).values({
        storeId: input.storeId,
        userId: ctx.user.id,
        plan: input.plan,
        amount: planDetails.price.toFixed(2),
        pixCode,
        pixQrCode,
        status: "pending",
      }).returning({ id: clubPayments.id });

      const paymentId = payment.id;

      await updateClubAccount(ctx.user.id, input.storeId, { clubPlan: input.plan, clubStatus: "pending" });

      return {
        paymentId,
        pixCode,
        pixQrCode,
        amount: planDetails.price,
        plan: planDetails,
      };
    }),

  checkPayment: protectedProcedure
    .input(z.object({ paymentId: z.number(), storeId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await assertClubStore(input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const payment = await db
        .select()
        .from(clubPayments)
        .where(and(
          eq(clubPayments.id, input.paymentId),
          eq(clubPayments.userId, ctx.user.id),
          eq(clubPayments.storeId, input.storeId),
        ))
        .limit(1);

      if (!payment[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return { status: payment[0].status };
    }),

  confirmPayment: staffProcedure
    .input(z.object({ paymentId: z.number(), storeId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const payment = await db
        .select()
        .from(clubPayments)
        .where(eq(clubPayments.id, input.paymentId))
        .limit(1);

      if (!payment[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await assertStoreEntityAccess(ctx.user, payment[0].storeId, input.storeId);

      const now = new Date();
      const nextBilling = new Date(now);
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      await db
        .update(clubPayments)
        .set({ status: "paid", paidAt: now })
        .where(eq(clubPayments.id, input.paymentId));

      await updateClubAccount(payment[0].userId, payment[0].storeId, {
        clubPlan: payment[0].plan,
        clubStatus: "active",
        clubStartDate: now,
        clubNextBillingDate: nextBilling,
        clubFreePizzaUsed: false,
        clubFreePizzaResetAt: nextBilling,
      });

      const activatedUser = await db
        .select({ id: users.id, phone: users.phone })
        .from(users)
        .where(eq(users.id, payment[0].userId))
        .limit(1);

      if (activatedUser[0]) {
        fireJourneyTrigger("club_subscriber", activatedUser[0].id, activatedUser[0].phone ?? undefined, payment[0].storeId).catch(
          (error: unknown) => console.error("[Club] club_subscriber trigger failed", error),
        );
      }

      return { ok: true };
    }),

  cancelSubscription: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
    await assertClubStore(input.storeId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await updateClubAccount(ctx.user.id, input.storeId, {
      clubStatus: "cancelled",
      clubPlan: null,
      clubNextBillingDate: null,
    });

    return { ok: true };
  }),

  useFreePizza: protectedProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
    await assertClubStore(input.storeId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    let account = await getCustomerStoreAccount(ctx.user.id, input.storeId);
    if (!account) throw new TRPCError({ code: "NOT_FOUND" });
    if (account.clubStatus !== "active") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro ativo do clube." });
    }

    const plan = await getClubPlanConfig(account.clubPlan, input.storeId);
    if (!plan?.freePizzaPerMonth) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Seu plano não inclui pizza grátis por mês." });
    }

    const now = new Date();
    if (account.clubFreePizzaUsed && account.clubFreePizzaResetAt && now > account.clubFreePizzaResetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await updateClubAccount(ctx.user.id, input.storeId, { clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset });
      account = { ...account, clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset };
    }

    const [updated] = await db
      .update(customerStoreAccounts)
      .set({ clubFreePizzaUsed: true, updatedAt: new Date() })
      .where(and(
        eq(customerStoreAccounts.id, account.id),
        eq(customerStoreAccounts.clubStatus, "active"),
        eq(customerStoreAccounts.clubFreePizzaUsed, false),
      ))
      .returning({ id: customerStoreAccounts.id });

    if (!updated) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Você já usou sua pizza grátis neste mês." });
    }

    return { ok: true };
  }),

  getMembers: staffProcedure
    .input(z.object({ storeId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    const members = await db
      .select({ account: customerStoreAccounts, user: users })
      .from(customerStoreAccounts)
      .innerJoin(users, eq(customerStoreAccounts.userId, users.id))
      .where(and(
        eq(customerStoreAccounts.storeId, storeId),
        isNotNull(customerStoreAccounts.clubPlan),
      ));
    return members.map(({ user, account }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      clubPlan: account.clubPlan,
      clubStatus: account.clubStatus,
      clubStartDate: account.clubStartDate,
      clubNextBillingDate: account.clubNextBillingDate,
      clubFreePizzaUsed: account.clubFreePizzaUsed,
    }));
  }),

  getPendingPayments: staffProcedure
    .input(z.object({ storeId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);

    return db
      .select({
        id: clubPayments.id,
        userId: clubPayments.userId,
        plan: clubPayments.plan,
        amount: clubPayments.amount,
        pixCode: clubPayments.pixCode,
        status: clubPayments.status,
        createdAt: clubPayments.createdAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
      })
      .from(clubPayments)
      .leftJoin(users, eq(clubPayments.userId, users.id))
      .where(and(eq(clubPayments.status, "pending"), eq(clubPayments.storeId, storeId)));
  }),

  sendPromotion: staffProcedure
    .input(z.object({ message: z.string().min(1).max(1000), storeId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const members = await db
        .select({ phone: users.phone, name: users.name })
        .from(customerStoreAccounts)
        .innerJoin(users, eq(customerStoreAccounts.userId, users.id))
        .where(and(
          eq(customerStoreAccounts.storeId, storeId),
          isNotNull(customerStoreAccounts.clubPlan),
          eq(customerStoreAccounts.clubStatus, "active"),
        ));

      let sent = 0;
      let failed = 0;

      for (const member of members) {
        if (!member.phone) continue;
        try {
          await sendWhatsApp(member.phone, `Clube do Bonatto\n\n${input.message}`);
          sent++;
        } catch {
          failed++;
        }
      }

      return { sent, failed, total: members.length };
    }),
});


