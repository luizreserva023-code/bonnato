import { z } from "zod";
import { notifyOwner } from "./notification.ts";
import { adminProcedure, publicProcedure, router } from "./trpc.ts";
import { sendDailyReport } from "../dailyReport.ts";
import { sql } from "drizzle-orm";
import { getDb } from "../db.ts";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => {
      const startedAt = Date.now();
      let database: "ok" | "down" = "down";
      try {
        const db = await getDb();
        if (db) {
          await db.execute(sql`SELECT 1`);
          database = "ok";
        }
      } catch {
        database = "down";
      }

      return {
        ok: database === "ok",
        database,
        latencyMs: Date.now() - startedAt,
        services: {
          push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
          googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          email: Boolean(process.env.RESEND_API_KEY),
          stripe: Boolean(process.env.STRIPE_SECRET_KEY),
          asaas: Boolean(process.env.ASAAS_API_KEY),
          ifood: Boolean(process.env.IFOOD_CLIENT_ID && process.env.IFOOD_CLIENT_SECRET),
        },
      };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /** Envia o relatório diário de vendas via WhatsApp imediatamente (para teste) */
  sendDailyReport: adminProcedure
    .mutation(async () => {
      await sendDailyReport();
      return { success: true };
    }),
});
