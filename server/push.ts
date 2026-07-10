import webpush from "web-push";
import { getDb } from "./db.ts";
import { pushSubscriptions, driverPushSubscriptions, clientNotifications } from "../drizzle/schema.ts";
import { eq, and, inArray } from "drizzle-orm";
import type { PushSubscription as PushSubRow, DriverPushSubscription as DriverPushSubRow } from "../drizzle/schema.ts";

// Configurar VAPID com as chaves do ambiente (graceful: não travar se chaves ausentes)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const isVapidConfigured = Boolean(vapidPublicKey && vapidPrivateKey);
if (isVapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? "mailto:contato@bonattopizza.com.br",
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn("[Push] VAPID keys not configured — push notifications disabled.");
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  soundUrl?: string;
}

function inferInAppType(payload: PushPayload): "order" | "promo" | "system" {
  const source = `${payload.tag ?? ""} ${payload.url ?? ""} ${payload.title ?? ""}`.toLowerCase();
  if (source.includes("order") || source.includes("pedido") || source.includes("delivery")) return "order";
  if (source.includes("promo") || source.includes("coupon") || source.includes("cupom") || source.includes("cart")) return "promo";
  return "system";
}

async function saveInAppNotification(userId: number, payload: PushPayload): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(clientNotifications).values({
    userId,
    title: payload.title,
    message: payload.body,
    type: inferInAppType(payload),
  });
}

async function saveInAppNotificationsForUsers(userIds: number[], payload: PushPayload): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  if (uniqueUserIds.length === 0) return;

  const db = await getDb();
  if (!db) return;

  await db.insert(clientNotifications).values(
    uniqueUserIds.map((userId) => ({
      userId,
      title: payload.title,
      message: payload.body,
      type: inferInAppType(payload),
    }))
  );
}

/**
 * Envia notificação push para todas as subscriptions de um usuário.
 * Remove automaticamente subscriptions expiradas/inválidas.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  const db = await getDb();
  if (!db) return;

  if (!isVapidConfigured) {
    await saveInAppNotification(userId, payload);
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) {
    await saveInAppNotification(userId, payload);
    return;
  }

  const icon = payload.icon ?? "/icon-192.png";
  const badge = payload.badge ?? "/icon-192.png";

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, icon, badge, url: payload.url ?? "/", tag: payload.tag, soundUrl: payload.soundUrl })
        );
      } catch (err: any) {
        // 410 Gone ou 404 = subscription expirada, remover
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    })
  );
}

/**
 * Envia notificação push para todos os admins.
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { users } = await import("../drizzle/schema.ts");
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  if (!isVapidConfigured) {
    await saveInAppNotificationsForUsers(adminUsers.map((u: { id: number }) => u.id), payload);
    return;
  }

  await Promise.allSettled(adminUsers.map((u: { id: number }) => sendPushToUser(u.id, payload)));
}

/**
 * Salva uma nova subscription no banco.
 * Se já existir para o mesmo endpoint, atualiza as chaves.
 */
export async function savePushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, userAgent })
      .where(eq(pushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth, userAgent });
  }
}

/**
 * Envia notificação push para todos os usuários com subscription ativa.
 * Opcionalmente filtra por lista de userIds (segmento).
 * Retorna { sent, failed }.
 */
export async function sendPushToAllUsers(
  payload: PushPayload,
  userIds?: number[]
): Promise<{ sent: number; failed: number }> {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  if (!isVapidConfigured) {
    const { users } = await import("../drizzle/schema.ts");
    const targetRows = userIds && userIds.length > 0
      ? await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds))
      : await db.select({ id: users.id }).from(users);
    await saveInAppNotificationsForUsers(targetRows.map((row: { id: number }) => row.id), payload);
    return { sent: targetRows.length, failed: 0 };
  }

  let query = db.select({ userId: pushSubscriptions.userId, id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth }).from(pushSubscriptions).$dynamic();
  if (userIds && userIds.length > 0) {
    query = query.where(inArray(pushSubscriptions.userId, userIds));
  }
  const subs = await query;

  const icon = payload.icon ?? "/icon-192.png";
  const badge = payload.badge ?? "/icon-192.png";
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, icon, badge, url: payload.url ?? "/", tag: payload.tag, soundUrl: payload.soundUrl })
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    })
  );
  return { sent, failed };
}

/**
 * Envia notificação push para um motoboy específico.
 * Remove automaticamente subscriptions expiradas/inválidas.
 */
export async function sendPushToDriver(driverId: number, payload: PushPayload): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const subs = await db
    .select()
    .from(driverPushSubscriptions)
    .where(eq(driverPushSubscriptions.driverId, driverId));
  const icon = payload.icon ?? "/icon-192.png";
  const badge = payload.badge ?? "/icon-192.png";
  await Promise.allSettled(
    subs.map(async (sub: DriverPushSubRow) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, icon, badge, url: payload.url ?? "/motoboy", tag: payload.tag, soundUrl: payload.soundUrl })
        );
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(driverPushSubscriptions).where(eq(driverPushSubscriptions.id, sub.id));
        }
      }
    })
  );
}

/**
 * Remove uma subscription pelo endpoint.
 */
export async function removePushSubscription(userId: number, endpoint: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}
