import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "./db.ts";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function toSqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function executeRows<T = Record<string, unknown>>(db: Db, query: string): Promise<T[]> {
  const result = await db.execute(sql.raw(query));
  return ((result as unknown as [T[]])[0] ?? []) as T[];
}

export async function ensureRestaurantNetworkSchema() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS distribution_stock (
      id int NOT NULL AUTO_INCREMENT,
      ingredientId int NOT NULL,
      quantity decimal(12,3) NOT NULL DEFAULT '0.000',
      minimumStock decimal(12,3) NOT NULL DEFAULT '0.000',
      averageCost decimal(10,4) NOT NULL DEFAULT '0.0000',
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY distribution_stock_ingredient_uq (ingredientId),
      KEY distribution_stock_low_idx (quantity, minimumStock)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS store_supply_orders (
      id int NOT NULL AUTO_INCREMENT,
      storeId int NOT NULL,
      requestedByUserId int,
      status enum('draft','submitted','in_review','approved','picking','shipped','received','rejected','cancelled') NOT NULL DEFAULT 'draft',
      estimatedCost decimal(12,2) NOT NULL DEFAULT '0.00',
      notes text,
      reviewedByUserId int,
      reviewedAt timestamp NULL,
      shippedAt timestamp NULL,
      receivedAt timestamp NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY store_supply_orders_store_idx (storeId),
      KEY store_supply_orders_status_idx (status),
      KEY store_supply_orders_created_idx (createdAt)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS store_supply_order_items (
      id int NOT NULL AUTO_INCREMENT,
      supplyOrderId int NOT NULL,
      ingredientId int NOT NULL,
      productName varchar(180) NOT NULL,
      unit varchar(20) NOT NULL,
      quantityRequested decimal(12,3) NOT NULL,
      quantityApproved decimal(12,3),
      unitCost decimal(10,4) NOT NULL DEFAULT '0.0000',
      PRIMARY KEY (id),
      KEY supply_items_order_idx (supplyOrderId),
      KEY supply_items_ingredient_idx (ingredientId)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS network_expenses (
      id int NOT NULL AUTO_INCREMENT,
      storeId int,
      category varchar(120) NOT NULL,
      description varchar(255) NOT NULL,
      amount decimal(12,2) NOT NULL,
      paymentMethod varchar(80),
      status enum('pending','paid','cancelled') NOT NULL DEFAULT 'paid',
      expenseDate date NOT NULL,
      receiptUrl text,
      createdByUserId int,
      notes text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY network_expenses_store_date_idx (storeId, expenseDate),
      KEY network_expenses_category_idx (category),
      KEY network_expenses_status_idx (status)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS network_financial_fees (
      id int NOT NULL AUTO_INCREMENT,
      storeId int,
      name varchar(160) NOT NULL,
      category varchar(120) NOT NULL,
      calculationType enum('fixed','percentage') NOT NULL DEFAULT 'fixed',
      rate decimal(10,4) NOT NULL DEFAULT '0.0000',
      amount decimal(12,2) NOT NULL DEFAULT '0.00',
      periodStart date NOT NULL,
      periodEnd date NOT NULL,
      notes text,
      createdByUserId int,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY network_fees_store_period_idx (storeId, periodStart, periodEnd),
      KEY network_fees_category_idx (category)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS network_monthly_closings (
      id int NOT NULL AUTO_INCREMENT,
      storeId int,
      year int NOT NULL,
      month int NOT NULL,
      status enum('open','in_review','closed','reopened') NOT NULL DEFAULT 'open',
      revenueTotal decimal(12,2) NOT NULL DEFAULT '0.00',
      expenseTotal decimal(12,2) NOT NULL DEFAULT '0.00',
      feeTotal decimal(12,2) NOT NULL DEFAULT '0.00',
      supplyCostTotal decimal(12,2) NOT NULL DEFAULT '0.00',
      netResult decimal(12,2) NOT NULL DEFAULT '0.00',
      marginPercent decimal(7,2) NOT NULL DEFAULT '0.00',
      notes text,
      closedByUserId int,
      closedAt timestamp NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY network_closings_store_month_uq (storeId, year, month),
      KEY network_closings_period_idx (year, month),
      KEY network_closings_status_idx (status)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS network_audit_logs (
      id int NOT NULL AUTO_INCREMENT,
      actorUserId int,
      storeId int,
      action varchar(120) NOT NULL,
      entityType varchar(80) NOT NULL,
      entityId int,
      metadata text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY network_audit_actor_idx (actorUserId),
      KEY network_audit_store_idx (storeId),
      KEY network_audit_action_idx (action),
      KEY network_audit_created_idx (createdAt)
    )
  `));
}

async function audit(input: {
  actorUserId?: number | null;
  storeId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await ensureRestaurantNetworkSchema();
  await db.execute(sql.raw(`
    INSERT INTO network_audit_logs (actorUserId, storeId, action, entityType, entityId, metadata)
    VALUES (${input.actorUserId ?? "NULL"}, ${input.storeId ?? "NULL"}, ${JSON.stringify(input.action)}, ${JSON.stringify(input.entityType)}, ${input.entityId ?? "NULL"}, ${JSON.stringify(JSON.stringify(input.metadata ?? {}))})
  `));
}

export const supplyOrderItemSchema = z.object({
  ingredientId: z.number().int().positive(),
  quantityRequested: z.string().regex(/^\d+(\.\d{1,3})?$/),
  quantityApproved: z.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
});

export const createSupplyOrderSchema = z.object({
  storeId: z.number().int().positive(),
  notes: z.string().max(5000).optional(),
  submit: z.boolean().optional(),
  items: z.array(supplyOrderItemSchema).min(1).max(100),
});

export async function listSupplyOrders(opts: { storeId?: number; status?: string }) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    opts.storeId ? `o.storeId = ${opts.storeId}` : "",
    opts.status ? `o.status = ${JSON.stringify(opts.status)}` : "",
  ].filter(Boolean);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return executeRows(db, `
    SELECT o.*, s.name AS storeName, COUNT(i.id) AS itemCount
    FROM store_supply_orders o
    LEFT JOIN stores s ON s.id = o.storeId
    LEFT JOIN store_supply_order_items i ON i.supplyOrderId = o.id
    ${where}
    GROUP BY o.id
    ORDER BY o.createdAt DESC
    LIMIT 250
  `);
}

export async function getSupplyOrderDetails(id: number) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return null;
  const [order] = await executeRows(db, `
    SELECT o.*, s.name AS storeName
    FROM store_supply_orders o
    LEFT JOIN stores s ON s.id = o.storeId
    WHERE o.id = ${id}
    LIMIT 1
  `);
  if (!order) return null;
  const items = await executeRows(db, `
    SELECT i.*, ing.name AS ingredientName, ing.category, ing.currentStock, ing.minimumStock
    FROM store_supply_order_items i
    LEFT JOIN ingredients ing ON ing.id = i.ingredientId
    WHERE i.supplyOrderId = ${id}
    ORDER BY i.id
  `);
  return { ...order, items };
}

export async function createSupplyOrder(input: z.infer<typeof createSupplyOrderSchema>, actorUserId: number) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const ingredientRows = await executeRows<{ id: number; name: string; unit: string; unitCost: string }>(db, `
    SELECT id, name, unit, unitCost
    FROM ingredients
    WHERE id IN (${input.items.map((item) => item.ingredientId).join(",")})
  `);
  const ingredientById = new Map(ingredientRows.map((row) => [Number(row.id), row]));
  const estimatedCost = input.items.reduce((sum, item) => {
    const ingredient = ingredientById.get(item.ingredientId);
    return sum + Number(item.quantityRequested) * money(ingredient?.unitCost);
  }, 0);
  const status = input.submit ? "submitted" : "draft";
  const result = await db.execute(sql.raw(`
    INSERT INTO store_supply_orders (storeId, requestedByUserId, status, estimatedCost, notes)
    VALUES (${input.storeId}, ${actorUserId}, '${status}', '${estimatedCost.toFixed(2)}', ${JSON.stringify(input.notes ?? null)})
  `));
  const orderId = Number(((result as unknown as [{ insertId?: number }])[0]?.insertId) ?? 0);

  for (const item of input.items) {
    const ingredient = ingredientById.get(item.ingredientId);
    if (!ingredient) continue;
    const approved = item.quantityApproved ?? item.quantityRequested;
    await db.execute(sql.raw(`
      INSERT INTO store_supply_order_items
        (supplyOrderId, ingredientId, productName, unit, quantityRequested, quantityApproved, unitCost)
      VALUES
        (${orderId}, ${item.ingredientId}, ${JSON.stringify(ingredient.name)}, ${JSON.stringify(ingredient.unit)}, '${item.quantityRequested}', '${approved}', '${money(ingredient.unitCost).toFixed(4)}')
    `));
  }
  await audit({ actorUserId, storeId: input.storeId, action: "supply_order.create", entityType: "store_supply_order", entityId: orderId, metadata: { status } });
  return { id: orderId };
}

export const updateSupplyOrderStatusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["submitted", "in_review", "approved", "picking", "shipped", "received", "rejected", "cancelled"]),
  notes: z.string().max(5000).optional(),
});

export async function updateSupplyOrderStatus(input: z.infer<typeof updateSupplyOrderStatusSchema>, actorUserId: number) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const details = await getSupplyOrderDetails(input.id);
  if (!details) throw new Error("Pedido ao CD nao encontrado");
  const timestampColumn =
    input.status === "shipped" ? ", shippedAt = CURRENT_TIMESTAMP" :
    input.status === "received" ? ", receivedAt = CURRENT_TIMESTAMP" :
    ["approved", "rejected", "cancelled", "in_review"].includes(input.status) ? ", reviewedAt = CURRENT_TIMESTAMP" :
    "";

  await db.execute(sql.raw(`
    UPDATE store_supply_orders
    SET status = '${input.status}', reviewedByUserId = ${actorUserId}, notes = COALESCE(${JSON.stringify(input.notes ?? null)}, notes) ${timestampColumn}
    WHERE id = ${input.id}
  `));

  if (input.status === "received") {
    for (const item of (details as any).items ?? []) {
      const quantity = Number(item.quantityApproved ?? item.quantityRequested ?? 0);
      if (quantity <= 0) continue;
      await db.execute(sql.raw(`
        UPDATE ingredients
        SET currentStock = CAST(currentStock AS DECIMAL(12,3)) + ${quantity}
        WHERE id = ${Number(item.ingredientId)}
      `));
      await db.execute(sql.raw(`
        INSERT INTO inventory_movements
          (ingredientId, storeId, movementType, quantityDelta, previousStock, nextStock, reason, performedByUserId)
        SELECT id, ${Number((details as any).storeId)}, 'entry', '${quantity.toFixed(3)}',
          CAST(currentStock AS DECIMAL(12,3)) - ${quantity},
          currentStock,
          ${JSON.stringify(`Recebimento do pedido ao CD #${input.id}`)},
          ${actorUserId}
        FROM ingredients
        WHERE id = ${Number(item.ingredientId)}
      `));
    }
  }

  await audit({ actorUserId, storeId: Number((details as any).storeId), action: `supply_order.${input.status}`, entityType: "store_supply_order", entityId: input.id, metadata: { notes: input.notes } });
  return { ok: true };
}

export const createExpenseSchema = z.object({
  storeId: z.number().int().positive().optional(),
  category: z.string().min(1).max(120),
  description: z.string().min(1).max(255),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  paymentMethod: z.string().max(80).optional(),
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
  expenseDate: z.date(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(5000).optional(),
});

export async function createExpense(input: z.infer<typeof createExpenseSchema>, actorUserId: number, scopedStoreId?: number) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId ?? input.storeId ?? null;
  const result = await db.execute(sql.raw(`
    INSERT INTO network_expenses
      (storeId, category, description, amount, paymentMethod, status, expenseDate, receiptUrl, createdByUserId, notes)
    VALUES
      (${storeId ?? "NULL"}, ${JSON.stringify(input.category)}, ${JSON.stringify(input.description)}, '${input.amount}', ${JSON.stringify(input.paymentMethod ?? null)}, '${input.status ?? "paid"}', '${toSqlDate(input.expenseDate).slice(0, 10)}', ${JSON.stringify(input.receiptUrl ?? null)}, ${actorUserId}, ${JSON.stringify(input.notes ?? null)})
  `));
  const id = Number(((result as unknown as [{ insertId?: number }])[0]?.insertId) ?? 0);
  await audit({ actorUserId, storeId, action: "expense.create", entityType: "network_expense", entityId: id, metadata: input });
  return { id };
}

export const createFinancialFeeSchema = z.object({
  storeId: z.number().int().positive().optional(),
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(120),
  calculationType: z.enum(["fixed", "percentage"]).default("fixed"),
  rate: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  periodStart: z.date(),
  periodEnd: z.date(),
  notes: z.string().max(5000).optional(),
});

export async function createFinancialFee(input: z.infer<typeof createFinancialFeeSchema>, actorUserId: number, scopedStoreId?: number) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId ?? input.storeId ?? null;
  const result = await db.execute(sql.raw(`
    INSERT INTO network_financial_fees
      (storeId, name, category, calculationType, rate, amount, periodStart, periodEnd, notes, createdByUserId)
    VALUES
      (${storeId ?? "NULL"}, ${JSON.stringify(input.name)}, ${JSON.stringify(input.category)}, '${input.calculationType}', '${input.rate ?? "0"}', '${input.amount}', '${toSqlDate(input.periodStart).slice(0, 10)}', '${toSqlDate(input.periodEnd).slice(0, 10)}', ${JSON.stringify(input.notes ?? null)}, ${actorUserId})
  `));
  const id = Number(((result as unknown as [{ insertId?: number }])[0]?.insertId) ?? 0);
  await audit({ actorUserId, storeId, action: "fee.create", entityType: "network_financial_fee", entityId: id, metadata: input });
  return { id };
}

export async function getFinancialOverview(opts: { storeId?: number; startDate: Date; endDate: Date }) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return { totals: {}, expenses: [], fees: [], supplyOrders: [], storeRanking: [] };
  const start = toSqlDate(opts.startDate);
  const end = toSqlDate(opts.endDate);
  const storeFilter = opts.storeId ? `AND storeId = ${opts.storeId}` : "";
  const nullableStoreFilter = opts.storeId ? `AND (storeId = ${opts.storeId} OR storeId IS NULL)` : "";

  const [revenue] = await executeRows<{ total: string; count: number }>(db, `
    SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
    FROM orders
    WHERE createdAt BETWEEN '${start}' AND '${end}' ${storeFilter} AND status <> 'cancelled'
  `);
  const [expenses] = await executeRows<{ total: string; count: number }>(db, `
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM network_expenses
    WHERE expenseDate BETWEEN '${start.slice(0, 10)}' AND '${end.slice(0, 10)}' ${nullableStoreFilter} AND status <> 'cancelled'
  `);
  const [fees] = await executeRows<{ total: string; count: number }>(db, `
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM network_financial_fees
    WHERE periodStart <= '${end.slice(0, 10)}' AND periodEnd >= '${start.slice(0, 10)}' ${nullableStoreFilter}
  `);
  const [supply] = await executeRows<{ total: string; count: number }>(db, `
    SELECT COALESCE(SUM(estimatedCost), 0) AS total, COUNT(*) AS count
    FROM store_supply_orders
    WHERE createdAt BETWEEN '${start}' AND '${end}' ${storeFilter} AND status IN ('approved','picking','shipped','received')
  `);

  const revenueTotal = money(revenue?.total);
  const expenseTotal = money(expenses?.total);
  const feeTotal = money(fees?.total);
  const supplyCostTotal = money(supply?.total);
  const netResult = revenueTotal - expenseTotal - feeTotal - supplyCostTotal;

  const expensesByCategory = await executeRows(db, `
    SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM network_expenses
    WHERE expenseDate BETWEEN '${start.slice(0, 10)}' AND '${end.slice(0, 10)}' ${nullableStoreFilter} AND status <> 'cancelled'
    GROUP BY category
    ORDER BY total DESC
    LIMIT 20
  `);
  const storeRanking = await executeRows(db, `
    SELECT s.id, s.name,
      COALESCE(SUM(o.total), 0) AS revenue,
      COALESCE((SELECT SUM(e.amount) FROM network_expenses e WHERE e.storeId = s.id AND e.expenseDate BETWEEN '${start.slice(0, 10)}' AND '${end.slice(0, 10)}' AND e.status <> 'cancelled'), 0) AS expenses
    FROM stores s
    LEFT JOIN orders o ON o.storeId = s.id AND o.createdAt BETWEEN '${start}' AND '${end}' AND o.status <> 'cancelled'
    WHERE s.active = true
    GROUP BY s.id
    ORDER BY revenue DESC
    LIMIT 25
  `);
  const supplyOrders = await listSupplyOrders({ storeId: opts.storeId });

  return {
    totals: {
      revenueTotal,
      orderCount: Number(revenue?.count ?? 0),
      expenseTotal,
      expenseCount: Number(expenses?.count ?? 0),
      feeTotal,
      feeCount: Number(fees?.count ?? 0),
      supplyCostTotal,
      supplyOrderCount: Number(supply?.count ?? 0),
      netResult,
      marginPercent: revenueTotal > 0 ? Number(((netResult / revenueTotal) * 100).toFixed(2)) : 0,
    },
    expensesByCategory,
    storeRanking,
    supplyOrders,
  };
}

export const createMonthlyClosingSchema = z.object({
  storeId: z.number().int().positive().optional(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  status: z.enum(["open", "in_review", "closed", "reopened"]).default("in_review"),
  notes: z.string().max(5000).optional(),
});

export async function upsertMonthlyClosing(input: z.infer<typeof createMonthlyClosingSchema>, actorUserId: number, scopedStoreId?: number) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId ?? input.storeId ?? null;
  const start = new Date(input.year, input.month - 1, 1);
  const end = new Date(input.year, input.month, 0, 23, 59, 59);
  const overview = await getFinancialOverview({ storeId: storeId ?? undefined, startDate: start, endDate: end });
  const totals = overview.totals as Record<string, number>;
  const closedAt = input.status === "closed" ? "CURRENT_TIMESTAMP" : "NULL";

  await db.execute(sql.raw(`
    INSERT INTO network_monthly_closings
      (storeId, year, month, status, revenueTotal, expenseTotal, feeTotal, supplyCostTotal, netResult, marginPercent, notes, closedByUserId, closedAt)
    VALUES
      (${storeId ?? "NULL"}, ${input.year}, ${input.month}, '${input.status}', '${totals.revenueTotal.toFixed(2)}', '${totals.expenseTotal.toFixed(2)}', '${totals.feeTotal.toFixed(2)}', '${totals.supplyCostTotal.toFixed(2)}', '${totals.netResult.toFixed(2)}', '${totals.marginPercent.toFixed(2)}', ${JSON.stringify(input.notes ?? null)}, ${actorUserId}, ${closedAt})
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      revenueTotal = VALUES(revenueTotal),
      expenseTotal = VALUES(expenseTotal),
      feeTotal = VALUES(feeTotal),
      supplyCostTotal = VALUES(supplyCostTotal),
      netResult = VALUES(netResult),
      marginPercent = VALUES(marginPercent),
      notes = VALUES(notes),
      closedByUserId = VALUES(closedByUserId),
      closedAt = VALUES(closedAt),
      updatedAt = CURRENT_TIMESTAMP
  `));
  await audit({ actorUserId, storeId, action: `monthly_closing.${input.status}`, entityType: "network_monthly_closing", metadata: input });
  return { ok: true };
}

export async function listMonthlyClosings(opts: { storeId?: number; year?: number }) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    opts.storeId ? `c.storeId = ${opts.storeId}` : "",
    opts.year ? `c.year = ${opts.year}` : "",
  ].filter(Boolean);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return executeRows(db, `
    SELECT c.*, s.name AS storeName
    FROM network_monthly_closings c
    LEFT JOIN stores s ON s.id = c.storeId
    ${where}
    ORDER BY c.year DESC, c.month DESC, s.name
    LIMIT 120
  `);
}

export async function listAuditLogs(opts: { storeId?: number; limit?: number }) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return [];
  const where = opts.storeId ? `WHERE storeId = ${opts.storeId}` : "";
  return executeRows(db, `
    SELECT *
    FROM network_audit_logs
    ${where}
    ORDER BY createdAt DESC
    LIMIT ${opts.limit ?? 100}
  `);
}
