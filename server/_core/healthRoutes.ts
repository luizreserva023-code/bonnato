import type { Express } from "express";
import { sql } from "drizzle-orm";

import { eventOutbox } from "../../drizzle/schema.ts";
import { getStorageHealthSummary } from "../adapters/storage.ts";
import { getDb } from "../db.ts";

const appVersion =
  process.env.APP_VERSION
  || process.env.npm_package_version
  || "dev";

function requestIdOf(res: { locals?: Record<string, unknown> }) {
  const value = res.locals?.requestId;
  return typeof value === "string" ? value : null;
}

async function databaseHealth() {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  await db.execute(sql`select 1 as ok`);
  return { status: "ok" as const };
}

async function queueHealth() {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const rows = await db
    .select({
      status: eventOutbox.status,
      count: sql<number>`count(*)::int`,
    })
    .from(eventOutbox)
    .groupBy(eventOutbox.status);
  const counts = Object.fromEntries(
    rows.map((row) => [row.status, Number(row.count ?? 0)]),
  ) as Record<string, number>;

  const failed = counts.failed ?? 0;
  return {
    status: failed > 0 ? "degraded" as const : "ok" as const,
    pending: counts.pending ?? 0,
    processing: counts.processing ?? 0,
    failed,
  };
}

export function registerHealthRoutes(app: Express) {
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: appVersion,
      uptimeSeconds: Math.round(process.uptime()),
      requestId: requestIdOf(res),
    });
  });

  app.get("/health/database", async (_req, res) => {
    try {
      const database = await databaseHealth();
      res.json({ ...database, requestId: requestIdOf(res) });
    } catch {
      res.status(503).json({
        status: "unavailable",
        requestId: requestIdOf(res),
      });
    }
  });
  app.get("/health/queue", async (_req, res) => {
    try {
      const queue = await queueHealth();
      res.json({ ...queue, requestId: requestIdOf(res) });
    } catch {
      res.status(503).json({
        status: "unavailable",
        requestId: requestIdOf(res),
      });
    }
  });

  app.get("/health/storage", (_req, res) => {
    const storage = getStorageHealthSummary();
    const statusCode = storage.configured ? 200 : 503;
    res.status(statusCode).json({
      status: storage.configured ? "ok" : "unavailable",
      provider: storage.provider,
      requestId: requestIdOf(res),
    });
  });
}
