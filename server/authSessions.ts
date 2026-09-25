import { and, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";

import { authSessions, users } from "../drizzle/schema.ts";
import { getDb } from "./db.ts";

function deviceLabel(userAgent?: string | null) {
  const ua = userAgent ?? "";
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Safari\//i.test(ua) ? "Safari" :
    "Navegador";

  const os =
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Windows/i.test(ua) ? "Windows" :
    /Mac OS|Macintosh/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" :
    "Dispositivo";

  return `${browser} • ${os}`;
}

export async function createAuthSession(input: {
  id: string;
  userId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(authSessions).values({
    id: input.id,
    userId: input.userId,
    ipAddress: input.ipAddress?.slice(0, 64) ?? null,
    userAgent: input.userAgent?.slice(0, 2000) ?? null,
    deviceLabel: deviceLabel(input.userAgent).slice(0, 180),
    expiresAt: input.expiresAt,
  });
}

export async function getActiveAuthSession(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db.select().from(authSessions).where(and(
    eq(authSessions.id, sessionId),
    isNull(authSessions.revokedAt),
    gt(authSessions.expiresAt, new Date()),
  )).limit(1);
  return session ?? null;
}

export async function touchAuthSession(sessionId: string) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
  await db.update(authSessions)
    .set({ lastSeenAt: now })
    .where(and(
      eq(authSessions.id, sessionId),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, now),
      lt(authSessions.lastSeenAt, staleBefore),
    ));
}

export async function listActiveAuthSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: authSessions.id,
    deviceLabel: authSessions.deviceLabel,
    ipAddress: authSessions.ipAddress,
    userAgent: authSessions.userAgent,
    createdAt: authSessions.createdAt,
    lastSeenAt: authSessions.lastSeenAt,
    expiresAt: authSessions.expiresAt,
  }).from(authSessions).where(and(
    eq(authSessions.userId, userId),
    isNull(authSessions.revokedAt),
    gt(authSessions.expiresAt, new Date()),
  )).orderBy(desc(authSessions.lastSeenAt));
}

export async function revokeAuthSession(
  userId: number,
  sessionId: string,
  reason = "user_revoked",
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(authSessions).set({
    revokedAt: new Date(),
    revokedReason: reason.slice(0, 80),
  }).where(and(
    eq(authSessions.id, sessionId),
    eq(authSessions.userId, userId),
    isNull(authSessions.revokedAt),
  )).returning({ id: authSessions.id });
  return result.length > 0;
}

export async function revokeAllAuthSessions(
  userId: number,
  exceptSessionId?: string,
  reason = "user_revoked_all",
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const filters = [
    eq(authSessions.userId, userId),
    isNull(authSessions.revokedAt),
  ];
  if (exceptSessionId) filters.push(ne(authSessions.id, exceptSessionId));
  const result = await db.update(authSessions).set({
    revokedAt: new Date(),
    revokedReason: reason.slice(0, 80),
  }).where(and(...filters)).returning({ id: authSessions.id });
  return result.length;
}

export async function invalidateLegacySessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users)
    .set({ sessionInvalidBefore: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}
