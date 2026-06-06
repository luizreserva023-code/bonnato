import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { sendWhatsApp } from "../whatsapp";
import { getDb } from "../db";
import { clubPayments, users } from "../../drizzle/schema";
import { fireJourneyTrigger } from "../automation";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

// Planos do clube
export const CLUB_PLANS = {
  bonattao: {
    id: "bonattao" as const,
    name: "Sócio Bonatto",
    price: 19.0,
    discountPercent: 20,
    freeDelivery: true,
    freePizzaPerMonth: true,
    description: "Você não pede pizza. Você manda fazer.",
    benefits: ["20% de desconto em todos os pedidos", "Entrega sempre grátis", "1 pizza grátis por mês", "Acesso VIP a lançamentos e promoções"],
  },
  basico: {
    id: "basico" as const,
    name: "Fã Bonatto",
    price: 9.99,
    discountPercent: 15,
    freeDelivery: false,
    freePizzaPerMonth: true,
    description: "Entrou pro time. Agora é da família.",
    benefits: ["15% de desconto em todos os pedidos", "1 pizza grátis por mês", "Acesso a promoções exclusivas"],
  },
} as const;

type PlanKey = keyof typeof CLUB_PLANS;

// Gera código PIX copia-e-cola (formato EMV/BR Code)
function generatePixCode(pixKey: string, merchantName: string, amount: number, txId: string): string {
  function field(id: string, value: string): string {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  }

  const gui = field("00", "BR.GOV.BCB.PIX");
  const key = field("01", pixKey);
  const merchantAccountInfo = field("26", gui + key);

  const mcc = field("52", "0000");
  const currency = field("53", "986");
  const amountStr = field("54", amount.toFixed(2));
  const country = field("58", "BR");
  const name = field("59", merchantName.substring(0, 25));
  const city = field("60", "SAO PAULO");
  const txIdField = field("05", txId.substring(0, 25));
  const additionalData = field("62", txIdField);

  const payload = "000201" + merchantAccountInfo + mcc + currency + amountStr + country + name + city + additionalData + "6304";

  // CRC16-CCITT
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}

// Gera URL do QR Code via API pública
function generatePixQrCodeUrl(pixCode: string): string {
  const encoded = encodeURIComponent(pixCode);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
}

export const clubRouter = router({
  // Retorna os planos disponíveis (público)
  getPlans: publicProcedure.query(() => {
    return Object.values(CLUB_PLANS);
  }),

  // Retorna o plano atual do usuário logado
  getMyPlan: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const userRows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!userRows[0]) return null;
    const u = userRows[0];
    if (!u.clubPlan || !u.clubStatus) return null;
    const plan = CLUB_PLANS[u.clubPlan as PlanKey];
    return {
      plan: u.clubPlan,
      status: u.clubStatus,
      startDate: u.clubStartDate,
      nextBillingDate: u.clubNextBillingDate,
      freePizzaUsed: u.clubFreePizzaUsed,
      freePizzaResetAt: u.clubFreePizzaResetAt,
      planDetails: plan,
    };
  }),

  // Inicia a assinatura: gera PIX e cria pagamento pendente
  subscribe: protectedProcedure
    .input(z.object({ plan: z.enum(["bonattao", "basico"]) }))
    .mutation(async ({ input, ctx }) => {
      const planDetails = CLUB_PLANS[input.plan as PlanKey];
      const pixKey = process.env.PIX_KEY ?? "bonattopizza@gmail.com";
      const merchantName = process.env.PIX_MERCHANT_NAME ?? "Bonatto Pizza";
      const txId = `CLUBE${ctx.user.id}${Date.now()}`.substring(0, 25);

      const pixCode = generatePixCode(pixKey, merchantName, planDetails.price, txId);
      const pixQrCode = generatePixQrCodeUrl(pixCode);

      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Criar registro de pagamento pendente
      const result = await db.insert(clubPayments).values({
        userId: ctx.user.id,
        plan: input.plan,
        amount: planDetails.price.toFixed(2),
        pixCode,
        pixQrCode,
        status: "pending",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paymentId = (result as any).insertId ?? (result as any)[0]?.insertId ?? 0;

      // Marcar usuário como pending
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

  // Verifica se o pagamento foi confirmado (polling do cliente)
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

  // Admin confirma pagamento PIX manualmente
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

      // Ativar pagamento
      await db
        .update(clubPayments)
        .set({ status: "paid", paidAt: now })
        .where(eq(clubPayments.id, input.paymentId));

      // Ativar plano do usuário
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

      // Fire club_subscriber automation trigger
      const activatedUser = await db.select({ id: users.id, phone: users.phone }).from(users).where(eq(users.id, payment[0].userId)).limit(1);
      if (activatedUser[0]) {
        fireJourneyTrigger("club_subscriber", activatedUser[0].id, activatedUser[0].phone ?? undefined).catch(
          (err: unknown) => console.error("[Club] club_subscriber trigger failed", err)
        );
      }

      return { ok: true };
    }),

  // Cancela assinatura — também encerra benefícios imediatamente.
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db
      .update(users)
      .set({
        clubStatus: "cancelled",
        clubPlan: null,
        clubNextBillingDate: null,
        // Mantém `clubFreePizzaUsed` intacto até o próximo ciclo (regra atual)
        // mas garante que nenhum benefício seja concedido enquanto o status
        // estiver diferente de "active".
      })
      .where(eq(users.id, ctx.user.id));
    return { ok: true };
  }),

  // Marca pizza grátis como usada no mês — update atômico com guarda de estado.
  useFreePizza: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const userRows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!userRows[0]) throw new TRPCError({ code: "NOT_FOUND" });
    const u = userRows[0];
    if (u.clubStatus !== "active") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Você não é membro ativo do clube" });
    }
    const plan = u.clubPlan ? CLUB_PLANS[u.clubPlan] : null;
    if (!plan?.freePizzaPerMonth) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Seu plano não inclui pizza grátis por mês" });
    }
    const now = new Date();
    // Auto-reset atômico: só limpa a flag se a data já passou.
    if (u.clubFreePizzaUsed && u.clubFreePizzaResetAt && now > u.clubFreePizzaResetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await db
        .update(users)
        .set({ clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset })
        .where(and(eq(users.id, ctx.user.id), lte(users.clubFreePizzaResetAt, now)));
    }
    // Tenta marcar como usada atomicamente: só consome se a flag ainda estiver
    // em `false` e o usuário continuar ativo. Evita double-spend em corrida.
    const result = await db
      .update(users)
      .set({ clubFreePizzaUsed: true })
      .where(and(
        eq(users.id, ctx.user.id),
        eq(users.clubStatus, "active"),
        eq(users.clubFreePizzaUsed, false),
      ));
    // Drizzle mysql2 retorna [ResultSetHeader, …] (arr) ou { rowsAffected }.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    const affected: number = r?.rowsAffected ?? r?.[0]?.affectedRows ?? 0;
    if (!affected) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Você já usou sua pizza grátis este mês" });
    }
    return { ok: true };
  }),

  // Admin: lista todos os membros do clube
  getMembers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const members = await db
      .select()
      .from(users)
      .where(isNotNull(users.clubPlan));
    return members.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      clubPlan: u.clubPlan,
      clubStatus: u.clubStatus,
      clubStartDate: u.clubStartDate,
      clubNextBillingDate: u.clubNextBillingDate,
      clubFreePizzaUsed: u.clubFreePizzaUsed,
    }));
  }),

  // Admin: lista pagamentos pendentes do clube
  getPendingPayments: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const payments = await db
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
    return payments;
  }),

  // Admin: envia promoção via WhatsApp para todos os membros ativos
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
          await sendWhatsApp(member.phone, `🏆 *Clube do Bonatto* — Promoção Exclusiva!\n\n${input.message}`);
          sent++;
        } catch {
          failed++;
        }
      }
      return { sent, failed, total: members.length };
    }),
});
