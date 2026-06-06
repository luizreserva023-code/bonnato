import { and, desc, eq, gte, gt, inArray, isNull, like, lte, not, or, sql } from "drizzle-orm";
import { getTodayStartUtc, getTodayEndUtc, getBrasilTzOffset } from "../shared/timezone";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import {
  Category,
  Coupon,
  InsertCategory,
  InsertOrder,
  InsertOrderItem,
  InsertProduct,
  InsertUser,
  Order,
  OrderItem,
  Product,
  Promotion,
  Raffle,
  RaffleEntry,
  Transaction,
  Upsell,
  categories,
  coupons,
  orderItems,
  orders,
  products,
  promotions,
  raffleEntries,
  raffles,
  transactions,
  upsells,
  users,
  storeSettings,
  drivers,
  driverLocations,
  deliveryRatings,
  Driver,
  InsertDriver,
  DriverLocation,
  DeliveryRating,
  InsertDeliveryRating,
  userAddresses,
  favorites,
  clientNotifications,
  UserAddress,
  InsertUserAddress,
  Favorite,
  ClientNotification,
  orderMessages,
  OrderMessage,
  notificationTemplates,
  InsertNotificationTemplate,
  deliveryZones,
  menuSlides,
  MenuSlide,
  customTags,
  customCustomerTags,
  CustomTag,
  scheduledNotifications,
  ScheduledNotification,
  InsertScheduledNotification,
  carouselImages,
  CarouselImage,
  driverPushSubscriptions,
  DriverPushSubscription,
  loyaltyTransactions,
  clientAlerts,
  clientAlertReads,
  ClientAlert,
  webhookEvents,
  loyaltyOrderCredits,
  couponRedemptions,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;
let _schemaReady: Promise<void> | null = null;

function buildConnectionStringFromParts(): string | null {
  const host = process.env.DATABASE_HOST?.trim();
  const user = process.env.DATABASE_USER?.trim();
  const password = process.env.DATABASE_PASSWORD?.trim();
  const database = process.env.DATABASE_NAME?.trim() || "defaultdb";
  const port = process.env.DATABASE_PORT?.trim() || "3306";

  if (!host || !user || !password) {
    return null;
  }

  const sslMode = process.env.DATABASE_SSL_MODE?.trim() || "require";
  const url = new URL(`mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`);

  // mysql2 accepts JSON in the ssl query parameter when using URI strings.
  if (sslMode === "require") {
    url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: false }));
  }

  return url.toString();
}

function buildMysqlPoolFromParts() {
  const host = process.env.DATABASE_HOST?.trim();
  const user = process.env.DATABASE_USER?.trim();
  const password = process.env.DATABASE_PASSWORD?.trim();
  const database = process.env.DATABASE_NAME?.trim() || "defaultdb";
  const port = Number(process.env.DATABASE_PORT?.trim() || "3306");

  if (!host || !user || !password) {
    return null;
  }

  return createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false },
  });
}

async function hasColumn(db: any, tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(sql.raw(`SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`));
  const rows = (result as unknown as [Array<unknown>])[0] ?? [];
  return rows.length > 0;
}

async function hasIndex(db: any, tableName: string, indexName: string): Promise<boolean> {
  const result = await db.execute(sql.raw(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`));
  const rows = (result as unknown as [Array<unknown>])[0] ?? [];
  return rows.length > 0;
}

async function ensureRuntimeSchema(db: any): Promise<void> {
  if (_schemaReady) {
    return _schemaReady;
  }

  _schemaReady = (async () => {
    if (!(await hasColumn(db, "categories", "externalSource"))) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `categories` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!(await hasIndex(db, "categories", "categories_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }

    if (!(await hasColumn(db, "products", "externalSource"))) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `products` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128), ADD `externalCode` varchar(128)"
        )
      );
    }
    if (!(await hasIndex(db, "products", "products_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }

    if (!(await hasColumn(db, "coupons", "externalSource"))) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `coupons` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!(await hasIndex(db, "coupons", "coupons_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }

    if (!(await hasColumn(db, "promotions", "externalSource"))) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `promotions` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!(await hasIndex(db, "promotions", "promotions_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
  })().catch((error) => {
    _schemaReady = null;
    throw error;
  });

  return _schemaReady;
}

export async function getDb() {
  const pool = buildMysqlPoolFromParts();
  const connectionString = process.env.DATABASE_URL || buildConnectionStringFromParts();

  if (!_db && (pool || connectionString)) {
    try {
      _db = pool ? drizzle(pool as any) : drizzle(connectionString!);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (_db) {
    await ensureRuntimeSchema(_db);
  }
  return _db;
}

// --- USERS --------------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<{ isNew: boolean }> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return { isNew: false };

  // Check if user already exists to detect new registrations
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
  const isNew = existing.length === 0;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  return { isNew };
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createEmailUser(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    emailVerified: false,
    lastSignedIn: new Date(),
  });
}

export async function updateUserPasswordHash(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
}

export async function saveResetToken(email: string, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ resetToken: token, resetTokenExpiresAt: expiresAt }).where(eq(users.email, email));
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  return result[0];
}

export async function clearResetToken(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ resetToken: null, resetTokenExpiresAt: null }).where(eq(users.openId, openId));
}

// --- CATEGORIES ---------------------------------------------------------------

export async function getCategories(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(categories);
  if (activeOnly) {
    return query.where(eq(categories.active, true)).orderBy(categories.sortOrder);
  }
  return query.orderBy(categories.sortOrder);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0];
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(categories).values(data);
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(categories).set({ active: false }).where(eq(categories.id, id));
}

// --- PRODUCTS -----------------------------------------------------------------

export async function getProducts(opts?: { categoryId?: number; activeOnly?: boolean; storeId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts?.activeOnly !== false) conditions.push(eq(products.active, true));
  if (opts?.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts?.storeId) conditions.push(eq(products.storeId, opts.storeId));
  return db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(products.sortOrder, products.name);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductsByIds(ids: number[]): Promise<Product[]> {
  if (!ids || ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(products).values(data);
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(products).set({ active: false }).where(eq(products.id, id));
}

// --- COUPONS ------------------------------------------------------------------

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)))
    .limit(1);
  return result[0];
}

export async function getAllCoupons(storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (storeId) return db.select().from(coupons).where(eq(coupons.storeId, storeId)).orderBy(desc(coupons.createdAt));
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function createCoupon(data: Omit<typeof coupons.$inferInsert, "id">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(coupons).values(data);
}

export async function updateCoupon(id: number, data: Partial<typeof coupons.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(coupons).set(data).where(eq(coupons.id, id));
}

export async function incrementCouponUsage(code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // Atomic increment: only increments if usedCount < maxUses (or maxUses is null)
  // Returns true if the row was updated (coupon still valid), false if maxUses was exceeded
  const result = await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        eq(coupons.code, code.toUpperCase()),
        sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`
      )
    );
  return (result as any)?.rowsAffected > 0 || (result as any)?.[0]?.affectedRows > 0;
}

// --- ORDERS -------------------------------------------------------------------

export async function createOrder(
  orderData: InsertOrder,
  items: Omit<InsertOrderItem, 'orderId'>[]
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(orders).values(orderData);
  // Drizzle mysql2 returns [ResultSetHeader, null] - must access index 0
  const resultHeader = Array.isArray(result) ? result[0] : result;
  const orderId = (resultHeader as unknown as { insertId: number }).insertId;
  if (!orderId) throw new Error('Failed to get order ID after insert');
  const itemsWithOrderId = items.map((item) => ({ ...item, orderId }));
  await db.insert(orderItems).values(itemsWithOrderId);
  return orderId;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getAllOrders(opts?: {
  status?: Order["status"];
  limit?: number;
  offset?: number;
  storeId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts?.status) conditions.push(eq(orders.status, opts.status));
  if (opts?.storeId) conditions.push(eq(orders.storeId, opts.storeId));
  return db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(opts?.limit ?? 100)
    .offset(opts?.offset ?? 0);
}

export async function updateOrderStatus(id: number, status: Order["status"]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

export async function setOrderAiPaused(id: number, aiPaused: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(orders).set({ aiPaused }).where(eq(orders.id, id));
}

export async function updateOrderPaymentStatus(
  id: number,
  paymentStatus: Order["paymentStatus"],
  stripePaymentIntentId?: string,
  stripeCheckoutSessionId?: string,
  asaasPaymentId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateFields: Partial<Order> = { paymentStatus };
  if (stripePaymentIntentId) updateFields.stripePaymentIntentId = stripePaymentIntentId;
  if (stripeCheckoutSessionId) updateFields.stripeCheckoutSessionId = stripeCheckoutSessionId;
  if (asaasPaymentId) updateFields.asaasPaymentId = asaasPaymentId;
  // Auto-confirm order when payment succeeds
  if (paymentStatus === "paid") updateFields.status = "confirmed";
  await db.update(orders).set(updateFields).where(eq(orders.id, id));
}

// --- TRANSACTIONS -------------------------------------------------------------

export async function createTransaction(data: Omit<typeof transactions.$inferInsert, "id">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  try {
    await db.insert(transactions).values(data);
  } catch (err) {
    const msg = (err as { message?: string } | undefined)?.message ?? "";
    // Ignore duplicate-key errors so webhook retries are idempotent.
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
      console.warn(`[createTransaction] duplicate transaction ignored for order ${data.orderId}`);
      return;
    }
    throw err;
  }
}

export async function getTransactionByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, orderId))
    .limit(1);
  return result[0];
}

export async function getTransactionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: transactions.id,
      orderId: transactions.orderId,
      stripePaymentIntentId: transactions.stripePaymentIntentId,
      amount: transactions.amount,
      currency: transactions.currency,
      status: transactions.status,
      paymentMethod: transactions.paymentMethod,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(orders, eq(transactions.orderId, orders.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(50);
}

// --- REPORTS ------------------------------------------------------------------

export async function getSalesReport(startDate: Date, endDate: Date, storeId?: number) {
  const db = await getDb();
  if (!db) return { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
  const result = await db
    .select({
      totalOrders: sql<number>`COUNT(*)`,
      totalRevenue: sql<number>`SUM(${orders.total})`,
      avgOrderValue: sql<number>`AVG(${orders.total})`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        not(eq(orders.status, "cancelled")),
        storeId ? eq(orders.storeId, storeId) : undefined
      )
    );
  return result[0] ?? { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
}

export async function getTopProducts(limit = 10, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const baseQuery = db
    .select({
      productName: orderItems.productName,
      totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<number>`SUM(${orderItems.subtotal})`,
    })
    .from(orderItems);
  if (storeId) {
    return baseQuery
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.storeId, storeId))
      .groupBy(orderItems.productName)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(limit);
  }
  return baseQuery
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(limit);
}

// --- ANALYTICS / SALES DASHBOARD -------------------------------------------
export async function getSalesOverview(startDate: Date, endDate: Date, storeId?: number) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, totalOrders: 0, avgTicket: 0, prevTotalRevenue: 0, prevTotalOrders: 0, todayOrders: 0, todayRevenue: 0 };

  const periodMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - periodMs);
  const prevEnd = new Date(startDate.getTime() - 1);
  // Usa America/Sao_Paulo para calcular início e fim do dia
  const todayStart = getTodayStartUtc();
  const todayEnd = getTodayEndUtc();

  const storeFilter = storeId ? sql` AND \`storeId\` = ${storeId}` : sql``;
  const [curr, prev, todayRes] = await Promise.all([
    db.execute(
      sql`SELECT COUNT(*) AS totalOrders, COALESCE(SUM(\`total\`),0) AS totalRevenue
          FROM \`orders\`
          WHERE \`createdAt\` >= ${startDate} AND \`createdAt\` <= ${endDate}
            AND \`status\` != 'cancelled'${storeFilter}`
    ),
    db.execute(
      sql`SELECT COUNT(*) AS totalOrders, COALESCE(SUM(\`total\`),0) AS totalRevenue
          FROM \`orders\`
          WHERE \`createdAt\` >= ${prevStart} AND \`createdAt\` <= ${prevEnd}
            AND \`status\` != 'cancelled'${storeFilter}`
    ),
    db.execute(
      sql`SELECT COUNT(*) AS todayOrders, COALESCE(SUM(\`total\`),0) AS todayRevenue
          FROM \`orders\`
          WHERE \`createdAt\` >= ${todayStart} AND \`createdAt\` <= ${todayEnd}
            AND \`status\` != 'cancelled'${storeFilter}`
    ),
  ]);

  const c = (curr as unknown as [Array<{ totalOrders: string; totalRevenue: string }>])[0][0];
  const p = (prev as unknown as [Array<{ totalOrders: string; totalRevenue: string }>])[0][0];
  const td = (todayRes as unknown as [Array<{ todayOrders: string; todayRevenue: string }>])[0][0];

  const totalOrders = Number(c?.totalOrders ?? 0);
  const totalRevenue = Number(c?.totalRevenue ?? 0);
  const prevTotalOrders = Number(p?.totalOrders ?? 0);
  const prevTotalRevenue = Number(p?.totalRevenue ?? 0);

  return {
    totalRevenue,
    totalOrders,
    avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    prevTotalRevenue,
    prevTotalOrders,
    todayOrders: Number(td?.todayOrders ?? 0),
    todayRevenue: Number(td?.todayRevenue ?? 0),
  };
}

export async function getSalesTimeSeries(startDate: Date, endDate: Date, storeId?: number, timezoneOffsetMinutes = 0) {
  const db = await getDb();
  if (!db) return [];
  // Sempre usa America/Sao_Paulo — ignora timezoneOffset do cliente
  const tzOffset = getBrasilTzOffset();
  const storeFilterTs = storeId ? sql` AND \`storeId\` = ${storeId}` : sql``;
  const rows = await db.execute(
    sql`SELECT DATE(CONVERT_TZ(\`createdAt\`, '+00:00', ${tzOffset})) AS date,
               COUNT(*) AS totalOrders,
               COALESCE(SUM(\`total\`),0) AS totalRevenue
        FROM \`orders\`
        WHERE \`createdAt\` >= ${startDate} AND \`createdAt\` <= ${endDate}
          AND \`status\` != 'cancelled'${storeFilterTs}
        GROUP BY DATE(CONVERT_TZ(\`createdAt\`, '+00:00', ${tzOffset}))
        ORDER BY DATE(CONVERT_TZ(\`createdAt\`, '+00:00', ${tzOffset}))`
  );
  return (rows as unknown as [Array<{ date: string; totalOrders: string; totalRevenue: string }>])[0].map((r) => ({
    date: r.date,
    totalOrders: Number(r.totalOrders),
    totalRevenue: Number(r.totalRevenue ?? 0),
  }));
}

export async function getRecentOrdersFeed(limit = 20, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      total: orders.total,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(storeId ? eq(orders.storeId, storeId) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrdersByPeriod(startDate: Date, endDate: Date, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      storeId ? eq(orders.storeId, storeId) : undefined
    ))
    .orderBy(desc(orders.createdAt));
}

export async function getDailyRevenue(days = 7, storeId?: number, timezoneOffsetMinutes = 0) {
  const db = await getDb();
  if (!db) return [];
  // Sempre usa America/Sao_Paulo — ignora timezoneOffset do cliente
  const tzOffset = getBrasilTzOffset();
  const todayStartUtc = getTodayStartUtc();
  const startDate = new Date(todayStartUtc.getTime() - days * 24 * 60 * 60 * 1000);
  // Use raw SQL with CONVERT_TZ to group by local date
  const storeFilterDr = storeId ? sql` AND \`orders\`.\`storeId\` = ${storeId}` : sql``;
  const rows = await db.execute(
    sql`SELECT DATE(CONVERT_TZ(\`orders\`.\`createdAt\`, '+00:00', ${tzOffset})) AS date,
               COUNT(*) AS totalOrders,
               SUM(\`orders\`.\`total\`) AS totalRevenue
        FROM \`orders\`
        WHERE \`orders\`.\`createdAt\` >= ${startDate}
          AND \`orders\`.\`status\` != 'cancelled'${storeFilterDr}
        GROUP BY DATE(CONVERT_TZ(\`orders\`.\`createdAt\`, '+00:00', ${tzOffset}))
        ORDER BY DATE(CONVERT_TZ(\`orders\`.\`createdAt\`, '+00:00', ${tzOffset}))`
  );
  return (rows as unknown as [Array<{ date: string; totalOrders: number; totalRevenue: string }>])[0].map((r) => ({
    date: r.date,
    totalOrders: Number(r.totalOrders),
    totalRevenue: Number(r.totalRevenue ?? 0),
  }));
}

// --- USER PROFILE --------------------------------------------------------------

export async function updateUserProfile(
  userId: number,
  data: { name?: string; phone?: string; savedAddress?: string; savedCep?: string; savedCity?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getAllUsers(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
}

// --- COUPONS (EXTENDED) -------------------------------------------------------

export async function getCouponsByUser(userId: number): Promise<Coupon[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(coupons)
    .where(and(eq(coupons.userId, userId), eq(coupons.active, true)));
}

export async function createUserCoupon(data: {
  userId: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minOrderValue?: string;
  maxUses?: number;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(coupons).values({
    ...data,
    active: true,
    usedCount: 0,
  });
}

// --- UP-SELLS -----------------------------------------------------------------

export async function getActiveUpsells(): Promise<Upsell[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(upsells)
    .where(eq(upsells.active, true))
    .orderBy(upsells.sortOrder);
}

export async function getUpsellsForCart(cartProductIds: number[], cartTotal: number): Promise<(Upsell & { suggestedProduct: Product | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(upsells).where(eq(upsells.active, true)).orderBy(upsells.sortOrder);
  const filtered = all.filter((u) => {
    if (u.triggerMinTotal && parseFloat(u.triggerMinTotal) > cartTotal) return false;
    if (u.triggerProductId && !cartProductIds.includes(u.triggerProductId)) return false;
    // Don't suggest a product already in the cart
    if (cartProductIds.includes(u.suggestedProductId)) return false;
    return true;
  });
  // Enrich with suggested product data
  const productIds = Array.from(new Set(filtered.map((u) => u.suggestedProductId)));
  const prods: Product[] = productIds.length > 0
    ? await db.select().from(products).where(sql`${products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];
  return filtered.map((u) => ({
    ...u,
    suggestedProduct: prods.find((p) => p.id === u.suggestedProductId) ?? null,
  }));
}

export async function createUpsell(data: Omit<typeof upsells.$inferInsert, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(upsells).values(data);
}

export async function updateUpsell(id: number, data: Partial<typeof upsells.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(upsells).set(data).where(eq(upsells.id, id));
}

export async function deleteUpsell(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(upsells).where(eq(upsells.id, id));
}

export async function getAllUpsells(): Promise<Upsell[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(upsells).orderBy(upsells.sortOrder);
}

// --- PROMOTIONS ---------------------------------------------------------------

export async function getActivePromotions(): Promise<Promotion[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const all = await db.select().from(promotions).where(eq(promotions.active, true)).orderBy(desc(promotions.createdAt));
  return all.filter((p) => {
    if (p.endsAt && p.endsAt < now) return false;
    if (p.startsAt && p.startsAt > now) return false;
    return true;
  });
}

export async function getAllPromotions(): Promise<Promotion[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promotions).orderBy(desc(promotions.createdAt));
}

export async function createPromotion(data: Omit<typeof promotions.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(promotions).values(data);
}

export async function updatePromotion(id: number, data: Partial<typeof promotions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promotions).set(data).where(eq(promotions.id, id));
}

export async function deletePromotion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(promotions).where(eq(promotions.id, id));
}

// --- RAFFLES ------------------------------------------------------------------

export async function getActiveRaffles(): Promise<Raffle[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(raffles).where(eq(raffles.status, "active")).orderBy(desc(raffles.createdAt));
}

export async function getAllRaffles(): Promise<Raffle[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(raffles).orderBy(desc(raffles.createdAt));
}

export async function createRaffle(data: Omit<typeof raffles.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(raffles).values(data);
}

export async function updateRaffle(id: number, data: Partial<typeof raffles.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(raffles).set(data).where(eq(raffles.id, id));
}

export async function getRaffleEntries(raffleId: number): Promise<RaffleEntry[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
}

export async function enterRaffle(raffleId: number, userId: number, userName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if already entered
  const existing = await db
    .select()
    .from(raffleEntries)
    .where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.userId, userId)))
    .limit(1);
  if (existing.length > 0) return false; // already entered
  await db.insert(raffleEntries).values({ raffleId, userId, userName });
  return true;
}

export async function drawRaffleWinner(raffleId: number): Promise<RaffleEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const entries = await db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
  if (entries.length === 0) return null;
  const winner = entries[Math.floor(Math.random() * entries.length)];
  await db.update(raffles).set({
    status: "drawn",
    winnerId: winner.userId,
    winnerName: winner.userName,
    drawDate: new Date(),
  }).where(eq(raffles.id, raffleId));
  return winner;
}

// --- STORE SETTINGS -----------------------------------------------------------
export async function getStoreSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function getAllStoreSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(storeSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setStoreSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(storeSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// --- DRIVERS (MOTOBOYS) -------------------------------------------------------

export async function getAllDrivers(activeOnly = true, storeId?: number): Promise<Driver[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (activeOnly) conditions.push(eq(drivers.active, true));
  if (storeId) conditions.push(eq(drivers.storeId, storeId));
  return db.select().from(drivers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(drivers.name);
}

export async function getDriverById(id: number): Promise<Driver | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return result[0];
}

export async function getDriverByToken(token: string): Promise<Driver | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.accessToken, token)).limit(1);
  return result[0];
}

export async function createDriver(data: Omit<InsertDriver, "id">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(drivers).values(data);
  const resultHeader = Array.isArray(result) ? result[0] : result;
  return (resultHeader as unknown as { insertId: number }).insertId;
}

export async function updateDriver(id: number, data: Partial<InsertDriver>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(drivers).set(data).where(eq(drivers.id, id));
}

export async function deleteDriver(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(drivers).set({ active: false }).where(eq(drivers.id, id));
}

export async function assignDriverToOrder(orderId: number, driverId: number | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(orders).set({ driverId }).where(eq(orders.id, orderId));
}

// --- DRIVER LOCATIONS ---------------------------------------------------------

export async function upsertDriverLocation(
  driverId: number,
  lat: string,
  lng: string,
  orderId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if a location record already exists for this driver
  const existing = await db
    .select()
    .from(driverLocations)
    .where(eq(driverLocations.driverId, driverId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(driverLocations)
      .set({ lat, lng, orderId: orderId ?? null })
      .where(eq(driverLocations.driverId, driverId));
  } else {
    await db.insert(driverLocations).values({ driverId, lat, lng, orderId: orderId ?? null });
  }
}

export async function getDriverLocation(driverId: number): Promise<DriverLocation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(driverLocations)
    .where(eq(driverLocations.driverId, driverId))
    .limit(1);
  return result[0];
}

export async function getDriverLocationByOrder(orderId: number): Promise<DriverLocation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(driverLocations)
    .where(eq(driverLocations.orderId, orderId))
    .limit(1);
  return result[0];
}

export async function getAllActiveDriverLocations(): Promise<(DriverLocation & { driverName: string })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: driverLocations.id,
      driverId: driverLocations.driverId,
      orderId: driverLocations.orderId,
      lat: driverLocations.lat,
      lng: driverLocations.lng,
      updatedAt: driverLocations.updatedAt,
      driverName: drivers.name,
    })
    .from(driverLocations)
    .innerJoin(drivers, eq(driverLocations.driverId, drivers.id))
    .where(eq(drivers.active, true));
  return rows;
}

// --- DELIVERY RATINGS ---------------------------------------------------------

export async function submitDeliveryRating(data: InsertDeliveryRating): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(deliveryRatings).values(data);
}

export async function getRatingByOrder(orderId: number): Promise<DeliveryRating | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deliveryRatings).where(eq(deliveryRatings.orderId, orderId)).limit(1);
  return result[0];
}

export async function getDriverRatings(driverId: number): Promise<(DeliveryRating & { customerName: string })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: deliveryRatings.id,
      orderId: deliveryRatings.orderId,
      driverId: deliveryRatings.driverId,
      userId: deliveryRatings.userId,
      rating: deliveryRatings.rating,
      comment: deliveryRatings.comment,
      createdAt: deliveryRatings.createdAt,
      customerName: users.name,
    })
    .from(deliveryRatings)
    .leftJoin(users, eq(deliveryRatings.userId, users.id))
    .where(eq(deliveryRatings.driverId, driverId))
    .orderBy(desc(deliveryRatings.createdAt));
  return rows.map(r => ({ ...r, customerName: r.customerName ?? 'Cliente' }));
}

export async function getDriverAverageRating(driverId: number): Promise<{ avg: number; count: number }> {
  const db = await getDb();
  if (!db) return { avg: 0, count: 0 };
  const result = await db
    .select({
      avg: sql<number>`AVG(${deliveryRatings.rating})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(deliveryRatings)
    .where(eq(deliveryRatings.driverId, driverId));
  return { avg: Number(result[0]?.avg ?? 0), count: Number(result[0]?.count ?? 0) };
}

export async function getDriverDeliveryHistory(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.driverId, driverId), eq(orders.status, 'delivered')))
    .orderBy(desc(orders.createdAt))
    .limit(50);
}

// --- USER ADDRESSES -----------------------------------------------------------

export async function getUserAddresses(userId: number): Promise<UserAddress[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(desc(userAddresses.isDefault), userAddresses.createdAt);
}

export async function createUserAddress(data: InsertUserAddress): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.isDefault) {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, data.userId));
  }
  await db.insert(userAddresses).values(data);
}

export async function updateUserAddress(id: number, userId: number, data: Partial<InsertUserAddress>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.isDefault) {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
  }
  await db.update(userAddresses).set(data).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)));
}

export async function deleteUserAddress(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(userAddresses).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)));
}

// --- FAVORITES ----------------------------------------------------------------

export async function getUserFavorites(userId: number): Promise<Favorite[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favorites).where(eq(favorites.userId, userId));
}

export async function toggleFavorite(userId: number, productId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, productId))).limit(1);
  if (existing.length > 0) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)));
    return false;
  } else {
    await db.insert(favorites).values({ userId, productId });
    return true;
  }
}

// --- CLIENT NOTIFICATIONS -----------------------------------------------------

export async function getClientNotifications(userId: number): Promise<ClientNotification[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientNotifications).where(eq(clientNotifications.userId, userId)).orderBy(desc(clientNotifications.createdAt)).limit(50);
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(clientNotifications).where(and(eq(clientNotifications.userId, userId), eq(clientNotifications.read, false)));
  return result[0]?.count ?? 0;
}

export async function markNotificationsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientNotifications).set({ read: true }).where(eq(clientNotifications.userId, userId));
}

export async function createClientNotification(data: { userId: number; title: string; message: string; type: 'order' | 'promo' | 'system' }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientNotifications).values(data);
}

// // --- LOYALTY POINTS -----------------------------------------------------------
export async function getUserLoyaltyPoints(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ loyaltyPoints: users.loyaltyPoints }).from(users).where(eq(users.id, userId)).limit(1);
  return result[0]?.loyaltyPoints ?? 0;
}
export async function addLoyaltyPoints(userId: number, points: number, orderId?: number, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const balanceBefore = await getUserLoyaltyPoints(userId);
  const balanceAfter = balanceBefore + points;
  await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${points}` }).where(eq(users.id, userId));
  await db.insert(loyaltyTransactions).values({
    userId, orderId: orderId ?? null, type: 'earn', points,
    description: description ?? `+${points} pontos por pedido #${orderId ?? ''}`,
    balanceBefore, balanceAfter,
  });
}
export async function deductLoyaltyPoints(userId: number, points: number, orderId?: number, description?: string): Promise<{ ok: boolean; newBalance: number }> {
  const db = await getDb();
  if (!db) return { ok: false, newBalance: 0 };
  const current = await getUserLoyaltyPoints(userId);
  if (current < points) return { ok: false, newBalance: current };
  const balanceAfter = current - points;
  await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} - ${points}` }).where(eq(users.id, userId));
  await db.insert(loyaltyTransactions).values({
    userId, orderId: orderId ?? null, type: 'redeem', points: -points,
    description: description ?? `-${points} pontos resgatados como desconto`,
    balanceBefore: current, balanceAfter,
  });
  return { ok: true, newBalance: balanceAfter };
}
export async function getLoyaltyHistory(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.userId, userId))
    .orderBy(sql`${loyaltyTransactions.createdAt} DESC`)
    .limit(limit);
}

export async function updateUserAvatar(userId: number, avatarUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
}

export async function getUserSpendingHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      month: sql<string>`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`,
      total: sql<number>`SUM(${orders.total})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'delivered')))
    .groupBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`)
    .limit(12);
}

// ORDER MESSAGES (chat cliente <-> restaurante)
export async function getOrderMessages(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderMessages).where(eq(orderMessages.orderId, orderId)).orderBy(orderMessages.createdAt);
}

export async function sendOrderMessage(data: { orderId: number; userId: number; senderRole: "customer" | "admin"; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(orderMessages).values(data);
  const id = (result as any).insertId as number;
  const [msg] = await db.select().from(orderMessages).where(eq(orderMessages.id, id));
  return msg;
}

export async function markMessagesRead(orderId: number, readerRole: "customer" | "admin") {
  const db = await getDb();
  if (!db) return;
  const senderRole = readerRole === "admin" ? "customer" : "admin";
  await db.update(orderMessages)
    .set({ readAt: new Date() })
    .where(and(eq(orderMessages.orderId, orderId), eq(orderMessages.senderRole, senderRole), isNull(orderMessages.readAt)));
}

export async function getUnreadCountForOrder(orderId: number, readerRole: "customer" | "admin") {
  const db = await getDb();
  if (!db) return 0;
  const senderRole = readerRole === "admin" ? "customer" : "admin";
  const rows = await db.select().from(orderMessages)
    .where(and(eq(orderMessages.orderId, orderId), eq(orderMessages.senderRole, senderRole), isNull(orderMessages.readAt)));
  return rows.length;
}

export async function getTotalUnreadForAdmin() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(orderMessages)
    .where(and(eq(orderMessages.senderRole, "customer"), isNull(orderMessages.readAt)));
  return rows.length;
}

export async function getTotalUnreadForUser(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const userOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
  if (userOrders.length === 0) return 0;
  let count = 0;
  for (const o of userOrders) {
    const rows = await db.select().from(orderMessages)
      .where(and(eq(orderMessages.orderId, o.id), eq(orderMessages.senderRole, "admin"), isNull(orderMessages.readAt)));
    count += rows.length;
  }
  return count;
}

// --- CRM HELPERS ---------------------------------------------------------------

/**
 * Lista todos os clientes (role=user) com estatísticas de pedidos.
 * Retorna dados para o CRM: total de pedidos, total gasto, último pedido, etc.
 */
export async function getCrmCustomers(opts?: {
  search?: string;
  limit?: number;
  offset?: number;
  storeId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;
  const search = opts?.search?.trim() ?? "";

  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.avatarUrl,
      u.loyaltyPoints,
      u.createdAt,
      u.lastSignedIn,
      COUNT(DISTINCT o.id) AS totalOrders,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN CAST(o.total AS DECIMAL(10,2)) ELSE 0 END), 0) AS totalSpent,
      MAX(o.createdAt) AS lastOrderAt,
      COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) AS deliveredOrders,
      GROUP_CONCAT(DISTINCT ct.tag ORDER BY ct.assignedAt DESC SEPARATOR ',') AS tags
    FROM users u
    LEFT JOIN orders o ON o.userId = u.id
    LEFT JOIN customer_tags ct ON ct.userId = u.id
    WHERE u.role = 'user'
      ${search ? sql`AND (u.name LIKE ${'%' + search + '%'} OR u.email LIKE ${'%' + search + '%'} OR u.phone LIKE ${'%' + search + '%'})` : sql``}
      ${opts?.storeId ? sql`AND u.id IN (SELECT DISTINCT userId FROM \`orders\` WHERE storeId = ${opts.storeId})` : sql``}
    GROUP BY u.id
    ORDER BY lastOrderAt DESC, u.createdAt DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return (rows as unknown as [Array<{
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    loyaltyPoints: number;
    createdAt: Date;
    lastSignedIn: Date;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: Date | null;
    deliveredOrders: number;
    tags: string | null;
  }>])[0];
}

/**
 * Conta total de clientes para paginação.
 */
export async function countCrmCustomers(search?: string, storeId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const s = search?.trim() ?? "";
  const rows = await db.execute(sql`
    SELECT COUNT(*) AS total FROM users u
    WHERE u.role = 'user'
    ${s ? sql`AND (u.name LIKE ${'%' + s + '%'} OR u.email LIKE ${'%' + s + '%'} OR u.phone LIKE ${'%' + s + '%'})` : sql``}
    ${storeId ? sql`AND u.id IN (SELECT DISTINCT userId FROM \`orders\` WHERE storeId = ${storeId})` : sql``}
  `);
  const result = (rows as unknown as [Array<{ total: number }>])[0];
  return Number(result[0]?.total ?? 0);
}

/**
 * Retorna detalhes completos de um cliente para o CRM.
 */
export async function getCrmCustomerDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows.length) return null;
  // Strip sensitive fields before returning to the admin CRM view
  const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = userRows[0] as typeof userRows[0] & {
    passwordHash?: unknown; resetToken?: unknown; resetTokenExpiresAt?: unknown;
  };

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  return { user: safeUser, orders: orderRows };
}

/**
 * Lista clientes filtrados por tag específica.
 */
export async function getCrmCustomersByTag(tag: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.avatarUrl,
      u.loyaltyPoints,
      u.createdAt,
      COUNT(DISTINCT o.id) AS totalOrders,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN CAST(o.total AS DECIMAL(10,2)) ELSE 0 END), 0) AS totalSpent,
      MAX(o.createdAt) AS lastOrderAt,
      GROUP_CONCAT(DISTINCT ct2.tag ORDER BY ct2.assignedAt DESC SEPARATOR ',') AS tags
    FROM users u
    INNER JOIN customer_tags ct ON ct.userId = u.id AND ct.tag = ${tag}
    LEFT JOIN customer_tags ct2 ON ct2.userId = u.id
    LEFT JOIN orders o ON o.userId = u.id
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY lastOrderAt DESC
  `);
  return (rows as unknown as [Array<{
    id: number; name: string | null; email: string | null; phone: string | null;
    avatarUrl: string | null; loyaltyPoints: number; createdAt: Date;
    totalOrders: number; totalSpent: number; lastOrderAt: Date | null;
    tags: string | null;
  }>])[0];
}

/**
 * Atribui uma tag manualmente a um cliente.
 */
export async function assignTagToCustomer(userId: number, tag: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const existing = await db.execute(sql`
    SELECT id FROM customer_tags WHERE userId = ${userId} AND tag = ${tag} LIMIT 1
  `);
  const rows = (existing as unknown as [Array<{ id: number }>])[0];
  if (rows.length === 0) {
    await db.execute(sql`
      INSERT INTO customer_tags (userId, tag, assignedAt, updatedAt) VALUES (${userId}, ${tag}, ${now}, ${now})
    `);
  }
}

/**
 * Remove uma tag de um cliente.
 */
export async function removeTagFromCustomer(userId: number, tag: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM customer_tags WHERE userId = ${userId} AND tag = ${tag}`);
}

/**
 * Retorna todas as tags de um cliente específico.
 */
export async function getTagsForCustomer(userId: number): Promise<Array<{ tag: string; assignedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT tag, assignedAt FROM customer_tags WHERE userId = ${userId} ORDER BY assignedAt DESC
  `);
  return (rows as unknown as [Array<{ tag: string; assignedAt: Date }>])[0];
}

/**
 * Retorna execuções de jornadas de um cliente específico.
 */
export async function getJourneyExecutionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT je.*, j.name AS journeyName
    FROM journey_executions je
    LEFT JOIN journeys j ON j.id = je.journeyId
    WHERE je.userId = ${userId}
    ORDER BY je.startedAt DESC
    LIMIT 20
  `);
  return (rows as unknown as [Array<{
    id: number; journeyId: number; journeyName: string | null;
    status: string; currentStep: number; startedAt: Date;
    completedAt: Date | null; logs: string | null;
  }>])[0];
}

/**
 * Retorna carrinhos abandonados de um cliente específico.
 */
export async function getAbandonedCartsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT * FROM abandoned_carts WHERE userId = ${userId} ORDER BY createdAt DESC LIMIT 10
  `);
  return (rows as unknown as [Array<{
    id: number; status: string; total: string; items: string;
    createdAt: Date; firstReminderSentAt: Date | null; secondReminderSentAt: Date | null;
  }>])[0];
}

/**
 * Retorna estatísticas gerais do CRM para o dashboard.
 */
export async function getCrmStats() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'user') AS totalCustomers,
      (SELECT COUNT(*) FROM customer_tags WHERE tag = 'novo') AS tagNovo,
      (SELECT COUNT(*) FROM customer_tags WHERE tag = 'recorrente') AS tagRecorrente,
      (SELECT COUNT(*) FROM customer_tags WHERE tag = 'indeciso') AS tagIndeciso,
      (SELECT COUNT(*) FROM customer_tags WHERE tag = 'inativo_15') AS tagInativo15,
      (SELECT COUNT(*) FROM customer_tags WHERE tag = 'inativo_30') AS tagInativo30,
      (SELECT COUNT(*) FROM customer_tags WHERE tag = 'inativo_60') AS tagInativo60,
      (SELECT COUNT(*) FROM abandoned_carts WHERE status = 'pending') AS carrinhosPendentes,
      (SELECT COUNT(*) FROM journey_executions WHERE status = 'running') AS jornadasAtivas
  `);
  const result = (rows as unknown as [Array<{
    totalCustomers: number; tagNovo: number; tagRecorrente: number; tagIndeciso: number;
    tagInativo15: number; tagInativo30: number; tagInativo60: number;
    carrinhosPendentes: number; jornadasAtivas: number;
  }>])[0];
  return result[0] ?? null;
}

// ─── Notification Templates ───────────────────────────────────────────────────



/**
 * Lista todos os templates de notificação, opcionalmente filtrados por event/channel.
 */
export async function listNotificationTemplates(opts?: { event?: string; channel?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(notificationTemplates).$dynamic();
  if (opts?.event) {
    query = query.where(eq((notificationTemplates as any).event, opts.event));
  }
  return query.orderBy((notificationTemplates as any).event, (notificationTemplates as any).channel);
}

/**
 * Cria um novo template de notificação.
 */
export async function createNotificationTemplate(data: InsertNotificationTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(notificationTemplates).values(data);
  const rows = result as unknown as [{ insertId: number }];
  return rows[0].insertId;
}

/**
 * Atualiza um template existente.
 */
export async function updateNotificationTemplate(id: number, data: Partial<InsertNotificationTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notificationTemplates).set(data).where(eq((notificationTemplates as any).id, id));
}

/**
 * Remove um template.
 */
export async function deleteNotificationTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(notificationTemplates).where(eq((notificationTemplates as any).id, id));
}

/**
 * Sorteia aleatoriamente um template ativo para um evento e canal.
 * Fallback para templates do canal "both" se não houver específico.
 * Retorna null se não houver nenhum template ativo.
 */
export async function pickRandomTemplate(
  event: string,
  channel: "push" | "whatsapp"
): Promise<{ title: string; body: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT title, body FROM notification_templates
    WHERE event = ${event}
      AND (channel = ${channel} OR channel = 'both')
      AND isActive = 1
    ORDER BY RAND()
    LIMIT 1
  `);
  const result = (rows as unknown as [Array<{ title: string; body: string }>])[0];
  return result[0] ?? null;
}

/**
 * Seed de templates variados por status. Só insere se a tabela estiver vazia.
 */
export async function seedNotificationTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(notificationTemplates).limit(1);
  if (existing.length > 0) return;

  const templates: InsertNotificationTemplate[] = [
    // ── order_confirmed ──
    { event: "order_confirmed", channel: "push", title: "✅ Pedido confirmado!", body: "Oba! Seu pedido #{{orderId}} foi confirmado. Já estamos separando tudo com carinho!" },
    { event: "order_confirmed", channel: "push", title: "🍕 Recebemos seu pedido!", body: "Pedido #{{orderId}} confirmado! A equipe da Bonatto já entrou em ação." },
    { event: "order_confirmed", channel: "push", title: "👌 Tá na fila, {{clientName}}!", body: "Seu pedido #{{orderId}} foi aceito. Em breve começa a magia!" },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "Olá, {{clientName}}! 🎉 Seu pedido #{{orderId}} foi confirmado. Estamos preparando tudo com muito carinho pra você. Qualquer dúvida é só chamar!" },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "Oi, {{clientName}}! ✅ Recebemos seu pedido #{{orderId}} e já estamos de olho nele. Logo logo sua pizza sai do forno!" },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "{{clientName}}, seu pedido #{{orderId}} está confirmado! 🍕 Nossa equipe já foi avisada. Aguarda que vem coisa boa aí!" },

    // ── order_preparing ──
    { event: "order_preparing", channel: "push", title: "👨‍🍳 Mãos na massa!", body: "Seu pedido #{{orderId}} está sendo preparado. O cheirinho já deve estar chegando aí!" },
    { event: "order_preparing", channel: "push", title: "🔥 Forno ligado!", body: "Pedido #{{orderId}} no forno! Daqui a pouco vai estar pronto." },
    { event: "order_preparing", channel: "push", title: "🍕 Preparando com amor", body: "Seu pedido #{{orderId}} está nas mãos dos nossos pizzaiolos. Quase lá!" },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "{{clientName}}, seu pedido #{{orderId}} está sendo preparado agora! 🍕🔥 O forno já está quente e a pizza vai sair perfeita. Aguenta um pouquinho!" },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "Oi {{clientName}}! 👨‍🍳 Nosso time já está com as mãos na massa do seu pedido #{{orderId}}. Em breve fica pronto!" },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "{{clientName}}, o pedido #{{orderId}} entrou em produção! 🎯 Estamos caprichando em cada detalhe pra você. Logo logo sai!" },

    // ── order_out_for_delivery ──
    { event: "order_out_for_delivery", channel: "push", title: "🛵 Saiu pra entrega!", body: "Seu pedido #{{orderId}} está a caminho! Fique de olho na porta." },
    { event: "order_out_for_delivery", channel: "push", title: "🚀 Voando até você!", body: "Pedido #{{orderId}} saiu! Nosso motoboy já está na estrada." },
    { event: "order_out_for_delivery", channel: "push", title: "📍 A caminho!", body: "Pedido #{{orderId}} em rota de entrega. Pode deixar o apetite crescer!" },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "{{clientName}}, seu pedido #{{orderId}} saiu para entrega! 🛵💨 Nosso motoboy está a caminho. Fique de olho na porta!" },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "Oi {{clientName}}! 🍕🛵 O pedido #{{orderId}} está voando até você. Pode ir abrindo a porta!" },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "{{clientName}}, boa notícia! 🎉 Seu pedido #{{orderId}} saiu agora. Daqui a pouco você vai estar saboreando uma pizza incrível!" },

    // ── order_delivered ──
    { event: "order_delivered", channel: "push", title: "🎉 Entregue! Bom apetite!", body: "Seu pedido #{{orderId}} foi entregue. Aproveite muito!" },
    { event: "order_delivered", channel: "push", title: "🍕 Chegou! Hora de comer!", body: "Pedido #{{orderId}} entregue. Bom apetite, {{clientName}}!" },
    { event: "order_delivered", channel: "push", title: "✅ Entregue com sucesso!", body: "Pedido #{{orderId}} na sua mão! Que seja delicioso." },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "{{clientName}}, seu pedido #{{orderId}} foi entregue! 🎉🍕 Esperamos que você aproveite muito. Bom apetite e até a próxima!" },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "Oi {{clientName}}! ✅ Pedido #{{orderId}} entregue com sucesso. Que a pizza esteja deliciosa! Qualquer coisa, estamos aqui. 😊" },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "{{clientName}}, chegou! 🍕🔥 Pedido #{{orderId}} entregue. Obrigado pela preferência! Nos vemos no próximo pedido. 🙏" },

    // ── order_cancelled ──
    { event: "order_cancelled", channel: "push", title: "❌ Pedido cancelado", body: "Seu pedido #{{orderId}} foi cancelado. Sentimos muito!" },
    { event: "order_cancelled", channel: "push", title: "😔 Ops, pedido cancelado", body: "Pedido #{{orderId}} cancelado. Qualquer dúvida, entre em contato." },
    { event: "order_cancelled", channel: "whatsapp", title: "Cancelado", body: "{{clientName}}, infelizmente seu pedido #{{orderId}} precisou ser cancelado. 😔 Sentimos muito pelo inconveniente. Entre em contato conosco para mais informações." },
    { event: "order_cancelled", channel: "whatsapp", title: "Cancelado", body: "Oi {{clientName}}, seu pedido #{{orderId}} foi cancelado. 😢 Pedimos desculpas! Estamos à disposição para resolver qualquer situação." },

    // ── cart_abandoned_step1 (10 min — urgência) ──
    { event: "cart_abandoned_step1", channel: "push", title: "🍕 Sua pizza está esperando!", body: "Finalize seu pedido de R$ {{total}} antes que esfrie!" },
    { event: "cart_abandoned_step1", channel: "push", title: "⚡ Esqueceu alguma coisa?", body: "Seu carrinho de R$ {{total}} ainda está salvo. Finaliza aí!" },
    { event: "cart_abandoned_step1", channel: "push", title: "🔥 Seu pedido está te esperando!", body: "R$ {{total}} no carrinho. Não deixa esfriar, {{clientName}}!" },
    { event: "cart_abandoned_step1", channel: "whatsapp", title: "Carrinho abandonado - etapa 1", body: "Olá, {{clientName}}! 🍕\n\nVocê deixou sua pizza no forno! 😅\n\n*Total: R$ {{total}}*\n\nFinalize agora antes que esfrie:\n👉 https://bonattopizza.manus.space" },
    { event: "cart_abandoned_step1", channel: "whatsapp", title: "Carrinho abandonado - etapa 1", body: "Oi {{clientName}}! 👋\n\nEsqueceu de finalizar seu pedido? 🍕\n\nSeu carrinho de *R$ {{total}}* ainda está salvo pra você!\n\n👉 https://bonattopizza.manus.space" },

    // ── cart_abandoned_step2 (20 min — benefício) ──
    { event: "cart_abandoned_step2", channel: "push", title: "🛵 Entrega em 40 minutos!", body: "Seu pedido de R$ {{total}} ainda está salvo. Finalize agora!" },
    { event: "cart_abandoned_step2", channel: "push", title: "⏱️ Ainda dá tempo!", body: "Pedido de R$ {{total}} aguardando. Entregamos em até 40 min!" },
    { event: "cart_abandoned_step2", channel: "push", title: "🍕 Não perca sua pizza!", body: "Carrinho salvo: R$ {{total}}. Finalize e receba em 40 minutos!" },
    { event: "cart_abandoned_step2", channel: "whatsapp", title: "Carrinho abandonado - etapa 2", body: "{{clientName}}, ainda dá tempo! 🔥\n\nSeu pedido de *R$ {{total}}* ainda está salvo.\n\n🛵 Entregamos em até 40 minutos!\n\nNão perca sua pizza favorita:\n👉 https://bonattopizza.manus.space" },
    { event: "cart_abandoned_step2", channel: "whatsapp", title: "Carrinho abandonado - etapa 2", body: "Oi {{clientName}}! 🍕\n\nSeu carrinho de *R$ {{total}}* ainda está te esperando.\n\n🛵 Pedido rápido, entrega em até 40 min!\n\n👉 https://bonattopizza.manus.space" },

    // ── cart_abandoned_step3 (30 min — escassez + cupom) ──
    { event: "cart_abandoned_step3", channel: "push", title: "⏰ Última chance! 10% OFF", body: "Cupom {{coupon}} — válido 48h. Finalize agora!" },
    { event: "cart_abandoned_step3", channel: "push", title: "🎁 Desconto exclusivo para você!", body: "Use {{coupon}} e ganhe 10% OFF. Carrinho expira em breve!" },
    { event: "cart_abandoned_step3", channel: "push", title: "🚨 Carrinho expirando!", body: "Última chance: R$ {{total}} com cupom {{coupon}} — 10% OFF!" },
    { event: "cart_abandoned_step3", channel: "whatsapp", title: "Carrinho abandonado - etapa 3", body: "⏰ {{clientName}}, última chance!\n\nSeu carrinho expira em breve e não queremos que você perca sua pizza! 🍕\n\n🎁 Use o cupom exclusivo *{{coupon}}* e ganhe *10% de desconto*!\n\n⚡ Válido por apenas 48 horas!\n\n👉 https://bonattopizza.manus.space" },
    { event: "cart_abandoned_step3", channel: "whatsapp", title: "Carrinho abandonado - etapa 3", body: "{{clientName}}, não deixa passar! 😱\n\nSeu pedido de *R$ {{total}}* ainda está salvo e temos um presente pra você:\n\n🎟️ Cupom *{{coupon}}* — *10% de desconto*\n\n⏰ Expira em 48h!\n\n👉 https://bonattopizza.manus.space" },

    // ── reactivation_15 (inativo 15 dias — 5% OFF) ──
    { event: "reactivation_15", channel: "push", title: "🍕 Sentimos sua falta!", body: "5% OFF no seu próximo pedido — válido 72h. Cupom: {{coupon}}" },
    { event: "reactivation_15", channel: "push", title: "👋 Olá, {{clientName}}! Temos saudades!", body: "Volte a pedir e ganhe 5% de desconto com o cupom {{coupon}}!" },
    { event: "reactivation_15", channel: "whatsapp", title: "Reativação 15 dias", body: "Oi, {{clientName}}! 👋\n\nFaz uns dias que você não pede na Bonatto Pizza e a gente sentiu falta!\n\n🍕 Que tal uma pizza hoje? Use o cupom *{{coupon}}* e ganhe *5% de desconto* no seu próximo pedido!\n\n⏰ Válido por 72 horas.\n\n👉 https://bonattopizza.manus.space" },
    { event: "reactivation_15", channel: "whatsapp", title: "Reativação 15 dias", body: "{{clientName}}, a Bonatto sente sua falta! 🍕\n\nQue tal voltar com um desconto especial? Use *{{coupon}}* e ganhe *5% OFF* no seu próximo pedido!\n\n⏰ Válido por 72h.\n\n👉 https://bonattopizza.manus.space" },

    // ── reactivation_30 (inativo 30 dias — 10% OFF) ──
    { event: "reactivation_30", channel: "push", title: "🎁 10% OFF — Oferta exclusiva!", body: "Volte a pedir com desconto especial. Cupom: {{coupon}}" },
    { event: "reactivation_30", channel: "push", title: "🎯 Oferta especial para você!", body: "Está com saudade? 10% OFF com o cupom {{coupon}} — só por tempo limitado!" },
    { event: "reactivation_30", channel: "whatsapp", title: "Reativação 30 dias", body: "{{clientName}}, temos uma oferta especial para você! 🎁\n\nSabemos que faz um tempinho que você não pede na Bonatto Pizza. Que tal voltar com *10% de desconto*?\n\n🎟️ Cupom exclusivo: *{{coupon}}*\n\n⏰ Oferta por tempo limitado!\n\n👉 https://bonattopizza.manus.space" },
    { event: "reactivation_30", channel: "whatsapp", title: "Reativação 30 dias", body: "Oi {{clientName}}! 😊\n\nA Bonatto tem um presente especial pra você: *10% de desconto* no seu próximo pedido!\n\n🎟️ Use o cupom *{{coupon}}* e aproveite!\n\n⏰ Válido por 48h.\n\n👉 https://bonattopizza.manus.space" },

    // ── reactivation_60 (inativo 60 dias — 15% OFF) ──
    { event: "reactivation_60", channel: "push", title: "😢 Voltamos para você! 15% OFF", body: "Cupom especial de 15% para seu retorno: {{coupon}}" },
    { event: "reactivation_60", channel: "push", title: "🙏 Sua volta vale 15% OFF!", body: "Sentimos muito sua falta. Use {{coupon}} e volte com desconto!" },
    { event: "reactivation_60", channel: "whatsapp", title: "Reativação 60 dias", body: "{{clientName}}! 😢\n\nA gente sente muito a sua falta na Bonatto Pizza.\n\nPara te receber de volta, preparamos um cupom especial de *15% de desconto*:\n\n🎟️ *{{coupon}}*\n\n🍕 Novidades no cardápio te esperam!\n\n👉 https://bonattopizza.manus.space" },
    { event: "reactivation_60", channel: "whatsapp", title: "Reativação 60 dias", body: "{{clientName}}, sua volta é muito especial pra gente! 🥰\n\nComo presente de boas-vindas, aqui vai *15% de desconto*:\n\n🎟️ Cupom: *{{coupon}}*\n\n⏰ Válido por 24h. Corre!\n\n👉 https://bonattopizza.manus.space" },
  ];

  await db.insert(notificationTemplates).values(templates);
}

// --- DELIVERY ZONES (BAIRROS) -------------------------------------------------

export async function getAllDeliveryZones(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .orderBy(deliveryZones.neighborhood);
  }
  return db.select().from(deliveryZones).orderBy(deliveryZones.neighborhood);
}

export async function getDeliveryZoneByNeighborhood(neighborhood: string) {
  const db = await getDb();
  if (!db) return null;
  // Busca case-insensitive: normaliza removendo acentos via LOWER
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE LOWER(neighborhood) = LOWER(${neighborhood}) AND isActive = 1 LIMIT 1`
  );
  const list = (rows as unknown as [Array<Record<string, unknown>>])[0];
  if (!list || list.length === 0) return null;
  const r = list[0];
  return {
    id: Number(r.id),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive),
  };
}

export async function searchDeliveryZones(query: string) {
  const db = await getDb();
  if (!db) return [];
  const like = `%${query}%`;
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE LOWER(neighborhood) LIKE LOWER(${like}) AND isActive = 1 ORDER BY neighborhood LIMIT 10`
  );
  const list = (rows as unknown as [Array<Record<string, unknown>>])[0];
  return (list ?? []).map((r) => ({
    id: Number(r.id),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive),
  }));
}

export async function createDeliveryZone(data: {
  neighborhood: string;
  city?: string;
  deliveryFee: string;
  estimatedMinutes?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deliveryZones).values({
    neighborhood: data.neighborhood.trim(),
    city: data.city?.trim() ?? "",
    deliveryFee: data.deliveryFee,
    estimatedMinutes: data.estimatedMinutes ?? 45,
    isActive: true,
  });
  return (result as unknown as { insertId: number }).insertId;
}

export async function updateDeliveryZone(id: number, data: Partial<{
  neighborhood: string;
  city: string;
  deliveryFee: string;
  estimatedMinutes: number;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deliveryZones).set(data).where(eq(deliveryZones.id, id));
}

export async function deleteDeliveryZone(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
}

// ─── MENU SLIDES ──────────────────────────────────────────────────────────────
export async function getMenuSlides(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(menuSlides)
    .where(activeOnly ? eq(menuSlides.isActive, true) : undefined)
    .orderBy(menuSlides.sortOrder, menuSlides.id);
  return rows;
}

export async function createMenuSlide(data: {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  badgeText?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(menuSlides).values({
    title: data.title,
    subtitle: data.subtitle ?? null,
    imageUrl: data.imageUrl ?? null,
    videoUrl: data.videoUrl ?? null,
    badgeText: data.badgeText ?? null,
    ctaText: data.ctaText ?? null,
    ctaLink: data.ctaLink ?? null,
    sortOrder: data.sortOrder ?? 0,
    isActive: true,
  });
  const id = (result as unknown as { insertId: number }).insertId;
  const [row] = await db.select().from(menuSlides).where(eq(menuSlides.id, id));
  return row;
}

export async function updateMenuSlide(id: number, data: Partial<{
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  badgeText: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(menuSlides).set(data).where(eq(menuSlides.id, id));
  const [row] = await db.select().from(menuSlides).where(eq(menuSlides.id, id));
  return row;
}

export async function deleteMenuSlide(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(menuSlides).where(eq(menuSlides.id, id));
  return { success: true };
}

export async function seedMenuSlides() {
  const db = await getDb();
  if (!db) return { seeded: false, count: 0 };
  const existing = await db.select().from(menuSlides);
  if (existing.length > 0) return { seeded: false, count: existing.length };
  const slides = [
    {
      title: "2 Pizzas Grandes",
      subtitle: "Por apenas R$ 89,90! Escolha qualquer sabor do cardápio.",
      badgeText: "🔥 Promoção",
      ctaText: "Pedir agora",
      ctaLink: "/cardapio",
      sortOrder: 1,
    },
    {
      title: "Combo Casal",
      subtitle: "1 pizza grande + 1 refrigerante 1L por R$ 54,90.",
      badgeText: "❤️ Especial",
      ctaText: "Ver combo",
      ctaLink: "/cardapio",
      sortOrder: 2,
    },
    {
      title: "Frete Grátis",
      subtitle: "Em pedidos acima de R$ 60,00 para bairros selecionados.",
      badgeText: "🛵 Entrega",
      ctaText: "Fazer pedido",
      ctaLink: "/cardapio",
      sortOrder: 3,
    },
  ];
  for (const slide of slides) {
    await db.insert(menuSlides).values({ ...slide, isActive: true });
  }
  return { seeded: true, count: slides.length };
}

// ─── TAGS PERSONALIZADAS ──────────────────────────────────────────────────────

/** Lista todas as tags personalizadas criadas pelo admin */
export async function listCustomTags(): Promise<CustomTag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customTags).orderBy(customTags.name);
}

/** Cria uma nova tag personalizada */
export async function createCustomTag(data: { name: string; color: string; description?: string }): Promise<number> {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(customTags).values({
    name: data.name.trim().toLowerCase().replace(/\s+/g, "_"),
    color: data.color,
    description: data.description ?? null,
    createdAt: new Date(),
  });
  return Number((result[0] as { insertId: number }).insertId);
}

/** Atualiza uma tag personalizada */
export async function updateCustomTag(id: number, data: { name?: string; color?: string; description?: string }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updates: Record<string, unknown> = {};
  if (data.name) updates.name = data.name.trim().toLowerCase().replace(/\s+/g, "_");
  if (data.color) updates.color = data.color;
  if (data.description !== undefined) updates.description = data.description;
  await db.update(customTags).set(updates).where(eq(customTags.id, id));
}

/** Remove uma tag personalizada e todas as atribuições */
export async function deleteCustomTag(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags).where(eq(customCustomerTags.tagId, id));
  await db.delete(customTags).where(eq(customTags.id, id));
}

/** Atribui uma tag personalizada a um cliente */
export async function assignCustomTagToCustomer(userId: number, tagId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(customCustomerTags)
    .where(and(eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(customCustomerTags).values({ userId, tagId, assignedAt: new Date() });
  }
}

/** Remove uma tag personalizada de um cliente */
export async function removeCustomTagFromCustomer(userId: number, tagId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags)
    .where(and(eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId)));
}

/** Retorna as tags personalizadas de um cliente com detalhes */
export async function getCustomTagsForCustomer(userId: number): Promise<Array<CustomTag & { assignedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: customTags.id, name: customTags.name, color: customTags.color, description: customTags.description, createdAt: customTags.createdAt, assignedAt: customCustomerTags.assignedAt })
    .from(customCustomerTags)
    .innerJoin(customTags, eq(customCustomerTags.tagId, customTags.id))
    .where(eq(customCustomerTags.userId, userId))
    .orderBy(customCustomerTags.assignedAt);
  return rows;
}

/** Retorna todos os clientes com uma tag personalizada específica (por nome) */
export async function getCustomersByCustomTagName(tagName: string): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const tag = await db.select().from(customTags).where(eq(customTags.name, tagName)).limit(1);
  if (!tag[0]) return [];
  const rows = await db.select({ userId: customCustomerTags.userId })
    .from(customCustomerTags)
    .where(eq(customCustomerTags.tagId, tag[0].id));
  return rows.map((r) => r.userId);
}

/** Salva o stripeCustomerId no usuário */
export async function updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
}

// --- SCHEDULED NOTIFICATIONS --------------------------------------------------

export async function createScheduledNotification(data: InsertScheduledNotification): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scheduledNotifications).values(data);
  const resultHeader = Array.isArray(result) ? result[0] : result;
  return (resultHeader as unknown as { insertId: number }).insertId;
}

export async function listScheduledNotifications(): Promise<ScheduledNotification[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledNotifications).orderBy(desc(scheduledNotifications.scheduledAt));
}

export async function cancelScheduledNotification(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledNotifications)
    .set({ status: "cancelled" })
    .where(eq(scheduledNotifications.id, id));
}

export async function deleteScheduledNotification(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(scheduledNotifications).where(eq(scheduledNotifications.id, id));
}

export async function getPendingScheduledNotifications(): Promise<ScheduledNotification[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.status, "pending"),
        lte(scheduledNotifications.scheduledAt, now)
      )
    );
}

export async function markScheduledNotificationSent(id: number, sentCount: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledNotifications)
    .set({ status: "sent", sentAt: new Date(), sentCount })
    .where(eq(scheduledNotifications.id, id));
}


// --- CARROSSEL HERO ---
export async function getCarouselImages(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(carouselImages)
    .where(activeOnly ? eq(carouselImages.active, true) : undefined)
    .orderBy(carouselImages.sortOrder, carouselImages.id);
}
export async function createCarouselImage(data: { imageUrl: string; title?: string | null; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(carouselImages).values({
    imageUrl: data.imageUrl,
    title: data.title ?? null,
    sortOrder: data.sortOrder ?? 0,
    active: true,
  });
}
export async function updateCarouselImage(id: number, data: Partial<{ imageUrl: string; title: string | null; sortOrder: number; active: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(carouselImages).set(data).where(eq(carouselImages.id, id));
}
export async function deleteCarouselImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(carouselImages).where(eq(carouselImages.id, id));
}

/** Lista pedidos que têm mensagens, com contagem de não lidas para o admin */
export async function getOrdersWithMessages(storeId?: number): Promise<Array<{
  orderId: number;
  customerName: string;
  status: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  aiPaused: boolean;
}>> {
  const db = await getDb();
  if (!db) return [];
  // Busca todas as mensagens agrupadas por pedido
  const msgs = await db.select().from(orderMessages).orderBy(orderMessages.createdAt);
  if (msgs.length === 0) return [];
  // Agrupa por orderId
  const byOrder = new Map<number, typeof msgs>();
  for (const m of msgs) {
    if (!byOrder.has(m.orderId)) byOrder.set(m.orderId, []);
    byOrder.get(m.orderId)!.push(m);
  }
  const result: Array<{ orderId: number; customerName: string; status: string; lastMessage: string; lastMessageAt: Date; unreadCount: number; aiPaused: boolean }> = [];
  const orderIds = Array.from(byOrder.keys());
  for (const orderId of orderIds) {
    const orderMsgs = byOrder.get(orderId)!;
    const order = await getOrderById(orderId);
    if (!order) continue;
    // Filtrar por loja se storeId fornecido
    if (storeId !== undefined && (order as any).storeId !== storeId) continue;
    const unread = orderMsgs.filter(m => m.senderRole === 'customer' && !m.readAt).length;
    const last = orderMsgs[orderMsgs.length - 1];
    result.push({
      orderId,
      customerName: order.customerName,
      status: order.status,
      lastMessage: last.message,
      lastMessageAt: last.createdAt as Date,
      unreadCount: unread,
      aiPaused: (order as any).aiPaused ?? false,
    });
  }
  // Ordena: não lidas primeiro, depois por data da última mensagem
  return result.sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

// --- DRIVER PUSH SUBSCRIPTIONS -----------------------------------------------

export async function saveDriverPushSubscription(
  driverId: number,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(driverPushSubscriptions)
    .where(and(eq(driverPushSubscriptions.driverId, driverId), eq(driverPushSubscriptions.endpoint, endpoint)));
  if (existing.length > 0) {
    await db
      .update(driverPushSubscriptions)
      .set({ p256dh, auth, userAgent })
      .where(eq(driverPushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(driverPushSubscriptions).values({ driverId, endpoint, p256dh, auth, userAgent });
  }
}

export async function removeDriverPushSubscription(driverId: number, endpoint: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(driverPushSubscriptions)
    .where(and(eq(driverPushSubscriptions.driverId, driverId), eq(driverPushSubscriptions.endpoint, endpoint)));
}

export async function getDriverPushSubscriptions(driverId: number): Promise<DriverPushSubscription[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driverPushSubscriptions).where(eq(driverPushSubscriptions.driverId, driverId));
}

// --- DRIVER TODAY STATS -------------------------------------------------------

export async function getDriverTodayStats(driverId: number) {
  const db = await getDb();
  if (!db) return { deliveries: 0, earnings: 0, avgRating: 0, ratingCount: 0 };
  // Usa America/Sao_Paulo para calcular início do dia
  const todayStart = getTodayStartUtc();
  const todayOrders = await db
    .select({ id: orders.id, total: orders.total })
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        eq(orders.status, "delivered"),
        gte(orders.updatedAt, todayStart)
      )
    );
  const deliveries = todayOrders.length;
  // Estimativa de ganho: 10% do total entregue (configurável futuramente)
  const earnings = todayOrders.reduce((acc, o) => acc + Number(o.total) * 0.1, 0);
  const ratingResult = await db
    .select({
      avg: sql<number>`AVG(${deliveryRatings.rating})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(deliveryRatings)
    .where(
      and(
        eq(deliveryRatings.driverId, driverId),
        gte(deliveryRatings.createdAt, todayStart)
      )
    );
  return {
    deliveries,
    earnings,
    avgRating: Number(ratingResult[0]?.avg ?? 0),
    ratingCount: Number(ratingResult[0]?.count ?? 0),
  };
}

// --- DRIVER ACTIVE ORDER DETAILS ---------------------------------------------

export async function getDriverActiveOrderDetails(driverId: number) {
  const db = await getDb();
  if (!db) return null;
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        eq(orders.status, "out_for_delivery")
      )
    )
    .orderBy(desc(orders.updatedAt))
    .limit(1);
  if (!activeOrders.length) return null;
  const order = activeOrders[0];
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return { order, items };
}

// --- DRIVER ALL ASSIGNED ORDERS (lista completa) --------------------------------

export async function getDriverAssignedOrders(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        eq(orders.status, "out_for_delivery")
      )
    )
    .orderBy(desc(orders.updatedAt));
  if (!activeOrders.length) return [];
  // Buscar itens de todos os pedidos em paralelo
  const results = await Promise.all(
    activeOrders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      return { order, items };
    })
  );
  return results;
}

// --- DRIVER CONFIRM DELIVERY -------------------------------------------------

export async function driverConfirmDelivery(
  driverId: number,
  orderId: number
): Promise<{ success: boolean; error?: string; customerId?: number | null }> {
  const db = await getDb();
  if (!db) return { success: false, error: "DB not available" };
  const orderResult = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.driverId, driverId),
        eq(orders.status, "out_for_delivery")
      )
    )
    .limit(1);
  if (!orderResult.length) {
    return { success: false, error: "Pedido não encontrado ou já foi finalizado" };
  }
  const order = orderResult[0];
  await db
    .update(orders)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  // Limpa o orderId da localização do motoboy
  await db
    .update(driverLocations)
    .set({ orderId: null })
    .where(eq(driverLocations.driverId, driverId));
  return { success: true, customerId: order.userId };
}

// --- DRIVER TODAY DELIVERIES (histórico do dia) --------------------------------

export async function getDriverTodayDeliveries(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  // Usa America/Sao_Paulo para calcular início do dia corretamente
  const todayStartUtc = getTodayStartUtc();
  return db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      deliveryAddress: orders.deliveryAddress,
      total: orders.total,
      status: orders.status,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        eq(orders.status, "delivered"),
        gte(orders.updatedAt, todayStartUtc)
      )
    )
    .orderBy(desc(orders.updatedAt));
}

// ─── CLIENT ALERTS ────────────────────────────────────────────────────────────

/** Cria um alerta visível para todos os clientes (ou para uma loja específica) */
export async function createClientAlert(data: {
  type: "promotion" | "raffle" | "coupon" | "club" | "custom";
  title: string;
  message: string;
  icon?: string;
  url?: string;
  storeId?: number;
  expiresAt?: Date;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(clientAlerts).values({
    type: data.type,
    title: data.title,
    message: data.message,
    icon: data.icon ?? "🔔",
    url: data.url,
    storeId: data.storeId,
    active: true,
    expiresAt: data.expiresAt,
  });
  return (result as any).insertId as number;
}

/** Lista alertas ativos não lidos pelo usuário (máx 20) */
export async function listClientAlerts(userId: number): Promise<(ClientAlert & { read: boolean })[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  // Busca alertas ativos não expirados
  const alerts = await db
    .select()
    .from(clientAlerts)
    .where(
      and(
        eq(clientAlerts.active, true),
        or(isNull(clientAlerts.expiresAt), gt(clientAlerts.expiresAt, now))
      )
    )
    .orderBy(desc(clientAlerts.createdAt))
    .limit(20);

  if (alerts.length === 0) return [];

  // Busca quais o usuário já leu
  const reads = await db
    .select({ alertId: clientAlertReads.alertId })
    .from(clientAlertReads)
    .where(eq(clientAlertReads.userId, userId));

  const readSet = new Set(reads.map((r) => r.alertId));
  return alerts.map((a) => ({ ...a, read: readSet.has(a.id) }));
}

/** Marca um alerta como lido para o usuário */
export async function dismissClientAlert(alertId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(clientAlertReads).values({ alertId, userId });
  } catch {
    // unique constraint — já lido
  }
}

/** Conta alertas não lidos pelo usuário */
export async function countUnreadClientAlerts(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const alerts = await db
    .select({ id: clientAlerts.id })
    .from(clientAlerts)
    .where(
      and(
        eq(clientAlerts.active, true),
        or(isNull(clientAlerts.expiresAt), gt(clientAlerts.expiresAt, now))
      )
    );
  if (alerts.length === 0) return 0;
  const alertIds = alerts.map((a) => a.id);
  const reads = await db
    .select({ alertId: clientAlertReads.alertId })
    .from(clientAlertReads)
    .where(and(eq(clientAlertReads.userId, userId), inArray(clientAlertReads.alertId, alertIds)));
  return alertIds.length - reads.length;
}

/** Distribuição de pedidos (quantidade e receita) por categoria no período */
export async function getTopCategories(
  startDate: Date,
  endDate: Date,
  storeId?: number
): Promise<{ categoryName: string; totalQuantity: number; totalRevenue: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const storeFilter = storeId ? sql` AND o.\`storeId\` = ${storeId}` : sql``;
  const rows = await db.execute(
    sql`SELECT c.\`name\` AS categoryName,
               CAST(COALESCE(SUM(oi.\`quantity\`), 0) AS UNSIGNED) AS totalQuantity,
               CAST(COALESCE(SUM(oi.\`subtotal\`), 0) AS DECIMAL(10,2)) AS totalRevenue
        FROM \`order_items\` oi
        INNER JOIN \`orders\` o ON oi.\`orderId\` = o.\`id\`
        INNER JOIN \`products\` p ON oi.\`productId\` = p.\`id\`
        INNER JOIN \`categories\` c ON p.\`categoryId\` = c.\`id\`
        WHERE o.\`createdAt\` >= ${startDate}
          AND o.\`createdAt\` <= ${endDate}
          AND o.\`status\` != 'cancelled'${storeFilter}
        GROUP BY c.\`id\`, c.\`name\`
        ORDER BY totalQuantity DESC`
  );
  const arr = Array.isArray(rows) ? rows : (rows as any)[0] ?? [];
  return arr.map((r: any) => ({
    categoryName: String(r.categoryName ?? ''),
    totalQuantity: Number(r.totalQuantity ?? 0),
    totalRevenue: Number(r.totalRevenue ?? 0),
  }));
}


// ============================================================================
// Security-hardening helpers: webhook idempotency, loyalty credit ledger,
// coupon redemption ledger, atomic loyalty debit and order status guard.
// ============================================================================

/**
 * Record a webhook event id (Stripe or Asaas). Returns `true` when the event
 * is being processed for the first time, `false` if it was already processed.
 * Uses the UNIQUE(provider, eventId) constraint to provide atomic idempotency.
 */
export async function recordWebhookEventOnce(
  provider: "stripe" | "asaas",
  eventId: string,
  eventType?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  try {
    await db.insert(webhookEvents).values({ provider, eventId, eventType: eventType ?? null });
    return true;
  } catch (err) {
    const msg = (err as { message?: string } | undefined)?.message ?? "";
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) return false;
    throw err;
  }
}

/**
 * Creates (idempotently) a loyalty credit for a given order. Returns true when
 * the credit was created for the first time. Subsequent calls for the same
 * orderId are a no-op and return false.
 */
export async function creditLoyaltyForOrderIdempotent(
  orderId: number,
  userId: number,
  points: number,
  description?: string
): Promise<boolean> {
  if (points <= 0) return false;
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(loyaltyOrderCredits).values({ orderId, userId, points });
  } catch (err) {
    const msg = (err as { message?: string } | undefined)?.message ?? "";
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) return false;
    throw err;
  }
  const balanceBefore = await getUserLoyaltyPoints(userId);
  const balanceAfter = balanceBefore + points;
  await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${points}` }).where(eq(users.id, userId));
  await db.insert(loyaltyTransactions).values({
    userId,
    orderId,
    type: "earn",
    points,
    description: description ?? `+${points} pontos pelo pedido #${orderId}`,
    balanceBefore,
    balanceAfter,
  });
  return true;
}

/**
 * Atomic loyalty points debit: uses a conditional UPDATE that only succeeds
 * if the current balance is sufficient. Returns ok=false without mutating
 * state on insufficient balance or concurrent modification.
 */
export async function deductLoyaltyPointsAtomic(
  userId: number,
  points: number,
  orderId?: number,
  description?: string
): Promise<{ ok: boolean; newBalance: number }> {
  if (points <= 0) return { ok: true, newBalance: await getUserLoyaltyPoints(userId) };
  const db = await getDb();
  if (!db) return { ok: false, newBalance: 0 };
  const result = await db
    .update(users)
    .set({ loyaltyPoints: sql`${users.loyaltyPoints} - ${points}` })
    .where(and(eq(users.id, userId), gte(users.loyaltyPoints, points)));
  const affected = (result as any)?.rowsAffected ?? (result as any)?.[0]?.affectedRows ?? 0;
  if (!affected) return { ok: false, newBalance: await getUserLoyaltyPoints(userId) };
  const newBalance = await getUserLoyaltyPoints(userId);
  await db.insert(loyaltyTransactions).values({
    userId,
    orderId: orderId ?? null,
    type: "redeem",
    points: -points,
    description: description ?? `-${points} pontos resgatados como desconto`,
    balanceBefore: newBalance + points,
    balanceAfter: newBalance,
  });
  return { ok: true, newBalance };
}

/**
 * Refunds loyalty points deducted for an order (used when an order is cancelled).
 * Returns the number of points refunded.
 */
export async function refundLoyaltyPointsForOrder(orderId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const order = await getOrderById(orderId);
  if (!order || !order.userId) return 0;
  const pointsUsed = order.pointsUsed ?? 0;
  if (pointsUsed <= 0) return 0;
  // Check if we already refunded (to prevent double-refund)
  const existing = await db
    .select()
    .from(loyaltyTransactions)
    .where(and(
      eq(loyaltyTransactions.orderId, orderId),
      eq(loyaltyTransactions.type, "manual"),
    ))
    .limit(1);
  if (existing.length > 0 && existing[0].description?.startsWith("refund:")) return 0;
  const balanceBefore = await getUserLoyaltyPoints(order.userId);
  const balanceAfter = balanceBefore + pointsUsed;
  await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${pointsUsed}` }).where(eq(users.id, order.userId));
  await db.insert(loyaltyTransactions).values({
    userId: order.userId,
    orderId,
    type: "manual",
    points: pointsUsed,
    description: `refund: estorno de pontos por cancelamento do pedido #${orderId}`,
    balanceBefore,
    balanceAfter,
  });
  return pointsUsed;
}

/**
 * Register a coupon redemption tied to an order. Throws on duplicate for the
 * same order (uses UNIQUE(orderId)). Combined with a conditional increment
 * of coupon.usedCount, this allows safe reversal on cancel.
 */
export async function registerCouponRedemption(
  couponId: number,
  code: string,
  orderId: number,
  userId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(couponRedemptions).values({ couponId, code, orderId, userId });
}

export async function revertCouponRedemption(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select()
    .from(couponRedemptions)
    .where(eq(couponRedemptions.orderId, orderId))
    .limit(1);
  if (!existing.length || existing[0].reverted) return false;
  await db.update(couponRedemptions).set({ reverted: true }).where(eq(couponRedemptions.orderId, orderId));
  await db
    .update(coupons)
    .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
    .where(eq(coupons.id, existing[0].couponId));
  return true;
}

/**
 * Atomic state-machine-guarded order status transition.
 * Returns true if the update happened (i.e. current DB status matches
 * `expectedCurrent`), false otherwise.
 */
export async function updateOrderStatusGuarded(
  id: number,
  nextStatus: Order["status"],
  allowedCurrent: Order["status"][]
): Promise<{ ok: boolean; previous?: Order["status"] }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const current = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!current[0]) return { ok: false };
  const previous = current[0].status;
  if (!allowedCurrent.includes(previous)) return { ok: false, previous };
  const result = await db
    .update(orders)
    .set({ status: nextStatus })
    .where(and(eq(orders.id, id), eq(orders.status, previous)));
  const affected = (result as any)?.rowsAffected ?? (result as any)?.[0]?.affectedRows ?? 0;
  return { ok: affected > 0, previous };
}

/**
 * Cancel `pending`, unpaid orders older than `olderThanMinutes` (default 120 min).
 * For each cancelled order, revert the coupon usage and refund loyalty points
 * if applicable. Returns the list of cancelled order ids.
 */
export async function cancelStaleUnpaidOrders(olderThanMinutes = 120): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentStatus, "pending"),
        lte(orders.createdAt, cutoff),
        // Do not auto-cancel cash/in-person orders — those start pending but are
        // legitimately unpaid until delivery.
        or(
          eq(orders.paymentMethod, "credit_card"),
          eq(orders.paymentMethod, "debit_card"),
          eq(orders.paymentMethod, "pix")
        )
      )
    );
  const cancelled: number[] = [];
  for (const row of stale) {
    const guard = await updateOrderStatusGuarded(row.id, "cancelled", ["pending"]);
    if (guard.ok) {
      cancelled.push(row.id);
      try {
        await refundLoyaltyPointsForOrder(row.id);
      } catch (err) {
        console.error("[cancelStaleUnpaidOrders] refund error:", err);
      }
      try {
        await revertCouponRedemption(row.id);
      } catch (err) {
        console.error("[cancelStaleUnpaidOrders] coupon revert error:", err);
      }
    }
  }
  return cancelled;
}
