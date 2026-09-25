import { and, desc, eq, gte, gt, ilike, inArray, isNull, like, lte, not, or, sql, type SQL } from "drizzle-orm";
import { getTodayStartUtc, getTodayEndUtc } from "../shared/timezone.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { hashRecoveryToken } from "./securityTokens.ts";
import {
  Category,
  Coupon,
  CustomerMetric,
  DiningTable,
  InsertCategory,
  InsertDiningTable,
  InsertStore,
  InsertIngredient,
  InsertOrder,
  InsertOrderItem,
  InsertProduct,
  InsertStaffMember,
  InsertTableSession,
  InsertUser,
  Ingredient,
  InventoryMovement,
  Order,
  OrderItem,
  Product,
  Promotion,
  Raffle,
  RaffleEntry,
  StaffMember,
  TableSession,
  Transaction,
  Upsell,
  categories,
  customerAuthProviders,
  authEventLogs,
  userConsents,
  customerMetrics,
  coupons,
  diningTables,
  orderItems,
  orders,
  otpCodes,
  products,
  productIngredients,
  promotions,
  raffleEntries,
  raffles,
  ingredients,
  inventoryMovements,
  staffMembers,
  tableOrderLinks,
  tableSessionItems,
  tableSessions,
  transactions,
  upsells,
  users,
  stores,
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
  NotificationTemplate,
  InsertNotificationTemplate,
  deliveryZones,
  menuSlides,
  MenuSlide,
  customTags,
  customCustomerTags,
  CustomTag,
  customerTags,
  abandonedCarts,
  journeys,
  journeyExecutions,
  scheduledNotifications,
  ScheduledNotification,
  InsertScheduledNotification,
  carouselImages,
  CarouselImage,
  driverPushSubscriptions,
  DriverPushSubscription,
  loyaltyTransactions,
  customerStoreAccounts,
  clientAlerts,
  clientAlertReads,
  ClientAlert,
  webhookEvents,
  loyaltyOrderCredits,
  couponRedemptions,
  orderRequests,
  eventOutbox,
  orderStageLogs,
  storeAuditLogs,
} from "../drizzle/schema.ts";
import { ENV } from "./_core/env.ts";
import { publishOrderRealtimeEvent } from "./realtime/orderEvents.ts";

type DatabaseClient = ReturnType<typeof drizzle>;

let _db: DatabaseClient | null = null;
let _pool: Pool | null = null;
const _memoCache = new Map<string, { expiresAt: number; value: unknown }>();

async function withShortCache<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = _memoCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }
  const value = await factory();
  _memoCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

function buildConnectionStringFromParts(): string | null {
  const host = process.env.DATABASE_HOST?.trim();
  const user = process.env.DATABASE_USER?.trim();
  const password = process.env.DATABASE_PASSWORD?.trim();
  const database = process.env.DATABASE_NAME?.trim() || "bonatto";
  const port = process.env.DATABASE_PORT?.trim() || "5432";
  if (!host || !user || !password) return null;

  // Keep TLS configuration out of the connection string.
  // node-postgres can let sslmode query parameters override the explicit
  // Pool.ssl object. We configure TLS once in buildPostgresPool instead.
  return new URL(
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
  ).toString();
}

function normalizeDatabaseUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  let normalized = rawUrl.trim();
  if (!normalized) return null;
  if (/^mysql:/i.test(normalized)) throw new Error("DATABASE_URL must use postgresql://, not mysql://");
  if (/^postgres:\/\//i.test(normalized)) {
    normalized = "postgresql://" + normalized.slice("postgres://".length);
  }
  return normalized.replace(/[?&]ssl-mode=REQUIRED/gi, (match) =>
    match.startsWith("?") ? "?sslmode=require" : "&sslmode=require",
  );
}

function buildPostgresPool(connectionString: string) {
  const sslMode = (process.env.DATABASE_SSL_MODE ?? "").trim().toLowerCase();
  const hostname = new URL(connectionString).hostname.toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const requiresSsl = !isLocalhost && (
    sslMode === "require" ||
    sslMode === "required" ||
    /[?&]sslmode=require/i.test(connectionString)
  );
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  });
  pool.on("error", (error) => {
    console.error("[Database] Pool error:", error);
    resetDbState();
  });
  return pool;
}

function resetDbState() {
  try {
    _pool?.end().catch(() => undefined);
  } catch {
    // ignore
  }
  _db = null;
  _pool = null;
  _memoCache.clear();
}

function isRetryableDbError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ECONNRESET" || code === "PROTOCOL_CONNECTION_LOST" || code === "ETIMEDOUT";
}

async function withDbRetry<T>(operation: (db: DatabaseClient) => Promise<T>): Promise<T> {
  let db = await getDb();
  if (!db) throw new Error("DB not available");
  try {
    return await operation(db);
  } catch (error) {
    if (!isRetryableDbError((error as any)?.cause ?? error)) {
      throw error;
    }
    console.warn("[Database] Retrying operation after connection reset");
    resetDbState();
    db = await getDb();
    if (!db) throw new Error("DB not available after retry");
    return operation(db);
  }
}

type Coordinates = { lat: number; lng: number };

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineDistanceKm(a: Coordinates, b: Coordinates) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const arc =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address.trim();
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BonattoPlatform/1.0",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = payload[0];
  const lat = toNumberOrNull(first?.lat);
  const lng = toNumberOrNull(first?.lon);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

export async function getDb() {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL) || buildConnectionStringFromParts();
  if (!_db && !_pool && connectionString) {
    try {
      _pool = buildPostgresPool(connectionString);
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      resetDbState();
    }
  }
  return _db;
}

// --- USERS --------------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<{ isNew: boolean }> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  return withDbRetry(async (db) => {
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

    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
    return { isNew };
  });
}

export async function getUserByOpenId(openId: string) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  });
}

export async function getUserByEmail(email: string) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  });
}

export async function getUserByAuthProvider(
  provider: "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus",
  providerUserId: string
) {
  return withDbRetry(async (db) => {
    const rows = await db
      .select({ userId: customerAuthProviders.userId })
      .from(customerAuthProviders)
      .where(
        and(
          eq(customerAuthProviders.provider, provider),
          eq(customerAuthProviders.providerUserId, providerUserId)
        )
      )
      .limit(1);

    if (!rows[0]?.userId) return undefined;
    return getUserById(rows[0].userId);
  });
}

export async function createEmailUser(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
}) {
  await withDbRetry(async (db) => {
    await db.insert(users).values({
      openId: data.openId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      loginMethod: "email",
      emailVerified: false,
      lastSignedIn: new Date(),
    });
  });
}

export async function updateUserPasswordHash(openId: string, passwordHash: string) {
  await withDbRetry(async (db) => {
    await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
  });
}

export async function saveResetToken(email: string, token: string, expiresAt: Date) {
  const tokenHash = hashRecoveryToken(token);
  await withDbRetry(async (db) => {
    await db.update(users)
      .set({ resetToken: tokenHash, resetTokenExpiresAt: expiresAt })
      .where(eq(users.email, email));
  });
}

export async function getUserByResetToken(token: string) {
  const tokenHash = hashRecoveryToken(token);
  return withDbRetry(async (db) => {
    const result = await db.select().from(users)
      .where(or(
        eq(users.resetToken, tokenHash),
        eq(users.resetToken, token),
      ))
      .limit(1);
    return result[0];
  });
}

export async function clearResetToken(openId: string) {
  await withDbRetry(async (db) => {
    await db.update(users).set({ resetToken: null, resetTokenExpiresAt: null }).where(eq(users.openId, openId));
  });
}

// --- CATEGORIES ---------------------------------------------------------------

export async function getCategories(input: boolean | { activeOnly?: boolean; storeId?: number } = true) {
  const db = await getDb();
  if (!db) return [];
  const opts = typeof input === "boolean" ? { activeOnly: input } : input;
  const conditions: SQL[] = [];
  if (opts.activeOnly !== false) conditions.push(eq(categories.active, true));
  if (opts.storeId !== undefined) conditions.push(eq(categories.storeId, opts.storeId));
  return db.select().from(categories)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(categories.sortOrder, categories.name);
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
  const conditions: SQL[] = [];
  if (opts?.activeOnly !== false) conditions.push(eq(products.active, true));
  if (opts?.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts?.storeId !== undefined) conditions.push(eq(products.storeId, opts.storeId));
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

function toFixedQuantity(value: string | number, scale = 3) {
  return Number(value).toFixed(scale);
}

// --- INVENTORY / RECIPES ------------------------------------------------------

export async function getIngredients(opts?: { storeId?: number; activeOnly?: boolean; lowStockOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [] as Ingredient[];
  const conditions: Array<any> = [];
  if (opts?.storeId) conditions.push(eq(ingredients.storeId, opts.storeId));
  if (opts?.activeOnly !== false) conditions.push(eq(ingredients.active, true));
  if (opts?.lowStockOnly) conditions.push(sql`CAST(${ingredients.currentStock} AS DECIMAL(12,3)) <= CAST(${ingredients.minimumStock} AS DECIMAL(12,3))`);
  return db
    .select()
    .from(ingredients)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(ingredients.name);
}

export async function getIngredientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
  return rows[0];
}

export async function createIngredient(data: InsertIngredient) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(ingredients).values(data);
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { insertId: number }).insertId;
}

export async function updateIngredient(id: number, data: Partial<InsertIngredient>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(ingredients).set(data).where(eq(ingredients.id, id));
}

export async function deleteIngredient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(ingredients).set({ active: false }).where(eq(ingredients.id, id));
}

export async function adjustIngredientStock(input: {
  ingredientId: number;
  quantityDelta: string | number;
  movementType: "entry" | "manual_adjustment" | "waste" | "reversal";
  reason?: string | null;
  performedByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const ingredient = await getIngredientById(input.ingredientId);
  if (!ingredient) throw new Error("Ingrediente não encontrado");

  const previousStock = Number(ingredient.currentStock ?? 0);
  const delta = Number(input.quantityDelta);
  const nextStock = previousStock + delta;

  await db.update(ingredients).set({ currentStock: toFixedQuantity(nextStock) }).where(eq(ingredients.id, input.ingredientId));
  await db.insert(inventoryMovements).values({
    ingredientId: input.ingredientId,
    storeId: ingredient.storeId ?? null,
    movementType: input.movementType,
    quantityDelta: toFixedQuantity(delta),
    previousStock: toFixedQuantity(previousStock),
    nextStock: toFixedQuantity(nextStock),
    reason: input.reason ?? null,
    performedByUserId: input.performedByUserId ?? null,
  });

  return { ingredientId: input.ingredientId, previousStock, nextStock, quantityDelta: delta };
}

export async function getInventoryMovements(opts?: { ingredientId?: number; orderId?: number; limit?: number; storeId?: number }) {
  const db = await getDb();
  if (!db) return [] as InventoryMovement[];
  const conditions: Array<any> = [];
  if (opts?.ingredientId) conditions.push(eq(inventoryMovements.ingredientId, opts.ingredientId));
  if (opts?.orderId) conditions.push(eq(inventoryMovements.orderId, opts.orderId));
  if (opts?.storeId) conditions.push(eq(inventoryMovements.storeId, opts.storeId));
  return db
    .select()
    .from(inventoryMovements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(opts?.limit ?? 200);
}

export async function getProductRecipe(productId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: productIngredients.id,
      productId: productIngredients.productId,
      ingredientId: productIngredients.ingredientId,
      quantity: productIngredients.quantity,
      wastePercent: productIngredients.wastePercent,
      active: productIngredients.active,
      ingredientName: ingredients.name,
      ingredientUnit: ingredients.unit,
      ingredientCurrentStock: ingredients.currentStock,
      ingredientMinimumStock: ingredients.minimumStock,
      ingredientActive: ingredients.active,
    })
    .from(productIngredients)
    .innerJoin(ingredients, eq(productIngredients.ingredientId, ingredients.id))
    .where(and(eq(productIngredients.productId, productId), eq(productIngredients.active, true)))
    .orderBy(ingredients.name);
  return rows;
}

export async function setProductRecipe(
  productId: number,
  items: Array<{ ingredientId: number; quantity: string | number; wastePercent?: string | number | null }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(productIngredients).where(eq(productIngredients.productId, productId));
  if (!items.length) return [];
  await db.insert(productIngredients).values(
    items.map((item) => ({
      productId,
      ingredientId: item.ingredientId,
      quantity: toFixedQuantity(item.quantity),
      wastePercent: Number(item.wastePercent ?? 0).toFixed(2),
      active: true,
    }))
  );
  return getProductRecipe(productId);
}

export async function consumeInventoryForOrder(orderId: number) {
  const db = await getDb();
  if (!db) return { consumed: false, reason: "db_unavailable", movements: [] as Array<Record<string, unknown>> };

  const existing = await db
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.movementType, "sale_consumption")))
    .limit(1);
  if (existing.length > 0) return { consumed: false, reason: "already_consumed", movements: [] as Array<Record<string, unknown>> };

  const items = await getOrderItems(orderId);
  if (!items.length) return { consumed: false, reason: "empty_order", movements: [] as Array<Record<string, unknown>> };

  const productIds = [...new Set(items.map((item) => item.productId))];
  const recipes = await db
    .select()
    .from(productIngredients)
    .where(and(inArray(productIngredients.productId, productIds), eq(productIngredients.active, true)));

  if (!recipes.length) return { consumed: false, reason: "no_recipe", movements: [] as Array<Record<string, unknown>> };

  const ingredientIds = [...new Set(recipes.map((recipe) => recipe.ingredientId))];
  const ingredientRows = await db.select().from(ingredients).where(inArray(ingredients.id, ingredientIds));
  const ingredientMap = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  const movements: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const itemRecipes = recipes.filter((recipe) => recipe.productId === item.productId);
    for (const recipe of itemRecipes) {
      const ingredient = ingredientMap.get(recipe.ingredientId);
      if (!ingredient) continue;
      const baseQty = Number(recipe.quantity) * Number(item.quantity);
      const wasteMultiplier = 1 + Number(recipe.wastePercent ?? 0) / 100;
      const totalQty = Number((baseQty * wasteMultiplier).toFixed(3));
      const previousStock = Number(ingredient.currentStock ?? 0);
      const nextStock = previousStock - totalQty;

      await db.update(ingredients).set({ currentStock: toFixedQuantity(nextStock) }).where(eq(ingredients.id, ingredient.id));
      await db.insert(inventoryMovements).values({
        ingredientId: ingredient.id,
        storeId: ingredient.storeId ?? null,
        orderId,
        orderItemId: item.id,
        movementType: "sale_consumption",
        quantityDelta: toFixedQuantity(-totalQty),
        previousStock: toFixedQuantity(previousStock),
        nextStock: toFixedQuantity(nextStock),
        reason: `Consumo automático do pedido #${orderId}`,
      });

      ingredient.currentStock = toFixedQuantity(nextStock);
      movements.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        quantityConsumed: totalQty,
        previousStock,
        nextStock,
      });
    }
  }

  return { consumed: movements.length > 0, reason: movements.length > 0 ? "ok" : "no_bound_ingredients", movements };
}

export async function reverseInventoryForOrder(orderId: number) {
  const db = await getDb();
  if (!db) return { reversed: false, reason: "db_unavailable", movements: [] as Array<Record<string, unknown>> };

  const consumptionRows = await db
    .select()
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.movementType, "sale_consumption")));
  if (!consumptionRows.length) return { reversed: false, reason: "no_consumption", movements: [] as Array<Record<string, unknown>> };

  const existingReversal = await db
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.movementType, "reversal")))
    .limit(1);
  if (existingReversal.length > 0) return { reversed: false, reason: "already_reversed", movements: [] as Array<Record<string, unknown>> };

  const movements: Array<Record<string, unknown>> = [];
  for (const row of consumptionRows) {
    const ingredient = await getIngredientById(row.ingredientId);
    if (!ingredient) continue;
    const previousStock = Number(ingredient.currentStock ?? 0);
    const delta = Math.abs(Number(row.quantityDelta));
    const nextStock = previousStock + delta;

    await db.update(ingredients).set({ currentStock: toFixedQuantity(nextStock) }).where(eq(ingredients.id, ingredient.id));
    await db.insert(inventoryMovements).values({
      ingredientId: ingredient.id,
      storeId: ingredient.storeId ?? null,
      orderId,
      orderItemId: row.orderItemId ?? null,
      movementType: "reversal",
      quantityDelta: toFixedQuantity(delta),
      previousStock: toFixedQuantity(previousStock),
      nextStock: toFixedQuantity(nextStock),
      reason: `Estorno automático do pedido #${orderId}`,
    });
    movements.push({ ingredientId: ingredient.id, restoredQuantity: delta, previousStock, nextStock });
  }

  return { reversed: movements.length > 0, reason: movements.length > 0 ? "ok" : "no_rows", movements };
}

// --- STAFF / DINING ROOM ------------------------------------------------------

export async function getStaffMembers(opts?: { storeId?: number; role?: StaffMember["role"]; activeOnly?: boolean }) {
  return withDbRetry(async (db) => {
    const conditions: Array<any> = [];
    if (opts?.storeId) conditions.push(eq(staffMembers.storeId, opts.storeId));
    if (opts?.role) conditions.push(eq(staffMembers.role, opts.role));
    if (opts?.activeOnly !== false) conditions.push(eq(staffMembers.active, true));
    return db
      .select()
      .from(staffMembers)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(staffMembers.role, staffMembers.name);
  });
}

export async function getStaffMemberById(id: number) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(staffMembers).where(eq(staffMembers.id, id)).limit(1);
    return rows[0];
  });
}

export async function createStaffMember(data: InsertStaffMember) {
  return withDbRetry(async (db) => {
    const result = await db.insert(staffMembers).values(data);
    const header = Array.isArray(result) ? result[0] : result;
    return (header as { insertId: number }).insertId;
  });
}

export async function updateStaffMember(id: number, data: Partial<InsertStaffMember>) {
  await withDbRetry(async (db) => {
    await db.update(staffMembers).set(data).where(eq(staffMembers.id, id));
  });
}

export async function deleteStaffMember(id: number) {
  await withDbRetry(async (db) => {
    await db.update(staffMembers).set({ active: false }).where(eq(staffMembers.id, id));
  });
}

export async function ensureStaffAccessToken(staffId: number) {
  return withDbRetry(async (db) => {
    const [staff] = await db.select().from(staffMembers).where(eq(staffMembers.id, staffId)).limit(1);
    if (!staff) throw new Error("Membro da equipe nao encontrado.");
    const existingToken = typeof staff.accessToken === "string" && staff.accessToken.trim() ? staff.accessToken.trim() : null;
    if (existingToken) return existingToken;
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await db.update(staffMembers).set({ accessToken: token }).where(eq(staffMembers.id, staffId));
    return token;
  });
}

export async function regenerateStaffAccessToken(staffId: number) {
  return withDbRetry(async (db) => {
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await db.update(staffMembers).set({ accessToken: token }).where(eq(staffMembers.id, staffId));
    return token;
  });
}

export async function getStaffMemberByAccessToken(token: string) {
  return withDbRetry(async (db) => {
    const rows = await db
      .select()
      .from(staffMembers)
      .where(and(eq(staffMembers.accessToken, token), eq(staffMembers.active, true)))
      .limit(1);
    return rows[0];
  });
}

export async function getDiningTables(opts?: { storeId?: number; activeOnly?: boolean }) {
  return withDbRetry(async (db) => {
    const conditions: Array<any> = [];
    if (opts?.storeId) conditions.push(eq(diningTables.storeId, opts.storeId));
    if (opts?.activeOnly !== false) conditions.push(eq(diningTables.active, true));
    return db
      .select()
      .from(diningTables)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(diningTables.name);
  });
}

export async function getDiningTableById(id: number) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(diningTables).where(eq(diningTables.id, id)).limit(1);
    return rows[0];
  });
}

export async function createDiningTable(data: InsertDiningTable) {
  return withDbRetry(async (db) => {
    const result = await db.insert(diningTables).values(data);
    const header = Array.isArray(result) ? result[0] : result;
    return (header as { insertId: number }).insertId;
  });
}

export async function updateDiningTable(id: number, data: Partial<InsertDiningTable>) {
  await withDbRetry(async (db) => {
    await db.update(diningTables).set(data).where(eq(diningTables.id, id));
  });
}

export async function deleteDiningTable(id: number) {
  await withDbRetry(async (db) => {
    await db.update(diningTables).set({ active: false, status: "free" }).where(eq(diningTables.id, id));
  });
}

async function getTableSessionComputedTotals(db: any, tableSessionId: number) {
  const itemTotalsRows = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(\`unitPrice\` AS DECIMAL(10,2)) * \`quantity\`), 0) AS itemsSubtotal
    FROM \`table_session_items\`
    WHERE \`tableSessionId\` = ${tableSessionId}
  `);
  const linkedOrderRows = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(o.\`total\` AS DECIMAL(10,2))), 0) AS linkedOrdersTotal
    FROM \`table_order_links\` tol
    INNER JOIN \`orders\` o ON o.\`id\` = tol.\`orderId\`
    WHERE tol.\`tableSessionId\` = ${tableSessionId}
      AND o.\`status\` != 'cancelled'
  `);
  const itemsSubtotal = Number((itemTotalsRows as unknown as [Array<{ itemsSubtotal: number | string | null }>])[0]?.[0]?.itemsSubtotal ?? 0);
  const linkedOrdersTotal = Number((linkedOrderRows as unknown as [Array<{ linkedOrdersTotal: number | string | null }>])[0]?.[0]?.linkedOrdersTotal ?? 0);
  const subtotal = itemsSubtotal + linkedOrdersTotal;
  return { itemsSubtotal, linkedOrdersTotal, subtotal, total: subtotal };
}

async function syncTableSessionTotalsInternal(db: any, tableSessionId: number) {
  const totals = await getTableSessionComputedTotals(db, tableSessionId);
  await db
    .update(tableSessions)
    .set({
      subtotal: totals.subtotal.toFixed(2),
      total: totals.total.toFixed(2),
    })
    .where(eq(tableSessions.id, tableSessionId));
  return totals;
}

export async function syncTableSessionTotals(tableSessionId: number) {
  return withDbRetry(async (db) => syncTableSessionTotalsInternal(db, tableSessionId));
}

export async function getTableSessions(opts?: { storeId?: number; status?: TableSession["status"]; waiterStaffId?: number }) {
  return withDbRetry(async (db) => {
    const baseRows = await db.execute(sql`
      SELECT
        ts.*,
        dt.\`name\` AS tableName,
        dt.\`capacity\` AS tableCapacity,
        sm.\`name\` AS waiterName
      FROM \`table_sessions\` ts
      INNER JOIN \`dining_tables\` dt ON dt.\`id\` = ts.\`tableId\`
      LEFT JOIN \`staff_members\` sm ON sm.\`id\` = ts.\`waiterStaffId\`
      WHERE 1 = 1
      ${opts?.storeId ? sql`AND ts.\`storeId\` = ${opts.storeId}` : sql``}
      ${opts?.status ? sql`AND ts.\`status\` = ${opts.status}` : sql``}
      ${opts?.waiterStaffId ? sql`AND ts.\`waiterStaffId\` = ${opts.waiterStaffId}` : sql``}
      ORDER BY ts.\`openedAt\` DESC
    `);

    const sessions = ((baseRows as unknown as [Array<Record<string, unknown>>])[0] ?? []).map((row) => ({
      ...row,
      id: Number(row.id),
      tableId: Number(row.tableId),
      storeId: row.storeId == null ? null : Number(row.storeId),
      waiterStaffId: row.waiterStaffId == null ? null : Number(row.waiterStaffId),
      guestCount: Number(row.guestCount ?? 1),
      tableCapacity: Number(row.tableCapacity ?? 0),
      subtotal: String(row.subtotal ?? "0.00"),
      discountAmount: String(row.discountAmount ?? "0.00"),
      tipAmount: String(row.tipAmount ?? "0.00"),
      total: String(row.total ?? "0.00"),
      tableName: String(row.tableName ?? ""),
      waiterName: row.waiterName ? String(row.waiterName) : null,
    }));
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((session) => session.id);
    const itemRows = await db.execute(sql`
      SELECT
        tsi.\`id\`,
        tsi.\`tableSessionId\`,
        tsi.\`productId\`,
        tsi.\`productName\`,
        tsi.\`unitPrice\`,
        tsi.\`quantity\`,
        tsi.\`notes\`,
        tsi.\`addedByStaffId\`,
        tsi.\`status\`,
        tsi.\`requestedAt\`,
        tsi.\`readyAt\`,
        tsi.\`servedAt\`,
        tsi.\`createdAt\`,
        sm.\`name\` AS addedByStaffName
      FROM \`table_session_items\` tsi
      LEFT JOIN \`staff_members\` sm ON sm.\`id\` = tsi.\`addedByStaffId\`
      WHERE tsi.\`tableSessionId\` IN (${sql.join(sessionIds.map((sessionId) => sql`${sessionId}`), sql`, `)})
      ORDER BY tsi.\`requestedAt\` ASC, tsi.\`id\` ASC
    `);
    const linkedOrderRows = await db.execute(sql`
      SELECT
        tol.\`tableSessionId\`,
        o.\`id\` AS orderId,
        o.\`customerName\`,
        o.\`status\`,
        o.\`total\`,
        o.\`createdAt\`
      FROM \`table_order_links\` tol
      INNER JOIN \`orders\` o ON o.\`id\` = tol.\`orderId\`
      WHERE tol.\`tableSessionId\` IN (${sql.join(sessionIds.map((sessionId) => sql`${sessionId}`), sql`, `)})
      ORDER BY o.\`createdAt\` ASC, o.\`id\` ASC
    `);

    const itemsBySession = new Map<number, Array<Record<string, unknown>>>();
    for (const row of (itemRows as unknown as [Array<Record<string, unknown>>])[0] ?? []) {
      const sessionId = Number(row.tableSessionId);
      if (!itemsBySession.has(sessionId)) itemsBySession.set(sessionId, []);
      itemsBySession.get(sessionId)!.push({
        id: Number(row.id),
        tableSessionId: sessionId,
        productId: Number(row.productId),
        productName: String(row.productName ?? ""),
        unitPrice: String(row.unitPrice ?? "0.00"),
        quantity: Number(row.quantity ?? 0),
        notes: row.notes ? String(row.notes) : null,
        addedByStaffId: row.addedByStaffId == null ? null : Number(row.addedByStaffId),
        addedByStaffName: row.addedByStaffName ? String(row.addedByStaffName) : null,
        status: String(row.status ?? "pending"),
        requestedAt: row.requestedAt,
        readyAt: row.readyAt ?? null,
        servedAt: row.servedAt ?? null,
        createdAt: row.createdAt,
        lineTotal: (Number(row.quantity ?? 0) * Number(row.unitPrice ?? 0)).toFixed(2),
      });
    }

    const ordersBySession = new Map<number, Array<Record<string, unknown>>>();
    for (const row of (linkedOrderRows as unknown as [Array<Record<string, unknown>>])[0] ?? []) {
      const sessionId = Number(row.tableSessionId);
      if (!ordersBySession.has(sessionId)) ordersBySession.set(sessionId, []);
      ordersBySession.get(sessionId)!.push({
        orderId: Number(row.orderId),
        customerName: String(row.customerName ?? ""),
        status: String(row.status ?? ""),
        total: String(row.total ?? "0.00"),
        createdAt: row.createdAt,
      });
    }

    return sessions.map((session) => {
      const items = itemsBySession.get(session.id) ?? [];
      const linkedOrders = ordersBySession.get(session.id) ?? [];
      const itemsSubtotal = items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
      const linkedOrdersTotal = linkedOrders.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + Number(item.total ?? 0), 0);
      const computedSubtotal = itemsSubtotal + linkedOrdersTotal;
      return {
        ...session,
        items,
        linkedOrders,
        itemCount: items.length,
        linkedOrderCount: linkedOrders.length,
        itemsSubtotal: itemsSubtotal.toFixed(2),
        linkedOrdersTotal: linkedOrdersTotal.toFixed(2),
        computedSubtotal: computedSubtotal.toFixed(2),
        computedTotal: Math.max(0, computedSubtotal - Number(session.discountAmount ?? 0) + Number(session.tipAmount ?? 0)).toFixed(2),
      };
    });
  });
}

export async function getTableSessionById(id: number) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
    return rows[0];
  });
}

export async function getTableSessionItemById(id: number) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(tableSessionItems).where(eq(tableSessionItems.id, id)).limit(1);
    return rows[0];
  });
}

export async function openTableSession(data: InsertTableSession) {
  return withDbRetry(async (db) => {
    const existingOpenSession = await db
      .select({ id: tableSessions.id })
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, data.tableId), inArray(tableSessions.status, ["open", "awaiting_closure"])))
      .limit(1);
    if (existingOpenSession[0]) {
      throw new Error("Essa mesa já possui uma comanda aberta.");
    }
    const result = await db.insert(tableSessions).values(data);
    const header = Array.isArray(result) ? result[0] : result;
    const sessionId = (header as { insertId: number }).insertId;
    await db.update(diningTables).set({ status: "occupied" }).where(eq(diningTables.id, data.tableId));
    return sessionId;
  });
}

export async function updateTableSession(id: number, data: Partial<InsertTableSession>) {
  await withDbRetry(async (db) => {
    await db.update(tableSessions).set(data).where(eq(tableSessions.id, id));
  });
}

export async function closeTableSession(id: number, data?: { subtotal?: string; discountAmount?: string; tipAmount?: string; total?: string; status?: "awaiting_closure" | "closed" | "cancelled"; closedByStaffId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const session = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
  if (!session[0]) throw new Error("Comanda não encontrada");
  const nextStatus = data?.status ?? "closed";
  await db
    .update(tableSessions)
    .set({
      status: nextStatus,
      subtotal: data?.subtotal,
      discountAmount: data?.discountAmount,
      tipAmount: data?.tipAmount,
      closedByStaffId: data?.closedByStaffId ?? null,
      total: data?.total,
      closedAt: nextStatus === "closed" || nextStatus === "cancelled" ? new Date() : null,
    })
    .where(eq(tableSessions.id, id));
  await db
    .update(diningTables)
    .set({ status: nextStatus === "closed" || nextStatus === "cancelled" ? "free" : "awaiting_closure" })
    .where(eq(diningTables.id, session[0].tableId));
}

export async function attachOrderToTableSession(tableSessionId: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(tableOrderLinks).values({ tableSessionId, orderId });
  await db.update(orders).set({ tableSessionId, serviceType: "dine_in" }).where(eq(orders.id, orderId));
}

export async function closeTableSessionWithComputedTotals(
  id: number,
  data?: { subtotal?: string; discountAmount?: string; tipAmount?: string; total?: string; status?: "awaiting_closure" | "closed" | "cancelled"; closedByStaffId?: number | null }
) {
  await withDbRetry(async (db) => {
    const session = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
    if (!session[0]) throw new Error("Comanda nao encontrada");
    const synced = await syncTableSessionTotalsInternal(db, id);
    const discountAmount = Number(data?.discountAmount ?? session[0].discountAmount ?? 0);
    const tipAmount = Number(data?.tipAmount ?? session[0].tipAmount ?? 0);
    const nextStatus = data?.status ?? "closed";
    await db
      .update(tableSessions)
      .set({
        status: nextStatus,
        subtotal: data?.subtotal ?? synced.subtotal.toFixed(2),
        discountAmount: data?.discountAmount ?? discountAmount.toFixed(2),
        tipAmount: data?.tipAmount ?? tipAmount.toFixed(2),
        closedByStaffId: data?.closedByStaffId ?? null,
        total: data?.total ?? Math.max(0, synced.subtotal - discountAmount + tipAmount).toFixed(2),
        closedAt: nextStatus === "closed" || nextStatus === "cancelled" ? new Date() : null,
      })
      .where(eq(tableSessions.id, id));
    await db
      .update(diningTables)
      .set({ status: nextStatus === "closed" || nextStatus === "cancelled" ? "free" : "awaiting_closure" })
      .where(eq(diningTables.id, session[0].tableId));
  });
}

export async function attachOrderToTableSessionAndSync(tableSessionId: number, orderId: number) {
  await withDbRetry(async (db) => {
    await db.insert(tableOrderLinks).values({ tableSessionId, orderId });
    await db.update(orders).set({ tableSessionId, serviceType: "dine_in" }).where(eq(orders.id, orderId));
    await syncTableSessionTotalsInternal(db, tableSessionId);
  });
}

export async function addTableSessionItem(data: {
  tableSessionId: number;
  productId: number;
  quantity: number;
  notes?: string | null;
  addedByStaffId?: number | null;
}) {
  return withDbRetry(async (db) => {
    const [session] = await db.select().from(tableSessions).where(eq(tableSessions.id, data.tableSessionId)).limit(1);
    if (!session) throw new Error("Comanda nao encontrada.");
    if (session.status === "closed" || session.status === "cancelled") {
      throw new Error("Nao e possivel adicionar itens em uma comanda encerrada.");
    }
    const [product] = await db
      .select({ id: products.id, name: products.name, price: products.price, active: products.active })
      .from(products)
      .where(eq(products.id, data.productId))
      .limit(1);
    if (!product || !product.active) {
      throw new Error("Produto nao encontrado ou inativo.");
    }
    const result = await db.insert(tableSessionItems).values({
      tableSessionId: data.tableSessionId,
      productId: data.productId,
      productName: product.name,
      unitPrice: String(product.price),
      quantity: data.quantity,
      notes: data.notes ?? null,
      addedByStaffId: data.addedByStaffId ?? null,
      status: "pending",
      requestedAt: new Date(),
    });
    const header = Array.isArray(result) ? result[0] : result;
    const itemId = (header as { insertId: number }).insertId;
    await consumeInventoryForTableSessionItemInternal(db, itemId);
    await syncTableSessionTotalsInternal(db, data.tableSessionId);
    return itemId;
  });
}

export async function removeTableSessionItem(id: number) {
  await withDbRetry(async (db) => {
    const [item] = await db.select().from(tableSessionItems).where(eq(tableSessionItems.id, id)).limit(1);
    if (!item) throw new Error("Item da comanda nao encontrado.");
    await reverseInventoryForTableSessionItemInternal(db, item);
    await db.delete(tableSessionItems).where(eq(tableSessionItems.id, id));
    await syncTableSessionTotalsInternal(db, item.tableSessionId);
  });
}

async function consumeInventoryForTableSessionItemInternal(db: DatabaseClient, itemId: number) {
  const rows = await db.execute(sql`
    SELECT
      tsi.\`id\`,
      tsi.\`tableSessionId\`,
      tsi.\`productId\`,
      tsi.\`quantity\`,
      ts.\`storeId\`
    FROM \`table_session_items\` tsi
    INNER JOIN \`table_sessions\` ts ON ts.\`id\` = tsi.\`tableSessionId\`
    WHERE tsi.\`id\` = ${itemId}
    LIMIT 1
  `);
  const item = (rows as unknown as [Array<{ id: number; tableSessionId: number; productId: number; quantity: number; storeId: number | null }>])[0]?.[0];
  if (!item) return { consumed: false, reason: "item_not_found" };

  const recipes = await db
    .select()
    .from(productIngredients)
    .where(and(eq(productIngredients.productId, item.productId), eq(productIngredients.active, true)));
  if (!recipes.length) return { consumed: false, reason: "no_recipe" };

  const ingredientIds = [...new Set(recipes.map((recipe) => recipe.ingredientId))];
  const ingredientRows = await db.select().from(ingredients).where(inArray(ingredients.id, ingredientIds));
  const ingredientMap = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));

  for (const recipe of recipes) {
    const ingredient = ingredientMap.get(recipe.ingredientId);
    if (!ingredient) continue;
    const baseQty = Number(recipe.quantity) * Number(item.quantity);
    const wasteMultiplier = 1 + Number(recipe.wastePercent ?? 0) / 100;
    const totalQty = Number((baseQty * wasteMultiplier).toFixed(3));
    const previousStock = Number(ingredient.currentStock ?? 0);
    const nextStock = previousStock - totalQty;
    await db.update(ingredients).set({ currentStock: toFixedQuantity(nextStock) }).where(eq(ingredients.id, ingredient.id));
    await db.insert(inventoryMovements).values({
      ingredientId: ingredient.id,
      storeId: item.storeId ?? ingredient.storeId ?? null,
      movementType: "sale_consumption",
      quantityDelta: toFixedQuantity(-totalQty),
      previousStock: toFixedQuantity(previousStock),
      nextStock: toFixedQuantity(nextStock),
      reason: `Consumo automatico da comanda #${item.tableSessionId} item #${item.id}`,
    });
    ingredient.currentStock = toFixedQuantity(nextStock);
  }

  return { consumed: true, reason: "ok" };
}

async function reverseInventoryForTableSessionItemInternal(db: any, item: { id: number; tableSessionId: number }) {
  const movementRows = await db
    .select()
    .from(inventoryMovements)
    .where(and(
      eq(inventoryMovements.reason, `Consumo automatico da comanda #${item.tableSessionId} item #${item.id}`),
      eq(inventoryMovements.movementType, "sale_consumption"),
    ));

  for (const row of movementRows) {
    const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, row.ingredientId)).limit(1);
    if (!ingredient) continue;
    const previousStock = Number(ingredient.currentStock ?? 0);
    const delta = Math.abs(Number(row.quantityDelta));
    const nextStock = previousStock + delta;
    await db.update(ingredients).set({ currentStock: toFixedQuantity(nextStock) }).where(eq(ingredients.id, ingredient.id));
    await db.insert(inventoryMovements).values({
      ingredientId: ingredient.id,
      storeId: row.storeId ?? ingredient.storeId ?? null,
      movementType: "reversal",
      quantityDelta: toFixedQuantity(delta),
      previousStock: toFixedQuantity(previousStock),
      nextStock: toFixedQuantity(nextStock),
      reason: `Estorno automatico da comanda #${item.tableSessionId} item #${item.id}`,
    });
  }
}

export async function updateTableSessionItemStatus(
  id: number,
  status: "pending" | "preparing" | "ready" | "served" | "cancelled",
) {
  await withDbRetry(async (db) => {
    const patch: Record<string, unknown> = { status };
    if (status === "ready") patch.readyAt = new Date();
    if (status === "served") patch.servedAt = new Date();
    if (status === "cancelled") {
      const [item] = await db.select().from(tableSessionItems).where(eq(tableSessionItems.id, id)).limit(1);
      if (item) {
        await reverseInventoryForTableSessionItemInternal(db, item);
      }
    }
    await db.update(tableSessionItems).set(patch).where(eq(tableSessionItems.id, id));
  });
}

// --- CUSTOMER METRICS / PHONE AUTH -------------------------------------------

export async function getCustomerMetricsReport(opts?: { storeId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [] as Array<CustomerMetric & { userName: string | null; email: string | null; phone: string | null }>;
  const conditions: Array<any> = [];
  if (opts?.storeId !== undefined) conditions.push(eq(customerMetrics.storeId, opts.storeId));
  return db
    .select({
      id: customerMetrics.id,
      userId: customerMetrics.userId,
      storeId: customerMetrics.storeId,
      firstOrderAt: customerMetrics.firstOrderAt,
      lastOrderAt: customerMetrics.lastOrderAt,
      totalOrders: customerMetrics.totalOrders,
      deliveredOrders: customerMetrics.deliveredOrders,
      cancelledOrders: customerMetrics.cancelledOrders,
      firstOrderCount: customerMetrics.firstOrderCount,
      totalSpent: customerMetrics.totalSpent,
      averageTicket: customerMetrics.averageTicket,
      favoriteNeighborhood: customerMetrics.favoriteNeighborhood,
      favoriteOrderDay: customerMetrics.favoriteOrderDay,
      favoriteOrderHour: customerMetrics.favoriteOrderHour,
      favoriteProductName: customerMetrics.favoriteProductName,
      updatedAt: customerMetrics.updatedAt,
      createdAt: customerMetrics.createdAt,
      userName: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(customerMetrics)
    .leftJoin(users, eq(customerMetrics.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(customerMetrics.totalSpent), desc(customerMetrics.totalOrders))
    .limit(opts?.limit ?? 200);
}

export async function getUserByPhone(phone: string) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return rows[0];
  });
}

export async function createPhoneUser(data: { openId: string; name?: string | null; phone: string }) {
  return withDbRetry(async (db) => {
    const result = await db.insert(users).values({
      openId: data.openId,
      name: data.name ?? "Cliente Bonatto",
      phone: data.phone,
      loginMethod: "phone",
      role: "user",
      emailVerified: false,
      status: "active",
      lastSignedIn: new Date(),
    });
    const header = Array.isArray(result) ? result[0] : result;
    const userId = (header as { insertId: number }).insertId;
    return getUserById(userId);
  });
}

export async function linkCustomerAuthProvider(data: {
  userId: number;
  provider: "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus";
  providerUserId: string;
  providerEmail?: string | null;
  providerPhone?: string | null;
  providerUsername?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  accountType?: string | null;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: Date | null;
  grantedScopes?: string[];
  rawProfileJson?: string | null;
  isPrimary?: boolean;
  consentVersion?: string | null;
  consentedAt?: Date | null;
  lastSyncedAt?: Date | null;
}) {
  await withDbRetry(async (db) => {
    const existingProvider = await db
      .select({ userId: customerAuthProviders.userId })
      .from(customerAuthProviders)
      .where(and(
        eq(customerAuthProviders.provider, data.provider),
        eq(customerAuthProviders.providerUserId, data.providerUserId),
      ))
      .limit(1);

    if (existingProvider[0] && existingProvider[0].userId !== data.userId) {
      throw new Error("This social account is already linked to another user");
    }

    await db
      .insert(customerAuthProviders)
      .values({
        userId: data.userId,
        provider: data.provider,
        providerUserId: data.providerUserId,
        providerEmail: data.providerEmail ?? null,
        providerPhone: data.providerPhone ?? null,
        providerUsername: data.providerUsername ?? null,
        displayName: data.displayName ?? null,
        avatarUrl: data.avatarUrl ?? null,
        accountType: data.accountType ?? null,
        accessTokenEncrypted: data.accessTokenEncrypted ?? null,
        refreshTokenEncrypted: data.refreshTokenEncrypted ?? null,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        grantedScopes: data.grantedScopes ? JSON.stringify(data.grantedScopes) : null,
        rawProfileJson: data.rawProfileJson ?? null,
        isPrimary: data.isPrimary ?? false,
        consentVersion: data.consentVersion ?? null,
        consentedAt: data.consentedAt ?? null,
        lastSyncedAt: data.lastSyncedAt ?? null,
        disconnectedAt: null,
      })
      .onConflictDoUpdate({
        target: [customerAuthProviders.provider, customerAuthProviders.providerUserId],
        set: {
          providerEmail: data.providerEmail ?? null,
          providerPhone: data.providerPhone ?? null,
          providerUsername: data.providerUsername ?? null,
          displayName: data.displayName ?? null,
          avatarUrl: data.avatarUrl ?? null,
          accountType: data.accountType ?? null,
          accessTokenEncrypted: data.accessTokenEncrypted ?? null,
          refreshTokenEncrypted: data.refreshTokenEncrypted ?? null,
          tokenExpiresAt: data.tokenExpiresAt ?? null,
          grantedScopes: data.grantedScopes ? JSON.stringify(data.grantedScopes) : null,
          rawProfileJson: data.rawProfileJson ?? null,
          isPrimary: data.isPrimary ?? false,
          consentVersion: data.consentVersion ?? null,
          consentedAt: data.consentedAt ?? null,
          lastSyncedAt: data.lastSyncedAt ?? null,
          disconnectedAt: null,
        },
      });
  });
}

export async function getCustomerAuthProviders(userId: number) {
  return withDbRetry((db) => db
    .select()
    .from(customerAuthProviders)
    .where(and(eq(customerAuthProviders.userId, userId), isNull(customerAuthProviders.disconnectedAt)))
    .orderBy(desc(customerAuthProviders.isPrimary), desc(customerAuthProviders.linkedAt)));
}

export async function getCustomerAuthProvider(userId: number, provider: "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus") {
  return withDbRetry(async (db) => {
    const rows = await db
      .select()
      .from(customerAuthProviders)
      .where(and(
        eq(customerAuthProviders.userId, userId),
        eq(customerAuthProviders.provider, provider),
        isNull(customerAuthProviders.disconnectedAt),
      ))
      .limit(1);
    return rows[0];
  });
}

export async function disconnectCustomerAuthProvider(userId: number, provider: "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus") {
  await withDbRetry((db) => db
    .update(customerAuthProviders)
    .set({
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      disconnectedAt: new Date(),
      isPrimary: false,
    })
    .where(and(eq(customerAuthProviders.userId, userId), eq(customerAuthProviders.provider, provider))));
}

export async function recordAuthEvent(data: {
  userId?: number | null;
  provider?: string | null;
  event:
    | "login_success"
    | "login_failure"
    | "provider_connected"
    | "provider_disconnected"
    | "profile_synced"
    | "account_deleted"
    | "two_factor_challenge"
    | "two_factor_failure"
    | "two_factor_enabled"
    | "two_factor_disabled";
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await withDbRetry((db) => db.insert(authEventLogs).values({
    userId: data.userId ?? null,
    provider: data.provider ?? null,
    event: data.event,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
    metadataJson: data.metadata ? JSON.stringify(data.metadata) : null,
  }));
}

export async function recordUserConsent(data: {
  userId: number;
  kind: "terms" | "privacy" | "social_sync";
  version: string;
  granted?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await withDbRetry((db) => db.insert(userConsents).values({
    userId: data.userId,
    kind: data.kind,
    version: data.version,
    granted: data.granted ?? true,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  }));
}

export async function markUserLogin(userId: number, provider: string) {
  await withDbRetry((db) => db
    .update(users)
    .set({ loginMethod: provider, lastSignedIn: new Date() })
    .where(eq(users.id, userId)));
}

export async function anonymizeUserAccount(userId: number) {
  const anonymized = `deleted_${userId}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await withDbRetry(async (db) => {
    await db.update(customerAuthProviders).set({
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      providerEmail: null,
      providerPhone: null,
      providerUsername: null,
      rawProfileJson: null,
      disconnectedAt: new Date(),
      isPrimary: false,
    }).where(eq(customerAuthProviders.userId, userId));
    await db.update(users).set({
      openId: anonymized,
      name: "Conta excluida",
      firstName: null,
      lastName: null,
      email: null,
      username: null,
      phone: null,
      avatarUrl: null,
      passwordHash: null,
      resetToken: null,
      resetTokenExpiresAt: null,
      savedAddress: null,
      savedCep: null,
      savedCity: null,
      status: "inactive",
    }).where(eq(users.id, userId));
  });
}

export async function createOtpCode(data: {
  userId?: number | null;
  phone: string;
  purpose?: "login" | "verify_phone";
  codeHash: string;
  expiresAt: Date;
  requestIp?: string | null;
  userAgent?: string | null;
}) {
  return withDbRetry(async (db) => {
    const result = await db.insert(otpCodes).values({
      userId: data.userId ?? null,
      phone: data.phone,
      purpose: data.purpose ?? "login",
      codeHash: data.codeHash,
      requestIp: data.requestIp ?? null,
      userAgent: data.userAgent ?? null,
      expiresAt: data.expiresAt,
    });
    const header = Array.isArray(result) ? result[0] : result;
    return (header as { insertId: number }).insertId;
  });
}

export async function getLatestOtpCode(phone: string, purpose: "login" | "verify_phone" = "login") {
  return withDbRetry(async (db) => {
    const rows = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    return rows[0];
  });
}

export async function countRecentOtpRequests(phone: string, withinMinutes = 10) {
  return withDbRetry(async (db) => {
    const since = new Date(Date.now() - withinMinutes * 60_000);
    const rows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), gte(otpCodes.createdAt, since)));
    return Number(rows[0]?.count ?? 0);
  });
}

export async function incrementOtpAttempts(id: number) {
  await withDbRetry(async (db) => {
    await db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, id));
  });
}

export async function consumeOtpCode(id: number) {
  await withDbRetry(async (db) => {
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, id));
  });
}

// --- COUPONS ------------------------------------------------------------------

export async function getCouponByCode(code: string, storeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions: SQL[] = [eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)];
  if (storeId !== undefined) conditions.push(eq(coupons.storeId, storeId));
  const result = await db
    .select()
    .from(coupons)
    .where(and(...conditions))
    .limit(1);
  return result[0];
}

export async function getCouponById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return coupon;
}

export async function getAllCoupons(storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (storeId !== undefined) return db.select().from(coupons).where(eq(coupons.storeId, storeId)).orderBy(desc(coupons.createdAt));
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

export async function incrementCouponUsage(couponId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // Atomic increment: only increments if usedCount < maxUses (or maxUses is null)
  // Returns true if the row was updated (coupon still valid), false if maxUses was exceeded
  const result = await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        eq(coupons.id, couponId),
        sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`
      )
    );
  return (result as any)?.rowsAffected > 0 || (result as any)?.[0]?.affectedRows > 0;
}

// --- ORDERS -------------------------------------------------------------------

export async function pickStoreForDeliveryAddress(input: {
  deliveryAddress: string;
  deliveryNeighborhood?: string | null;
  deliveryCity?: string | null;
  deliveryCep?: string | null;
}) {
  return withDbRetry(async (db) => {
    const activeStores = await db
      .select()
      .from(stores)
      .where(and(eq(stores.active, true), eq(stores.status, "active")));
    if (!activeStores.length) {
      return { storeId: undefined, reason: "no_active_store" as const };
    }

    const fullAddress = [
      input.deliveryAddress,
      input.deliveryNeighborhood,
      input.deliveryCity,
      input.deliveryCep,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");
    const destination = await geocodeAddress(fullAddress);
    if (!destination) {
      const defaultStore = activeStores.find((store) => store.isDefault) ?? activeStores[0];
      return { storeId: defaultStore?.id, reason: "destination_geocode_failed" as const };
    }

    let bestStore: { id: number; distanceKm: number } | null = null;
    for (const store of activeStores) {
      let lat = toNumberOrNull((store as Record<string, unknown>).latitude);
      let lng = toNumberOrNull((store as Record<string, unknown>).longitude);
      if (lat === null || lng === null) {
        const storeAddress = [store.address, store.city, "Brasil"].filter(Boolean).join(", ");
        const coords = await geocodeAddress(storeAddress);
        if (!coords) continue;
        lat = coords.lat;
        lng = coords.lng;
        await db
          .update(stores)
          .set({ latitude: coords.lat.toFixed(7), longitude: coords.lng.toFixed(7) })
          .where(eq(stores.id, store.id));
      }

      const distanceKm = haversineDistanceKm(destination, { lat, lng });
      const serviceRadiusKm = Math.max(1, Number((store as Record<string, unknown>).serviceRadiusKm ?? 25));
      if (distanceKm > serviceRadiusKm && !store.isDefault) {
        continue;
      }
      if (!bestStore || distanceKm < bestStore.distanceKm) {
        bestStore = { id: store.id, distanceKm };
      }
    }

    if (!bestStore) {
      const fallbackStore = activeStores.find((store) => store.isDefault) ?? activeStores[0];
      return { storeId: fallbackStore?.id, reason: "no_store_in_radius" as const };
    }

    return { storeId: bestStore.id, reason: "nearest" as const, distanceKm: bestStore.distanceKm };
  });
}

export type OrderRequestClaimResult =
  | { state: "claimed" }
  | { state: "completed"; orderId: number }
  | { state: "processing" }
  | { state: "failed"; orderId?: number | null; reason?: string | null }
  | { state: "conflict" };

export async function claimOrderRequest(input: {
  idempotencyKey: string;
  requestFingerprint: string;
  userId: number;
  storeId: number;
  staleAfterMs?: number;
}): Promise<OrderRequestClaimResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();
  const inserted = await db
    .insert(orderRequests)
    .values({
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      userId: input.userId,
      storeId: input.storeId,
      status: "processing",
      updatedAt: now,
    })
    .onConflictDoNothing({ target: orderRequests.idempotencyKey })
    .returning({ id: orderRequests.id });

  if (inserted.length > 0) return { state: "claimed" };

  const [existing] = await db
    .select({
      id: orderRequests.id,
      requestFingerprint: orderRequests.requestFingerprint,
      userId: orderRequests.userId,
      storeId: orderRequests.storeId,
      status: orderRequests.status,
      orderId: orderRequests.orderId,
      updatedAt: orderRequests.updatedAt,
    })
    .from(orderRequests)
    .where(eq(orderRequests.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (!existing) return { state: "processing" };

  if (
    existing.requestFingerprint !== input.requestFingerprint ||
    existing.userId !== input.userId ||
    existing.storeId !== input.storeId
  ) {
    return { state: "conflict" };
  }

  if (existing.status === "completed" && existing.orderId) {
    return { state: "completed", orderId: existing.orderId };
  }

  if (existing.status === "failed" && existing.orderId) {
    return { state: "failed", orderId: existing.orderId };
  }

  const staleAfterMs = input.staleAfterMs ?? 2 * 60 * 1000;
  const staleBefore = new Date(Date.now() - staleAfterMs);
  const canReclaim =
    existing.status === "failed" ||
    (existing.status === "processing" && existing.updatedAt <= staleBefore);

  if (canReclaim) {
    const [orphanOrder] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (orphanOrder) {
      await db
        .update(orderRequests)
        .set({
          status: "failed",
          orderId: orphanOrder.id,
          lastError: "Pedido já criado em tentativa anterior; retry automático bloqueado para evitar duplicidade.",
          updatedAt: now,
        })
        .where(eq(orderRequests.id, existing.id));
      return { state: "failed", orderId: orphanOrder.id };
    }

    const reclaimed = await db
      .update(orderRequests)
      .set({ status: "processing", orderId: null, lastError: null, updatedAt: now })
      .where(and(
        eq(orderRequests.id, existing.id),
        or(
          eq(orderRequests.status, "failed"),
          and(eq(orderRequests.status, "processing"), lte(orderRequests.updatedAt, staleBefore)),
        ),
      ))
      .returning({ id: orderRequests.id });

    if (reclaimed.length > 0) return { state: "claimed" };
  }

  return { state: "processing" };
}

export async function attachOrderRequest(idempotencyKey: string, orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(orderRequests)
    .set({ orderId, updatedAt: new Date() })
    .where(and(
      eq(orderRequests.idempotencyKey, idempotencyKey),
      eq(orderRequests.status, "processing"),
    ));
}

export async function completeOrderRequest(idempotencyKey: string, orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(orderRequests)
    .set({ status: "completed", orderId, lastError: null, updatedAt: new Date() })
    .where(eq(orderRequests.idempotencyKey, idempotencyKey));
}

export async function failOrderRequest(idempotencyKey: string, error: unknown, orderId?: number | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const message = error instanceof Error ? error.message : String(error ?? "unknown");
  await db
    .update(orderRequests)
    .set({
      status: "failed",
      orderId: orderId ?? undefined,
      lastError: message.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(and(
      eq(orderRequests.idempotencyKey, idempotencyKey),
      eq(orderRequests.status, "processing"),
    ));
}

export async function getOrderByIdempotencyKey(idempotencyKey: string) {
  return withDbRetry(async (db) => {
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey))
      .limit(1);
    return result[0];
  });
}

export async function enqueueOutboxEvent(input: {
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  storeId?: number | null;
  payload: unknown;
  availableAt?: Date;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const inserted = await db
    .insert(eventOutbox)
    .values({
      eventKey: input.eventKey,
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      storeId: input.storeId ?? null,
      payload: JSON.stringify(input.payload ?? {}),
      availableAt: input.availableAt ?? new Date(),
    })
    .onConflictDoNothing({ target: eventOutbox.eventKey })
    .returning({ id: eventOutbox.id });
  return inserted.length > 0;
}

export async function createOrder(
  orderData: InsertOrder,
  items: Omit<InsertOrderItem, 'orderId'>[]
): Promise<number> {
  const orderId = await withDbRetry((db) =>
    db.transaction(async (tx) => {
      const [insertedOrder] = await tx
        .insert(orders)
        .values(orderData)
        .returning({
          id: orders.id,
          storeId: orders.storeId,
          status: orders.status,
          serviceType: orders.serviceType,
        });
      const orderId = insertedOrder?.id;
      if (!orderId) throw new Error("Failed to get order ID after insert");

      const orderNumber = `BNT-${String(insertedOrder.storeId ?? 0).padStart(2, "0")}-${String(orderId).padStart(6, "0")}`;
      await tx
        .update(orders)
        .set({ orderNumber, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      const itemsWithOrderId = items.map((item) => ({ ...item, orderId }));
      await tx.insert(orderItems).values(itemsWithOrderId);

      await tx.insert(orderStageLogs).values({
        orderId,
        previousStatus: null,
        nextStatus: insertedOrder.status,
        stage: "created",
        source: "system",
        metadata: JSON.stringify({
          serviceType: insertedOrder.serviceType,
          orderNumber,
          transactional: true,
        }),
      });

      const createdPayload = JSON.stringify({ orderId, orderNumber });
      await tx
        .insert(eventOutbox)
        .values([
          {
            eventKey: `order.created:${orderId}`,
            eventType: "order.created",
            aggregateType: "order",
            aggregateId: String(orderId),
            storeId: insertedOrder.storeId ?? null,
            payload: createdPayload,
            status: "pending",
            availableAt: new Date(),
          },
          {
            eventKey: `order.created.admin_push:${orderId}`,
            eventType: "order.created.admin_push",
            aggregateType: "order",
            aggregateId: String(orderId),
            storeId: insertedOrder.storeId ?? null,
            payload: createdPayload,
            status: "pending",
            availableAt: new Date(),
          },
          {
            eventKey: `order.created.customer_whatsapp:${orderId}`,
            eventType: "order.created.customer_whatsapp",
            aggregateType: "order",
            aggregateId: String(orderId),
            storeId: insertedOrder.storeId ?? null,
            payload: createdPayload,
            status: "pending",
            availableAt: new Date(),
          },
        ])
        .onConflictDoNothing({ target: eventOutbox.eventKey });

      return orderId;
    })
  );

  void publishOrderRealtimeEvent({
    type: "created",
    orderId,
    storeId: orderData.storeId ?? null,
    userId: orderData.userId ?? null,
    status: orderData.status ?? "pending",
  });
  return orderId;
}

export async function getOrderById(id: number) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  });
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  return withDbRetry(async (db) =>
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  );
}

export async function getOrdersByUser(userId: number, storeId?: number) {
  return withDbRetry(async (db) => {
    const effectiveStoreId = await getEffectiveStoreId(db, storeId);
    return db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.storeId, effectiveStoreId)))
      .orderBy(desc(orders.createdAt));
  });
}

export async function getAllOrders(opts?: {
  status?: Order["status"];
  limit?: number;
  offset?: number;
  storeId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  return withDbRetry(async (db) => {
    const conditions: Array<any> = [];
    const limit = Math.min(50000, Math.max(1, opts?.limit ?? 5000));
    const offset = Math.max(0, opts?.offset ?? 0);
    if (opts?.status) conditions.push(eq(orders.status, opts.status));
    if (opts?.storeId) conditions.push(eq(orders.storeId, opts.storeId));
    if (opts?.startDate) conditions.push(gte(orders.createdAt, opts.startDate));
    if (opts?.endDate) conditions.push(lte(orders.createdAt, opts.endDate));
    return db
      .select()
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
  });
}

export async function setOrderAiPaused(id: number, aiPaused: boolean) {
  await withDbRetry(async (db) => {
    await db.update(orders).set({ aiPaused }).where(eq(orders.id, id));
  });
}

export async function updateOrderPaymentStatus(
  id: number,
  paymentStatus: Order["paymentStatus"],
  stripePaymentIntentId?: string,
  stripeCheckoutSessionId?: string,
  asaasPaymentId?: string
) {
  await withDbRetry((db) =>
    db.transaction(async (tx) => {
      const updateFields: Record<string, unknown> = { paymentStatus, updatedAt: new Date() };
      if (stripePaymentIntentId) updateFields.stripePaymentIntentId = stripePaymentIntentId;
      if (stripeCheckoutSessionId) updateFields.stripeCheckoutSessionId = stripeCheckoutSessionId;
      if (asaasPaymentId) updateFields.asaasPaymentId = asaasPaymentId;

      const [updatedOrder] = await tx
        .update(orders)
        .set(updateFields)
        .where(eq(orders.id, id))
        .returning({
          id: orders.id,
          storeId: orders.storeId,
          orderNumber: orders.orderNumber,
        });

      if (!updatedOrder) throw new Error(`Order ${id} not found`);

      if (paymentStatus === "paid") {
        await tx
          .insert(eventOutbox)
          .values({
            eventKey: `order.paid:${id}`,
            eventType: "order.paid",
            aggregateType: "order",
            aggregateId: String(id),
            storeId: updatedOrder.storeId ?? null,
            payload: JSON.stringify({
              orderId: id,
              orderNumber: updatedOrder.orderNumber,
              paymentStatus: "paid",
            }),
            status: "pending",
            availableAt: new Date(),
          })
          .onConflictDoNothing({ target: eventOutbox.eventKey });
      }
    })
  );

  if (paymentStatus === "paid") {
    const guard = await updateOrderStatusGuarded(id, "confirmed", ["pending"], {
      source: "system",
      notes: "Pagamento confirmado",
    });
    if (guard.ok && guard.previous) {
      const { applyOrderStatusLifecycle } = await import("./orderLifecycle.ts");
      await applyOrderStatusLifecycle(id, guard.previous, "confirmed", {
        source: "system",
        notes: "Pagamento confirmado",
        skipStageLog: true,
          skipStatusTimestamp: true,
      });
    }
  }
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

export async function getTopProducts(
  limit = 10,
  storeId?: number,
  opts?: { startDate?: Date; endDate?: Date }
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      productName: orderItems.productName,
      totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<number>`SUM(${orderItems.subtotal})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(
      not(eq(orders.status, "cancelled")),
      storeId ? eq(orders.storeId, storeId) : undefined,
      opts?.startDate ? gte(orders.createdAt, opts.startDate) : undefined,
      opts?.endDate ? lte(orders.createdAt, opts.endDate) : undefined,
    ))
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
  const todayStart = getTodayStartUtc();
  const todayEnd = getTodayEndUtc();

  const aggregatePeriod = async (from: Date, to: Date) => {
    const [row] = await db
      .select({
        totalOrders: sql<number>`COUNT(*)`,
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(orders)
      .where(and(
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
        not(eq(orders.status, "cancelled")),
        storeId ? eq(orders.storeId, storeId) : undefined,
      ));
    return row ?? { totalOrders: 0, totalRevenue: 0 };
  };

  const [curr, prev, today] = await Promise.all([
    aggregatePeriod(startDate, endDate),
    aggregatePeriod(prevStart, prevEnd),
    aggregatePeriod(todayStart, todayEnd),
  ]);

  const totalOrders = Number(curr.totalOrders ?? 0);
  const totalRevenue = Number(curr.totalRevenue ?? 0);
  const prevTotalOrders = Number(prev.totalOrders ?? 0);
  const prevTotalRevenue = Number(prev.totalRevenue ?? 0);

  return {
    totalRevenue,
    totalOrders,
    avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    prevTotalRevenue,
    prevTotalOrders,
    todayOrders: Number(today.totalOrders ?? 0),
    todayRevenue: Number(today.totalRevenue ?? 0),
  };
}

export async function getSalesTimeSeries(startDate: Date, endDate: Date, storeId?: number, timezoneOffsetMinutes = 0) {
  const db = await getDb();
  if (!db) return [];

  const localDate = sql<string>`(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`;
  const rows = await db
    .select({
      date: localDate,
      totalOrders: sql<number>`COUNT(*)`,
      totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      not(eq(orders.status, "cancelled")),
      storeId ? eq(orders.storeId, storeId) : undefined,
    ))
    .groupBy(localDate)
    .orderBy(localDate);

  return rows.map((row) => ({
    date: String(row.date),
    totalOrders: Number(row.totalOrders ?? 0),
    totalRevenue: Number(row.totalRevenue ?? 0),
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

export async function getOrderAlertFeed(storeId?: number, limit = 20) {
  return withShortCache(`order-alert:${storeId ?? "all"}:${limit}`, 8_000, async () => {
    return withDbRetry(async (db) => {
      const safeLimit = Math.min(50, Math.max(1, limit));
      const recentRows = await db.execute(sql`
        SELECT \`id\`, \`status\`, \`createdAt\`
        FROM \`orders\`
        WHERE 1 = 1
        ${storeId ? sql`AND \`storeId\` = ${storeId}` : sql``}
        ORDER BY \`createdAt\` DESC
        LIMIT ${safeLimit}
      `);

      const countsRows = await db.execute(sql`
        SELECT
          SUM(CASE WHEN \`status\` = 'pending' THEN 1 ELSE 0 END) AS pendingCount,
          SUM(CASE WHEN \`status\` = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount
        FROM \`orders\`
        WHERE 1 = 1
        ${storeId ? sql`AND \`storeId\` = ${storeId}` : sql``}
      `);

      const recent = ((recentRows as unknown as [Array<{ id: number; status: Order["status"]; createdAt: Date | string }>])[0] ?? []).map((row) => ({
        id: Number(row.id),
        status: row.status,
        createdAt: row.createdAt,
      }));
      const counts = (countsRows as unknown as [Array<{ pendingCount: number | string | null; cancelledCount: number | string | null }>])[0]?.[0];

      return {
        recent,
        pendingCount: Number(counts?.pendingCount ?? 0),
        cancelledCount: Number(counts?.cancelledCount ?? 0),
      };
    });
  });
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

  const todayStartUtc = getTodayStartUtc();
  const startDate = new Date(todayStartUtc.getTime() - days * 24 * 60 * 60 * 1000);
  const localDate = sql<string>`(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`;

  const rows = await db
    .select({
      date: localDate,
      totalOrders: sql<number>`COUNT(*)`,
      totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      not(eq(orders.status, "cancelled")),
      storeId ? eq(orders.storeId, storeId) : undefined,
    ))
    .groupBy(localDate)
    .orderBy(localDate);

  return rows.map((row) => ({
    date: String(row.date),
    totalOrders: Number(row.totalOrders ?? 0),
    totalRevenue: Number(row.totalRevenue ?? 0),
  }));
}

// --- USER PROFILE --------------------------------------------------------------

export async function updateUserProfile(
  userId: number,
  data: {
    name?: string;
    phone?: string;
    savedAddress?: string | null;
    savedStreet?: string | null;
    savedNumber?: string | null;
    savedComplement?: string | null;
    savedNeighborhood?: string | null;
    savedCep?: string | null;
    savedCity?: string | null;
    savedState?: string | null;
    savedLatitude?: string | null;
    savedLongitude?: string | null;
    savedGeocodedAt?: Date | null;
  }
) {
  await withDbRetry(async (db) => {
    await db.update(users).set(data).where(eq(users.id, userId));
  });
}

export async function updateUserSocialProfile(
  userId: number,
  data: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    loginMethod?: "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus";
    emailVerified?: boolean;
    profileCompleted?: boolean;
    lastSignedIn?: Date;
  }
) {
  await withDbRetry(async (db) => {
    const updateSet: Record<string, unknown> = {};

    if (data.name !== undefined) updateSet.name = data.name;
    if (data.firstName !== undefined) updateSet.firstName = data.firstName;
    if (data.lastName !== undefined) updateSet.lastName = data.lastName;
    if (data.email !== undefined) updateSet.email = data.email;
    if (data.username !== undefined) updateSet.username = data.username;
    if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;
    if (data.loginMethod !== undefined) updateSet.loginMethod = data.loginMethod;
    if (data.emailVerified !== undefined) updateSet.emailVerified = data.emailVerified;
    if (data.profileCompleted !== undefined) updateSet.profileCompleted = data.profileCompleted;
    updateSet.lastSignedIn = data.lastSignedIn ?? new Date();

    await db.update(users).set(updateSet).where(eq(users.id, userId));
  });
}

export async function getUserById(id: number) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  });
}

export async function getAllUsers(limit = 100) {
  return withDbRetry(async (db) =>
    db.select().from(users).orderBy(desc(users.createdAt)).limit(limit)
  );
}

export type AdminUsersPageInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: "user" | "admin" | "manager";
  status?: "active" | "inactive" | "suspended" | "setup_pending";
  clubStatus?: "active" | "pending" | "cancelled" | "none";
  loginMethod?: "email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus";
  hasOrders?: "with_orders" | "without_orders";
  storeId?: number;
};

export async function getAdminUsersPage(input?: AdminUsersPageInput) {
  return withDbRetry(async (db) => {
    const page = Math.max(1, input?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 100));
    const offset = (page - 1) * pageSize;
    const search = input?.search?.trim() ?? "";
    const metricsStoreId = input?.storeId ?? 0;

    const searchClause = search
      ? sql`AND (
          u.name ILIKE ${"%" + search + "%"}
          OR u.email ILIKE ${"%" + search + "%"}
          OR u.phone ILIKE ${"%" + search + "%"}
          OR u."openId" ILIKE ${"%" + search + "%"}
        )`
      : sql``;

    const roleClause = input?.role ? sql`AND u.role = ${input.role}` : sql``;
    const statusClause = input?.status ? sql`AND u.status = ${input.status}` : sql``;
    const loginMethodClause = input?.loginMethod ? sql`AND u."loginMethod" = ${input.loginMethod}` : sql``;
    const clubStatusClause =
      input?.clubStatus === "none"
        ? sql`AND u."clubStatus" IS NULL`
        : input?.clubStatus
          ? sql`AND u."clubStatus" = ${input.clubStatus}`
          : sql``;
    const storeMembershipClause = input?.storeId
      ? sql`AND (oa."userId" IS NOT NULL OR usa."userId" IS NOT NULL OR u.role = 'admin')`
      : sql``;
    const hasOrdersClause =
      input?.hasOrders === "with_orders"
        ? sql`AND COALESCE(oa."totalOrders", 0) > 0`
        : input?.hasOrders === "without_orders"
          ? sql`AND COALESCE(oa."totalOrders", 0) = 0`
          : sql``;

    const countRows = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN (
        SELECT
          o."userId" AS "userId",
          COUNT(*) AS "totalOrders"
        FROM orders o
        WHERE o."userId" IS NOT NULL
        ${input?.storeId ? sql`AND o."storeId" = ${input.storeId}` : sql``}
        GROUP BY o."userId"
      ) oa ON oa."userId" = u.id
      LEFT JOIN user_store_access usa
        ON usa."userId" = u.id
       AND usa."storeId" = ${metricsStoreId}
       AND usa.active = true
      WHERE 1 = 1
      ${searchClause}
      ${roleClause}
      ${statusClause}
      ${loginMethodClause}
      ${clubStatusClause}
      ${storeMembershipClause}
      ${hasOrdersClause}
    `);

    const total = Number((countRows.rows as Array<{ total: number | string }>)[0]?.total ?? 0);

    const rows = await db.execute(sql`
      SELECT
        u.id,
        u."openId",
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u."loginMethod",
        u."clubPlan",
        u."clubStatus",
        u."avatarUrl",
        u."loyaltyPoints",
        u."createdAt",
        u."lastSignedIn",
        COALESCE(oa."totalOrders", 0) AS "totalOrders",
        COALESCE(oa."deliveredOrders", 0) AS "deliveredOrders",
        COALESCE(oa."totalSpent", 0) AS "totalSpent",
        oa."lastOrderAt",
        cm."averageTicket",
        cm."favoriteNeighborhood",
        cm."favoriteProductName",
        cm."firstOrderAt",
        cm."lastOrderAt" AS "metricsLastOrderAt"
      FROM users u
      LEFT JOIN (
        SELECT
          o."userId" AS "userId",
          COUNT(*) AS "totalOrders",
          SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS "deliveredOrders",
          COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN CAST(o.total AS DECIMAL(12,2)) ELSE 0 END), 0) AS "totalSpent",
          MAX(o."createdAt") AS "lastOrderAt"
        FROM orders o
        WHERE o."userId" IS NOT NULL
        ${input?.storeId ? sql`AND o."storeId" = ${input.storeId}` : sql``}
        GROUP BY o."userId"
      ) oa ON oa."userId" = u.id
      LEFT JOIN user_store_access usa
        ON usa."userId" = u.id
       AND usa."storeId" = ${metricsStoreId}
       AND usa.active = true
      LEFT JOIN customer_metrics cm
        ON cm."userId" = u.id
       AND cm."storeId" = ${metricsStoreId}
      WHERE 1 = 1
      ${searchClause}
      ${roleClause}
      ${statusClause}
      ${loginMethodClause}
      ${clubStatusClause}
      ${storeMembershipClause}
      ${hasOrdersClause}
      ORDER BY COALESCE(oa."lastOrderAt", u."createdAt") DESC, u.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const items = (rows.rows as Array<{
      id: number;
      openId: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      role: "user" | "admin" | "manager";
      status: "active" | "inactive" | "suspended" | "setup_pending";
      loginMethod: string | null;
      clubPlan: string | null;
      clubStatus: string | null;
      avatarUrl: string | null;
      loyaltyPoints: number;
      createdAt: Date | string;
      lastSignedIn: Date | string | null;
      totalOrders: number | string;
      deliveredOrders: number | string;
      totalSpent: number | string;
      lastOrderAt: Date | string | null;
      averageTicket: number | string | null;
      favoriteNeighborhood: string | null;
      favoriteProductName: string | null;
      firstOrderAt: Date | string | null;
      metricsLastOrderAt: Date | string | null;
    }>).map((row) => ({
      ...row,
      totalOrders: Number(row.totalOrders ?? 0),
      deliveredOrders: Number(row.deliveredOrders ?? 0),
      totalSpent: Number(row.totalSpent ?? 0),
      averageTicket: row.averageTicket == null ? 0 : Number(row.averageTicket),
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}

// --- COUPONS (EXTENDED) -------------------------------------------------------

export async function getCouponsByUser(userId: number, storeId?: number): Promise<Coupon[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db
    .select()
    .from(coupons)
    .where(and(eq(coupons.userId, userId), eq(coupons.storeId, effectiveStoreId), eq(coupons.active, true)));
}

export async function createUserCoupon(data: {
  storeId: number;
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
  const [membership] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, data.userId), eq(orders.storeId, data.storeId)))
    .limit(1);
  if (!membership) throw new Error("Cliente não pertence à loja selecionada");
  await db.insert(coupons).values({
    ...data,
    active: true,
    usedCount: 0,
  });
}

// --- UP-SELLS -----------------------------------------------------------------

async function getEffectiveStoreId(db: DatabaseClient, storeId?: number) {
  if (storeId && storeId > 0) return storeId;
  return (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id ?? 0;
}

export async function getActiveUpsells(storeId?: number): Promise<Upsell[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db
    .select()
    .from(upsells)
    .where(and(eq(upsells.storeId, effectiveStoreId), eq(upsells.active, true)))
    .orderBy(upsells.sortOrder);
}

export async function getUpsellsForCart(cartProductIds: number[], cartTotal: number, storeId?: number): Promise<(Upsell & { suggestedProduct: Product | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const all = await db.select().from(upsells).where(and(eq(upsells.storeId, effectiveStoreId), eq(upsells.active, true))).orderBy(upsells.sortOrder);
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
    ? await db.select().from(products).where(and(
      eq(products.storeId, effectiveStoreId),
      sql`${products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`,
    ))
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

export async function updateUpsell(id: number, storeId: number, data: Partial<typeof upsells.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(upsells).set(data).where(and(eq(upsells.id, id), eq(upsells.storeId, storeId)));
}

export async function deleteUpsell(id: number, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(upsells).where(and(eq(upsells.id, id), eq(upsells.storeId, storeId)));
}

export async function getAllUpsells(storeId?: number): Promise<Upsell[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(upsells).where(eq(upsells.storeId, effectiveStoreId)).orderBy(upsells.sortOrder);
}

// --- PROMOTIONS ---------------------------------------------------------------

export async function getActivePromotions(storeId?: number): Promise<Promotion[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const now = new Date();
  const all = await db.select().from(promotions).where(and(eq(promotions.storeId, effectiveStoreId), eq(promotions.active, true))).orderBy(desc(promotions.createdAt));
  return all.filter((p) => {
    if (p.endsAt && p.endsAt < now) return false;
    if (p.startsAt && p.startsAt > now) return false;
    return true;
  });
}

export async function getAllPromotions(storeId?: number): Promise<Promotion[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(promotions).where(eq(promotions.storeId, effectiveStoreId)).orderBy(desc(promotions.createdAt));
}

export async function createPromotion(data: Omit<typeof promotions.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(promotions).values(data);
}

export async function updatePromotion(id: number, storeId: number, data: Partial<typeof promotions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promotions).set(data).where(and(eq(promotions.id, id), eq(promotions.storeId, storeId)));
}

export async function deletePromotion(id: number, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(promotions).where(and(eq(promotions.id, id), eq(promotions.storeId, storeId)));
}

// --- RAFFLES ------------------------------------------------------------------

export async function getActiveRaffles(storeId?: number): Promise<Raffle[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(raffles).where(and(eq(raffles.storeId, effectiveStoreId), eq(raffles.status, "active"))).orderBy(desc(raffles.createdAt));
}

export async function getAllRaffles(storeId?: number): Promise<Raffle[]> {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(raffles).where(eq(raffles.storeId, effectiveStoreId)).orderBy(desc(raffles.createdAt));
}

export async function createRaffle(data: Omit<typeof raffles.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(raffles).values(data);
}

export async function updateRaffle(id: number, storeId: number, data: Partial<typeof raffles.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(raffles).set(data).where(and(eq(raffles.id, id), eq(raffles.storeId, storeId)));
}

export async function getRaffleEntries(raffleId: number, storeId: number): Promise<RaffleEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const [raffle] = await db.select({ id: raffles.id }).from(raffles).where(and(eq(raffles.id, raffleId), eq(raffles.storeId, storeId))).limit(1);
  if (!raffle) return [];
  return db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
}

export async function enterRaffle(raffleId: number, userId: number, userName: string, storeId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const [raffle] = await db.select({ id: raffles.id }).from(raffles).where(and(eq(raffles.id, raffleId), eq(raffles.storeId, effectiveStoreId), eq(raffles.status, "active"))).limit(1);
  if (!raffle) return false;
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

export async function drawRaffleWinner(raffleId: number, storeId: number): Promise<RaffleEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [raffle] = await db.select({ id: raffles.id }).from(raffles).where(and(eq(raffles.id, raffleId), eq(raffles.storeId, storeId))).limit(1);
  if (!raffle) return null;
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
export async function getStoreSetting(key: string, storeId = 0): Promise<string | null> {
  return withDbRetry(async (db) => {
    const effectiveStoreId = storeId || (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id || 0;
    const rows = await db.select().from(storeSettings)
      .where(and(eq(storeSettings.storeId, effectiveStoreId), eq(storeSettings.key, key)))
      .limit(1);
    return rows[0]?.value ?? null;
  }).catch(() => null);
}

export async function getAllStoreSettings(storeId = 0): Promise<Record<string, string>> {
  return withDbRetry(async (db) => {
    const effectiveStoreId = storeId || (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id || 0;
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.storeId, effectiveStoreId));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }).catch(() => ({}));
}

export async function setStoreSetting(key: string, value: string, storeId = 0): Promise<void> {
  await withDbRetry(async (db) => {
    const effectiveStoreId = storeId || (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id || 0;
    await db
      .insert(storeSettings)
      .values({ storeId: effectiveStoreId, key, value })
      .onConflictDoUpdate({ target: [storeSettings.storeId, storeSettings.key], set: { value, updatedAt: new Date() } });
  });
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

  const [created] = await db
    .insert(drivers)
    .values(data)
    .returning({ id: drivers.id });

  if (!created?.id) {
    throw new Error("Driver was inserted without a returned id");
  }

  return created.id;
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

  const [current] = await db
    .select({
      driverId: orders.driverId,
      driverAcceptedAt: orders.driverAcceptedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  await db
    .update(orders)
    .set({
      driverId,
      driverAcceptedAt: current?.driverId === driverId
        ? current.driverAcceptedAt
        : null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

export async function driverAcceptOrder(
  driverId: number,
  orderId: number,
): Promise<{ success: boolean; error?: string; acceptedAt?: Date }> {
  const db = await getDb();
  if (!db) return { success: false, error: "DB not available" };

  const [order] = await db
    .select({
      id: orders.id,
      driverId: orders.driverId,
      status: orders.status,
      driverAcceptedAt: orders.driverAcceptedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.driverId !== driverId || order.status !== "out_for_delivery") {
    return { success: false, error: "Pedido não está disponível para este motoboy." };
  }

  if (order.driverAcceptedAt) {
    return { success: true, acceptedAt: order.driverAcceptedAt };
  }

  const acceptedAt = new Date();
  const [updated] = await db
    .update(orders)
    .set({ driverAcceptedAt: acceptedAt, updatedAt: acceptedAt })
    .where(and(
      eq(orders.id, orderId),
      eq(orders.driverId, driverId),
      eq(orders.status, "out_for_delivery"),
    ))
    .returning({ driverAcceptedAt: orders.driverAcceptedAt });

  if (!updated?.driverAcceptedAt) {
    return { success: false, error: "Não foi possível aceitar este pedido." };
  }

  return { success: true, acceptedAt: updated.driverAcceptedAt };
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

export async function getAllActiveDriverLocations(storeId?: number): Promise<(DriverLocation & { driverName: string })[]> {
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
    .where(
      and(
        eq(drivers.active, true),
        storeId ? eq(drivers.storeId, storeId) : undefined,
      ),
    );
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

export async function getClientNotifications(userId: number, storeId?: number): Promise<ClientNotification[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientNotifications).where(and(
    eq(clientNotifications.userId, userId),
    isNull(clientNotifications.archivedAt),
    storeId ? eq(clientNotifications.storeId, storeId) : undefined,
  )).orderBy(desc(clientNotifications.createdAt)).limit(50);
}

export async function getUnreadNotificationCount(userId: number, storeId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(clientNotifications).where(and(
    eq(clientNotifications.userId, userId),
    eq(clientNotifications.read, false),
    isNull(clientNotifications.archivedAt),
    storeId ? eq(clientNotifications.storeId, storeId) : undefined,
  ));
  return result[0]?.count ?? 0;
}

export async function markNotificationsRead(userId: number, storeId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientNotifications).set({ read: true }).where(and(
    eq(clientNotifications.userId, userId),
    storeId ? eq(clientNotifications.storeId, storeId) : undefined,
  ));
}

export async function markNotificationRead(notificationId: number, userId: number, storeId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientNotifications).set({ read: true }).where(and(
    eq(clientNotifications.id, notificationId),
    eq(clientNotifications.userId, userId),
    storeId ? eq(clientNotifications.storeId, storeId) : undefined,
  ));
}

export async function archiveClientNotification(notificationId: number, userId: number, storeId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientNotifications).set({ archivedAt: new Date(), read: true }).where(and(
    eq(clientNotifications.id, notificationId),
    eq(clientNotifications.userId, userId),
    storeId ? eq(clientNotifications.storeId, storeId) : undefined,
  ));
}

export async function createClientNotification(data: { storeId?: number | null; userId: number; title: string; message: string; imageUrl?: string | null; url?: string | null; dedupeKey?: string | null; type: 'order' | 'promo' | 'system' }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const query = db.insert(clientNotifications).values(data);
  if (data.dedupeKey) {
    await query.onConflictDoNothing({
      target: [clientNotifications.storeId, clientNotifications.userId, clientNotifications.dedupeKey],
    });
    return;
  }
  await query;
}

// --- STORE CUSTOMER ACCOUNT / LOYALTY ----------------------------------------
export async function getStoreScope(storeId?: number | null): Promise<{ storeId: number; isDefault: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [store] = storeId
    ? await db
        .select({ id: stores.id, isDefault: stores.isDefault })
        .from(stores)
        .where(and(eq(stores.id, storeId), eq(stores.active, true)))
        .limit(1)
    : await db
        .select({ id: stores.id, isDefault: stores.isDefault })
        .from(stores)
        .where(eq(stores.active, true))
        .orderBy(desc(stores.isDefault), stores.id)
        .limit(1);

  if (!store) throw new Error("No active store configured");
  return { storeId: store.id, isDefault: store.isDefault };
}

export async function getCustomerStoreAccount(userId: number, storeId?: number | null) {
  const db = await getDb();
  if (!db) return null;

  const scope = await getStoreScope(storeId);
  let [account] = await db
    .select()
    .from(customerStoreAccounts)
    .where(and(
      eq(customerStoreAccounts.storeId, scope.storeId),
      eq(customerStoreAccounts.userId, userId),
    ))
    .limit(1);
  if (account) return account;

  const [legacyUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!legacyUser) return null;

  await db
    .insert(customerStoreAccounts)
    .values({
      storeId: scope.storeId,
      userId,
      loyaltyPoints: scope.isDefault ? legacyUser.loyaltyPoints : 0,
      clubPlan: scope.isDefault ? legacyUser.clubPlan : null,
      clubStatus: scope.isDefault ? legacyUser.clubStatus : null,
      clubStartDate: scope.isDefault ? legacyUser.clubStartDate : null,
      clubNextBillingDate: scope.isDefault ? legacyUser.clubNextBillingDate : null,
      clubFreePizzaUsed: scope.isDefault ? legacyUser.clubFreePizzaUsed : false,
      clubFreePizzaResetAt: scope.isDefault ? legacyUser.clubFreePizzaResetAt : null,
      stripeCustomerId: scope.isDefault ? legacyUser.stripeCustomerId : null,
    })
    .onConflictDoNothing({
      target: [customerStoreAccounts.storeId, customerStoreAccounts.userId],
    });

  [account] = await db
    .select()
    .from(customerStoreAccounts)
    .where(and(
      eq(customerStoreAccounts.storeId, scope.storeId),
      eq(customerStoreAccounts.userId, userId),
    ))
    .limit(1);

  return account ?? null;
}

export async function getUserLoyaltyPoints(userId: number, storeId?: number | null): Promise<number> {
  return (await getCustomerStoreAccount(userId, storeId))?.loyaltyPoints ?? 0;
}

export async function addLoyaltyPoints(
  userId: number,
  points: number,
  orderId?: number,
  description?: string,
  storeId?: number | null,
): Promise<void> {
  const db = await getDb();
  if (!db || points === 0) return;

  const scope = await getStoreScope(storeId);
  const account = await getCustomerStoreAccount(userId, scope.storeId);
  if (!account) return;

  const [updated] = await db
    .update(customerStoreAccounts)
    .set({
      loyaltyPoints: sql`GREATEST(0, ${customerStoreAccounts.loyaltyPoints} + ${points})`,
      updatedAt: new Date(),
    })
    .where(eq(customerStoreAccounts.id, account.id))
    .returning({ loyaltyPoints: customerStoreAccounts.loyaltyPoints });

  const balanceAfter = updated?.loyaltyPoints ?? account.loyaltyPoints;
  const balanceBefore = Math.max(0, balanceAfter - points);

  await db.insert(loyaltyTransactions).values({
    storeId: scope.storeId,
    userId,
    orderId: orderId ?? null,
    type: points > 0 ? "earn" : "manual",
    points,
    description: description ?? `${points > 0 ? "+" : ""}${points} pontos por pedido #${orderId ?? ""}`,
    balanceBefore,
    balanceAfter,
  });
}

export async function deductLoyaltyPoints(
  userId: number,
  points: number,
  orderId?: number,
  description?: string,
  storeId?: number | null,
): Promise<{ ok: boolean; newBalance: number }> {
  return deductLoyaltyPointsAtomic(userId, points, orderId, description, storeId);
}

export async function getLoyaltyHistory(userId: number, limit = 30, storeId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const scope = await getStoreScope(storeId);

  return db
    .select()
    .from(loyaltyTransactions)
    .where(and(
      eq(loyaltyTransactions.userId, userId),
      eq(loyaltyTransactions.storeId, scope.storeId),
    ))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit);
}

export async function updateUserAvatar(userId: number, avatarUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
}

export async function getUserSpendingHistory(userId: number, storeId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const month = sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`;
  return db
    .select({
      month,
      total: sql<number>`COALESCE(SUM(${orders.total}), 0)::numeric`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(orders)
    .where(and(
      eq(orders.userId, userId),
      eq(orders.status, 'delivered'),
      storeId ? eq(orders.storeId, storeId) : undefined,
    ))
    .groupBy(month)
    .orderBy(month)
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
  const [msg] = await db.insert(orderMessages).values(data).returning();
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

  const limit = Math.min(10_000, Math.max(1, opts?.limit ?? 100));
  const offset = Math.max(0, opts?.offset ?? 0);
  const search = opts?.search?.trim() ?? "";
  const searchCondition = search
    ? or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(users.phone, `%${search}%`),
      )
    : undefined;

  type CrmListRow = {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    loyaltyPoints: number | null;
    createdAt: Date;
    lastSignedIn: Date;
    totalOrders: number | null;
    totalSpent: string | null;
    lastOrderAt: Date | null;
    deliveredOrders: number | null;
  };

  let rows: CrmListRow[];

  if (opts?.storeId) {
    rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        loyaltyPoints: customerStoreAccounts.loyaltyPoints,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
        totalOrders: customerMetrics.totalOrders,
        totalSpent: customerMetrics.totalSpent,
        lastOrderAt: customerMetrics.lastOrderAt,
        deliveredOrders: customerMetrics.deliveredOrders,
      })
      .from(users)
      .innerJoin(
        customerMetrics,
        and(
          eq(customerMetrics.userId, users.id),
          eq(customerMetrics.storeId, opts.storeId),
        ),
      )
      .leftJoin(
        customerStoreAccounts,
        and(
          eq(customerStoreAccounts.userId, users.id),
          eq(customerStoreAccounts.storeId, opts.storeId),
        ),
      )
      .where(and(
        eq(users.role, "user"),
        gt(customerMetrics.totalOrders, 0),
        searchCondition,
      ))
      .orderBy(desc(customerMetrics.lastOrderAt), desc(users.createdAt))
      .limit(limit)
      .offset(offset);
  } else {
    rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        loyaltyPoints: users.loyaltyPoints,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
        totalOrders: customerMetrics.totalOrders,
        totalSpent: customerMetrics.totalSpent,
        lastOrderAt: customerMetrics.lastOrderAt,
        deliveredOrders: customerMetrics.deliveredOrders,
      })
      .from(users)
      .leftJoin(
        customerMetrics,
        and(
          eq(customerMetrics.userId, users.id),
          eq(customerMetrics.storeId, 0),
        ),
      )
      .where(and(eq(users.role, "user"), searchCondition))
      .orderBy(desc(customerMetrics.lastOrderAt), desc(users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const userIds = rows.map((row) => row.id);
  const tagRows = userIds.length > 0
    ? await db
        .select({
          userId: customerTags.userId,
          tag: customerTags.tag,
          assignedAt: customerTags.assignedAt,
        })
        .from(customerTags)
        .where(and(
          inArray(customerTags.userId, userIds),
          opts?.storeId ? eq(customerTags.storeId, opts.storeId) : undefined,
        ))
        .orderBy(desc(customerTags.assignedAt))
    : [];

  const tagsByUser = new Map<number, string[]>();
  for (const tagRow of tagRows) {
    const tags = tagsByUser.get(tagRow.userId) ?? [];
    if (!tags.includes(tagRow.tag)) tags.push(tagRow.tag);
    tagsByUser.set(tagRow.userId, tags);
  }

  return rows.map((row) => ({
    ...row,
    loyaltyPoints: Number(row.loyaltyPoints ?? 0),
    totalOrders: Number(row.totalOrders ?? 0),
    totalSpent: Number(row.totalSpent ?? 0),
    deliveredOrders: Number(row.deliveredOrders ?? 0),
    tags: tagsByUser.get(row.id)?.join(",") ?? null,
  }));
}
export async function countCrmCustomers(search?: string, storeId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const normalized = search?.trim() ?? "";
  const searchCondition = normalized
    ? or(
        ilike(users.name, `%${normalized}%`),
        ilike(users.email, `%${normalized}%`),
        ilike(users.phone, `%${normalized}%`),
      )
    : undefined;

  const rows = storeId
    ? await db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .innerJoin(
          customerMetrics,
          and(
            eq(customerMetrics.userId, users.id),
            eq(customerMetrics.storeId, storeId),
          ),
        )
        .where(and(
          eq(users.role, "user"),
          gt(customerMetrics.totalOrders, 0),
          searchCondition,
        ))
    : await db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "user"), searchCondition));

  return Number(rows[0]?.total ?? 0);
}
export async function getCrmCustomerDetail(userId: number, storeId?: number) {
  const db = await getDb();
  if (!db) return null;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows.length) return null;
  // Strip sensitive fields before returning to the admin CRM view
  const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...baseSafeUser } = userRows[0] as typeof userRows[0] & {
    passwordHash?: unknown; resetToken?: unknown; resetTokenExpiresAt?: unknown;
  };
  const account = storeId ? await getCustomerStoreAccount(userId, storeId) : null;
  const safeUser = account ? {
    ...baseSafeUser,
    loyaltyPoints: account.loyaltyPoints,
    clubPlan: account.clubPlan,
    clubStatus: account.clubStatus,
    clubStartDate: account.clubStartDate,
    clubNextBillingDate: account.clubNextBillingDate,
    clubFreePizzaUsed: account.clubFreePizzaUsed,
    clubFreePizzaResetAt: account.clubFreePizzaResetAt,
  } : baseSafeUser;

  const orderRows = await db
    .select()
    .from(orders)
    .where(storeId ? and(eq(orders.userId, userId), eq(orders.storeId, storeId)) : eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  return { user: safeUser, orders: orderRows };
}

/**
 * Lista clientes filtrados por tag específica.
 */
export async function getCrmCustomersByTag(tag: string, storeId: number) {
  const db = await getDb();
  if (!db) return [];

  const tagged = await db
    .select({ userId: customerTags.userId })
    .from(customerTags)
    .where(and(
      eq(customerTags.storeId, storeId),
      eq(customerTags.tag, tag as typeof customerTags.$inferSelect["tag"]),
    ));

  if (tagged.length === 0) return [];
  const ids = new Set(tagged.map((row) => row.userId));
  const customers = await getCrmCustomers({ storeId, limit: 10_000, offset: 0 });
  return customers.filter((customer) => ids.has(customer.id));
}
export async function assignTagToCustomer(userId: number, tag: string, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(customerTags)
    .values({
      storeId,
      userId,
      tag: tag as typeof customerTags.$inferInsert["tag"],
      assignedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [customerTags.storeId, customerTags.userId, customerTags.tag],
      set: { updatedAt: new Date() },
    });
}
export async function removeTagFromCustomer(userId: number, tag: string, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(customerTags)
    .where(and(
      eq(customerTags.storeId, storeId),
      eq(customerTags.userId, userId),
      eq(customerTags.tag, tag as typeof customerTags.$inferSelect["tag"]),
    ));
}
export async function getTagsForCustomer(
  userId: number,
  storeId: number,
): Promise<Array<{ tag: string; assignedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      tag: customerTags.tag,
      assignedAt: customerTags.assignedAt,
    })
    .from(customerTags)
    .where(and(
      eq(customerTags.storeId, storeId),
      eq(customerTags.userId, userId),
    ))
    .orderBy(desc(customerTags.assignedAt));
}
export async function getJourneyExecutionsByUser(userId: number, storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: journeyExecutions.id,
      journeyId: journeyExecutions.journeyId,
      journeyName: journeys.name,
      status: journeyExecutions.status,
      currentStep: journeyExecutions.currentStep,
      startedAt: journeyExecutions.startedAt,
      completedAt: journeyExecutions.completedAt,
      logs: journeyExecutions.logs,
    })
    .from(journeyExecutions)
    .leftJoin(journeys, eq(journeys.id, journeyExecutions.journeyId))
    .where(and(
      eq(journeyExecutions.storeId, storeId),
      eq(journeyExecutions.userId, userId),
    ))
    .orderBy(desc(journeyExecutions.startedAt))
    .limit(20);
}
export async function getAbandonedCartsByUser(userId: number, storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: abandonedCarts.id,
      status: abandonedCarts.status,
      total: abandonedCarts.total,
      items: abandonedCarts.items,
      createdAt: abandonedCarts.createdAt,
      firstReminderSentAt: abandonedCarts.firstReminderSentAt,
      secondReminderSentAt: abandonedCarts.secondReminderSentAt,
    })
    .from(abandonedCarts)
    .where(and(
      eq(abandonedCarts.storeId, storeId),
      eq(abandonedCarts.userId, userId),
    ))
    .orderBy(desc(abandonedCarts.createdAt))
    .limit(10);
}
export async function getCrmStats(storeId?: number) {
  const db = await getDb();
  if (!db) return null;

  const metricsStoreId = storeId ?? 0;
  const [lifetime] = await db
    .select({
      totalCustomers: sql<number>`count(*)::int`,
      repeatCustomers: sql<number>`count(*) FILTER (WHERE ${customerMetrics.deliveredOrders} > 1)::int`,
      totalLifetimeRevenue: sql<string>`COALESCE(SUM(${customerMetrics.totalSpent}), 0)`,
      avgLtv: sql<string>`COALESCE(AVG(${customerMetrics.totalSpent}), 0)`,
    })
    .from(customerMetrics)
    .where(and(
      eq(customerMetrics.storeId, metricsStoreId),
      gt(customerMetrics.totalOrders, 0),
    ));

  const countTag = async (tag: typeof customerTags.$inferSelect["tag"]) => {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(customerTags)
      .where(and(
        storeId ? eq(customerTags.storeId, storeId) : undefined,
        eq(customerTags.tag, tag),
      ));
    return Number(row?.total ?? 0);
  };

  const [
    tagNovo,
    tagRecorrente,
    tagIndeciso,
    tagInativo15,
    tagInativo30,
    tagInativo60,
    cartRows,
    journeyRows,
  ] = await Promise.all([
    countTag("novo"),
    countTag("recorrente"),
    countTag("indeciso"),
    countTag("inativo_15"),
    countTag("inativo_30"),
    countTag("inativo_60"),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.status, "pending"),
        storeId ? eq(abandonedCarts.storeId, storeId) : undefined,
      )),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(journeyExecutions)
      .where(and(
        eq(journeyExecutions.status, "running"),
        storeId ? eq(journeyExecutions.storeId, storeId) : undefined,
      )),
  ]);

  const totalCustomers = Number(lifetime?.totalCustomers ?? 0);
  const repeatCustomers = Number(lifetime?.repeatCustomers ?? 0);

  return {
    totalCustomers,
    repeatCustomers,
    retentionRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
    totalLifetimeRevenue: Number(lifetime?.totalLifetimeRevenue ?? 0),
    avgLtv: Number(lifetime?.avgLtv ?? 0),
    tagNovo,
    tagRecorrente,
    tagIndeciso,
    tagInativo15,
    tagInativo30,
    tagInativo60,
    carrinhosPendentes: Number(cartRows[0]?.total ?? 0),
    jornadasAtivas: Number(journeyRows[0]?.total ?? 0),
  };
}
export async function listNotificationTemplates(opts?: { storeId?: number; event?: string; channel?: string }) {
  const db = await getDb();
  if (!db) return [];
  const storeId = await getEffectiveStoreId(db, opts?.storeId);
  const conditions: SQL[] = [eq(notificationTemplates.storeId, storeId)];
  if (opts?.event) conditions.push(eq(notificationTemplates.event, opts.event as NotificationTemplate["event"]));
  if (opts?.channel) conditions.push(eq(notificationTemplates.channel, opts.channel as NotificationTemplate["channel"]));
  return db.select().from(notificationTemplates)
    .where(and(...conditions))
    .orderBy(notificationTemplates.event, notificationTemplates.channel);
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
export async function updateNotificationTemplate(id: number, storeId: number, data: Partial<InsertNotificationTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notificationTemplates).set(data)
    .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.storeId, storeId)));
}

/**
 * Remove um template.
 */
export async function deleteNotificationTemplate(id: number, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(notificationTemplates)
    .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.storeId, storeId)));
}

/**
 * Sorteia aleatoriamente um template ativo para um evento e canal.
 * Fallback para templates do canal "both" se não houver específico.
 * Retorna null se não houver nenhum template ativo.
 */
export async function pickRandomTemplate(
  event: string,
  channel: "push" | "whatsapp",
  requestedStoreId?: number,
): Promise<{ title: string; body: string; imageUrl: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  const storeId = await getEffectiveStoreId(db, requestedStoreId);
  const rows = await db
    .select({
      title: notificationTemplates.title,
      body: notificationTemplates.body,
      imageUrl: notificationTemplates.imageUrl,
    })
    .from(notificationTemplates)
    .where(and(
      eq(notificationTemplates.storeId, storeId),
      eq(notificationTemplates.event, event as typeof notificationTemplates.$inferSelect["event"]),
      or(
        eq(notificationTemplates.channel, channel),
        eq(notificationTemplates.channel, "both"),
      ),
      eq(notificationTemplates.isActive, true),
    ))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Seed de templates variados por status. Só insere se a tabela estiver vazia.
 */
export async function seedNotificationTemplates(requestedStoreId?: number) {
  const db = await getDb();
  if (!db) return;
  const storeId = await getEffectiveStoreId(db, requestedStoreId);
  const existing = await db.select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(eq(notificationTemplates.storeId, storeId))
    .limit(1);
  if (existing.length > 0) return;

  const templates: InsertNotificationTemplate[] = [
    // ── order_confirmed ──
    { event: "order_confirmed", channel: "push", title: "✅ Pedido confirmado", body: "Seu pedido #{{orderId}} foi confirmado pela loja." },
    { event: "order_confirmed", channel: "push", title: "🍕 Pedido recebido", body: "Recebemos o pedido #{{orderId}} e ele já entrou na fila." },
    { event: "order_confirmed", channel: "push", title: "👌 Pedido aceito", body: "{{clientName}}, seu pedido #{{orderId}} foi aceito pela loja." },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "Oi, {{clientName}}! Seu pedido #{{orderId}} foi confirmado. Se precisar falar com a loja, responda por aqui." },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "Oi, {{clientName}}! Recebemos seu pedido #{{orderId}}. Você pode acompanhar o andamento pelo site." },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "{{clientName}}, o pedido #{{orderId}} está confirmado e já foi enviado para a equipe da loja." },

    // ── order_preparing ──
    { event: "order_preparing", channel: "push", title: "👨‍🍳 Pedido em preparo", body: "Seu pedido #{{orderId}} está sendo preparado." },
    { event: "order_preparing", channel: "push", title: "🔥 Em preparo", body: "O pedido #{{orderId}} está em preparo na loja." },
    { event: "order_preparing", channel: "push", title: "🍕 Preparando seu pedido", body: "A equipe está preparando o pedido #{{orderId}}." },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "{{clientName}}, seu pedido #{{orderId}} está sendo preparado pela loja." },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "Oi, {{clientName}}! O pedido #{{orderId}} está em preparo. Avisaremos quando ele sair para entrega." },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "{{clientName}}, o pedido #{{orderId}} entrou em preparo na loja." },

    // ── order_out_for_delivery ──
    { event: "order_out_for_delivery", channel: "push", title: "🛵 Saiu para entrega", body: "Seu pedido #{{orderId}} está a caminho." },
    { event: "order_out_for_delivery", channel: "push", title: "🛵 Pedido a caminho", body: "O pedido #{{orderId}} saiu para entrega." },
    { event: "order_out_for_delivery", channel: "push", title: "📍 Em rota de entrega", body: "O pedido #{{orderId}} está em rota de entrega." },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "{{clientName}}, seu pedido #{{orderId}} saiu para entrega e está a caminho." },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "Oi, {{clientName}}! O pedido #{{orderId}} está em rota de entrega." },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "{{clientName}}, seu pedido #{{orderId}} saiu para entrega." },

    // ── order_delivered ──
    { event: "order_delivered", channel: "push", title: "🎉 Entregue! Bom apetite!", body: "Seu pedido #{{orderId}} foi entregue. Bom apetite!" },
    { event: "order_delivered", channel: "push", title: "🍕 Pedido entregue", body: "Pedido #{{orderId}} entregue. Bom apetite, {{clientName}}!" },
    { event: "order_delivered", channel: "push", title: "✅ Pedido entregue", body: "O pedido #{{orderId}} foi entregue." },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "{{clientName}}, seu pedido #{{orderId}} foi entregue. 🍕 Bom apetite!" },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "Oi, {{clientName}}! O pedido #{{orderId}} foi entregue. Bom apetite!" },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "{{clientName}}, o pedido #{{orderId}} foi entregue. Obrigado pelo pedido!" },

    // ── order_cancelled ──
    { event: "order_cancelled", channel: "push", title: "❌ Pedido cancelado", body: "Seu pedido #{{orderId}} foi cancelado." },
    { event: "order_cancelled", channel: "push", title: "Pedido cancelado", body: "O pedido #{{orderId}} foi cancelado. Entre em contato com a loja se precisar de ajuda." },
    { event: "order_cancelled", channel: "whatsapp", title: "Cancelado", body: "{{clientName}}, o pedido #{{orderId}} foi cancelado. Entre em contato com a loja se precisar de mais informações." },
    { event: "order_cancelled", channel: "whatsapp", title: "Cancelado", body: "Oi, {{clientName}}. Seu pedido #{{orderId}} foi cancelado. Se precisar de ajuda, fale com a loja." },

    // ── cart_abandoned_step1 (10 min — urgência) ──
    { event: "cart_abandoned_step1", channel: "push", title: "🍕 Seu carrinho está salvo", body: "Seu pedido de R$ {{total}} continua no carrinho." },
    { event: "cart_abandoned_step1", channel: "push", title: "Seu carrinho continua aqui", body: "Você ainda pode finalizar o pedido de R$ {{total}}." },
    { event: "cart_abandoned_step1", channel: "push", title: "Carrinho salvo", body: "{{clientName}}, seu carrinho de R$ {{total}} continua disponível." },
    { event: "cart_abandoned_step1", channel: "whatsapp", title: "Carrinho abandonado - etapa 1", body: "Oi, {{clientName}}! Seu carrinho ainda está salvo.\n\n*Total: R$ {{total}}*\n\nSe quiser concluir o pedido, continue por aqui:\nhttps://bonattopizza.manus.space" },
    { event: "cart_abandoned_step1", channel: "whatsapp", title: "Carrinho abandonado - etapa 1", body: "Oi, {{clientName}}! Seu carrinho de *R$ {{total}}* continua salvo.\n\nSe quiser finalizar, acesse:\nhttps://bonattopizza.manus.space" },

    // ── cart_abandoned_step2 (20 min — benefício) ──
    { event: "cart_abandoned_step2", channel: "push", title: "Seu carrinho ainda está salvo", body: "O pedido de R$ {{total}} continua disponível para finalizar." },
    { event: "cart_abandoned_step2", channel: "push", title: "Pedido salvo", body: "Seu carrinho de R$ {{total}} continua disponível." },
    { event: "cart_abandoned_step2", channel: "push", title: "🍕 Carrinho salvo", body: "Seu pedido de R$ {{total}} ainda pode ser finalizado." },
    { event: "cart_abandoned_step2", channel: "whatsapp", title: "Carrinho abandonado - etapa 2", body: "Oi, {{clientName}}! Seu pedido de *R$ {{total}}* continua no carrinho.\n\nSe quiser finalizar, use o link abaixo:\nhttps://bonattopizza.manus.space" },
    { event: "cart_abandoned_step2", channel: "whatsapp", title: "Carrinho abandonado - etapa 2", body: "Oi, {{clientName}}! Seu carrinho de *R$ {{total}}* continua disponível.\n\nPara finalizar, acesse:\nhttps://bonattopizza.manus.space" },

    // ── cart_abandoned_step3 (30 min — escassez + cupom) ──
    { event: "cart_abandoned_step3", channel: "push", title: "🎁 Cupom de 10% para seu carrinho", body: "Use {{coupon}} nas próximas 48 horas." },
    { event: "cart_abandoned_step3", channel: "push", title: "🎁 10% de desconto no carrinho", body: "Use o cupom {{coupon}} nas próximas 48 horas." },
    { event: "cart_abandoned_step3", channel: "push", title: "Seu carrinho tem cupom", body: "Use {{coupon}} para ter 10% de desconto no pedido de R$ {{total}}." },
    { event: "cart_abandoned_step3", channel: "whatsapp", title: "Carrinho abandonado - etapa 3", body: "Oi, {{clientName}}! Seu carrinho ainda está salvo.\n\nUse o cupom *{{coupon}}* para ter *10% de desconto*.\n\nVálido por 48 horas.\n\nhttps://bonattopizza.manus.space" },
    { event: "cart_abandoned_step3", channel: "whatsapp", title: "Carrinho abandonado - etapa 3", body: "Oi, {{clientName}}! Seu pedido de *R$ {{total}}* continua salvo.\n\nCupom: *{{coupon}}*\nDesconto: *10%*\nValidade: 48 horas.\n\nhttps://bonattopizza.manus.space" },

    // ── reactivation_15 (inativo 15 dias — 5% OFF) ──
    { event: "reactivation_15", channel: "push", title: "🍕 5% de desconto no próximo pedido", body: "Cupom {{coupon}}, válido por 72 horas." },
    { event: "reactivation_15", channel: "push", title: "👋 Cupom para {{clientName}}", body: "Use {{coupon}} e tenha 5% de desconto no próximo pedido." },
    { event: "reactivation_15", channel: "whatsapp", title: "Reativação 15 dias", body: "Oi, {{clientName}}! Temos um cupom de *5% de desconto* para seu próximo pedido.\n\nCupom: *{{coupon}}*\nVálido por 72 horas.\n\nhttps://bonattopizza.manus.space" },
    { event: "reactivation_15", channel: "whatsapp", title: "Reativação 15 dias", body: "{{clientName}}, use o cupom *{{coupon}}* para ter *5% de desconto* no próximo pedido.\n\nVálido por 72 horas.\n\nhttps://bonattopizza.manus.space" },

    // ── reactivation_30 (inativo 30 dias — 10% OFF) ──
    { event: "reactivation_30", channel: "push", title: "🎁 10% de desconto no próximo pedido", body: "Use o cupom {{coupon}}." },
    { event: "reactivation_30", channel: "push", title: "Cupom de 10% para sua conta", body: "Use {{coupon}} no próximo pedido enquanto estiver válido." },
    { event: "reactivation_30", channel: "whatsapp", title: "Reativação 30 dias", body: "Oi, {{clientName}}! Seu próximo pedido tem *10% de desconto* com o cupom abaixo.\n\nCupom: *{{coupon}}*\nVálido por 48 horas.\n\nhttps://bonattopizza.manus.space" },
    { event: "reactivation_30", channel: "whatsapp", title: "Reativação 30 dias", body: "Oi, {{clientName}}! Use o cupom *{{coupon}}* para ter *10% de desconto* no próximo pedido.\n\nVálido por 48 horas.\n\nhttps://bonattopizza.manus.space" },

    // ── reactivation_60 (inativo 60 dias — 15% OFF) ──
    { event: "reactivation_60", channel: "push", title: "🍕 15% de desconto no próximo pedido", body: "Use o cupom {{coupon}}." },
    { event: "reactivation_60", channel: "push", title: "Cupom de 15% disponível", body: "Use {{coupon}} no seu próximo pedido." },
    { event: "reactivation_60", channel: "whatsapp", title: "Reativação 60 dias", body: "Oi, {{clientName}}! Temos um cupom de *15% de desconto* para seu próximo pedido.\n\nCupom: *{{coupon}}*\n\nhttps://bonattopizza.manus.space" },
    { event: "reactivation_60", channel: "whatsapp", title: "Reativação 60 dias", body: "{{clientName}}, use o cupom *{{coupon}}* para ter *15% de desconto* no próximo pedido.\n\nVálido por 24 horas.\n\nhttps://bonattopizza.manus.space" },
  ];

  await db.insert(notificationTemplates).values(templates.map((template) => ({ ...template, storeId })));
}

// --- DELIVERY ZONES (BAIRROS) -------------------------------------------------

export async function getAllDeliveryZones(activeOnly = false, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  if (activeOnly) {
    return db.select().from(deliveryZones)
      .where(and(eq(deliveryZones.storeId, effectiveStoreId), eq(deliveryZones.isActive, true)))
      .orderBy(deliveryZones.neighborhood);
  }
  return db.select().from(deliveryZones).where(eq(deliveryZones.storeId, effectiveStoreId)).orderBy(deliveryZones.neighborhood);
}

export async function getDeliveryZoneByNeighborhood(neighborhood: string, storeId?: number) {
  const db = await getDb();
  if (!db) return null;
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  // Busca case-insensitive: normaliza removendo acentos via LOWER
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE storeId = ${effectiveStoreId} AND LOWER(neighborhood) = LOWER(${neighborhood}) AND isActive = 1 LIMIT 1`
  );
  const list = (rows as unknown as [Array<Record<string, unknown>>])[0];
  if (!list || list.length === 0) return null;
  const r = list[0];
  return {
    id: Number(r.id),
    storeId: Number(r.storeId),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive),
  };
}

export async function searchDeliveryZones(query: string, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const like = `%${query}%`;
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE storeId = ${effectiveStoreId} AND LOWER(neighborhood) LIKE LOWER(${like}) AND isActive = 1 ORDER BY neighborhood LIMIT 10`
  );
  const list = (rows as unknown as [Array<Record<string, unknown>>])[0];
  return (list ?? []).map((r) => ({
    id: Number(r.id),
    storeId: Number(r.storeId),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive),
  }));
}

export async function createDeliveryZone(data: {
  storeId: number;
  neighborhood: string;
  city?: string;
  deliveryFee: string;
  estimatedMinutes?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deliveryZones).values({
    storeId: data.storeId,
    neighborhood: data.neighborhood.trim(),
    city: data.city?.trim() ?? "",
    deliveryFee: data.deliveryFee,
    estimatedMinutes: data.estimatedMinutes ?? 45,
    isActive: true,
  });
  return (result as unknown as { insertId: number }).insertId;
}

export async function updateDeliveryZone(id: number, storeId: number, data: Partial<{
  neighborhood: string;
  city: string;
  deliveryFee: string;
  estimatedMinutes: number;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deliveryZones).set(data).where(and(eq(deliveryZones.id, id), eq(deliveryZones.storeId, storeId)));
}

export async function deleteDeliveryZone(id: number, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(deliveryZones).where(and(eq(deliveryZones.id, id), eq(deliveryZones.storeId, storeId)));
}

// ─── MENU SLIDES ──────────────────────────────────────────────────────────────
export async function getMenuSlides(activeOnly = true, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const conditions = [eq(menuSlides.storeId, effectiveStoreId)];
  if (activeOnly) conditions.push(eq(menuSlides.isActive, true));
  const rows = await db
    .select()
    .from(menuSlides)
    .where(and(...conditions))
    .orderBy(menuSlides.sortOrder, menuSlides.id);
  return rows;
}

export async function createMenuSlide(data: {
  storeId: number;
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
    storeId: data.storeId,
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

export async function updateMenuSlide(id: number, storeId: number, data: Partial<{
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
  await db.update(menuSlides).set(data).where(and(eq(menuSlides.id, id), eq(menuSlides.storeId, storeId)));
  const [row] = await db.select().from(menuSlides).where(and(eq(menuSlides.id, id), eq(menuSlides.storeId, storeId)));
  return row;
}

export async function deleteMenuSlide(id: number, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(menuSlides).where(and(eq(menuSlides.id, id), eq(menuSlides.storeId, storeId)));
  return { success: true };
}

export async function seedMenuSlides(storeId?: number) {
  const db = await getDb();
  if (!db) return { seeded: false, count: 0 };
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const existing = await db.select().from(menuSlides).where(eq(menuSlides.storeId, effectiveStoreId));
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
    await db.insert(menuSlides).values({ ...slide, storeId: effectiveStoreId, isActive: true });
  }
  return { seeded: true, count: slides.length };
}

// ─── TAGS PERSONALIZADAS ──────────────────────────────────────────────────────

/** Lista todas as tags personalizadas criadas pelo admin */
export async function listCustomTags(storeId: number): Promise<CustomTag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customTags).where(eq(customTags.storeId, storeId)).orderBy(customTags.name);
}

/** Cria uma nova tag personalizada */
export async function createCustomTag(data: { storeId: number; name: string; color: string; description?: string }): Promise<number> {
  const db = await getDb();
  if (!db) return -1;
  const [created] = await db.insert(customTags).values({
    storeId: data.storeId,
    name: data.name.trim().toLowerCase().replace(/\s+/g, "_"),
    color: data.color,
    description: data.description ?? null,
    createdAt: new Date(),
  }).returning({ id: customTags.id });
  return created.id;
}

/** Atualiza uma tag personalizada */
export async function updateCustomTag(id: number, storeId: number, data: { name?: string; color?: string; description?: string }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updates: Record<string, unknown> = {};
  if (data.name) updates.name = data.name.trim().toLowerCase().replace(/\s+/g, "_");
  if (data.color) updates.color = data.color;
  if (data.description !== undefined) updates.description = data.description;
  await db.update(customTags).set(updates).where(and(eq(customTags.id, id), eq(customTags.storeId, storeId)));
}

/** Remove uma tag personalizada e todas as atribuições */
export async function deleteCustomTag(id: number, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags).where(and(eq(customCustomerTags.tagId, id), eq(customCustomerTags.storeId, storeId)));
  await db.delete(customTags).where(and(eq(customTags.id, id), eq(customTags.storeId, storeId)));
}

/** Atribui uma tag personalizada a um cliente */
export async function assignCustomTagToCustomer(userId: number, tagId: number, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(customCustomerTags)
    .where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(customCustomerTags).values({ storeId, userId, tagId, assignedAt: new Date() });
  }
}

/** Remove uma tag personalizada de um cliente */
export async function removeCustomTagFromCustomer(userId: number, tagId: number, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags)
    .where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId)));
}

/** Retorna as tags personalizadas de um cliente com detalhes */
export async function getCustomTagsForCustomer(userId: number, storeId: number): Promise<Array<CustomTag & { assignedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: customTags.id, storeId: customTags.storeId, name: customTags.name, color: customTags.color, description: customTags.description, createdAt: customTags.createdAt, assignedAt: customCustomerTags.assignedAt })
    .from(customCustomerTags)
    .innerJoin(customTags, eq(customCustomerTags.tagId, customTags.id))
    .where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.userId, userId)))
    .orderBy(customCustomerTags.assignedAt);
  return rows;
}

/** Retorna todos os clientes com uma tag personalizada específica (por nome) */
export async function getCustomersByCustomTagName(tagName: string, storeId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const tag = await db.select().from(customTags).where(and(eq(customTags.storeId, storeId), eq(customTags.name, tagName))).limit(1);
  if (!tag[0]) return [];
  const rows = await db.select({ userId: customCustomerTags.userId })
    .from(customCustomerTags)
    .where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.tagId, tag[0].id)));
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

export async function listScheduledNotifications(requestedStoreId?: number): Promise<ScheduledNotification[]> {
  const db = await getDb();
  if (!db) return [];
  const storeId = await getEffectiveStoreId(db, requestedStoreId);
  return db.select().from(scheduledNotifications)
    .where(eq(scheduledNotifications.storeId, storeId))
    .orderBy(desc(scheduledNotifications.scheduledAt));
}

export async function cancelScheduledNotification(id: number, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledNotifications)
    .set({ status: "cancelled" })
    .where(and(eq(scheduledNotifications.id, id), eq(scheduledNotifications.storeId, storeId)));
}

export async function deleteScheduledNotification(id: number, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(scheduledNotifications)
    .where(and(eq(scheduledNotifications.id, id), eq(scheduledNotifications.storeId, storeId)));
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
export async function getCarouselImages(activeOnly = true, storeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const conditions = [eq(carouselImages.storeId, effectiveStoreId)];
  if (activeOnly) conditions.push(eq(carouselImages.active, true));
  return db.select().from(carouselImages)
    .where(and(...conditions))
    .orderBy(carouselImages.sortOrder, carouselImages.id);
}
export async function createCarouselImage(data: {
  storeId: number;
  imageUrl: string;
  title?: string | null;
  destinationType?: "none" | "product" | "category" | "internal" | "external";
  destinationValue?: string | null;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(carouselImages).values({
    storeId: data.storeId,
    imageUrl: data.imageUrl,
    title: data.title ?? null,
    destinationType: data.destinationType ?? "none",
    destinationValue: data.destinationValue ?? null,
    sortOrder: data.sortOrder ?? 0,
    active: true,
  });
}
export async function updateCarouselImage(id: number, storeId: number, data: Partial<{
  imageUrl: string;
  title: string | null;
  destinationType: "none" | "product" | "category" | "internal" | "external";
  destinationValue: string | null;
  sortOrder: number;
  active: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(carouselImages).set(data).where(and(eq(carouselImages.id, id), eq(carouselImages.storeId, storeId)));
}
export async function deleteCarouselImage(id: number, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(carouselImages).where(and(eq(carouselImages.id, id), eq(carouselImages.storeId, storeId)));
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
  const { deliveryConfirmationCode: _privateDeliveryCode, ...safeOrder } = order;
  return { order: safeOrder, items };
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
      const { deliveryConfirmationCode: _privateDeliveryCode, ...safeOrder } = order;
      return { order: safeOrder, items };
    })
  );
  return results;
}

// --- DRIVER CONFIRM DELIVERY -------------------------------------------------

export async function driverConfirmDelivery(
  driverId: number,
  orderId: number,
  confirmationCode: string,
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
  if (!order.driverAcceptedAt) {
    return { success: false, error: "Aceite o pedido antes de confirmar a entrega." };
  }
  if (!order.deliveryConfirmationCode) {
    return { success: false, error: "Este pedido não possui código de entrega. Solicite apoio ao administrador." };
  }
  if (confirmationCode !== order.deliveryConfirmationCode) {
    return { success: false, error: "Código de entrega incorreto." };
  }

  const transition = await updateOrderStatusGuarded(orderId, "delivered", ["out_for_delivery"], {
    source: "driver",
    notes: "Entrega confirmada pelo motoboy",
  });
  if (!transition.ok) {
    return { success: false, error: "Pedido já foi finalizado ou mudou de status" };
  }
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
  imageUrl?: string;
  icon?: string;
  url?: string;
  storeId?: number;
  expiresAt?: Date;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [created] = await db.insert(clientAlerts).values({
    type: data.type,
    title: data.title,
    message: data.message,
    imageUrl: data.imageUrl ?? null,
    icon: data.icon ?? "🔔",
    url: data.url,
    storeId: data.storeId,
    active: true,
    expiresAt: data.expiresAt,
  }).returning({ id: clientAlerts.id });
  return created.id;
}

/** Lista alertas ativos não lidos pelo usuário (máx 20) */
export async function listClientAlerts(userId: number, storeId: number): Promise<(ClientAlert & { read: boolean })[]> {
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
        eq(clientAlerts.storeId, storeId),
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
export async function dismissClientAlert(alertId: number, userId: number, storeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [alert] = await db.select({ id: clientAlerts.id }).from(clientAlerts)
    .where(and(eq(clientAlerts.id, alertId), eq(clientAlerts.storeId, storeId))).limit(1);
  if (!alert) return;
  try {
    await db.insert(clientAlertReads).values({ alertId, userId });
  } catch {
    // unique constraint — já lido
  }
}

/** Conta alertas não lidos pelo usuário */
export async function countUnreadClientAlerts(userId: number, storeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const alerts = await db
    .select({ id: clientAlerts.id })
    .from(clientAlerts)
    .where(
      and(
        eq(clientAlerts.active, true),
        eq(clientAlerts.storeId, storeId),
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

export async function getAdminDashboardSnapshot(storeId?: number) {
  return withShortCache(`admin-dashboard:${storeId ?? "all"}`, 15_000, async () => {
    const now = new Date();
    const todayStart = getTodayStartUtc(now);
    const todayEnd = getTodayEndUtc(now);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);
    const last7DaysStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [today, yesterday, dailyRevenue, recentOrders, topProducts, topCategories, activeCounts] = await Promise.all([
      getSalesReport(todayStart, todayEnd, storeId),
      getSalesReport(yesterdayStart, yesterdayEnd, storeId),
      getDailyRevenue(7, storeId),
      getRecentOrdersFeed(20, storeId),
      getTopProducts(10, storeId, { startDate: last7DaysStart, endDate: todayEnd }),
      getTopCategories(last7DaysStart, todayEnd, storeId),
      withDbRetry(async (db) => {
        const rows = await db.execute(sql`
          SELECT
            SUM(CASE WHEN \`status\` = 'pending' THEN 1 ELSE 0 END) AS pendingOrders,
            SUM(CASE WHEN \`status\` = 'confirmed' THEN 1 ELSE 0 END) AS confirmedOrders,
            SUM(CASE WHEN \`status\` = 'preparing' THEN 1 ELSE 0 END) AS preparingOrders,
            SUM(CASE WHEN \`status\` = 'out_for_delivery' THEN 1 ELSE 0 END) AS outForDeliveryOrders
          FROM \`orders\`
          WHERE 1 = 1
          ${storeId ? sql`AND \`storeId\` = ${storeId}` : sql``}
        `);
        const item = (rows as unknown as [Array<{
          pendingOrders: number | string | null;
          confirmedOrders: number | string | null;
          preparingOrders: number | string | null;
          outForDeliveryOrders: number | string | null;
        }>])[0]?.[0];

        return {
          pendingOrders: Number(item?.pendingOrders ?? 0),
          confirmedOrders: Number(item?.confirmedOrders ?? 0),
          preparingOrders: Number(item?.preparingOrders ?? 0),
          outForDeliveryOrders: Number(item?.outForDeliveryOrders ?? 0),
        };
      }),
    ]);

    return {
      today,
      yesterday,
      dailyRevenue,
      recentOrders,
      topProducts,
      topCategories,
      activeCounts: {
        ...activeCounts,
        total:
          activeCounts.pendingOrders +
          activeCounts.confirmedOrders +
          activeCounts.preparingOrders +
          activeCounts.outForDeliveryOrders,
      },
      generatedAt: new Date().toISOString(),
    };
  });
}


// ============================================================================
// Security-hardening helpers: webhook idempotency, loyalty credit ledger,
// coupon redemption ledger, atomic loyalty debit and order status guard.
// ============================================================================

export type WebhookEventClaim = "claimed" | "duplicate" | "processing";

export async function claimWebhookEvent(
  provider: "stripe" | "asaas",
  eventId: string,
  eventType?: string,
  staleAfterMs = 5 * 60 * 1000,
): Promise<WebhookEventClaim> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();
  const [inserted] = await db
    .insert(webhookEvents)
    .values({
      provider,
      eventId,
      eventType: eventType ?? null,
      status: "processing",
      attempts: 1,
      lockedAt: now,
      processedAt: null,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });

  if (inserted) return "claimed";

  const [existing] = await db
    .select({
      status: webhookEvents.status,
      lockedAt: webhookEvents.lockedAt,
    })
    .from(webhookEvents)
    .where(and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.eventId, eventId),
    ))
    .limit(1);

  if (!existing) return "processing";
  if (existing.status === "processed") return "duplicate";

  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const reclaimable = existing.status === "failed"
    || (existing.status === "processing" && (!existing.lockedAt || existing.lockedAt <= staleBefore));

  if (!reclaimable) return "processing";

  const [claimed] = await db
    .update(webhookEvents)
    .set({
      eventType: eventType ?? null,
      status: "processing",
      attempts: sql`${webhookEvents.attempts} + 1`,
      lastError: null,
      lockedAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.eventId, eventId),
      or(
        eq(webhookEvents.status, "failed"),
        and(
          eq(webhookEvents.status, "processing"),
          or(isNull(webhookEvents.lockedAt), lte(webhookEvents.lockedAt, staleBefore)),
        ),
      ),
    ))
    .returning({ id: webhookEvents.id });

  return claimed ? "claimed" : "processing";
}

export async function completeWebhookEvent(
  provider: "stripe" | "asaas",
  eventId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(webhookEvents)
    .set({
      status: "processed",
      processedAt: new Date(),
      lockedAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.eventId, eventId),
      eq(webhookEvents.status, "processing"),
    ));
}

export async function failWebhookEvent(
  provider: "stripe" | "asaas",
  eventId: string,
  error: unknown,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const message = error instanceof Error ? error.message : String(error);
  await db
    .update(webhookEvents)
    .set({
      status: "failed",
      lastError: message.slice(0, 2000),
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(webhookEvents.provider, provider),
      eq(webhookEvents.eventId, eventId),
      eq(webhookEvents.status, "processing"),
    ));
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
  description?: string,
  storeId?: number | null,
): Promise<boolean> {
  if (points <= 0) return false;
  const db = await getDb();
  if (!db) return false;
  const scope = await getStoreScope(storeId);
  const inserted = await db
    .insert(loyaltyOrderCredits)
    .values({
      storeId: scope.storeId,
      orderId,
      userId,
      points,
    })
    .onConflictDoNothing({ target: loyaltyOrderCredits.orderId })
    .returning({ id: loyaltyOrderCredits.id });

  if (!inserted.length) return false;
  await addLoyaltyPoints(userId, points, orderId, description ?? `+${points} pontos pelo pedido #${orderId}`, scope.storeId);
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
  description?: string,
  storeId?: number | null,
): Promise<{ ok: boolean; newBalance: number }> {
  if (points <= 0) return { ok: true, newBalance: await getUserLoyaltyPoints(userId, storeId) };
  const db = await getDb();
  if (!db) return { ok: false, newBalance: 0 };
  const scope = await getStoreScope(storeId);
  const account = await getCustomerStoreAccount(userId, scope.storeId);
  if (!account) return { ok: false, newBalance: 0 };

  const [updated] = await db
    .update(customerStoreAccounts)
    .set({
      loyaltyPoints: sql`${customerStoreAccounts.loyaltyPoints} - ${points}`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(customerStoreAccounts.id, account.id),
      gte(customerStoreAccounts.loyaltyPoints, points),
    ))
    .returning({ loyaltyPoints: customerStoreAccounts.loyaltyPoints });

  if (!updated) {
    return { ok: false, newBalance: await getUserLoyaltyPoints(userId, scope.storeId) };
  }

  const newBalance = updated.loyaltyPoints;
  await db.insert(loyaltyTransactions).values({
    storeId: scope.storeId,
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
  if (!order || !order.userId || !order.storeId) return 0;
  const pointsUsed = order.pointsUsed ?? 0;
  if (pointsUsed <= 0) return 0;
  // Check if we already refunded (to prevent double-refund)
  const existing = await db
    .select()
    .from(loyaltyTransactions)
    .where(and(
      eq(loyaltyTransactions.orderId, orderId),
      eq(loyaltyTransactions.storeId, order.storeId),
    ))
  if (existing.some((transaction) => transaction.description?.startsWith("refund:"))) return 0;
  await addLoyaltyPoints(
    order.userId,
    pointsUsed,
    orderId,
    `refund: estorno de pontos por cancelamento do pedido #${orderId}`,
    order.storeId,
  );
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
  allowedCurrent: Order["status"][],
  opts?: {
    actorUserId?: number | null;
    source?: "system" | "admin" | "manager" | "driver" | "automation" | "customer";
    notes?: string | null;
    cancellationReasonCode?: NonNullable<Order["cancellationReasonCode"]>;
    cancellationReason?: string | null;
  },
): Promise<{ ok: boolean; previous?: Order["status"] }> {
  const result = await withDbRetry((db) =>
    db.transaction(async (tx) => {
      const current = await tx
        .select({
          status: orders.status,
          storeId: orders.storeId,
          orderNumber: orders.orderNumber,
          userId: orders.userId,
        })
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (!current[0]) return { ok: false };
      const previous = current[0].status;
      if (!allowedCurrent.includes(previous)) return { ok: false, previous };

      const transitionedAt = new Date();
      const statusPatch: Partial<typeof orders.$inferInsert> = {
        status: nextStatus,
        updatedAt: transitionedAt,
      };
      if (nextStatus === "confirmed") statusPatch.confirmedAt = transitionedAt;
      if (nextStatus === "preparing") statusPatch.preparingAt = transitionedAt;
      if (nextStatus === "out_for_delivery") statusPatch.outForDeliveryAt = transitionedAt;
      if (nextStatus === "delivered") statusPatch.deliveredAt = transitionedAt;
      if (nextStatus === "cancelled") {
        statusPatch.cancelledAt = transitionedAt;
        statusPatch.cancellationReasonCode = opts?.cancellationReasonCode ?? null;
        statusPatch.cancellationReason = opts?.cancellationReason?.trim().slice(0, 500) ?? null;
        statusPatch.cancelledByUserId = opts?.actorUserId ?? null;
      }

      const updated = await tx
        .update(orders)
        .set(statusPatch)
        .where(and(eq(orders.id, id), eq(orders.status, previous)))
        .returning({ id: orders.id });

      if (updated.length === 0) return { ok: false, previous };

      const stage =
        nextStatus === "pending"
          ? "created"
          : nextStatus === "confirmed"
            ? "confirmed"
            : nextStatus === "preparing"
              ? "preparing"
              : nextStatus === "out_for_delivery"
                ? "out_for_delivery"
                : nextStatus === "delivered"
                  ? "delivered"
                  : "cancelled";

      await tx.insert(orderStageLogs).values({
        orderId: id,
        previousStatus: previous,
        nextStatus,
        stage,
        source: opts?.source ?? "system",
        changedByUserId: opts?.actorUserId ?? null,
        notes: opts?.notes ?? null,
        metadata: JSON.stringify({
          previousStatus: previous,
          nextStatus,
          transactional: true,
        }),
      });

      const statusPayload = JSON.stringify({
        orderId: id,
        orderNumber: current[0].orderNumber,
        previousStatus: previous,
        nextStatus,
        actorUserId: opts?.actorUserId ?? null,
        source: opts?.source ?? "system",
      });
      const statusKey = `${id}:${previous}:${nextStatus}`;
      await tx
        .insert(eventOutbox)
        .values([
          {
            eventKey: `order.status_changed:${statusKey}`,
            eventType: "order.status_changed",
            aggregateType: "order",
            aggregateId: String(id),
            storeId: current[0].storeId ?? null,
            payload: statusPayload,
            status: "pending",
            availableAt: new Date(),
          },
          {
            eventKey: `order.status_changed.customer_push:${statusKey}`,
            eventType: "order.status_changed.customer_push",
            aggregateType: "order",
            aggregateId: String(id),
            storeId: current[0].storeId ?? null,
            payload: statusPayload,
            status: "pending",
            availableAt: new Date(),
          },
          {
            eventKey: `order.status_changed.customer_whatsapp:${statusKey}`,
            eventType: "order.status_changed.customer_whatsapp",
            aggregateType: "order",
            aggregateId: String(id),
            storeId: current[0].storeId ?? null,
            payload: statusPayload,
            status: "pending",
            availableAt: new Date(),
          },
        ])
        .onConflictDoNothing({ target: eventOutbox.eventKey });

      if (current[0].storeId) {
        await tx.insert(storeAuditLogs).values({
          storeId: current[0].storeId,
          actorUserId: opts?.actorUserId ?? null,
          action: "order.status_changed",
          resourceType: "order",
          resourceId: String(id),
          metadata: JSON.stringify({
            orderNumber: current[0].orderNumber,
            previousStatus: previous,
            nextStatus,
            source: opts?.source ?? "system",
            notes: opts?.notes ?? null,
            cancellationReasonCode: nextStatus === "cancelled" ? opts?.cancellationReasonCode ?? null : null,
            cancellationReason: nextStatus === "cancelled" ? opts?.cancellationReason ?? null : null,
          }),
        });
      }

      return {
        ok: true,
        previous,
        storeId: current[0].storeId,
        userId: current[0].userId,
      };
    })
  );

  if (result.ok) {
    void publishOrderRealtimeEvent({
      type: "status_changed",
      orderId: id,
      storeId: result.storeId ?? null,
      userId: result.userId ?? null,
      status: nextStatus,
      previousStatus: result.previous ?? null,
    });
  }
  return { ok: result.ok, previous: result.previous };
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
    const guard = await updateOrderStatusGuarded(row.id, "cancelled", ["pending"], {
      source: "system",
      notes: "Pagamento não confirmado dentro do prazo.",
      cancellationReasonCode: "payment",
      cancellationReason: "Pagamento não confirmado dentro do prazo.",
    });
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
