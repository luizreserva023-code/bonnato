import "dotenv/config";

import bcrypt from "bcryptjs";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";

import {
  auditLogs,
  categories,
  customerAuthProviders,
  customerMetrics,
  deliveryPredictions,
  diningTables,
  orderItems,
  orders,
  orderStageLogs,
  otpCodes,
  products,
  productivityEvents,
  staffMembers,
  storeFeatures,
  stores,
  storeThemes,
  tableOrderLinks,
  tableSessions,
  userStoreRoles,
  users,
  type Order,
} from "../drizzle/schema.ts";
import {
  attachOrderToTableSession,
  createDiningTable,
  createOrder,
  createStaffMember,
  createStoreWithDefaults,
  getDb,
  openTableSession,
  updateOrderStatusGuarded,
} from "../server/db.ts";
import { applyOrderStatusLifecycle, bootstrapOrderLifecycle } from "../server/orderLifecycle.ts";

const DEFAULT_NAMESPACE = `s${Date.now().toString(36)}`;
const MODE = (process.argv[2] ?? "run").trim().toLowerCase();
const NAMESPACE = (process.env.STRESS_NAMESPACE ?? DEFAULT_NAMESPACE).trim().toLowerCase();

const USER_COUNT = Number.parseInt(process.env.STRESS_USER_COUNT ?? "20000", 10);
const ORDER_COUNT = Number.parseInt(process.env.STRESS_ORDER_COUNT ?? "1000", 10);
const TABLE_COUNT = Number.parseInt(process.env.STRESS_TABLE_COUNT ?? "100", 10);
const TABLE_ORDER_COUNT = Math.min(Number.parseInt(process.env.STRESS_TABLE_ORDER_COUNT ?? "100", 10), TABLE_COUNT, ORDER_COUNT);
const STATUS_BATCH_SIZE = Number.parseInt(process.env.STRESS_STATUS_BATCH_SIZE ?? "200", 10);
const USER_INSERT_BATCH = Number.parseInt(process.env.STRESS_USER_INSERT_BATCH ?? "1000", 10);
const ORDER_CREATION_CONCURRENCY = Number.parseInt(process.env.STRESS_ORDER_CONCURRENCY ?? "1000", 10);

const STORE_SLUG = `stress-lab-${NAMESPACE}`;
const CATEGORY_SLUG = `stress-cat-${NAMESPACE}`;
const PRODUCT_NAME = `Stress Product ${NAMESPACE}`;
const STRESS_EMAIL_DOMAIN = "bonatto.test";
const STRESS_EMAIL_PREFIX = `stress.${NAMESPACE}.`;
const STRESS_OPENID_PREFIX = `stress:user:${NAMESPACE}:`;
const STRESS_ORDER_NOTE_PREFIX = `stress:${NAMESPACE}:order:`;
const STRESS_PHONE_PREFIX = "319700";
const DEFAULT_PASSWORD = process.env.STRESS_USER_PASSWORD ?? "Bonatto@2026!Stress";

function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

function phoneFor(index: number) {
  return `${STRESS_PHONE_PREFIX}${pad(index, 5)}`.slice(0, 11);
}

function emailFor(index: number) {
  return `${STRESS_EMAIL_PREFIX}${pad(index, 5)}@${STRESS_EMAIL_DOMAIN}`;
}

function openIdFor(index: number) {
  return `${STRESS_OPENID_PREFIX}${pad(index, 5)}`;
}

function nowMs() {
  return Date.now();
}

async function ensureStore() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await db.select().from(stores).where(eq(stores.slug, STORE_SLUG)).limit(1);
  if (existing[0]) return existing[0];

  const storeId = await createStoreWithDefaults({
    name: `Stress Lab ${NAMESPACE}`,
    displayName: `Stress Lab ${NAMESPACE}`,
    slug: STORE_SLUG,
    city: "Mateus Leme",
    address: "Ambiente automatizado de stress",
    phone: "31999990000",
    email: `stress+${NAMESPACE}@bonatto.app`,
    status: "active",
    active: true,
    isDefault: false,
    plan: "enterprise",
    subdomain: STORE_SLUG,
  });

  const created = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!created[0]) throw new Error("Failed to create stress store");
  return created[0];
}

async function ensureCatalog(storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  let category = (await db.select().from(categories).where(eq(categories.slug, CATEGORY_SLUG)).limit(1))[0];
  if (!category) {
    const result = await db.insert(categories).values({
      name: `Stress Lab ${NAMESPACE}`,
      slug: CATEGORY_SLUG,
      description: "Categoria exclusiva para testes massivos automatizados.",
      sortOrder: 9990,
      active: true,
    });
    const header = Array.isArray(result) ? result[0] : result;
    category = (await db.select().from(categories).where(eq(categories.id, (header as { insertId: number }).insertId)).limit(1))[0];
  }

  let product = (
    await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.name, PRODUCT_NAME)))
      .limit(1)
  )[0];

  if (!product) {
    const result = await db.insert(products).values({
      storeId,
      categoryId: category.id,
      name: PRODUCT_NAME,
      description: "Produto sintético para stress de pedidos e salão.",
      price: "79.90",
      imageUrl: "/brand/palmito-2-circular.png",
      active: true,
      featured: false,
      sortOrder: 9990,
    });
    const header = Array.isArray(result) ? result[0] : result;
    product = (await db.select().from(products).where(eq(products.id, (header as { insertId: number }).insertId)).limit(1))[0];
  }

  return { category, product };
}

async function ensureWaiter(storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const waiterEmail = `stress.waiter.${NAMESPACE}@bonatto.app`;
  const existing = await db
    .select()
    .from(staffMembers)
    .where(and(eq(staffMembers.storeId, storeId), eq(staffMembers.email, waiterEmail)))
    .limit(1);

  if (existing[0]) return existing[0];

  const waiterId = await createStaffMember({
    storeId,
    name: `Waiter Stress ${NAMESPACE}`,
    phone: "31988887777",
    email: waiterEmail,
    role: "waiter",
    active: true,
  });

  const created = await db.select().from(staffMembers).where(eq(staffMembers.id, waiterId)).limit(1);
  if (!created[0]) throw new Error("Failed to create stress waiter");
  return created[0];
}

async function ensureTablesAndSessions(storeId: number, waiterStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existingTables = await db
    .select()
    .from(diningTables)
    .where(and(eq(diningTables.storeId, storeId), like(diningTables.name, `Stress Mesa %`)))
    .orderBy(diningTables.name);

  const missingTables = Math.max(0, TABLE_COUNT - existingTables.length);
  if (missingTables > 0) {
    for (let index = existingTables.length; index < TABLE_COUNT; index += 1) {
      await createDiningTable({
        storeId,
        name: `Stress Mesa ${pad(index + 1, 3)}`,
        status: "free",
        capacity: 4 + (index % 4),
        active: true,
      });
    }
  }

  const tables = await db
    .select()
    .from(diningTables)
    .where(and(eq(diningTables.storeId, storeId), like(diningTables.name, `Stress Mesa %`)))
    .orderBy(diningTables.name);

  const openSessions = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.storeId, storeId), eq(tableSessions.status, "open")));
  const openSessionByTable = new Map(openSessions.map((session) => [session.tableId, session]));

  const sessionIds: number[] = [];
  for (const [index, table] of tables.entries()) {
    const existingSession = openSessionByTable.get(table.id);
    if (existingSession) {
      sessionIds.push(existingSession.id);
      continue;
    }
    const sessionId = await openTableSession({
      tableId: table.id,
      storeId,
      waiterStaffId,
      customerName: `Stress Mesa ${pad(index + 1, 3)}`,
      guestCount: 2 + (index % 3),
      status: "open",
      notes: `Stress namespace ${NAMESPACE}`,
    });
    sessionIds.push(sessionId);
  }

  return { tables, sessionIds };
}

async function ensureUsers(count: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existingCountRow = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(like(users.openId, `${STRESS_OPENID_PREFIX}%`));
  const existingCount = Number(existingCountRow[0]?.count ?? 0);

  if (existingCount < count) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const rowsToCreate = [];
    for (let index = existingCount + 1; index <= count; index += 1) {
      rowsToCreate.push({
        openId: openIdFor(index),
        name: `Stress User ${pad(index, 5)}`,
        email: emailFor(index),
        phone: phoneFor(index),
        loginMethod: "email",
        role: "user" as const,
        status: "active" as const,
        passwordHash,
        emailVerified: true,
        loyaltyPoints: 0,
        lastSignedIn: new Date(),
      });
    }

    for (const batch of chunk(rowsToCreate, USER_INSERT_BATCH)) {
      await db.insert(users).values(batch);
    }
  }

  return db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(like(users.openId, `${STRESS_OPENID_PREFIX}%`))
    .orderBy(users.id)
    .limit(count);
}

async function createStressOrders(storeId: number, product: typeof products.$inferSelect, stressUsers: Array<{ id: number; name: string | null; email: string | null; phone: string | null }>, sessionIds: number[]) {
  const sourceUsers = stressUsers.slice(0, ORDER_COUNT);
  const creationTasks = sourceUsers.map((user, index) => async () => {
    const dineIn = index < TABLE_ORDER_COUNT;
    const quantity = dineIn ? 1 : ((index % 3) + 1);
    const subtotal = (Number(product.price) * quantity).toFixed(2);
    const orderId = await createOrder(
      {
        storeId,
        userId: user.id,
        serviceType: dineIn ? "dine_in" : "delivery",
        customerName: user.name ?? `Stress User ${pad(index + 1, 5)}`,
        customerEmail: user.email ?? emailFor(index + 1),
        customerPhone: user.phone ?? phoneFor(index + 1),
        deliveryAddress: dineIn ? `Mesa ${pad(index + 1, 3)} - Stress Lab` : `Rua Stress ${index + 1}, Mateus Leme`,
        deliveryNeighborhood: dineIn ? "Salao" : "Centro",
        deliveryCity: "Mateus Leme",
        deliveryCep: "35670000",
        subtotal,
        discountAmount: "0.00",
        deliveryFee: dineIn ? "0.00" : "6.00",
        total: dineIn ? subtotal : (Number(subtotal) + 6).toFixed(2),
        status: "pending",
        paymentMethod: "pix",
        paymentStatus: "pending",
        notes: `${STRESS_ORDER_NOTE_PREFIX}${pad(index + 1, 4)}`,
        source: "app",
      },
      [{
        productId: product.id,
        productName: product.name,
        productPrice: String(product.price),
        quantity,
        subtotal,
      }],
    );

    if (dineIn) {
      await attachOrderToTableSession(sessionIds[index], orderId);
    }
    await bootstrapOrderLifecycle(orderId, {
      skipPrediction: true,
      skipCustomerMetrics: true,
    });
    return orderId;
  });

  const orderIds: number[] = [];
  for (const taskBatch of chunk(creationTasks, Math.max(1, ORDER_CREATION_CONCURRENCY))) {
    const batchIds = await Promise.all(taskBatch.map((task) => task()));
    orderIds.push(...batchIds);
  }
  return orderIds;
}

async function advanceOrders(orderIds: number[], nextStatus: Order["status"], allowedCurrent: Order["status"][]) {
  const metrics = [];
  for (const batch of chunk(orderIds, STATUS_BATCH_SIZE)) {
    const startedAt = nowMs();
    const results = await Promise.all(batch.map(async (orderId) => {
      const guard = await updateOrderStatusGuarded(orderId, nextStatus, allowedCurrent);
      if (!guard.ok || !guard.previous) return false;
      await applyOrderStatusLifecycle(orderId, guard.previous, nextStatus, {
        source: "admin",
        notes: `stress:${NAMESPACE}:${nextStatus}`,
        skipPrediction: true,
        skipCustomerMetrics: true,
      });
      return true;
    }));
    metrics.push({
      nextStatus,
      batchSize: batch.length,
      success: results.filter(Boolean).length,
      failed: results.filter((value) => !value).length,
      durationMs: nowMs() - startedAt,
    });
  }
  return metrics;
}

async function buildSummary(storeId: number, orderIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const orderStatusRows = await db
    .select({
      status: orders.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(inArray(orders.id, orderIds))
    .groupBy(orders.status);

  const tableStatusRows = await db
    .select({
      status: diningTables.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(diningTables)
    .where(and(eq(diningTables.storeId, storeId), like(diningTables.name, `Stress Mesa %`)))
    .groupBy(diningTables.status);

  const [userRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(like(users.openId, `${STRESS_OPENID_PREFIX}%`));

  const [sessionRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tableSessions)
    .where(and(eq(tableSessions.storeId, storeId), eq(tableSessions.status, "open")));

  return {
    namespace: NAMESPACE,
    storeSlug: STORE_SLUG,
    stressUsers: Number(userRow?.count ?? 0),
    openSessions: Number(sessionRow?.count ?? 0),
    orderStatuses: orderStatusRows.map((row) => ({ status: row.status, count: Number(row.count ?? 0) })),
    tableStatuses: tableStatusRows.map((row) => ({ status: row.status, count: Number(row.count ?? 0) })),
  };
}

async function run() {
  const startedAt = nowMs();
  const store = await ensureStore();
  const { product } = await ensureCatalog(store.id);
  const waiter = await ensureWaiter(store.id);
  const { tables, sessionIds } = await ensureTablesAndSessions(store.id, waiter.id);
  const stressUsers = await ensureUsers(USER_COUNT);
  const orderIds = await createStressOrders(store.id, product, stressUsers, sessionIds);

  const stageMetrics = [];
  stageMetrics.push(...await advanceOrders(orderIds, "confirmed", ["pending"]));
  stageMetrics.push(...await advanceOrders(orderIds, "preparing", ["confirmed"]));
  stageMetrics.push(...await advanceOrders(orderIds, "out_for_delivery", ["preparing"]));
  stageMetrics.push(...await advanceOrders(orderIds, "delivered", ["out_for_delivery"]));

  const summary = await buildSummary(store.id, orderIds);
  const result = {
    mode: "run",
    namespace: NAMESPACE,
    storeId: store.id,
    tableCount: tables.length,
    sessionCount: sessionIds.length,
    userCount: stressUsers.length,
    orderCount: orderIds.length,
    stageMetrics,
    summary,
    durationMs: nowMs() - startedAt,
  };

  console.log(JSON.stringify(result, null, 2));
}

async function cleanup() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const stressStores = await db
    .select({ id: stores.id, slug: stores.slug })
    .from(stores)
    .where(like(stores.slug, `stress-lab-%`));
  const stressStoreIds = stressStores.map((store) => store.id);

  const stressUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(or(like(users.openId, `stress:user:%`), like(users.email, `stress.%@${STRESS_EMAIL_DOMAIN}`)));
  const stressUserIds = stressUsers.map((user) => user.id);

  const stressOrderRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      or(
        stressStoreIds.length > 0 ? inArray(orders.storeId, stressStoreIds) : undefined,
        like(orders.notes, `stress:%`),
      ),
    );
  const stressOrderIds = stressOrderRows.map((order) => order.id);

  const stressSessionRows = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(
      or(
        stressStoreIds.length > 0 ? inArray(tableSessions.storeId, stressStoreIds) : undefined,
        like(tableSessions.notes, `Stress namespace %`),
      ),
    );
  const stressSessionIds = stressSessionRows.map((row) => row.id);

  for (const ids of chunk(stressOrderIds, 1000)) {
    await db.delete(tableOrderLinks).where(inArray(tableOrderLinks.orderId, ids));
    await db.delete(orderStageLogs).where(inArray(orderStageLogs.orderId, ids));
    await db.delete(deliveryPredictions).where(inArray(deliveryPredictions.orderId, ids));
    await db.delete(productivityEvents).where(inArray(productivityEvents.orderId, ids));
    await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }

  if (stressSessionIds.length > 0) {
    for (const ids of chunk(stressSessionIds, 1000)) {
      await db.delete(tableOrderLinks).where(inArray(tableOrderLinks.tableSessionId, ids));
      await db.delete(tableSessions).where(inArray(tableSessions.id, ids));
    }
  }

  if (stressStoreIds.length > 0) {
    for (const ids of chunk(stressStoreIds, 500)) {
      await db.delete(staffMembers).where(inArray(staffMembers.storeId, ids));
      await db.delete(diningTables).where(inArray(diningTables.storeId, ids));
      await db.delete(storeFeatures).where(inArray(storeFeatures.storeId, ids));
      await db.delete(storeThemes).where(inArray(storeThemes.storeId, ids));
      await db.delete(userStoreRoles).where(inArray(userStoreRoles.storeId, ids));
      await db.delete(auditLogs).where(inArray(auditLogs.storeId, ids));
      await db.delete(products).where(inArray(products.storeId, ids));
      await db.delete(stores).where(inArray(stores.id, ids));
    }
  }

  await db.delete(categories).where(like(categories.slug, `stress-cat-%`));

  if (stressUserIds.length > 0) {
    for (const ids of chunk(stressUserIds, 1000)) {
      await db.delete(customerMetrics).where(or(inArray(customerMetrics.userId, ids), stressStoreIds.length > 0 ? inArray(customerMetrics.storeId, stressStoreIds) : undefined));
      await db.delete(customerAuthProviders).where(inArray(customerAuthProviders.userId, ids));
      await db.delete(otpCodes).where(inArray(otpCodes.userId, ids));
      await db.delete(users).where(inArray(users.id, ids));
    }
  }

  console.log(JSON.stringify({
    mode: "cleanup",
    deletedStoreCount: stressStoreIds.length,
    deletedUserCount: stressUserIds.length,
    deletedOrderCount: stressOrderIds.length,
    deletedSessionCount: stressSessionIds.length,
  }, null, 2));
}

async function main() {
  if (MODE === "cleanup") {
    await cleanup();
    return;
  }
  await run();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[stress-platform] failed:", error);
    process.exit(1);
  });
