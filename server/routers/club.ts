import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";

import { fireJourneyTrigger } from "../automation.ts";
import { getDb } from "../db.ts";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.ts";
import { clubPayments, users } from "../../drizzle/schema.ts";
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

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

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

export const clubRouter = router({
  getPlans: publicProcedure.query(async () => {
    const config = await getClubConfig();
    return config.plans;
  }),

  getPublicConfig: publicProcedure.query(async () => {
    return getClubConfig();
  }),

  getAdminConfig: adminProcedure.query(async () => {
    return getClubConfig();
  }),

  saveAdminConfig: adminProcedure
    .input(clubConfigSchema)
    .mutation(async ({ input }) => {
      const ids = ensureClubPlanIds(input);
      if (!ids.includes("bonattao") || !ids.includes("basico")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Os dois planos base precisam existir." });
      }

      await saveClubConfig(input);
      return { ok: true };
    }),

  getMyPlan: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const userRows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!userRows[0]) return null;

    const user = userRows[0];
    if (!user.clubPlan || !user.clubStatus) return null;

    const planDetails = await getClubPlanConfig(user.clubPlan);
    return {
      plan: user.clubPlan,
      status: user.clubStatus,
      startDate: user.clubStartDate,
      nextBillingDate: user.clubNextBillingDate,
      freePizzaUsed: user.clubFreePizzaUsed,
      freePizzaResetAt: user.clubFreePizzaResetAt,
      planDetails,
    };
  }),

  subscribe: protectedProcedure
    .input(z.object({ plan: z.enum(["bonattao", "basico"]) }))
    .mutation(async ({ input, ctx }) => {
      const planDetails = await getClubPlanConfig(input.plan);
      if (!planDetails) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plano de assinatura inválido." });
      }

      const paymentSettings = await getPaymentSettingsAdmin();
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

      const result = await db.insert(clubPayments).values({
        userId: ctx.user.id,
        plan: input.plan,
        amount: planDetails.price.toFixed(2),
        pixCode,
        pixQrCode,
        status: "pending",
      });

      const paymentId =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((result as any).insertId ?? (result as any)[0]?.insertId ?? 0) as number;

      await db
        .update(users)
        .set({ clubPlan: input.plan, clubStatus: "pending" })
        .where(eq(users.id, ctx.user.id));

      return {
        paymentId,
        pixCode,
        pixQrCode,
        amount: planDetails.price,
        plan: planDetails,
      };
    }),

  checkPayment: protectedProcedure
    .input(z.object({ paymentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const payment = await db
        .select()
        .from(clubPayments)
        .where(and(eq(clubPayments.id, input.paymentId), eq(clubPayments.userId, ctx.user.id)))
        .limit(1);

      if (!payment[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return { status: payment[0].status };
    }),

  confirmPayment: adminProcedure
    .input(z.object({ paymentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const payment = await db
        .select()
        .from(clubPayments)
        .where(eq(clubPayments.id, input.paymentId))
        .limit(1);

      if (!payment[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const now = new Date();
      const nextBilling = new Date(now);
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      await db
        .update(clubPayments)
        .set({ status: "paid", paidAt: now })
        .where(eq(clubPayments.id, input.paymentId));

      await db
        .update(users)
        .set({
          clubStatus: "active",
          clubStartDate: now,
          clubNextBillingDate: nextBilling,
          clubFreePizzaUsed: false,
          clubFreePizzaResetAt: nextBilling,
        })
        .where(eq(users.id, payment[0].userId));

      const activatedUser = await db
        .select({ id: users.id, phone: users.phone })
        .from(users)
        .where(eq(users.id, payment[0].userId))
        .limit(1);

      if (activatedUser[0]) {
        fireJourneyTrigger("club_subscriber", activatedUser[0].id, activatedUser[0].phone ?? undefined).catch(
          (error: unknown) => console.error("[Club] club_subscriber trigger failed", error),
        );
      }

      return { ok: true };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .update(users)
      .set({
        clubStatus: "cancelled",
        clubPlan: null,
        clubNextBillingDate: null,
      })
      .where(eq(users.id, ctx.user.id));

    return { ok: true };
  }),

  useFreePizza: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const userRows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!userRows[0]) throw new TRPCError({ code: "NOT_FOUND" });

    const user = userRows[0];
    if (user.clubStatus !== "active") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro ativo do clube." });
    }

    const plan = await getClubPlanConfig(user.clubPlan);
    if (!plan?.freePizzaPerMonth) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Seu plano não inclui pizza grátis por mês." });
    }

    const now = new Date();
    if (user.clubFreePizzaUsed && user.clubFreePizzaResetAt && now > user.clubFreePizzaResetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await db
        .update(users)
        .set({ clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset })
        .where(and(eq(users.id, ctx.user.id), lte(users.clubFreePizzaResetAt, now)));
    }

    const result = await db
      .update(users)
      .set({ clubFreePizzaUsed: true })
      .where(and(eq(users.id, ctx.user.id), eq(users.clubStatus, "active"), eq(users.clubFreePizzaUsed, false)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutationResult = result as any;
    const affectedRows = mutationResult?.rowsAffected ?? mutationResult?.[0]?.affectedRows ?? 0;
    if (!affectedRows) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Você já usou sua pizza grátis neste mês." });
    }

    return { ok: true };
  }),

  getMembers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const members = await db.select().from(users).where(isNotNull(users.clubPlan));
    return members.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      clubPlan: user.clubPlan,
      clubStatus: user.clubStatus,
      clubStartDate: user.clubStartDate,
      clubNextBillingDate: user.clubNextBillingDate,
      clubFreePizzaUsed: user.clubFreePizzaUsed,
    }));
  }),

  getPendingPayments: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

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
      .where(eq(clubPayments.status, "pending"));
  }),

  sendPromotion: adminProcedure
    .input(z.object({ message: z.string().min(1).max(1000) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const members = await db
        .select({ phone: users.phone, name: users.name })
        .from(users)
        .where(and(isNotNull(users.clubPlan), eq(users.clubStatus, "active")));

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
