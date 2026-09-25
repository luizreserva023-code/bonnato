import { and, asc, desc, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";

import {
  analyticsEvents,
  categories,
  orderAttributions,
  orderItems,
  orders,
  products,
  stores,
} from "../../drizzle/schema.ts";
import { getDb } from "../db.ts";
import {
  buildFunnelSeries,
  buildSequentialFunnelCounts,
  calculateAverageTicket,
  safePercentage,
} from "../../shared/analyticsMetrics.ts";

export const ANALYTICS_TRACKING_STARTED_AT = new Date("2026-09-19T00:00:00-03:00");

export type AnalyticsEventType = typeof analyticsEvents.$inferInsert["eventType"];
type AnalyticsDeviceType = typeof analyticsEvents.$inferInsert["deviceType"];

const PII_METADATA_KEYS = new Set([
  "cpf", "cnpj", "phone", "telefone", "email", "address", "endereco", "cep",
  "password", "senha", "token", "authorization", "customername", "name",
]);

function safeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(metadata as Record<string, unknown>)) {
    const key = rawKey.trim().slice(0, 64);
    if (!key || PII_METADATA_KEYS.has(key.toLowerCase())) continue;
    if (typeof rawValue === "string") clean[key] = rawValue.slice(0, 240);
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) clean[key] = rawValue;
    else if (typeof rawValue === "boolean" || rawValue === null) clean[key] = rawValue;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

export async function recordAnalyticsEvent(input: {
  eventId: string;
  eventType: AnalyticsEventType;
  occurredAt?: Date;
  storeId: number;
  sessionId: string;
  visitorId?: string | null;
  customerId?: number | null;
  productId?: number | null;
  categoryId?: number | null;
  orderId?: number | null;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  deviceType?: AnalyticsDeviceType;
  metadata?: unknown;
}): Promise<{ recorded: boolean }> {
  const db = await getDb();
  if (!db) return { recorded: false };

  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, input.storeId), eq(stores.active, true)))
    .limit(1);
  if (!store) return { recorded: false };

  if (input.productId) {
    const [product] = await db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId)))
      .limit(1);
    if (!product) return { recorded: false };
    if (input.categoryId && product.categoryId !== input.categoryId) return { recorded: false };
  }

  if (input.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.storeId, input.storeId)))
      .limit(1);
    if (!category) return { recorded: false };
  }

  if (input.orderId) {
    const [order] = await db
      .select({ id: orders.id, storeId: orders.storeId })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);
    if (!order || order.storeId !== input.storeId) return { recorded: false };
  }

  const inserted = await db
    .insert(analyticsEvents)
    .values({
      eventId: input.eventId,
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date(),
      storeId: input.storeId,
      sessionId: input.sessionId,
      visitorId: input.visitorId ?? null,
      customerId: input.customerId ?? null,
      productId: input.productId ?? null,
      categoryId: input.categoryId ?? null,
      orderId: input.orderId ?? null,
      source: input.source?.slice(0, 80) ?? null,
      utmSource: input.utmSource?.slice(0, 160) ?? null,
      utmMedium: input.utmMedium?.slice(0, 160) ?? null,
      utmCampaign: input.utmCampaign?.slice(0, 200) ?? null,
      utmContent: input.utmContent?.slice(0, 200) ?? null,
      utmTerm: input.utmTerm?.slice(0, 200) ?? null,
      deviceType: input.deviceType ?? "unknown",
      metadata: safeMetadata(input.metadata),
    })
    .onConflictDoNothing({ target: analyticsEvents.eventId })
    .returning({ id: analyticsEvents.id });

  return { recorded: inserted.length > 0 };
}

function storeEventWhere(input: { storeId?: number; startDate: Date; endDate: Date; eventType?: AnalyticsEventType }) {
  return and(
    input.storeId ? eq(analyticsEvents.storeId, input.storeId) : undefined,
    gte(analyticsEvents.occurredAt, input.startDate),
    lt(analyticsEvents.occurredAt, input.endDate),
    input.eventType ? eq(analyticsEvents.eventType, input.eventType) : undefined,
  );
}

function orderPeriodWhere(input: { storeId?: number; startDate: Date; endDate: Date; includeCancelled?: boolean }) {
  return and(
    input.storeId ? eq(orders.storeId, input.storeId) : undefined,
    gte(orders.createdAt, input.startDate),
    lt(orders.createdAt, input.endDate),
    input.includeCancelled ? undefined : ne(orders.status, "cancelled"),
  );
}

export async function getMenuFunnel(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) return [];

  const types: AnalyticsEventType[] = [
    "MENU_VIEW", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_STARTED", "ORDER_CREATED",
  ];

  // Um funil precisa representar progressão real da MESMA sessão. Contar
  // sessões distintas de cada evento isoladamente permite números impossíveis
  // (ex.: mais checkouts do que visitas ao cardápio). Buscamos os eventos em
  // ordem cronológica e só avançamos uma sessão quando ela cumpre a próxima
  // etapa esperada.
  const rows = await db
    .select({
      id: analyticsEvents.id,
      storeId: analyticsEvents.storeId,
      sessionId: analyticsEvents.sessionId,
      eventType: analyticsEvents.eventType,
      occurredAt: analyticsEvents.occurredAt,
    })
    .from(analyticsEvents)
    .where(and(
      input.storeId ? eq(analyticsEvents.storeId, input.storeId) : undefined,
      gte(analyticsEvents.occurredAt, input.startDate),
      lt(analyticsEvents.occurredAt, input.endDate),
      inArray(analyticsEvents.eventType, types),
    ))
    .orderBy(
      asc(analyticsEvents.storeId),
      asc(analyticsEvents.sessionId),
      asc(analyticsEvents.occurredAt),
      asc(analyticsEvents.id),
    );

  const counts = buildSequentialFunnelCounts(
    types,
    rows.map((row) => ({
      sessionKey: `${row.storeId}:${row.sessionId}`,
      eventType: row.eventType as AnalyticsEventType,
    })),
  );
  return buildFunnelSeries(types, counts);
}

export async function getSalesOverview(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) {
    return { totalOrders: 0, revenue: 0, averageTicket: 0, newCustomers: 0, completedOrders: 0, cancelledOrders: 0 };
  }

  const [summary] = await db
    .select({
      totalOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} <> 'cancelled')`,
      revenue: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} <> 'cancelled' THEN ${orders.total} ELSE 0 END), 0)`,
      completedOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'delivered')`,
      cancelledOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'cancelled')`,
    })
    .from(orders)
    .where(and(
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
      gte(orders.createdAt, input.startDate),
      lt(orders.createdAt, input.endDate),
    ));

  const firstOrderSubquery = db
    .select({
      userId: orders.userId,
      firstDeliveredAt: sql<Date>`MIN(${orders.createdAt})`.as("first_delivered_at"),
    })
    .from(orders)
    .where(and(
      eq(orders.status, "delivered"),
      isNotNull(orders.userId),
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
    ))
    .groupBy(orders.userId)
    .as("first_orders");

  const [newCustomerRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(firstOrderSubquery)
    .where(and(
      gte(firstOrderSubquery.firstDeliveredAt, input.startDate),
      lt(firstOrderSubquery.firstDeliveredAt, input.endDate),
    ));

  const totalOrders = Number(summary?.totalOrders ?? 0);
  const revenue = Number(summary?.revenue ?? 0);

  return {
    totalOrders,
    revenue,
    averageTicket: calculateAverageTicket(revenue, totalOrders),
    newCustomers: Number(newCustomerRow?.count ?? 0),
    completedOrders: Number(summary?.completedOrders ?? 0),
    cancelledOrders: Number(summary?.cancelledOrders ?? 0),
  };
}

export async function getProductPerformance(input: {
  storeId?: number;
  startDate: Date;
  endDate: Date;
  search?: string;
  categoryId?: number;
  productId?: number;
  status?: "all" | "active" | "paused";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const viewRows = await db
    .select({
      productId: analyticsEvents.productId,
      sessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
    })
    .from(analyticsEvents)
    .where(and(
      input.storeId ? eq(analyticsEvents.storeId, input.storeId) : undefined,
      input.productId ? eq(analyticsEvents.productId, input.productId) : undefined,
      eq(analyticsEvents.eventType, "PRODUCT_VIEW"),
      gte(analyticsEvents.occurredAt, input.startDate),
      lt(analyticsEvents.occurredAt, input.endDate),
      isNotNull(analyticsEvents.productId),
    ))
    .groupBy(analyticsEvents.productId);

  const cartRows = await db
    .select({
      productId: analyticsEvents.productId,
      sessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
    })
    .from(analyticsEvents)
    .where(and(
      input.storeId ? eq(analyticsEvents.storeId, input.storeId) : undefined,
      input.productId ? eq(analyticsEvents.productId, input.productId) : undefined,
      eq(analyticsEvents.eventType, "ADD_TO_CART"),
      gte(analyticsEvents.occurredAt, input.startDate),
      lt(analyticsEvents.occurredAt, input.endDate),
      isNotNull(analyticsEvents.productId),
    ))
    .groupBy(analyticsEvents.productId);

  const checkoutRows = await db
    .select({
      productId: analyticsEvents.productId,
      sessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
    })
    .from(analyticsEvents)
    .where(and(
      input.storeId ? eq(analyticsEvents.storeId, input.storeId) : undefined,
      input.productId ? eq(analyticsEvents.productId, input.productId) : undefined,
      eq(analyticsEvents.eventType, "CHECKOUT_STARTED"),
      gte(analyticsEvents.occurredAt, input.startDate),
      lt(analyticsEvents.occurredAt, input.endDate),
      isNotNull(analyticsEvents.productId),
    ))
    .groupBy(analyticsEvents.productId);

  const salesRows = await db
    .select({
      productId: orderItems.productId,
      quantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${orderItems.subtotal}), 0)`,
      buyerSessions: sql<number>`COUNT(DISTINCT ${orderAttributions.sessionId}) FILTER (WHERE ${orderAttributions.sessionId} IS NOT NULL)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(orderAttributions, eq(orderAttributions.orderId, orders.id))
    .where(and(
      orderPeriodWhere(input),
      input.productId ? eq(orderItems.productId, input.productId) : undefined,
    ))
    .groupBy(orderItems.productId);

  const viewMap = new Map(viewRows.map((row) => [row.productId, Number(row.sessions ?? 0)]));
  const cartMap = new Map(cartRows.map((row) => [row.productId, Number(row.sessions ?? 0)]));
  const checkoutMap = new Map(checkoutRows.map((row) => [row.productId, Number(row.sessions ?? 0)]));
  const salesMap = new Map(salesRows.map((row) => [row.productId, {
    quantity: Number(row.quantity ?? 0),
    revenue: Number(row.revenue ?? 0),
    buyerSessions: Number(row.buyerSessions ?? 0),
  }]));

  const productRows = await db
    .select({
      id: products.id,
      storeId: products.storeId,
      categoryId: products.categoryId,
      name: products.name,
      imageUrl: products.imageUrl,
      description: products.description,
      shortDescription: products.shortDescription,
      price: products.price,
      active: products.active,
      editorialStatus: products.editorialStatus,
      productType: products.productType,
      version: products.version,
      categoryName: categories.name,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .innerJoin(categories, and(eq(categories.id, products.categoryId), eq(categories.storeId, products.storeId)))
    .where(and(
      input.storeId ? eq(products.storeId, input.storeId) : undefined,
      input.categoryId ? eq(products.categoryId, input.categoryId) : undefined,
      input.productId ? eq(products.id, input.productId) : undefined,
      input.status === "active"
        ? eq(products.active, true)
        : input.status === "paused"
          ? eq(products.active, false)
          : undefined,
      input.search
        ? sql`LOWER(${products.name}) LIKE ${`%${input.search.toLowerCase()}%`}`
        : undefined,
    ))
    .orderBy(asc(products.sortOrder), asc(products.name));

  return productRows
    .map((product) => {
      const views = viewMap.get(product.id) ?? 0;
      const carts = cartMap.get(product.id) ?? 0;
      const checkouts = checkoutMap.get(product.id) ?? 0;
      const sale = salesMap.get(product.id) ?? { quantity: 0, revenue: 0, buyerSessions: 0 };
      return {
        ...product,
        views,
        cartSessions: carts,
        checkoutSessions: checkouts,
        soldQuantity: sale.quantity,
        revenue: sale.revenue,
        buyerSessions: sale.buyerSessions,
        conversionRate: safePercentage(sale.buyerSessions, views),
        cartRate: safePercentage(carts, views),
        checkoutRate: safePercentage(checkouts, views),
        cartPurchaseRate: safePercentage(sale.buyerSessions, carts),
        checkoutConversionRate: safePercentage(sale.buyerSessions, checkouts),
      };
    })
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, Math.max(1, Math.min(input.limit ?? 200, 500)));
}

export async function getCustomerOverview(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) return { uniqueCustomers: 0, newCustomers: 0, recurringCustomers: 0, repurchaseRate: 0, ordersPerCustomer: 0, averageRevenuePerCustomer: 0 };

  // Customer/retention metrics use completed (delivered) orders only.
  // "New customer" = first delivered order in the selected scope occurred
  // inside the period. "Recurring" = delivered in the period but had a
  // delivered order before the period.
  const rows = await db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
      eq(orders.status, "delivered"),
      gte(orders.createdAt, input.startDate),
      lt(orders.createdAt, input.endDate),
      isNotNull(orders.userId),
    ))
    .groupBy(orders.userId);

  const uniqueCustomers = rows.length;
  const totalOrders = rows.reduce((sum, row) => sum + Number(row.orderCount ?? 0), 0);
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);

  const firstOrderSubquery = db
    .select({
      userId: orders.userId,
      firstDeliveredAt: sql<Date>`MIN(${orders.createdAt})`.as("first_delivered_at"),
    })
    .from(orders)
    .where(and(
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
      eq(orders.status, "delivered"),
      isNotNull(orders.userId),
    ))
    .groupBy(orders.userId)
    .as("customer_first_delivered");

  const [newRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(firstOrderSubquery)
    .where(and(
      gte(firstOrderSubquery.firstDeliveredAt, input.startDate),
      lt(firstOrderSubquery.firstDeliveredAt, input.endDate),
    ));

  const newCustomers = Math.min(uniqueCustomers, Number(newRow?.count ?? 0));
  const recurringCustomers = Math.max(0, uniqueCustomers - newCustomers);

  return {
    uniqueCustomers,
    newCustomers,
    recurringCustomers,
    repurchaseRate: uniqueCustomers > 0 ? (recurringCustomers / uniqueCustomers) * 100 : 0,
    ordersPerCustomer: uniqueCustomers > 0 ? totalOrders / uniqueCustomers : 0,
    averageRevenuePerCustomer: uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0,
  };
}

export async function getMarketingOverview(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) return [];

  const sessionRows = await db
    .select({
      source: sql<string>`COALESCE(NULLIF(${analyticsEvents.utmSource}, ''), 'direto')`,
      sessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
    })
    .from(analyticsEvents)
    .where(and(
      input.storeId ? eq(analyticsEvents.storeId, input.storeId) : undefined,
      gte(analyticsEvents.occurredAt, input.startDate),
      lt(analyticsEvents.occurredAt, input.endDate),
    ))
    .groupBy(sql`COALESCE(NULLIF(${analyticsEvents.utmSource}, ''), 'direto')`);

  const orderRows = await db
    .select({
      source: sql<string>`COALESCE(NULLIF(${orderAttributions.utmSource}, ''), 'direto')`,
      orders: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orderAttributions)
    .innerJoin(orders, eq(orders.id, orderAttributions.orderId))
    .where(and(
      input.storeId ? eq(orderAttributions.storeId, input.storeId) : undefined,
      gte(orders.createdAt, input.startDate),
      lt(orders.createdAt, input.endDate),
      ne(orders.status, "cancelled"),
    ))
    .groupBy(sql`COALESCE(NULLIF(${orderAttributions.utmSource}, ''), 'direto')`);

  const sessionMap = new Map(sessionRows.map((row) => [String(row.source || "direto"), Number(row.sessions ?? 0)]));
  const orderMap = new Map(orderRows.map((row) => [String(row.source || "direto"), {
    orders: Number(row.orders ?? 0),
    revenue: Number(row.revenue ?? 0),
  }]));

  const sources = new Set([...sessionMap.keys(), ...orderMap.keys()]);
  return Array.from(sources)
    .map((source) => {
      const sessions = sessionMap.get(source) ?? 0;
      const orderData = orderMap.get(source) ?? { orders: 0, revenue: 0 };
      return {
        source,
        sessions,
        orders: orderData.orders,
        revenue: orderData.revenue,
        conversionRate: sessions > 0 ? (orderData.orders / sessions) * 100 : 0,
      };
    })
    .sort((a, b) => b.orders - a.orders || b.sessions - a.sessions);
}



export async function getProductTimeSeries(input: {
  storeId: number;
  productId: number;
  startDate: Date;
  endDate: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const eventDay = sql<string>`TO_CHAR(${analyticsEvents.occurredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`;
  const orderDay = sql<string>`TO_CHAR(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`;

  const [eventRows, salesRows] = await Promise.all([
    db
      .select({
        date: eventDay,
        views: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId}) FILTER (WHERE ${analyticsEvents.eventType} = 'PRODUCT_VIEW')`,
        carts: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId}) FILTER (WHERE ${analyticsEvents.eventType} = 'ADD_TO_CART')`,
        checkouts: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId}) FILTER (WHERE ${analyticsEvents.eventType} = 'CHECKOUT_STARTED')`,
      })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.storeId, input.storeId),
        eq(analyticsEvents.productId, input.productId),
        gte(analyticsEvents.occurredAt, input.startDate),
        lt(analyticsEvents.occurredAt, input.endDate),
        inArray(analyticsEvents.eventType, ["PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_STARTED"]),
      ))
      .groupBy(eventDay)
      .orderBy(asc(eventDay)),
    db
      .select({
        date: orderDay,
        orders: sql<number>`COUNT(DISTINCT ${orders.id})`,
        quantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
        revenue: sql<number>`COALESCE(SUM(${orderItems.subtotal}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(
        eq(orders.storeId, input.storeId),
        eq(orderItems.productId, input.productId),
        gte(orders.createdAt, input.startDate),
        lt(orders.createdAt, input.endDate),
        ne(orders.status, "cancelled"),
      ))
      .groupBy(orderDay)
      .orderBy(asc(orderDay)),
  ]);

  const byDate = new Map<string, {
    date: string;
    views: number;
    carts: number;
    checkouts: number;
    orders: number;
    quantity: number;
    revenue: number;
  }>();

  for (const row of eventRows) {
    const date = String(row.date);
    byDate.set(date, {
      date,
      views: Number(row.views ?? 0),
      carts: Number(row.carts ?? 0),
      checkouts: Number(row.checkouts ?? 0),
      orders: 0,
      quantity: 0,
      revenue: 0,
    });
  }

  for (const row of salesRows) {
    const date = String(row.date);
    const current = byDate.get(date) ?? { date, views: 0, carts: 0, checkouts: 0, orders: 0, quantity: 0, revenue: 0 };
    current.orders = Number(row.orders ?? 0);
    current.quantity = Number(row.quantity ?? 0);
    current.revenue = Number(row.revenue ?? 0);
    byDate.set(date, current);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSalesTimeSeries(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) return [];

  const localDay = sql<string>`TO_CHAR(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date: localDay,
      orders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} <> 'cancelled')`,
      revenue: sql<number>`COALESCE(SUM(${orders.total}) FILTER (WHERE ${orders.status} <> 'cancelled'), 0)`,
      averageTicket: sql<number>`COALESCE(AVG(${orders.total}) FILTER (WHERE ${orders.status} <> 'cancelled'), 0)`,
      cancelledOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'cancelled')`,
    })
    .from(orders)
    .where(and(
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
      gte(orders.createdAt, input.startDate),
      lt(orders.createdAt, input.endDate),
    ))
    .groupBy(localDay)
    .orderBy(asc(localDay));

  return rows.map((row) => ({
    date: String(row.date),
    orders: Number(row.orders ?? 0),
    revenue: Number(row.revenue ?? 0),
    averageTicket: Number(row.averageTicket ?? 0),
    cancelledOrders: Number(row.cancelledOrders ?? 0),
  }));
}

export async function getSalesDistribution(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) return { byHour: [], byWeekday: [] };

  const localTimestamp = sql`(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`;
  const localHour = sql<number>`EXTRACT(HOUR FROM ${localTimestamp})::int`;
  const localWeekday = sql<number>`EXTRACT(ISODOW FROM ${localTimestamp})::int`;
  const commonWhere = and(
    input.storeId ? eq(orders.storeId, input.storeId) : undefined,
    gte(orders.createdAt, input.startDate),
    lt(orders.createdAt, input.endDate),
    ne(orders.status, "cancelled"),
  );

  const [hours, weekdays] = await Promise.all([
    db
      .select({
        hour: localHour,
        orders: sql<number>`COUNT(*)`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        weekend: sql<boolean>`CASE WHEN ${localWeekday} IN (6, 7) THEN TRUE ELSE FALSE END`,
      })
      .from(orders)
      .where(commonWhere)
      .groupBy(localHour, localWeekday)
      .orderBy(asc(localHour)),
    db
      .select({
        weekday: localWeekday,
        orders: sql<number>`COUNT(*)`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(orders)
      .where(commonWhere)
      .groupBy(localWeekday)
      .orderBy(asc(localWeekday)),
  ]);

  const hourMap = new Map<string, { hour: number; weekend: boolean; orders: number; revenue: number }>();
  for (const row of hours) {
    const key = `${Number(row.hour)}:${Boolean(row.weekend) ? "weekend" : "weekday"}`;
    const current = hourMap.get(key) ?? { hour: Number(row.hour), weekend: Boolean(row.weekend), orders: 0, revenue: 0 };
    current.orders += Number(row.orders ?? 0);
    current.revenue += Number(row.revenue ?? 0);
    hourMap.set(key, current);
  }

  return {
    byHour: Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour || Number(a.weekend) - Number(b.weekend)),
    byWeekday: weekdays.map((row) => ({
      weekday: Number(row.weekday),
      orders: Number(row.orders ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
  };
}

export async function getOperationsOverview(input: { storeId?: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) {
    return {
      totalOrders: 0,
      cancelledOrders: 0,
      completedOrders: 0,
      dispatchedOrders: 0,
      cancellationRate: 0,
      averageConfirmationMinutes: null,
      averagePreparationMinutes: null,
      averageWaitingDeliveryMinutes: null,
      averageDispatchMinutes: null,
      averageTotalMinutes: null,
      delayedOrders: 0,
      cancellationReasons: [],
      availabilityRate: null,
    };
  }

  const [summary] = await db
    .select({
      totalOrders: sql<number>`COUNT(*)`,
      cancelledOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'cancelled')`,
      completedOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'delivered')`,
      dispatchedOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.outForDeliveryAt} IS NOT NULL)`,
      averageConfirmationMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${orders.confirmedAt} - ${orders.createdAt})) / 60) FILTER (WHERE ${orders.confirmedAt} IS NOT NULL)`,
      averagePreparationMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${orders.readyAt} - ${orders.preparingAt})) / 60) FILTER (WHERE ${orders.readyAt} IS NOT NULL AND ${orders.preparingAt} IS NOT NULL)`,
      averageWaitingDeliveryMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${orders.outForDeliveryAt} - ${orders.readyAt})) / 60) FILTER (WHERE ${orders.outForDeliveryAt} IS NOT NULL AND ${orders.readyAt} IS NOT NULL)`,
      averageDispatchMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${orders.outForDeliveryAt} - ${orders.createdAt})) / 60) FILTER (WHERE ${orders.outForDeliveryAt} IS NOT NULL)`,
      averageTotalMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.createdAt})) / 60) FILTER (WHERE ${orders.deliveredAt} IS NOT NULL)`,
      delayedOrders: sql<number>`COUNT(*) FILTER (
        WHERE ${orders.predictedDeliveredAt} IS NOT NULL
          AND (
            (${orders.deliveredAt} IS NOT NULL AND ${orders.deliveredAt} > ${orders.predictedDeliveredAt})
            OR
            (${orders.deliveredAt} IS NULL AND ${orders.status} NOT IN ('cancelled', 'delivered') AND ${orders.predictedDeliveredAt} < NOW())
          )
      )`,
    })
    .from(orders)
    .where(and(
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
      gte(orders.createdAt, input.startDate),
      lt(orders.createdAt, input.endDate),
    ));

  const reasonRows = await db
    .select({
      code: orders.cancellationReasonCode,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(
      input.storeId ? eq(orders.storeId, input.storeId) : undefined,
      gte(orders.createdAt, input.startDate),
      lt(orders.createdAt, input.endDate),
      eq(orders.status, "cancelled"),
    ))
    .groupBy(orders.cancellationReasonCode)
    .orderBy(desc(sql`COUNT(*)`));

  const totalOrders = Number(summary?.totalOrders ?? 0);
  const cancelledOrders = Number(summary?.cancelledOrders ?? 0);
  const normalizeNullable = (value: unknown) => value == null ? null : Number(value);

  return {
    totalOrders,
    cancelledOrders,
    completedOrders: Number(summary?.completedOrders ?? 0),
    dispatchedOrders: Number(summary?.dispatchedOrders ?? 0),
    cancellationRate: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0,
    averageConfirmationMinutes: normalizeNullable(summary?.averageConfirmationMinutes),
    averagePreparationMinutes: normalizeNullable(summary?.averagePreparationMinutes),
    averageWaitingDeliveryMinutes: normalizeNullable(summary?.averageWaitingDeliveryMinutes),
    averageDispatchMinutes: normalizeNullable(summary?.averageDispatchMinutes),
    averageTotalMinutes: normalizeNullable(summary?.averageTotalMinutes),
    delayedOrders: Number(summary?.delayedOrders ?? 0),
    cancellationReasons: reasonRows.map((row) => ({
      code: row.code ?? null,
      count: Number(row.count ?? 0),
    })),
    // Historical open/closed intervals are not currently stored. Returning
    // null is intentional; the UI must not fabricate availability.
    availabilityRate: null,
  };
}

export async function getAnalyticsDataStart(storeId?: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ firstAt: sql<Date | null>`MIN(${analyticsEvents.occurredAt})` })
    .from(analyticsEvents)
    .where(storeId ? eq(analyticsEvents.storeId, storeId) : undefined);
  return row?.firstAt ?? null;
}
