import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { eventOutbox, webhookEvents } from "../../drizzle/schema.ts";
import { adminProcedure, router } from "../_core/trpc.ts";
import { getDb } from "../db.ts";
import { recordStoreAudit } from "../storeAudit.ts";

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco de dados indisponível.",
    });
  }
  return db;
}

export const reliabilityRouter = router({
  summary: adminProcedure.query(async () => {
    const db = await requireDb();
    const [outboxRows, webhookRows] = await Promise.all([
      db.select({
        status: eventOutbox.status,
        count: sql<number>`count(*)::int`,
      }).from(eventOutbox).groupBy(eventOutbox.status),
      db.select({
        status: webhookEvents.status,
        count: sql<number>`count(*)::int`,
      }).from(webhookEvents).groupBy(webhookEvents.status),
    ]);

    return {
      outbox: Object.fromEntries(
        outboxRows.map((row) => [row.status, Number(row.count ?? 0)]),
      ),
      webhooks: Object.fromEntries(
        webhookRows.map((row) => [row.status, Number(row.count ?? 0)]),
      ),
    };
  }),

  failedJobs: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(10).max(100).default(25),
      status: z.enum(["failed", "discarded"]).default("failed"),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const offset = (input.page - 1) * input.pageSize;
      const where = eq(eventOutbox.status, input.status);
      const [rows, totalRows] = await Promise.all([
        db.select({
          id: eventOutbox.id,
          eventKey: eventOutbox.eventKey,
          eventType: eventOutbox.eventType,
          aggregateType: eventOutbox.aggregateType,
          aggregateId: eventOutbox.aggregateId,
          storeId: eventOutbox.storeId,
          status: eventOutbox.status,
          attempts: eventOutbox.attempts,
          lastError: eventOutbox.lastError,
          createdAt: eventOutbox.createdAt,
          updatedAt: eventOutbox.updatedAt,
        })
          .from(eventOutbox)
          .where(where)
          .orderBy(desc(eventOutbox.updatedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(eventOutbox)
          .where(where),
      ]);
      const total = Number(totalRows[0]?.count ?? 0);
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

  retryJob: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(eventOutbox)
        .where(eq(eventOutbox.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job não encontrado." });
      }
      if (row.status !== "failed" && row.status !== "discarded") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Somente jobs falhos ou descartados podem ser reenfileirados.",
        });
      }

      await db.update(eventOutbox).set({
        status: "pending",
        availableAt: new Date(),
        lockedAt: null,
        processedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(eventOutbox.id, row.id));

      if (row.storeId) {
        await recordStoreAudit({
          storeId: row.storeId,
          actorUserId: ctx.user.id,
          action: "outbox.retry",
          resourceType: "outbox_event",
          resourceId: row.id,
          metadata: {
            eventType: row.eventType,
            aggregateId: row.aggregateId,
            attempts: row.attempts,
          },
        });
      }

      return { ok: true };
    }),

  discardJob: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(eventOutbox)
        .where(eq(eventOutbox.id, input.id))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job não encontrado." });
      }
      if (row.status !== "failed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Somente jobs falhos podem ser descartados.",
        });
      }

      await db.update(eventOutbox).set({
        status: "discarded",
        lockedAt: null,
        updatedAt: new Date(),
      }).where(eq(eventOutbox.id, row.id));

      if (row.storeId) {
        await recordStoreAudit({
          storeId: row.storeId,
          actorUserId: ctx.user.id,
          action: "outbox.discard",
          resourceType: "outbox_event",
          resourceId: row.id,
          metadata: {
            eventType: row.eventType,
            aggregateId: row.aggregateId,
            attempts: row.attempts,
          },
        });
      }

      return { ok: true };
    }),

  webhookFailures: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return (await requireDb())
        .select({
          id: webhookEvents.id,
          provider: webhookEvents.provider,
          eventId: webhookEvents.eventId,
          eventType: webhookEvents.eventType,
          status: webhookEvents.status,
          attempts: webhookEvents.attempts,
          lastError: webhookEvents.lastError,
          lockedAt: webhookEvents.lockedAt,
          processedAt: webhookEvents.processedAt,
          updatedAt: webhookEvents.updatedAt,
        })
        .from(webhookEvents)
        .where(eq(webhookEvents.status, "failed"))
        .orderBy(desc(webhookEvents.updatedAt))
        .limit(input.limit);
    }),
});
