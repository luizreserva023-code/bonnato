import { and, asc, eq, lte, sql } from "drizzle-orm";

import { eventOutbox, orderAttributions, orderReviews } from "../drizzle/schema.ts";
import { createClientNotification, getDb, getOrderById, getOrderItems, pickRandomTemplate } from "./db.ts";
import { recordAnalyticsEvent, type AnalyticsEventType } from "./services/analytics.ts";
import { notifyOwnerAdapter } from "./adapters/pushNotifications.ts";
import { sendPushToAdmins, sendPushToUser } from "./push.ts";
import { sendWhatsAppOrThrow } from "./whatsapp.ts";
import { getReviewCashbackConfig, getReviewCashbackOffer } from "./services/reviewCashback.ts";
import { interpolateReviewCashbackMessage } from "../shared/reviewCashback.ts";

const MAX_ATTEMPTS = 8;
const STALE_LOCK_MS = 5 * 60 * 1000;

type OutboxRow = typeof eventOutbox.$inferSelect;

type StatusPayload = {
  orderId: number;
  orderNumber?: string | null;
  previousStatus?: string | null;
  nextStatus?: string | null;
};

function parsePayload(row: OutboxRow): Record<string, unknown> {
  try {
    const parsed = JSON.parse(row.payload);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function displayOrderNumber(order: { id: number; orderNumber?: string | null }): string {
  return order.orderNumber || String(order.id);
}

function statusEventName(status: string | null | undefined) {
  const map: Record<string, string> = {
    confirmed: "order_confirmed",
    preparing: "order_preparing",
    out_for_delivery: "order_out_for_delivery",
    delivered: "order_delivered",
    cancelled: "order_cancelled",
  };
  return status ? map[status] : undefined;
}

function analyticsEventForOrderStatus(status: string | null | undefined): AnalyticsEventType | undefined {
  const map: Record<string, AnalyticsEventType> = {
    confirmed: "ORDER_CONFIRMED",
    preparing: "ORDER_PREPARING",
    out_for_delivery: "ORDER_DISPATCHED",
    delivered: "ORDER_COMPLETED",
    cancelled: "ORDER_CANCELLED",
  };
  return status ? map[status] : undefined;
}

async function recordOrderAnalytics(
  orderId: number,
  eventType: AnalyticsEventType,
  metadata?: Record<string, string | number | boolean | null>,
) {
  const db = await getDb();
  if (!db) return;
  const order = await getOrderById(orderId);
  if (!order?.storeId) return;

  const [attribution] = await db
    .select()
    .from(orderAttributions)
    .where(eq(orderAttributions.orderId, orderId))
    .limit(1);

  await recordAnalyticsEvent({
    eventId: `server:${eventType.toLowerCase()}:${orderId}`,
    eventType,
    occurredAt: new Date(),
    storeId: order.storeId,
    sessionId: attribution?.sessionId || `order_${orderId}`,
    visitorId: attribution?.visitorId ?? undefined,
    customerId: order.userId ?? undefined,
    orderId,
    source: "server",
    utmSource: attribution?.utmSource ?? undefined,
    utmMedium: attribution?.utmMedium ?? undefined,
    utmCampaign: attribution?.utmCampaign ?? undefined,
    utmContent: attribution?.utmContent ?? undefined,
    utmTerm: attribution?.utmTerm ?? undefined,
    deviceType: "unknown",
    metadata,
  });
}

function interpolateTemplate(
  text: string,
  order: {
    id: number;
    orderNumber?: string | null;
    customerName?: string | null;
    total?: string | null;
  },
) {
  const display = displayOrderNumber(order);
  return text
    .replace(/\{\{clientName\}\}/g, order.customerName || "Cliente")
    .replace(/\{\{orderId\}\}/g, display)
    .replace(/\{\{orderNumber\}\}/g, display)
    .replace(/\{\{total\}\}/g, formatMoney(order.total));
}

async function processCreatedOwnerNotification(orderId: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  const items = await getOrderItems(orderId);
  const display = displayOrderNumber(order);
  const itemsList = items
    .map((item) => `• ${item.productName} x${item.quantity} — ${formatMoney(Number(item.productPrice) * item.quantity)}`)
    .join("\n");

  const result = await notifyOwnerAdapter({
    title: `🍕 Novo pedido #${display} — ${order.customerName}`,
    body: [
      `Cliente: ${order.customerName}`,
      `Telefone: ${order.customerPhone || "N/A"}`,
      `Endereço: ${order.deliveryAddress}`,
      `Pagamento: ${order.paymentMethod}`,
      "",
      "Itens:",
      itemsList || "Sem itens",
      "",
      `Total: ${formatMoney(order.total)}`,
    ].join("\n"),
    url: "/admin",
    tag: `new-order-${order.id}`,
  });

  if (!result.success) {
    throw new Error(result.error || `Owner notification failed via ${result.provider}`);
  }
}

async function processCreatedAdminPush(orderId: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  const display = displayOrderNumber(order);
  await sendPushToAdmins({
    title: `🍕 Novo pedido #${display}`,
    body: `${order.customerName} — ${formatMoney(order.total)}`,
    url: "/admin",
    tag: `new-order-${order.id}`,
  });
}

async function processCreatedCustomerWhatsApp(orderId: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!order.customerPhone) return;
  const display = displayOrderNumber(order);
  const message = [
    `🍕 *Bonatto Pizza* — Olá, ${order.customerName}!`,
    "",
    `Recebemos seu pedido *#${display}* com sucesso.`,
    `💰 Total: ${formatMoney(order.total)}`,
    "",
    "Vamos avisar você conforme o pedido avançar.",
  ].join("\n");
  await sendWhatsAppOrThrow(order.customerPhone, message);
}

async function processStatusCustomerPush(payload: StatusPayload) {
  // Push operacional enxuto: "preparando" continua no rastreio/WhatsApp,
  // mas não interrompe o cliente entre confirmação e saída para entrega.
  if (payload.nextStatus === "preparing") return;

  const order = await getOrderById(payload.orderId);
  if (!order) throw new Error(`Order ${payload.orderId} not found`);
  if (!order.userId) return;

  const eventName = statusEventName(payload.nextStatus);
  if (!eventName) return;

  const display = displayOrderNumber(order);
  const fallbacks: Record<string, { title: string; body: string }> = {
    confirmed: { title: "✅ Pedido confirmado!", body: `Seu pedido #${display} foi confirmado pela Bonatto Pizza.` },
    preparing: { title: "👨‍🍳 Preparando seu pedido!", body: `Seu pedido #${display} está sendo preparado com carinho.` },
    out_for_delivery: { title: "🛵 Saiu para entrega!", body: `Seu pedido #${display} está a caminho.` },
    delivered: { title: "🎉 Pedido entregue!", body: `Seu pedido #${display} foi entregue. Esperamos que você aproveite!` },
    cancelled: { title: "❌ Pedido cancelado", body: `Seu pedido #${display} foi cancelado. Entre em contato conosco se precisar de ajuda.` },
  };

  const template = await pickRandomTemplate(eventName, "push", order.storeId ?? undefined);
  const message = template
    ? {
        title: interpolateTemplate(template.title, order),
        body: interpolateTemplate(template.body, order),
      }
    : fallbacks[payload.nextStatus || ""];

  if (!message) return;
  await sendPushToUser(order.userId, {
    storeId: order.storeId,
    ...message,
    imageUrl: template?.imageUrl ?? undefined,
    url: "/minha-conta",
    tag: `order-status-${order.id}-${payload.nextStatus}`,
    dedupeKey: `order-status-${order.id}-${payload.nextStatus}`,
  });
}

async function processReviewCashbackCustomerPush(orderId: number) {
  const order = await getOrderById(orderId);
  if (!order?.userId || !order.storeId || order.status !== "delivered") return;

  const db = await getDb();
  if (!db) return;

  const [config, offer] = await Promise.all([
    getReviewCashbackConfig(order.storeId),
    getReviewCashbackOffer({ orderId: order.id, userId: order.userId }),
  ]);
  if (!offer?.enabled || !offer.open || offer.alreadyAwarded) return;

  if (config.campaignMode !== "google_request") {
    const [review] = await db
      .select({ id: orderReviews.id })
      .from(orderReviews)
      .where(eq(orderReviews.orderId, order.id))
      .limit(1);
    if (review || offer.estimatedPoints <= 0) return;
  } else if (!offer.externalReviewEnabled || !offer.externalReviewUrl) {
    return;
  }

  const display = displayOrderNumber(order);
  const values = {
    orderNumber: display,
    estimatedPoints: offer.estimatedPoints,
    cashbackPercent: offer.cashbackPercent,
  };
  const title = interpolateReviewCashbackMessage(config.notificationTitle, values);
  const body = interpolateReviewCashbackMessage(config.notificationMessage, values);
  const url = config.campaignMode === "google_request"
    ? offer.externalReviewUrl
    : `/minha-conta?tab=pedidos&avaliar=${order.id}`;
  const dedupeKey = `review-cashback-${order.id}`;

  await createClientNotification({
    storeId: order.storeId,
    userId: order.userId,
    title,
    message: body,
    url,
    type: "promo",
    dedupeKey,
  });

  await sendPushToUser(order.userId, {
    storeId: order.storeId,
    title,
    body,
    url,
    tag: dedupeKey,
    dedupeKey,
    persistInAppFallback: false,
  });
}

async function processStatusCustomerWhatsApp(payload: StatusPayload) {
  const order = await getOrderById(payload.orderId);
  if (!order) throw new Error(`Order ${payload.orderId} not found`);
  if (!order.customerPhone) return;

  const eventName = statusEventName(payload.nextStatus);
  if (!eventName) return;

  const display = displayOrderNumber(order);
  const customerName = order.customerName || "Cliente";
  const fallbacks: Record<string, string> = {
    confirmed: `🍕 *Bonatto Pizza* — Olá, ${customerName}! Seu pedido *#${display}* foi confirmado.`,
    preparing: `👨‍🍳 ${customerName}, seu pedido *#${display}* está sendo preparado agora.`,
    out_for_delivery: `🛵 ${customerName}, seu pedido *#${display}* saiu para entrega!`,
    delivered: `✅ ${customerName}, seu pedido *#${display}* foi entregue. Bom apetite!`,
    cancelled: `❌ ${customerName}, seu pedido *#${display}* foi cancelado. Entre em contato conosco se precisar de ajuda.`,
  };

  const template = await pickRandomTemplate(eventName, "whatsapp", order.storeId ?? undefined);
  const message = template
    ? interpolateTemplate(template.body, order)
    : fallbacks[payload.nextStatus || ""];

  if (!message) return;
  await sendWhatsAppOrThrow(order.customerPhone, message);
}

async function dispatchOutboxEvent(row: OutboxRow): Promise<void> {
  const payload = parsePayload(row);
  const orderId = Number(payload.orderId ?? row.aggregateId);

  switch (row.eventType) {
    case "order.created":
      return recordOrderAnalytics(orderId, "ORDER_CREATED");
    case "order.paid":
      return recordOrderAnalytics(orderId, "ORDER_PAID");
    case "order.ready":
      return recordOrderAnalytics(orderId, "ORDER_READY");
    case "order.status_changed": {
      const typed = payload as StatusPayload;
      const eventType = analyticsEventForOrderStatus(typed.nextStatus);
      if (!eventType) return;
      return recordOrderAnalytics(orderId, eventType, {
        previous_status: typed.previousStatus ?? null,
        next_status: typed.nextStatus ?? null,
      });
    }
    case "order.created.owner_notification":
      return processCreatedOwnerNotification(orderId);
    case "order.created.admin_push":
      return processCreatedAdminPush(orderId);
    case "order.created.customer_whatsapp":
      return processCreatedCustomerWhatsApp(orderId);
    case "order.status_changed.customer_push":
      return processStatusCustomerPush(payload as StatusPayload);
    case "order.status_changed.customer_whatsapp":
      return processStatusCustomerWhatsApp(payload as StatusPayload);
    case "order.review_cashback.customer_push":
      return processReviewCashbackCustomerPush(orderId);
    default:
      throw new Error(`Unsupported outbox event type: ${row.eventType}`);
  }
}

function retryDelayMs(attempts: number) {
  const base = 5_000;
  return Math.min(15 * 60_000, base * 2 ** Math.max(0, attempts - 1));
}

export async function processOutboxEvents(limit = 30): Promise<{ processed: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, failed: 0 };

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

  await db
    .update(eventOutbox)
    .set({
      status: "pending",
      lockedAt: null,
      lastError: "Recovered stale processing lock",
      updatedAt: now,
    })
    .where(and(
      eq(eventOutbox.status, "processing"),
      lte(eventOutbox.lockedAt, staleBefore),
    ));

  const candidates = await db
    .select()
    .from(eventOutbox)
    .where(and(
      eq(eventOutbox.status, "pending"),
      lte(eventOutbox.availableAt, now),
    ))
    .orderBy(asc(eventOutbox.id))
    .limit(Math.max(1, Math.min(limit, 100)));

  let processed = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const [claimed] = await db
      .update(eventOutbox)
      .set({
        status: "processing",
        lockedAt: new Date(),
        attempts: sql`${eventOutbox.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(eventOutbox.id, candidate.id),
        eq(eventOutbox.status, "pending"),
      ))
      .returning();

    if (!claimed) continue;

    try {
      await dispatchOutboxEvent(claimed);
      await db
        .update(eventOutbox)
        .set({
          status: "processed",
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(eventOutbox.id, claimed.id));
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const terminal = claimed.attempts >= MAX_ATTEMPTS;
      await db
        .update(eventOutbox)
        .set({
          status: terminal ? "failed" : "pending",
          availableAt: terminal
            ? new Date()
            : new Date(Date.now() + retryDelayMs(claimed.attempts)),
          lockedAt: null,
          lastError: message.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(eventOutbox.id, claimed.id));
      failed += 1;
      console.error(`[Outbox] Event ${claimed.eventKey} failed on attempt ${claimed.attempts}:`, error);
    }
  }

  return { processed, failed };
}
