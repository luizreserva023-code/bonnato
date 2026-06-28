import { and, eq, sql } from "drizzle-orm";

import {
  customerMetrics,
  deliveryPredictions,
  orderStageLogs,
  orders,
  productivityEvents,
  type Order,
} from "../drizzle/schema.ts";
import {
  consumeInventoryForOrder,
  getDb,
  getAllStoreSettings,
  getDeliveryZoneByNeighborhood,
  getOrderById,
  reverseInventoryForOrder,
} from "./db.ts";

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
    let zoneMinutes = 0;
    if (order.deliveryNeighborhood) {
      const zone = await getDeliveryZoneByNeighborhood(order.deliveryNeighborhood);
      zoneMinutes = zone?.estimatedMinutes ?? 0;
    }
    deliveryMinutes = Math.max(baseDeliveryMinutes, zoneMinutes);
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

  const rows = await db.execute(sql`
    SELECT
      MIN(CASE WHEN status = 'delivered' THEN createdAt END) AS firstOrderAt,
      MAX(createdAt) AS lastOrderAt,
      COUNT(*) AS totalOrders,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS deliveredOrders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN CAST(total AS DECIMAL(12,2)) ELSE 0 END), 0) AS totalSpent,
      COALESCE(AVG(CASE WHEN status = 'delivered' THEN CAST(total AS DECIMAL(12,2)) END), 0) AS averageTicket,
      (
        SELECT deliveryNeighborhood
        FROM orders o2
        WHERE o2.userId = ${userId}
          AND (${scopeStoreId} = 0 OR o2.storeId = ${scopeStoreId})
          AND o2.deliveryNeighborhood IS NOT NULL
          AND o2.deliveryNeighborhood <> ''
        GROUP BY o2.deliveryNeighborhood
        ORDER BY COUNT(*) DESC, MAX(o2.createdAt) DESC
        LIMIT 1
      ) AS favoriteNeighborhood,
      (
        SELECT DAYNAME(o3.createdAt)
        FROM orders o3
        WHERE o3.userId = ${userId}
          AND (${scopeStoreId} = 0 OR o3.storeId = ${scopeStoreId})
        GROUP BY DAYNAME(o3.createdAt)
        ORDER BY COUNT(*) DESC, MAX(o3.createdAt) DESC
        LIMIT 1
      ) AS favoriteOrderDay,
      (
        SELECT HOUR(o4.createdAt)
        FROM orders o4
        WHERE o4.userId = ${userId}
          AND (${scopeStoreId} = 0 OR o4.storeId = ${scopeStoreId})
        GROUP BY HOUR(o4.createdAt)
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS favoriteOrderHour,
      (
        SELECT oi.productName
        FROM order_items oi
        INNER JOIN orders o5 ON o5.id = oi.orderId
        WHERE o5.userId = ${userId}
          AND (${scopeStoreId} = 0 OR o5.storeId = ${scopeStoreId})
        GROUP BY oi.productName
        ORDER BY SUM(oi.quantity) DESC, MAX(o5.createdAt) DESC
        LIMIT 1
      ) AS favoriteProductName
    FROM orders
    WHERE userId = ${userId}
      AND (${scopeStoreId} = 0 OR storeId = ${scopeStoreId})
  `);

  const stats = (rows as unknown as [Array<Record<string, unknown>>])[0]?.[0];
  if (!stats) return;

  const totalOrders = Number(stats.totalOrders ?? 0);
  const deliveredOrders = Number(stats.deliveredOrders ?? 0);
  const cancelledOrders = Number(stats.cancelledOrders ?? 0);
  const totalSpent = Number(stats.totalSpent ?? 0);
  const averageTicket = Number(stats.averageTicket ?? 0);
  const firstOrderCount = deliveredOrders > 0 ? 1 : 0;

  const existing = await db
    .select({ id: customerMetrics.id })
    .from(customerMetrics)
    .where(and(eq(customerMetrics.userId, userId), eq(customerMetrics.storeId, scopeStoreId)))
    .limit(1);

  const payload = {
    userId,
    storeId: scopeStoreId,
    firstOrderAt: toDateOrNull(stats.firstOrderAt),
    lastOrderAt: toDateOrNull(stats.lastOrderAt),
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    firstOrderCount,
    totalSpent: totalSpent.toFixed(2),
    averageTicket: averageTicket.toFixed(2),
    favoriteNeighborhood: (stats.favoriteNeighborhood as string | null) ?? null,
    favoriteOrderDay: (stats.favoriteOrderDay as string | null) ?? null,
    favoriteOrderHour: stats.favoriteOrderHour == null ? null : Number(stats.favoriteOrderHour),
    favoriteProductName: (stats.favoriteProductName as string | null) ?? null,
  };

  if (existing.length > 0) {
    await db.update(customerMetrics).set(payload).where(eq(customerMetrics.id, existing[0].id));
    return;
  }

  await db.insert(customerMetrics).values(payload);
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
      actorType: "system",
      valueSeconds: event.valueSeconds,
      metadata: JSON.stringify({ status: nextStatus }),
    }))
  );
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
          .onDuplicateKeyUpdate({
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
  }
) {
  try {
    const db = await getDb();
    if (!db) return;
    const order = await getOrderById(orderId);
    if (!order) return;

    const now = new Date();
    const patch: Partial<typeof orders.$inferInsert> = {};

    if (nextStatus === "confirmed") patch.confirmedAt = now;
    if (nextStatus === "preparing") patch.preparingAt = now;
    if (nextStatus === "out_for_delivery") patch.outForDeliveryAt = now;
    if (nextStatus === "delivered") patch.deliveredAt = now;
    if (nextStatus === "cancelled") patch.cancelledAt = now;

    if (Object.keys(patch).length > 0) {
      await db.update(orders).set(patch).where(eq(orders.id, orderId));
    }

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
    }
  } catch (error) {
    console.warn("[orderLifecycle] applyOrderStatusLifecycle skipped:", error);
  }
}
