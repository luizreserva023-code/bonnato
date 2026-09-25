import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

import {
  customerMetrics,
  deliveryPredictions,
  orderStageLogs,
  orderItems,
  orders,
  productivityEvents,
  eventOutbox,
  type Order,
} from "../drizzle/schema.ts";
import {
  consumeInventoryForOrder,
  getDb,
  getAllStoreSettings,
  getOrderById,
  reverseInventoryForOrder,
  updateOrderStatusGuarded,
} from "./db.ts";
import { getReviewCashbackConfig } from "./services/reviewCashback.ts";

type OrderStatus = Order["status"];
type OrderStage = typeof orderStageLogs.$inferInsert["stage"];

const STAGE_BY_STATUS: Record<OrderStatus, OrderStage> = {
  pending: "created",
  confirmed: "confirmed",
  preparing: "preparing",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
};

function parseIntegerSetting(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateOrNull(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function buildPredictionLabel(serviceType: Order["serviceType"], minMinutes: number, maxMinutes: number) {
  if (serviceType === "pickup") {
    return `Retirada prevista em ${minMinutes} a ${maxMinutes} minutos`;
  }
  if (serviceType === "dine_in") {
    return `Mesa: preparo estimado em ${minMinutes} a ${maxMinutes} minutos`;
  }
  if (serviceType === "counter") {
    return `Balcao: pedido estimado em ${minMinutes} a ${maxMinutes} minutos`;
  }
  return `Entrega prevista entre ${minMinutes} e ${maxMinutes} minutos`;
}

async function computePredictionWindow(order: Order) {
  const db = await getDb();
  if (!db) return null;

  const settings = await getAllStoreSettings();
  const basePrepMinutes = parseIntegerSetting(settings.prepBaseMinutes, 20);
  const baseDeliveryMinutes = parseIntegerSetting(settings.deliveryBaseMinutes, 20);
  const peakExtraMinutes = parseIntegerSetting(settings.peakExtraMinutes, 10);
  const queueExtraPerOrder = parseIntegerSetting(settings.orderVolumeExtraMinutesPerOrder, 3);

  const activeRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        order.storeId ? eq(orders.storeId, order.storeId) : undefined,
        sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'out_for_delivery')`
      )
    );

  const queuePressure = Math.max(0, activeRows.length - 1);
  const now = new Date();
  const hour = now.getHours();
  const isPeakHour = hour >= 18 && hour <= 22;

  let prepMinutes = basePrepMinutes + queuePressure * queueExtraPerOrder + (isPeakHour ? peakExtraMinutes : 0);
  let deliveryMinutes = 0;

  if (order.serviceType === "delivery") {
    // O prazo comercial aplicado no checkout fica congelado no pedido.
    // Para a previsão operacional, separamos aproximadamente o preparo-base
    // para não somar duas vezes o tempo total da faixa.
    const quotedTotalMinutes = order.deliveryEstimatedMinutes ?? null;
    deliveryMinutes = quotedTotalMinutes != null
      ? Math.max(0, quotedTotalMinutes - basePrepMinutes)
      : baseDeliveryMinutes;
  } else if (order.serviceType === "pickup") {
    deliveryMinutes = 5;
  } else if (order.serviceType === "dine_in") {
    deliveryMinutes = 0;
  } else {
    deliveryMinutes = 8;
  }

  const minMinutes = Math.max(5, prepMinutes + Math.max(0, deliveryMinutes - 5));
  const maxMinutes = Math.max(minMinutes + 5, prepMinutes + deliveryMinutes + 10);
  const predictionLabel = buildPredictionLabel(order.serviceType, minMinutes, maxMinutes);

  return {
    predictionLabel,
    minMinutes,
    maxMinutes,
    prepBaseMinutes: prepMinutes,
    deliveryBaseMinutes: deliveryMinutes,
    queuePressure,
  };
}

async function syncCustomerMetricsForScope(userId: number, scopeStoreId: number) {
  const db = await getDb();
  if (!db) return;

  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      deliveryNeighborhood: orders.deliveryNeighborhood,
    })
    .from(orders)
    .where(and(
      eq(orders.userId, userId),
      scopeStoreId > 0 ? eq(orders.storeId, scopeStoreId) : undefined,
    ));

  const totalOrders = orderRows.length;
  const delivered = orderRows.filter((order) => order.status === "delivered");
  const cancelledOrders = orderRows.filter((order) => order.status === "cancelled").length;
  const deliveredOrders = delivered.length;
  const deliveredDates = delivered
    .map((order) => new Date(order.createdAt))
    .sort((a, b) => a.getTime() - b.getTime());
  const firstOrderAt = deliveredDates[0] ?? null;
  const lastOrderAt = deliveredDates[deliveredDates.length - 1] ?? null;
  const totalSpent = delivered.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const averageTicket = deliveredOrders > 0 ? totalSpent / deliveredOrders : 0;

  const favoriteByCount = <T extends string | number>(values: T[]): T | null => {
    if (values.length === 0) return null;
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  const favoriteNeighborhood = favoriteByCount(
    delivered
      .map((order) => order.deliveryNeighborhood?.trim())
      .filter((value): value is string => Boolean(value)),
  );

  const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });
  const hourFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  });
  const favoriteOrderDay = favoriteByCount(
    delivered.map((order) => weekdayFormatter.format(new Date(order.createdAt))),
  );
  const favoriteOrderHour = favoriteByCount(
    delivered.map((order) => Number(hourFormatter.format(new Date(order.createdAt)))),
  );

  const productRows = deliveredOrders > 0
    ? await db
        .select({
          productName: orderItems.productName,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(
          eq(orders.userId, userId),
          eq(orders.status, "delivered"),
          scopeStoreId > 0 ? eq(orders.storeId, scopeStoreId) : undefined,
        ))
    : [];

  const productCounts = new Map<string, number>();
  for (const item of productRows) {
    productCounts.set(item.productName, (productCounts.get(item.productName) ?? 0) + item.quantity);
  }
  const favoriteProductName = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const payload = {
    userId,
    storeId: scopeStoreId,
    firstOrderAt,
    lastOrderAt,
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    firstOrderCount: deliveredOrders > 0 ? 1 : 0,
    totalSpent: totalSpent.toFixed(2),
    averageTicket: averageTicket.toFixed(2),
    favoriteNeighborhood,
    favoriteOrderDay,
    favoriteOrderHour,
    favoriteProductName,
    updatedAt: new Date(),
  };

  await db
    .insert(customerMetrics)
    .values(payload)
    .onConflictDoUpdate({
      target: [customerMetrics.userId, customerMetrics.storeId],
      set: payload,
    });
}

async function recordProductivityEvent(order: Order, nextStatus: OrderStatus, now: Date) {
  const db = await getDb();
  if (!db) return;

  const events: Array<{ eventType: typeof productivityEvents.$inferInsert["eventType"]; valueSeconds: number }> = [];

  if (nextStatus === "confirmed") {
    events.push({
      eventType: "acceptance_time",
      valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 1000)),
    });
  }

  if (nextStatus === "out_for_delivery") {
    const prepStart = order.preparingAt ?? order.confirmedAt ?? order.createdAt;
    events.push({
      eventType: "prep_time",
      valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(prepStart).getTime()) / 1000)),
    });
  }

  if (nextStatus === "delivered") {
    if (order.outForDeliveryAt) {
      events.push({
        eventType: "delivery_time",
        valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(order.outForDeliveryAt).getTime()) / 1000)),
      });
    }
    events.push({
      eventType: "total_time",
      valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 1000)),
    });
  }

  if (events.length === 0) return;

  await db.insert(productivityEvents).values(
    events.map((event) => ({
      orderId: order.id,
      storeId: order.storeId ?? null,
      eventType: event.eventType,
      actorType: "system" as const,
      valueSeconds: event.valueSeconds,
      metadata: JSON.stringify({ status: nextStatus }),
    }))
  );
}

async function scheduleReviewCashbackNotification(order: Order) {
  if (!order.userId || !order.storeId || order.status !== "delivered") return;
  const db = await getDb();
  if (!db) return;

  const config = await getReviewCashbackConfig(order.storeId);
  if (!config.enabled) return;

  await db
    .insert(eventOutbox)
    .values({
      eventKey: `order.review_cashback.customer_push:${order.id}`,
      eventType: "order.review_cashback.customer_push",
      aggregateType: "order",
      aggregateId: String(order.id),
      storeId: order.storeId,
      payload: JSON.stringify({ orderId: order.id }),
      status: "pending",
      availableAt: new Date(Date.now() + config.notificationDelayMinutes * 60_000),
    })
    .onConflictDoNothing({ target: eventOutbox.eventKey });
}

export async function syncCustomerMetricsForOrder(order: Order) {
  if (!order.userId) return;
  try {
    await syncCustomerMetricsForScope(order.userId, 0);
    if (order.storeId) {
      await syncCustomerMetricsForScope(order.userId, order.storeId);
    }
  } catch (error) {
    console.warn("[orderLifecycle] syncCustomerMetricsForOrder skipped:", error);
  }
}

export async function rebuildCustomerMetrics(storeId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const scopes = await db
    .selectDistinct({
      userId: orders.userId,
      storeId: orders.storeId,
    })
    .from(orders)
    .where(and(
      isNotNull(orders.userId),
      isNotNull(orders.storeId),
      storeId ? eq(orders.storeId, storeId) : undefined,
    ));

  const globalUsers = new Set<number>();
  let rebuilt = 0;

  for (const scope of scopes) {
    if (!scope.userId || !scope.storeId) continue;
    if (!globalUsers.has(scope.userId)) {
      await syncCustomerMetricsForScope(scope.userId, 0);
      globalUsers.add(scope.userId);
      rebuilt += 1;
    }
    await syncCustomerMetricsForScope(scope.userId, scope.storeId);
    rebuilt += 1;
  }

  return rebuilt;
}

export async function bootstrapOrderLifecycle(
  orderId: number,
  opts?: {
    skipPrediction?: boolean;
    skipCustomerMetrics?: boolean;
  }
) {
  try {
    const db = await getDb();
    if (!db) return;
    const order = await getOrderById(orderId);
    if (!order) return;

    const existingCreatedLog = await db
      .select({ id: orderStageLogs.id })
      .from(orderStageLogs)
      .where(and(eq(orderStageLogs.orderId, orderId), eq(orderStageLogs.stage, "created")))
      .limit(1);

    if (existingCreatedLog.length === 0) {
      await db.insert(orderStageLogs).values({
        orderId,
        previousStatus: null,
        nextStatus: order.status,
        stage: "created",
        source: "system",
        metadata: JSON.stringify({ serviceType: order.serviceType }),
      });
    }

    if (!opts?.skipPrediction) {
      const prediction = await computePredictionWindow(order);
      if (prediction) {
        const now = new Date();
        const readyAt = new Date(now.getTime() + prediction.minMinutes * 60_000);
        const deliveredAt = new Date(now.getTime() + prediction.maxMinutes * 60_000);
        await db
          .insert(deliveryPredictions)
          .values({
            orderId,
            kind: order.serviceType === "delivery" ? "delivery" : order.serviceType === "pickup" ? "pickup" : "dine_in",
            predictionLabel: prediction.predictionLabel,
            minMinutes: prediction.minMinutes,
            maxMinutes: prediction.maxMinutes,
            prepBaseMinutes: prediction.prepBaseMinutes,
            deliveryBaseMinutes: prediction.deliveryBaseMinutes,
            queuePressure: prediction.queuePressure,
            neighborhood: order.deliveryNeighborhood ?? null,
            method: "heuristic",
            computedAt: now,
          })
          .onConflictDoUpdate({
            target: deliveryPredictions.orderId,
            set: {
              predictionLabel: prediction.predictionLabel,
              minMinutes: prediction.minMinutes,
              maxMinutes: prediction.maxMinutes,
              prepBaseMinutes: prediction.prepBaseMinutes,
              deliveryBaseMinutes: prediction.deliveryBaseMinutes,
              queuePressure: prediction.queuePressure,
              neighborhood: order.deliveryNeighborhood ?? null,
              computedAt: now,
            },
          });

        await db
          .update(orders)
          .set({
            predictionLabel: prediction.predictionLabel,
            predictedReadyAt: readyAt,
            predictedDeliveredAt: deliveredAt,
          })
          .where(eq(orders.id, orderId));
      }
    }

    if (!opts?.skipCustomerMetrics) {
      await syncCustomerMetricsForOrder(order);
    }
  } catch (error) {
    console.warn("[orderLifecycle] bootstrapOrderLifecycle skipped:", error);
  }
}

export async function applyOrderStatusLifecycle(
  orderId: number,
  previousStatus: OrderStatus,
  nextStatus: OrderStatus,
  opts?: {
    actorUserId?: number | null;
    source?: typeof orderStageLogs.$inferInsert["source"];
    notes?: string | null;
    skipPrediction?: boolean;
    skipCustomerMetrics?: boolean;
    skipStageLog?: boolean;
    skipStatusTimestamp?: boolean;
  }
) {
  try {
    const db = await getDb();
    if (!db) return;
    const order = await getOrderById(orderId);
    if (!order) return;

    const now = new Date();
    if (!opts?.skipStatusTimestamp) {
      const patch: Partial<typeof orders.$inferInsert> = {};
      if (nextStatus === "confirmed") patch.confirmedAt = now;
      if (nextStatus === "preparing") patch.preparingAt = now;
      if (nextStatus === "out_for_delivery") patch.outForDeliveryAt = now;
      if (nextStatus === "delivered") patch.deliveredAt = now;
      if (nextStatus === "cancelled") patch.cancelledAt = now;

      if (Object.keys(patch).length > 0) {
        await db.update(orders).set(patch).where(eq(orders.id, orderId));
      }
    }

    if (!opts?.skipStageLog) {
      await db.insert(orderStageLogs).values({
        orderId,
        previousStatus,
        nextStatus,
        stage: STAGE_BY_STATUS[nextStatus],
        source: opts?.source ?? "system",
        changedByUserId: opts?.actorUserId ?? null,
        notes: opts?.notes ?? null,
        metadata: JSON.stringify({ previousStatus, nextStatus }),
      });
    }

    const freshOrder = await getOrderById(orderId);
    if (freshOrder) {
      if (nextStatus === "confirmed" || (nextStatus === "preparing" && previousStatus === "pending")) {
        await consumeInventoryForOrder(orderId);
      }
      if (nextStatus === "cancelled") {
        await reverseInventoryForOrder(orderId);
      }
      await recordProductivityEvent(freshOrder, nextStatus, now);
      await bootstrapOrderLifecycle(orderId, {
        skipPrediction: opts?.skipPrediction,
        skipCustomerMetrics: opts?.skipCustomerMetrics,
      });
      if (!opts?.skipCustomerMetrics) {
        await syncCustomerMetricsForOrder(freshOrder);
      }
      if (nextStatus === "delivered") {
        await scheduleReviewCashbackNotification(freshOrder);
      }
    }
  } catch (error) {
    console.warn("[orderLifecycle] applyOrderStatusLifecycle skipped:", error);
  }
}

export async function completeStaleOutForDeliveryOrders(olderThanHours = 12): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const candidates = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(
      eq(orders.status, "out_for_delivery"),
      isNotNull(orders.outForDeliveryAt),
      lte(orders.outForDeliveryAt, cutoff),
    ));

  const completed: number[] = [];
  for (const candidate of candidates) {
    const result = await updateOrderStatusGuarded(
      candidate.id,
      "delivered",
      ["out_for_delivery"],
      {
        source: "automation",
        notes: `Conclusão automática após ${olderThanHours}h em rota`,
      },
    );
    if (!result.ok || !result.previous) continue;

    await applyOrderStatusLifecycle(candidate.id, result.previous, "delivered", {
      source: "automation",
      notes: `Conclusão automática após ${olderThanHours}h em rota`,
      skipStageLog: true,
      skipStatusTimestamp: true,
    });
    completed.push(candidate.id);
  }

  return completed;
}
