var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
function deriveSessionAppId() {
  const explicitAppId = process.env.VITE_APP_ID?.trim();
  if (explicitAppId) return explicitAppId;
  if (PUBLIC_APP_URL) {
    try {
      const hostname = new URL(PUBLIC_APP_URL).hostname.replace(/^www\./, "");
      if (hostname) return hostname;
    } catch {
    }
  }
  return "bonatto-web";
}
var IS_PRODUCTION, rawJwtSecret, PUBLIC_APP_URL, ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    IS_PRODUCTION = process.env.NODE_ENV === "production";
    rawJwtSecret = process.env.JWT_SECRET ?? "";
    if (IS_PRODUCTION && rawJwtSecret.length < 32) {
      console.warn(
        "[env] JWT_SECRET is missing or too short (" + rawJwtSecret.length + " chars). Set a random string of at least 32 chars for production security."
      );
    }
    if (!rawJwtSecret) {
      console.warn(
        "[env] JWT_SECRET is empty \u2014 sessions are signed with an empty key (dev only). Set JWT_SECRET for real auth."
      );
    }
    PUBLIC_APP_URL = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      sessionAppId: deriveSessionAppId(),
      cookieSecret: rawJwtSecret,
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? process.env.VITE_OAUTH_PORTAL_URL ?? "",
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID ?? "",
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: IS_PRODUCTION,
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      resendApiKey: process.env.RESEND_API_KEY ?? "",
      emailFrom: process.env.EMAIL_FROM ?? "Bonatto Pizza <onboarding@resend.dev>",
      publicAppUrl: PUBLIC_APP_URL,
      enablePersistentJobs: process.env.ENABLE_PERSISTENT_JOBS === "true"
    };
  }
});

// server/_core/notification.ts
var notification_exports = {};
__export(notification_exports, {
  notifyOwner: () => notifyOwner
});
import { TRPCError } from "@trpc/server";
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
var TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, trimValue, isNonEmptyString, buildEndpointUrl, validatePayload;
var init_notification = __esm({
  "server/_core/notification.ts"() {
    "use strict";
    init_env();
    TITLE_MAX_LENGTH = 1200;
    CONTENT_MAX_LENGTH = 2e4;
    trimValue = (value) => value.trim();
    isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
    buildEndpointUrl = (baseUrl) => {
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      return new URL(
        "webdevtoken.v1.WebDevService/SendNotification",
        normalizedBase
      ).toString();
    };
    validatePayload = (input) => {
      if (!isNonEmptyString(input.title)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification title is required."
        });
      }
      if (!isNonEmptyString(input.content)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification content is required."
        });
      }
      const title = trimValue(input.title);
      const content = trimValue(input.content);
      if (title.length > TITLE_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
        });
      }
      if (content.length > CONTENT_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
        });
      }
      return { title, content };
    };
  }
});

// shared/timezone.ts
function getBrasilOffsetMinutes(date = /* @__PURE__ */ new Date()) {
  const utcMs = date.getTime();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((localMs - utcMs) / 6e4);
}
function getBrasilTzOffset(date = /* @__PURE__ */ new Date()) {
  const offsetMinutes = getBrasilOffsetMinutes(date);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
function getTodayStartUtc(date = /* @__PURE__ */ new Date()) {
  const offsetMinutes = getBrasilOffsetMinutes(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const midnightLocalMs = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0, 0);
  return new Date(midnightLocalMs - offsetMinutes * 6e4);
}
function getTodayEndUtc(date = /* @__PURE__ */ new Date()) {
  const start = getTodayStartUtc(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1e3 - 1);
}
var TZ;
var init_timezone = __esm({
  "shared/timezone.ts"() {
    "use strict";
    TZ = "America/Sao_Paulo";
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  abandonedCarts: () => abandonedCarts,
  automationEvents: () => automationEvents,
  campaignSegments: () => campaignSegments,
  carouselImages: () => carouselImages,
  categories: () => categories,
  clientAlertReads: () => clientAlertReads,
  clientAlerts: () => clientAlerts,
  clientNotifications: () => clientNotifications,
  clubPayments: () => clubPayments,
  couponRedemptions: () => couponRedemptions,
  coupons: () => coupons,
  customCustomerTags: () => customCustomerTags,
  customTags: () => customTags,
  customerAuthProviders: () => customerAuthProviders,
  customerMetrics: () => customerMetrics,
  customerTags: () => customerTags,
  deliveryPredictions: () => deliveryPredictions,
  deliveryRatings: () => deliveryRatings,
  deliveryZones: () => deliveryZones,
  diningTables: () => diningTables,
  driverLocations: () => driverLocations,
  driverPushSubscriptions: () => driverPushSubscriptions,
  drivers: () => drivers,
  externalOrders: () => externalOrders,
  favorites: () => favorites,
  ifoodIntegrations: () => ifoodIntegrations,
  ifoodLogs: () => ifoodLogs,
  ingredients: () => ingredients,
  inventoryMovements: () => inventoryMovements,
  journeyExecutions: () => journeyExecutions,
  journeys: () => journeys,
  loyaltyOrderCredits: () => loyaltyOrderCredits,
  loyaltyTransactions: () => loyaltyTransactions,
  menuSlides: () => menuSlides,
  notificationCampaigns: () => notificationCampaigns,
  notificationLogs: () => notificationLogs,
  notificationTemplates: () => notificationTemplates,
  orderItems: () => orderItems,
  orderMessages: () => orderMessages,
  orderStageLogs: () => orderStageLogs,
  orders: () => orders,
  otpCodes: () => otpCodes,
  productIngredients: () => productIngredients,
  productivityEvents: () => productivityEvents,
  products: () => products,
  promotions: () => promotions,
  pushSubscriptions: () => pushSubscriptions,
  raffleEntries: () => raffleEntries,
  raffles: () => raffles,
  scheduledNotifications: () => scheduledNotifications,
  staffMembers: () => staffMembers,
  storeManagers: () => storeManagers,
  storeSettings: () => storeSettings,
  stores: () => stores,
  tableOrderLinks: () => tableOrderLinks,
  tableSessionItems: () => tableSessionItems,
  tableSessions: () => tableSessions,
  transactions: () => transactions,
  upsells: () => upsells,
  userAddresses: () => userAddresses,
  users: () => users,
  webhookEvents: () => webhookEvents
});
import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users, stores, storeManagers, categories, products, coupons, orders, ifoodIntegrations, externalOrders, ifoodLogs, loyaltyTransactions, orderItems, transactions, webhookEvents, loyaltyOrderCredits, couponRedemptions, upsells, promotions, raffles, raffleEntries, storeSettings, drivers, driverLocations, deliveryRatings, userAddresses, favorites, clientNotifications, orderMessages, ingredients, productIngredients, inventoryMovements, orderStageLogs, productivityEvents, staffMembers, deliveryPredictions, diningTables, tableSessions, tableOrderLinks, tableSessionItems, notificationCampaigns, campaignSegments, notificationLogs, customerMetrics, customerAuthProviders, otpCodes, pushSubscriptions, customerTags, customTags, customCustomerTags, abandonedCarts, journeys, journeyExecutions, notificationTemplates, deliveryZones, clubPayments, menuSlides, scheduledNotifications, carouselImages, driverPushSubscriptions, automationEvents, clientAlerts, clientAlertReads;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin", "manager"]).default("user").notNull(),
      phone: varchar("phone", { length: 20 }),
      status: mysqlEnum("status", ["active", "inactive", "suspended", "setup_pending"]).default("active").notNull(),
      savedAddress: text("savedAddress"),
      savedCep: varchar("savedCep", { length: 10 }),
      savedCity: varchar("savedCity", { length: 100 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
      passwordHash: text("passwordHash"),
      resetToken: varchar("resetToken", { length: 128 }),
      resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
      emailVerified: boolean("emailVerified").default(false).notNull(),
      avatarUrl: text("avatarUrl"),
      loyaltyPoints: int("loyaltyPoints").default(0).notNull(),
      // Clube do Bonatto
      clubPlan: mysqlEnum("clubPlan", ["bonattao", "basico"]),
      clubStatus: mysqlEnum("clubStatus", ["active", "pending", "cancelled"]),
      clubStartDate: timestamp("clubStartDate"),
      clubNextBillingDate: timestamp("clubNextBillingDate"),
      clubFreePizzaUsed: boolean("clubFreePizzaUsed").default(false).notNull(),
      clubFreePizzaResetAt: timestamp("clubFreePizzaResetAt"),
      stripeCustomerId: varchar("stripeCustomerId", { length: 255 })
    }, (t2) => ({
      emailIdx: index("users_email_idx").on(t2.email),
      resetTokenIdx: index("users_reset_token_idx").on(t2.resetToken),
      phoneIdx: index("users_phone_idx").on(t2.phone)
    }));
    stores = mysqlTable("stores", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 200 }).notNull(),
      displayName: varchar("displayName", { length: 200 }),
      slug: varchar("slug", { length: 100 }).notNull().unique(),
      document: varchar("document", { length: 32 }),
      email: varchar("email", { length: 320 }),
      city: varchar("city", { length: 100 }).notNull(),
      address: text("address"),
      phone: varchar("phone", { length: 20 }),
      latitude: decimal("latitude", { precision: 10, scale: 7 }),
      longitude: decimal("longitude", { precision: 10, scale: 7 }),
      serviceRadiusKm: decimal("serviceRadiusKm", { precision: 6, scale: 2 }).default("25.00"),
      active: boolean("active").default(true).notNull(),
      status: mysqlEnum("status", ["active", "inactive", "suspended", "setup_pending"]).default("active").notNull(),
      isDefault: boolean("isDefault").default(false).notNull(),
      // Dados fiscais para emissão de NFC-e via Focus NFe
      cnpj: varchar("cnpj", { length: 18 }),
      inscricaoEstadual: varchar("inscricaoEstadual", { length: 30 }),
      regimeTributario: int("regimeTributario").default(1),
      // 1=Simples Nacional, 3=Lucro Real
      csc: varchar("csc", { length: 100 }),
      // Código de Segurança do Contribuinte
      cscId: varchar("cscId", { length: 10 }),
      // ID do CSC
      focusNfeToken: varchar("focusNfeToken", { length: 200 }),
      // Token da loja no Focus NFe
      nfceEnabled: boolean("nfceEnabled").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      slugIdx: uniqueIndex("stores_slug_idx").on(t2.slug),
      activeIdx: index("stores_active_idx").on(t2.active),
      statusIdx: index("stores_status_idx").on(t2.status)
    }));
    storeManagers = mysqlTable("store_managers", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      userId: int("userId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      storeIdx: index("store_managers_store_idx").on(t2.storeId),
      userIdx: index("store_managers_user_idx").on(t2.userId),
      uniqueManager: uniqueIndex("store_managers_unique").on(t2.storeId, t2.userId)
    }));
    categories = mysqlTable("categories", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      slug: varchar("slug", { length: 100 }).notNull().unique(),
      description: text("description"),
      imageUrl: text("imageUrl"),
      icon: varchar("icon", { length: 64 }),
      externalSource: varchar("externalSource", { length: 32 }),
      externalMerchantId: varchar("externalMerchantId", { length: 128 }),
      externalId: varchar("externalId", { length: 128 }),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      activeOrderIdx: index("categories_active_order_idx").on(t2.active, t2.sortOrder),
      externalIdx: uniqueIndex("categories_external_uq").on(t2.externalSource, t2.externalMerchantId, t2.externalId)
    }));
    products = mysqlTable("products", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      // null = produto global (compartilhado entre lojas)
      categoryId: int("categoryId").notNull(),
      name: varchar("name", { length: 200 }).notNull(),
      description: text("description"),
      price: decimal("price", { precision: 10, scale: 2 }).notNull(),
      imageUrl: text("imageUrl"),
      externalSource: varchar("externalSource", { length: 32 }),
      externalMerchantId: varchar("externalMerchantId", { length: 128 }),
      externalId: varchar("externalId", { length: 128 }),
      externalCode: varchar("externalCode", { length: 128 }),
      active: boolean("active").default(true).notNull(),
      featured: boolean("featured").default(false).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("products_store_idx").on(t2.storeId),
      categoryIdx: index("products_category_idx").on(t2.categoryId),
      activeIdx: index("products_active_idx").on(t2.active),
      externalIdx: uniqueIndex("products_external_uq").on(t2.externalSource, t2.externalMerchantId, t2.externalId)
    }));
    coupons = mysqlTable("coupons", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      // null = cupom global (válido em todas as lojas)
      code: varchar("code", { length: 50 }).notNull().unique(),
      externalSource: varchar("externalSource", { length: 32 }),
      externalMerchantId: varchar("externalMerchantId", { length: 128 }),
      externalId: varchar("externalId", { length: 128 }),
      discountType: mysqlEnum("discountType", ["percentage", "fixed"]).notNull(),
      discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
      minOrderValue: decimal("minOrderValue", { precision: 10, scale: 2 }).default("0"),
      maxUses: int("maxUses"),
      usedCount: int("usedCount").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      // If userId is set, this coupon is exclusive to that user
      userId: int("userId"),
      expiresAt: timestamp("expiresAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("coupons_user_idx").on(t2.userId),
      externalIdx: uniqueIndex("coupons_external_uq").on(t2.externalSource, t2.externalMerchantId, t2.externalId)
    }));
    orders = mysqlTable("orders", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      // qual unidade recebeu o pedido
      userId: int("userId"),
      serviceType: mysqlEnum("serviceType", ["delivery", "pickup", "dine_in", "counter"]).default("delivery").notNull(),
      customerName: varchar("customerName", { length: 200 }).notNull(),
      customerEmail: varchar("customerEmail", { length: 320 }),
      customerPhone: varchar("customerPhone", { length: 20 }),
      deliveryAddress: text("deliveryAddress").notNull(),
      deliveryNeighborhood: varchar("deliveryNeighborhood", { length: 120 }),
      deliveryCity: varchar("deliveryCity", { length: 100 }),
      deliveryCep: varchar("deliveryCep", { length: 10 }),
      deliveryComplement: varchar("deliveryComplement", { length: 200 }),
      subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
      discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0"),
      deliveryFee: decimal("deliveryFee", { precision: 10, scale: 2 }).default("0"),
      total: decimal("total", { precision: 10, scale: 2 }).notNull(),
      couponCode: varchar("couponCode", { length: 50 }),
      status: mysqlEnum("status", ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).default("pending").notNull(),
      paymentMethod: mysqlEnum("paymentMethod", ["credit_card", "debit_card", "pix", "cash"]).notNull(),
      paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
      stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
      stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
      asaasPaymentId: varchar("asaasPaymentId", { length: 255 }),
      pointsDiscount: decimal("pointsDiscount", { precision: 10, scale: 2 }).default("0"),
      pointsUsed: int("pointsUsed").default(0),
      notes: text("notes"),
      driverId: int("driverId"),
      tableSessionId: int("tableSessionId"),
      predictedReadyAt: timestamp("predictedReadyAt"),
      predictedDeliveredAt: timestamp("predictedDeliveredAt"),
      predictionLabel: varchar("predictionLabel", { length: 120 }),
      confirmedAt: timestamp("confirmedAt"),
      preparingAt: timestamp("preparingAt"),
      readyAt: timestamp("readyAt"),
      outForDeliveryAt: timestamp("outForDeliveryAt"),
      deliveredAt: timestamp("deliveredAt"),
      cancelledAt: timestamp("cancelledAt"),
      aiPaused: boolean("aiPaused").default(false).notNull(),
      // iFood integration
      ifoodOrderId: varchar("ifoodOrderId", { length: 100 }),
      source: mysqlEnum("source", ["app", "ifood", "whatsapp", "phone"]).default("app"),
      // NFC-e fiscal
      nfceKey: varchar("nfceKey", { length: 100 }),
      // chave de acesso da NFC-e
      nfceStatus: mysqlEnum("nfceStatus", ["pending", "authorized", "cancelled", "error"]),
      nfceUrl: text("nfceUrl"),
      // URL do DANFE
      customerCpf: varchar("customerCpf", { length: 14 }),
      // CPF do cliente (opcional)
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("orders_store_idx").on(t2.storeId),
      userIdx: index("orders_user_idx").on(t2.userId),
      statusIdx: index("orders_status_idx").on(t2.status),
      driverIdx: index("orders_driver_idx").on(t2.driverId),
      createdAtIdx: index("orders_created_at_idx").on(t2.createdAt),
      userStatusIdx: index("orders_user_status_idx").on(t2.userId, t2.status)
    }));
    ifoodIntegrations = mysqlTable("ifood_integrations", {
      id: int("id").autoincrement().primaryKey(),
      restaurantId: int("restaurant_id").notNull(),
      merchantId: varchar("merchant_id", { length: 120 }),
      merchantName: varchar("merchant_name", { length: 220 }),
      status: mysqlEnum("status", ["disconnected", "connecting", "connected", "error"]).default("disconnected").notNull(),
      mode: mysqlEnum("mode", ["mock", "production"]).default("mock").notNull(),
      lastConnectedAt: timestamp("last_connected_at"),
      lastSyncAt: timestamp("last_sync_at"),
      lastError: text("last_error"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      restaurantIdx: uniqueIndex("ifood_integrations_restaurant_uq").on(t2.restaurantId),
      statusIdx: index("ifood_integrations_status_idx").on(t2.status)
    }));
    externalOrders = mysqlTable("external_orders", {
      id: int("id").autoincrement().primaryKey(),
      restaurantId: int("restaurant_id").notNull(),
      channel: varchar("channel", { length: 40 }).notNull(),
      externalOrderId: varchar("external_order_id", { length: 120 }).notNull(),
      displayId: varchar("display_id", { length: 40 }).notNull(),
      status: mysqlEnum("status", ["novo", "confirmado", "em_preparo", "saiu_para_entrega", "concluido", "cancelado"]).default("novo").notNull(),
      customerName: varchar("customer_name", { length: 220 }).notNull(),
      totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
      payload: text("payload"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      externalIdx: uniqueIndex("external_orders_channel_external_uq").on(t2.channel, t2.externalOrderId),
      restaurantIdx: index("external_orders_restaurant_idx").on(t2.restaurantId),
      statusIdx: index("external_orders_status_idx").on(t2.status),
      createdAtIdx: index("external_orders_created_idx").on(t2.createdAt)
    }));
    ifoodLogs = mysqlTable("ifood_logs", {
      id: int("id").autoincrement().primaryKey(),
      restaurantId: int("restaurant_id").notNull(),
      action: varchar("action", { length: 120 }).notNull(),
      message: text("message").notNull(),
      payload: text("payload"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (t2) => ({
      restaurantIdx: index("ifood_logs_restaurant_idx").on(t2.restaurantId),
      createdAtIdx: index("ifood_logs_created_idx").on(t2.createdAt)
    }));
    loyaltyTransactions = mysqlTable("loyalty_transactions", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      orderId: int("orderId"),
      type: mysqlEnum("type", ["earn", "redeem", "manual"]).notNull(),
      points: int("points").notNull(),
      // positive = earn, negative = redeem
      description: varchar("description", { length: 255 }),
      balanceBefore: int("balanceBefore").notNull(),
      balanceAfter: int("balanceAfter").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("loyalty_tx_user_idx").on(t2.userId),
      orderIdx: index("loyalty_tx_order_idx").on(t2.orderId)
    }));
    orderItems = mysqlTable("order_items", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull(),
      productId: int("productId").notNull(),
      productName: varchar("productName", { length: 200 }).notNull(),
      productPrice: decimal("productPrice", { precision: 10, scale: 2 }).notNull(),
      quantity: int("quantity").notNull(),
      notes: text("notes"),
      subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      orderIdx: index("order_items_order_idx").on(t2.orderId),
      productIdx: index("order_items_product_idx").on(t2.productId)
    }));
    transactions = mysqlTable("transactions", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull(),
      stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      currency: varchar("currency", { length: 3 }).default("brl").notNull(),
      status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
      paymentMethod: varchar("paymentMethod", { length: 50 }),
      metadata: text("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      orderIdx: index("transactions_order_idx").on(t2.orderId),
      // Idempotência: um mesmo PaymentIntent/chargeId só pode produzir uma transação bem-sucedida.
      uniqueOrderIntent: uniqueIndex("transactions_order_intent_uq").on(t2.orderId, t2.stripePaymentIntentId)
    }));
    webhookEvents = mysqlTable("webhook_events", {
      id: int("id").autoincrement().primaryKey(),
      provider: mysqlEnum("provider", ["stripe", "asaas"]).notNull(),
      eventId: varchar("eventId", { length: 255 }).notNull(),
      eventType: varchar("eventType", { length: 120 }),
      processedAt: timestamp("processedAt").defaultNow().notNull()
    }, (t2) => ({
      uniqueProviderEvent: uniqueIndex("webhook_events_provider_event_uq").on(t2.provider, t2.eventId)
    }));
    loyaltyOrderCredits = mysqlTable("loyalty_order_credits", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull(),
      userId: int("userId").notNull(),
      points: int("points").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      uniqueOrder: uniqueIndex("loyalty_order_credits_order_uq").on(t2.orderId),
      userIdx: index("loyalty_order_credits_user_idx").on(t2.userId)
    }));
    couponRedemptions = mysqlTable("coupon_redemptions", {
      id: int("id").autoincrement().primaryKey(),
      couponId: int("couponId").notNull(),
      code: varchar("code", { length: 50 }).notNull(),
      orderId: int("orderId").notNull(),
      userId: int("userId"),
      reverted: boolean("reverted").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      uniqueOrderCoupon: uniqueIndex("coupon_redemptions_order_uq").on(t2.orderId),
      couponIdx: index("coupon_redemptions_coupon_idx").on(t2.couponId),
      userIdx: index("coupon_redemptions_user_idx").on(t2.userId)
    }));
    upsells = mysqlTable("upsells", {
      id: int("id").autoincrement().primaryKey(),
      // The product being suggested
      suggestedProductId: int("suggestedProductId").notNull(),
      // Optional: only trigger when this product is in the cart (null = always show)
      triggerProductId: int("triggerProductId"),
      // Optional: only trigger when cart total >= this value
      triggerMinTotal: decimal("triggerMinTotal", { precision: 10, scale: 2 }),
      type: mysqlEnum("type", ["upsell", "downsell"]).default("upsell").notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      description: text("description"),
      discountPercent: int("discountPercent").default(0),
      active: boolean("active").default(true).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    promotions = mysqlTable("promotions", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 200 }).notNull(),
      description: text("description"),
      imageUrl: text("imageUrl"),
      externalSource: varchar("externalSource", { length: 32 }),
      externalMerchantId: varchar("externalMerchantId", { length: 128 }),
      externalId: varchar("externalId", { length: 128 }),
      // Optional coupon code auto-applied when customer clicks "Usar Promoção"
      couponCode: varchar("couponCode", { length: 50 }),
      active: boolean("active").default(true).notNull(),
      // If true, only logged-in (registered) customers can see this promotion
      requiresLogin: boolean("requiresLogin").default(true).notNull(),
      startsAt: timestamp("startsAt"),
      endsAt: timestamp("endsAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      externalIdx: uniqueIndex("promotions_external_uq").on(t2.externalSource, t2.externalMerchantId, t2.externalId)
    }));
    raffles = mysqlTable("raffles", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 200 }).notNull(),
      description: text("description"),
      prize: varchar("prize", { length: 300 }).notNull(),
      imageUrl: text("imageUrl"),
      status: mysqlEnum("status", ["active", "closed", "drawn"]).default("active").notNull(),
      winnerId: int("winnerId"),
      winnerName: varchar("winnerName", { length: 200 }),
      drawDate: timestamp("drawDate"),
      endsAt: timestamp("endsAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    raffleEntries = mysqlTable("raffle_entries", {
      id: int("id").autoincrement().primaryKey(),
      raffleId: int("raffleId").notNull(),
      userId: int("userId").notNull(),
      userName: varchar("userName", { length: 200 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      raffleIdx: index("raffle_entries_raffle_idx").on(t2.raffleId),
      userIdx: index("raffle_entries_user_idx").on(t2.userId),
      uniqueEntry: uniqueIndex("raffle_entries_unique").on(t2.raffleId, t2.userId)
    }));
    storeSettings = mysqlTable("store_settings", {
      id: int("id").autoincrement().primaryKey(),
      key: varchar("key", { length: 100 }).notNull().unique(),
      value: text("value").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    drivers = mysqlTable("drivers", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      // qual unidade o motoboy pertence (null = global)
      name: varchar("name", { length: 200 }).notNull(),
      phone: varchar("phone", { length: 20 }),
      // Token de acesso único para o app do motoboy (sem login)
      accessToken: varchar("accessToken", { length: 128 }).notNull().unique(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("drivers_store_idx").on(t2.storeId)
    }));
    driverLocations = mysqlTable("driver_locations", {
      id: int("id").autoincrement().primaryKey(),
      driverId: int("driverId").notNull(),
      orderId: int("orderId"),
      lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
      lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      driverIdx: index("driver_locations_driver_idx").on(t2.driverId),
      orderIdx: index("driver_locations_order_idx").on(t2.orderId),
      driverUpdatedIdx: index("driver_locations_driver_updated_idx").on(t2.driverId, t2.updatedAt)
    }));
    deliveryRatings = mysqlTable("delivery_ratings", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull().unique(),
      driverId: int("driverId").notNull(),
      userId: int("userId").notNull(),
      rating: int("rating").notNull(),
      comment: text("comment"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      driverIdx: index("delivery_ratings_driver_idx").on(t2.driverId),
      userIdx: index("delivery_ratings_user_idx").on(t2.userId)
    }));
    userAddresses = mysqlTable("user_addresses", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      label: varchar("label", { length: 50 }).notNull(),
      address: text("address").notNull(),
      cep: varchar("cep", { length: 10 }),
      city: varchar("city", { length: 100 }),
      isDefault: boolean("isDefault").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("user_addresses_user_idx").on(t2.userId)
    }));
    favorites = mysqlTable("favorites", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      productId: int("productId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("favorites_user_idx").on(t2.userId),
      uniqueFav: uniqueIndex("favorites_unique").on(t2.userId, t2.productId)
    }));
    clientNotifications = mysqlTable("client_notifications", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      message: text("message").notNull(),
      type: mysqlEnum("type", ["order", "promo", "system"]).default("system").notNull(),
      read: boolean("read").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("client_notifications_user_idx").on(t2.userId),
      userReadIdx: index("client_notifications_user_read_idx").on(t2.userId, t2.read),
      createdAtIdx: index("client_notifications_created_at_idx").on(t2.createdAt)
    }));
    orderMessages = mysqlTable("order_messages", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull(),
      userId: int("userId").notNull(),
      senderRole: mysqlEnum("senderRole", ["customer", "admin"]).notNull(),
      message: varchar("message", { length: 1e3 }).notNull(),
      readAt: timestamp("readAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      orderIdx: index("order_messages_order_idx").on(t2.orderId),
      orderCreatedIdx: index("order_messages_order_created_idx").on(t2.orderId, t2.createdAt)
    }));
    ingredients = mysqlTable("ingredients", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      name: varchar("name", { length: 160 }).notNull(),
      category: varchar("category", { length: 120 }),
      unit: mysqlEnum("unit", ["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]).notNull(),
      currentStock: decimal("currentStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
      minimumStock: decimal("minimumStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
      unitCost: decimal("unitCost", { precision: 10, scale: 4 }).default("0.0000").notNull(),
      supplier: varchar("supplier", { length: 160 }),
      notes: text("notes"),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("ingredients_store_idx").on(t2.storeId),
      activeIdx: index("ingredients_active_idx").on(t2.active),
      nameIdx: index("ingredients_name_idx").on(t2.name)
    }));
    productIngredients = mysqlTable("product_ingredients", {
      id: int("id").autoincrement().primaryKey(),
      productId: int("productId").notNull(),
      ingredientId: int("ingredientId").notNull(),
      quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
      wastePercent: decimal("wastePercent", { precision: 5, scale: 2 }).default("0.00").notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      productIdx: index("product_ingredients_product_idx").on(t2.productId),
      ingredientIdx: index("product_ingredients_ingredient_idx").on(t2.ingredientId),
      uniqueBinding: uniqueIndex("product_ingredients_unique").on(t2.productId, t2.ingredientId)
    }));
    inventoryMovements = mysqlTable("inventory_movements", {
      id: int("id").autoincrement().primaryKey(),
      ingredientId: int("ingredientId").notNull(),
      storeId: int("storeId"),
      orderId: int("orderId"),
      orderItemId: int("orderItemId"),
      movementType: mysqlEnum("movementType", ["entry", "manual_adjustment", "sale_consumption", "reversal", "waste"]).notNull(),
      quantityDelta: decimal("quantityDelta", { precision: 12, scale: 3 }).notNull(),
      previousStock: decimal("previousStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
      nextStock: decimal("nextStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
      reason: varchar("reason", { length: 255 }),
      performedByUserId: int("performedByUserId"),
      metadata: text("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      ingredientIdx: index("inventory_movements_ingredient_idx").on(t2.ingredientId),
      orderIdx: index("inventory_movements_order_idx").on(t2.orderId),
      typeIdx: index("inventory_movements_type_idx").on(t2.movementType),
      createdIdx: index("inventory_movements_created_idx").on(t2.createdAt)
    }));
    orderStageLogs = mysqlTable("order_stage_logs", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull(),
      previousStatus: mysqlEnum("previousStatus", ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
      nextStatus: mysqlEnum("nextStatus", ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).notNull(),
      stage: mysqlEnum("stage", ["created", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]).notNull(),
      source: mysqlEnum("source", ["system", "admin", "manager", "driver", "automation", "customer"]).default("system").notNull(),
      changedByUserId: int("changedByUserId"),
      changedByDriverId: int("changedByDriverId"),
      notes: varchar("notes", { length: 255 }),
      metadata: text("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      orderIdx: index("order_stage_logs_order_idx").on(t2.orderId),
      stageIdx: index("order_stage_logs_stage_idx").on(t2.stage),
      createdIdx: index("order_stage_logs_created_idx").on(t2.createdAt)
    }));
    productivityEvents = mysqlTable("productivity_events", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId"),
      storeId: int("storeId"),
      eventType: mysqlEnum("eventType", ["acceptance_time", "prep_time", "dispatch_time", "delivery_time", "total_time", "delay"]).notNull(),
      actorType: mysqlEnum("actorType", ["system", "user", "staff", "driver"]).default("system").notNull(),
      actorUserId: int("actorUserId"),
      actorDriverId: int("actorDriverId"),
      valueSeconds: int("valueSeconds").notNull(),
      metadata: text("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      orderIdx: index("productivity_events_order_idx").on(t2.orderId),
      typeIdx: index("productivity_events_type_idx").on(t2.eventType),
      storeIdx: index("productivity_events_store_idx").on(t2.storeId),
      createdIdx: index("productivity_events_created_idx").on(t2.createdAt)
    }));
    staffMembers = mysqlTable("staff_members", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      userId: int("userId"),
      name: varchar("name", { length: 200 }).notNull(),
      phone: varchar("phone", { length: 20 }),
      email: varchar("email", { length: 320 }),
      role: mysqlEnum("role", ["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).notNull(),
      accessToken: varchar("accessToken", { length: 128 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("staff_members_store_idx").on(t2.storeId),
      roleIdx: index("staff_members_role_idx").on(t2.role),
      userIdx: uniqueIndex("staff_members_user_unique").on(t2.userId),
      accessTokenIdx: uniqueIndex("staff_members_access_token_unique").on(t2.accessToken)
    }));
    deliveryPredictions = mysqlTable("delivery_predictions", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull(),
      kind: mysqlEnum("kind", ["delivery", "pickup", "dine_in"]).default("delivery").notNull(),
      predictionLabel: varchar("predictionLabel", { length: 120 }).notNull(),
      minMinutes: int("minMinutes").notNull(),
      maxMinutes: int("maxMinutes").notNull(),
      prepBaseMinutes: int("prepBaseMinutes").default(0).notNull(),
      deliveryBaseMinutes: int("deliveryBaseMinutes").default(0).notNull(),
      queuePressure: int("queuePressure").default(0).notNull(),
      neighborhood: varchar("neighborhood", { length: 120 }),
      method: varchar("method", { length: 80 }).default("heuristic").notNull(),
      computedAt: timestamp("computedAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      orderIdx: uniqueIndex("delivery_predictions_order_unique").on(t2.orderId),
      kindIdx: index("delivery_predictions_kind_idx").on(t2.kind)
    }));
    diningTables = mysqlTable("dining_tables", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      name: varchar("name", { length: 80 }).notNull(),
      status: mysqlEnum("status", ["free", "occupied", "reserved", "awaiting_closure"]).default("free").notNull(),
      capacity: int("capacity").default(4).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("dining_tables_store_idx").on(t2.storeId),
      statusIdx: index("dining_tables_status_idx").on(t2.status),
      uniqueNamePerStore: uniqueIndex("dining_tables_store_name_unique").on(t2.storeId, t2.name)
    }));
    tableSessions = mysqlTable("table_sessions", {
      id: int("id").autoincrement().primaryKey(),
      tableId: int("tableId").notNull(),
      storeId: int("storeId"),
      waiterStaffId: int("waiterStaffId"),
      customerName: varchar("customerName", { length: 200 }),
      guestCount: int("guestCount").default(1).notNull(),
      status: mysqlEnum("status", ["open", "awaiting_closure", "closed", "cancelled"]).default("open").notNull(),
      notes: text("notes"),
      openedAt: timestamp("openedAt").defaultNow().notNull(),
      closedAt: timestamp("closedAt"),
      subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00").notNull(),
      discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
      tipAmount: decimal("tipAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
      closedByStaffId: int("closedByStaffId"),
      total: decimal("total", { precision: 10, scale: 2 }).default("0.00").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      tableIdx: index("table_sessions_table_idx").on(t2.tableId),
      waiterIdx: index("table_sessions_waiter_idx").on(t2.waiterStaffId),
      statusIdx: index("table_sessions_status_idx").on(t2.status),
      closedByIdx: index("table_sessions_closed_by_idx").on(t2.closedByStaffId)
    }));
    tableOrderLinks = mysqlTable("table_order_links", {
      id: int("id").autoincrement().primaryKey(),
      tableSessionId: int("tableSessionId").notNull(),
      orderId: int("orderId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      tableSessionIdx: index("table_order_links_session_idx").on(t2.tableSessionId),
      orderIdx: uniqueIndex("table_order_links_order_unique").on(t2.orderId)
    }));
    tableSessionItems = mysqlTable("table_session_items", {
      id: int("id").autoincrement().primaryKey(),
      tableSessionId: int("tableSessionId").notNull(),
      productId: int("productId").notNull(),
      productName: varchar("productName", { length: 200 }).notNull(),
      unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
      quantity: int("quantity").default(1).notNull(),
      notes: text("notes"),
      addedByStaffId: int("addedByStaffId"),
      status: mysqlEnum("status", ["pending", "preparing", "ready", "served", "cancelled"]).default("pending").notNull(),
      requestedAt: timestamp("requestedAt").defaultNow().notNull(),
      readyAt: timestamp("readyAt"),
      servedAt: timestamp("servedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      tableSessionIdx: index("table_session_items_session_idx").on(t2.tableSessionId),
      productIdx: index("table_session_items_product_idx").on(t2.productId),
      requestedAtIdx: index("table_session_items_requested_at_idx").on(t2.requestedAt),
      statusIdx: index("table_session_items_status_idx").on(t2.status)
    }));
    notificationCampaigns = mysqlTable("notification_campaigns", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId"),
      name: varchar("name", { length: 200 }).notNull(),
      channel: mysqlEnum("channel", ["push", "whatsapp", "sms", "email"]).notNull(),
      status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "error"]).default("draft").notNull(),
      audienceType: varchar("audienceType", { length: 80 }).default("custom").notNull(),
      messageTitle: varchar("messageTitle", { length: 200 }),
      messageBody: text("messageBody").notNull(),
      estimatedRecipients: int("estimatedRecipients").default(0).notNull(),
      scheduledAt: timestamp("scheduledAt"),
      sentAt: timestamp("sentAt"),
      createdByUserId: int("createdByUserId"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("notification_campaigns_store_idx").on(t2.storeId),
      statusIdx: index("notification_campaigns_status_idx").on(t2.status)
    }));
    campaignSegments = mysqlTable("campaign_segments", {
      id: int("id").autoincrement().primaryKey(),
      campaignId: int("campaignId").notNull(),
      filterKey: varchar("filterKey", { length: 80 }).notNull(),
      operator: varchar("operator", { length: 20 }).default("eq").notNull(),
      value: text("value").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      campaignIdx: index("campaign_segments_campaign_idx").on(t2.campaignId),
      filterIdx: index("campaign_segments_filter_idx").on(t2.filterKey)
    }));
    notificationLogs = mysqlTable("notification_logs", {
      id: int("id").autoincrement().primaryKey(),
      campaignId: int("campaignId"),
      userId: int("userId"),
      channel: mysqlEnum("channel", ["push", "whatsapp", "sms", "email"]).notNull(),
      destination: varchar("destination", { length: 320 }),
      status: mysqlEnum("status", ["queued", "sent", "delivered", "opened", "clicked", "converted", "failed"]).default("queued").notNull(),
      providerMessageId: varchar("providerMessageId", { length: 120 }),
      convertedOrderId: int("convertedOrderId"),
      metadata: text("metadata"),
      sentAt: timestamp("sentAt"),
      deliveredAt: timestamp("deliveredAt"),
      openedAt: timestamp("openedAt"),
      clickedAt: timestamp("clickedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      campaignIdx: index("notification_logs_campaign_idx").on(t2.campaignId),
      userIdx: index("notification_logs_user_idx").on(t2.userId),
      statusIdx: index("notification_logs_status_idx").on(t2.status)
    }));
    customerMetrics = mysqlTable("customer_metrics", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      storeId: int("storeId").default(0).notNull(),
      firstOrderAt: timestamp("firstOrderAt"),
      lastOrderAt: timestamp("lastOrderAt"),
      totalOrders: int("totalOrders").default(0).notNull(),
      deliveredOrders: int("deliveredOrders").default(0).notNull(),
      cancelledOrders: int("cancelledOrders").default(0).notNull(),
      firstOrderCount: int("firstOrderCount").default(0).notNull(),
      totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0.00").notNull(),
      averageTicket: decimal("averageTicket", { precision: 12, scale: 2 }).default("0.00").notNull(),
      favoriteNeighborhood: varchar("favoriteNeighborhood", { length: 120 }),
      favoriteOrderDay: varchar("favoriteOrderDay", { length: 20 }),
      favoriteOrderHour: int("favoriteOrderHour"),
      favoriteProductName: varchar("favoriteProductName", { length: 200 }),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userStoreUnique: uniqueIndex("customer_metrics_user_store_unique").on(t2.userId, t2.storeId),
      ordersIdx: index("customer_metrics_orders_idx").on(t2.totalOrders),
      spentIdx: index("customer_metrics_spent_idx").on(t2.totalSpent)
    }));
    customerAuthProviders = mysqlTable("customer_auth_providers", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      provider: mysqlEnum("provider", ["email", "phone", "google", "apple", "facebook", "instagram", "manus"]).notNull(),
      providerUserId: varchar("providerUserId", { length: 191 }).notNull(),
      providerEmail: varchar("providerEmail", { length: 320 }),
      providerPhone: varchar("providerPhone", { length: 20 }),
      isPrimary: boolean("isPrimary").default(false).notNull(),
      linkedAt: timestamp("linkedAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      userIdx: index("customer_auth_providers_user_idx").on(t2.userId),
      uniqueProviderUser: uniqueIndex("customer_auth_providers_provider_user_unique").on(t2.provider, t2.providerUserId),
      uniqueUserProvider: uniqueIndex("customer_auth_providers_user_provider_unique").on(t2.userId, t2.provider)
    }));
    otpCodes = mysqlTable("otp_codes", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId"),
      phone: varchar("phone", { length: 20 }).notNull(),
      purpose: mysqlEnum("purpose", ["login", "verify_phone"]).default("login").notNull(),
      codeHash: varchar("codeHash", { length: 255 }).notNull(),
      attempts: int("attempts").default(0).notNull(),
      requestIp: varchar("requestIp", { length: 64 }),
      userAgent: text("userAgent"),
      expiresAt: timestamp("expiresAt").notNull(),
      consumedAt: timestamp("consumedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      phoneIdx: index("otp_codes_phone_idx").on(t2.phone),
      phonePurposeIdx: index("otp_codes_phone_purpose_idx").on(t2.phone, t2.purpose),
      expiresIdx: index("otp_codes_expires_idx").on(t2.expiresAt)
    }));
    pushSubscriptions = mysqlTable("push_subscriptions", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      endpoint: text("endpoint").notNull(),
      p256dh: text("p256dh").notNull(),
      auth: text("auth").notNull(),
      userAgent: text("userAgent"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("push_subscriptions_user_idx").on(t2.userId)
    }));
    customerTags = mysqlTable("customer_tags", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      tag: mysqlEnum("tag", ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"]).notNull(),
      assignedAt: timestamp("assignedAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("customer_tags_user_idx").on(t2.userId),
      tagIdx: index("customer_tags_tag_idx").on(t2.tag),
      uniqueUserTag: uniqueIndex("customer_tags_unique").on(t2.userId, t2.tag)
    }));
    customTags = mysqlTable("custom_tags", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 100 }).notNull().unique(),
      color: varchar("color", { length: 20 }).default("#6b7280").notNull(),
      description: varchar("description", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    customCustomerTags = mysqlTable("custom_customer_tags", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      tagId: int("tagId").notNull(),
      assignedAt: timestamp("assignedAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("custom_customer_tags_user_idx").on(t2.userId),
      tagIdx: index("custom_customer_tags_tag_idx").on(t2.tagId),
      uniqueUserTag: uniqueIndex("custom_customer_tags_unique").on(t2.userId, t2.tagId)
    }));
    abandonedCarts = mysqlTable("abandoned_carts", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      customerName: varchar("customerName", { length: 200 }).notNull(),
      customerPhone: varchar("customerPhone", { length: 30 }),
      items: text("items").notNull(),
      total: varchar("total", { length: 20 }).notNull(),
      orderId: int("orderId"),
      // referência ao pedido original (Pix gerado)
      status: mysqlEnum("status", ["pending", "recovered", "expired"]).default("pending").notNull(),
      currentStep: int("currentStep").default(0).notNull(),
      // 0=detectado, 1=etapa1, 2=etapa2, 3=etapa3
      couponCode: varchar("couponCode", { length: 60 }),
      // cupom gerado na etapa 3
      firstReminderSentAt: timestamp("firstReminderSentAt"),
      secondReminderSentAt: timestamp("secondReminderSentAt"),
      thirdReminderSentAt: timestamp("thirdReminderSentAt"),
      recoveredAt: timestamp("recoveredAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      expiresAt: timestamp("expiresAt").notNull()
    }, (t2) => ({
      userIdx: index("abandoned_carts_user_idx").on(t2.userId),
      statusExpiresIdx: index("abandoned_carts_status_expires_idx").on(t2.status, t2.expiresAt)
    }));
    journeys = mysqlTable("journeys", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 200 }).notNull(),
      description: text("description"),
      trigger: mysqlEnum("trigger", [
        "checkout_abandoned",
        "tag_inativo_15",
        "tag_inativo_30",
        "tag_inativo_60",
        "tag_inativo_custom",
        // N dias configurável
        "first_order",
        "new_user",
        "club_subscriber",
        "manual",
        "order_delivered",
        "order_cancelled",
        "birthday",
        "loyalty_milestone",
        "rating_submitted",
        "rating_negative",
        // avaliação ≤ 3 estrelas
        "club_expiring",
        "first_order_month"
        // primeiro pedido do mês
      ]).notNull(),
      // Campos extras para triggers configuráveis
      daysInactive: int("daysInactive"),
      // para tag_inativo_custom
      exitOnOrder: boolean("exitOnOrder").default(false).notNull(),
      // exit condition
      status: mysqlEnum("status", ["active", "paused", "draft"]).default("draft").notNull(),
      steps: text("steps").notNull(),
      webhookToken: varchar("webhookToken", { length: 64 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      statusIdx: index("journeys_status_idx").on(t2.status)
    }));
    journeyExecutions = mysqlTable("journey_executions", {
      id: int("id").autoincrement().primaryKey(),
      journeyId: int("journeyId").notNull(),
      userId: int("userId").notNull(),
      phone: varchar("phone", { length: 30 }),
      status: mysqlEnum("status", ["running", "completed", "cancelled", "failed"]).default("running").notNull(),
      currentStep: int("currentStep").default(0).notNull(),
      metadata: text("metadata"),
      startedAt: timestamp("startedAt").defaultNow().notNull(),
      nextStepAt: timestamp("nextStepAt"),
      completedAt: timestamp("completedAt"),
      lastMessageAt: timestamp("lastMessageAt"),
      // última mensagem enviada
      convertedAt: timestamp("convertedAt"),
      // quando o cliente comprou durante a jornada
      conversionOrderId: int("conversionOrderId"),
      // pedido que gerou a conversão
      logs: text("logs"),
      abGroup: varchar("abGroup", { length: 1 }),
      // "A" ou "B" para split_ab
      adminTaskTitle: varchar("adminTaskTitle", { length: 200 })
      // título da tarefa criada
    }, (t2) => ({
      journeyIdx: index("journey_executions_journey_idx").on(t2.journeyId),
      userIdx: index("journey_executions_user_idx").on(t2.userId),
      statusNextStepIdx: index("journey_executions_status_next_idx").on(t2.status, t2.nextStepAt)
    }));
    notificationTemplates = mysqlTable("notification_templates", {
      id: int("id").autoincrement().primaryKey(),
      event: mysqlEnum("event", [
        "order_confirmed",
        "order_preparing",
        "order_out_for_delivery",
        "order_delivered",
        "order_cancelled",
        "cart_abandoned_step1",
        "cart_abandoned_step2",
        "cart_abandoned_step3",
        "reactivation_15",
        "reactivation_30",
        "reactivation_60",
        "custom"
      ]).notNull(),
      channel: mysqlEnum("channel", ["push", "whatsapp", "both"]).default("both").notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      body: text("body").notNull(),
      redirectUrl: varchar("redirectUrl", { length: 500 }),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    deliveryZones = mysqlTable("delivery_zones", {
      id: int("id").autoincrement().primaryKey(),
      neighborhood: varchar("neighborhood", { length: 200 }).notNull(),
      // nome do bairro
      city: varchar("city", { length: 200 }).notNull().default(""),
      deliveryFee: decimal("deliveryFee", { precision: 8, scale: 2 }).notNull().default("0.00"),
      estimatedMinutes: int("estimatedMinutes").default(45).notNull(),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    clubPayments = mysqlTable("club_payments", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      plan: mysqlEnum("plan", ["bonattao", "basico"]).notNull(),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      pixCode: text("pixCode"),
      pixQrCode: text("pixQrCode"),
      status: mysqlEnum("status", ["pending", "paid", "expired"]).default("pending").notNull(),
      paidAt: timestamp("paidAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("club_payments_user_idx").on(t2.userId),
      statusIdx: index("club_payments_status_idx").on(t2.status)
    }));
    menuSlides = mysqlTable("menu_slides", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 200 }).notNull(),
      subtitle: varchar("subtitle", { length: 300 }),
      imageUrl: text("imageUrl"),
      videoUrl: text("videoUrl"),
      badgeText: varchar("badgeText", { length: 80 }),
      ctaText: varchar("ctaText", { length: 80 }),
      ctaLink: varchar("ctaLink", { length: 500 }),
      sortOrder: int("sortOrder").default(0).notNull(),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    scheduledNotifications = mysqlTable("scheduled_notifications", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 200 }).notNull(),
      message: text("message").notNull(),
      channel: mysqlEnum("channel", ["push", "whatsapp", "both"]).default("push").notNull(),
      targetAudience: mysqlEnum("targetAudience", ["all", "active", "inactive", "club"]).default("all").notNull(),
      scheduledAt: timestamp("scheduledAt").notNull(),
      recurrence: mysqlEnum("recurrence", ["once", "daily", "weekly"]).default("once").notNull(),
      status: mysqlEnum("status", ["pending", "sent", "cancelled", "failed"]).default("pending").notNull(),
      sentAt: timestamp("sentAt"),
      sentCount: int("sentCount").default(0).notNull(),
      neighborhoodFilter: text("neighborhoodFilter"),
      // JSON array of neighborhood names, null = all
      createdBy: int("createdBy").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      scheduledAtStatusIdx: index("scheduled_notifications_scheduled_status_idx").on(t2.scheduledAt, t2.status),
      statusIdx: index("scheduled_notifications_status_idx").on(t2.status)
    }));
    carouselImages = mysqlTable("carousel_images", {
      id: int("id").autoincrement().primaryKey(),
      imageUrl: text("imageUrl").notNull(),
      title: varchar("title", { length: 200 }),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    driverPushSubscriptions = mysqlTable("driver_push_subscriptions", {
      id: int("id").autoincrement().primaryKey(),
      driverId: int("driverId").notNull(),
      endpoint: text("endpoint").notNull(),
      p256dh: text("p256dh").notNull(),
      auth: text("auth").notNull(),
      userAgent: text("userAgent"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      driverIdx: index("driver_push_subscriptions_driver_idx").on(t2.driverId)
    }));
    automationEvents = mysqlTable("automation_events", {
      id: int("id").autoincrement().primaryKey(),
      type: varchar("type", { length: 60 }).notNull(),
      // 'cart_step1', 'cart_step2', 'cart_step3', 'reactivation_15d', etc.
      userId: int("userId"),
      orderId: int("orderId"),
      cartId: int("cartId"),
      channel: mysqlEnum("channel", ["whatsapp", "push", "email"]).notNull(),
      step: int("step"),
      status: mysqlEnum("status", ["sent", "delivered", "read", "converted", "failed"]).notNull(),
      abVariant: varchar("abVariant", { length: 2 }),
      // 'A' ou 'B' para testes A/B
      metadata: text("metadata"),
      // JSON com detalhes extras
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("automation_events_user_idx").on(t2.userId),
      typeStepIdx: index("automation_events_type_step_idx").on(t2.type, t2.step),
      createdAtIdx: index("automation_events_created_idx").on(t2.createdAt)
    }));
    clientAlerts = mysqlTable("client_alerts", {
      id: int("id").autoincrement().primaryKey(),
      type: mysqlEnum("type", ["promotion", "raffle", "coupon", "club", "custom"]).notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      message: text("message").notNull(),
      icon: varchar("icon", { length: 10 }).default("\u{1F514}"),
      // emoji
      url: varchar("url", { length: 500 }),
      // link de destino (ex: /promocoes)
      storeId: int("storeId"),
      // null = todas as lojas
      active: boolean("active").default(true).notNull(),
      expiresAt: timestamp("expiresAt"),
      // null = sem expiração
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      typeIdx: index("client_alerts_type_idx").on(t2.type),
      activeIdx: index("client_alerts_active_idx").on(t2.active),
      createdAtIdx: index("client_alerts_created_idx").on(t2.createdAt)
    }));
    clientAlertReads = mysqlTable("client_alert_reads", {
      id: int("id").autoincrement().primaryKey(),
      alertId: int("alertId").notNull(),
      userId: int("userId").notNull(),
      readAt: timestamp("readAt").defaultNow().notNull()
    }, (t2) => ({
      alertUserIdx: uniqueIndex("client_alert_reads_alert_user_idx").on(t2.alertId, t2.userId),
      userIdx: index("client_alert_reads_user_idx").on(t2.userId)
    }));
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addLoyaltyPoints: () => addLoyaltyPoints,
  addTableSessionItem: () => addTableSessionItem,
  adjustIngredientStock: () => adjustIngredientStock,
  assignCustomTagToCustomer: () => assignCustomTagToCustomer,
  assignDriverToOrder: () => assignDriverToOrder,
  assignTagToCustomer: () => assignTagToCustomer,
  attachOrderToTableSession: () => attachOrderToTableSession,
  attachOrderToTableSessionAndSync: () => attachOrderToTableSessionAndSync,
  cancelScheduledNotification: () => cancelScheduledNotification,
  cancelStaleUnpaidOrders: () => cancelStaleUnpaidOrders,
  clearResetToken: () => clearResetToken,
  closeTableSession: () => closeTableSession,
  closeTableSessionWithComputedTotals: () => closeTableSessionWithComputedTotals,
  consumeInventoryForOrder: () => consumeInventoryForOrder,
  consumeOtpCode: () => consumeOtpCode,
  countCrmCustomers: () => countCrmCustomers,
  countRecentOtpRequests: () => countRecentOtpRequests,
  countUnreadClientAlerts: () => countUnreadClientAlerts,
  createCarouselImage: () => createCarouselImage,
  createCategory: () => createCategory,
  createClientAlert: () => createClientAlert,
  createClientNotification: () => createClientNotification,
  createCoupon: () => createCoupon,
  createCustomTag: () => createCustomTag,
  createDeliveryZone: () => createDeliveryZone,
  createDiningTable: () => createDiningTable,
  createDriver: () => createDriver,
  createEmailUser: () => createEmailUser,
  createIngredient: () => createIngredient,
  createMenuSlide: () => createMenuSlide,
  createNotificationTemplate: () => createNotificationTemplate,
  createOrder: () => createOrder,
  createOtpCode: () => createOtpCode,
  createPhoneUser: () => createPhoneUser,
  createProduct: () => createProduct,
  createPromotion: () => createPromotion,
  createRaffle: () => createRaffle,
  createScheduledNotification: () => createScheduledNotification,
  createStaffMember: () => createStaffMember,
  createTransaction: () => createTransaction,
  createUpsell: () => createUpsell,
  createUserAddress: () => createUserAddress,
  createUserCoupon: () => createUserCoupon,
  creditLoyaltyForOrderIdempotent: () => creditLoyaltyForOrderIdempotent,
  deductLoyaltyPoints: () => deductLoyaltyPoints,
  deductLoyaltyPointsAtomic: () => deductLoyaltyPointsAtomic,
  deleteCarouselImage: () => deleteCarouselImage,
  deleteCategory: () => deleteCategory,
  deleteCustomTag: () => deleteCustomTag,
  deleteDeliveryZone: () => deleteDeliveryZone,
  deleteDiningTable: () => deleteDiningTable,
  deleteDriver: () => deleteDriver,
  deleteIngredient: () => deleteIngredient,
  deleteMenuSlide: () => deleteMenuSlide,
  deleteNotificationTemplate: () => deleteNotificationTemplate,
  deleteProduct: () => deleteProduct,
  deletePromotion: () => deletePromotion,
  deleteScheduledNotification: () => deleteScheduledNotification,
  deleteStaffMember: () => deleteStaffMember,
  deleteUpsell: () => deleteUpsell,
  deleteUserAddress: () => deleteUserAddress,
  dismissClientAlert: () => dismissClientAlert,
  drawRaffleWinner: () => drawRaffleWinner,
  driverConfirmDelivery: () => driverConfirmDelivery,
  ensureStaffAccessToken: () => ensureStaffAccessToken,
  enterRaffle: () => enterRaffle,
  getAbandonedCartsByUser: () => getAbandonedCartsByUser,
  getActivePromotions: () => getActivePromotions,
  getActiveRaffles: () => getActiveRaffles,
  getActiveUpsells: () => getActiveUpsells,
  getAdminDashboardSnapshot: () => getAdminDashboardSnapshot,
  getAdminUsersPage: () => getAdminUsersPage,
  getAllActiveDriverLocations: () => getAllActiveDriverLocations,
  getAllCoupons: () => getAllCoupons,
  getAllDeliveryZones: () => getAllDeliveryZones,
  getAllDrivers: () => getAllDrivers,
  getAllOrders: () => getAllOrders,
  getAllPromotions: () => getAllPromotions,
  getAllRaffles: () => getAllRaffles,
  getAllStoreSettings: () => getAllStoreSettings,
  getAllUpsells: () => getAllUpsells,
  getAllUsers: () => getAllUsers,
  getCarouselImages: () => getCarouselImages,
  getCategories: () => getCategories,
  getCategoryById: () => getCategoryById,
  getClientNotifications: () => getClientNotifications,
  getCouponByCode: () => getCouponByCode,
  getCouponsByUser: () => getCouponsByUser,
  getCrmCustomerDetail: () => getCrmCustomerDetail,
  getCrmCustomers: () => getCrmCustomers,
  getCrmCustomersByTag: () => getCrmCustomersByTag,
  getCrmStats: () => getCrmStats,
  getCustomTagsForCustomer: () => getCustomTagsForCustomer,
  getCustomerMetricsReport: () => getCustomerMetricsReport,
  getCustomersByCustomTagName: () => getCustomersByCustomTagName,
  getDailyRevenue: () => getDailyRevenue,
  getDb: () => getDb,
  getDeliveryZoneByNeighborhood: () => getDeliveryZoneByNeighborhood,
  getDiningTables: () => getDiningTables,
  getDriverActiveOrderDetails: () => getDriverActiveOrderDetails,
  getDriverAssignedOrders: () => getDriverAssignedOrders,
  getDriverAverageRating: () => getDriverAverageRating,
  getDriverById: () => getDriverById,
  getDriverByToken: () => getDriverByToken,
  getDriverDeliveryHistory: () => getDriverDeliveryHistory,
  getDriverLocation: () => getDriverLocation,
  getDriverLocationByOrder: () => getDriverLocationByOrder,
  getDriverPushSubscriptions: () => getDriverPushSubscriptions,
  getDriverRatings: () => getDriverRatings,
  getDriverTodayDeliveries: () => getDriverTodayDeliveries,
  getDriverTodayStats: () => getDriverTodayStats,
  getIngredientById: () => getIngredientById,
  getIngredients: () => getIngredients,
  getInventoryMovements: () => getInventoryMovements,
  getJourneyExecutionsByUser: () => getJourneyExecutionsByUser,
  getLatestOtpCode: () => getLatestOtpCode,
  getLoyaltyHistory: () => getLoyaltyHistory,
  getMenuSlides: () => getMenuSlides,
  getOrderAlertFeed: () => getOrderAlertFeed,
  getOrderById: () => getOrderById,
  getOrderItems: () => getOrderItems,
  getOrderMessages: () => getOrderMessages,
  getOrdersByPeriod: () => getOrdersByPeriod,
  getOrdersByUser: () => getOrdersByUser,
  getOrdersWithMessages: () => getOrdersWithMessages,
  getPendingScheduledNotifications: () => getPendingScheduledNotifications,
  getProductById: () => getProductById,
  getProductRecipe: () => getProductRecipe,
  getProducts: () => getProducts,
  getProductsByIds: () => getProductsByIds,
  getRaffleEntries: () => getRaffleEntries,
  getRatingByOrder: () => getRatingByOrder,
  getRecentOrdersFeed: () => getRecentOrdersFeed,
  getSalesOverview: () => getSalesOverview,
  getSalesReport: () => getSalesReport,
  getSalesTimeSeries: () => getSalesTimeSeries,
  getStaffMemberByAccessToken: () => getStaffMemberByAccessToken,
  getStaffMembers: () => getStaffMembers,
  getStoreSetting: () => getStoreSetting,
  getTableSessions: () => getTableSessions,
  getTagsForCustomer: () => getTagsForCustomer,
  getTopCategories: () => getTopCategories,
  getTopProducts: () => getTopProducts,
  getTotalUnreadForAdmin: () => getTotalUnreadForAdmin,
  getTotalUnreadForUser: () => getTotalUnreadForUser,
  getTransactionByOrderId: () => getTransactionByOrderId,
  getTransactionsByUser: () => getTransactionsByUser,
  getUnreadCountForOrder: () => getUnreadCountForOrder,
  getUnreadNotificationCount: () => getUnreadNotificationCount,
  getUpsellsForCart: () => getUpsellsForCart,
  getUserAddresses: () => getUserAddresses,
  getUserByAuthProvider: () => getUserByAuthProvider,
  getUserByEmail: () => getUserByEmail,
  getUserById: () => getUserById,
  getUserByOpenId: () => getUserByOpenId,
  getUserByPhone: () => getUserByPhone,
  getUserByResetToken: () => getUserByResetToken,
  getUserFavorites: () => getUserFavorites,
  getUserLoyaltyPoints: () => getUserLoyaltyPoints,
  getUserSpendingHistory: () => getUserSpendingHistory,
  incrementCouponUsage: () => incrementCouponUsage,
  incrementOtpAttempts: () => incrementOtpAttempts,
  linkCustomerAuthProvider: () => linkCustomerAuthProvider,
  listClientAlerts: () => listClientAlerts,
  listCustomTags: () => listCustomTags,
  listNotificationTemplates: () => listNotificationTemplates,
  listScheduledNotifications: () => listScheduledNotifications,
  markMessagesRead: () => markMessagesRead,
  markNotificationsRead: () => markNotificationsRead,
  markScheduledNotificationSent: () => markScheduledNotificationSent,
  openTableSession: () => openTableSession,
  pickRandomTemplate: () => pickRandomTemplate,
  pickStoreForDeliveryAddress: () => pickStoreForDeliveryAddress,
  recordWebhookEventOnce: () => recordWebhookEventOnce,
  refundLoyaltyPointsForOrder: () => refundLoyaltyPointsForOrder,
  regenerateStaffAccessToken: () => regenerateStaffAccessToken,
  registerCouponRedemption: () => registerCouponRedemption,
  removeCustomTagFromCustomer: () => removeCustomTagFromCustomer,
  removeDriverPushSubscription: () => removeDriverPushSubscription,
  removeTableSessionItem: () => removeTableSessionItem,
  removeTagFromCustomer: () => removeTagFromCustomer,
  reverseInventoryForOrder: () => reverseInventoryForOrder,
  revertCouponRedemption: () => revertCouponRedemption,
  saveDriverPushSubscription: () => saveDriverPushSubscription,
  saveResetToken: () => saveResetToken,
  searchDeliveryZones: () => searchDeliveryZones,
  seedMenuSlides: () => seedMenuSlides,
  seedNotificationTemplates: () => seedNotificationTemplates,
  sendOrderMessage: () => sendOrderMessage,
  setOrderAiPaused: () => setOrderAiPaused,
  setProductRecipe: () => setProductRecipe,
  setStoreSetting: () => setStoreSetting,
  submitDeliveryRating: () => submitDeliveryRating,
  syncTableSessionTotals: () => syncTableSessionTotals,
  toggleFavorite: () => toggleFavorite,
  updateCarouselImage: () => updateCarouselImage,
  updateCategory: () => updateCategory,
  updateCoupon: () => updateCoupon,
  updateCustomTag: () => updateCustomTag,
  updateDeliveryZone: () => updateDeliveryZone,
  updateDiningTable: () => updateDiningTable,
  updateDriver: () => updateDriver,
  updateIngredient: () => updateIngredient,
  updateMenuSlide: () => updateMenuSlide,
  updateNotificationTemplate: () => updateNotificationTemplate,
  updateOrderPaymentStatus: () => updateOrderPaymentStatus,
  updateOrderStatus: () => updateOrderStatus,
  updateOrderStatusGuarded: () => updateOrderStatusGuarded,
  updateProduct: () => updateProduct,
  updatePromotion: () => updatePromotion,
  updateRaffle: () => updateRaffle,
  updateStaffMember: () => updateStaffMember,
  updateStripeCustomerId: () => updateStripeCustomerId,
  updateTableSession: () => updateTableSession,
  updateTableSessionItemStatus: () => updateTableSessionItemStatus,
  updateUpsell: () => updateUpsell,
  updateUserAddress: () => updateUserAddress,
  updateUserAvatar: () => updateUserAvatar,
  updateUserPasswordHash: () => updateUserPasswordHash,
  updateUserProfile: () => updateUserProfile,
  updateUserSocialProfile: () => updateUserSocialProfile,
  upsertDriverLocation: () => upsertDriverLocation,
  upsertUser: () => upsertUser
});
import { and, desc, eq, gte, gt, inArray, isNull, lte, not, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { randomUUID } from "crypto";
async function withShortCache(key, ttlMs, factory) {
  const now = Date.now();
  const cached = _memoCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await factory();
  _memoCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}
function buildConnectionStringFromParts() {
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
  if (sslMode === "require") {
    url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: false }));
  }
  return url.toString();
}
function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const sslMode = (url.searchParams.get("ssl-mode") ?? url.searchParams.get("sslmode") ?? "").toLowerCase();
    if (sslMode === "required" || sslMode === "require") {
      url.searchParams.delete("ssl-mode");
      url.searchParams.delete("sslmode");
      url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: false }));
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
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
  const pool = createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 6e4,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 1e4,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
  });
  pool.on("error", (error) => {
    console.error("[Database] Pool error:", error);
    if (error.fatal) {
      _db = null;
      _pool = null;
      _schemaReady = null;
    }
  });
  return pool;
}
function resetDbState() {
  try {
    _pool?.end().catch(() => void 0);
  } catch {
  }
  _db = null;
  _pool = null;
  _schemaReady = null;
  _memoCache.clear();
}
function isRetryableDbError(error) {
  const code = error?.code;
  return code === "ECONNRESET" || code === "PROTOCOL_CONNECTION_LOST" || code === "ETIMEDOUT";
}
async function withDbRetry(operation) {
  let db = await getDb();
  if (!db) throw new Error("DB not available");
  try {
    return await operation(db);
  } catch (error) {
    if (!isRetryableDbError(error?.cause ?? error)) {
      throw error;
    }
    console.warn("[Database] Retrying operation after connection reset");
    resetDbState();
    db = await getDb();
    if (!db) throw new Error("DB not available after retry");
    return operation(db);
  }
}
function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function haversineDistanceKm(a, b) {
  const toRad = (deg) => deg * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}
async function geocodeAddress(address) {
  const query = address.trim();
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BonattoPlatform/1.0",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const first = payload[0];
  const lat = toNumberOrNull(first?.lat);
  const lng = toNumberOrNull(first?.lon);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}
async function hasColumn(db, tableName, columnName) {
  const result = await db.execute(sql.raw(`SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`));
  const rows = result[0] ?? [];
  return rows.length > 0;
}
async function hasIndex(db, tableName, indexName) {
  const result = await db.execute(sql.raw(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`));
  const rows = result[0] ?? [];
  return rows.length > 0;
}
async function ensureRuntimeSchema(db) {
  if (_schemaReady) {
    return _schemaReady;
  }
  _schemaReady = (async () => {
    await db.execute(
      sql.raw(
        "ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','manager') NOT NULL DEFAULT 'user'"
      )
    );
    if (!await hasColumn(db, "users", "status")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `users` ADD `status` enum('active','inactive','suspended','setup_pending') NOT NULL DEFAULT 'active' AFTER `phone`"
        )
      );
    }
    if (!await hasColumn(db, "stores", "displayName")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `displayName` varchar(200)"));
    }
    if (!await hasColumn(db, "stores", "document")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `document` varchar(32)"));
    }
    if (!await hasColumn(db, "stores", "latitude")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `latitude` decimal(10,7)"));
    }
    if (!await hasColumn(db, "stores", "longitude")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `longitude` decimal(10,7)"));
    }
    if (!await hasColumn(db, "stores", "serviceRadiusKm")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `serviceRadiusKm` decimal(6,2) NOT NULL DEFAULT '25.00'"));
    }
    if (!await hasColumn(db, "stores", "email")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `email` varchar(320)"));
    }
    if (!await hasColumn(db, "stores", "status")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `stores` ADD `status` enum('active','inactive','suspended','setup_pending') NOT NULL DEFAULT 'active'"
        )
      );
    }
    if (!await hasIndex(db, "stores", "stores_status_idx")) {
      await db.execute(sql.raw("CREATE INDEX `stores_status_idx` ON `stores` (`status`)"));
    }
    if (!await hasIndex(db, "orders", "orders_store_created_idx")) {
      await db.execute(sql.raw("CREATE INDEX `orders_store_created_idx` ON `orders` (`storeId`,`createdAt`)"));
    }
    if (!await hasIndex(db, "orders", "orders_store_status_created_idx")) {
      await db.execute(sql.raw("CREATE INDEX `orders_store_status_created_idx` ON `orders` (`storeId`,`status`,`createdAt`)"));
    }
    if (!await hasIndex(db, "orders", "orders_status_created_idx")) {
      await db.execute(sql.raw("CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`createdAt`)"));
    }
    if (!await hasIndex(db, "order_items", "order_items_order_product_idx")) {
      await db.execute(sql.raw("CREATE INDEX `order_items_order_product_idx` ON `order_items` (`orderId`,`productId`)"));
    }
    if (!await hasColumn(db, "orders", "serviceType")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `serviceType` enum('delivery','pickup','dine_in','counter') NOT NULL DEFAULT 'delivery'"));
    }
    if (!await hasColumn(db, "orders", "deliveryNeighborhood")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `deliveryNeighborhood` varchar(120)"));
    }
    if (!await hasColumn(db, "orders", "tableSessionId")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `tableSessionId` int"));
    }
    if (!await hasColumn(db, "orders", "predictedReadyAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `predictedReadyAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "predictedDeliveredAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `predictedDeliveredAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "predictionLabel")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `predictionLabel` varchar(120)"));
    }
    if (!await hasColumn(db, "orders", "confirmedAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `confirmedAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "preparingAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `preparingAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "readyAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `readyAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "outForDeliveryAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `outForDeliveryAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "deliveredAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `deliveredAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "orders", "cancelledAt")) {
      await db.execute(sql.raw("ALTER TABLE `orders` ADD `cancelledAt` timestamp NULL"));
    }
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`ingredients\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`storeId\` int,
        \`name\` varchar(160) NOT NULL,
        \`category\` varchar(120),
        \`unit\` enum('g','kg','ml','l','unit','pack','slice','portion') NOT NULL,
        \`currentStock\` decimal(12,3) NOT NULL DEFAULT '0.000',
        \`minimumStock\` decimal(12,3) NOT NULL DEFAULT '0.000',
        \`unitCost\` decimal(10,4) NOT NULL DEFAULT '0.0000',
        \`supplier\` varchar(160),
        \`notes\` text,
        \`active\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`ingredients_store_idx\` (\`storeId\`),
        KEY \`ingredients_active_idx\` (\`active\`),
        KEY \`ingredients_name_idx\` (\`name\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`product_ingredients\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`productId\` int NOT NULL,
        \`ingredientId\` int NOT NULL,
        \`quantity\` decimal(12,3) NOT NULL,
        \`wastePercent\` decimal(5,2) NOT NULL DEFAULT '0.00',
        \`active\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`product_ingredients_unique\` (\`productId\`,\`ingredientId\`),
        KEY \`product_ingredients_product_idx\` (\`productId\`),
        KEY \`product_ingredients_ingredient_idx\` (\`ingredientId\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`inventory_movements\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`ingredientId\` int NOT NULL,
        \`storeId\` int,
        \`orderId\` int,
        \`orderItemId\` int,
        \`movementType\` enum('entry','manual_adjustment','sale_consumption','reversal','waste') NOT NULL,
        \`quantityDelta\` decimal(12,3) NOT NULL,
        \`previousStock\` decimal(12,3) NOT NULL DEFAULT '0.000',
        \`nextStock\` decimal(12,3) NOT NULL DEFAULT '0.000',
        \`reason\` varchar(255),
        \`performedByUserId\` int,
        \`metadata\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`inventory_movements_ingredient_idx\` (\`ingredientId\`),
        KEY \`inventory_movements_order_idx\` (\`orderId\`),
        KEY \`inventory_movements_type_idx\` (\`movementType\`),
        KEY \`inventory_movements_created_idx\` (\`createdAt\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`order_stage_logs\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`orderId\` int NOT NULL,
        \`previousStatus\` enum('pending','confirmed','preparing','out_for_delivery','delivered','cancelled'),
        \`nextStatus\` enum('pending','confirmed','preparing','out_for_delivery','delivered','cancelled') NOT NULL,
        \`stage\` enum('created','confirmed','preparing','ready','out_for_delivery','delivered','cancelled') NOT NULL,
        \`source\` enum('system','admin','manager','driver','automation','customer') NOT NULL DEFAULT 'system',
        \`changedByUserId\` int,
        \`changedByDriverId\` int,
        \`notes\` varchar(255),
        \`metadata\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`order_stage_logs_order_idx\` (\`orderId\`),
        KEY \`order_stage_logs_stage_idx\` (\`stage\`),
        KEY \`order_stage_logs_created_idx\` (\`createdAt\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`productivity_events\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`orderId\` int,
        \`storeId\` int,
        \`eventType\` enum('acceptance_time','prep_time','dispatch_time','delivery_time','total_time','delay') NOT NULL,
        \`actorType\` enum('system','user','staff','driver') NOT NULL DEFAULT 'system',
        \`actorUserId\` int,
        \`actorDriverId\` int,
        \`valueSeconds\` int NOT NULL,
        \`metadata\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`productivity_events_order_idx\` (\`orderId\`),
        KEY \`productivity_events_type_idx\` (\`eventType\`),
        KEY \`productivity_events_store_idx\` (\`storeId\`),
        KEY \`productivity_events_created_idx\` (\`createdAt\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`staff_members\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`storeId\` int,
        \`userId\` int,
        \`name\` varchar(200) NOT NULL,
        \`phone\` varchar(20),
        \`email\` varchar(320),
        \`role\` enum('waiter','cashier','attendant','kitchen','driver','manager','admin') NOT NULL,
        \`accessToken\` varchar(128),
        \`active\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`staff_members_user_unique\` (\`userId\`),
        UNIQUE KEY \`staff_members_access_token_unique\` (\`accessToken\`),
        KEY \`staff_members_store_idx\` (\`storeId\`),
        KEY \`staff_members_role_idx\` (\`role\`)
      )
    `));
    if (!await hasColumn(db, "staff_members", "accessToken")) {
      await db.execute(sql.raw("ALTER TABLE `staff_members` ADD `accessToken` varchar(128)"));
    }
    if (!await hasIndex(db, "staff_members", "staff_members_access_token_unique")) {
      await db.execute(sql.raw("ALTER TABLE `staff_members` ADD UNIQUE KEY `staff_members_access_token_unique` (`accessToken`)"));
    }
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`delivery_predictions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`orderId\` int NOT NULL,
        \`kind\` enum('delivery','pickup','dine_in') NOT NULL DEFAULT 'delivery',
        \`predictionLabel\` varchar(120) NOT NULL,
        \`minMinutes\` int NOT NULL,
        \`maxMinutes\` int NOT NULL,
        \`prepBaseMinutes\` int NOT NULL DEFAULT 0,
        \`deliveryBaseMinutes\` int NOT NULL DEFAULT 0,
        \`queuePressure\` int NOT NULL DEFAULT 0,
        \`neighborhood\` varchar(120),
        \`method\` varchar(80) NOT NULL DEFAULT 'heuristic',
        \`computedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`delivery_predictions_order_unique\` (\`orderId\`),
        KEY \`delivery_predictions_kind_idx\` (\`kind\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`dining_tables\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`storeId\` int,
        \`name\` varchar(80) NOT NULL,
        \`status\` enum('free','occupied','reserved','awaiting_closure') NOT NULL DEFAULT 'free',
        \`capacity\` int NOT NULL DEFAULT 4,
        \`active\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`dining_tables_store_name_unique\` (\`storeId\`,\`name\`),
        KEY \`dining_tables_store_idx\` (\`storeId\`),
        KEY \`dining_tables_status_idx\` (\`status\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`table_sessions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`tableId\` int NOT NULL,
        \`storeId\` int,
        \`waiterStaffId\` int,
        \`customerName\` varchar(200),
        \`guestCount\` int NOT NULL DEFAULT 1,
        \`status\` enum('open','awaiting_closure','closed','cancelled') NOT NULL DEFAULT 'open',
        \`notes\` text,
        \`openedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`closedAt\` timestamp NULL,
        \`subtotal\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`discountAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`tipAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`closedByStaffId\` int,
        \`total\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`table_sessions_table_idx\` (\`tableId\`),
        KEY \`table_sessions_waiter_idx\` (\`waiterStaffId\`),
        KEY \`table_sessions_closed_by_idx\` (\`closedByStaffId\`),
        KEY \`table_sessions_status_idx\` (\`status\`)
      )
    `));
    if (!await hasColumn(db, "table_sessions", "tipAmount")) {
      await db.execute(sql.raw("ALTER TABLE `table_sessions` ADD `tipAmount` decimal(10,2) NOT NULL DEFAULT '0.00'"));
    }
    if (!await hasColumn(db, "table_sessions", "closedByStaffId")) {
      await db.execute(sql.raw("ALTER TABLE `table_sessions` ADD `closedByStaffId` int"));
    }
    if (!await hasIndex(db, "table_sessions", "table_sessions_closed_by_idx")) {
      await db.execute(sql.raw("ALTER TABLE `table_sessions` ADD KEY `table_sessions_closed_by_idx` (`closedByStaffId`)"));
    }
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`table_order_links\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`tableSessionId\` int NOT NULL,
        \`orderId\` int NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`table_order_links_order_unique\` (\`orderId\`),
        KEY \`table_order_links_session_idx\` (\`tableSessionId\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`table_session_items\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`tableSessionId\` int NOT NULL,
        \`productId\` int NOT NULL,
        \`productName\` varchar(200) NOT NULL,
        \`unitPrice\` decimal(10,2) NOT NULL,
        \`quantity\` int NOT NULL DEFAULT 1,
        \`notes\` text,
        \`addedByStaffId\` int,
        \`status\` enum('pending','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
        \`requestedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`readyAt\` timestamp NULL,
        \`servedAt\` timestamp NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`table_session_items_session_idx\` (\`tableSessionId\`),
        KEY \`table_session_items_product_idx\` (\`productId\`),
        KEY \`table_session_items_requested_at_idx\` (\`requestedAt\`),
        KEY \`table_session_items_status_idx\` (\`status\`)
      )
    `));
    if (!await hasColumn(db, "table_session_items", "status")) {
      await db.execute(sql.raw("ALTER TABLE `table_session_items` ADD `status` enum('pending','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending'"));
    }
    if (!await hasColumn(db, "table_session_items", "readyAt")) {
      await db.execute(sql.raw("ALTER TABLE `table_session_items` ADD `readyAt` timestamp NULL"));
    }
    if (!await hasColumn(db, "table_session_items", "servedAt")) {
      await db.execute(sql.raw("ALTER TABLE `table_session_items` ADD `servedAt` timestamp NULL"));
    }
    if (!await hasIndex(db, "table_session_items", "table_session_items_status_idx")) {
      await db.execute(sql.raw("ALTER TABLE `table_session_items` ADD KEY `table_session_items_status_idx` (`status`)"));
    }
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`customer_metrics\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`storeId\` int NOT NULL DEFAULT 0,
        \`firstOrderAt\` timestamp NULL,
        \`lastOrderAt\` timestamp NULL,
        \`totalOrders\` int NOT NULL DEFAULT 0,
        \`deliveredOrders\` int NOT NULL DEFAULT 0,
        \`cancelledOrders\` int NOT NULL DEFAULT 0,
        \`firstOrderCount\` int NOT NULL DEFAULT 0,
        \`totalSpent\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`averageTicket\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`favoriteNeighborhood\` varchar(120),
        \`favoriteOrderDay\` varchar(20),
        \`favoriteOrderHour\` int,
        \`favoriteProductName\` varchar(200),
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`customer_metrics_user_store_unique\` (\`userId\`,\`storeId\`),
        KEY \`customer_metrics_orders_idx\` (\`totalOrders\`),
        KEY \`customer_metrics_spent_idx\` (\`totalSpent\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`customer_auth_providers\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`provider\` enum('email','phone','google','apple','facebook','instagram','manus') NOT NULL,
        \`providerUserId\` varchar(191) NOT NULL,
        \`providerEmail\` varchar(320),
        \`providerPhone\` varchar(20),
        \`isPrimary\` boolean NOT NULL DEFAULT false,
        \`linkedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`customer_auth_providers_provider_user_unique\` (\`provider\`,\`providerUserId\`),
        UNIQUE KEY \`customer_auth_providers_user_provider_unique\` (\`userId\`,\`provider\`),
        KEY \`customer_auth_providers_user_idx\` (\`userId\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`otp_codes\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int,
        \`phone\` varchar(20) NOT NULL,
        \`purpose\` enum('login','verify_phone') NOT NULL DEFAULT 'login',
        \`codeHash\` varchar(255) NOT NULL,
        \`attempts\` int NOT NULL DEFAULT 0,
        \`requestIp\` varchar(64),
        \`userAgent\` text,
        \`expiresAt\` timestamp NOT NULL,
        \`consumedAt\` timestamp NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`otp_codes_phone_idx\` (\`phone\`),
        KEY \`otp_codes_phone_purpose_idx\` (\`phone\`,\`purpose\`),
        KEY \`otp_codes_expires_idx\` (\`expiresAt\`)
      )
    `));
    if (!await hasColumn(db, "categories", "externalSource")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `categories` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!await hasColumn(db, "categories", "icon")) {
      await db.execute(sql.raw("ALTER TABLE `categories` ADD `icon` varchar(64)"));
    }
    if (!await hasIndex(db, "categories", "categories_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn(db, "products", "externalSource")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `products` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128), ADD `externalCode` varchar(128)"
        )
      );
    }
    if (!await hasIndex(db, "products", "products_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn(db, "coupons", "externalSource")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `coupons` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!await hasIndex(db, "coupons", "coupons_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn(db, "promotions", "externalSource")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `promotions` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!await hasIndex(db, "promotions", "promotions_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
  })().catch((error) => {
    _schemaReady = null;
    throw error;
  });
  return _schemaReady;
}
async function getDb() {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL) || buildConnectionStringFromParts();
  if (!_db && !_pool && (process.env.DATABASE_HOST || process.env.DATABASE_URL)) {
    _pool = buildMysqlPoolFromParts();
  }
  if (!_db && (_pool || connectionString)) {
    try {
      _db = _pool ? drizzle(_pool) : drizzle(connectionString);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      resetDbState();
    }
  }
  if (_db) {
    try {
      await ensureRuntimeSchema(_db);
    } catch (error) {
      console.error("[Database] Runtime schema/connection error, resetting pool:", error);
      resetDbState();
      return null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  return withDbRetry(async (db) => {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
    const isNew = existing.length === 0;
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    for (const field of textFields) {
      const value = user[field];
      if (value === void 0) continue;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
    return { isNew };
  });
}
async function getUserByOpenId(openId) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  });
}
async function getUserByEmail(email) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  });
}
async function getUserByAuthProvider(provider, providerUserId) {
  return withDbRetry(async (db) => {
    const rows = await db.select({ userId: customerAuthProviders.userId }).from(customerAuthProviders).where(
      and(
        eq(customerAuthProviders.provider, provider),
        eq(customerAuthProviders.providerUserId, providerUserId)
      )
    ).limit(1);
    if (!rows[0]?.userId) return void 0;
    return getUserById(rows[0].userId);
  });
}
async function createEmailUser(data) {
  await withDbRetry(async (db) => {
    await db.insert(users).values({
      openId: data.openId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      loginMethod: "email",
      emailVerified: false,
      lastSignedIn: /* @__PURE__ */ new Date()
    });
  });
}
async function updateUserPasswordHash(openId, passwordHash) {
  await withDbRetry(async (db) => {
    await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
  });
}
async function saveResetToken(email, token, expiresAt) {
  await withDbRetry(async (db) => {
    await db.update(users).set({ resetToken: token, resetTokenExpiresAt: expiresAt }).where(eq(users.email, email));
  });
}
async function getUserByResetToken(token) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
    return result[0];
  });
}
async function clearResetToken(openId) {
  await withDbRetry(async (db) => {
    await db.update(users).set({ resetToken: null, resetTokenExpiresAt: null }).where(eq(users.openId, openId));
  });
}
async function getCategories(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(categories);
  if (activeOnly) {
    return query.where(eq(categories.active, true)).orderBy(categories.sortOrder);
  }
  return query.orderBy(categories.sortOrder);
}
async function getCategoryById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0];
}
async function createCategory(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(categories).values(data);
}
async function updateCategory(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(categories).set(data).where(eq(categories.id, id));
}
async function deleteCategory(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(categories).set({ active: false }).where(eq(categories.id, id));
}
async function getProducts(opts) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.activeOnly !== false) conditions.push(eq(products.active, true));
  if (opts?.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts?.storeId) conditions.push(eq(products.storeId, opts.storeId));
  return db.select().from(products).where(conditions.length ? and(...conditions) : void 0).orderBy(products.sortOrder, products.name);
}
async function getProductById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}
async function getProductsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}
async function createProduct(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(products).values(data);
}
async function updateProduct(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(products).set(data).where(eq(products.id, id));
}
async function deleteProduct(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(products).set({ active: false }).where(eq(products.id, id));
}
function toFixedQuantity(value, scale = 3) {
  return Number(value).toFixed(scale);
}
async function getIngredients(opts) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.storeId) conditions.push(eq(ingredients.storeId, opts.storeId));
  if (opts?.activeOnly !== false) conditions.push(eq(ingredients.active, true));
  if (opts?.lowStockOnly) conditions.push(sql`CAST(${ingredients.currentStock} AS DECIMAL(12,3)) <= CAST(${ingredients.minimumStock} AS DECIMAL(12,3))`);
  return db.select().from(ingredients).where(conditions.length ? and(...conditions) : void 0).orderBy(ingredients.name);
}
async function getIngredientById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
  return rows[0];
}
async function createIngredient(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(ingredients).values(data);
  const header = Array.isArray(result) ? result[0] : result;
  return header.insertId;
}
async function updateIngredient(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(ingredients).set(data).where(eq(ingredients.id, id));
}
async function deleteIngredient(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(ingredients).set({ active: false }).where(eq(ingredients.id, id));
}
async function adjustIngredientStock(input) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const ingredient = await getIngredientById(input.ingredientId);
  if (!ingredient) throw new Error("Ingrediente n\xE3o encontrado");
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
    performedByUserId: input.performedByUserId ?? null
  });
  return { ingredientId: input.ingredientId, previousStock, nextStock, quantityDelta: delta };
}
async function getInventoryMovements(opts) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.ingredientId) conditions.push(eq(inventoryMovements.ingredientId, opts.ingredientId));
  if (opts?.orderId) conditions.push(eq(inventoryMovements.orderId, opts.orderId));
  if (opts?.storeId) conditions.push(eq(inventoryMovements.storeId, opts.storeId));
  return db.select().from(inventoryMovements).where(conditions.length ? and(...conditions) : void 0).orderBy(desc(inventoryMovements.createdAt)).limit(opts?.limit ?? 200);
}
async function getProductRecipe(productId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
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
    ingredientActive: ingredients.active
  }).from(productIngredients).innerJoin(ingredients, eq(productIngredients.ingredientId, ingredients.id)).where(and(eq(productIngredients.productId, productId), eq(productIngredients.active, true))).orderBy(ingredients.name);
  return rows;
}
async function setProductRecipe(productId, items) {
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
      active: true
    }))
  );
  return getProductRecipe(productId);
}
async function consumeInventoryForOrder(orderId) {
  const db = await getDb();
  if (!db) return { consumed: false, reason: "db_unavailable", movements: [] };
  const existing = await db.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.movementType, "sale_consumption"))).limit(1);
  if (existing.length > 0) return { consumed: false, reason: "already_consumed", movements: [] };
  const items = await getOrderItems(orderId);
  if (!items.length) return { consumed: false, reason: "empty_order", movements: [] };
  const productIds = [...new Set(items.map((item) => item.productId))];
  const recipes = await db.select().from(productIngredients).where(and(inArray(productIngredients.productId, productIds), eq(productIngredients.active, true)));
  if (!recipes.length) return { consumed: false, reason: "no_recipe", movements: [] };
  const ingredientIds = [...new Set(recipes.map((recipe) => recipe.ingredientId))];
  const ingredientRows = await db.select().from(ingredients).where(inArray(ingredients.id, ingredientIds));
  const ingredientMap = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  const movements = [];
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
        reason: `Consumo autom\xE1tico do pedido #${orderId}`
      });
      ingredient.currentStock = toFixedQuantity(nextStock);
      movements.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        quantityConsumed: totalQty,
        previousStock,
        nextStock
      });
    }
  }
  return { consumed: movements.length > 0, reason: movements.length > 0 ? "ok" : "no_bound_ingredients", movements };
}
async function reverseInventoryForOrder(orderId) {
  const db = await getDb();
  if (!db) return { reversed: false, reason: "db_unavailable", movements: [] };
  const consumptionRows = await db.select().from(inventoryMovements).where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.movementType, "sale_consumption")));
  if (!consumptionRows.length) return { reversed: false, reason: "no_consumption", movements: [] };
  const existingReversal = await db.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.movementType, "reversal"))).limit(1);
  if (existingReversal.length > 0) return { reversed: false, reason: "already_reversed", movements: [] };
  const movements = [];
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
      reason: `Estorno autom\xE1tico do pedido #${orderId}`
    });
    movements.push({ ingredientId: ingredient.id, restoredQuantity: delta, previousStock, nextStock });
  }
  return { reversed: movements.length > 0, reason: movements.length > 0 ? "ok" : "no_rows", movements };
}
async function getStaffMembers(opts) {
  return withDbRetry(async (db) => {
    const conditions = [];
    if (opts?.storeId) conditions.push(eq(staffMembers.storeId, opts.storeId));
    if (opts?.role) conditions.push(eq(staffMembers.role, opts.role));
    if (opts?.activeOnly !== false) conditions.push(eq(staffMembers.active, true));
    return db.select().from(staffMembers).where(conditions.length ? and(...conditions) : void 0).orderBy(staffMembers.role, staffMembers.name);
  });
}
async function createStaffMember(data) {
  return withDbRetry(async (db) => {
    const result = await db.insert(staffMembers).values(data);
    const header = Array.isArray(result) ? result[0] : result;
    return header.insertId;
  });
}
async function updateStaffMember(id, data) {
  await withDbRetry(async (db) => {
    await db.update(staffMembers).set(data).where(eq(staffMembers.id, id));
  });
}
async function deleteStaffMember(id) {
  await withDbRetry(async (db) => {
    await db.update(staffMembers).set({ active: false }).where(eq(staffMembers.id, id));
  });
}
async function ensureStaffAccessToken(staffId) {
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
async function regenerateStaffAccessToken(staffId) {
  return withDbRetry(async (db) => {
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await db.update(staffMembers).set({ accessToken: token }).where(eq(staffMembers.id, staffId));
    return token;
  });
}
async function getStaffMemberByAccessToken(token) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(staffMembers).where(and(eq(staffMembers.accessToken, token), eq(staffMembers.active, true))).limit(1);
    return rows[0];
  });
}
async function getDiningTables(opts) {
  return withDbRetry(async (db) => {
    const conditions = [];
    if (opts?.storeId) conditions.push(eq(diningTables.storeId, opts.storeId));
    if (opts?.activeOnly !== false) conditions.push(eq(diningTables.active, true));
    return db.select().from(diningTables).where(conditions.length ? and(...conditions) : void 0).orderBy(diningTables.name);
  });
}
async function createDiningTable(data) {
  return withDbRetry(async (db) => {
    const result = await db.insert(diningTables).values(data);
    const header = Array.isArray(result) ? result[0] : result;
    return header.insertId;
  });
}
async function updateDiningTable(id, data) {
  await withDbRetry(async (db) => {
    await db.update(diningTables).set(data).where(eq(diningTables.id, id));
  });
}
async function deleteDiningTable(id) {
  await withDbRetry(async (db) => {
    await db.update(diningTables).set({ active: false, status: "free" }).where(eq(diningTables.id, id));
  });
}
async function getTableSessionComputedTotals(db, tableSessionId) {
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
  const itemsSubtotal = Number(itemTotalsRows[0]?.[0]?.itemsSubtotal ?? 0);
  const linkedOrdersTotal = Number(linkedOrderRows[0]?.[0]?.linkedOrdersTotal ?? 0);
  const subtotal = itemsSubtotal + linkedOrdersTotal;
  return { itemsSubtotal, linkedOrdersTotal, subtotal, total: subtotal };
}
async function syncTableSessionTotalsInternal(db, tableSessionId) {
  const totals = await getTableSessionComputedTotals(db, tableSessionId);
  await db.update(tableSessions).set({
    subtotal: totals.subtotal.toFixed(2),
    total: totals.total.toFixed(2)
  }).where(eq(tableSessions.id, tableSessionId));
  return totals;
}
async function syncTableSessionTotals(tableSessionId) {
  return withDbRetry(async (db) => syncTableSessionTotalsInternal(db, tableSessionId));
}
async function getTableSessions(opts) {
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
    const sessions = (baseRows[0] ?? []).map((row) => ({
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
      waiterName: row.waiterName ? String(row.waiterName) : null
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
    const itemsBySession = /* @__PURE__ */ new Map();
    for (const row of itemRows[0] ?? []) {
      const sessionId = Number(row.tableSessionId);
      if (!itemsBySession.has(sessionId)) itemsBySession.set(sessionId, []);
      itemsBySession.get(sessionId).push({
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
        lineTotal: (Number(row.quantity ?? 0) * Number(row.unitPrice ?? 0)).toFixed(2)
      });
    }
    const ordersBySession = /* @__PURE__ */ new Map();
    for (const row of linkedOrderRows[0] ?? []) {
      const sessionId = Number(row.tableSessionId);
      if (!ordersBySession.has(sessionId)) ordersBySession.set(sessionId, []);
      ordersBySession.get(sessionId).push({
        orderId: Number(row.orderId),
        customerName: String(row.customerName ?? ""),
        status: String(row.status ?? ""),
        total: String(row.total ?? "0.00"),
        createdAt: row.createdAt
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
        computedTotal: Math.max(0, computedSubtotal - Number(session.discountAmount ?? 0) + Number(session.tipAmount ?? 0)).toFixed(2)
      };
    });
  });
}
async function openTableSession(data) {
  return withDbRetry(async (db) => {
    const existingOpenSession = await db.select({ id: tableSessions.id }).from(tableSessions).where(and(eq(tableSessions.tableId, data.tableId), inArray(tableSessions.status, ["open", "awaiting_closure"]))).limit(1);
    if (existingOpenSession[0]) {
      throw new Error("Essa mesa j\xE1 possui uma comanda aberta.");
    }
    const result = await db.insert(tableSessions).values(data);
    const header = Array.isArray(result) ? result[0] : result;
    const sessionId = header.insertId;
    await db.update(diningTables).set({ status: "occupied" }).where(eq(diningTables.id, data.tableId));
    return sessionId;
  });
}
async function updateTableSession(id, data) {
  await withDbRetry(async (db) => {
    await db.update(tableSessions).set(data).where(eq(tableSessions.id, id));
  });
}
async function closeTableSession(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const session = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
  if (!session[0]) throw new Error("Comanda n\xE3o encontrada");
  const nextStatus = data?.status ?? "closed";
  await db.update(tableSessions).set({
    status: nextStatus,
    subtotal: data?.subtotal,
    discountAmount: data?.discountAmount,
    tipAmount: data?.tipAmount,
    closedByStaffId: data?.closedByStaffId ?? null,
    total: data?.total,
    closedAt: nextStatus === "closed" || nextStatus === "cancelled" ? /* @__PURE__ */ new Date() : null
  }).where(eq(tableSessions.id, id));
  await db.update(diningTables).set({ status: nextStatus === "closed" || nextStatus === "cancelled" ? "free" : "awaiting_closure" }).where(eq(diningTables.id, session[0].tableId));
}
async function attachOrderToTableSession(tableSessionId, orderId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(tableOrderLinks).values({ tableSessionId, orderId });
  await db.update(orders).set({ tableSessionId, serviceType: "dine_in" }).where(eq(orders.id, orderId));
}
async function closeTableSessionWithComputedTotals(id, data) {
  await withDbRetry(async (db) => {
    const session = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
    if (!session[0]) throw new Error("Comanda nao encontrada");
    const synced = await syncTableSessionTotalsInternal(db, id);
    const discountAmount = Number(data?.discountAmount ?? session[0].discountAmount ?? 0);
    const tipAmount = Number(data?.tipAmount ?? session[0].tipAmount ?? 0);
    const nextStatus = data?.status ?? "closed";
    await db.update(tableSessions).set({
      status: nextStatus,
      subtotal: data?.subtotal ?? synced.subtotal.toFixed(2),
      discountAmount: data?.discountAmount ?? discountAmount.toFixed(2),
      tipAmount: data?.tipAmount ?? tipAmount.toFixed(2),
      closedByStaffId: data?.closedByStaffId ?? null,
      total: data?.total ?? Math.max(0, synced.subtotal - discountAmount + tipAmount).toFixed(2),
      closedAt: nextStatus === "closed" || nextStatus === "cancelled" ? /* @__PURE__ */ new Date() : null
    }).where(eq(tableSessions.id, id));
    await db.update(diningTables).set({ status: nextStatus === "closed" || nextStatus === "cancelled" ? "free" : "awaiting_closure" }).where(eq(diningTables.id, session[0].tableId));
  });
}
async function attachOrderToTableSessionAndSync(tableSessionId, orderId) {
  await withDbRetry(async (db) => {
    await db.insert(tableOrderLinks).values({ tableSessionId, orderId });
    await db.update(orders).set({ tableSessionId, serviceType: "dine_in" }).where(eq(orders.id, orderId));
    await syncTableSessionTotalsInternal(db, tableSessionId);
  });
}
async function addTableSessionItem(data) {
  return withDbRetry(async (db) => {
    const [session] = await db.select().from(tableSessions).where(eq(tableSessions.id, data.tableSessionId)).limit(1);
    if (!session) throw new Error("Comanda nao encontrada.");
    if (session.status === "closed" || session.status === "cancelled") {
      throw new Error("Nao e possivel adicionar itens em uma comanda encerrada.");
    }
    const [product] = await db.select({ id: products.id, name: products.name, price: products.price, active: products.active }).from(products).where(eq(products.id, data.productId)).limit(1);
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
      requestedAt: /* @__PURE__ */ new Date()
    });
    const header = Array.isArray(result) ? result[0] : result;
    const itemId = header.insertId;
    await consumeInventoryForTableSessionItemInternal(db, itemId);
    await syncTableSessionTotalsInternal(db, data.tableSessionId);
    return itemId;
  });
}
async function removeTableSessionItem(id) {
  await withDbRetry(async (db) => {
    const [item] = await db.select().from(tableSessionItems).where(eq(tableSessionItems.id, id)).limit(1);
    if (!item) throw new Error("Item da comanda nao encontrado.");
    await reverseInventoryForTableSessionItemInternal(db, item);
    await db.delete(tableSessionItems).where(eq(tableSessionItems.id, id));
    await syncTableSessionTotalsInternal(db, item.tableSessionId);
  });
}
async function consumeInventoryForTableSessionItemInternal(db, itemId) {
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
  const item = rows[0]?.[0];
  if (!item) return { consumed: false, reason: "item_not_found" };
  const recipes = await db.select().from(productIngredients).where(and(eq(productIngredients.productId, item.productId), eq(productIngredients.active, true)));
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
      reason: `Consumo automatico da comanda #${item.tableSessionId} item #${item.id}`
    });
    ingredient.currentStock = toFixedQuantity(nextStock);
  }
  return { consumed: true, reason: "ok" };
}
async function reverseInventoryForTableSessionItemInternal(db, item) {
  const movementRows = await db.select().from(inventoryMovements).where(and(
    eq(inventoryMovements.reason, `Consumo automatico da comanda #${item.tableSessionId} item #${item.id}`),
    eq(inventoryMovements.movementType, "sale_consumption")
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
      reason: `Estorno automatico da comanda #${item.tableSessionId} item #${item.id}`
    });
  }
}
async function updateTableSessionItemStatus(id, status) {
  await withDbRetry(async (db) => {
    const patch = { status };
    if (status === "ready") patch.readyAt = /* @__PURE__ */ new Date();
    if (status === "served") patch.servedAt = /* @__PURE__ */ new Date();
    if (status === "cancelled") {
      const [item] = await db.select().from(tableSessionItems).where(eq(tableSessionItems.id, id)).limit(1);
      if (item) {
        await reverseInventoryForTableSessionItemInternal(db, item);
      }
    }
    await db.update(tableSessionItems).set(patch).where(eq(tableSessionItems.id, id));
  });
}
async function getCustomerMetricsReport(opts) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.storeId !== void 0) conditions.push(eq(customerMetrics.storeId, opts.storeId));
  return db.select({
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
    phone: users.phone
  }).from(customerMetrics).leftJoin(users, eq(customerMetrics.userId, users.id)).where(conditions.length ? and(...conditions) : void 0).orderBy(desc(customerMetrics.totalSpent), desc(customerMetrics.totalOrders)).limit(opts?.limit ?? 200);
}
async function getUserByPhone(phone) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return rows[0];
  });
}
async function createPhoneUser(data) {
  return withDbRetry(async (db) => {
    const result = await db.insert(users).values({
      openId: data.openId,
      name: data.name ?? "Cliente Bonatto",
      phone: data.phone,
      loginMethod: "phone",
      role: "user",
      emailVerified: false,
      status: "active",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    const header = Array.isArray(result) ? result[0] : result;
    const userId = header.insertId;
    return getUserById(userId);
  });
}
async function linkCustomerAuthProvider(data) {
  await withDbRetry(async (db) => {
    await db.insert(customerAuthProviders).values({
      userId: data.userId,
      provider: data.provider,
      providerUserId: data.providerUserId,
      providerEmail: data.providerEmail ?? null,
      providerPhone: data.providerPhone ?? null,
      isPrimary: data.isPrimary ?? false
    }).onDuplicateKeyUpdate({
      set: {
        providerEmail: data.providerEmail ?? null,
        providerPhone: data.providerPhone ?? null,
        isPrimary: data.isPrimary ?? false
      }
    });
  });
}
async function createOtpCode(data) {
  return withDbRetry(async (db) => {
    const result = await db.insert(otpCodes).values({
      userId: data.userId ?? null,
      phone: data.phone,
      purpose: data.purpose ?? "login",
      codeHash: data.codeHash,
      requestIp: data.requestIp ?? null,
      userAgent: data.userAgent ?? null,
      expiresAt: data.expiresAt
    });
    const header = Array.isArray(result) ? result[0] : result;
    return header.insertId;
  });
}
async function getLatestOtpCode(phone, purpose = "login") {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(otpCodes).where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt))).orderBy(desc(otpCodes.createdAt)).limit(1);
    return rows[0];
  });
}
async function countRecentOtpRequests(phone, withinMinutes = 10) {
  return withDbRetry(async (db) => {
    const since = new Date(Date.now() - withinMinutes * 6e4);
    const rows = await db.select({ count: sql`COUNT(*)` }).from(otpCodes).where(and(eq(otpCodes.phone, phone), gte(otpCodes.createdAt, since)));
    return Number(rows[0]?.count ?? 0);
  });
}
async function incrementOtpAttempts(id) {
  await withDbRetry(async (db) => {
    await db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, id));
  });
}
async function consumeOtpCode(id) {
  await withDbRetry(async (db) => {
    await db.update(otpCodes).set({ consumedAt: /* @__PURE__ */ new Date() }).where(eq(otpCodes.id, id));
  });
}
async function getCouponByCode(code) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(coupons).where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true))).limit(1);
  return result[0];
}
async function getAllCoupons(storeId) {
  const db = await getDb();
  if (!db) return [];
  if (storeId) return db.select().from(coupons).where(eq(coupons.storeId, storeId)).orderBy(desc(coupons.createdAt));
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}
async function createCoupon(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(coupons).values(data);
}
async function updateCoupon(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(coupons).set(data).where(eq(coupons.id, id));
}
async function incrementCouponUsage(code) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(
    and(
      eq(coupons.code, code.toUpperCase()),
      sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`
    )
  );
  return result?.rowsAffected > 0 || result?.[0]?.affectedRows > 0;
}
async function pickStoreForDeliveryAddress(input) {
  return withDbRetry(async (db) => {
    const activeStores = await db.select().from(stores).where(and(eq(stores.active, true), eq(stores.status, "active")));
    if (!activeStores.length) {
      return { storeId: void 0, reason: "no_active_store" };
    }
    const fullAddress = [
      input.deliveryAddress,
      input.deliveryNeighborhood,
      input.deliveryCity,
      input.deliveryCep,
      "Brasil"
    ].filter(Boolean).join(", ");
    const destination = await geocodeAddress(fullAddress);
    if (!destination) {
      const defaultStore = activeStores.find((store) => store.isDefault) ?? activeStores[0];
      return { storeId: defaultStore?.id, reason: "destination_geocode_failed" };
    }
    let bestStore = null;
    for (const store of activeStores) {
      let lat = toNumberOrNull(store.latitude);
      let lng = toNumberOrNull(store.longitude);
      if (lat === null || lng === null) {
        const storeAddress = [store.address, store.city, "Brasil"].filter(Boolean).join(", ");
        const coords = await geocodeAddress(storeAddress);
        if (!coords) continue;
        lat = coords.lat;
        lng = coords.lng;
        await db.update(stores).set({ latitude: coords.lat.toFixed(7), longitude: coords.lng.toFixed(7) }).where(eq(stores.id, store.id));
      }
      const distanceKm = haversineDistanceKm(destination, { lat, lng });
      const serviceRadiusKm = Math.max(1, Number(store.serviceRadiusKm ?? 25));
      if (distanceKm > serviceRadiusKm && !store.isDefault) {
        continue;
      }
      if (!bestStore || distanceKm < bestStore.distanceKm) {
        bestStore = { id: store.id, distanceKm };
      }
    }
    if (!bestStore) {
      const fallbackStore = activeStores.find((store) => store.isDefault) ?? activeStores[0];
      return { storeId: fallbackStore?.id, reason: "no_store_in_radius" };
    }
    return { storeId: bestStore.id, reason: "nearest", distanceKm: bestStore.distanceKm };
  });
}
async function createOrder(orderData, items) {
  return withDbRetry(async (db) => {
    const result = await db.insert(orders).values(orderData);
    const resultHeader = Array.isArray(result) ? result[0] : result;
    const orderId = resultHeader.insertId;
    if (!orderId) throw new Error("Failed to get order ID after insert");
    const itemsWithOrderId = items.map((item) => ({ ...item, orderId }));
    await db.insert(orderItems).values(itemsWithOrderId);
    return orderId;
  });
}
async function getOrderById(id) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  });
}
async function getOrderItems(orderId) {
  return withDbRetry(
    async (db) => db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  );
}
async function getOrdersByUser(userId) {
  return withDbRetry(
    async (db) => db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt))
  );
}
async function getAllOrders(opts) {
  return withDbRetry(async (db) => {
    const conditions = [];
    const limit = Math.min(5e4, Math.max(1, opts?.limit ?? 5e3));
    const offset = Math.max(0, opts?.offset ?? 0);
    if (opts?.status) conditions.push(eq(orders.status, opts.status));
    if (opts?.storeId) conditions.push(eq(orders.storeId, opts.storeId));
    if (opts?.startDate) conditions.push(gte(orders.createdAt, opts.startDate));
    if (opts?.endDate) conditions.push(lte(orders.createdAt, opts.endDate));
    return db.select().from(orders).where(conditions.length ? and(...conditions) : void 0).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
  });
}
async function updateOrderStatus(id, status) {
  await withDbRetry(async (db) => {
    await db.update(orders).set({ status }).where(eq(orders.id, id));
  });
}
async function setOrderAiPaused(id, aiPaused) {
  await withDbRetry(async (db) => {
    await db.update(orders).set({ aiPaused }).where(eq(orders.id, id));
  });
}
async function updateOrderPaymentStatus(id, paymentStatus, stripePaymentIntentId, stripeCheckoutSessionId, asaasPaymentId) {
  await withDbRetry(async (db) => {
    const updateFields = { paymentStatus };
    if (stripePaymentIntentId) updateFields.stripePaymentIntentId = stripePaymentIntentId;
    if (stripeCheckoutSessionId) updateFields.stripeCheckoutSessionId = stripeCheckoutSessionId;
    if (asaasPaymentId) updateFields.asaasPaymentId = asaasPaymentId;
    if (paymentStatus === "paid") {
      updateFields.status = sql`CASE WHEN ${orders.status} = 'pending' THEN 'confirmed' ELSE ${orders.status} END`;
    }
    await db.update(orders).set(updateFields).where(eq(orders.id, id));
  });
}
async function createTransaction(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  try {
    await db.insert(transactions).values(data);
  } catch (err) {
    const msg = err?.message ?? "";
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
      console.warn(`[createTransaction] duplicate transaction ignored for order ${data.orderId}`);
      return;
    }
    throw err;
  }
}
async function getTransactionByOrderId(orderId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(transactions).where(eq(transactions.orderId, orderId)).limit(1);
  return result[0];
}
async function getTransactionsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: transactions.id,
    orderId: transactions.orderId,
    stripePaymentIntentId: transactions.stripePaymentIntentId,
    amount: transactions.amount,
    currency: transactions.currency,
    status: transactions.status,
    paymentMethod: transactions.paymentMethod,
    createdAt: transactions.createdAt
  }).from(transactions).innerJoin(orders, eq(transactions.orderId, orders.id)).where(eq(orders.userId, userId)).orderBy(desc(transactions.createdAt)).limit(50);
}
async function getSalesReport(startDate, endDate, storeId) {
  const db = await getDb();
  if (!db) return { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
  const result = await db.select({
    totalOrders: sql`COUNT(*)`,
    totalRevenue: sql`SUM(${orders.total})`,
    avgOrderValue: sql`AVG(${orders.total})`
  }).from(orders).where(
    and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      not(eq(orders.status, "cancelled")),
      storeId ? eq(orders.storeId, storeId) : void 0
    )
  );
  return result[0] ?? { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
}
async function getTopProducts(limit = 10, storeId, opts) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    productName: orderItems.productName,
    totalQuantity: sql`SUM(${orderItems.quantity})`,
    totalRevenue: sql`SUM(${orderItems.subtotal})`
  }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(
    not(eq(orders.status, "cancelled")),
    storeId ? eq(orders.storeId, storeId) : void 0,
    opts?.startDate ? gte(orders.createdAt, opts.startDate) : void 0,
    opts?.endDate ? lte(orders.createdAt, opts.endDate) : void 0
  )).groupBy(orderItems.productName).orderBy(desc(sql`SUM(${orderItems.quantity})`)).limit(limit);
}
async function getSalesOverview(startDate, endDate, storeId) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, totalOrders: 0, avgTicket: 0, prevTotalRevenue: 0, prevTotalOrders: 0, todayOrders: 0, todayRevenue: 0 };
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - periodMs);
  const prevEnd = new Date(startDate.getTime() - 1);
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
    )
  ]);
  const c = curr[0][0];
  const p = prev[0][0];
  const td = todayRes[0][0];
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
    todayRevenue: Number(td?.todayRevenue ?? 0)
  };
}
async function getSalesTimeSeries(startDate, endDate, storeId, timezoneOffsetMinutes = 0) {
  const db = await getDb();
  if (!db) return [];
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
  return rows[0].map((r) => ({
    date: r.date,
    totalOrders: Number(r.totalOrders),
    totalRevenue: Number(r.totalRevenue ?? 0)
  }));
}
async function getRecentOrdersFeed(limit = 20, storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: orders.id,
    customerName: orders.customerName,
    total: orders.total,
    status: orders.status,
    paymentMethod: orders.paymentMethod,
    createdAt: orders.createdAt
  }).from(orders).where(storeId ? eq(orders.storeId, storeId) : void 0).orderBy(desc(orders.createdAt)).limit(limit);
}
async function getOrderAlertFeed(storeId, limit = 20) {
  return withShortCache(`order-alert:${storeId ?? "all"}:${limit}`, 8e3, async () => {
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
      const recent = (recentRows[0] ?? []).map((row) => ({
        id: Number(row.id),
        status: row.status,
        createdAt: row.createdAt
      }));
      const counts = countsRows[0]?.[0];
      return {
        recent,
        pendingCount: Number(counts?.pendingCount ?? 0),
        cancelledCount: Number(counts?.cancelledCount ?? 0)
      };
    });
  });
}
async function getOrdersByPeriod(startDate, endDate, storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(and(
    gte(orders.createdAt, startDate),
    lte(orders.createdAt, endDate),
    storeId ? eq(orders.storeId, storeId) : void 0
  )).orderBy(desc(orders.createdAt));
}
async function getDailyRevenue(days = 7, storeId, timezoneOffsetMinutes = 0) {
  const db = await getDb();
  if (!db) return [];
  const tzOffset = getBrasilTzOffset();
  const todayStartUtc = getTodayStartUtc();
  const startDate = new Date(todayStartUtc.getTime() - days * 24 * 60 * 60 * 1e3);
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
  return rows[0].map((r) => ({
    date: r.date,
    totalOrders: Number(r.totalOrders),
    totalRevenue: Number(r.totalRevenue ?? 0)
  }));
}
async function updateUserProfile(userId, data) {
  await withDbRetry(async (db) => {
    await db.update(users).set(data).where(eq(users.id, userId));
  });
}
async function updateUserSocialProfile(userId, data) {
  await withDbRetry(async (db) => {
    const updateSet = {};
    if (data.name !== void 0) updateSet.name = data.name;
    if (data.email !== void 0) updateSet.email = data.email;
    if (data.avatarUrl !== void 0) updateSet.avatarUrl = data.avatarUrl;
    if (data.loginMethod !== void 0) updateSet.loginMethod = data.loginMethod;
    if (data.emailVerified !== void 0) updateSet.emailVerified = data.emailVerified;
    updateSet.lastSignedIn = data.lastSignedIn ?? /* @__PURE__ */ new Date();
    await db.update(users).set(updateSet).where(eq(users.id, userId));
  });
}
async function getUserById(id) {
  return withDbRetry(async (db) => {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  });
}
async function getAllUsers(limit = 100) {
  return withDbRetry(
    async (db) => db.select().from(users).orderBy(desc(users.createdAt)).limit(limit)
  );
}
async function getAdminUsersPage(input) {
  return withDbRetry(async (db) => {
    const page = Math.max(1, input?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 100));
    const offset = (page - 1) * pageSize;
    const search = input?.search?.trim() ?? "";
    const metricsStoreId = input?.storeId ?? 0;
    const searchClause = search ? sql`AND (
          u.name LIKE ${"%" + search + "%"}
          OR u.email LIKE ${"%" + search + "%"}
          OR u.phone LIKE ${"%" + search + "%"}
          OR u.openId LIKE ${"%" + search + "%"}
        )` : sql``;
    const roleClause = input?.role ? sql`AND u.role = ${input.role}` : sql``;
    const statusClause = input?.status ? sql`AND u.status = ${input.status}` : sql``;
    const loginMethodClause = input?.loginMethod ? sql`AND u.loginMethod = ${input.loginMethod}` : sql``;
    const clubStatusClause = input?.clubStatus === "none" ? sql`AND u.clubStatus IS NULL` : input?.clubStatus ? sql`AND u.clubStatus = ${input.clubStatus}` : sql``;
    const storeMembershipClause = input?.storeId ? sql`AND oa.userId IS NOT NULL` : sql``;
    const hasOrdersClause = input?.hasOrders === "with_orders" ? sql`AND COALESCE(oa.totalOrders, 0) > 0` : input?.hasOrders === "without_orders" ? sql`AND COALESCE(oa.totalOrders, 0) = 0` : sql``;
    const countRows = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN (
        SELECT
          o.userId,
          COUNT(*) AS totalOrders
        FROM orders o
        WHERE 1 = 1
        ${input?.storeId ? sql`AND o.storeId = ${input.storeId}` : sql``}
        GROUP BY o.userId
      ) oa ON oa.userId = u.id
      WHERE 1 = 1
      ${searchClause}
      ${roleClause}
      ${statusClause}
      ${loginMethodClause}
      ${clubStatusClause}
      ${storeMembershipClause}
      ${hasOrdersClause}
    `);
    const total = Number(countRows[0]?.[0]?.total ?? 0);
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.openId,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.loginMethod,
        u.clubPlan,
        u.clubStatus,
        u.avatarUrl,
        u.loyaltyPoints,
        u.createdAt,
        u.lastSignedIn,
        COALESCE(oa.totalOrders, 0) AS totalOrders,
        COALESCE(oa.deliveredOrders, 0) AS deliveredOrders,
        COALESCE(oa.totalSpent, 0) AS totalSpent,
        oa.lastOrderAt,
        cm.averageTicket,
        cm.favoriteNeighborhood,
        cm.favoriteProductName,
        cm.firstOrderAt,
        cm.lastOrderAt AS metricsLastOrderAt
      FROM users u
      LEFT JOIN (
        SELECT
          o.userId,
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS deliveredOrders,
          COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN CAST(o.total AS DECIMAL(12,2)) ELSE 0 END), 0) AS totalSpent,
          MAX(o.createdAt) AS lastOrderAt
        FROM orders o
        WHERE 1 = 1
        ${input?.storeId ? sql`AND o.storeId = ${input.storeId}` : sql``}
        GROUP BY o.userId
      ) oa ON oa.userId = u.id
      LEFT JOIN customer_metrics cm
        ON cm.userId = u.id
       AND cm.storeId = ${metricsStoreId}
      WHERE 1 = 1
      ${searchClause}
      ${roleClause}
      ${statusClause}
      ${loginMethodClause}
      ${clubStatusClause}
      ${storeMembershipClause}
      ${hasOrdersClause}
      ORDER BY COALESCE(oa.lastOrderAt, u.createdAt) DESC, u.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    const items = rows[0].map((row) => ({
      ...row,
      totalOrders: Number(row.totalOrders ?? 0),
      deliveredOrders: Number(row.deliveredOrders ?? 0),
      totalSpent: Number(row.totalSpent ?? 0),
      averageTicket: row.averageTicket == null ? 0 : Number(row.averageTicket)
    }));
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  });
}
async function getCouponsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupons).where(and(eq(coupons.userId, userId), eq(coupons.active, true)));
}
async function createUserCoupon(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(coupons).values({
    ...data,
    active: true,
    usedCount: 0
  });
}
async function getActiveUpsells() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(upsells).where(eq(upsells.active, true)).orderBy(upsells.sortOrder);
}
async function getUpsellsForCart(cartProductIds, cartTotal) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(upsells).where(eq(upsells.active, true)).orderBy(upsells.sortOrder);
  const filtered = all.filter((u) => {
    if (u.triggerMinTotal && parseFloat(u.triggerMinTotal) > cartTotal) return false;
    if (u.triggerProductId && !cartProductIds.includes(u.triggerProductId)) return false;
    if (cartProductIds.includes(u.suggestedProductId)) return false;
    return true;
  });
  const productIds = Array.from(new Set(filtered.map((u) => u.suggestedProductId)));
  const prods = productIds.length > 0 ? await db.select().from(products).where(sql`${products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`) : [];
  return filtered.map((u) => ({
    ...u,
    suggestedProduct: prods.find((p) => p.id === u.suggestedProductId) ?? null
  }));
}
async function createUpsell(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(upsells).values(data);
}
async function updateUpsell(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(upsells).set(data).where(eq(upsells.id, id));
}
async function deleteUpsell(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(upsells).where(eq(upsells.id, id));
}
async function getAllUpsells() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(upsells).orderBy(upsells.sortOrder);
}
async function getActivePromotions() {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const all = await db.select().from(promotions).where(eq(promotions.active, true)).orderBy(desc(promotions.createdAt));
  return all.filter((p) => {
    if (p.endsAt && p.endsAt < now) return false;
    if (p.startsAt && p.startsAt > now) return false;
    return true;
  });
}
async function getAllPromotions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promotions).orderBy(desc(promotions.createdAt));
}
async function createPromotion(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(promotions).values(data);
}
async function updatePromotion(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promotions).set(data).where(eq(promotions.id, id));
}
async function deletePromotion(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(promotions).where(eq(promotions.id, id));
}
async function getActiveRaffles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(raffles).where(eq(raffles.status, "active")).orderBy(desc(raffles.createdAt));
}
async function getAllRaffles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(raffles).orderBy(desc(raffles.createdAt));
}
async function createRaffle(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(raffles).values(data);
}
async function updateRaffle(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(raffles).set(data).where(eq(raffles.id, id));
}
async function getRaffleEntries(raffleId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
}
async function enterRaffle(raffleId, userId, userName) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(raffleEntries).where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.userId, userId))).limit(1);
  if (existing.length > 0) return false;
  await db.insert(raffleEntries).values({ raffleId, userId, userName });
  return true;
}
async function drawRaffleWinner(raffleId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const entries = await db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
  if (entries.length === 0) return null;
  const winner = entries[Math.floor(Math.random() * entries.length)];
  await db.update(raffles).set({
    status: "drawn",
    winnerId: winner.userId,
    winnerName: winner.userName,
    drawDate: /* @__PURE__ */ new Date()
  }).where(eq(raffles.id, raffleId));
  return winner;
}
async function getStoreSetting(key) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  }).catch(() => null);
}
async function getAllStoreSettings() {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(storeSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }).catch(() => ({}));
}
async function setStoreSetting(key, value) {
  await withDbRetry(async (db) => {
    await db.insert(storeSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  });
}
async function getAllDrivers(activeOnly = true, storeId) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (activeOnly) conditions.push(eq(drivers.active, true));
  if (storeId) conditions.push(eq(drivers.storeId, storeId));
  return db.select().from(drivers).where(conditions.length ? and(...conditions) : void 0).orderBy(drivers.name);
}
async function getDriverById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return result[0];
}
async function getDriverByToken(token) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(drivers).where(eq(drivers.accessToken, token)).limit(1);
  return result[0];
}
async function createDriver(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(drivers).values(data);
  const resultHeader = Array.isArray(result) ? result[0] : result;
  return resultHeader.insertId;
}
async function updateDriver(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(drivers).set(data).where(eq(drivers.id, id));
}
async function deleteDriver(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(drivers).set({ active: false }).where(eq(drivers.id, id));
}
async function assignDriverToOrder(orderId, driverId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(orders).set({ driverId }).where(eq(orders.id, orderId));
}
async function upsertDriverLocation(driverId, lat, lng, orderId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(driverLocations).where(eq(driverLocations.driverId, driverId)).limit(1);
  if (existing.length > 0) {
    await db.update(driverLocations).set({ lat, lng, orderId: orderId ?? null }).where(eq(driverLocations.driverId, driverId));
  } else {
    await db.insert(driverLocations).values({ driverId, lat, lng, orderId: orderId ?? null });
  }
}
async function getDriverLocation(driverId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(driverLocations).where(eq(driverLocations.driverId, driverId)).limit(1);
  return result[0];
}
async function getDriverLocationByOrder(orderId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(driverLocations).where(eq(driverLocations.orderId, orderId)).limit(1);
  return result[0];
}
async function getAllActiveDriverLocations(storeId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: driverLocations.id,
    driverId: driverLocations.driverId,
    orderId: driverLocations.orderId,
    lat: driverLocations.lat,
    lng: driverLocations.lng,
    updatedAt: driverLocations.updatedAt,
    driverName: drivers.name
  }).from(driverLocations).innerJoin(drivers, eq(driverLocations.driverId, drivers.id)).where(
    and(
      eq(drivers.active, true),
      storeId ? eq(drivers.storeId, storeId) : void 0
    )
  );
  return rows;
}
async function submitDeliveryRating(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(deliveryRatings).values(data);
}
async function getRatingByOrder(orderId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(deliveryRatings).where(eq(deliveryRatings.orderId, orderId)).limit(1);
  return result[0];
}
async function getDriverRatings(driverId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: deliveryRatings.id,
    orderId: deliveryRatings.orderId,
    driverId: deliveryRatings.driverId,
    userId: deliveryRatings.userId,
    rating: deliveryRatings.rating,
    comment: deliveryRatings.comment,
    createdAt: deliveryRatings.createdAt,
    customerName: users.name
  }).from(deliveryRatings).leftJoin(users, eq(deliveryRatings.userId, users.id)).where(eq(deliveryRatings.driverId, driverId)).orderBy(desc(deliveryRatings.createdAt));
  return rows.map((r) => ({ ...r, customerName: r.customerName ?? "Cliente" }));
}
async function getDriverAverageRating(driverId) {
  const db = await getDb();
  if (!db) return { avg: 0, count: 0 };
  const result = await db.select({
    avg: sql`AVG(${deliveryRatings.rating})`,
    count: sql`COUNT(*)`
  }).from(deliveryRatings).where(eq(deliveryRatings.driverId, driverId));
  return { avg: Number(result[0]?.avg ?? 0), count: Number(result[0]?.count ?? 0) };
}
async function getDriverDeliveryHistory(driverId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(and(eq(orders.driverId, driverId), eq(orders.status, "delivered"))).orderBy(desc(orders.createdAt)).limit(50);
}
async function getUserAddresses(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(desc(userAddresses.isDefault), userAddresses.createdAt);
}
async function createUserAddress(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.isDefault) {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, data.userId));
  }
  await db.insert(userAddresses).values(data);
}
async function updateUserAddress(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.isDefault) {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
  }
  await db.update(userAddresses).set(data).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)));
}
async function deleteUserAddress(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(userAddresses).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)));
}
async function getUserFavorites(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favorites).where(eq(favorites.userId, userId));
}
async function toggleFavorite(userId, productId) {
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
async function getClientNotifications(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientNotifications).where(eq(clientNotifications.userId, userId)).orderBy(desc(clientNotifications.createdAt)).limit(50);
}
async function getUnreadNotificationCount(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(clientNotifications).where(and(eq(clientNotifications.userId, userId), eq(clientNotifications.read, false)));
  return result[0]?.count ?? 0;
}
async function markNotificationsRead(userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientNotifications).set({ read: true }).where(eq(clientNotifications.userId, userId));
}
async function createClientNotification(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientNotifications).values(data);
}
async function getUserLoyaltyPoints(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ loyaltyPoints: users.loyaltyPoints }).from(users).where(eq(users.id, userId)).limit(1);
  return result[0]?.loyaltyPoints ?? 0;
}
async function addLoyaltyPoints(userId, points, orderId, description) {
  const db = await getDb();
  if (!db) return;
  const balanceBefore = await getUserLoyaltyPoints(userId);
  const balanceAfter = balanceBefore + points;
  await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} + ${points}` }).where(eq(users.id, userId));
  await db.insert(loyaltyTransactions).values({
    userId,
    orderId: orderId ?? null,
    type: "earn",
    points,
    description: description ?? `+${points} pontos por pedido #${orderId ?? ""}`,
    balanceBefore,
    balanceAfter
  });
}
async function deductLoyaltyPoints(userId, points, orderId, description) {
  const db = await getDb();
  if (!db) return { ok: false, newBalance: 0 };
  const current = await getUserLoyaltyPoints(userId);
  if (current < points) return { ok: false, newBalance: current };
  const balanceAfter = current - points;
  await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} - ${points}` }).where(eq(users.id, userId));
  await db.insert(loyaltyTransactions).values({
    userId,
    orderId: orderId ?? null,
    type: "redeem",
    points: -points,
    description: description ?? `-${points} pontos resgatados como desconto`,
    balanceBefore: current,
    balanceAfter
  });
  return { ok: true, newBalance: balanceAfter };
}
async function getLoyaltyHistory(userId, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(loyaltyTransactions).where(eq(loyaltyTransactions.userId, userId)).orderBy(sql`${loyaltyTransactions.createdAt} DESC`).limit(limit);
}
async function updateUserAvatar(userId, avatarUrl) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
}
async function getUserSpendingHistory(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    month: sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`,
    total: sql`SUM(${orders.total})`,
    count: sql`COUNT(*)`
  }).from(orders).where(and(eq(orders.userId, userId), eq(orders.status, "delivered"))).groupBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`).orderBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`).limit(12);
}
async function getOrderMessages(orderId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderMessages).where(eq(orderMessages.orderId, orderId)).orderBy(orderMessages.createdAt);
}
async function sendOrderMessage(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(orderMessages).values(data);
  const id = result.insertId;
  const [msg] = await db.select().from(orderMessages).where(eq(orderMessages.id, id));
  return msg;
}
async function markMessagesRead(orderId, readerRole) {
  const db = await getDb();
  if (!db) return;
  const senderRole = readerRole === "admin" ? "customer" : "admin";
  await db.update(orderMessages).set({ readAt: /* @__PURE__ */ new Date() }).where(and(eq(orderMessages.orderId, orderId), eq(orderMessages.senderRole, senderRole), isNull(orderMessages.readAt)));
}
async function getUnreadCountForOrder(orderId, readerRole) {
  const db = await getDb();
  if (!db) return 0;
  const senderRole = readerRole === "admin" ? "customer" : "admin";
  const rows = await db.select().from(orderMessages).where(and(eq(orderMessages.orderId, orderId), eq(orderMessages.senderRole, senderRole), isNull(orderMessages.readAt)));
  return rows.length;
}
async function getTotalUnreadForAdmin() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(orderMessages).where(and(eq(orderMessages.senderRole, "customer"), isNull(orderMessages.readAt)));
  return rows.length;
}
async function getTotalUnreadForUser(userId) {
  const db = await getDb();
  if (!db) return 0;
  const userOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
  if (userOrders.length === 0) return 0;
  let count = 0;
  for (const o of userOrders) {
    const rows = await db.select().from(orderMessages).where(and(eq(orderMessages.orderId, o.id), eq(orderMessages.senderRole, "admin"), isNull(orderMessages.readAt)));
    count += rows.length;
  }
  return count;
}
async function getCrmCustomers(opts) {
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
      ${search ? sql`AND (u.name LIKE ${"%" + search + "%"} OR u.email LIKE ${"%" + search + "%"} OR u.phone LIKE ${"%" + search + "%"})` : sql``}
      ${opts?.storeId ? sql`AND u.id IN (SELECT DISTINCT userId FROM \`orders\` WHERE storeId = ${opts.storeId})` : sql``}
    GROUP BY u.id
    ORDER BY lastOrderAt DESC, u.createdAt DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return rows[0];
}
async function countCrmCustomers(search, storeId) {
  const db = await getDb();
  if (!db) return 0;
  const s = search?.trim() ?? "";
  const rows = await db.execute(sql`
    SELECT COUNT(*) AS total FROM users u
    WHERE u.role = 'user'
    ${s ? sql`AND (u.name LIKE ${"%" + s + "%"} OR u.email LIKE ${"%" + s + "%"} OR u.phone LIKE ${"%" + s + "%"})` : sql``}
    ${storeId ? sql`AND u.id IN (SELECT DISTINCT userId FROM \`orders\` WHERE storeId = ${storeId})` : sql``}
  `);
  const result = rows[0];
  return Number(result[0]?.total ?? 0);
}
async function getCrmCustomerDetail(userId, storeId) {
  const db = await getDb();
  if (!db) return null;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows.length) return null;
  const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = userRows[0];
  const orderRows = await db.select().from(orders).where(storeId ? and(eq(orders.userId, userId), eq(orders.storeId, storeId)) : eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(20);
  return { user: safeUser, orders: orderRows };
}
async function getCrmCustomersByTag(tag) {
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
  return rows[0];
}
async function assignTagToCustomer(userId, tag) {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const existing = await db.execute(sql`
    SELECT id FROM customer_tags WHERE userId = ${userId} AND tag = ${tag} LIMIT 1
  `);
  const rows = existing[0];
  if (rows.length === 0) {
    await db.execute(sql`
      INSERT INTO customer_tags (userId, tag, assignedAt, updatedAt) VALUES (${userId}, ${tag}, ${now}, ${now})
    `);
  }
}
async function removeTagFromCustomer(userId, tag) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM customer_tags WHERE userId = ${userId} AND tag = ${tag}`);
}
async function getTagsForCustomer(userId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT tag, assignedAt FROM customer_tags WHERE userId = ${userId} ORDER BY assignedAt DESC
  `);
  return rows[0];
}
async function getJourneyExecutionsByUser(userId) {
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
  return rows[0];
}
async function getAbandonedCartsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT * FROM abandoned_carts WHERE userId = ${userId} ORDER BY createdAt DESC LIMIT 10
  `);
  return rows[0];
}
async function getCrmStats(storeId) {
  const db = await getDb();
  if (!db) return null;
  const rows = storeId ? await db.execute(sql`
      SELECT
        (SELECT COUNT(DISTINCT o.userId) FROM orders o WHERE o.storeId = ${storeId} AND o.userId IS NOT NULL) AS totalCustomers,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag = 'novo' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ct.userId AND o.storeId = ${storeId})) AS tagNovo,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag = 'recorrente' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ct.userId AND o.storeId = ${storeId})) AS tagRecorrente,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag = 'indeciso' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ct.userId AND o.storeId = ${storeId})) AS tagIndeciso,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag = 'inativo_15' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ct.userId AND o.storeId = ${storeId})) AS tagInativo15,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag = 'inativo_30' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ct.userId AND o.storeId = ${storeId})) AS tagInativo30,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag = 'inativo_60' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ct.userId AND o.storeId = ${storeId})) AS tagInativo60,
        (SELECT COUNT(*) FROM abandoned_carts ac WHERE ac.status = 'pending' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = ac.userId AND o.storeId = ${storeId})) AS carrinhosPendentes,
        (SELECT COUNT(*) FROM journey_executions je WHERE je.status = 'running' AND EXISTS (SELECT 1 FROM orders o WHERE o.userId = je.userId AND o.storeId = ${storeId})) AS jornadasAtivas
    `) : await db.execute(sql`
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
  const result = rows[0];
  return result[0] ?? null;
}
async function listNotificationTemplates(opts) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(notificationTemplates).$dynamic();
  if (opts?.event) {
    query = query.where(eq(notificationTemplates.event, opts.event));
  }
  return query.orderBy(notificationTemplates.event, notificationTemplates.channel);
}
async function createNotificationTemplate(data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(notificationTemplates).values(data);
  const rows = result;
  return rows[0].insertId;
}
async function updateNotificationTemplate(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notificationTemplates).set(data).where(eq(notificationTemplates.id, id));
}
async function deleteNotificationTemplate(id) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id));
}
async function pickRandomTemplate(event, channel) {
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
  const result = rows[0];
  return result[0] ?? null;
}
async function seedNotificationTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(notificationTemplates).limit(1);
  if (existing.length > 0) return;
  const templates = [
    // ── order_confirmed ──
    { event: "order_confirmed", channel: "push", title: "\u2705 Pedido confirmado!", body: "Oba! Seu pedido #{{orderId}} foi confirmado. J\xE1 estamos separando tudo com carinho!" },
    { event: "order_confirmed", channel: "push", title: "\u{1F355} Recebemos seu pedido!", body: "Pedido #{{orderId}} confirmado! A equipe da Bonatto j\xE1 entrou em a\xE7\xE3o." },
    { event: "order_confirmed", channel: "push", title: "\u{1F44C} T\xE1 na fila, {{clientName}}!", body: "Seu pedido #{{orderId}} foi aceito. Em breve come\xE7a a magia!" },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "Ol\xE1, {{clientName}}! \u{1F389} Seu pedido #{{orderId}} foi confirmado. Estamos preparando tudo com muito carinho pra voc\xEA. Qualquer d\xFAvida \xE9 s\xF3 chamar!" },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "Oi, {{clientName}}! \u2705 Recebemos seu pedido #{{orderId}} e j\xE1 estamos de olho nele. Logo logo sua pizza sai do forno!" },
    { event: "order_confirmed", channel: "whatsapp", title: "Pedido confirmado", body: "{{clientName}}, seu pedido #{{orderId}} est\xE1 confirmado! \u{1F355} Nossa equipe j\xE1 foi avisada. Aguarda que vem coisa boa a\xED!" },
    // ── order_preparing ──
    { event: "order_preparing", channel: "push", title: "\u{1F468}\u200D\u{1F373} M\xE3os na massa!", body: "Seu pedido #{{orderId}} est\xE1 sendo preparado. O cheirinho j\xE1 deve estar chegando a\xED!" },
    { event: "order_preparing", channel: "push", title: "\u{1F525} Forno ligado!", body: "Pedido #{{orderId}} no forno! Daqui a pouco vai estar pronto." },
    { event: "order_preparing", channel: "push", title: "\u{1F355} Preparando com amor", body: "Seu pedido #{{orderId}} est\xE1 nas m\xE3os dos nossos pizzaiolos. Quase l\xE1!" },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "{{clientName}}, seu pedido #{{orderId}} est\xE1 sendo preparado agora! \u{1F355}\u{1F525} O forno j\xE1 est\xE1 quente e a pizza vai sair perfeita. Aguenta um pouquinho!" },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "Oi {{clientName}}! \u{1F468}\u200D\u{1F373} Nosso time j\xE1 est\xE1 com as m\xE3os na massa do seu pedido #{{orderId}}. Em breve fica pronto!" },
    { event: "order_preparing", channel: "whatsapp", title: "Preparando", body: "{{clientName}}, o pedido #{{orderId}} entrou em produ\xE7\xE3o! \u{1F3AF} Estamos caprichando em cada detalhe pra voc\xEA. Logo logo sai!" },
    // ── order_out_for_delivery ──
    { event: "order_out_for_delivery", channel: "push", title: "\u{1F6F5} Saiu pra entrega!", body: "Seu pedido #{{orderId}} est\xE1 a caminho! Fique de olho na porta." },
    { event: "order_out_for_delivery", channel: "push", title: "\u{1F680} Voando at\xE9 voc\xEA!", body: "Pedido #{{orderId}} saiu! Nosso motoboy j\xE1 est\xE1 na estrada." },
    { event: "order_out_for_delivery", channel: "push", title: "\u{1F4CD} A caminho!", body: "Pedido #{{orderId}} em rota de entrega. Pode deixar o apetite crescer!" },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "{{clientName}}, seu pedido #{{orderId}} saiu para entrega! \u{1F6F5}\u{1F4A8} Nosso motoboy est\xE1 a caminho. Fique de olho na porta!" },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "Oi {{clientName}}! \u{1F355}\u{1F6F5} O pedido #{{orderId}} est\xE1 voando at\xE9 voc\xEA. Pode ir abrindo a porta!" },
    { event: "order_out_for_delivery", channel: "whatsapp", title: "Saiu para entrega", body: "{{clientName}}, boa not\xEDcia! \u{1F389} Seu pedido #{{orderId}} saiu agora. Daqui a pouco voc\xEA vai estar saboreando uma pizza incr\xEDvel!" },
    // ── order_delivered ──
    { event: "order_delivered", channel: "push", title: "\u{1F389} Entregue! Bom apetite!", body: "Seu pedido #{{orderId}} foi entregue. Aproveite muito!" },
    { event: "order_delivered", channel: "push", title: "\u{1F355} Chegou! Hora de comer!", body: "Pedido #{{orderId}} entregue. Bom apetite, {{clientName}}!" },
    { event: "order_delivered", channel: "push", title: "\u2705 Entregue com sucesso!", body: "Pedido #{{orderId}} na sua m\xE3o! Que seja delicioso." },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "{{clientName}}, seu pedido #{{orderId}} foi entregue! \u{1F389}\u{1F355} Esperamos que voc\xEA aproveite muito. Bom apetite e at\xE9 a pr\xF3xima!" },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "Oi {{clientName}}! \u2705 Pedido #{{orderId}} entregue com sucesso. Que a pizza esteja deliciosa! Qualquer coisa, estamos aqui. \u{1F60A}" },
    { event: "order_delivered", channel: "whatsapp", title: "Entregue", body: "{{clientName}}, chegou! \u{1F355}\u{1F525} Pedido #{{orderId}} entregue. Obrigado pela prefer\xEAncia! Nos vemos no pr\xF3ximo pedido. \u{1F64F}" },
    // ── order_cancelled ──
    { event: "order_cancelled", channel: "push", title: "\u274C Pedido cancelado", body: "Seu pedido #{{orderId}} foi cancelado. Sentimos muito!" },
    { event: "order_cancelled", channel: "push", title: "\u{1F614} Ops, pedido cancelado", body: "Pedido #{{orderId}} cancelado. Qualquer d\xFAvida, entre em contato." },
    { event: "order_cancelled", channel: "whatsapp", title: "Cancelado", body: "{{clientName}}, infelizmente seu pedido #{{orderId}} precisou ser cancelado. \u{1F614} Sentimos muito pelo inconveniente. Entre em contato conosco para mais informa\xE7\xF5es." },
    { event: "order_cancelled", channel: "whatsapp", title: "Cancelado", body: "Oi {{clientName}}, seu pedido #{{orderId}} foi cancelado. \u{1F622} Pedimos desculpas! Estamos \xE0 disposi\xE7\xE3o para resolver qualquer situa\xE7\xE3o." },
    // ── cart_abandoned_step1 (10 min — urgência) ──
    { event: "cart_abandoned_step1", channel: "push", title: "\u{1F355} Sua pizza est\xE1 esperando!", body: "Finalize seu pedido de R$ {{total}} antes que esfrie!" },
    { event: "cart_abandoned_step1", channel: "push", title: "\u26A1 Esqueceu alguma coisa?", body: "Seu carrinho de R$ {{total}} ainda est\xE1 salvo. Finaliza a\xED!" },
    { event: "cart_abandoned_step1", channel: "push", title: "\u{1F525} Seu pedido est\xE1 te esperando!", body: "R$ {{total}} no carrinho. N\xE3o deixa esfriar, {{clientName}}!" },
    { event: "cart_abandoned_step1", channel: "whatsapp", title: "Carrinho abandonado - etapa 1", body: "Ol\xE1, {{clientName}}! \u{1F355}\n\nVoc\xEA deixou sua pizza no forno! \u{1F605}\n\n*Total: R$ {{total}}*\n\nFinalize agora antes que esfrie:\n\u{1F449} https://bonattopizza.manus.space" },
    { event: "cart_abandoned_step1", channel: "whatsapp", title: "Carrinho abandonado - etapa 1", body: "Oi {{clientName}}! \u{1F44B}\n\nEsqueceu de finalizar seu pedido? \u{1F355}\n\nSeu carrinho de *R$ {{total}}* ainda est\xE1 salvo pra voc\xEA!\n\n\u{1F449} https://bonattopizza.manus.space" },
    // ── cart_abandoned_step2 (20 min — benefício) ──
    { event: "cart_abandoned_step2", channel: "push", title: "\u{1F6F5} Entrega em 40 minutos!", body: "Seu pedido de R$ {{total}} ainda est\xE1 salvo. Finalize agora!" },
    { event: "cart_abandoned_step2", channel: "push", title: "\u23F1\uFE0F Ainda d\xE1 tempo!", body: "Pedido de R$ {{total}} aguardando. Entregamos em at\xE9 40 min!" },
    { event: "cart_abandoned_step2", channel: "push", title: "\u{1F355} N\xE3o perca sua pizza!", body: "Carrinho salvo: R$ {{total}}. Finalize e receba em 40 minutos!" },
    { event: "cart_abandoned_step2", channel: "whatsapp", title: "Carrinho abandonado - etapa 2", body: "{{clientName}}, ainda d\xE1 tempo! \u{1F525}\n\nSeu pedido de *R$ {{total}}* ainda est\xE1 salvo.\n\n\u{1F6F5} Entregamos em at\xE9 40 minutos!\n\nN\xE3o perca sua pizza favorita:\n\u{1F449} https://bonattopizza.manus.space" },
    { event: "cart_abandoned_step2", channel: "whatsapp", title: "Carrinho abandonado - etapa 2", body: "Oi {{clientName}}! \u{1F355}\n\nSeu carrinho de *R$ {{total}}* ainda est\xE1 te esperando.\n\n\u{1F6F5} Pedido r\xE1pido, entrega em at\xE9 40 min!\n\n\u{1F449} https://bonattopizza.manus.space" },
    // ── cart_abandoned_step3 (30 min — escassez + cupom) ──
    { event: "cart_abandoned_step3", channel: "push", title: "\u23F0 \xDAltima chance! 10% OFF", body: "Cupom {{coupon}} \u2014 v\xE1lido 48h. Finalize agora!" },
    { event: "cart_abandoned_step3", channel: "push", title: "\u{1F381} Desconto exclusivo para voc\xEA!", body: "Use {{coupon}} e ganhe 10% OFF. Carrinho expira em breve!" },
    { event: "cart_abandoned_step3", channel: "push", title: "\u{1F6A8} Carrinho expirando!", body: "\xDAltima chance: R$ {{total}} com cupom {{coupon}} \u2014 10% OFF!" },
    { event: "cart_abandoned_step3", channel: "whatsapp", title: "Carrinho abandonado - etapa 3", body: "\u23F0 {{clientName}}, \xFAltima chance!\n\nSeu carrinho expira em breve e n\xE3o queremos que voc\xEA perca sua pizza! \u{1F355}\n\n\u{1F381} Use o cupom exclusivo *{{coupon}}* e ganhe *10% de desconto*!\n\n\u26A1 V\xE1lido por apenas 48 horas!\n\n\u{1F449} https://bonattopizza.manus.space" },
    { event: "cart_abandoned_step3", channel: "whatsapp", title: "Carrinho abandonado - etapa 3", body: "{{clientName}}, n\xE3o deixa passar! \u{1F631}\n\nSeu pedido de *R$ {{total}}* ainda est\xE1 salvo e temos um presente pra voc\xEA:\n\n\u{1F39F}\uFE0F Cupom *{{coupon}}* \u2014 *10% de desconto*\n\n\u23F0 Expira em 48h!\n\n\u{1F449} https://bonattopizza.manus.space" },
    // ── reactivation_15 (inativo 15 dias — 5% OFF) ──
    { event: "reactivation_15", channel: "push", title: "\u{1F355} Sentimos sua falta!", body: "5% OFF no seu pr\xF3ximo pedido \u2014 v\xE1lido 72h. Cupom: {{coupon}}" },
    { event: "reactivation_15", channel: "push", title: "\u{1F44B} Ol\xE1, {{clientName}}! Temos saudades!", body: "Volte a pedir e ganhe 5% de desconto com o cupom {{coupon}}!" },
    { event: "reactivation_15", channel: "whatsapp", title: "Reativa\xE7\xE3o 15 dias", body: "Oi, {{clientName}}! \u{1F44B}\n\nFaz uns dias que voc\xEA n\xE3o pede na Bonatto Pizza e a gente sentiu falta!\n\n\u{1F355} Que tal uma pizza hoje? Use o cupom *{{coupon}}* e ganhe *5% de desconto* no seu pr\xF3ximo pedido!\n\n\u23F0 V\xE1lido por 72 horas.\n\n\u{1F449} https://bonattopizza.manus.space" },
    { event: "reactivation_15", channel: "whatsapp", title: "Reativa\xE7\xE3o 15 dias", body: "{{clientName}}, a Bonatto sente sua falta! \u{1F355}\n\nQue tal voltar com um desconto especial? Use *{{coupon}}* e ganhe *5% OFF* no seu pr\xF3ximo pedido!\n\n\u23F0 V\xE1lido por 72h.\n\n\u{1F449} https://bonattopizza.manus.space" },
    // ── reactivation_30 (inativo 30 dias — 10% OFF) ──
    { event: "reactivation_30", channel: "push", title: "\u{1F381} 10% OFF \u2014 Oferta exclusiva!", body: "Volte a pedir com desconto especial. Cupom: {{coupon}}" },
    { event: "reactivation_30", channel: "push", title: "\u{1F3AF} Oferta especial para voc\xEA!", body: "Est\xE1 com saudade? 10% OFF com o cupom {{coupon}} \u2014 s\xF3 por tempo limitado!" },
    { event: "reactivation_30", channel: "whatsapp", title: "Reativa\xE7\xE3o 30 dias", body: "{{clientName}}, temos uma oferta especial para voc\xEA! \u{1F381}\n\nSabemos que faz um tempinho que voc\xEA n\xE3o pede na Bonatto Pizza. Que tal voltar com *10% de desconto*?\n\n\u{1F39F}\uFE0F Cupom exclusivo: *{{coupon}}*\n\n\u23F0 Oferta por tempo limitado!\n\n\u{1F449} https://bonattopizza.manus.space" },
    { event: "reactivation_30", channel: "whatsapp", title: "Reativa\xE7\xE3o 30 dias", body: "Oi {{clientName}}! \u{1F60A}\n\nA Bonatto tem um presente especial pra voc\xEA: *10% de desconto* no seu pr\xF3ximo pedido!\n\n\u{1F39F}\uFE0F Use o cupom *{{coupon}}* e aproveite!\n\n\u23F0 V\xE1lido por 48h.\n\n\u{1F449} https://bonattopizza.manus.space" },
    // ── reactivation_60 (inativo 60 dias — 15% OFF) ──
    { event: "reactivation_60", channel: "push", title: "\u{1F622} Voltamos para voc\xEA! 15% OFF", body: "Cupom especial de 15% para seu retorno: {{coupon}}" },
    { event: "reactivation_60", channel: "push", title: "\u{1F64F} Sua volta vale 15% OFF!", body: "Sentimos muito sua falta. Use {{coupon}} e volte com desconto!" },
    { event: "reactivation_60", channel: "whatsapp", title: "Reativa\xE7\xE3o 60 dias", body: "{{clientName}}! \u{1F622}\n\nA gente sente muito a sua falta na Bonatto Pizza.\n\nPara te receber de volta, preparamos um cupom especial de *15% de desconto*:\n\n\u{1F39F}\uFE0F *{{coupon}}*\n\n\u{1F355} Novidades no card\xE1pio te esperam!\n\n\u{1F449} https://bonattopizza.manus.space" },
    { event: "reactivation_60", channel: "whatsapp", title: "Reativa\xE7\xE3o 60 dias", body: "{{clientName}}, sua volta \xE9 muito especial pra gente! \u{1F970}\n\nComo presente de boas-vindas, aqui vai *15% de desconto*:\n\n\u{1F39F}\uFE0F Cupom: *{{coupon}}*\n\n\u23F0 V\xE1lido por 24h. Corre!\n\n\u{1F449} https://bonattopizza.manus.space" }
  ];
  await db.insert(notificationTemplates).values(templates);
}
async function getAllDeliveryZones(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(deliveryZones.neighborhood);
  }
  return db.select().from(deliveryZones).orderBy(deliveryZones.neighborhood);
}
async function getDeliveryZoneByNeighborhood(neighborhood) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE LOWER(neighborhood) = LOWER(${neighborhood}) AND isActive = 1 LIMIT 1`
  );
  const list = rows[0];
  if (!list || list.length === 0) return null;
  const r = list[0];
  return {
    id: Number(r.id),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive)
  };
}
async function searchDeliveryZones(query) {
  const db = await getDb();
  if (!db) return [];
  const like2 = `%${query}%`;
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE LOWER(neighborhood) LIKE LOWER(${like2}) AND isActive = 1 ORDER BY neighborhood LIMIT 10`
  );
  const list = rows[0];
  return (list ?? []).map((r) => ({
    id: Number(r.id),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive)
  }));
}
async function createDeliveryZone(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deliveryZones).values({
    neighborhood: data.neighborhood.trim(),
    city: data.city?.trim() ?? "",
    deliveryFee: data.deliveryFee,
    estimatedMinutes: data.estimatedMinutes ?? 45,
    isActive: true
  });
  return result.insertId;
}
async function updateDeliveryZone(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deliveryZones).set(data).where(eq(deliveryZones.id, id));
}
async function deleteDeliveryZone(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
}
async function getMenuSlides(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(menuSlides).where(activeOnly ? eq(menuSlides.isActive, true) : void 0).orderBy(menuSlides.sortOrder, menuSlides.id);
  return rows;
}
async function createMenuSlide(data) {
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
    isActive: true
  });
  const id = result.insertId;
  const [row] = await db.select().from(menuSlides).where(eq(menuSlides.id, id));
  return row;
}
async function updateMenuSlide(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(menuSlides).set(data).where(eq(menuSlides.id, id));
  const [row] = await db.select().from(menuSlides).where(eq(menuSlides.id, id));
  return row;
}
async function deleteMenuSlide(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(menuSlides).where(eq(menuSlides.id, id));
  return { success: true };
}
async function seedMenuSlides() {
  const db = await getDb();
  if (!db) return { seeded: false, count: 0 };
  const existing = await db.select().from(menuSlides);
  if (existing.length > 0) return { seeded: false, count: existing.length };
  const slides = [
    {
      title: "2 Pizzas Grandes",
      subtitle: "Por apenas R$ 89,90! Escolha qualquer sabor do card\xE1pio.",
      badgeText: "\u{1F525} Promo\xE7\xE3o",
      ctaText: "Pedir agora",
      ctaLink: "/cardapio",
      sortOrder: 1
    },
    {
      title: "Combo Casal",
      subtitle: "1 pizza grande + 1 refrigerante 1L por R$ 54,90.",
      badgeText: "\u2764\uFE0F Especial",
      ctaText: "Ver combo",
      ctaLink: "/cardapio",
      sortOrder: 2
    },
    {
      title: "Frete Gr\xE1tis",
      subtitle: "Em pedidos acima de R$ 60,00 para bairros selecionados.",
      badgeText: "\u{1F6F5} Entrega",
      ctaText: "Fazer pedido",
      ctaLink: "/cardapio",
      sortOrder: 3
    }
  ];
  for (const slide of slides) {
    await db.insert(menuSlides).values({ ...slide, isActive: true });
  }
  return { seeded: true, count: slides.length };
}
async function listCustomTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customTags).orderBy(customTags.name);
}
async function createCustomTag(data) {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(customTags).values({
    name: data.name.trim().toLowerCase().replace(/\s+/g, "_"),
    color: data.color,
    description: data.description ?? null,
    createdAt: /* @__PURE__ */ new Date()
  });
  return Number(result[0].insertId);
}
async function updateCustomTag(id, data) {
  const db = await getDb();
  if (!db) return;
  const updates = {};
  if (data.name) updates.name = data.name.trim().toLowerCase().replace(/\s+/g, "_");
  if (data.color) updates.color = data.color;
  if (data.description !== void 0) updates.description = data.description;
  await db.update(customTags).set(updates).where(eq(customTags.id, id));
}
async function deleteCustomTag(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags).where(eq(customCustomerTags.tagId, id));
  await db.delete(customTags).where(eq(customTags.id, id));
}
async function assignCustomTagToCustomer(userId, tagId) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(customCustomerTags).where(and(eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId))).limit(1);
  if (existing.length === 0) {
    await db.insert(customCustomerTags).values({ userId, tagId, assignedAt: /* @__PURE__ */ new Date() });
  }
}
async function removeCustomTagFromCustomer(userId, tagId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags).where(and(eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId)));
}
async function getCustomTagsForCustomer(userId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: customTags.id, name: customTags.name, color: customTags.color, description: customTags.description, createdAt: customTags.createdAt, assignedAt: customCustomerTags.assignedAt }).from(customCustomerTags).innerJoin(customTags, eq(customCustomerTags.tagId, customTags.id)).where(eq(customCustomerTags.userId, userId)).orderBy(customCustomerTags.assignedAt);
  return rows;
}
async function getCustomersByCustomTagName(tagName) {
  const db = await getDb();
  if (!db) return [];
  const tag = await db.select().from(customTags).where(eq(customTags.name, tagName)).limit(1);
  if (!tag[0]) return [];
  const rows = await db.select({ userId: customCustomerTags.userId }).from(customCustomerTags).where(eq(customCustomerTags.tagId, tag[0].id));
  return rows.map((r) => r.userId);
}
async function updateStripeCustomerId(userId, stripeCustomerId) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
}
async function createScheduledNotification(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scheduledNotifications).values(data);
  const resultHeader = Array.isArray(result) ? result[0] : result;
  return resultHeader.insertId;
}
async function listScheduledNotifications() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledNotifications).orderBy(desc(scheduledNotifications.scheduledAt));
}
async function cancelScheduledNotification(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledNotifications).set({ status: "cancelled" }).where(eq(scheduledNotifications.id, id));
}
async function deleteScheduledNotification(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(scheduledNotifications).where(eq(scheduledNotifications.id, id));
}
async function getPendingScheduledNotifications() {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  return db.select().from(scheduledNotifications).where(
    and(
      eq(scheduledNotifications.status, "pending"),
      lte(scheduledNotifications.scheduledAt, now)
    )
  );
}
async function markScheduledNotificationSent(id, sentCount) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledNotifications).set({ status: "sent", sentAt: /* @__PURE__ */ new Date(), sentCount }).where(eq(scheduledNotifications.id, id));
}
async function getCarouselImages(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(carouselImages).where(activeOnly ? eq(carouselImages.active, true) : void 0).orderBy(carouselImages.sortOrder, carouselImages.id);
}
async function createCarouselImage(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(carouselImages).values({
    imageUrl: data.imageUrl,
    title: data.title ?? null,
    sortOrder: data.sortOrder ?? 0,
    active: true
  });
}
async function updateCarouselImage(id, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(carouselImages).set(data).where(eq(carouselImages.id, id));
}
async function deleteCarouselImage(id) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(carouselImages).where(eq(carouselImages.id, id));
}
async function getOrdersWithMessages(storeId) {
  const db = await getDb();
  if (!db) return [];
  const msgs = await db.select().from(orderMessages).orderBy(orderMessages.createdAt);
  if (msgs.length === 0) return [];
  const byOrder = /* @__PURE__ */ new Map();
  for (const m of msgs) {
    if (!byOrder.has(m.orderId)) byOrder.set(m.orderId, []);
    byOrder.get(m.orderId).push(m);
  }
  const result = [];
  const orderIds = Array.from(byOrder.keys());
  for (const orderId of orderIds) {
    const orderMsgs = byOrder.get(orderId);
    const order = await getOrderById(orderId);
    if (!order) continue;
    if (storeId !== void 0 && order.storeId !== storeId) continue;
    const unread = orderMsgs.filter((m) => m.senderRole === "customer" && !m.readAt).length;
    const last = orderMsgs[orderMsgs.length - 1];
    result.push({
      orderId,
      customerName: order.customerName,
      status: order.status,
      lastMessage: last.message,
      lastMessageAt: last.createdAt,
      unreadCount: unread,
      aiPaused: order.aiPaused ?? false
    });
  }
  return result.sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}
async function saveDriverPushSubscription(driverId, endpoint, p256dh, auth, userAgent) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(driverPushSubscriptions).where(and(eq(driverPushSubscriptions.driverId, driverId), eq(driverPushSubscriptions.endpoint, endpoint)));
  if (existing.length > 0) {
    await db.update(driverPushSubscriptions).set({ p256dh, auth, userAgent }).where(eq(driverPushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(driverPushSubscriptions).values({ driverId, endpoint, p256dh, auth, userAgent });
  }
}
async function removeDriverPushSubscription(driverId, endpoint) {
  const db = await getDb();
  if (!db) return;
  await db.delete(driverPushSubscriptions).where(and(eq(driverPushSubscriptions.driverId, driverId), eq(driverPushSubscriptions.endpoint, endpoint)));
}
async function getDriverPushSubscriptions(driverId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driverPushSubscriptions).where(eq(driverPushSubscriptions.driverId, driverId));
}
async function getDriverTodayStats(driverId) {
  const db = await getDb();
  if (!db) return { deliveries: 0, earnings: 0, avgRating: 0, ratingCount: 0 };
  const todayStart = getTodayStartUtc();
  const todayOrders = await db.select({ id: orders.id, total: orders.total }).from(orders).where(
    and(
      eq(orders.driverId, driverId),
      eq(orders.status, "delivered"),
      gte(orders.updatedAt, todayStart)
    )
  );
  const deliveries = todayOrders.length;
  const earnings = todayOrders.reduce((acc, o) => acc + Number(o.total) * 0.1, 0);
  const ratingResult = await db.select({
    avg: sql`AVG(${deliveryRatings.rating})`,
    count: sql`COUNT(*)`
  }).from(deliveryRatings).where(
    and(
      eq(deliveryRatings.driverId, driverId),
      gte(deliveryRatings.createdAt, todayStart)
    )
  );
  return {
    deliveries,
    earnings,
    avgRating: Number(ratingResult[0]?.avg ?? 0),
    ratingCount: Number(ratingResult[0]?.count ?? 0)
  };
}
async function getDriverActiveOrderDetails(driverId) {
  const db = await getDb();
  if (!db) return null;
  const activeOrders = await db.select().from(orders).where(
    and(
      eq(orders.driverId, driverId),
      eq(orders.status, "out_for_delivery")
    )
  ).orderBy(desc(orders.updatedAt)).limit(1);
  if (!activeOrders.length) return null;
  const order = activeOrders[0];
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}
async function getDriverAssignedOrders(driverId) {
  const db = await getDb();
  if (!db) return [];
  const activeOrders = await db.select().from(orders).where(
    and(
      eq(orders.driverId, driverId),
      eq(orders.status, "out_for_delivery")
    )
  ).orderBy(desc(orders.updatedAt));
  if (!activeOrders.length) return [];
  const results = await Promise.all(
    activeOrders.map(async (order) => {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return { order, items };
    })
  );
  return results;
}
async function driverConfirmDelivery(driverId, orderId) {
  const db = await getDb();
  if (!db) return { success: false, error: "DB not available" };
  const orderResult = await db.select().from(orders).where(
    and(
      eq(orders.id, orderId),
      eq(orders.driverId, driverId),
      eq(orders.status, "out_for_delivery")
    )
  ).limit(1);
  if (!orderResult.length) {
    return { success: false, error: "Pedido n\xE3o encontrado ou j\xE1 foi finalizado" };
  }
  const order = orderResult[0];
  await db.update(orders).set({ status: "delivered", updatedAt: /* @__PURE__ */ new Date() }).where(eq(orders.id, orderId));
  await db.update(driverLocations).set({ orderId: null }).where(eq(driverLocations.driverId, driverId));
  return { success: true, customerId: order.userId };
}
async function getDriverTodayDeliveries(driverId) {
  const db = await getDb();
  if (!db) return [];
  const todayStartUtc = getTodayStartUtc();
  return db.select({
    id: orders.id,
    customerName: orders.customerName,
    deliveryAddress: orders.deliveryAddress,
    total: orders.total,
    status: orders.status,
    updatedAt: orders.updatedAt
  }).from(orders).where(
    and(
      eq(orders.driverId, driverId),
      eq(orders.status, "delivered"),
      gte(orders.updatedAt, todayStartUtc)
    )
  ).orderBy(desc(orders.updatedAt));
}
async function createClientAlert(data) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(clientAlerts).values({
    type: data.type,
    title: data.title,
    message: data.message,
    icon: data.icon ?? "\u{1F514}",
    url: data.url,
    storeId: data.storeId,
    active: true,
    expiresAt: data.expiresAt
  });
  return result.insertId;
}
async function listClientAlerts(userId) {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const alerts = await db.select().from(clientAlerts).where(
    and(
      eq(clientAlerts.active, true),
      or(isNull(clientAlerts.expiresAt), gt(clientAlerts.expiresAt, now))
    )
  ).orderBy(desc(clientAlerts.createdAt)).limit(20);
  if (alerts.length === 0) return [];
  const reads = await db.select({ alertId: clientAlertReads.alertId }).from(clientAlertReads).where(eq(clientAlertReads.userId, userId));
  const readSet = new Set(reads.map((r) => r.alertId));
  return alerts.map((a) => ({ ...a, read: readSet.has(a.id) }));
}
async function dismissClientAlert(alertId, userId) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(clientAlertReads).values({ alertId, userId });
  } catch {
  }
}
async function countUnreadClientAlerts(userId) {
  const db = await getDb();
  if (!db) return 0;
  const now = /* @__PURE__ */ new Date();
  const alerts = await db.select({ id: clientAlerts.id }).from(clientAlerts).where(
    and(
      eq(clientAlerts.active, true),
      or(isNull(clientAlerts.expiresAt), gt(clientAlerts.expiresAt, now))
    )
  );
  if (alerts.length === 0) return 0;
  const alertIds = alerts.map((a) => a.id);
  const reads = await db.select({ alertId: clientAlertReads.alertId }).from(clientAlertReads).where(and(eq(clientAlertReads.userId, userId), inArray(clientAlertReads.alertId, alertIds)));
  return alertIds.length - reads.length;
}
async function getTopCategories(startDate, endDate, storeId) {
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
  const arr = Array.isArray(rows) ? rows : rows[0] ?? [];
  return arr.map((r) => ({
    categoryName: String(r.categoryName ?? ""),
    totalQuantity: Number(r.totalQuantity ?? 0),
    totalRevenue: Number(r.totalRevenue ?? 0)
  }));
}
async function getAdminDashboardSnapshot(storeId) {
  return withShortCache(`admin-dashboard:${storeId ?? "all"}`, 15e3, async () => {
    const now = /* @__PURE__ */ new Date();
    const todayStart = getTodayStartUtc(now);
    const todayEnd = getTodayEndUtc(now);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1e3);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);
    const last7DaysStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1e3);
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
        const item = rows[0]?.[0];
        return {
          pendingOrders: Number(item?.pendingOrders ?? 0),
          confirmedOrders: Number(item?.confirmedOrders ?? 0),
          preparingOrders: Number(item?.preparingOrders ?? 0),
          outForDeliveryOrders: Number(item?.outForDeliveryOrders ?? 0)
        };
      })
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
        total: activeCounts.pendingOrders + activeCounts.confirmedOrders + activeCounts.preparingOrders + activeCounts.outForDeliveryOrders
      },
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  });
}
async function recordWebhookEventOnce(provider, eventId, eventType) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  try {
    await db.insert(webhookEvents).values({ provider, eventId, eventType: eventType ?? null });
    return true;
  } catch (err) {
    const msg = err?.message ?? "";
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) return false;
    throw err;
  }
}
async function creditLoyaltyForOrderIdempotent(orderId, userId, points, description) {
  if (points <= 0) return false;
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(loyaltyOrderCredits).values({ orderId, userId, points });
  } catch (err) {
    const msg = err?.message ?? "";
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
    balanceAfter
  });
  return true;
}
async function deductLoyaltyPointsAtomic(userId, points, orderId, description) {
  if (points <= 0) return { ok: true, newBalance: await getUserLoyaltyPoints(userId) };
  const db = await getDb();
  if (!db) return { ok: false, newBalance: 0 };
  const result = await db.update(users).set({ loyaltyPoints: sql`${users.loyaltyPoints} - ${points}` }).where(and(eq(users.id, userId), gte(users.loyaltyPoints, points)));
  const affected = result?.rowsAffected ?? result?.[0]?.affectedRows ?? 0;
  if (!affected) return { ok: false, newBalance: await getUserLoyaltyPoints(userId) };
  const newBalance = await getUserLoyaltyPoints(userId);
  await db.insert(loyaltyTransactions).values({
    userId,
    orderId: orderId ?? null,
    type: "redeem",
    points: -points,
    description: description ?? `-${points} pontos resgatados como desconto`,
    balanceBefore: newBalance + points,
    balanceAfter: newBalance
  });
  return { ok: true, newBalance };
}
async function refundLoyaltyPointsForOrder(orderId) {
  const db = await getDb();
  if (!db) return 0;
  const order = await getOrderById(orderId);
  if (!order || !order.userId) return 0;
  const pointsUsed = order.pointsUsed ?? 0;
  if (pointsUsed <= 0) return 0;
  const existing = await db.select().from(loyaltyTransactions).where(and(
    eq(loyaltyTransactions.orderId, orderId),
    eq(loyaltyTransactions.type, "manual")
  )).limit(1);
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
    balanceAfter
  });
  return pointsUsed;
}
async function registerCouponRedemption(couponId, code, orderId, userId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(couponRedemptions).values({ couponId, code, orderId, userId });
}
async function revertCouponRedemption(orderId) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(couponRedemptions).where(eq(couponRedemptions.orderId, orderId)).limit(1);
  if (!existing.length || existing[0].reverted) return false;
  await db.update(couponRedemptions).set({ reverted: true }).where(eq(couponRedemptions.orderId, orderId));
  await db.update(coupons).set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.id, existing[0].couponId));
  return true;
}
async function updateOrderStatusGuarded(id, nextStatus, allowedCurrent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const current = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!current[0]) return { ok: false };
  const previous = current[0].status;
  if (!allowedCurrent.includes(previous)) return { ok: false, previous };
  const result = await db.update(orders).set({ status: nextStatus }).where(and(eq(orders.id, id), eq(orders.status, previous)));
  const affected = result?.rowsAffected ?? result?.[0]?.affectedRows ?? 0;
  return { ok: affected > 0, previous };
}
async function cancelStaleUnpaidOrders(olderThanMinutes = 120) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1e3);
  const stale = await db.select({ id: orders.id }).from(orders).where(
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
  const cancelled = [];
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
var _db, _pool, _schemaReady, _memoCache;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_timezone();
    init_schema();
    init_env();
    _db = null;
    _pool = null;
    _schemaReady = null;
    _memoCache = /* @__PURE__ */ new Map();
  }
});

// server/push.ts
var push_exports = {};
__export(push_exports, {
  removePushSubscription: () => removePushSubscription,
  savePushSubscription: () => savePushSubscription,
  sendPushToAdmins: () => sendPushToAdmins,
  sendPushToAllUsers: () => sendPushToAllUsers,
  sendPushToDriver: () => sendPushToDriver,
  sendPushToUser: () => sendPushToUser
});
import webpush from "web-push";
import { eq as eq2, and as and2, inArray as inArray2 } from "drizzle-orm";
function inferInAppType(payload) {
  const source = `${payload.tag ?? ""} ${payload.url ?? ""} ${payload.title ?? ""}`.toLowerCase();
  if (source.includes("order") || source.includes("pedido") || source.includes("delivery")) return "order";
  if (source.includes("promo") || source.includes("coupon") || source.includes("cupom") || source.includes("cart")) return "promo";
  return "system";
}
async function saveInAppNotification(userId, payload) {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientNotifications).values({
    userId,
    title: payload.title,
    message: payload.body,
    type: inferInAppType(payload)
  });
}
async function saveInAppNotificationsForUsers(userIds, payload) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  if (uniqueUserIds.length === 0) return;
  const db = await getDb();
  if (!db) return;
  await db.insert(clientNotifications).values(
    uniqueUserIds.map((userId) => ({
      userId,
      title: payload.title,
      message: payload.body,
      type: inferInAppType(payload)
    }))
  );
}
async function sendPushToUser(userId, payload) {
  const db = await getDb();
  if (!db) return;
  if (!isVapidConfigured) {
    await saveInAppNotification(userId, payload);
    return;
  }
  const subs = await db.select().from(pushSubscriptions).where(eq2(pushSubscriptions.userId, userId));
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
      } catch (err) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq2(pushSubscriptions.id, sub.id));
        }
      }
    })
  );
}
async function sendPushToAdmins(payload) {
  const db = await getDb();
  if (!db) return;
  const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const adminUsers = await db.select({ id: users2.id }).from(users2).where(eq2(users2.role, "admin"));
  if (!isVapidConfigured) {
    await saveInAppNotificationsForUsers(adminUsers.map((u) => u.id), payload);
    return;
  }
  await Promise.allSettled(adminUsers.map((u) => sendPushToUser(u.id, payload)));
}
async function savePushSubscription(userId, endpoint, p256dh, auth, userAgent) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(pushSubscriptions).where(and2(eq2(pushSubscriptions.userId, userId), eq2(pushSubscriptions.endpoint, endpoint)));
  if (existing.length > 0) {
    await db.update(pushSubscriptions).set({ p256dh, auth, userAgent }).where(eq2(pushSubscriptions.id, existing[0].id));
  } else {
    await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth, userAgent });
  }
}
async function sendPushToAllUsers(payload, userIds) {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };
  if (!isVapidConfigured) {
    const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const targetRows = userIds && userIds.length > 0 ? await db.select({ id: users2.id }).from(users2).where(inArray2(users2.id, userIds)) : await db.select({ id: users2.id }).from(users2);
    await saveInAppNotificationsForUsers(targetRows.map((row) => row.id), payload);
    return { sent: targetRows.length, failed: 0 };
  }
  let query = db.select({ userId: pushSubscriptions.userId, id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth }).from(pushSubscriptions).$dynamic();
  if (userIds && userIds.length > 0) {
    query = query.where(inArray2(pushSubscriptions.userId, userIds));
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
      } catch (err) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq2(pushSubscriptions.id, sub.id));
        }
      }
    })
  );
  return { sent, failed };
}
async function sendPushToDriver(driverId, payload) {
  const db = await getDb();
  if (!db) return;
  const subs = await db.select().from(driverPushSubscriptions).where(eq2(driverPushSubscriptions.driverId, driverId));
  const icon = payload.icon ?? "/icon-192.png";
  const badge = payload.badge ?? "/icon-192.png";
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, icon, badge, url: payload.url ?? "/motoboy", tag: payload.tag, soundUrl: payload.soundUrl })
        );
      } catch (err) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(driverPushSubscriptions).where(eq2(driverPushSubscriptions.id, sub.id));
        }
      }
    })
  );
}
async function removePushSubscription(userId, endpoint) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(and2(eq2(pushSubscriptions.userId, userId), eq2(pushSubscriptions.endpoint, endpoint)));
}
var vapidPublicKey, vapidPrivateKey, isVapidConfigured;
var init_push = __esm({
  "server/push.ts"() {
    "use strict";
    init_db();
    init_schema();
    vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
    vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
    isVapidConfigured = Boolean(vapidPublicKey && vapidPrivateKey);
    if (isVapidConfigured) {
      webpush.setVapidDetails(
        process.env.VAPID_EMAIL ?? "mailto:contato@bonattopizza.com.br",
        vapidPublicKey,
        vapidPrivateKey
      );
    } else {
      console.warn("[Push] VAPID keys not configured \u2014 push notifications disabled.");
    }
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  storageGet: () => storageGet,
  storagePut: () => storagePut
});
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
async function buildDownloadUrl(baseUrl, relKey, apiKey) {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey)
  });
  return (await response.json()).url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const segmentStart = relKey.lastIndexOf("/");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot <= segmentStart) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}
async function storageGet(relKey) {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey)
  };
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
  }
});

// server/adapters/storage.ts
var storage_exports2 = {};
__export(storage_exports2, {
  storageGetAdapter: () => storageGetAdapter,
  storagePutAdapter: () => storagePutAdapter
});
function resolveStorageProvider() {
  const explicit = (process.env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "vercel_blob" || explicit === "vercel-blob") return "vercel_blob";
  if (explicit === "s3" || explicit === "r2" || explicit === "minio" || explicit === "manus") {
    return explicit;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "vercel_blob";
  return "manus";
}
async function putManus(relKey, data, contentType) {
  const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const result = await storagePut2(relKey, data, contentType);
  return { ...result, provider: "manus" };
}
async function getManus(relKey) {
  const { storageGet: storageGet2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const result = await storageGet2(relKey);
  return { ...result, provider: "manus" };
}
async function putVercelBlob(relKey, data, contentType) {
  const { put } = await import("@vercel/blob");
  const pathname = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? data : data instanceof Uint8Array ? data : new Uint8Array(data);
  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: true,
    contentType
  });
  return { key: blob.pathname, url: blob.url, provider: "vercel_blob" };
}
async function getVercelBlob(relKey) {
  const { head } = await import("@vercel/blob");
  const pathname = relKey.replace(/^\/+/, "");
  const blob = await head(pathname);
  return { key: blob.pathname, url: blob.url, provider: "vercel_blob" };
}
function getS3Config(provider) {
  if (provider === "s3") {
    return {
      endpoint: `https://s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com`,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      bucket: process.env.AWS_S3_BUCKET ?? "",
      publicUrl: process.env.AWS_S3_PUBLIC_URL ?? "",
      region: process.env.AWS_REGION ?? "us-east-1"
    };
  }
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID ?? "";
    return {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      bucket: process.env.R2_BUCKET ?? "",
      publicUrl: process.env.R2_PUBLIC_URL ?? "",
      region: "auto"
    };
  }
  return {
    endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    bucket: process.env.MINIO_BUCKET ?? "bonatto",
    publicUrl: process.env.MINIO_PUBLIC_URL ?? "",
    region: "us-east-1"
  };
}
async function putS3Compatible(provider, relKey, data, contentType) {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const cfg = getS3Config(provider);
  const client = new S3Client({
    region: cfg.region,
    endpoint: provider !== "s3" ? cfg.endpoint : void 0,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: provider === "minio"
  });
  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }));
  const url = cfg.publicUrl ? `${cfg.publicUrl.replace(/\/+$/, "")}/${key}` : `${cfg.endpoint}/${cfg.bucket}/${key}`;
  return { key, url, provider };
}
async function getS3Compatible(provider, relKey) {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const cfg = getS3Config(provider);
  const client = new S3Client({
    region: cfg.region,
    endpoint: provider !== "s3" ? cfg.endpoint : void 0,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: provider === "minio"
  });
  const key = relKey.replace(/^\/+/, "");
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), { expiresIn: 3600 });
  return { key, url, provider };
}
async function storagePutAdapter(relKey, data, contentType = "application/octet-stream") {
  const provider = resolveStorageProvider();
  switch (provider) {
    case "vercel_blob":
      return putVercelBlob(relKey, data, contentType);
    case "s3":
      return putS3Compatible("s3", relKey, data, contentType);
    case "r2":
      return putS3Compatible("r2", relKey, data, contentType);
    case "minio":
      return putS3Compatible("minio", relKey, data, contentType);
    case "manus":
    default:
      return putManus(relKey, data, contentType);
  }
}
async function storageGetAdapter(relKey) {
  const provider = resolveStorageProvider();
  switch (provider) {
    case "vercel_blob":
      return getVercelBlob(relKey);
    case "s3":
      return getS3Compatible("s3", relKey);
    case "r2":
      return getS3Compatible("r2", relKey);
    case "minio":
      return getS3Compatible("minio", relKey);
    case "manus":
    default:
      return getManus(relKey);
  }
}
var init_storage2 = __esm({
  "server/adapters/storage.ts"() {
    "use strict";
  }
});

// server/imageUtils.ts
var imageUtils_exports = {};
__export(imageUtils_exports, {
  compressToWebP: () => compressToWebP
});
import sharp from "sharp";
async function compressToWebP(input, quality = 82, maxWidth = 1200) {
  const originalSize = input.length;
  const compressed = await sharp(input).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality, effort: 4 }).toBuffer();
  const compressedSize = compressed.length;
  const reductionPct = Math.round((1 - compressedSize / originalSize) * 100);
  return {
    buffer: compressed,
    mimeType: "image/webp",
    ext: "webp",
    originalSize,
    compressedSize,
    reductionPct
  };
}
var init_imageUtils = __esm({
  "server/imageUtils.ts"() {
    "use strict";
  }
});

// server/_core/llm.ts
var llm_exports = {};
__export(llm_exports, {
  invokeLLM: () => invokeLLM
});
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/adapters/llm.ts
var llm_exports2 = {};
__export(llm_exports2, {
  callLLM: () => callLLM
});
async function callManus(options) {
  const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
  const res = await invokeLLM2({
    messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
    ...options.responseFormat?.type === "json_object" ? { response_format: { type: "json_object" } } : {}
  });
  const raw = res.choices?.[0]?.message?.content ?? "";
  const content = typeof raw === "string" ? raw : JSON.stringify(raw);
  return { content, provider: "manus" };
}
async function callOpenAI(options) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY n\xE3o configurada");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const body = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024
  };
  if (options.responseFormat) body.response_format = options.responseFormat;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.choices[0].message.content, provider: "openai" };
}
async function callGroq(options) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY n\xE3o configurada");
  const model = process.env.GROQ_MODEL ?? "llama3-8b-8192";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024
    })
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.choices[0].message.content, provider: "groq" };
}
async function callOllama(options) {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3";
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: options.messages, stream: false })
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.message.content, provider: "ollama" };
}
async function callLLM(options) {
  const provider = (process.env.LLM_PROVIDER ?? "manus").toLowerCase();
  switch (provider) {
    case "openai":
      return callOpenAI(options);
    case "groq":
      return callGroq(options);
    case "ollama":
      return callOllama(options);
    case "manus":
    default:
      return callManus(options);
  }
}
var init_llm2 = __esm({
  "server/adapters/llm.ts"() {
    "use strict";
  }
});

// server/_core/loadEnv.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

// api/_all-source.ts
import express2 from "express";

// server/_core/apiApp.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// server/adapters/pushNotifications.ts
async function notifyOwnerManus(payload) {
  try {
    const { notifyOwner: notifyOwner4 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
    const success = await notifyOwner4({
      title: payload.title,
      content: payload.body
    });
    return { success, provider: "manus" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "manus", error: message };
  }
}
async function sendVapidToAdmins(payload) {
  try {
    const { sendPushToAdmins: sendPushToAdmins2 } = await Promise.resolve().then(() => (init_push(), push_exports));
    await sendPushToAdmins2(payload);
    return { success: true, provider: "vapid" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "vapid", error: message };
  }
}
async function notifyOwnerAdapter(payload) {
  const provider = (process.env.PUSH_PROVIDER ?? "manus").toLowerCase();
  switch (provider) {
    case "vapid":
      return sendVapidToAdmins(payload);
    case "manus":
    default:
      return notifyOwnerManus(payload);
  }
}

// server/asaas.ts
var ASAAS_BASE_URL = process.env.ASAAS_SANDBOX === "true" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
function getHeaders() {
  const apiKey = process.env.ASAAS_API_KEY ?? "";
  if (!apiKey) throw new Error("ASAAS_API_KEY n\xE3o configurada");
  return {
    "Content-Type": "application/json",
    access_token: apiKey
  };
}
async function getOrCreateAsaasCustomer(opts) {
  if (opts.email) {
    const searchRes = await fetch(
      `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(opts.email)}&limit=1`,
      { headers: getHeaders() }
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.data.length > 0) return data.data[0].id;
    }
  }
  const body = { name: opts.name };
  if (opts.email) body.email = opts.email;
  if (opts.phone) body.phone = opts.phone.replace(/\D/g, "");
  if (opts.cpfCnpj) body.cpfCnpj = opts.cpfCnpj.replace(/\D/g, "");
  const res = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas create customer error: ${res.status} ${err}`);
  }
  const customer = await res.json();
  return customer.id;
}
async function createPixCharge(opts) {
  const dueDate = opts.dueDate ?? (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).split("/").reverse().join("-");
  const body = {
    customer: opts.customerId,
    billingType: "PIX",
    value: opts.value,
    dueDate,
    description: opts.description,
    externalReference: opts.externalReference ?? ""
  };
  const res = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas create payment error: ${res.status} ${err}`);
  }
  const payment = await res.json();
  const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${payment.id}/pixQrCode`, {
    headers: getHeaders()
  });
  if (!qrRes.ok) {
    const err = await qrRes.text();
    throw new Error(`Asaas QR Code error: ${qrRes.status} ${err}`);
  }
  const qr = await qrRes.json();
  return {
    id: payment.id,
    status: payment.status,
    value: payment.value,
    netValue: payment.netValue,
    encodedImage: qr.encodedImage,
    payload: qr.payload,
    expirationDate: qr.expirationDate
  };
}
async function getChargeStatus(chargeId) {
  const res = await fetch(`${ASAAS_BASE_URL}/payments/${chargeId}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Asaas get payment error: ${res.status}`);
  const data = await res.json();
  return data.status;
}
function verifyAsaasWebhook(token) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Asaas] ASAAS_WEBHOOK_TOKEN n\xE3o configurado em produ\xE7\xE3o \u2014 rejeitando webhook."
      );
      return false;
    }
    console.warn(
      "[Asaas] ASAAS_WEBHOOK_TOKEN vazio \u2014 aceitando webhook em ambiente de desenvolvimento."
    );
    return true;
  }
  if (!token) return false;
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

// server/automationWebhook.ts
init_db();
init_schema();
import { eq as eq4 } from "drizzle-orm";

// server/automation.ts
init_db();
init_schema();
import { eq as eq3, and as and3, lt, gte as gte2, sql as sql2, inArray as inArray3 } from "drizzle-orm";

// server/whatsapp.ts
var ZApiProvider = class {
  instanceId;
  token;
  clientToken;
  constructor() {
    this.instanceId = process.env.ZAPI_INSTANCE_ID ?? "";
    this.token = process.env.ZAPI_TOKEN ?? "";
    this.clientToken = process.env.ZAPI_CLIENT_TOKEN ?? "";
  }
  async send(to, message) {
    if (!this.instanceId || !this.token) {
      console.warn("[WhatsApp/Z-API] Credenciais n\xE3o configuradas. Mensagem n\xE3o enviada.");
      return;
    }
    const phone = to.replace(/\D/g, "");
    const url = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}/send-text`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.clientToken ? { "Client-Token": this.clientToken } : {}
      },
      body: JSON.stringify({ phone, message })
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[WhatsApp/Z-API] Erro ao enviar: ${response.status} ${body}`);
    } else {
      console.log(`[WhatsApp/Z-API] Mensagem enviada para ${phone}`);
    }
  }
};
var TwilioProvider = class {
  async send(to, message) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
    if (!accountSid || !authToken) {
      console.warn("[WhatsApp/Twilio] Credenciais n\xE3o configuradas. Mensagem n\xE3o enviada.");
      return;
    }
    const phone = to.replace(/\D/g, "");
    const toWhatsApp = `whatsapp:+${phone}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ From: from, To: toWhatsApp, Body: message });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
      },
      body: body.toString()
    });
    if (!response.ok) {
      const respBody = await response.text();
      console.error(`[WhatsApp/Twilio] Erro ao enviar: ${response.status} ${respBody}`);
    } else {
      console.log(`[WhatsApp/Twilio] Mensagem enviada para ${toWhatsApp}`);
    }
  }
};
var NoOpProvider = class {
  async send(to, message) {
    console.log(`[WhatsApp/NoOp] Mensagem para ${to}: ${message.substring(0, 60)}...`);
  }
};
function getProvider() {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "none").toLowerCase();
  if (provider === "zapi") return new ZApiProvider();
  if (provider === "twilio") return new TwilioProvider();
  return new NoOpProvider();
}
async function sendWhatsApp(to, message) {
  if (!to) return;
  const provider = getProvider();
  try {
    await provider.send(to, message);
  } catch (err) {
    console.error("[WhatsApp] Falha ao enviar mensagem:", err);
  }
}
var WhatsAppTemplates = {
  orderConfirmed: (customerName, orderId, total) => `\u{1F355} *Bonatto Pizza* \u2014 Ol\xE1, ${customerName}!

Seu pedido *#${orderId}* foi *confirmado* com sucesso! \u{1F389}

\u{1F4B0} Total: R$ ${total}

Acompanhe o status do seu pedido em: https://bonattopizza.manus.space/minha-conta

Obrigado pela prefer\xEAncia! \u{1F64F}`,
  orderPreparing: (customerName, orderId) => `\u{1F355} *Bonatto Pizza* \u2014 Ol\xE1, ${customerName}!

Seu pedido *#${orderId}* est\xE1 sendo *preparado* com carinho pela nossa equipe! \u{1F468}\u200D\u{1F373}

Em breve sair\xE1 para entrega. Aguarde!`,
  orderOutForDelivery: (customerName, orderId, driverName) => `\u{1F6F5} *Bonatto Pizza* \u2014 Ol\xE1, ${customerName}!

Seu pedido *#${orderId}* saiu para entrega!${driverName ? ` O motoboy *${driverName}* est\xE1 a caminho.` : ""}

Acompanhe: https://bonattopizza.manus.space/rastrear/${orderId}`,
  orderDelivered: (customerName, orderId) => `\u2705 *Bonatto Pizza* \u2014 Ol\xE1, ${customerName}!

Seu pedido *#${orderId}* foi *entregue*! Esperamos que aproveite muito! \u{1F60B}

Que tal avaliar nossa entrega? Acesse: https://bonattopizza.manus.space/minha-conta

Volte sempre! \u{1F355}\u2764\uFE0F`,
  orderCancelled: (customerName, orderId) => `\u274C *Bonatto Pizza* \u2014 Ol\xE1, ${customerName}.

Infelizmente seu pedido *#${orderId}* foi *cancelado*.

Entre em contato conosco para mais informa\xE7\xF5es. Pedimos desculpas pelo inconveniente.`
};

// server/automation.ts
init_push();
init_db();
async function refreshCustomerTags() {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const newInactivityTriggers = [];
  const userOrderStats = await db.execute(sql2`
    SELECT
      u.id AS userId,
      COUNT(o.id) AS totalOrders,
      MAX(o.createdAt) AS lastOrderAt,
      MIN(o.createdAt) AS firstOrderAt,
      CASE
        WHEN COUNT(o.id) > 1
        THEN DATEDIFF(MAX(o.createdAt), MIN(o.createdAt)) / (COUNT(o.id) - 1)
        ELSE NULL
      END AS avgDaysBetween
    FROM users u
    LEFT JOIN orders o ON o.userId = u.id AND o.status = 'delivered'
    WHERE u.role = 'user'
    GROUP BY u.id
  `);
  const rows = userOrderStats[0];
  for (const row of rows) {
    const tags = [];
    const total = Number(row.totalOrders ?? 0);
    const lastOrder = row.lastOrderAt ? new Date(row.lastOrderAt) : null;
    const daysSinceLast = lastOrder ? Math.floor((now.getTime() - lastOrder.getTime()) / (1e3 * 60 * 60 * 24)) : null;
    const avg = row.avgDaysBetween ? Number(row.avgDaysBetween) : null;
    if (total === 0) continue;
    if (daysSinceLast !== null) {
      if (daysSinceLast >= 60) tags.push("inativo_60");
      else if (daysSinceLast >= 30) tags.push("inativo_30");
      else if (daysSinceLast >= 15) tags.push("inativo_15");
    }
    if (total <= 5) tags.push("novo");
    if (total > 10 && daysSinceLast !== null && daysSinceLast < 30) tags.push("recorrente");
    if (avg !== null && avg >= 12 && avg <= 20 && total > 2) tags.push("indeciso");
    for (const tag of tags) {
      const existing = await db.select().from(customerTags).where(and3(eq3(customerTags.userId, row.userId), eq3(customerTags.tag, tag))).limit(1);
      if (existing.length === 0) {
        await db.insert(customerTags).values({
          userId: row.userId,
          tag,
          assignedAt: now,
          updatedAt: now
        });
      } else {
        await db.update(customerTags).set({ updatedAt: now }).where(and3(eq3(customerTags.userId, row.userId), eq3(customerTags.tag, tag)));
      }
    }
    const allTags = ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"];
    const toRemove = allTags.filter((t2) => !tags.includes(t2));
    if (toRemove.length > 0) {
      await db.delete(customerTags).where(
        and3(
          eq3(customerTags.userId, row.userId),
          inArray3(customerTags.tag, toRemove)
        )
      );
    }
    for (const tag of tags) {
      if (tag === "inativo_15" || tag === "inativo_30" || tag === "inativo_60") {
        const triggerName = `tag_${tag}`;
        const wasAlreadyTagged = await db.select().from(customerTags).where(and3(eq3(customerTags.userId, row.userId), eq3(customerTags.tag, tag))).limit(1);
        if (!wasAlreadyTagged.length) {
          newInactivityTriggers.push({ trigger: triggerName, userId: row.userId });
        }
      }
    }
    if (row.lastOrderAt) {
      const daysSinceLast2 = Math.floor(
        (now.getTime() - new Date(row.lastOrderAt).getTime()) / (1e3 * 60 * 60 * 24)
      );
      const customJourneys = await db.select().from(journeys).where(and3(eq3(journeys.trigger, "tag_inativo_custom"), eq3(journeys.status, "active")));
      for (const cj of customJourneys) {
        const requiredDays = cj.daysInactive ?? 0;
        if (requiredDays > 0 && daysSinceLast2 >= requiredDays) {
          const existingExec = await db.select({ id: journeyExecutions.id }).from(journeyExecutions).where(and3(
            eq3(journeyExecutions.journeyId, cj.id),
            eq3(journeyExecutions.userId, row.userId),
            inArray3(journeyExecutions.status, ["running", "completed"])
          )).limit(1);
          if (!existingExec.length) {
            await startJourneyExecution(cj.id, row.userId);
          }
        }
      }
    }
  }
  for (const { trigger, userId } of newInactivityTriggers) {
    fireJourneyTrigger(trigger, userId).catch(
      (err) => console.error(`[Automation] inactivity trigger ${trigger} failed for user ${userId}:`, err)
    );
  }
}
async function registerAbandonedCart(data) {
  const db = await getDb();
  if (!db) return -1;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1e3);
  const existing = await db.select().from(abandonedCarts).where(and3(eq3(abandonedCarts.userId, data.userId), eq3(abandonedCarts.status, "pending"))).limit(1);
  if (existing.length > 0) {
    await db.update(abandonedCarts).set({
      items: JSON.stringify(data.items),
      total: data.total,
      expiresAt,
      createdAt: now
    }).where(eq3(abandonedCarts.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(abandonedCarts).values({
    userId: data.userId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    items: JSON.stringify(data.items),
    total: data.total,
    status: "pending",
    createdAt: now,
    expiresAt
  });
  return Number(result[0].insertId);
}
async function markCartRecovered(userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(abandonedCarts).set({ status: "recovered", recoveredAt: /* @__PURE__ */ new Date() }).where(and3(eq3(abandonedCarts.userId, userId), eq3(abandonedCarts.status, "pending")));
}
async function startJourneyExecution(journeyId, userId, phone, metadata) {
  const db = await getDb();
  if (!db) return -1;
  const existing = await db.select().from(journeyExecutions).where(
    and3(
      eq3(journeyExecutions.journeyId, journeyId),
      eq3(journeyExecutions.userId, userId),
      eq3(journeyExecutions.status, "running")
    )
  ).limit(1);
  if (existing.length > 0) return existing[0].id;
  const journey = await db.select().from(journeys).where(eq3(journeys.id, journeyId)).limit(1);
  if (!journey.length || journey[0].status !== "active") return -1;
  const steps = JSON.parse(journey[0].steps);
  const firstStep = steps[0];
  const nextStepAt = firstStep?.type === "wait" && firstStep.delayMinutes ? new Date(Date.now() + firstStep.delayMinutes * 60 * 1e3) : /* @__PURE__ */ new Date();
  const result = await db.insert(journeyExecutions).values({
    journeyId,
    userId,
    phone: phone ?? null,
    status: "running",
    currentStep: 0,
    metadata: metadata ? JSON.stringify(metadata) : null,
    startedAt: /* @__PURE__ */ new Date(),
    nextStepAt,
    logs: JSON.stringify([{ at: (/* @__PURE__ */ new Date()).toISOString(), msg: "Jornada iniciada" }])
  });
  return Number(result[0].insertId);
}
async function processJourneyExecutions() {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const pending = await db.select().from(journeyExecutions).where(
    and3(
      eq3(journeyExecutions.status, "running"),
      lt(journeyExecutions.nextStepAt, now)
    )
  ).limit(50);
  for (const exec of pending) {
    try {
      await processExecution(exec);
    } catch (err) {
      console.error(`[Automation] Erro ao processar execu\xE7\xE3o ${exec.id}:`, err);
      await db.update(journeyExecutions).set({ status: "failed" }).where(eq3(journeyExecutions.id, exec.id));
    }
  }
}
async function processExecution(exec) {
  const db = await getDb();
  if (!db) return;
  const journey = await db.select().from(journeys).where(eq3(journeys.id, exec.journeyId)).limit(1);
  if (!journey.length) return;
  const steps = JSON.parse(journey[0].steps);
  let currentStepIdx = exec.currentStep;
  const logs = exec.logs ? JSON.parse(exec.logs) : [];
  const metadata = exec.metadata ? JSON.parse(exec.metadata) : {};
  const log = (msg) => logs.push({ at: (/* @__PURE__ */ new Date()).toISOString(), msg });
  while (currentStepIdx < steps.length) {
    const step = steps[currentStepIdx];
    if (journey[0].exitOnOrder) {
      const exitOrder = await db.select({ id: orders.id }).from(orders).where(
        and3(
          eq3(orders.userId, exec.userId),
          gte2(orders.createdAt, exec.startedAt),
          inArray3(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"])
        )
      ).limit(1);
      if (exitOrder.length > 0) {
        log(`Exit Condition: cliente fez pedido #${exitOrder[0].id} \u2014 jornada encerrada automaticamente`);
        await db.update(journeyExecutions).set({ status: "completed", completedAt: /* @__PURE__ */ new Date(), currentStep: currentStepIdx, logs: JSON.stringify(logs) }).where(eq3(journeyExecutions.id, exec.id));
        return;
      }
    }
    if (step.type === "wait") {
      currentStepIdx++;
      continue;
    }
    if (step.type === "send_whatsapp") {
      if (exec.phone && step.message) {
        await sendWhatsApp(exec.phone, step.message);
        log(`WhatsApp enviado: ${step.message.substring(0, 60)}`);
      }
      currentStepIdx++;
    } else if (step.type === "send_push") {
      if (step.title && step.message) {
        await sendPushToUser(exec.userId, {
          title: step.title,
          body: step.message,
          url: "/",
          tag: `journey-${exec.journeyId}-${exec.id}`
        });
        log(`Push enviado: ${step.title}`);
      }
      currentStepIdx++;
    } else if (step.type === "add_tag") {
      if (step.tag) {
        const tagIdNum = Number(step.tag);
        if (!isNaN(tagIdNum) && tagIdNum > 0) {
          const existingCustom = await db.select().from(customCustomerTags).where(and3(eq3(customCustomerTags.userId, exec.userId), eq3(customCustomerTags.tagId, tagIdNum))).limit(1);
          if (!existingCustom.length) {
            await db.insert(customCustomerTags).values({ userId: exec.userId, tagId: tagIdNum, assignedAt: /* @__PURE__ */ new Date() });
          }
          log(`Tag personalizada adicionada: id=${tagIdNum}`);
        } else {
          const tag = step.tag;
          const existing = await db.select().from(customerTags).where(and3(eq3(customerTags.userId, exec.userId), eq3(customerTags.tag, tag))).limit(1);
          if (!existing.length) {
            await db.insert(customerTags).values({ userId: exec.userId, tag, assignedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() });
          }
          log(`Tag do sistema adicionada: ${tag}`);
        }
      }
      currentStepIdx++;
    } else if (step.type === "remove_tag") {
      if (step.tag) {
        const tagIdNum = Number(step.tag);
        if (!isNaN(tagIdNum) && tagIdNum > 0) {
          await db.delete(customCustomerTags).where(and3(eq3(customCustomerTags.userId, exec.userId), eq3(customCustomerTags.tagId, tagIdNum)));
          log(`Tag personalizada removida: id=${tagIdNum}`);
        } else {
          await db.delete(customerTags).where(and3(eq3(customerTags.userId, exec.userId), eq3(customerTags.tag, step.tag)));
          log(`Tag do sistema removida: ${step.tag}`);
        }
      }
      currentStepIdx++;
    } else if (step.type === "condition") {
      let conditionMet = false;
      if (step.condition === "purchased_since_start") {
        const recentOrder = await db.select().from(orders).where(
          and3(
            eq3(orders.userId, exec.userId),
            gte2(orders.createdAt, exec.startedAt),
            inArray3(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"])
          )
        ).limit(1);
        conditionMet = recentOrder.length > 0;
      } else if (step.condition === "has_tag" && step.conditionTag) {
        const tagRow = await db.select().from(customerTags).where(and3(eq3(customerTags.userId, exec.userId), eq3(customerTags.tag, step.conditionTag))).limit(1);
        conditionMet = tagRow.length > 0;
      }
      const action = conditionMet ? step.onTrue : step.onFalse;
      log(`Condi\xE7\xE3o "${step.condition}": ${conditionMet ? "verdadeira" : "falsa"} \u2192 ${action}`);
      if (action === "stop") {
        await db.update(journeyExecutions).set({ status: "completed", completedAt: /* @__PURE__ */ new Date(), currentStep: currentStepIdx, logs: JSON.stringify(logs) }).where(eq3(journeyExecutions.id, exec.id));
        return;
      }
      currentStepIdx++;
    } else if (step.type === "send_coupon") {
      const discountType = step.couponDiscountType ?? "percentage";
      const discountValue = step.couponDiscountValue ?? 10;
      const expiryDays = step.couponExpiryDays ?? 7;
      const code = `BONATTO${exec.userId}${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400 * 1e3) : null;
      const discountLabel = discountType === "percentage" ? `${discountValue}% de desconto` : `R$ ${Number(discountValue).toFixed(2).replace(".", ",")} de desconto`;
      const validityLabel = expiryDays > 0 ? ` (v\xE1lido por ${expiryDays} dia${expiryDays !== 1 ? "s" : ""})` : "";
      await db.insert(coupons).values({
        code,
        discountType,
        discountValue: String(discountValue),
        minOrderValue: "0",
        maxUses: 1,
        usedCount: 0,
        active: true,
        userId: exec.userId,
        expiresAt: expiresAt ?? void 0
      });
      await db.insert(clientNotifications).values({
        userId: exec.userId,
        title: "\u{1F381} Cupom exclusivo para voc\xEA!",
        message: `Use o c\xF3digo ${code} e ganhe ${discountLabel}${validityLabel}. V\xE1lido no pr\xF3ximo pedido.`,
        type: "promo",
        read: false
      });
      await sendPushToUser(exec.userId, {
        title: "\u{1F381} Cupom exclusivo para voc\xEA!",
        body: `Use ${code} e ganhe ${discountLabel}${validityLabel}.`,
        url: "/cardapio",
        tag: `coupon-${code}`
      });
      if (exec.phone) {
        const appUrl = process.env.PUBLIC_APP_URL ?? "";
        await sendWhatsApp(
          exec.phone,
          `\u{1F381} *Bonatto Pizza* \u2014 Ol\xE1! Preparamos um cupom exclusivo para voc\xEA:

*C\xF3digo:* ${code}
*Desconto:* ${discountLabel}${validityLabel}

Use no seu pr\xF3ximo pedido: ${appUrl}/cardapio`
        );
      }
      log(`Cupom gerado: ${code} (${discountType} ${discountValue}${validityLabel})`);
      currentStepIdx++;
    } else if (step.type === "update_loyalty") {
      const points = step.loyaltyPoints ?? 0;
      if (points !== 0) {
        const userRow = await db.select({ loyaltyPoints: users.loyaltyPoints }).from(users).where(eq3(users.id, exec.userId)).limit(1);
        const currentPoints = userRow[0]?.loyaltyPoints ?? 0;
        const newBalance = Math.max(0, currentPoints + points);
        const description = step.loyaltyDescription ?? `Automa\xE7\xE3o: ${points > 0 ? "+" : ""}${points} pontos`;
        await db.update(users).set({ loyaltyPoints: newBalance }).where(eq3(users.id, exec.userId));
        await db.insert(loyaltyTransactions).values({
          userId: exec.userId,
          type: "manual",
          points,
          description,
          balanceBefore: currentPoints,
          balanceAfter: newBalance
        });
        const pointsLabel = points > 0 ? `+${points} pontos adicionados` : `${points} pontos removidos`;
        await db.insert(clientNotifications).values({
          userId: exec.userId,
          title: points > 0 ? "\u2B50 Pontos adicionados!" : "\u{1F4C9} Pontos removidos",
          message: `${pointsLabel}. Seu saldo atual \xE9 de ${newBalance} pontos. ${description}`,
          type: "system",
          read: false
        });
        await sendPushToUser(exec.userId, {
          title: points > 0 ? "\u2B50 Voc\xEA ganhou pontos!" : "\u{1F4C9} Pontos atualizados",
          body: `${pointsLabel}. Saldo atual: ${newBalance} pontos.`,
          url: "/minha-conta",
          tag: `loyalty-${exec.userId}-${Date.now()}`
        });
        log(`Pontos de fidelidade: ${points > 0 ? "+" : ""}${points} (saldo: ${newBalance})`);
      }
      currentStepIdx++;
    } else if (step.type === "send_alert") {
      const alertTitle = step.alertTitle ?? "Nova mensagem";
      const alertMsg = step.alertMessage ?? "";
      const alertIcon = step.alertIcon ?? "\u{1F514}";
      const alertUrl = step.alertUrl ?? null;
      await db.insert(clientNotifications).values({
        userId: exec.userId,
        title: `${alertIcon} ${alertTitle}`,
        message: alertMsg,
        type: "system",
        read: false
      });
      if (alertMsg) {
        await sendPushToUser(exec.userId, {
          title: `${alertIcon} ${alertTitle}`,
          body: alertMsg,
          url: alertUrl ?? "/",
          tag: `alert-${exec.journeyId}-${exec.id}`
        });
      }
      log(`Alerta enviado ao usu\xE1rio ${exec.userId}: ${alertTitle}`);
      currentStepIdx++;
    } else if (step.type === "split_ab") {
      const isGroupA = exec.userId % 2 === 0;
      const group = isGroupA ? "A" : "B";
      const channel = step.splitChannel ?? "push";
      const msgToSend = isGroupA ? step.messageA ?? step.message ?? "" : step.messageB ?? step.message ?? "";
      const titleToSend = isGroupA ? step.titleA ?? step.title ?? "Bonatto Pizza" : step.titleB ?? step.title ?? "Bonatto Pizza";
      if (msgToSend) {
        if (channel === "whatsapp" && exec.phone) {
          await sendWhatsApp(exec.phone, msgToSend);
        } else if (channel === "push") {
          await sendPushToUser(exec.userId, {
            title: titleToSend,
            body: msgToSend,
            url: "/",
            tag: `split-${exec.journeyId}-${exec.id}-${group}`
          });
        }
      }
      await db.update(journeyExecutions).set({ abGroup: group }).where(eq3(journeyExecutions.id, exec.id));
      log(`Split A/B: usu\xE1rio ${exec.userId} \u2192 Grupo ${group} | canal: ${channel} | msg: ${msgToSend.substring(0, 60)}`);
      currentStepIdx++;
    } else if (step.type === "pause_journey") {
      if (step.pauseJourneyId) {
        await db.update(journeys).set({ status: "paused", updatedAt: /* @__PURE__ */ new Date() }).where(and3(eq3(journeys.id, step.pauseJourneyId), eq3(journeys.status, "active")));
        log(`Jornada #${step.pauseJourneyId} pausada automaticamente`);
      }
      currentStepIdx++;
    } else if (step.type === "notify_admin") {
      const taskTitle = step.adminTaskTitle ?? "A\xE7\xE3o manual necess\xE1ria";
      const taskMsg = step.adminTaskMessage ?? `Cliente ${exec.userId} requer aten\xE7\xE3o (jornada #${exec.journeyId})`;
      const { notifyOwner: notifyOwner4 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
      await notifyOwner4({ title: taskTitle, content: taskMsg });
      await db.update(journeyExecutions).set({ adminTaskTitle: taskTitle }).where(eq3(journeyExecutions.id, exec.id));
      log(`Tarefa criada para admin: ${taskTitle}`);
      currentStepIdx++;
    } else {
      currentStepIdx++;
    }
    if (currentStepIdx < steps.length && steps[currentStepIdx].type === "wait") {
      const delay = steps[currentStepIdx].delayMinutes ?? 0;
      const nextAt = new Date(Date.now() + delay * 60 * 1e3);
      await db.update(journeyExecutions).set({ currentStep: currentStepIdx, nextStepAt: nextAt, logs: JSON.stringify(logs) }).where(eq3(journeyExecutions.id, exec.id));
      return;
    }
  }
  await db.update(journeyExecutions).set({ status: "completed", completedAt: /* @__PURE__ */ new Date(), currentStep: currentStepIdx, logs: JSON.stringify(logs) }).where(eq3(journeyExecutions.id, exec.id));
}
async function getAllCustomerTagsWithUsers() {
  const db = await getDb();
  if (!db) return [[], []];
  return db.execute(sql2`
    SELECT ct.userId, ct.tag, ct.assignedAt, u.name, u.email, u.phone
    FROM customer_tags ct
    JOIN users u ON u.id = ct.userId
    ORDER BY ct.assignedAt DESC
  `);
}
async function listJourneys() {
  const db = await getDb();
  if (!db) return [];
  const list = await db.select().from(journeys).orderBy(journeys.createdAt);
  const enriched = await Promise.all(list.map(async (j) => {
    const execs = await db.select({ id: journeyExecutions.id, startedAt: journeyExecutions.startedAt }).from(journeyExecutions).where(eq3(journeyExecutions.journeyId, j.id));
    const execCount = execs.length;
    const lastRunAt = execs.length > 0 ? execs.reduce(
      (latest, e) => new Date(e.startedAt) > new Date(latest) ? e.startedAt : latest,
      execs[0].startedAt
    ) : null;
    return { ...j, execCount, lastRunAt };
  }));
  return enriched;
}
async function getJourneyById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(journeys).where(eq3(journeys.id, id)).limit(1);
  return rows[0] ?? null;
}
async function createJourney(data) {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(journeys).values({
    name: data.name,
    description: data.description ?? null,
    trigger: data.trigger,
    status: "draft",
    steps: JSON.stringify(data.steps),
    daysInactive: data.daysInactive ?? null,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  });
  return Number(result[0].insertId);
}
async function updateJourney(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(journeys).set({
    ...data,
    steps: data.steps ? JSON.stringify(data.steps) : void 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(journeys.id, id));
}
async function deleteJourney(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(journeyExecutions).where(eq3(journeyExecutions.journeyId, id));
  await db.delete(journeys).where(eq3(journeys.id, id));
}
async function duplicateJourney(id) {
  const db = await getDb();
  if (!db) return -1;
  const original = await db.select().from(journeys).where(eq3(journeys.id, id)).limit(1);
  if (!original[0]) return -1;
  const result = await db.insert(journeys).values({
    name: `${original[0].name} (c\xF3pia)`,
    description: original[0].description,
    trigger: original[0].trigger,
    status: "draft",
    steps: original[0].steps,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  });
  return Number(result[0].insertId);
}
async function listExecutions(journeyId) {
  const db = await getDb();
  if (!db) return [];
  if (journeyId) {
    return db.select().from(journeyExecutions).where(eq3(journeyExecutions.journeyId, journeyId)).orderBy(journeyExecutions.startedAt);
  }
  return db.select().from(journeyExecutions).orderBy(journeyExecutions.startedAt);
}
async function cancelExecution(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(journeyExecutions).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date() }).where(eq3(journeyExecutions.id, id));
}
async function listAbandonedCarts(status) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(abandonedCarts).where(eq3(abandonedCarts.status, status)).orderBy(abandonedCarts.createdAt);
  }
  return db.select().from(abandonedCarts).orderBy(abandonedCarts.createdAt);
}
async function fireJourneyTrigger(trigger, userId, phone) {
  const activeJourneys = await getActiveJourneysForTrigger(trigger);
  for (const journey of activeJourneys) {
    try {
      await startJourneyExecution(journey.id, userId, phone);
    } catch (err) {
      console.error(`[Automation] fireJourneyTrigger failed for journey ${journey.id}:`, err);
    }
  }
}
async function getActiveJourneysForTrigger(trigger) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journeys).where(and3(eq3(journeys.trigger, trigger), eq3(journeys.status, "active")));
}
async function logAutomationEvent(db, params) {
  if (!db) return;
  await db.insert(automationEvents).values({
    type: params.type,
    userId: params.userId,
    cartId: params.cartId,
    orderId: params.orderId,
    channel: params.channel,
    step: params.step,
    status: params.status,
    abVariant: params.abVariant,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAt: /* @__PURE__ */ new Date()
  });
}
async function generateRecoveryCoupon(db, userId, discountPercent, suffix) {
  if (!db) return "VOLTA10";
  const code = `VOLTA${discountPercent}-${suffix.toUpperCase().replace(/\W/g, "").slice(0, 6)}`;
  const existing = await db.select().from(coupons).where(eq3(coupons.code, code)).limit(1);
  if (existing.length > 0) return code;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1e3);
  await db.insert(coupons).values({
    code,
    discountType: "percentage",
    discountValue: String(discountPercent),
    minOrderValue: "30.00",
    maxUses: 1,
    usedCount: 0,
    active: true,
    userId,
    expiresAt,
    createdAt: /* @__PURE__ */ new Date()
  });
  return code;
}
var REACTIVATION_COPY = {
  inativo_15: {
    title: "Sentimos sua falta!",
    whatsapp: (name, coupon) => `Oi, ${name}! \u{1F44B}

Faz uns dias que voc\xEA n\xE3o pede na Bonatto Pizza e a gente sentiu falta!

\u{1F355} Que tal uma pizza hoje? Use o cupom *${coupon}* e ganhe *5% de desconto* no seu pr\xF3ximo pedido!

\u23F0 V\xE1lido por 72 horas.

\u{1F449} https://bonattopizza.manus.space`,
    push: { title: "\u{1F355} Sentimos sua falta!", body: "5% OFF no seu pr\xF3ximo pedido \u2014 v\xE1lido 72h" }
  },
  inativo_30: {
    title: "Oferta especial para voc\xEA",
    whatsapp: (name, coupon) => `${name}, temos uma oferta especial para voc\xEA! \u{1F381}

Sabemos que faz um tempinho que voc\xEA n\xE3o pede na Bonatto Pizza. Que tal voltar com *10% de desconto*?

\u{1F39F}\uFE0F Cupom exclusivo: *${coupon}*

\u23F0 Oferta por tempo limitado!

\u{1F449} https://bonattopizza.manus.space`,
    push: { title: "\u{1F381} 10% OFF \u2014 Oferta exclusiva!", body: "Volte a pedir com desconto especial" }
  },
  inativo_60: {
    title: "Voltamos para voc\xEA!",
    whatsapp: (name, coupon) => `${name}! \u{1F622}

A gente sente muito a sua falta na Bonatto Pizza.

Para te receber de volta, preparamos um cupom especial de *15% de desconto*:

\u{1F39F}\uFE0F *${coupon}*

\u{1F355} Novidades no card\xE1pio te esperam!

\u{1F449} https://bonattopizza.manus.space`,
    push: { title: "\u{1F622} Voltamos para voc\xEA! 15% OFF", body: "Cupom especial de 15% para seu retorno" }
  }
};
async function processReactivation() {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const segments = [
    { tag: "inativo_15", type: "reactivation_15d", discount: 5, validHours: 72 },
    { tag: "inativo_30", type: "reactivation_30d", discount: 10, validHours: 48 },
    { tag: "inativo_60", type: "reactivation_60d", discount: 15, validHours: 24 }
  ];
  for (const segment of segments) {
    const taggedUsers = await db.select({ userId: customerTags.userId, assignedAt: customerTags.assignedAt }).from(customerTags).where(eq3(customerTags.tag, segment.tag)).limit(30);
    for (const tagged of taggedUsers) {
      const recentlySent = await db.select({ id: automationEvents.id }).from(automationEvents).where(
        and3(
          eq3(automationEvents.type, segment.type),
          eq3(automationEvents.userId, tagged.userId),
          gte2(automationEvents.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3))
        )
      ).limit(1);
      if (recentlySent.length > 0) continue;
      const userRows = await db.select().from(users).where(eq3(users.id, tagged.userId)).limit(1);
      if (userRows.length === 0) continue;
      const user = userRows[0];
      const phone = user.phone ?? "";
      if (!phone) continue;
      const suffix = `${user.id}-${segment.tag.replace("_", "")}`;
      const couponCode = await generateRecoveryCoupon(db, user.id, segment.discount, suffix);
      const name = user.name ?? "cliente";
      const tagToEvent = {
        inativo_15: "reactivation_15",
        inativo_30: "reactivation_30",
        inativo_60: "reactivation_60"
      };
      const templateEvent = tagToEvent[segment.tag] ?? "reactivation_15";
      const interpolate = (t2) => t2.replace(/\{\{clientName\}\}/g, name).replace(/\{\{coupon\}\}/g, couponCode);
      const waTpl = await pickRandomTemplate(templateEvent, "whatsapp");
      const copy = REACTIVATION_COPY[segment.tag];
      const waMsg = waTpl ? interpolate(waTpl.body) : copy ? copy.whatsapp(name, couponCode) : "";
      if (waMsg) {
        await sendWhatsApp(phone, waMsg);
        await logAutomationEvent(db, { type: segment.type, userId: user.id, channel: "whatsapp", step: 1, status: "sent", metadata: { couponCode, tag: segment.tag } });
      }
      const pushTpl = await pickRandomTemplate(templateEvent, "push");
      const pushTitle = pushTpl ? interpolate(pushTpl.title) : copy?.push.title ?? "\u{1F355} Sentimos sua falta!";
      const pushBody = pushTpl ? interpolate(pushTpl.body) : copy?.push.body ?? "Temos uma oferta especial para voc\xEA!";
      await sendPushToUser(user.id, { title: pushTitle, body: pushBody, url: "/" });
      await logAutomationEvent(db, { type: segment.type, userId: user.id, channel: "push", step: 1, status: "sent", metadata: { couponCode, tag: segment.tag } });
      await fireJourneyTrigger(segment.tag, user.id, phone);
      console.log(`[Reactivation] Enviado para userId=${user.id} (${segment.tag}) cupom=${couponCode}`);
    }
  }
}
async function markConversions(userId, orderId) {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  await markCartRecovered(userId);
  await db.update(journeyExecutions).set({ convertedAt: now, conversionOrderId: orderId, status: "completed", completedAt: now }).where(and3(eq3(journeyExecutions.userId, userId), eq3(journeyExecutions.status, "running")));
  await db.insert(automationEvents).values({
    type: "conversion",
    userId,
    orderId,
    channel: "whatsapp",
    step: 0,
    status: "converted",
    createdAt: now
  });
}

// server/automationWebhook.ts
async function handleAutomationWebhook(req, res) {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ error: "Token ausente" });
  }
  const dbConn = await getDb();
  if (!dbConn) return res.status(503).json({ error: "Banco de dados indispon\xEDvel" });
  const [journey] = await dbConn.select().from(journeys).where(eq4(journeys.webhookToken, token)).limit(1);
  if (!journey) {
    return res.status(404).json({ error: "Jornada n\xE3o encontrada" });
  }
  if (journey.status !== "active") {
    return res.status(422).json({ error: "Jornada inativa" });
  }
  let steps = [];
  try {
    steps = JSON.parse(journey.steps ?? "[]");
  } catch {
    steps = [];
  }
  const webhookStep = steps.find((s) => s.type === "webhook");
  const incomingSecret = req.headers["x-webhook-secret"] ?? "";
  const globalSecret = process.env.AUTOMATION_WEBHOOK_SECRET ?? "";
  if (process.env.NODE_ENV === "production") {
    const expected = webhookStep?.secret ?? globalSecret;
    if (!expected) {
      console.error(`[Webhook] Jornada ${journey.id} sem secret configurado em produ\xE7\xE3o \u2014 rejeitando.`);
      return res.status(403).json({ error: "Webhook n\xE3o configurado. Defina AUTOMATION_WEBHOOK_SECRET ou um secret na jornada." });
    }
    if (incomingSecret !== expected) {
      return res.status(401).json({ error: "Secret inv\xE1lido" });
    }
  } else if (webhookStep?.secret) {
    if (incomingSecret !== webhookStep.secret) {
      return res.status(401).json({ error: "Secret inv\xE1lido" });
    }
  } else if (globalSecret) {
    if (incomingSecret !== globalSecret) {
      return res.status(401).json({ error: "Secret inv\xE1lido" });
    }
  }
  const body = req.body;
  console.log(`[Webhook] Jornada "${journey.name}" (id=${journey.id}) disparada via webhook`, {
    phone: body.phone,
    name: body.name,
    metadata: body.metadata,
    ip: req.ip,
    at: (/* @__PURE__ */ new Date()).toISOString()
  });
  let userId = null;
  if (body.phone) {
    const cleanPhone = body.phone.replace(/\D/g, "");
    const [userRow] = await dbConn.select({ id: users.id }).from(users).where(eq4(users.phone, cleanPhone)).limit(1);
    if (userRow) userId = userRow.id;
  }
  let executionId = -1;
  if (userId) {
    executionId = await startJourneyExecution(
      journey.id,
      userId,
      body.phone,
      body.metadata
    );
  } else {
    console.warn(`[Webhook] Nenhum usu\xE1rio encontrado para phone=${body.phone}. Jornada n\xE3o executada.`);
  }
  return res.json({
    ok: true,
    journey: journey.name,
    executionId,
    message: userId ? "Webhook recebido e jornada iniciada com sucesso." : "Webhook recebido, mas nenhum usu\xE1rio encontrado para o telefone informado.",
    receivedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}

// server/_core/apiApp.ts
init_db();

// server/routers.ts
init_db();
init_schema();
import { TRPCError as TRPCError7 } from "@trpc/server";
import { eq as eq12, gte as gte4, desc as desc3, inArray as inArray4, and as and9, isNotNull as isNotNull2, lte as lte3 } from "drizzle-orm";

// server/routers/club.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { and as and4, eq as eq5, isNotNull, lte as lte2 } from "drizzle-orm";
import { z as z2 } from "zod";
init_db();

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var DEFAULT_SESSION_MS = 1e3 * 60 * 60 * 24 * 30;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Fa\xE7a login para continuar (10001)";
var NOT_ADMIN_ERR_MSG = "Voc\xEA n\xE3o tem permiss\xE3o para executar esta a\xE7\xE3o (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
function isPlatformAdmin(role) {
  return role === "admin";
}
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !isPlatformAdmin(ctx.user.role)) {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var staffProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !isPlatformAdmin(ctx.user.role) && ctx.user.role !== "manager") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        isOwner: isPlatformAdmin(ctx.user.role)
      }
    });
  })
);

// server/routers/club.ts
init_schema();

// server/lib/club-config.ts
init_db();
var DEFAULT_CLUB_CONFIG = {
  badgeLabel: "Clube do Bonatto",
  sectionTitle: "Assine, economize e ganhe pizza todo m\xEAs.",
  sectionSubtitle: "Cliente fiel merece mais. Escolha seu plano e fa\xE7a parte do clube.",
  ctaLabel: "Assinar agora via PIX",
  disclaimer: "Cancele quando quiser \u2022 Pagamento via PIX \u2022 Ativa\xE7\xE3o ap\xF3s confirma\xE7\xE3o",
  highlightItems: [
    "Pizza gr\xE1tis mensal",
    "At\xE9 20% de desconto",
    "Entrega gr\xE1tis no plano premium",
    "Cancele quando quiser"
  ],
  checkoutTitle: "Benef\xEDcios do seu clube",
  checkoutSubtitle: "Seu plano ativo entra automaticamente no total deste pedido.",
  checkoutDiscountLabel: "Desconto do clube",
  checkoutDeliveryLabel: "Entrega gr\xE1tis do clube",
  checkoutFreePizzaLabel: "Pizza gr\xE1tis dispon\xEDvel para o pr\xF3ximo pedido.",
  profileGuestTitle: "Voc\xEA ainda n\xE3o \xE9 membro",
  profileGuestSubtitle: "Assine o Clube do Bonatto e tenha descontos exclusivos, entrega gr\xE1tis e uma pizza gr\xE1tis todo m\xEAs!",
  profileBenefitsTitle: "Seus benef\xEDcios",
  profilePrimaryActionLabel: "Fazer pedido com desconto",
  successTitle: "Bem-vindo ao Clube!",
  successSubtitle: "Seu plano foi ativado. Aproveite todos os benef\xEDcios exclusivos do Clube do Bonatto!",
  popularPlanId: "bonattao",
  plans: [
    {
      id: "basico",
      name: "F\xE3 Bonatto",
      badge: "Entrada",
      price: 9.99,
      discountPercent: 15,
      freeDelivery: false,
      freePizzaPerMonth: true,
      description: "Entrou para o time. Agora \xE9 da fam\xEDlia.",
      benefits: [
        "15% de desconto em todos os pedidos",
        "1 pizza gr\xE1tis por m\xEAs",
        "Acesso a promo\xE7\xF5es exclusivas"
      ]
    },
    {
      id: "bonattao",
      name: "S\xF3cio Bonatto",
      badge: "Mais popular",
      price: 19,
      discountPercent: 20,
      freeDelivery: true,
      freePizzaPerMonth: true,
      description: "Voc\xEA n\xE3o pede pizza. Voc\xEA pede Bonatto.",
      benefits: [
        "20% de desconto em todos os pedidos",
        "Entrega sempre gr\xE1tis",
        "1 pizza gr\xE1tis por m\xEAs",
        "Acesso VIP a lan\xE7amentos e promo\xE7\xF5es"
      ]
    }
  ]
};
var CLUB_CONFIG_KEY = "clubConfig";
function repairClubText(value) {
  let repaired = value.trim();
  if (/[ÃƒÃ¢]/.test(repaired)) {
    try {
      const decoded = Buffer.from(repaired, "latin1").toString("utf8");
      if (decoded && !decoded.includes("\uFFFD")) {
        repaired = decoded;
      }
    } catch {
    }
  }
  const replacements = [
    [/fam\?lia/gi, "fam\xEDlia"],
    [/\/m\?s/gi, "/m\xEAs"],
    [/grtis/gi, "gr\xE1tis"],
    [/promo\?\?es/gi, "promo\xE7\xF5es"],
    [/lan\?amentos/gi, "lan\xE7amentos"],
    [/S\?cio/gi, "S\xF3cio"],
    [/Ativa\?\?o/gi, "Ativa\xE7\xE3o"],
    [/fa\?a/gi, "fa\xE7a"],
    [/m\?s/gi, "m\xEAs"],
    [/n\?o/gi, "n\xE3o"],
    [/Voc\?/gi, "Voc\xEA"]
  ];
  for (const [pattern, replacement] of replacements) {
    repaired = repaired.replace(pattern, replacement);
  }
  return repaired;
}
function normalizeBenefitList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.map((item) => typeof item === "string" ? repairClubText(item) : "").filter(Boolean);
  return normalized.length ? normalized : fallback;
}
function normalizeConfigList(value, fallback) {
  return normalizeBenefitList(value, fallback);
}
function normalizePlanId(value, fallback) {
  return value === "bonattao" || value === "basico" ? value : fallback;
}
function normalizePlan(input, fallback) {
  if (!input || typeof input !== "object") return fallback;
  const plan = input;
  return {
    id: normalizePlanId(plan.id, fallback.id),
    name: typeof plan.name === "string" && plan.name.trim() ? repairClubText(plan.name) : fallback.name,
    badge: typeof plan.badge === "string" && plan.badge.trim() ? repairClubText(plan.badge) : fallback.badge,
    price: typeof plan.price === "number" && Number.isFinite(plan.price) ? plan.price : fallback.price,
    discountPercent: typeof plan.discountPercent === "number" && Number.isFinite(plan.discountPercent) ? plan.discountPercent : fallback.discountPercent,
    freeDelivery: typeof plan.freeDelivery === "boolean" ? plan.freeDelivery : fallback.freeDelivery,
    freePizzaPerMonth: typeof plan.freePizzaPerMonth === "boolean" ? plan.freePizzaPerMonth : fallback.freePizzaPerMonth,
    description: typeof plan.description === "string" && plan.description.trim() ? repairClubText(plan.description) : fallback.description,
    benefits: normalizeBenefitList(plan.benefits, fallback.benefits)
  };
}
function normalizeConfig(input) {
  if (!input || typeof input !== "object") return DEFAULT_CLUB_CONFIG;
  const raw = input;
  const fallbackPlansById = Object.fromEntries(
    DEFAULT_CLUB_CONFIG.plans.map((plan) => [plan.id, plan])
  );
  const providedPlans = Array.isArray(raw.plans) ? raw.plans : [];
  const normalizedPlans = ["basico", "bonattao"].map((planId) => {
    const provided = providedPlans.find(
      (plan) => plan && typeof plan === "object" && plan.id === planId
    );
    return normalizePlan(provided, fallbackPlansById[planId]);
  });
  return {
    badgeLabel: typeof raw.badgeLabel === "string" && raw.badgeLabel.trim() ? repairClubText(raw.badgeLabel) : DEFAULT_CLUB_CONFIG.badgeLabel,
    sectionTitle: typeof raw.sectionTitle === "string" && raw.sectionTitle.trim() ? repairClubText(raw.sectionTitle) : DEFAULT_CLUB_CONFIG.sectionTitle,
    sectionSubtitle: typeof raw.sectionSubtitle === "string" && raw.sectionSubtitle.trim() ? repairClubText(raw.sectionSubtitle) : DEFAULT_CLUB_CONFIG.sectionSubtitle,
    ctaLabel: typeof raw.ctaLabel === "string" && raw.ctaLabel.trim() ? repairClubText(raw.ctaLabel) : DEFAULT_CLUB_CONFIG.ctaLabel,
    disclaimer: typeof raw.disclaimer === "string" && raw.disclaimer.trim() ? repairClubText(raw.disclaimer) : DEFAULT_CLUB_CONFIG.disclaimer,
    highlightItems: normalizeConfigList(raw.highlightItems, DEFAULT_CLUB_CONFIG.highlightItems),
    checkoutTitle: typeof raw.checkoutTitle === "string" && raw.checkoutTitle.trim() ? repairClubText(raw.checkoutTitle) : DEFAULT_CLUB_CONFIG.checkoutTitle,
    checkoutSubtitle: typeof raw.checkoutSubtitle === "string" && raw.checkoutSubtitle.trim() ? repairClubText(raw.checkoutSubtitle) : DEFAULT_CLUB_CONFIG.checkoutSubtitle,
    checkoutDiscountLabel: typeof raw.checkoutDiscountLabel === "string" && raw.checkoutDiscountLabel.trim() ? repairClubText(raw.checkoutDiscountLabel) : DEFAULT_CLUB_CONFIG.checkoutDiscountLabel,
    checkoutDeliveryLabel: typeof raw.checkoutDeliveryLabel === "string" && raw.checkoutDeliveryLabel.trim() ? repairClubText(raw.checkoutDeliveryLabel) : DEFAULT_CLUB_CONFIG.checkoutDeliveryLabel,
    checkoutFreePizzaLabel: typeof raw.checkoutFreePizzaLabel === "string" && raw.checkoutFreePizzaLabel.trim() ? repairClubText(raw.checkoutFreePizzaLabel) : DEFAULT_CLUB_CONFIG.checkoutFreePizzaLabel,
    profileGuestTitle: typeof raw.profileGuestTitle === "string" && raw.profileGuestTitle.trim() ? repairClubText(raw.profileGuestTitle) : DEFAULT_CLUB_CONFIG.profileGuestTitle,
    profileGuestSubtitle: typeof raw.profileGuestSubtitle === "string" && raw.profileGuestSubtitle.trim() ? repairClubText(raw.profileGuestSubtitle) : DEFAULT_CLUB_CONFIG.profileGuestSubtitle,
    profileBenefitsTitle: typeof raw.profileBenefitsTitle === "string" && raw.profileBenefitsTitle.trim() ? repairClubText(raw.profileBenefitsTitle) : DEFAULT_CLUB_CONFIG.profileBenefitsTitle,
    profilePrimaryActionLabel: typeof raw.profilePrimaryActionLabel === "string" && raw.profilePrimaryActionLabel.trim() ? repairClubText(raw.profilePrimaryActionLabel) : DEFAULT_CLUB_CONFIG.profilePrimaryActionLabel,
    successTitle: typeof raw.successTitle === "string" && raw.successTitle.trim() ? repairClubText(raw.successTitle) : DEFAULT_CLUB_CONFIG.successTitle,
    successSubtitle: typeof raw.successSubtitle === "string" && raw.successSubtitle.trim() ? repairClubText(raw.successSubtitle) : DEFAULT_CLUB_CONFIG.successSubtitle,
    popularPlanId: normalizePlanId(raw.popularPlanId, DEFAULT_CLUB_CONFIG.popularPlanId),
    plans: normalizedPlans
  };
}
async function getClubConfig() {
  const stored = await getStoreSetting(CLUB_CONFIG_KEY);
  if (!stored) return DEFAULT_CLUB_CONFIG;
  try {
    return normalizeConfig(JSON.parse(stored));
  } catch {
    return DEFAULT_CLUB_CONFIG;
  }
}
async function saveClubConfig(config) {
  const normalized = normalizeConfig(config);
  await setStoreSetting(CLUB_CONFIG_KEY, JSON.stringify(normalized));
}
async function getClubPlanConfig(planId) {
  if (planId !== "bonattao" && planId !== "basico") return null;
  const config = await getClubConfig();
  return config.plans.find((plan) => plan.id === planId) ?? null;
}

// server/lib/payment-config.ts
init_db();
import { z } from "zod";
var PAYMENT_CONFIG_KEY = "paymentConfig";
var paymentConfigSchema = z.object({
  orders: z.object({
    onlineEnabled: z.boolean().default(true),
    cardEnabled: z.boolean().default(true),
    pixEnabled: z.boolean().default(true),
    cashEnabled: z.boolean().default(true),
    pixMode: z.enum(["dynamic_asaas", "manual_key"]).default("dynamic_asaas"),
    savedCardsEnabled: z.boolean().default(true)
  }).default({
    onlineEnabled: true,
    cardEnabled: true,
    pixEnabled: true,
    cashEnabled: true,
    pixMode: "dynamic_asaas",
    savedCardsEnabled: true
  }),
  club: z.object({
    enabled: z.boolean().default(true),
    checkoutMode: z.enum(["manual_pix"]).default("manual_pix")
  }).default({
    enabled: true,
    checkoutMode: "manual_pix"
  }),
  pix: z.object({
    merchantName: z.string().trim().min(2).max(25).default("Bonatto Pizza"),
    merchantCity: z.string().trim().min(2).max(15).default("MATEUS LEME"),
    instructions: z.string().trim().max(300).default("")
  }).default({
    merchantName: "Bonatto Pizza",
    merchantCity: "MATEUS LEME",
    instructions: ""
  })
});
var DEFAULT_PAYMENT_CONFIG = paymentConfigSchema.parse({});
function normalizePaymentConfig(raw) {
  if (!raw) return DEFAULT_PAYMENT_CONFIG;
  if (typeof raw === "string") {
    try {
      return paymentConfigSchema.parse(JSON.parse(raw));
    } catch {
      return DEFAULT_PAYMENT_CONFIG;
    }
  }
  return paymentConfigSchema.parse(raw);
}
function getPaymentRuntimeStatus(pixKey) {
  const publicAppUrl = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeWebhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const asaasReady = Boolean(process.env.ASAAS_API_KEY?.trim());
  const manualPixReady = Boolean(pixKey.trim());
  return {
    publicAppUrl,
    stripeReady,
    stripeWebhookReady,
    asaasReady,
    manualPixReady,
    stripeWebhookUrl: publicAppUrl ? `${publicAppUrl}/api/stripe/webhook` : "",
    asaasWebhookUrl: publicAppUrl ? `${publicAppUrl}/api/asaas/webhook` : ""
  };
}
function getPaymentAvailability(config, runtime) {
  const cardReady = config.orders.onlineEnabled && config.orders.cardEnabled && runtime.stripeReady;
  const pixReady = config.orders.pixEnabled && (config.orders.pixMode === "dynamic_asaas" && runtime.asaasReady || config.orders.pixMode === "manual_key" && runtime.manualPixReady);
  return {
    orders: {
      card: cardReady,
      pix: pixReady,
      cash: config.orders.cashEnabled,
      savedCards: cardReady && config.orders.savedCardsEnabled,
      pixMode: config.orders.pixMode
    },
    club: {
      enabled: config.club.enabled && config.club.checkoutMode === "manual_pix" && runtime.manualPixReady,
      checkoutMode: config.club.checkoutMode
    }
  };
}
async function getPaymentSettingsAdmin() {
  const settings = await getAllStoreSettings();
  const config = normalizePaymentConfig(settings[PAYMENT_CONFIG_KEY]);
  const pixKey = settings.pixKey ?? "";
  const runtime = getPaymentRuntimeStatus(pixKey);
  const availability = getPaymentAvailability(config, runtime);
  return {
    config,
    pixKey,
    runtime,
    availability
  };
}
async function getPaymentSettingsPublic() {
  const { config, runtime, availability } = await getPaymentSettingsAdmin();
  return {
    config: {
      orders: {
        cashEnabled: availability.orders.cash,
        cardEnabled: availability.orders.card,
        pixEnabled: availability.orders.pix,
        savedCardsEnabled: availability.orders.savedCards,
        pixMode: availability.orders.pixMode
      },
      club: {
        enabled: availability.club.enabled,
        checkoutMode: availability.club.checkoutMode
      },
      pix: {
        instructions: config.pix.instructions
      }
    },
    runtime: {
      stripeReady: runtime.stripeReady,
      asaasReady: runtime.asaasReady,
      manualPixReady: runtime.manualPixReady
    }
  };
}
async function savePaymentSettings(input) {
  await setStoreSetting(PAYMENT_CONFIG_KEY, JSON.stringify(input.config));
  await setStoreSetting("pixKey", input.pixKey.trim());
}

// server/lib/pix.ts
function generatePixCode(pixKey, merchantName, amount, txId, merchantCity = "MATEUS LEME") {
  function field(id, value) {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  }
  const gui = field("00", "BR.GOV.BCB.PIX");
  const key = field("01", pixKey);
  const merchantAccountInfo = field("26", gui + key);
  const mcc = field("52", "0000");
  const currency = field("53", "986");
  const amountStr = field("54", amount.toFixed(2));
  const country = field("58", "BR");
  const name = field("59", merchantName.substring(0, 25));
  const city = field("60", merchantCity.substring(0, 15).toUpperCase());
  const txIdField = field("05", txId.substring(0, 25));
  const additionalData = field("62", txIdField);
  const payload = "000201" + merchantAccountInfo + mcc + currency + amountStr + country + name + city + additionalData + "6304";
  let crc = 65535;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if (crc & 32768) {
        crc = crc << 1 ^ 4129;
      } else {
        crc <<= 1;
      }
      crc &= 65535;
    }
  }
  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}
function generatePixQrCodeUrl(pixCode) {
  const encoded = encodeURIComponent(pixCode);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
}

// server/routers/club.ts
var adminProcedure2 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});
var clubPlanSchema = z2.object({
  id: z2.enum(["bonattao", "basico"]),
  name: z2.string().min(1).max(80),
  badge: z2.string().min(1).max(40),
  price: z2.number().min(0),
  discountPercent: z2.number().min(0).max(100),
  freeDelivery: z2.boolean(),
  freePizzaPerMonth: z2.boolean(),
  description: z2.string().min(1).max(180),
  benefits: z2.array(z2.string().min(1).max(160)).min(1).max(8)
});
var clubConfigSchema = z2.object({
  badgeLabel: z2.string().min(1).max(80),
  sectionTitle: z2.string().min(1).max(80),
  sectionSubtitle: z2.string().min(1).max(180),
  ctaLabel: z2.string().min(1).max(80),
  disclaimer: z2.string().min(1).max(180),
  highlightItems: z2.array(z2.string().min(1).max(120)).min(1).max(8),
  checkoutTitle: z2.string().min(1).max(80),
  checkoutSubtitle: z2.string().min(1).max(180),
  checkoutDiscountLabel: z2.string().min(1).max(80),
  checkoutDeliveryLabel: z2.string().min(1).max(80),
  checkoutFreePizzaLabel: z2.string().min(1).max(120),
  profileGuestTitle: z2.string().min(1).max(80),
  profileGuestSubtitle: z2.string().min(1).max(180),
  profileBenefitsTitle: z2.string().min(1).max(80),
  profilePrimaryActionLabel: z2.string().min(1).max(80),
  successTitle: z2.string().min(1).max(80),
  successSubtitle: z2.string().min(1).max(180),
  popularPlanId: z2.enum(["bonattao", "basico"]),
  plans: z2.array(clubPlanSchema).length(2)
});
function ensureClubPlanIds(config) {
  return config.plans.map((plan) => plan.id);
}
var clubRouter = router({
  getPlans: publicProcedure.query(async () => {
    const config = await getClubConfig();
    return config.plans;
  }),
  getPublicConfig: publicProcedure.query(async () => {
    return getClubConfig();
  }),
  getAdminConfig: adminProcedure2.query(async () => {
    return getClubConfig();
  }),
  saveAdminConfig: adminProcedure2.input(clubConfigSchema).mutation(async ({ input }) => {
    const ids = ensureClubPlanIds(input);
    if (!ids.includes("bonattao") || !ids.includes("basico")) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Os dois planos base precisam existir." });
    }
    await saveClubConfig(input);
    return { ok: true };
  }),
  getMyPlan: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    const userRows = await db.select().from(users).where(eq5(users.id, ctx.user.id)).limit(1);
    if (!userRows[0]) return null;
    const user = userRows[0];
    if (!user.clubPlan || !user.clubStatus) return null;
    const planDetails = await getClubPlanConfig(user.clubPlan);
    return {
      plan: user.clubPlan,
      status: user.clubStatus,
      startDate: user.clubStartDate,
      nextBillingDate: user.clubNextBillingDate,
      freePizzaUsed: user.clubFreePizzaUsed,
      freePizzaResetAt: user.clubFreePizzaResetAt,
      planDetails
    };
  }),
  subscribe: protectedProcedure.input(z2.object({ plan: z2.enum(["bonattao", "basico"]) })).mutation(async ({ input, ctx }) => {
    const planDetails = await getClubPlanConfig(input.plan);
    if (!planDetails) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Plano de assinatura inv\xE1lido." });
    }
    const paymentSettings = await getPaymentSettingsAdmin();
    if (!paymentSettings.availability.club.enabled) {
      throw new TRPCError3({
        code: "PRECONDITION_FAILED",
        message: "Os pagamentos do clube ainda n\xE3o foram configurados."
      });
    }
    const pixKey = paymentSettings.pixKey.trim();
    if (!pixKey) {
      throw new TRPCError3({
        code: "PRECONDITION_FAILED",
        message: "Configure a chave PIX na aba de pagamentos do admin."
      });
    }
    const txId = `CLUBE${ctx.user.id}${Date.now()}`.substring(0, 25);
    const pixCode = generatePixCode(
      pixKey,
      paymentSettings.config.pix.merchantName,
      planDetails.price,
      txId,
      paymentSettings.config.pix.merchantCity
    );
    const pixQrCode = generatePixQrCodeUrl(pixCode);
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db.insert(clubPayments).values({
      userId: ctx.user.id,
      plan: input.plan,
      amount: planDetails.price.toFixed(2),
      pixCode,
      pixQrCode,
      status: "pending"
    });
    const paymentId = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.insertId ?? result[0]?.insertId ?? 0
    );
    await db.update(users).set({ clubPlan: input.plan, clubStatus: "pending" }).where(eq5(users.id, ctx.user.id));
    return {
      paymentId,
      pixCode,
      pixQrCode,
      amount: planDetails.price,
      plan: planDetails
    };
  }),
  checkPayment: protectedProcedure.input(z2.object({ paymentId: z2.number() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    const payment = await db.select().from(clubPayments).where(and4(eq5(clubPayments.id, input.paymentId), eq5(clubPayments.userId, ctx.user.id))).limit(1);
    if (!payment[0]) throw new TRPCError3({ code: "NOT_FOUND" });
    return { status: payment[0].status };
  }),
  confirmPayment: adminProcedure2.input(z2.object({ paymentId: z2.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    const payment = await db.select().from(clubPayments).where(eq5(clubPayments.id, input.paymentId)).limit(1);
    if (!payment[0]) throw new TRPCError3({ code: "NOT_FOUND" });
    const now = /* @__PURE__ */ new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    await db.update(clubPayments).set({ status: "paid", paidAt: now }).where(eq5(clubPayments.id, input.paymentId));
    await db.update(users).set({
      clubStatus: "active",
      clubStartDate: now,
      clubNextBillingDate: nextBilling,
      clubFreePizzaUsed: false,
      clubFreePizzaResetAt: nextBilling
    }).where(eq5(users.id, payment[0].userId));
    const activatedUser = await db.select({ id: users.id, phone: users.phone }).from(users).where(eq5(users.id, payment[0].userId)).limit(1);
    if (activatedUser[0]) {
      fireJourneyTrigger("club_subscriber", activatedUser[0].id, activatedUser[0].phone ?? void 0).catch(
        (error) => console.error("[Club] club_subscriber trigger failed", error)
      );
    }
    return { ok: true };
  }),
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(users).set({
      clubStatus: "cancelled",
      clubPlan: null,
      clubNextBillingDate: null
    }).where(eq5(users.id, ctx.user.id));
    return { ok: true };
  }),
  useFreePizza: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    const userRows = await db.select().from(users).where(eq5(users.id, ctx.user.id)).limit(1);
    if (!userRows[0]) throw new TRPCError3({ code: "NOT_FOUND" });
    const user = userRows[0];
    if (user.clubStatus !== "active") {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Voc\xEA n\xE3o \xE9 membro ativo do clube." });
    }
    const plan = await getClubPlanConfig(user.clubPlan);
    if (!plan?.freePizzaPerMonth) {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Seu plano n\xE3o inclui pizza gr\xE1tis por m\xEAs." });
    }
    const now = /* @__PURE__ */ new Date();
    if (user.clubFreePizzaUsed && user.clubFreePizzaResetAt && now > user.clubFreePizzaResetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await db.update(users).set({ clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset }).where(and4(eq5(users.id, ctx.user.id), lte2(users.clubFreePizzaResetAt, now)));
    }
    const result = await db.update(users).set({ clubFreePizzaUsed: true }).where(and4(eq5(users.id, ctx.user.id), eq5(users.clubStatus, "active"), eq5(users.clubFreePizzaUsed, false)));
    const mutationResult = result;
    const affectedRows = mutationResult?.rowsAffected ?? mutationResult?.[0]?.affectedRows ?? 0;
    if (!affectedRows) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Voc\xEA j\xE1 usou sua pizza gr\xE1tis neste m\xEAs." });
    }
    return { ok: true };
  }),
  getMembers: adminProcedure2.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const members = await db.select().from(users).where(isNotNull(users.clubPlan));
    return members.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      clubPlan: user.clubPlan,
      clubStatus: user.clubStatus,
      clubStartDate: user.clubStartDate,
      clubNextBillingDate: user.clubNextBillingDate,
      clubFreePizzaUsed: user.clubFreePizzaUsed
    }));
  }),
  getPendingPayments: adminProcedure2.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: clubPayments.id,
      userId: clubPayments.userId,
      plan: clubPayments.plan,
      amount: clubPayments.amount,
      pixCode: clubPayments.pixCode,
      status: clubPayments.status,
      createdAt: clubPayments.createdAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone
    }).from(clubPayments).leftJoin(users, eq5(clubPayments.userId, users.id)).where(eq5(clubPayments.status, "pending"));
  }),
  sendPromotion: adminProcedure2.input(z2.object({ message: z2.string().min(1).max(1e3) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
    const members = await db.select({ phone: users.phone, name: users.name }).from(users).where(and4(isNotNull(users.clubPlan), eq5(users.clubStatus, "active")));
    let sent = 0;
    let failed = 0;
    for (const member of members) {
      if (!member.phone) continue;
      try {
        await sendWhatsApp(member.phone, `Clube do Bonatto

${input.message}`);
        sent++;
      } catch {
        failed++;
      }
    }
    return { sent, failed, total: members.length };
  })
});

// server/routers/stores.ts
import { z as z3 } from "zod";
init_db();
init_schema();
import { eq as eq6, and as and5, desc as desc2 } from "drizzle-orm";
import { TRPCError as TRPCError4 } from "@trpc/server";
var storesRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      city: stores.city,
      address: stores.address,
      phone: stores.phone,
      isDefault: stores.isDefault
    }).from(stores).where(eq6(stores.active, true)).orderBy(desc2(stores.isDefault), stores.city);
  }),
  getBySlug: publicProcedure.input(z3.object({ slug: z3.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const [store] = await db.select().from(stores).where(and5(eq6(stores.slug, input.slug), eq6(stores.active, true))).limit(1);
    if (!store) throw new TRPCError4({ code: "NOT_FOUND", message: "Loja nao encontrada" });
    return store;
  }),
  listAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(stores).orderBy(desc2(stores.isDefault), stores.city);
  }),
  create: adminProcedure.input(z3.object({
    name: z3.string().min(2).max(200),
    slug: z3.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
    city: z3.string().min(2).max(100),
    address: z3.string().max(500).optional(),
    phone: z3.string().max(20).optional(),
    active: z3.boolean().default(true),
    isDefault: z3.boolean().default(false)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    if (input.isDefault) {
      await db.update(stores).set({ isDefault: false });
    }
    const [result] = await db.insert(stores).values({
      name: input.name,
      slug: input.slug,
      city: input.city,
      address: input.address,
      phone: input.phone,
      active: input.active,
      isDefault: input.isDefault
    });
    return { id: result.insertId, ...input };
  }),
  update: adminProcedure.input(z3.object({
    id: z3.number(),
    name: z3.string().min(2).max(200).optional(),
    slug: z3.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
    city: z3.string().min(2).max(100).optional(),
    address: z3.string().max(500).optional(),
    phone: z3.string().max(20).optional(),
    active: z3.boolean().optional(),
    isDefault: z3.boolean().optional(),
    cnpj: z3.string().max(18).optional().nullable(),
    inscricaoEstadual: z3.string().max(30).optional().nullable(),
    regimeTributario: z3.number().int().min(1).max(3).optional().nullable(),
    csc: z3.string().max(100).optional().nullable(),
    cscId: z3.string().max(20).optional().nullable(),
    focusNfeToken: z3.string().max(200).optional().nullable(),
    nfceEnabled: z3.boolean().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    if (data.isDefault) {
      await db.update(stores).set({ isDefault: false });
    }
    await db.update(stores).set(data).where(eq6(stores.id, id));
    return { success: true };
  }),
  delete: adminProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const [store] = await db.select().from(stores).where(eq6(stores.id, input.id)).limit(1);
    if (!store) throw new TRPCError4({ code: "NOT_FOUND", message: "Loja nao encontrada" });
    if (store.isDefault) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Defina outra loja padrao antes de desativar esta unidade." });
    }
    await db.update(stores).set({ active: false }).where(eq6(stores.id, input.id));
    await db.update(staffMembers).set({ active: false }).where(eq6(staffMembers.storeId, input.id));
    await db.update(drivers).set({ active: false }).where(eq6(drivers.storeId, input.id));
    await db.update(diningTables).set({ active: false, status: "free" }).where(eq6(diningTables.storeId, input.id));
    return { success: true };
  }),
  addManager: adminProcedure.input(z3.object({
    storeId: z3.number(),
    userId: z3.number()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const [user] = await db.select().from(users).where(eq6(users.id, input.userId)).limit(1);
    if (!user) throw new TRPCError4({ code: "NOT_FOUND", message: "Usuario nao encontrado" });
    if (user.role === "user") {
      await db.update(users).set({ role: "manager" }).where(eq6(users.id, input.userId));
    }
    try {
      await db.insert(storeManagers).values({
        storeId: input.storeId,
        userId: input.userId
      });
    } catch {
    }
    return { success: true };
  }),
  removeManager: adminProcedure.input(z3.object({
    storeId: z3.number(),
    userId: z3.number()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(storeManagers).where(and5(eq6(storeManagers.storeId, input.storeId), eq6(storeManagers.userId, input.userId)));
    const remaining = await db.select().from(storeManagers).where(eq6(storeManagers.userId, input.userId)).limit(1);
    if (remaining.length === 0) {
      await db.update(users).set({ role: "user" }).where(eq6(users.id, input.userId));
    }
    return { success: true };
  }),
  getManagers: adminProcedure.input(z3.object({ storeId: z3.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: storeManagers.id,
      userId: storeManagers.userId,
      storeId: storeManagers.storeId,
      createdAt: storeManagers.createdAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      userRole: users.role
    }).from(storeManagers).innerJoin(users, eq6(storeManagers.userId, users.id)).where(eq6(storeManagers.storeId, input.storeId));
  }),
  findUserByEmail: adminProcedure.input(z3.object({ email: z3.string().email() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq6(users.email, input.email)).limit(1);
    return user ?? null;
  }),
  myStore: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null;
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      city: stores.city,
      address: stores.address,
      phone: stores.phone
    }).from(storeManagers).innerJoin(stores, eq6(storeManagers.storeId, stores.id)).where(eq6(storeManagers.userId, ctx.user.id)).limit(1);
    return row ?? null;
  })
});

// server/routers.ts
init_push();
import { z as z7 } from "zod";
init_db();
init_timezone();
init_db();

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var normalizeSessionAppId = (appId) => isNonEmptyString2(appId) ? appId : ENV.sessionAppId;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const decoded = atob(state);
    const [redirectUri] = decoded.split("|");
    if (!redirectUri) {
      throw new Error("Invalid OAuth state payload");
    }
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_FACEBOOK")) return "facebook";
    if (set.has("REGISTERED_PLATFORM_INSTAGRAM")) return "instagram";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    if (set.has("REGISTERED_PLATFORM_META")) return "facebook";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.sessionAppId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? DEFAULT_SESSION_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId)) {
        console.warn("[Auth] Session payload missing openId");
        return null;
      }
      return {
        openId,
        appId: normalizeSessionAppId(appId),
        name: typeof name === "string" ? name : ""
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None requires Secure=true; fall back to lax for HTTP (dev)
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// server/_core/systemRouter.ts
init_notification();
import { z as z4 } from "zod";

// server/dailyReport.ts
init_db();
init_schema();
import { and as and6, gte as gte3, lt as lt2 } from "drizzle-orm";
function getBrasiliaDateRange() {
  const now = /* @__PURE__ */ new Date();
  const brasiliaOffset = -3 * 60;
  const brasiliaMs = now.getTime() + brasiliaOffset * 60 * 1e3;
  const brasilia = new Date(brasiliaMs);
  const year = brasilia.getUTCFullYear();
  const month = brasilia.getUTCMonth();
  const day = brasilia.getUTCDate();
  const startBrasilia = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const startUTC = new Date(startBrasilia.getTime() - brasiliaOffset * 60 * 1e3);
  const endBrasilia = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  const endUTC = new Date(endBrasilia.getTime() - brasiliaOffset * 60 * 1e3);
  return { start: startUTC, end: endUTC };
}
async function getDailySalesData() {
  const { start, end } = getBrasiliaDateRange();
  const db = await getDb();
  if (!db) return { date: start, total: 0, delivered: 0, cancelled: 0, pending: 0, revenue: 0, deliveredRevenue: 0, avgTicket: 0, byPayment: {} };
  const rows = await db.select({
    status: orders.status,
    paymentMethod: orders.paymentMethod,
    total: orders.total,
    createdAt: orders.createdAt
  }).from(orders).where(
    and6(
      gte3(orders.createdAt, start),
      lt2(orders.createdAt, end)
    )
  );
  const typedRows = rows;
  const total = typedRows.length;
  const delivered = typedRows.filter((r) => r.status === "delivered").length;
  const cancelled = typedRows.filter((r) => r.status === "cancelled").length;
  const pending = typedRows.filter((r) => !["delivered", "cancelled"].includes(r.status ?? "")).length;
  const revenue = rows.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);
  const deliveredRevenue = rows.filter((r) => r.status === "delivered").reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);
  const byPayment = {};
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const method = r.paymentMethod ?? "outros";
    byPayment[method] = (byPayment[method] ?? 0) + 1;
  }
  const nonCancelled = rows.filter((r) => r.status !== "cancelled");
  const avgTicket = nonCancelled.length > 0 ? revenue / nonCancelled.length : 0;
  return {
    date: start,
    total,
    delivered,
    cancelled,
    pending,
    revenue,
    deliveredRevenue,
    avgTicket,
    byPayment
  };
}
function formatDailyReport(data) {
  const dateStr = data.date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const paymentLines = Object.entries(data.byPayment).map(([method, count]) => {
    const labels = {
      pix: "PIX",
      credit_card: "Cart\xE3o de Cr\xE9dito",
      debit_card: "Cart\xE3o de D\xE9bito",
      cash: "Dinheiro"
    };
    return `  \u2022 ${labels[method] ?? method}: ${count}x`;
  }).join("\n");
  return `\u{1F4CA} *Relat\xF3rio Di\xE1rio \u2014 Bonatto Pizza*
\u{1F4C5} ${dateStr}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F6D2} *Pedidos*
  \u2022 Total: *${data.total}*
  \u2022 Entregues: \u2705 ${data.delivered}
  \u2022 Cancelados: \u274C ${data.cancelled}
  \u2022 Em andamento: \u{1F504} ${data.pending}

\u{1F4B0} *Faturamento*
  \u2022 Receita total: *R$ ${data.revenue.toFixed(2).replace(".", ",")}*
  \u2022 Receita entregue: R$ ${data.deliveredRevenue.toFixed(2).replace(".", ",")}
  \u2022 Ticket m\xE9dio: R$ ${data.avgTicket.toFixed(2).replace(".", ",")}

\u{1F4B3} *Formas de Pagamento*
${paymentLines || "  \u2022 Nenhum pedido hoje"}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
_Bonatto Pizza \u2014 Sistema de Gest\xE3o_`;
}
async function sendDailyReport() {
  const phone = process.env.DAILY_REPORT_PHONE;
  if (!phone) {
    console.warn("[DailyReport] DAILY_REPORT_PHONE n\xE3o configurado. Relat\xF3rio n\xE3o enviado.");
    return;
  }
  try {
    const data = await getDailySalesData();
    const message = formatDailyReport(data);
    await sendWhatsApp(phone, message);
    console.log(`[DailyReport] Relat\xF3rio enviado para ${phone}`);
  } catch (err) {
    console.error("[DailyReport] Erro ao gerar/enviar relat\xF3rio:", err);
  }
}

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z4.object({
      timestamp: z4.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z4.object({
      title: z4.string().min(1, "title is required"),
      content: z4.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  }),
  /** Envia o relatório diário de vendas via WhatsApp imediatamente (para teste) */
  sendDailyReport: adminProcedure.mutation(async () => {
    await sendDailyReport();
    return { success: true };
  })
});

// server/storeUtils.ts
init_schema();
init_db();
import { TRPCError as TRPCError5 } from "@trpc/server";
import { eq as eq8 } from "drizzle-orm";
async function resolveStoreId(user, requestedStoreId) {
  if (user.role === "admin") {
    return requestedStoreId;
  }
  if (user.role === "manager") {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponivel" });
    }
    const [row] = await db.select({ storeId: storeManagers.storeId }).from(storeManagers).where(eq8(storeManagers.userId, user.id)).limit(1);
    if (!row) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Gerente nao esta associado a nenhuma loja. Contate o administrador."
      });
    }
    return row.storeId;
  }
  throw new TRPCError5({ code: "FORBIDDEN", message: "Acesso negado" });
}

// server/stripe.ts
init_db();
import Stripe from "stripe";
init_push();
var notifyOwner2 = (payload) => notifyOwnerAdapter({ title: payload.title, body: payload.content });
var _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe n\xE3o configurado: defina STRIPE_SECRET_KEY.");
  }
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return _stripe;
}
var stripe = new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
  }
});
async function createCheckoutSession(opts) {
  const amountInCents = Math.round(opts.amountInReais * 100);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "pix"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: opts.orderDescription ?? `Pedido #${opts.orderId} \u2014 Bonatto Pizza`,
            description: "Pizza artesanal entregue na sua porta \u{1F355}"
          },
          unit_amount: amountInCents
        },
        quantity: 1
      }
    ],
    customer_email: opts.customerEmail ?? void 0,
    client_reference_id: String(opts.orderId),
    metadata: {
      orderId: String(opts.orderId),
      ...opts.metadata
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    // Desabilita cupons Stripe-only — cupons são gerenciados pelo app Bonatto
    // para manter consistência com regras de negócio (limites, validade, clube).
    allow_promotion_codes: false,
    payment_method_options: {
      pix: { expires_after_seconds: 1800 }
    }
  });
  return session;
}
async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: "Missing signature or webhook secret" });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err?.message ?? err);
    return res.status(400).json({ error: "Invalid signature" });
  }
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }
  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);
  try {
    const first = await recordWebhookEventOnce("stripe", event.id, event.type);
    if (!first) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping.`);
      return res.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[Stripe Webhook] Failed to record event idempotency, proceeding with caution:", err);
  }
  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId ? parseInt(pi.metadata.orderId) : null;
        if (orderId) {
          await updateOrderPaymentStatus(orderId, "paid", pi.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: pi.id,
            amount: (pi.amount / 100).toFixed(2),
            currency: pi.currency,
            status: "succeeded",
            paymentMethod: "credit_card"
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId ? parseInt(pi.metadata.orderId) : null;
        if (orderId) {
          await updateOrderPaymentStatus(orderId, "failed", pi.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: pi.id,
            amount: (pi.amount / 100).toFixed(2),
            currency: pi.currency,
            status: "failed",
            paymentMethod: "credit_card"
          });
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId ? parseInt(session.metadata.orderId) : null;
        if (orderId && session.payment_status === "paid") {
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? void 0;
          const paymentMethodLabel = session.payment_method_types?.includes("pix") ? "pix" : "card";
          await updateOrderPaymentStatus(orderId, "paid", paymentIntentId, session.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: paymentIntentId ?? session.id,
            amount: ((session.amount_total ?? 0) / 100).toFixed(2),
            currency: session.currency ?? "brl",
            status: "succeeded",
            paymentMethod: paymentMethodLabel
          });
          const order = await getOrderById(orderId);
          if (order) {
            await notifyOwner2({
              title: `\u2705 Pagamento confirmado \u2014 Pedido #${orderId}`,
              content: `**Cliente:** ${order.customerName}
**Valor:** R$ ${((session.amount_total ?? 0) / 100).toFixed(2)}
**M\xE9todo:** ${paymentMethodLabel === "pix" ? "PIX" : "Cart\xE3o"}

O pedido foi automaticamente confirmado e est\xE1 aguardando preparo.`
            }).catch(console.error);
            sendPushToAdmins({
              title: `\u2705 Pagamento confirmado \u2014 Pedido #${orderId}`,
              body: `${order.customerName} pagou R$ ${((session.amount_total ?? 0) / 100).toFixed(2)} via ${paymentMethodLabel === "pix" ? "PIX" : "Cart\xE3o"}`,
              url: "/admin",
              tag: `payment-${orderId}`
            }).catch(console.error);
          }
        }
        break;
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
  return res.json({ received: true });
}
async function getOrCreateStripeCustomer(opts) {
  if (opts.stripeCustomerId) {
    return opts.stripeCustomerId;
  }
  const customer = await stripe.customers.create({
    email: opts.email ?? void 0,
    name: opts.name ?? void 0,
    metadata: { userId: String(opts.userId) }
  });
  await updateStripeCustomerId(opts.userId, customer.id);
  return customer.id;
}
async function createSetupIntent(stripeCustomerId) {
  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    usage: "off_session"
  });
}
async function listSavedCards(stripeCustomerId) {
  const pms = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card"
  });
  return pms.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "unknown",
    last4: pm.card?.last4 ?? "0000",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    funding: pm.card?.funding ?? "credit"
  }));
}
async function detachPaymentMethod(paymentMethodId) {
  return stripe.paymentMethods.detach(paymentMethodId);
}
async function createCheckoutSessionWithSavedCard(opts) {
  const amountInCents = Math.round(opts.amountInReais * 100);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: opts.stripeCustomerId,
    payment_method_types: ["card"],
    payment_method_collection: "if_required",
    saved_payment_method_options: { payment_method_save: "disabled" },
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: `Pedido #${opts.orderId} \u2014 Bonatto Pizza`,
            description: "Pizza artesanal entregue na sua porta \u{1F355}"
          },
          unit_amount: amountInCents
        },
        quantity: 1
      }
    ],
    client_reference_id: String(opts.orderId),
    metadata: {
      orderId: String(opts.orderId),
      ...opts.metadata
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl
  });
  return session;
}
async function createPaymentIntent(amountInReais, currency = "brl", metadata) {
  const amountInCents = Math.round(amountInReais * 100);
  return stripe.paymentIntents.create({
    amount: amountInCents,
    currency,
    metadata: metadata ?? {},
    automatic_payment_methods: { enabled: true }
  });
}

// server/ifood.ts
init_schema();
init_db();
import { and as and7, eq as eq9, sql as sql4 } from "drizzle-orm";
var IFOOD_BASE_URL = "https://merchant-api.ifood.com.br";
var IFOOD_SOURCE = "ifood";
var IFOOD_STATUS_MAP = {
  PLACED: "pending",
  CFM: "confirmed",
  PRP: "preparing",
  RTP: "preparing",
  COL: "out_for_delivery",
  CAN: "cancelled",
  CNC: "cancelled",
  TRB: "preparing"
};
var cachedToken = null;
var tokenExpiresAt = 0;
var ensureSchemaPromise = null;
function slugify(input) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}
function normalizeText(value, fallback) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}
function normalizePrice(value) {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
  }
  if (value && typeof value === "object" && "value" in value) {
    return normalizePrice(value.value);
  }
  return "0.00";
}
function buildImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^https?:\/\//i.test(value)) return value.trim();
  return null;
}
function isAvailableStatus(status) {
  if (!status) return true;
  return status.toUpperCase() === "AVAILABLE" || status.toUpperCase() === "ACTIVE";
}
function pickDefaultContextModifier(item) {
  return item.contextModifiers?.find((modifier) => modifier.catalogContext === "DEFAULT") ?? item.contextModifiers?.[0];
}
function resolveCatalogItemName(item) {
  return normalizeText(item.products?.[0]?.name, normalizeText(item.product?.name, normalizeText(item.name, "Item iFood")));
}
function resolveCatalogItemDescription(item) {
  return normalizeText(
    item.products?.[0]?.description,
    normalizeText(item.product?.description, normalizeText(item.description, "Sincronizado do iFood"))
  );
}
function resolveCatalogItemImage(item) {
  return buildImageUrl(item.products?.[0]?.imagePath) ?? buildImageUrl(item.product?.imagePath) ?? buildImageUrl(item.imagePath);
}
function resolveCatalogItemPrice(item) {
  const modifier = pickDefaultContextModifier(item);
  return normalizePrice(modifier?.price ?? item.price);
}
function resolvePromotionTitle(item, aggregationId) {
  return normalizeText(
    item.promotionName,
    normalizeText(item.title, normalizeText(item.productName, normalizeText(item.itemName, `Promocao iFood ${aggregationId}`)))
  );
}
function resolvePromotionDescription(item) {
  const details = [];
  if (item.promotionType) details.push(`Tipo: ${item.promotionType}`);
  if (typeof item.discountValue === "number") details.push(`Desconto: ${item.discountValue}`);
  if (item.productName || item.itemName) details.push(`Item: ${item.productName ?? item.itemName}`);
  return details.join(" | ") || "Promocao sincronizada do iFood";
}
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function getConfiguredAggregationIds() {
  return (process.env.IFOOD_PROMOTION_AGGREGATION_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}
async function hasColumn2(db, tableName, columnName) {
  const query = `SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`;
  const result = await db.execute(sql4.raw(query));
  const rows = result[0];
  return rows.length > 0;
}
async function hasIndex2(db, tableName, indexName) {
  const query = `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`;
  const result = await db.execute(sql4.raw(query));
  const rows = result[0];
  return rows.length > 0;
}
async function ensureIfoodSyncSchema(db) {
  if (ensureSchemaPromise) {
    return ensureSchemaPromise;
  }
  ensureSchemaPromise = (async () => {
    if (!await hasColumn2(db, "categories", "externalSource")) {
      await db.execute(sql4.raw("ALTER TABLE `categories` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!await hasIndex2(db, "categories", "categories_external_uq")) {
      await db.execute(sql4.raw("CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn2(db, "products", "externalSource")) {
      await db.execute(
        sql4.raw(
          "ALTER TABLE `products` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128), ADD `externalCode` varchar(128)"
        )
      );
    }
    if (!await hasIndex2(db, "products", "products_external_uq")) {
      await db.execute(sql4.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn2(db, "coupons", "externalSource")) {
      await db.execute(sql4.raw("ALTER TABLE `coupons` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!await hasIndex2(db, "coupons", "coupons_external_uq")) {
      await db.execute(sql4.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn2(db, "promotions", "externalSource")) {
      await db.execute(sql4.raw("ALTER TABLE `promotions` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!await hasIndex2(db, "promotions", "promotions_external_uq")) {
      await db.execute(sql4.raw("CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
  })().catch((error) => {
    ensureSchemaPromise = null;
    throw error;
  });
  return ensureSchemaPromise;
}
async function getToken() {
  const clientId = process.env.IFOOD_CLIENT_ID;
  const clientSecret = process.env.IFOOD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET nao configurados");
  }
  if (cachedToken && Date.now() < tokenExpiresAt - 6e4) {
    return cachedToken;
  }
  const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grantType: "client_credentials",
      clientId,
      clientSecret
    })
  });
  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`iFood auth failed: ${res.status} ${text2}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1e3;
  return cachedToken;
}
async function ifoodGet(path) {
  const token = await getToken();
  const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`iFood GET ${path} failed: ${res.status} ${text2}`);
  }
  return res.json();
}
async function ifoodPost(path, body) {
  const token = await getToken();
  const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text3 = await res.text();
    throw new Error(`iFood POST ${path} failed: ${res.status} ${text3}`);
  }
  if (res.status === 204) return;
  const text2 = await res.text();
  return text2 ? JSON.parse(text2) : void 0;
}
async function resolveMerchantSelection(selectedMerchantId) {
  const merchants = await listIfoodMerchants();
  if (selectedMerchantId) {
    return merchants.filter((merchant) => merchant.id === selectedMerchantId);
  }
  const envMerchantIds = (process.env.IFOOD_MERCHANT_ID ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (envMerchantIds.length > 0) {
    return merchants.filter((merchant) => envMerchantIds.includes(merchant.id));
  }
  return merchants;
}
async function listIfoodMerchants() {
  const response = await ifoodGet("/merchant/v1.0/merchants");
  const merchants = Array.isArray(response) ? response : response.merchants ?? [];
  return merchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name ?? `Merchant ${merchant.id.slice(0, 8)}`,
    status: merchant.status ?? "UNKNOWN",
    city: merchant.city
  }));
}
async function syncIfoodCatalog(selectedMerchantId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureIfoodSyncSchema(db);
  const merchants = await resolveMerchantSelection(selectedMerchantId);
  if (merchants.length === 0) {
    throw new Error("Nenhum merchant iFood disponivel para sincronizacao");
  }
  const result = { merchants: [] };
  for (const merchant of merchants) {
    const merchantId = merchant.id;
    const categoriesResponse = await ifoodGet(
      `/catalog/v2.0/merchants/${merchantId}/categories?include_items=true`
    );
    let categoriesImported = 0;
    let categoriesUpdated = 0;
    let productsImported = 0;
    let productsUpdated = 0;
    const seenCategoryIds = /* @__PURE__ */ new Set();
    const seenProductIds = /* @__PURE__ */ new Set();
    for (let index2 = 0; index2 < categoriesResponse.length; index2 += 1) {
      const remoteCategory = categoriesResponse[index2];
      if (!remoteCategory?.id) continue;
      seenCategoryIds.add(remoteCategory.id);
      const existingCategory = await db.select().from(categories).where(
        and7(
          eq9(categories.externalSource, IFOOD_SOURCE),
          eq9(categories.externalMerchantId, merchantId),
          eq9(categories.externalId, remoteCategory.id)
        )
      ).limit(1);
      const categoryPayload = {
        name: normalizeText(remoteCategory.name, `Categoria ${index2 + 1}`),
        description: `Sincronizado do iFood (${merchant.name ?? merchantId})`,
        slug: `ifood-${slugify(remoteCategory.name ?? `categoria-${index2 + 1}`)}-${remoteCategory.id.slice(0, 8)}`,
        sortOrder: index2,
        active: isAvailableStatus(remoteCategory.status),
        externalSource: IFOOD_SOURCE,
        externalMerchantId: merchantId,
        externalId: remoteCategory.id
      };
      let categoryId;
      if (existingCategory[0]) {
        categoryId = existingCategory[0].id;
        await db.update(categories).set({
          name: categoryPayload.name,
          description: categoryPayload.description,
          active: categoryPayload.active,
          sortOrder: categoryPayload.sortOrder,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq9(categories.id, categoryId));
        categoriesUpdated += 1;
      } else {
        const inserted = await db.insert(categories).values(categoryPayload).$returningId();
        categoryId = inserted[0].id;
        categoriesImported += 1;
      }
      const remoteItems = remoteCategory.items ?? [];
      for (let itemIndex = 0; itemIndex < remoteItems.length; itemIndex += 1) {
        const remoteItem = remoteItems[itemIndex];
        if (!remoteItem?.id) continue;
        seenProductIds.add(remoteItem.id);
        const existingProduct = await db.select().from(products).where(
          and7(
            eq9(products.externalSource, IFOOD_SOURCE),
            eq9(products.externalMerchantId, merchantId),
            eq9(products.externalId, remoteItem.id)
          )
        ).limit(1);
        const productPayload = {
          categoryId,
          name: resolveCatalogItemName(remoteItem),
          description: resolveCatalogItemDescription(remoteItem),
          price: resolveCatalogItemPrice(remoteItem),
          imageUrl: resolveCatalogItemImage(remoteItem),
          active: isAvailableStatus(pickDefaultContextModifier(remoteItem)?.status ?? remoteItem.status),
          featured: false,
          sortOrder: itemIndex,
          externalSource: IFOOD_SOURCE,
          externalMerchantId: merchantId,
          externalId: remoteItem.id,
          externalCode: remoteItem.externalCode ?? remoteItem.product?.externalCode ?? remoteItem.products?.[0]?.externalCode ?? null
        };
        if (existingProduct[0]) {
          await db.update(products).set({
            categoryId: productPayload.categoryId,
            name: productPayload.name,
            description: productPayload.description,
            price: productPayload.price,
            imageUrl: productPayload.imageUrl,
            active: productPayload.active,
            sortOrder: productPayload.sortOrder,
            externalCode: productPayload.externalCode,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq9(products.id, existingProduct[0].id));
          productsUpdated += 1;
        } else {
          await db.insert(products).values(productPayload);
          productsImported += 1;
        }
      }
    }
    const existingMerchantCategories = await db.select({ id: categories.id, externalId: categories.externalId }).from(categories).where(and7(eq9(categories.externalSource, IFOOD_SOURCE), eq9(categories.externalMerchantId, merchantId)));
    let categoriesDeactivated = 0;
    for (const localCategory of existingMerchantCategories) {
      if (localCategory.externalId && !seenCategoryIds.has(localCategory.externalId)) {
        await db.update(categories).set({ active: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(categories.id, localCategory.id));
        categoriesDeactivated += 1;
      }
    }
    const existingMerchantProducts = await db.select({ id: products.id, externalId: products.externalId }).from(products).where(and7(eq9(products.externalSource, IFOOD_SOURCE), eq9(products.externalMerchantId, merchantId)));
    let productsDeactivated = 0;
    for (const localProduct of existingMerchantProducts) {
      if (localProduct.externalId && !seenProductIds.has(localProduct.externalId)) {
        await db.update(products).set({ active: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(products.id, localProduct.id));
        productsDeactivated += 1;
      }
    }
    result.merchants.push({
      merchantId,
      merchantName: merchant.name ?? merchantId,
      categoriesImported,
      categoriesUpdated,
      productsImported,
      productsUpdated,
      productsDeactivated,
      categoriesDeactivated
    });
  }
  return result;
}
async function syncIfoodPromotions(input) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureIfoodSyncSchema(db);
  const merchants = await resolveMerchantSelection(input?.merchantId);
  if (merchants.length === 0) {
    throw new Error("Nenhum merchant iFood disponivel para sincronizacao");
  }
  const aggregationIds = (input?.aggregationIds?.length ? input.aggregationIds : getConfiguredAggregationIds()).map((value) => value.trim()).filter(Boolean);
  if (aggregationIds.length === 0) {
    throw new Error(
      "Informe aggregationIds ou configure IFOOD_PROMOTION_AGGREGATION_IDS. A API oficial do iFood consulta promocoes por aggregationId."
    );
  }
  const result = {
    merchants: [],
    couponsImported: 0,
    note: "O iFood nao exp\xF5e uma API publica para listar cupons do jeito que o app usa hoje. Este sync importa promocoes consultaveis por aggregationId e nao cria cupons artificiais."
  };
  for (const merchant of merchants) {
    let promotionsImported = 0;
    let promotionsUpdated = 0;
    for (const aggregationId of aggregationIds) {
      const response = await ifoodGet(
        `/promotion/v1.0/merchants/${merchant.id}/promotions/${aggregationId}/items?offset=0&limit=200`
      );
      const items = Array.isArray(response) ? response : response.items ?? [];
      for (let index2 = 0; index2 < items.length; index2 += 1) {
        const item = items[index2];
        const externalId = `${aggregationId}:${item.itemId ?? item.ean ?? item.sku ?? index2}`;
        const existing = await db.select().from(promotions).where(
          and7(
            eq9(promotions.externalSource, IFOOD_SOURCE),
            eq9(promotions.externalMerchantId, merchant.id),
            eq9(promotions.externalId, externalId)
          )
        ).limit(1);
        const startsAt = parseDate(item.initialDate);
        const endsAt = parseDate(item.finalDate);
        const payload = {
          title: resolvePromotionTitle(item, aggregationId),
          description: resolvePromotionDescription(item),
          imageUrl: null,
          couponCode: null,
          active: isAvailableStatus(item.status),
          requiresLogin: false,
          startsAt,
          endsAt,
          externalSource: IFOOD_SOURCE,
          externalMerchantId: merchant.id,
          externalId
        };
        if (existing[0]) {
          await db.update(promotions).set({
            title: payload.title,
            description: payload.description,
            imageUrl: payload.imageUrl,
            couponCode: payload.couponCode,
            active: payload.active,
            requiresLogin: payload.requiresLogin,
            startsAt: payload.startsAt,
            endsAt: payload.endsAt,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq9(promotions.id, existing[0].id));
          promotionsUpdated += 1;
        } else {
          await db.insert(promotions).values(payload);
          promotionsImported += 1;
        }
      }
    }
    result.merchants.push({
      merchantId: merchant.id,
      merchantName: merchant.name ?? merchant.id,
      aggregationIds,
      promotionsImported,
      promotionsUpdated
    });
  }
  return result;
}
async function pollIfoodEventsOnce() {
  let events;
  try {
    events = await ifoodGet("/events/v1.0/events:polling");
  } catch (err) {
    console.error("[iFood] Polling error:", err);
    return;
  }
  if (!events || events.length === 0) return;
  console.log(`[iFood] ${events.length} evento(s) recebido(s)`);
  const db = await getDb();
  if (!db) return;
  const processedIds = [];
  for (const event of events) {
    try {
      await processEvent(db, event);
      processedIds.push(event.id);
    } catch (err) {
      console.error(`[iFood] Erro ao processar evento ${event.id}:`, err);
      processedIds.push(event.id);
    }
  }
  if (processedIds.length > 0) {
    try {
      await ifoodPost("/events/v1.0/events/acknowledgment", processedIds.map((id) => ({ id })));
    } catch (err) {
      console.error("[iFood] Erro ao enviar ACK:", err);
    }
  }
}
async function processEvent(db, event) {
  const { code, correlationId: ifoodOrderId } = event;
  if (code === "PLACED") {
    await handleNewOrder(db, ifoodOrderId);
  } else if (IFOOD_STATUS_MAP[code]) {
    const newStatus = IFOOD_STATUS_MAP[code];
    await db.update(orders).set({
      status: newStatus,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq9(orders.ifoodOrderId, ifoodOrderId));
    console.log(`[iFood] Pedido ${ifoodOrderId} -> ${newStatus}`);
  }
}
async function handleNewOrder(db, ifoodOrderId) {
  const existing = await db.select({ id: orders.id }).from(orders).where(eq9(orders.ifoodOrderId, ifoodOrderId)).limit(1);
  if (existing.length > 0) {
    console.log(`[iFood] Pedido ${ifoodOrderId} ja existe, ignorando`);
    return;
  }
  const order = await ifoodGet(`/order/v1.0/orders/${ifoodOrderId}`);
  const addr = order.deliveryAddress;
  const deliveryAddress = addr ? `${addr.streetName}, ${addr.streetNumber}${addr.complement ? ` - ${addr.complement}` : ""}, ${addr.neighborhood}, ${addr.city}/${addr.state} - CEP ${addr.postalCode}` : null;
  const itemsData = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    totalPrice: item.totalPrice,
    notes: item.subItems?.map((subItem) => `${subItem.quantity}x ${subItem.name}`).join(", ") ?? null
  }));
  const payment = order.payments[0];
  const paymentMethod = payment ? payment.prepaid ? "online" : payment.code === "PIX" ? "pix" : payment.code === "CASH" ? "cash" : "card" : "online";
  const [newOrder] = await db.insert(orders).values({
    status: "pending",
    paymentMethod,
    paymentStatus: payment?.prepaid ? "paid" : "pending",
    subtotal: String(order.subTotal),
    deliveryFee: String(order.deliveryFee),
    discountAmount: "0",
    total: String(order.totalPrice),
    deliveryAddress: deliveryAddress ?? "",
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    notes: `[iFood] Pedido #${order.shortReference}`,
    ifoodOrderId: order.id,
    source: "ifood",
    createdAt: new Date(order.createdAt),
    updatedAt: /* @__PURE__ */ new Date()
  }).$returningId();
  if (newOrder?.id && itemsData.length > 0) {
    await db.insert(orderItems).values(
      itemsData.map((item) => ({
        orderId: newOrder.id,
        productId: 0,
        productName: item.name,
        productPrice: String(item.price),
        quantity: item.quantity,
        subtotal: String(item.totalPrice),
        notes: item.notes
      }))
    );
  }
  console.log(`[iFood] Novo pedido criado: #${order.shortReference} (${order.customer.name}) - R$ ${order.totalPrice}`);
}
async function confirmIfoodOrder(ifoodOrderId) {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/confirm`, {});
}
async function startPreparationIfoodOrder(ifoodOrderId) {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/startPreparation`, {});
}
async function dispatchIfoodOrder(ifoodOrderId) {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/dispatch`, {});
}
async function cancelIfoodOrder(ifoodOrderId, reason) {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/cancel`, {
    cancellationCode: "501",
    description: reason
  });
}

// server/marketplaces.ts
init_db();
import { z as z5 } from "zod";
var marketplaceProviderIdSchema = z5.enum([
  "ifood",
  "uber_eats",
  "rappi",
  "doordash",
  "grubhub",
  "deliveroo",
  "just_eat",
  "wolt",
  "glovo",
  "foodpanda"
]);
var marketplaceConfigSchema = z5.object({
  enabled: z5.boolean().default(false),
  merchantId: z5.string().trim().max(120).optional().default(""),
  externalStoreId: z5.string().trim().max(120).optional().default(""),
  regionHint: z5.string().trim().max(120).optional().default(""),
  aggregationIds: z5.array(z5.string().trim().min(1).max(120)).max(20).optional().default([]),
  notes: z5.string().trim().max(500).optional().default("")
});
var MARKETPLACE_SETTINGS_KEY = "marketplaceConfigs";
var PROVIDERS = [
  {
    id: "ifood",
    name: "iFood",
    description: "Marketplace lider no Brasil com APIs oficiais para merchants, catalogo, promocoes e eventos de pedido.",
    docsUrl: "https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/introducao/",
    portalUrl: "https://developer.ifood.com.br/",
    onboarding: "partner_program",
    integrationModel: "oauth",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal iFood",
    accessHelp: "O iFood trabalha com onboarding e credenciais do portal de parceiros antes da troca de tokens.",
    capabilities: ["orders", "catalog", "promotions", "status_updates", "polling", "store_sync"],
    regions: ["Brasil"],
    requiredEnv: ["IFOOD_CLIENT_ID", "IFOOD_CLIENT_SECRET"],
    implemented: true
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    description: "APIs oficiais da Uber para pedidos, menus, status de loja e webhooks, com onboarding via parceiro.",
    docsUrl: "https://developer.uber.com/docs/eats/introduction",
    portalUrl: "https://developer.uber.com/",
    onboarding: "partner_program",
    integrationModel: "oauth",
    accessMode: "oauth_login",
    accessLabel: "Entrar com Uber",
    accessHelp: "A Uber oferece fluxo oficial com login e aprovacao do app antes de liberar a conta do merchant.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks", "store_sync"],
    regions: ["Global"],
    requiredEnv: ["UBER_EATS_CLIENT_ID", "UBER_EATS_CLIENT_SECRET"],
    implemented: false
  },
  {
    id: "rappi",
    name: "Rappi",
    description: "Portal oficial de parceiros da Rappi para operacao de pedidos e integracoes de restaurantes.",
    docsUrl: "https://developers.rappi.com/",
    portalUrl: "https://developers.rappi.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Rappi",
    accessHelp: "Acesso normalmente entra por portal de parceiros e emissao de credenciais aprovadas.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["America Latina"],
    requiredEnv: ["RAPPI_API_KEY"],
    implemented: false
  },
  {
    id: "doordash",
    name: "DoorDash",
    description: "Ecossistema oficial da DoorDash com Drive e Storefront, cobrindo entrega, webhooks e operacao de pedidos.",
    docsUrl: "https://developer.doordash.com/en-US/docs/drive/overview",
    portalUrl: "https://developer.doordash.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "oauth_login",
    accessLabel: "Entrar com DoorDash",
    accessHelp: "A DoorDash possui portal oficial e trilhas de autorizacao para parceiros aprovados.",
    capabilities: ["orders", "status_updates", "webhooks", "delivery_status"],
    regions: ["EUA", "Canada", "Australia"],
    requiredEnv: ["DOORDASH_DEVELOPER_ID", "DOORDASH_KEY_ID", "DOORDASH_SIGNING_SECRET"],
    implemented: false
  },
  {
    id: "grubhub",
    name: "Grubhub",
    description: "APIs oficiais de marketplace e order ingestion para parceiros integradores.",
    docsUrl: "https://developer.grubhub.com/docs/getting-started",
    portalUrl: "https://developer.grubhub.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Grubhub",
    accessHelp: "A Grubhub costuma liberar integracao via portal e credenciais do parceiro integrador.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["EUA"],
    requiredEnv: ["GRUBHUB_API_KEY"],
    implemented: false
  },
  {
    id: "deliveroo",
    name: "Deliveroo",
    description: "API oficial de order management e menu sync para restaurantes parceiros.",
    docsUrl: "https://api-docs.deliveroo.com/docs/getting-started",
    portalUrl: "https://api-docs.deliveroo.com/docs/getting-started",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Deliveroo",
    accessHelp: "A Deliveroo exige conta de parceiro e aprovacao da integracao para liberar a operacao.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Europa", "Asia", "Emirados Arabes"],
    requiredEnv: ["DELIVEROO_API_KEY"],
    implemented: false
  },
  {
    id: "just_eat",
    name: "Just Eat",
    description: "Developer portal oficial com APIs de menu, orders e status para parceiros do grupo Just Eat Takeaway.",
    docsUrl: "https://developers.just-eat.com/documentation/getting-started",
    portalUrl: "https://developers.just-eat.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Just Eat",
    accessHelp: "A conta entra pelo portal de desenvolvedor e depende de habilitacao do parceiro.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Europa", "Reino Unido"],
    requiredEnv: ["JUST_EAT_API_KEY"],
    implemented: false
  },
  {
    id: "wolt",
    name: "Wolt",
    description: "Marketplace APIs da Wolt para menu, order intake, webhooks e operacao de parceiros.",
    docsUrl: "https://developer.wolt.com/docs/marketplace-overview",
    portalUrl: "https://developer.wolt.com/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal Wolt",
    accessHelp: "A Wolt centraliza o acesso no portal oficial e libera as credenciais por parceiro.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks", "store_sync"],
    regions: ["Europa", "Asia"],
    requiredEnv: ["WOLT_API_KEY"],
    implemented: false
  },
  {
    id: "glovo",
    name: "Glovo",
    description: "Q-Commerce Integrations da Glovo para pedidos, webhooks e sincronizacao operacional.",
    docsUrl: "https://qcommerce-integrations.glovoapp.com/",
    portalUrl: "https://qcommerce-integrations.glovoapp.com/",
    onboarding: "restricted_partner",
    integrationModel: "partner_credentials",
    accessMode: "partner_request",
    accessLabel: "Solicitar acesso Glovo",
    accessHelp: "A Glovo trabalha com acesso restrito e liberacao direta para parceiros homologados.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Europa", "America Latina", "Africa"],
    requiredEnv: ["GLOVO_API_KEY"],
    implemented: false
  },
  {
    id: "foodpanda",
    name: "foodpanda",
    description: "Portal oficial de integracao da foodpanda com APIs de pedidos, menu e order management.",
    docsUrl: "https://developer.foodpanda.com/docs/",
    portalUrl: "https://developer.foodpanda.com/docs/",
    onboarding: "partner_program",
    integrationModel: "api_key",
    accessMode: "partner_portal",
    accessLabel: "Abrir portal foodpanda",
    accessHelp: "A foodpanda usa portal de parceiros e liberacao de credenciais por conta.",
    capabilities: ["orders", "catalog", "status_updates", "webhooks"],
    regions: ["Asia", "Europa"],
    requiredEnv: ["FOODPANDA_API_KEY"],
    implemented: false
  }
];
function normalizeConfig2(input) {
  return marketplaceConfigSchema.parse({
    enabled: input?.enabled ?? false,
    merchantId: input?.merchantId ?? "",
    externalStoreId: input?.externalStoreId ?? "",
    regionHint: input?.regionHint ?? "",
    aggregationIds: input?.aggregationIds ?? [],
    notes: input?.notes ?? ""
  });
}
function parseStoredConfigs(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const result = {};
    for (const provider of PROVIDERS) {
      if (parsed[provider.id]) {
        result[provider.id] = normalizeConfig2(parsed[provider.id]);
      }
    }
    return result;
  } catch {
    return {};
  }
}
function getCredentialsReady(requiredEnv) {
  if (!requiredEnv.length) return true;
  return requiredEnv.every((name) => Boolean(process.env[name]?.trim()));
}
function getConnectionState(definition, config, credentialsReady) {
  if (!definition.implemented) {
    if (credentialsReady) return "credentials_ready";
    return config.enabled ? "missing_credentials" : "planned";
  }
  if (config.enabled && credentialsReady) return "ready";
  if (!config.enabled && credentialsReady) return "credentials_ready";
  if (config.enabled && !credentialsReady) return "missing_credentials";
  return "disabled";
}
async function getMarketplaceOverview() {
  const settings = await getAllStoreSettings();
  const storedConfigs = parseStoredConfigs(settings[MARKETPLACE_SETTINGS_KEY]);
  const providers = PROVIDERS.map((definition) => {
    const config = normalizeConfig2(storedConfigs[definition.id]);
    const credentialsReady = getCredentialsReady(definition.requiredEnv);
    const connectionState = getConnectionState(definition, config, credentialsReady);
    return {
      ...definition,
      config,
      runtime: {
        credentialsReady,
        connectionState,
        canExecuteNativeActions: definition.implemented && credentialsReady
      }
    };
  });
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    implementedCount: providers.filter((provider) => provider.implemented).length,
    readyCount: providers.filter((provider) => provider.runtime.connectionState === "ready").length,
    plannedCount: providers.filter((provider) => !provider.implemented).length,
    providers
  };
}
async function saveMarketplaceConfig(providerId, config) {
  const settings = await getAllStoreSettings();
  const storedConfigs = parseStoredConfigs(settings[MARKETPLACE_SETTINGS_KEY]);
  storedConfigs[providerId] = normalizeConfig2(config);
  await setStoreSetting(MARKETPLACE_SETTINGS_KEY, JSON.stringify(storedConfigs));
  return getMarketplaceOverview();
}
async function testMarketplaceConnection(providerId) {
  if (providerId === "ifood") {
    const merchants = await listIfoodMerchants();
    return {
      success: true,
      message: merchants.length ? `${merchants.length} merchant(s) encontrado(s) no iFood.` : "Credenciais validas, mas nenhum merchant foi retornado.",
      details: merchants.map((merchant) => ({
        id: merchant.id,
        name: merchant.name
      }))
    };
  }
  return {
    success: false,
    message: "Esta plataforma ja esta mapeada no hub, mas ainda depende da implementacao nativa apos liberacao das credenciais do parceiro.",
    details: []
  };
}
async function runMarketplaceCatalogSync(providerId, merchantId) {
  if (providerId !== "ifood") {
    throw new Error("Sincronizacao nativa de catalogo disponivel apenas para iFood nesta versao.");
  }
  return syncIfoodCatalog(merchantId);
}
async function runMarketplacePromotionsSync(providerId, input) {
  if (providerId !== "ifood") {
    throw new Error("Sincronizacao nativa de promocoes disponivel apenas para iFood nesta versao.");
  }
  return syncIfoodPromotions(input);
}
async function pullMarketplaceOrders(providerId) {
  if (providerId !== "ifood") {
    throw new Error("Importacao nativa de pedidos disponivel apenas para iFood nesta versao.");
  }
  await pollIfoodEventsOnce();
  return { success: true };
}

// server/ifoodIntegration.ts
init_db();
import { TRPCError as TRPCError6 } from "@trpc/server";
import { sql as sql5 } from "drizzle-orm";
import crypto2 from "crypto";
function asRows(result) {
  return result[0] ?? [];
}
function parseJsonObject(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}
function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
function mapIntegration(row, restaurantId) {
  if (!row) {
    return {
      id: null,
      restaurantId,
      merchantId: null,
      merchantName: null,
      status: "disconnected",
      mode: "mock",
      lastConnectedAt: null,
      lastSyncAt: null,
      lastError: null,
      createdAt: null,
      updatedAt: null
    };
  }
  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurant_id),
    merchantId: row.merchant_id ? String(row.merchant_id) : null,
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    status: String(row.status ?? "disconnected"),
    mode: String(row.mode ?? "mock"),
    lastConnectedAt: toIso(row.last_connected_at),
    lastSyncAt: toIso(row.last_sync_at),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}
function mapOrder(row) {
  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurant_id),
    channel: "ifood",
    externalOrderId: String(row.external_order_id),
    displayId: String(row.display_id),
    status: String(row.status),
    customerName: String(row.customer_name),
    totalAmount: Number(row.total_amount ?? 0),
    payload: parseJsonObject(row.payload),
    createdAt: toIso(row.created_at) ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: toIso(row.updated_at) ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
function mapLog(row) {
  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurant_id),
    action: String(row.action),
    message: String(row.message),
    payload: row.payload ? parseJsonObject(row.payload) : null,
    createdAt: toIso(row.created_at) ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Database indisponivel." });
  return db;
}
async function getDefaultStoreId(db) {
  const rows = asRows(await db.execute(sql5.raw(`
    SELECT id
    FROM stores
    WHERE active = true
    ORDER BY isDefault DESC, id ASC
    LIMIT 1
  `)));
  return Number(rows[0]?.id ?? 0);
}
async function resolveIntegrationRestaurantId(requestedStoreId) {
  const db = await requireDb();
  return requestedStoreId ?? await getDefaultStoreId(db);
}
async function ensureIfoodIntegrationSchema() {
  const db = await requireDb();
  await db.execute(sql5.raw(`
    CREATE TABLE IF NOT EXISTS ifood_integrations (
      id int NOT NULL AUTO_INCREMENT,
      restaurant_id int NOT NULL,
      merchant_id varchar(120),
      merchant_name varchar(220),
      status enum('disconnected','connecting','connected','error') NOT NULL DEFAULT 'disconnected',
      mode enum('mock','production') NOT NULL DEFAULT 'mock',
      last_connected_at timestamp NULL,
      last_sync_at timestamp NULL,
      last_error text,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY ifood_integrations_restaurant_uq (restaurant_id),
      KEY ifood_integrations_status_idx (status)
    )
  `));
  const syncColumn = asRows(await db.execute(sql5`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ifood_integrations'
      AND COLUMN_NAME = 'last_sync_at'
  `));
  if (Number(syncColumn[0]?.count ?? 0) === 0) {
    await db.execute(sql5.raw("ALTER TABLE ifood_integrations ADD COLUMN last_sync_at timestamp NULL AFTER last_connected_at"));
  }
  await db.execute(sql5.raw(`
    CREATE TABLE IF NOT EXISTS external_orders (
      id int NOT NULL AUTO_INCREMENT,
      restaurant_id int NOT NULL,
      channel varchar(40) NOT NULL,
      external_order_id varchar(120) NOT NULL,
      display_id varchar(40) NOT NULL,
      status enum('novo','confirmado','em_preparo','saiu_para_entrega','concluido','cancelado') NOT NULL DEFAULT 'novo',
      customer_name varchar(220) NOT NULL,
      total_amount decimal(10,2) NOT NULL DEFAULT '0.00',
      payload json,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY external_orders_channel_external_uq (channel, external_order_id),
      KEY external_orders_restaurant_idx (restaurant_id),
      KEY external_orders_status_idx (status),
      KEY external_orders_created_idx (created_at)
    )
  `));
  await db.execute(sql5.raw(`
    CREATE TABLE IF NOT EXISTS ifood_logs (
      id int NOT NULL AUTO_INCREMENT,
      restaurant_id int NOT NULL,
      action varchar(120) NOT NULL,
      message text NOT NULL,
      payload json,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ifood_logs_restaurant_idx (restaurant_id),
      KEY ifood_logs_created_idx (created_at)
    )
  `));
}
var IfoodLogService = class {
  async list(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows(await db.execute(sql5`
      SELECT id, restaurant_id, action, message, payload, created_at
      FROM ifood_logs
      WHERE restaurant_id = ${restaurantId}
      ORDER BY created_at DESC, id DESC
      LIMIT 40
    `));
    return rows.map(mapLog);
  }
  async create(restaurantId, action, message, payload) {
    const db = await requireDb();
    await db.execute(sql5`
      INSERT INTO ifood_logs (restaurant_id, action, message, payload)
      VALUES (${restaurantId}, ${action}, ${message}, ${JSON.stringify(payload ?? {})})
    `);
  }
};
var IfoodIntegrationService = class {
  constructor(logs = new IfoodLogService()) {
    this.logs = logs;
  }
  async getStatus(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows(await db.execute(sql5`
      SELECT *
      FROM ifood_integrations
      WHERE restaurant_id = ${restaurantId}
      LIMIT 1
    `));
    return mapIntegration(rows[0], restaurantId);
  }
  async connect(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    await db.execute(sql5`
      INSERT INTO ifood_integrations
        (restaurant_id, merchant_id, merchant_name, status, mode, last_connected_at, last_sync_at, last_error)
      VALUES
        (${restaurantId}, 'mock-merchant-001', 'Restaurante iFood Simulado', 'connected', 'mock', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
      ON DUPLICATE KEY UPDATE
        merchant_id = VALUES(merchant_id),
        merchant_name = VALUES(merchant_name),
        status = VALUES(status),
        mode = VALUES(mode),
        last_connected_at = CURRENT_TIMESTAMP,
        last_sync_at = CURRENT_TIMESTAMP,
        last_error = NULL
    `);
    await this.logs.create(restaurantId, "integration.connected", "Integra\xE7\xE3o iFood conectada em modo simulado.", {
      merchantId: "mock-merchant-001",
      mode: "mock"
    });
    return this.getStatus(restaurantId);
  }
  async disconnect(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    await db.execute(sql5`
      INSERT INTO ifood_integrations (restaurant_id, status, mode)
      VALUES (${restaurantId}, 'disconnected', 'mock')
      ON DUPLICATE KEY UPDATE status = 'disconnected'
    `);
    await this.logs.create(restaurantId, "integration.disconnected", "Integra\xE7\xE3o iFood desconectada.", {});
    return this.getStatus(restaurantId);
  }
};
var IfoodOrderService = class {
  constructor(logs = new IfoodLogService()) {
    this.logs = logs;
  }
  async list(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows(await db.execute(sql5`
      SELECT *
      FROM external_orders
      WHERE restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `));
    return rows.map(mapOrder);
  }
  async createMockOrder(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const displayId = String(1e3 + Math.floor(Math.random() * 8999));
    const externalOrderId = `mock-ifood-${crypto2.randomUUID()}`;
    const payload = {
      id: externalOrderId,
      displayId,
      merchant: { id: "mock-merchant-001", name: "Restaurante iFood Simulado" },
      customer: {
        name: "Cliente iFood Teste",
        phone: "(37) 99999-0101"
      },
      items: [
        {
          id: "item-001",
          name: "Pizza Grande Bonatto",
          quantity: 1,
          unitPrice: 69.9,
          options: ["Metade Calabresa", "Metade Marguerita", "Borda catupiry"],
          observations: "Caprichar no molho."
        },
        {
          id: "item-002",
          name: "Refrigerante 2L",
          quantity: 1,
          unitPrice: 12.9,
          options: []
        }
      ],
      delivery: {
        address: "Rua Simulada, 123 - Centro, Mateus Leme - MG",
        complement: "Casa",
        mode: "delivery"
      },
      payment: {
        method: "Pago pelo iFood",
        prepaid: true
      },
      total: {
        items: 82.8,
        deliveryFee: 7,
        benefits: 0,
        orderAmount: 89.8
      },
      notes: "Pedido de teste gerado pelo modo simulado Bonatto.",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.execute(sql5`
      INSERT INTO external_orders
        (restaurant_id, channel, external_order_id, display_id, status, customer_name, total_amount, payload)
      VALUES
        (${restaurantId}, 'ifood', ${externalOrderId}, ${displayId}, 'novo', 'Cliente iFood Teste', '89.80', ${JSON.stringify(payload)})
    `);
    await db.execute(sql5`UPDATE ifood_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE restaurant_id = ${restaurantId} LIMIT 1`);
    const rows = asRows(await db.execute(sql5`SELECT LAST_INSERT_ID() AS id`));
    const order = await this.getById(Number(rows[0]?.id), restaurantId);
    await this.logs.create(restaurantId, "order.generated", `Pedido teste iFood #${displayId} gerado.`, {
      orderId: order.id,
      externalOrderId
    });
    return order;
  }
  async updateStatus(orderId, restaurantId, status) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const current = await this.getById(orderId, restaurantId);
    await db.execute(sql5`
      UPDATE external_orders
      SET status = ${status}
      WHERE id = ${orderId}
        AND restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      LIMIT 1
    `);
    await db.execute(sql5`UPDATE ifood_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE restaurant_id = ${restaurantId} LIMIT 1`);
    const order = await this.getById(orderId, restaurantId);
    await this.logs.create(restaurantId, `order.${status}`, this.statusLogMessage(order, current.status, status), {
      orderId,
      displayId: order.displayId,
      from: current.status,
      to: status
    });
    return order;
  }
  async getById(orderId, restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows(await db.execute(sql5`
      SELECT *
      FROM external_orders
      WHERE id = ${orderId}
        AND restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      LIMIT 1
    `));
    if (!rows[0]) throw new TRPCError6({ code: "NOT_FOUND", message: "Pedido iFood n\xE3o encontrado." });
    return mapOrder(rows[0]);
  }
  statusLogMessage(order, _from, to) {
    const labels = {
      novo: "Pedido teste gerado",
      confirmado: "Pedido confirmado",
      em_preparo: "Preparo iniciado",
      saiu_para_entrega: "Pedido despachado",
      concluido: "Pedido conclu\xEDdo",
      cancelado: "Pedido cancelado"
    };
    return `${labels[to]} no iFood simulado #${order.displayId}.`;
  }
};
var IfoodMockService = class {
  integration = new IfoodIntegrationService();
  orders = new IfoodOrderService();
  getStatus(restaurantId) {
    return this.integration.getStatus(restaurantId);
  }
  connect(restaurantId) {
    return this.integration.connect(restaurantId);
  }
  disconnect(restaurantId) {
    return this.integration.disconnect(restaurantId);
  }
  getOrders(restaurantId) {
    return this.orders.list(restaurantId);
  }
  generateTestOrder(restaurantId) {
    return this.orders.createMockOrder(restaurantId);
  }
  confirmOrder(orderId, restaurantId) {
    return this.orders.updateStatus(orderId, restaurantId, "confirmado");
  }
  startPreparation(orderId, restaurantId) {
    return this.orders.updateStatus(orderId, restaurantId, "em_preparo");
  }
  dispatchOrder(orderId, restaurantId) {
    return this.orders.updateStatus(orderId, restaurantId, "saiu_para_entrega");
  }
  concludeOrder(orderId, restaurantId) {
    return this.orders.updateStatus(orderId, restaurantId, "concluido");
  }
  cancelOrder(orderId, restaurantId) {
    return this.orders.updateStatus(orderId, restaurantId, "cancelado");
  }
};
var ProductionIfoodProvider = class {
  notReady() {
    throw new TRPCError6({
      code: "PRECONDITION_FAILED",
      message: "Integra\xE7\xE3o iFood em produ\xE7\xE3o ainda n\xE3o est\xE1 habilitada. Use IFOOD_MODE=mock."
    });
  }
  getStatus() {
    return this.notReady();
  }
  connect() {
    return this.notReady();
  }
  disconnect() {
    return this.notReady();
  }
  getOrders() {
    return this.notReady();
  }
  generateTestOrder() {
    return this.notReady();
  }
  confirmOrder() {
    return this.notReady();
  }
  startPreparation() {
    return this.notReady();
  }
  dispatchOrder() {
    return this.notReady();
  }
  concludeOrder() {
    return this.notReady();
  }
  cancelOrder() {
    return this.notReady();
  }
};
function getIfoodProvider() {
  return process.env.IFOOD_MODE === "production" ? new ProductionIfoodProvider() : new IfoodMockService();
}
async function listIfoodIntegrationLogs(restaurantId) {
  return new IfoodLogService().list(restaurantId);
}

// server/restaurantNetwork.ts
init_db();
import { sql as sql6 } from "drizzle-orm";
import { z as z6 } from "zod";
function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
function money(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
async function executeRows(db, query) {
  const result = await db.execute(sql6.raw(query));
  return result[0] ?? [];
}
async function hasColumn3(db, tableName, columnName) {
  const result = await db.execute(sql6`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `);
  const rows = result[0] ?? [];
  return Number(rows[0]?.count ?? 0) > 0;
}
async function ensureRestaurantNetworkSchema() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.execute(sql6.raw(`
    CREATE TABLE IF NOT EXISTS distribution_products (
      id int NOT NULL AUTO_INCREMENT,
      name varchar(180) NOT NULL,
      category varchar(120),
      unit enum('g','kg','ml','l','unit','pack','slice','portion') NOT NULL DEFAULT 'unit',
      availableQuantity decimal(12,3) NOT NULL DEFAULT '0.000',
      minimumQuantity decimal(12,3) NOT NULL DEFAULT '0.000',
      minOrderQuantity decimal(12,3) NOT NULL DEFAULT '1.000',
      maxOrderQuantity decimal(12,3),
      unitCost decimal(10,4) NOT NULL DEFAULT '0.0000',
      active boolean NOT NULL DEFAULT true,
      notes text,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY distribution_products_active_idx (active),
      KEY distribution_products_category_idx (category),
      KEY distribution_products_name_idx (name)
    )
  `));
  await db.execute(sql6.raw(`
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
  await db.execute(sql6.raw(`
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
  await db.execute(sql6.raw(`
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
  if (!await hasColumn3(db, "store_supply_order_items", "distributionProductId")) {
    await db.execute(sql6.raw("ALTER TABLE store_supply_order_items ADD COLUMN distributionProductId int NULL AFTER supplyOrderId"));
    await db.execute(sql6.raw("ALTER TABLE store_supply_order_items ADD KEY supply_items_distribution_product_idx (distributionProductId)"));
  }
  await db.execute(sql6.raw(`
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
  await db.execute(sql6.raw(`
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
  await db.execute(sql6.raw(`
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
  await db.execute(sql6.raw(`
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
async function audit(input) {
  const db = await getDb();
  if (!db) return;
  await ensureRestaurantNetworkSchema();
  await db.execute(sql6`
    INSERT INTO network_audit_logs (actorUserId, storeId, action, entityType, entityId, metadata)
    VALUES (${input.actorUserId ?? null}, ${input.storeId ?? null}, ${input.action}, ${input.entityType}, ${input.entityId ?? null}, ${JSON.stringify(input.metadata ?? {})})
  `);
}
var supplyOrderItemSchema = z6.object({
  productId: z6.number().int().positive(),
  quantityRequested: z6.string().regex(/^\d+(\.\d{1,3})?$/),
  quantityApproved: z6.string().regex(/^\d+(\.\d{1,3})?$/).optional()
});
var createSupplyOrderSchema = z6.object({
  storeId: z6.number().int().positive(),
  notes: z6.string().max(5e3).optional(),
  submit: z6.boolean().optional(),
  items: z6.array(supplyOrderItemSchema).min(1).max(100)
});
var distributionProductSchema = z6.object({
  name: z6.string().min(1).max(180),
  category: z6.string().max(120).optional(),
  unit: z6.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]),
  availableQuantity: z6.string().regex(/^\d+(\.\d{1,3})?$/),
  minimumQuantity: z6.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  minOrderQuantity: z6.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  maxOrderQuantity: z6.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  unitCost: z6.string().regex(/^\d+(\.\d{1,4})?$/),
  active: z6.boolean().optional(),
  notes: z6.string().max(5e3).optional()
});
var updateDistributionProductSchema = distributionProductSchema.partial().extend({
  id: z6.number().int().positive()
});
async function listDistributionProducts(opts) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return [];
  const where = opts?.activeOnly === false ? "" : "WHERE active = true";
  return executeRows(db, `
    SELECT *
    FROM distribution_products
    ${where}
    ORDER BY active DESC, category, name
    LIMIT 500
  `);
}
async function createDistributionProduct(input, actorUserId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.execute(sql6`
    INSERT INTO distribution_products
      (name, category, unit, availableQuantity, minimumQuantity, minOrderQuantity, maxOrderQuantity, unitCost, active, notes)
    VALUES
      (${input.name}, ${input.category ?? null}, ${input.unit}, ${input.availableQuantity}, ${input.minimumQuantity ?? "0"}, ${input.minOrderQuantity ?? "1"}, ${input.maxOrderQuantity ?? null}, ${input.unitCost}, ${input.active ?? true}, ${input.notes ?? null})
  `);
  const id = Number(result[0]?.insertId ?? 0);
  await audit({ actorUserId, action: "distribution_product.create", entityType: "distribution_product", entityId: id, metadata: input });
  return { id };
}
async function updateDistributionProduct(input, actorUserId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const fields = [];
  if (input.name !== void 0) fields.push(sql6`name = ${input.name}`);
  if (input.category !== void 0) fields.push(sql6`category = ${input.category || null}`);
  if (input.unit !== void 0) fields.push(sql6`unit = ${input.unit}`);
  if (input.availableQuantity !== void 0) fields.push(sql6`availableQuantity = ${input.availableQuantity}`);
  if (input.minimumQuantity !== void 0) fields.push(sql6`minimumQuantity = ${input.minimumQuantity}`);
  if (input.minOrderQuantity !== void 0) fields.push(sql6`minOrderQuantity = ${input.minOrderQuantity}`);
  if (input.maxOrderQuantity !== void 0) fields.push(sql6`maxOrderQuantity = ${input.maxOrderQuantity || null}`);
  if (input.unitCost !== void 0) fields.push(sql6`unitCost = ${input.unitCost}`);
  if (input.active !== void 0) fields.push(sql6`active = ${input.active}`);
  if (input.notes !== void 0) fields.push(sql6`notes = ${input.notes || null}`);
  if (fields.length === 0) return { ok: true };
  await db.execute(sql6`
    UPDATE distribution_products
    SET ${sql6.join(fields, sql6`, `)}
    WHERE id = ${input.id}
  `);
  await audit({ actorUserId, action: "distribution_product.update", entityType: "distribution_product", entityId: input.id, metadata: input });
  return { ok: true };
}
async function listSupplyOrders(opts) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    opts.storeId ? `o.storeId = ${opts.storeId}` : "",
    opts.status ? `o.status = ${JSON.stringify(opts.status)}` : ""
  ].filter(Boolean);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return executeRows(db, `
    SELECT o.*, s.name AS storeName, COUNT(i.id) AS itemCount,
      GROUP_CONCAT(CONCAT(i.productName, ' - ', CAST(i.quantityRequested AS CHAR), ' ', i.unit) ORDER BY i.id SEPARATOR ' | ') AS itemSummary
    FROM store_supply_orders o
    LEFT JOIN stores s ON s.id = o.storeId
    LEFT JOIN store_supply_order_items i ON i.supplyOrderId = o.id
    ${where}
    GROUP BY o.id
    ORDER BY o.createdAt DESC
    LIMIT 250
  `);
}
async function getSupplyOrderDetails(id) {
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
    SELECT i.*, dp.name AS distributionProductName, dp.availableQuantity, dp.minimumQuantity
    FROM store_supply_order_items i
    LEFT JOIN distribution_products dp ON dp.id = i.distributionProductId
    WHERE i.supplyOrderId = ${id}
    ORDER BY i.id
  `);
  return { ...order, items };
}
async function createSupplyOrder(input, actorUserId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const productRows = await executeRows(db, `
    SELECT id, name, unit, unitCost, availableQuantity, minOrderQuantity, maxOrderQuantity
    FROM distribution_products
    WHERE active = true AND id IN (${input.items.map((item) => item.productId).join(",")})
  `);
  const productById = new Map(productRows.map((row) => [Number(row.id), row]));
  const estimatedCost = input.items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    if (!product) throw new Error("Produto do CD indisponivel");
    const requested = Number(item.quantityRequested);
    const minOrder = Number(product.minOrderQuantity ?? 0);
    const maxOrder = product.maxOrderQuantity == null ? null : Number(product.maxOrderQuantity);
    if (requested < minOrder) throw new Error(`Quantidade minima para ${product.name}: ${minOrder} ${product.unit}`);
    if (maxOrder !== null && requested > maxOrder) throw new Error(`Quantidade maxima para ${product.name}: ${maxOrder} ${product.unit}`);
    return sum + requested * money(product.unitCost);
  }, 0);
  const status = input.submit ? "submitted" : "draft";
  const result = await db.execute(sql6`
    INSERT INTO store_supply_orders (storeId, requestedByUserId, status, estimatedCost, notes)
    VALUES (${input.storeId}, ${actorUserId}, ${status}, ${estimatedCost.toFixed(2)}, ${input.notes ?? null})
  `);
  const orderId = Number(result[0]?.insertId ?? 0);
  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) continue;
    const approved = item.quantityApproved ?? item.quantityRequested;
    await db.execute(sql6`
      INSERT INTO store_supply_order_items
        (supplyOrderId, distributionProductId, ingredientId, productName, unit, quantityRequested, quantityApproved, unitCost)
      VALUES
        (${orderId}, ${item.productId}, ${item.productId}, ${product.name}, ${product.unit}, ${item.quantityRequested}, ${approved}, ${money(product.unitCost).toFixed(4)})
    `);
  }
  await audit({ actorUserId, storeId: input.storeId, action: "supply_order.create", entityType: "store_supply_order", entityId: orderId, metadata: { status } });
  return { id: orderId };
}
var updateSupplyOrderStatusSchema = z6.object({
  id: z6.number().int().positive(),
  status: z6.enum(["submitted", "in_review", "approved", "picking", "shipped", "received", "rejected", "cancelled"]),
  notes: z6.string().max(5e3).optional()
});
async function updateSupplyOrderStatus(input, actorUserId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const details = await getSupplyOrderDetails(input.id);
  if (!details) throw new Error("Pedido ao CD nao encontrado");
  if (input.status === "shipped") {
    await db.execute(sql6`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes), shippedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
    `);
  } else if (input.status === "received") {
    await db.execute(sql6`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes), receivedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
    `);
  } else if (["approved", "rejected", "cancelled", "in_review"].includes(input.status)) {
    await db.execute(sql6`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes), reviewedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
    `);
  } else {
    await db.execute(sql6`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes)
      WHERE id = ${input.id}
    `);
  }
  if (input.status === "shipped") {
    for (const item of details.items ?? []) {
      const quantity = Number(item.quantityApproved ?? item.quantityRequested ?? 0);
      const productId = Number(item.distributionProductId ?? item.ingredientId);
      if (quantity <= 0 || productId <= 0) continue;
      await db.execute(sql6.raw(`
        UPDATE distribution_products
        SET availableQuantity = GREATEST(CAST(availableQuantity AS DECIMAL(12,3)) - ${quantity}, 0)
        WHERE id = ${productId}
      `));
    }
  }
  if (input.status === "received") {
    for (const item of details.items ?? []) {
      const quantity = Number(item.quantityApproved ?? item.quantityRequested ?? 0);
      if (quantity <= 0) continue;
      const storeId = Number(details.storeId);
      const productName = String(item.productName ?? item.distributionProductName ?? "Produto CD");
      const unit = String(item.unit ?? "unit");
      const unitCost = money(item.unitCost).toFixed(4);
      const existingIngredientResult = await db.execute(sql6`
        SELECT id, currentStock
        FROM ingredients
        WHERE storeId = ${storeId}
          AND name = ${productName}
          AND unit = ${unit}
        LIMIT 1
      `);
      const existingIngredient = existingIngredientResult[0] ?? [];
      let ingredientId = Number(existingIngredient[0]?.id ?? 0);
      if (!ingredientId) {
        const inserted = await db.execute(sql6`
          INSERT INTO ingredients (storeId, name, category, unit, currentStock, minimumStock, unitCost, supplier, notes, active)
          VALUES (${storeId}, ${productName}, ${"CD"}, ${unit}, ${"0.000"}, ${"0.000"}, ${unitCost}, ${"Centro de Distribui\xE7\xE3o"}, ${`Criado automaticamente no recebimento do pedido ao CD #${input.id}`}, ${true})
        `);
        ingredientId = Number(inserted[0]?.insertId ?? 0);
      }
      await db.execute(sql6`
        UPDATE ingredients
        SET currentStock = CAST(currentStock AS DECIMAL(12,3)) + ${quantity}, unitCost = ${unitCost}
        WHERE id = ${ingredientId}
      `);
      await db.execute(sql6`
        INSERT INTO inventory_movements
          (ingredientId, storeId, movementType, quantityDelta, previousStock, nextStock, reason, performedByUserId)
        SELECT id, ${storeId}, 'entry', ${quantity.toFixed(3)},
          CAST(currentStock AS DECIMAL(12,3)) - ${quantity},
          currentStock,
          ${`Recebimento do pedido ao CD #${input.id}`},
          ${actorUserId}
        FROM ingredients
        WHERE id = ${ingredientId}
      `);
    }
  }
  await audit({ actorUserId, storeId: Number(details.storeId), action: `supply_order.${input.status}`, entityType: "store_supply_order", entityId: input.id, metadata: { notes: input.notes } });
  return { ok: true };
}
var createExpenseSchema = z6.object({
  storeId: z6.number().int().positive().optional(),
  category: z6.string().min(1).max(120),
  description: z6.string().min(1).max(255),
  amount: z6.string().regex(/^\d+(\.\d{1,2})?$/),
  paymentMethod: z6.string().max(80).optional(),
  status: z6.enum(["pending", "paid", "cancelled"]).optional(),
  expenseDate: z6.date(),
  receiptUrl: z6.string().url().optional(),
  notes: z6.string().max(5e3).optional()
});
async function createExpense(input, actorUserId, scopedStoreId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId ?? input.storeId ?? null;
  const result = await db.execute(sql6`
    INSERT INTO network_expenses
      (storeId, category, description, amount, paymentMethod, status, expenseDate, receiptUrl, createdByUserId, notes)
    VALUES
      (${storeId}, ${input.category}, ${input.description}, ${input.amount}, ${input.paymentMethod ?? null}, ${input.status ?? "paid"}, ${toSqlDate(input.expenseDate).slice(0, 10)}, ${input.receiptUrl ?? null}, ${actorUserId}, ${input.notes ?? null})
  `);
  const id = Number(result[0]?.insertId ?? 0);
  await audit({ actorUserId, storeId, action: "expense.create", entityType: "network_expense", entityId: id, metadata: input });
  return { id };
}
var createFinancialFeeSchema = z6.object({
  storeId: z6.number().int().positive().optional(),
  name: z6.string().min(1).max(160),
  category: z6.string().min(1).max(120),
  calculationType: z6.enum(["fixed", "percentage"]).default("fixed"),
  rate: z6.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  amount: z6.string().regex(/^\d+(\.\d{1,2})?$/),
  periodStart: z6.date(),
  periodEnd: z6.date(),
  notes: z6.string().max(5e3).optional()
});
async function createFinancialFee(input, actorUserId, scopedStoreId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId ?? input.storeId ?? null;
  const result = await db.execute(sql6`
    INSERT INTO network_financial_fees
      (storeId, name, category, calculationType, rate, amount, periodStart, periodEnd, notes, createdByUserId)
    VALUES
      (${storeId}, ${input.name}, ${input.category}, ${input.calculationType}, ${input.rate ?? "0"}, ${input.amount}, ${toSqlDate(input.periodStart).slice(0, 10)}, ${toSqlDate(input.periodEnd).slice(0, 10)}, ${input.notes ?? null}, ${actorUserId})
  `);
  const id = Number(result[0]?.insertId ?? 0);
  await audit({ actorUserId, storeId, action: "fee.create", entityType: "network_financial_fee", entityId: id, metadata: input });
  return { id };
}
async function getFinancialOverview(opts) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return { totals: {}, expenses: [], fees: [], supplyOrders: [], storeRanking: [] };
  const start = toSqlDate(opts.startDate);
  const end = toSqlDate(opts.endDate);
  const storeFilter = opts.storeId ? `AND storeId = ${opts.storeId}` : "";
  const nullableStoreFilter = opts.storeId ? `AND (storeId = ${opts.storeId} OR storeId IS NULL)` : "";
  const [revenue] = await executeRows(db, `
    SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
    FROM orders
    WHERE createdAt BETWEEN '${start}' AND '${end}' ${storeFilter} AND status <> 'cancelled'
  `);
  const [expenses] = await executeRows(db, `
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM network_expenses
    WHERE expenseDate BETWEEN '${start.slice(0, 10)}' AND '${end.slice(0, 10)}' ${nullableStoreFilter} AND status <> 'cancelled'
  `);
  const [fees] = await executeRows(db, `
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM network_financial_fees
    WHERE periodStart <= '${end.slice(0, 10)}' AND periodEnd >= '${start.slice(0, 10)}' ${nullableStoreFilter}
  `);
  const [supply] = await executeRows(db, `
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
      marginPercent: revenueTotal > 0 ? Number((netResult / revenueTotal * 100).toFixed(2)) : 0
    },
    expensesByCategory,
    storeRanking,
    supplyOrders
  };
}
var createMonthlyClosingSchema = z6.object({
  storeId: z6.number().int().positive().optional(),
  year: z6.number().int().min(2020).max(2100),
  month: z6.number().int().min(1).max(12),
  status: z6.enum(["open", "in_review", "closed", "reopened"]).default("in_review"),
  notes: z6.string().max(5e3).optional()
});
async function upsertMonthlyClosing(input, actorUserId, scopedStoreId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId ?? input.storeId ?? null;
  const start = new Date(input.year, input.month - 1, 1);
  const end = new Date(input.year, input.month, 0, 23, 59, 59);
  const overview = await getFinancialOverview({ storeId: storeId ?? void 0, startDate: start, endDate: end });
  const totals = overview.totals;
  const closedAt = input.status === "closed" ? "CURRENT_TIMESTAMP" : "NULL";
  await db.execute(sql6.raw(`
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
async function listMonthlyClosings(opts) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    opts.storeId ? `c.storeId = ${opts.storeId}` : "",
    opts.year ? `c.year = ${opts.year}` : ""
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
async function listAuditLogs(opts) {
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

// server/focusnfe.ts
init_db();
init_schema();
import { eq as eq10 } from "drizzle-orm";
function getFocusNfeBaseUrl() {
  const env = process.env.FOCUS_NFE_ENV || "homologacao";
  return env === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
}
function mapPaymentMethod(method) {
  switch (method) {
    case "credit_card":
      return "03";
    case "debit_card":
      return "04";
    case "pix":
      return "17";
    case "cash":
      return "01";
    default:
      return "99";
  }
}
async function emitirNfce(orderId) {
  const db = await getDb();
  if (!db) return { success: false, error: "DB indispon\xEDvel" };
  const [orderRow] = await db.select().from(orders).where(eq10(orders.id, orderId));
  if (!orderRow) return { success: false, error: "Pedido n\xE3o encontrado" };
  const items = await db.select().from(orderItems).where(eq10(orderItems.orderId, orderId));
  const storeRow = orderRow.storeId ? (await db.select().from(stores).where(eq10(stores.id, orderRow.storeId)))[0] : null;
  if (!storeRow?.nfceEnabled) {
    return { success: false, error: "NFC-e n\xE3o habilitada para esta loja" };
  }
  if (!storeRow.focusNfeToken || !storeRow.cnpj || !storeRow.csc || !storeRow.cscId) {
    return { success: false, error: "Dados fiscais da loja incompletos (token, CNPJ, CSC)" };
  }
  const nfceItems = items.map((item, idx) => ({
    numero_item: idx + 1,
    codigo_produto: String(item.productId),
    descricao: item.productName,
    cfop: "5102",
    unidade_comercial: "UN",
    quantidade_comercial: item.quantity,
    valor_unitario_comercial: parseFloat(String(item.productPrice)),
    valor_bruto: parseFloat(String(item.subtotal)),
    icms_situacao_tributaria: "102",
    icms_origem: 0,
    pis_situacao_tributaria: "07",
    cofins_situacao_tributaria: "07"
  }));
  const subtotal = parseFloat(String(orderRow.subtotal));
  const discount = parseFloat(String(orderRow.discountAmount || 0)) + parseFloat(String(orderRow.pointsDiscount || 0));
  const deliveryFee = parseFloat(String(orderRow.deliveryFee || 0));
  const total = parseFloat(String(orderRow.total));
  const referencia = `bonatto_${orderId}_${Date.now()}`;
  const payload = {
    numero: orderId,
    serie: "001",
    data_emissao: (/* @__PURE__ */ new Date()).toISOString(),
    consumidor_final: 1,
    presenca_comprador: 4,
    natureza_operacao: "Venda ao consumidor",
    forma_pagamento: 0,
    cnpj_emitente: storeRow.cnpj.replace(/\D/g, ""),
    inscricao_estadual_emitente: storeRow.inscricaoEstadual || "ISENTO",
    regime_tributario_emitente: storeRow.regimeTributario || 1,
    csc_emitente: storeRow.csc,
    id_token_csc_emitente: storeRow.cscId,
    items: nfceItems,
    formas_pagamento: [
      {
        forma_pagamento: mapPaymentMethod(orderRow.paymentMethod),
        valor_pagamento: total
      }
    ],
    valor_produtos: subtotal,
    valor_desconto: discount > 0 ? discount : 0,
    valor_total: total,
    valor_frete: deliveryFee
  };
  if (orderRow.customerCpf) {
    payload.cpf_destinatario = orderRow.customerCpf.replace(/\D/g, "");
    payload.nome_destinatario = orderRow.customerName;
  }
  const baseUrl = getFocusNfeBaseUrl();
  const url = `${baseUrl}/v2/nfce?ref=${referencia}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${storeRow.focusNfeToken}:`).toString("base64")
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.status === "autorizado" || data.status === "processado") {
      await db.update(orders).set({
        nfceKey: data.chave_nfe,
        nfceStatus: "authorized",
        nfceUrl: data.url_danfe || data.caminho_danfe
      }).where(eq10(orders.id, orderId));
      return {
        success: true,
        chave: data.chave_nfe,
        urlDanfe: data.url_danfe || data.caminho_danfe
      };
    }
    const errorMsg = data.mensagem_sefaz || (Array.isArray(data.erros) ? data.erros.map((e) => e.mensagem).join("; ") : null) || `Status: ${data.status}`;
    await db.update(orders).set({ nfceStatus: "error" }).where(eq10(orders.id, orderId));
    return { success: false, error: errorMsg };
  } catch (err) {
    console.error("[FocusNFe] Erro ao emitir NFC-e:", err);
    return { success: false, error: err.message || "Erro de conex\xE3o com Focus NFe" };
  }
}
async function cancelarNfce(orderId, justificativa) {
  const db = await getDb();
  if (!db) return { success: false, error: "DB indispon\xEDvel" };
  const [orderRow] = await db.select().from(orders).where(eq10(orders.id, orderId));
  if (!orderRow?.nfceKey) return { success: false, error: "NFC-e n\xE3o emitida para este pedido" };
  const storeRow = orderRow.storeId ? (await db.select().from(stores).where(eq10(stores.id, orderRow.storeId)))[0] : null;
  if (!storeRow?.focusNfeToken) return { success: false, error: "Token Focus NFe n\xE3o configurado" };
  const referencia = `bonatto_${orderId}`;
  const baseUrl = getFocusNfeBaseUrl();
  const url = `${baseUrl}/v2/nfce/${referencia}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${storeRow.focusNfeToken}:`).toString("base64")
      },
      body: JSON.stringify({ justificativa })
    });
    const data = await response.json();
    if (data.status === "cancelado") {
      await db.update(orders).set({ nfceStatus: "cancelled" }).where(eq10(orders.id, orderId));
      return { success: true };
    }
    return { success: false, error: data.mensagem_sefaz || "Erro ao cancelar NFC-e" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// server/routers.ts
import bcrypt from "bcryptjs";
import crypto3 from "crypto";

// server/_core/mailer.ts
init_env();
import { Resend } from "resend";
var resend = ENV.resendApiKey ? new Resend(ENV.resendApiKey) : null;
async function sendPasswordResetEmail(to, name, resetUrl) {
  if (!resend) {
    console.warn("[Mailer] Resend not configured, skipping email.");
    return;
  }
  const { error } = await resend.emails.send({
    from: ENV.emailFrom,
    to,
    subject: "Redefinir senha \u2014 Bonatto Pizza",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
                  <!-- Header -->
                  <tr>
                    <td style="background:#c0392b;padding:32px 40px;text-align:center;">
                      <div style="font-size:32px;margin-bottom:8px;">\u{1F355}</div>
                      <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Bonatto Pizza</div>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;">Ol\xE1, ${name}!</h1>
                      <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                        Recebemos uma solicita\xE7\xE3o para redefinir a senha da sua conta na Bonatto Pizza.
                        Clique no bot\xE3o abaixo para criar uma nova senha.
                      </p>
                      <div style="text-align:center;margin:32px 0;">
                        <a href="${resetUrl}"
                           style="background:#c0392b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
                          Redefinir minha senha
                        </a>
                      </div>
                      <p style="color:#666;font-size:13px;line-height:1.6;margin:0;">
                        Este link expira em <strong style="color:#aaa;">1 hora</strong>.<br/>
                        Se voc\xEA n\xE3o solicitou a redefini\xE7\xE3o, ignore este e-mail \u2014 sua senha permanece a mesma.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
                      <p style="color:#555;font-size:12px;margin:0;">
                        \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Bonatto Pizza \xB7 Mateus Leme/MG
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  });
  if (error) {
    console.error("[Mailer] Failed to send password reset email:", error);
    throw new Error("Falha ao enviar e-mail de redefini\xE7\xE3o de senha");
  }
}
async function sendWelcomeEmail(to, name) {
  if (!resend) {
    console.warn("[Mailer] Resend not configured, skipping email.");
    return;
  }
  await resend.emails.send({
    from: ENV.emailFrom,
    to,
    subject: "Bem-vindo \xE0 Bonatto Pizza! \u{1F355}",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
                  <tr>
                    <td style="background:#c0392b;padding:32px 40px;text-align:center;">
                      <div style="font-size:32px;margin-bottom:8px;">\u{1F355}</div>
                      <div style="color:#fff;font-size:22px;font-weight:700;">Bonatto Pizza</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;">Bem-vindo, ${name}! \u{1F389}</h1>
                      <p style="color:#aaa;font-size:15px;line-height:1.6;margin:0 0 24px;">
                        Sua conta foi criada com sucesso. Agora voc\xEA pode fazer pedidos, acompanhar entregas
                        e aproveitar cupons exclusivos para clientes cadastrados.
                      </p>
                      <div style="background:#111;border:1px solid #2a2a2a;border-radius:10px;padding:20px;margin-bottom:24px;">
                        <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 8px;">\u{1F381} Seu cupom de boas-vindas</p>
                        <div style="background:#c0392b;color:#fff;font-size:20px;font-weight:700;letter-spacing:2px;text-align:center;padding:12px;border-radius:6px;">
                          PRIMEIROSITE10
                        </div>
                        <p style="color:#aaa;font-size:12px;margin:8px 0 0;text-align:center;">10% de desconto no seu primeiro pedido</p>
                      </div>
                      <p style="color:#666;font-size:13px;line-height:1.6;margin:0;">
                        D\xFAvidas? Fale com a gente pelo WhatsApp.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
                      <p style="color:#555;font-size:12px;margin:0;">\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Bonatto Pizza \xB7 Mateus Leme/MG</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  });
}

// server/orderLifecycle.ts
init_schema();
init_db();
import { and as and8, eq as eq11, sql as sql7 } from "drizzle-orm";
var STAGE_BY_STATUS = {
  pending: "created",
  confirmed: "confirmed",
  preparing: "preparing",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled"
};
function parseIntegerSetting(raw, fallback) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
function buildPredictionLabel(serviceType, minMinutes, maxMinutes) {
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
async function computePredictionWindow(order) {
  const db = await getDb();
  if (!db) return null;
  const settings = await getAllStoreSettings();
  const basePrepMinutes = parseIntegerSetting(settings.prepBaseMinutes, 20);
  const baseDeliveryMinutes = parseIntegerSetting(settings.deliveryBaseMinutes, 20);
  const peakExtraMinutes = parseIntegerSetting(settings.peakExtraMinutes, 10);
  const queueExtraPerOrder = parseIntegerSetting(settings.orderVolumeExtraMinutesPerOrder, 3);
  const activeRows = await db.select({ id: orders.id }).from(orders).where(
    and8(
      order.storeId ? eq11(orders.storeId, order.storeId) : void 0,
      sql7`${orders.status} IN ('pending', 'confirmed', 'preparing', 'out_for_delivery')`
    )
  );
  const queuePressure = Math.max(0, activeRows.length - 1);
  const now = /* @__PURE__ */ new Date();
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
    queuePressure
  };
}
async function syncCustomerMetricsForScope(userId, scopeStoreId) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.execute(sql7`
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
  const stats = rows[0]?.[0];
  if (!stats) return;
  const totalOrders = Number(stats.totalOrders ?? 0);
  const deliveredOrders = Number(stats.deliveredOrders ?? 0);
  const cancelledOrders = Number(stats.cancelledOrders ?? 0);
  const totalSpent = Number(stats.totalSpent ?? 0);
  const averageTicket = Number(stats.averageTicket ?? 0);
  const firstOrderCount = deliveredOrders > 0 ? 1 : 0;
  const existing = await db.select({ id: customerMetrics.id }).from(customerMetrics).where(and8(eq11(customerMetrics.userId, userId), eq11(customerMetrics.storeId, scopeStoreId))).limit(1);
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
    favoriteNeighborhood: stats.favoriteNeighborhood ?? null,
    favoriteOrderDay: stats.favoriteOrderDay ?? null,
    favoriteOrderHour: stats.favoriteOrderHour == null ? null : Number(stats.favoriteOrderHour),
    favoriteProductName: stats.favoriteProductName ?? null
  };
  if (existing.length > 0) {
    await db.update(customerMetrics).set(payload).where(eq11(customerMetrics.id, existing[0].id));
    return;
  }
  await db.insert(customerMetrics).values(payload);
}
async function recordProductivityEvent(order, nextStatus, now) {
  const db = await getDb();
  if (!db) return;
  const events = [];
  if (nextStatus === "confirmed") {
    events.push({
      eventType: "acceptance_time",
      valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 1e3))
    });
  }
  if (nextStatus === "out_for_delivery") {
    const prepStart = order.preparingAt ?? order.confirmedAt ?? order.createdAt;
    events.push({
      eventType: "prep_time",
      valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(prepStart).getTime()) / 1e3))
    });
  }
  if (nextStatus === "delivered") {
    if (order.outForDeliveryAt) {
      events.push({
        eventType: "delivery_time",
        valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(order.outForDeliveryAt).getTime()) / 1e3))
      });
    }
    events.push({
      eventType: "total_time",
      valueSeconds: Math.max(0, Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 1e3))
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
      metadata: JSON.stringify({ status: nextStatus })
    }))
  );
}
async function syncCustomerMetricsForOrder(order) {
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
async function bootstrapOrderLifecycle(orderId, opts) {
  try {
    const db = await getDb();
    if (!db) return;
    const order = await getOrderById(orderId);
    if (!order) return;
    const existingCreatedLog = await db.select({ id: orderStageLogs.id }).from(orderStageLogs).where(and8(eq11(orderStageLogs.orderId, orderId), eq11(orderStageLogs.stage, "created"))).limit(1);
    if (existingCreatedLog.length === 0) {
      await db.insert(orderStageLogs).values({
        orderId,
        previousStatus: null,
        nextStatus: order.status,
        stage: "created",
        source: "system",
        metadata: JSON.stringify({ serviceType: order.serviceType })
      });
    }
    if (!opts?.skipPrediction) {
      const prediction = await computePredictionWindow(order);
      if (prediction) {
        const now = /* @__PURE__ */ new Date();
        const readyAt = new Date(now.getTime() + prediction.minMinutes * 6e4);
        const deliveredAt = new Date(now.getTime() + prediction.maxMinutes * 6e4);
        await db.insert(deliveryPredictions).values({
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
          computedAt: now
        }).onDuplicateKeyUpdate({
          set: {
            predictionLabel: prediction.predictionLabel,
            minMinutes: prediction.minMinutes,
            maxMinutes: prediction.maxMinutes,
            prepBaseMinutes: prediction.prepBaseMinutes,
            deliveryBaseMinutes: prediction.deliveryBaseMinutes,
            queuePressure: prediction.queuePressure,
            neighborhood: order.deliveryNeighborhood ?? null,
            computedAt: now
          }
        });
        await db.update(orders).set({
          predictionLabel: prediction.predictionLabel,
          predictedReadyAt: readyAt,
          predictedDeliveredAt: deliveredAt
        }).where(eq11(orders.id, orderId));
      }
    }
    if (!opts?.skipCustomerMetrics) {
      await syncCustomerMetricsForOrder(order);
    }
  } catch (error) {
    console.warn("[orderLifecycle] bootstrapOrderLifecycle skipped:", error);
  }
}
async function applyOrderStatusLifecycle(orderId, previousStatus, nextStatus, opts) {
  try {
    const db = await getDb();
    if (!db) return;
    const order = await getOrderById(orderId);
    if (!order) return;
    const now = /* @__PURE__ */ new Date();
    const patch = {};
    if (nextStatus === "confirmed") patch.confirmedAt = now;
    if (nextStatus === "preparing") patch.preparingAt = now;
    if (nextStatus === "out_for_delivery") patch.outForDeliveryAt = now;
    if (nextStatus === "delivered") patch.deliveredAt = now;
    if (nextStatus === "cancelled") patch.cancelledAt = now;
    if (Object.keys(patch).length > 0) {
      await db.update(orders).set(patch).where(eq11(orders.id, orderId));
    }
    await db.insert(orderStageLogs).values({
      orderId,
      previousStatus,
      nextStatus,
      stage: STAGE_BY_STATUS[nextStatus],
      source: opts?.source ?? "system",
      changedByUserId: opts?.actorUserId ?? null,
      notes: opts?.notes ?? null,
      metadata: JSON.stringify({ previousStatus, nextStatus })
    });
    const freshOrder = await getOrderById(orderId);
    if (freshOrder) {
      if (nextStatus === "confirmed" || nextStatus === "preparing" && previousStatus === "pending") {
        await consumeInventoryForOrder(orderId);
      }
      if (nextStatus === "cancelled") {
        await reverseInventoryForOrder(orderId);
      }
      await recordProductivityEvent(freshOrder, nextStatus, now);
      await bootstrapOrderLifecycle(orderId, {
        skipPrediction: opts?.skipPrediction,
        skipCustomerMetrics: opts?.skipCustomerMetrics
      });
      if (!opts?.skipCustomerMetrics) {
        await syncCustomerMetricsForOrder(freshOrder);
      }
    }
  } catch (error) {
    console.warn("[orderLifecycle] applyOrderStatusLifecycle skipped:", error);
  }
}

// server/routers.ts
init_db();
var notifyOwner3 = (payload) => notifyOwnerAdapter({ title: payload.title, body: payload.content });
var adminProcedure3 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});
async function assertPaymentMethodEnabled(paymentMethod) {
  const publicPaymentSettings = await getPaymentSettingsPublic();
  const orderConfig = publicPaymentSettings.config.orders;
  if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && !orderConfig.cardEnabled) {
    throw new TRPCError7({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos por cart\xE3o est\xE3o desativados no momento."
    });
  }
  if (paymentMethod === "pix" && !orderConfig.pixEnabled) {
    throw new TRPCError7({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos via PIX est\xE3o desativados no momento."
    });
  }
  if (paymentMethod === "cash" && !orderConfig.cashEnabled) {
    throw new TRPCError7({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos em dinheiro est\xE3o desativados no momento."
    });
  }
  return publicPaymentSettings;
}
async function seedMenuData() {
  const cats = await getCategories(false);
  if (cats.length > 0) return;
  const categoryData = [
    { name: "Promo\xE7\xF5es", slug: "promocoes", description: "Ofertas especiais da Bonatto", sortOrder: 1 },
    { name: "Pizzas", slug: "pizzas", description: "Nossas deliciosas pizzas artesanais", sortOrder: 2 },
    { name: "Calzones", slug: "calzones", description: "Duplonatto - nossa vers\xE3o especial de calzone", sortOrder: 3 },
    { name: "Lasanhas", slug: "lasanhas", description: "Lasanhas caseiras com massa fresca", sortOrder: 4 },
    { name: "Empanados", slug: "empanados", description: "Empanados da Bonatto", sortOrder: 5 },
    { name: "Sorvetes", slug: "sorvetes", description: "Sorvetes artesanais", sortOrder: 6 },
    { name: "Bebidas", slug: "bebidas", description: "Refrigerantes e sucos", sortOrder: 7 },
    { name: "Extras", slug: "extras", description: "Molhos e acompanhamentos", sortOrder: 8 }
  ];
  for (const cat of categoryData) {
    await createCategory({ ...cat, active: true });
  }
  const allCats = await getCategories(false);
  const catMap = {};
  for (const c of allCats) catMap[c.slug] = c.id;
  const productData = [
    // Promoções
    { categoryId: catMap["promocoes"], name: "Duas Gigantes", description: "Segunda a quinta-feira! Duas pizzas gigantes com 8 fatias cada. Escolha dois sabores.", price: "89.90", featured: true },
    { categoryId: catMap["promocoes"], name: "Pizza GG + Kuat 2L", description: "1 Pizza Gigante + 1 Kuat 2L por apenas R$ 79,90! Escolha o sabor da sua pizza.", price: "79.90", featured: true },
    { categoryId: catMap["promocoes"], name: "Calzone & Coca", description: "Ao comprar um delicioso calzone, voc\xEA ganha uma Coca-Cola de 350ml totalmente GR\xC1TIS!", price: "34.90", featured: true },
    // Pizzas
    { categoryId: catMap["pizzas"], name: "Pizza Gigante - 8 fatias", description: "Familiar: 8 fatias generosas, ideal para um banquete com todos que voc\xEA ama. Inclui 4 sach\xEAs de maionese e ketchup Heinz.", price: "59.90" },
    { categoryId: catMap["pizzas"], name: "Pizza Grande - 6 fatias", description: "Grande: 6 fatias, perfeita para dividir com amigos e fam\xEDlia. Inclui 4 sach\xEAs de maionese e ketchup Heinz.", price: "54.90" },
    { categoryId: catMap["pizzas"], name: "Pizza Pequena - 4 fatias", description: "Pequena: 4 fatias, ideal para um lanche r\xE1pido ou para compartilhar com algu\xE9m especial. Inclui 4 sach\xEAs de maionese e ketchup Heinz.", price: "48.90" },
    // Calzones
    { categoryId: catMap["calzones"], name: "Calzone de Frango Defumado", description: "Duplonatto! Molho artesanal de tomate, mu\xE7arela derretida e frango defumado. Sugest\xE3o: combinar com Cream Cheese. Aprox. 3 fatias.", price: "34.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Costelinha", description: "Duplonatto! Molho artesanal, mu\xE7arela, costelinhas desfiadas e molho barbecue. Aprox. 3 fatias.", price: "34.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Carne Seca", description: "Duplonatto! Molho artesanal, mu\xE7arela, carne seca suculenta e pimenta biquinho. Sugest\xE3o: combinar com Catupiry. Aprox. 3 fatias.", price: "34.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Frango com Mu\xE7arela", description: "Duplonatto! Molho artesanal, mu\xE7arela e frango desfiado suculento. Personalize com ingredientes de sua prefer\xEAncia. Aprox. 3 fatias.", price: "32.90" },
    { categoryId: catMap["calzones"], name: "Calzone de Presunto e Mu\xE7arela", description: "Duplonatto! Molho artesanal, mu\xE7arela e presunto. Personalize com adicional de sua prefer\xEAncia. Aprox. 3 fatias.", price: "32.90" },
    // Lasanhas
    { categoryId: catMap["lasanhas"], name: "Lasanha \xE0 Bolonhesa", description: "Molho \xE0 bolonhesa caseiro, massa fresca e mu\xE7arela. Camadas de massa fresca intercaladas com nosso molho especial.", price: "42.90" },
    { categoryId: catMap["lasanhas"], name: "Lasanha de Frango com Catupiry", description: "Camadas de massa fresca recheadas com frango desfiado temperado, catupiry original e mu\xE7arela.", price: "42.90" },
    // Empanados
    { categoryId: catMap["empanados"], name: "Frango Americano", description: "Aproximadamente 950g de coxinha da asa frita acompanhada de nosso exclusivo molho artesanal.", price: "49.90" },
    // Sorvetes
    { categoryId: catMap["sorvetes"], name: "Raffaello", description: "Sorvete sabor creme com peda\xE7os de chocolate branco e coco. Inspirado no famoso bombom.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Ninho com Nutella", description: "Sorvete sabor ninho mesclado com Nutella. Cremosidade do leite ninho com a indulg\xEAncia da Nutella.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Jamaica Albino", description: "Sorvete de chocolate branco com peda\xE7os de chocolate branco, amendoim e uvas passas.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Iogurte Grego com Frutas Vermelhas", description: "Sorvete de iogurte grego mesclado com polpa de frutas vermelhas.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Maracuj\xE1", description: "Sorvete sabor mousse de maracuj\xE1 com polpa de maracuj\xE1. Refrescante e levemente \xE1cido.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Kinder", description: "Sorvete sabor chocolate branco com peda\xE7os de chocolate branco e chocolate ao leite.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Morango", description: "Sorvete artesanal de morango feito com frutas frescas e creme nobre.", price: "18.90" },
    { categoryId: catMap["sorvetes"], name: "Romeu e Julieta", description: "Sorvete que combina a suavidade cremosa do leite com a do\xE7ura da goiabada.", price: "18.90" },
    // Bebidas
    { categoryId: catMap["bebidas"], name: "Coca-Cola Lata 350ml", description: "Coca-Cola gelada em lata 350ml.", price: "5.25" },
    { categoryId: catMap["bebidas"], name: "Coca-Cola Sem A\xE7\xFAcar Lata 350ml", description: "Coca-Cola Zero A\xE7\xFAcar em lata 350ml.", price: "5.25" },
    { categoryId: catMap["bebidas"], name: "Mate Couro 1L", description: "Ch\xE1 mate gelado 1L.", price: "6.45" },
    { categoryId: catMap["bebidas"], name: "Sprite Fresh Lim\xE3o 1,5L", description: "Sprite sabor lim\xE3o fresco 1,5L.", price: "9.95" },
    { categoryId: catMap["bebidas"], name: "Coca-Cola Sem A\xE7\xFAcar 1,5L", description: "Coca-Cola Zero A\xE7\xFAcar 1,5L.", price: "13.40" },
    { categoryId: catMap["bebidas"], name: "Coca-Cola 2L", description: "Coca-Cola garrafa 2L.", price: "15.20" },
    { categoryId: catMap["bebidas"], name: "Fanta Laranja 2L", description: "Fanta Laranja garrafa 2L.", price: "12.00" },
    { categoryId: catMap["bebidas"], name: "Guaran\xE1 Kuat 2L", description: "Guaran\xE1 Kuat garrafa 2L.", price: "9.90" },
    { categoryId: catMap["bebidas"], name: "Guaran\xE1 Antarctica 2L", description: "Guaran\xE1 Antarctica garrafa 2L.", price: "11.15" },
    { categoryId: catMap["bebidas"], name: "Del Valle Laranja 1L", description: "Suco Del Valle Frut sabor laranja 1L.", price: "7.60" },
    { categoryId: catMap["bebidas"], name: "Del Valle Uva 1L", description: "Suco Del Valle Frut sabor uva 1L.", price: "7.60" },
    // Extras
    { categoryId: catMap["extras"], name: "4 Sach\xEAs de Maionese Heinz", description: "4 sach\xEAs de maionese Heinz.", price: "1.00" },
    { categoryId: catMap["extras"], name: "4 Sach\xEAs de Ketchup Heinz", description: "4 sach\xEAs de ketchup Heinz.", price: "1.00" },
    { categoryId: catMap["extras"], name: "Molho Artesanal 100ml", description: "Molho especial artesanal 100ml.", price: "3.00" },
    { categoryId: catMap["extras"], name: "Molho Mexicano", description: "Molho artesanal levemente apimentado.", price: "3.00" },
    { categoryId: catMap["extras"], name: "Molho Barbecue Heinz 100ml", description: "Molho barbecue Heinz 100ml.", price: "3.50" }
  ];
  for (const prod of productData) {
    await createProduct({ ...prod, active: true, featured: prod.featured ?? false, sortOrder: 0 });
  }
}
if (process.env.NODE_ENV !== "production") {
  seedMenuData().catch(console.error);
  (async () => {
    try {
      const existing = await getCouponByCode("BONATTO10");
      if (!existing) {
        await createCoupon({
          code: "BONATTO10",
          discountType: "percentage",
          discountValue: "10",
          minOrderValue: "0",
          maxUses: void 0,
          active: true,
          usedCount: 0
        });
      }
    } catch (err) {
      console.error("[seed] BONATTO10 coupon seed failed:", err);
    }
  })();
}
var DAY_NAMES_SERVER = ["Domingo", "Segunda", "Ter\xE7a", "Quarta", "Quinta", "Sexta", "S\xE1bado"];
function buildHoursDescription(storeHoursJson) {
  if (!storeHoursJson) return "Ter\xE7a a domingo, 18h \xE0s 23h";
  try {
    const hours = JSON.parse(storeHoursJson);
    const lines = [];
    for (let d = 0; d < 7; d++) {
      const s = hours[String(d)];
      if (s) lines.push(`${DAY_NAMES_SERVER[d]}: ${s.open} \xE0s ${s.close}`);
      else lines.push(`${DAY_NAMES_SERVER[d]}: fechado`);
    }
    return lines.join(", ");
  } catch {
    return "Ter\xE7a a domingo, 18h \xE0s 23h";
  }
}
function normalizePhone(raw) {
  return raw.replace(/\D+/g, "");
}
function hashOtpCode(code) {
  return crypto3.createHash("sha256").update(code).digest("hex");
}
function getPizzaCategoryIds(categories2) {
  return new Set(
    categories2.filter((category) => {
      const haystack = `${category.slug} ${category.name}`.toLowerCase();
      return haystack.includes("pizza");
    }).map((category) => category.id)
  );
}
function getFreePizzaDiscountForCart(items, productMap, pizzaCategoryIds) {
  let maxEligiblePrice = 0;
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const product = productMap.get(item.productId);
    if (!product) continue;
    const isPizza = pizzaCategoryIds.has(product.categoryId) || product.name.toLowerCase().includes("pizza");
    if (!isPizza) continue;
    const unitPrice = parseFloat(product.price);
    if (Number.isFinite(unitPrice) && unitPrice > maxEligiblePrice) {
      maxEligiblePrice = unitPrice;
    }
  }
  return parseFloat(maxEligiblePrice.toFixed(2));
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = u;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    registerEmail: publicProcedure.input(z7.object({
      name: z7.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      email: z7.string().email("E-mail inv\xE1lido"),
      password: z7.string().min(6, "Senha deve ter pelo menos 6 caracteres")
    })).mutation(async ({ input, ctx }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError7({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `email_${crypto3.randomBytes(16).toString("hex")}`;
      await createEmailUser({ openId, name: input.name, email: input.email, passwordHash });
      sendWelcomeEmail(input.email, input.name).catch(console.error);
      const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: DEFAULT_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    }),
    loginEmail: publicProcedure.input(z7.object({
      email: z7.string().email("E-mail inv\xE1lido"),
      password: z7.string().min(1)
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      }
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: DEFAULT_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    }),
    forgotPassword: publicProcedure.input(z7.object({
      email: z7.string().email("E-mail inv\xE1lido")
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user) return { success: true, emailSent: false };
      const token = crypto3.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
      await saveResetToken(input.email, token, expiresAt);
      const configured = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
      let origin = configured;
      if (!origin) {
        if (process.env.NODE_ENV === "production") {
          console.error("[forgotPassword] PUBLIC_APP_URL n\xE3o configurado em produ\xE7\xE3o.");
          throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Servidor n\xE3o configurado para envio de e-mail." });
        }
        origin = `${ctx.req.protocol}://${ctx.req.get("host") ?? "localhost"}`;
      }
      const resetUrl = `${origin}/reset-password?token=${token}`;
      let emailSent = false;
      try {
        await sendPasswordResetEmail(input.email, user.name ?? "Cliente", resetUrl);
        emailSent = true;
      } catch (emailError) {
        console.error("[forgotPassword] Email send failed:", emailError);
      }
      return { success: true, emailSent };
    }),
    resetPassword: publicProcedure.input(z7.object({
      token: z7.string().min(1),
      password: z7.string().min(6, "Senha deve ter pelo menos 6 caracteres")
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByResetToken(input.token);
      if (!user || !user.resetTokenExpiresAt) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Token inv\xE1lido ou expirado" });
      }
      if (/* @__PURE__ */ new Date() > user.resetTokenExpiresAt) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo link." });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      await updateUserPasswordHash(user.openId, passwordHash);
      await clearResetToken(user.openId);
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: DEFAULT_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    }),
    requestPhoneOtp: publicProcedure.input(z7.object({
      phone: z7.string().min(10, "Telefone inv\xE1lido"),
      purpose: z7.enum(["login", "verify_phone"]).optional()
    })).mutation(async ({ input, ctx }) => {
      const phone = normalizePhone(input.phone);
      if (phone.length < 10) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Telefone inv\xE1lido" });
      }
      const recentRequests = await countRecentOtpRequests(phone, 10);
      if (recentRequests >= 5) {
        throw new TRPCError7({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos." });
      }
      const existingUser = await getUserByPhone(phone);
      const code = String(Math.floor(1e5 + Math.random() * 9e5));
      const codeHash = hashOtpCode(code);
      await createOtpCode({
        userId: existingUser?.id ?? null,
        phone,
        purpose: input.purpose ?? "login",
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1e3),
        requestIp: ctx.req.ip ?? null,
        userAgent: ctx.req.get("user-agent") ?? null
      });
      let delivered = false;
      let provider = "whatsapp";
      try {
        await sendWhatsApp(phone, `Bonatto Pizza: seu c\xF3digo \xE9 ${code}. Ele expira em 10 minutos.`);
        delivered = true;
      } catch (error) {
        console.error("[auth.requestPhoneOtp] whatsapp send failed:", error);
        provider = "debug";
      }
      return {
        success: true,
        delivered,
        provider,
        previewCode: process.env.NODE_ENV === "production" ? void 0 : code
      };
    }),
    verifyPhoneOtp: publicProcedure.input(z7.object({
      phone: z7.string().min(10, "Telefone inv\xE1lido"),
      code: z7.string().length(6, "C\xF3digo inv\xE1lido"),
      purpose: z7.enum(["login", "verify_phone"]).optional(),
      name: z7.string().min(2).optional()
    })).mutation(async ({ input, ctx }) => {
      const phone = normalizePhone(input.phone);
      const otp = await getLatestOtpCode(phone, input.purpose ?? "login");
      if (!otp || otp.consumedAt || new Date(otp.expiresAt).getTime() < Date.now()) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "C\xF3digo expirado ou inv\xE1lido" });
      }
      if ((otp.attempts ?? 0) >= 5) {
        throw new TRPCError7({ code: "TOO_MANY_REQUESTS", message: "C\xF3digo bloqueado por excesso de tentativas" });
      }
      if (otp.codeHash !== hashOtpCode(input.code)) {
        await incrementOtpAttempts(otp.id);
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "C\xF3digo incorreto" });
      }
      await consumeOtpCode(otp.id);
      let user = await getUserByPhone(phone);
      if (!user) {
        user = await createPhoneUser({
          openId: `phone_${phone}_${crypto3.randomBytes(8).toString("hex")}`,
          name: input.name ?? "Cliente Bonatto",
          phone
        });
      }
      if (!user) {
        throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar usu\xE1rio por telefone" });
      }
      await linkCustomerAuthProvider({
        userId: user.id,
        provider: "phone",
        providerUserId: phone,
        providerPhone: phone,
        isPrimary: true
      });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "Cliente Bonatto",
        expiresInMs: DEFAULT_SESSION_MS
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    })
  }),
  // --- CATEGORIES -------------------------------------------------------------
  categories: router({
    list: publicProcedure.input(z7.object({ activeOnly: z7.boolean().optional() }).optional()).query(({ input }) => getCategories(input?.activeOnly ?? true)),
    listAll: staffProcedure.query(() => getCategories(false)),
    create: staffProcedure.input(
      z7.object({
        name: z7.string().min(1),
        slug: z7.string().min(1),
        description: z7.string().optional(),
        imageUrl: z7.string().max(2048).optional(),
        icon: z7.string().max(64).optional(),
        sortOrder: z7.number().optional()
      })
    ).mutation(({ input }) => createCategory({ ...input, active: true })),
    update: staffProcedure.input(
      z7.object({
        id: z7.number(),
        name: z7.string().optional(),
        description: z7.string().optional(),
        imageUrl: z7.string().max(2048).optional(),
        icon: z7.string().max(64).optional(),
        sortOrder: z7.number().optional(),
        active: z7.boolean().optional()
      })
    ).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateCategory(id, data);
    }),
    uploadImage: staffProcedure.input(z7.object({
      base64: z7.string().max(43e5),
      mimeType: z7.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z7.string().max(255).optional()
    })).mutation(async ({ input }) => {
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 82, 1400);
      const key = `categories/category-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] categoria comprimida ${reductionPct}% -> WebP`);
      return { url };
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(({ input }) => deleteCategory(input.id))
  }),
  // --- PRODUCTS ---------------------------------------------------------------
  products: router({
    list: publicProcedure.input(z7.object({ categoryId: z7.number().optional() }).optional()).query(({ input }) => getProducts({ categoryId: input?.categoryId, activeOnly: true })),
    listAll: staffProcedure.query(() => getProducts({ activeOnly: false })),
    byId: publicProcedure.input(z7.object({ id: z7.number() })).query(({ input }) => getProductById(input.id)),
    byIds: publicProcedure.input(z7.object({ ids: z7.array(z7.number()).max(100) })).query(({ input }) => getProductsByIds(Array.from(new Set(input.ids)))),
    create: staffProcedure.input(
      z7.object({
        categoryId: z7.number(),
        name: z7.string().min(1).max(200),
        description: z7.string().max(2e3).optional(),
        price: z7.string().regex(/^\d+(\.\d{1,2})?$/, "Pre\xE7o inv\xE1lido"),
        imageUrl: z7.string().max(2048).optional(),
        featured: z7.boolean().optional(),
        sortOrder: z7.number().int().optional()
      })
    ).mutation(({ input }) => createProduct({ ...input, active: true, featured: input.featured ?? false })),
    update: staffProcedure.input(
      z7.object({
        id: z7.number(),
        categoryId: z7.number().optional(),
        name: z7.string().min(1).max(200).optional(),
        description: z7.string().max(2e3).optional(),
        price: z7.string().regex(/^\d+(\.\d{1,2})?$/, "Pre\xE7o inv\xE1lido").optional(),
        imageUrl: z7.string().max(2048).optional(),
        featured: z7.boolean().optional(),
        active: z7.boolean().optional(),
        sortOrder: z7.number().int().optional()
      })
    ).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateProduct(id, data);
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(({ input }) => deleteProduct(input.id)),
    uploadImage: staffProcedure.input(z7.object({
      base64: z7.string().max(43e5),
      // keep below Vercel request-size limits
      mimeType: z7.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z7.string().max(255).optional()
    })).mutation(async ({ input, ctx }) => {
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 82, 1200);
      const key = `products/product-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] produto comprimido ${reductionPct}% \u2192 WebP`);
      return { url };
    })
  }),
  // --- COUPONS ----------------------------------------------------------------
  coupons: router({
    validate: publicProcedure.input(z7.object({ code: z7.string(), orderTotal: z7.number() })).mutation(async ({ input, ctx }) => {
      const coupon = await getCouponByCode(input.code);
      if (!coupon) throw new TRPCError7({ code: "NOT_FOUND", message: "Cupom n\xE3o encontrado" });
      if (!coupon.active) throw new TRPCError7({ code: "BAD_REQUEST", message: "Cupom inativo" });
      if (coupon.expiresAt && /* @__PURE__ */ new Date() > coupon.expiresAt)
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Cupom expirado" });
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Cupom esgotado" });
      const minOrder = parseFloat(coupon.minOrderValue ?? "0");
      if (input.orderTotal < minOrder)
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: `Pedido m\xEDnimo de R$ ${minOrder.toFixed(2)} para este cupom`
        });
      let discount = 0;
      if (coupon.discountType === "percentage") {
        discount = input.orderTotal * parseFloat(coupon.discountValue) / 100;
      } else {
        discount = parseFloat(coupon.discountValue);
      }
      return { valid: true, discount: Math.min(discount, input.orderTotal), coupon };
    }),
    list: staffProcedure.query(() => getAllCoupons()),
    // Public endpoint: returns only active global coupons (no userId) for display in customer panel
    listActive: protectedProcedure.query(
      () => getAllCoupons().then(
        (coupons2) => coupons2.filter((c) => c.active && !c.userId && (!c.expiresAt || /* @__PURE__ */ new Date() < c.expiresAt))
      )
    ),
    create: staffProcedure.input(
      z7.object({
        code: z7.string().min(1),
        discountType: z7.enum(["percentage", "fixed"]),
        discountValue: z7.string(),
        minOrderValue: z7.string().optional(),
        maxUses: z7.number().optional(),
        expiresAt: z7.date().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const result = await createCoupon({ ...input, active: true, usedCount: 0 });
      const discountText = input.discountType === "percentage" ? `${input.discountValue}% de desconto` : `R$ ${parseFloat(input.discountValue).toFixed(2)} de desconto`;
      await createClientAlert({
        type: "coupon",
        title: `\u{1F389} Novo cupom dispon\xEDvel!`,
        message: `Use o cupom **${input.code}** e ganhe ${discountText} no seu pedido.`,
        icon: "\u{1F389}",
        url: "/cardapio",
        expiresAt: input.expiresAt
      });
      return result;
    }),
    update: staffProcedure.input(z7.object({
      id: z7.number(),
      active: z7.boolean().optional(),
      maxUses: z7.number().int().min(0).optional(),
      discountType: z7.enum(["percentage", "fixed"]).optional(),
      discountValue: z7.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inv\xE1lido").optional(),
      minOrderValue: z7.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inv\xE1lido").optional(),
      expiresAt: z7.date().nullable().optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateCoupon(id, data);
    }),
    // Public: returns the home popup coupon only if it has been provisioned by an admin.
    // Nenhum side-effect aqui — cupons devem ser criados via seed/admin, não em leitura pública.
    getHomePopupCoupon: publicProcedure.query(async () => {
      const POPUP_CODE = "BONATTO10";
      const coupon = await getCouponByCode(POPUP_CODE);
      if (!coupon || !coupon.active) return null;
      if (coupon.expiresAt && /* @__PURE__ */ new Date() > coupon.expiresAt) return null;
      return {
        code: POPUP_CODE,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
        active: coupon.active
      };
    })
  }),
  // --- ORDERS -----------------------------------------------------------------
  orders: router({
    create: protectedProcedure.input(
      z7.object({
        customerName: z7.string().min(1).max(200),
        customerEmail: z7.string().email().max(320).optional(),
        customerPhone: z7.string().trim().max(30).refine((v) => {
          const digits = v.replace(/\D/g, "");
          return digits.length >= 10 && digits.length <= 15;
        }, { message: "Telefone inv\xE1lido. Informe DDD + n\xFAmero (10 a 15 d\xEDgitos)." }).optional(),
        deliveryAddress: z7.string().min(1).max(500),
        deliveryCity: z7.string().max(100).optional(),
        deliveryCep: z7.string().regex(/^\d{5}-?\d{3}$/, "CEP inv\xE1lido").optional(),
        deliveryNeighborhood: z7.string().max(100).optional(),
        deliveryComplement: z7.string().max(200).optional(),
        paymentMethod: z7.enum(["credit_card", "debit_card", "pix", "cash"]),
        couponCode: z7.string().max(50).optional(),
        pointsToRedeem: z7.number().int().min(0).max(5e3).optional(),
        notes: z7.string().max(1e3).optional(),
        // deliveryFeeOverride foi removido: taxa sempre calculada server-side a partir
        // do CEP/bairro para evitar manipulação do valor pelo cliente.
        items: z7.array(
          z7.object({
            productId: z7.number().int().positive(),
            productName: z7.string().max(200),
            productPrice: z7.string().regex(/^\d+(\.\d{1,2})?$/, "Pre\xE7o inv\xE1lido"),
            quantity: z7.number().int().min(1).max(99),
            notes: z7.string().max(500).optional()
          })
        ).min(1, "O pedido precisa ter pelo menos 1 item.").max(50, "Pedido excede o n\xFAmero m\xE1ximo de itens.")
      })
    ).mutation(async ({ input, ctx }) => {
      const dbSettings = await getAllStoreSettings();
      await assertPaymentMethodEnabled(input.paymentMethod);
      const now = /* @__PURE__ */ new Date();
      const brFormatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "narrow",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const brParts = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(now);
      const brDayName = brParts.find((p) => p.type === "weekday")?.value ?? "";
      const brHour = parseInt(brParts.find((p) => p.type === "hour")?.value ?? "0", 10);
      const brMinute = parseInt(brParts.find((p) => p.type === "minute")?.value ?? "0", 10);
      const dayNameToNum = {
        "domingo": 0,
        "segunda-feira": 1,
        "ter\xE7a-feira": 2,
        "quarta-feira": 3,
        "quinta-feira": 4,
        "sexta-feira": 5,
        "s\xE1bado": 6
      };
      const day = dayNameToNum[brDayName.toLowerCase()] ?? now.getDay();
      const defaultHours = {
        "0": null,
        "1": { open: "18:00", close: "23:00" },
        "2": { open: "18:00", close: "23:00" },
        "3": { open: "18:00", close: "23:00" },
        "4": { open: "18:00", close: "23:00" },
        "5": { open: "18:00", close: "23:30" },
        "6": { open: "18:00", close: "23:30" }
      };
      const storeHours = dbSettings.storeHours ? JSON.parse(dbSettings.storeHours) : defaultHours;
      const schedule = storeHours[String(day)];
      let storeOpen = false;
      if (schedule) {
        const [oh, om] = schedule.open.split(":").map(Number);
        const [ch, cm] = schedule.close.split(":").map(Number);
        const nowMin = brHour * 60 + brMinute;
        storeOpen = nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
      }
      if (!storeOpen) {
        throw new TRPCError7({
          code: "PRECONDITION_FAILED",
          message: "A pizzaria est\xE1 fechada no momento. Tente novamente durante o hor\xE1rio de funcionamento."
        });
      }
      if (input.deliveryCep) {
        const cleanCep = input.deliveryCep.replace(/\D/g, "");
        const defaultPrefixes = [
          "37500",
          "37501",
          "37502",
          "37503",
          "37504",
          "37505",
          "37506",
          "37507",
          "37508",
          "37509",
          "37510",
          "37511",
          "37512",
          "37513",
          "37514",
          "37515",
          "37516",
          "37517",
          "37518",
          "37519",
          "37520",
          "37521",
          "37522",
          "37523",
          "37524",
          "37525",
          "37526",
          "37527",
          "37528",
          "37529"
        ];
        const deliveryPrefixes = dbSettings.deliveryCepPrefixes ? JSON.parse(dbSettings.deliveryCepPrefixes) : defaultPrefixes;
        if (cleanCep.length === 8 && !deliveryPrefixes.includes(cleanCep.substring(0, 5))) {
          throw new TRPCError7({
            code: "BAD_REQUEST",
            message: "Infelizmente n\xE3o entregamos nesse CEP ainda. Entre em contato pelo WhatsApp."
          });
        }
      }
      const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
      const productsFromDb = await getProductsByIds(productIds);
      const productMap = new Map(productsFromDb.map((p) => [p.id, p]));
      const resolvedItems = [];
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product || !product.active) {
          throw new TRPCError7({ code: "BAD_REQUEST", message: `Produto "${item.productName}" n\xE3o encontrado ou indispon\xEDvel.` });
        }
        resolvedItems.push({ productId: item.productId, productName: product.name, productPrice: product.price, quantity: item.quantity, notes: item.notes ?? null });
      }
      const subtotal = resolvedItems.reduce(
        (sum, item) => sum + parseFloat(item.productPrice) * item.quantity,
        0
      );
      let discountAmount = 0;
      let couponToApply;
      if (input.couponCode) {
        couponToApply = await getCouponByCode(input.couponCode);
        if (!couponToApply) {
          throw new TRPCError7({ code: "BAD_REQUEST", message: "Cupom inv\xE1lido ou expirado." });
        }
        if (!couponToApply.active) {
          throw new TRPCError7({ code: "BAD_REQUEST", message: "Cupom inativo." });
        }
        if (couponToApply.expiresAt && /* @__PURE__ */ new Date() > couponToApply.expiresAt) {
          throw new TRPCError7({ code: "BAD_REQUEST", message: "Cupom expirado." });
        }
        if (couponToApply.userId != null && couponToApply.userId !== ctx.user.id) {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Este cupom \xE9 exclusivo de outro usu\xE1rio." });
        }
        const minOrder = parseFloat(couponToApply.minOrderValue ?? "0");
        if (subtotal < minOrder) {
          throw new TRPCError7({
            code: "BAD_REQUEST",
            message: `Pedido m\xEDnimo de R$ ${minOrder.toFixed(2)} para este cupom.`
          });
        }
        if (couponToApply.discountType === "percentage") {
          discountAmount = subtotal * parseFloat(couponToApply.discountValue) / 100;
        } else {
          discountAmount = parseFloat(couponToApply.discountValue);
        }
      }
      const db = await getDb();
      if (!db) {
        throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      }
      let clubDiscountAmount = 0;
      let clubFreeDelivery = false;
      let clubFreePizzaDiscount = 0;
      let reservedFreePizza = false;
      const userForClub = await getUserById(ctx.user.id);
      const reserveFreePizzaBenefit = async () => {
        const result = await db.update(users).set({ clubFreePizzaUsed: true }).where(and9(eq12(users.id, ctx.user.id), eq12(users.clubStatus, "active"), eq12(users.clubFreePizzaUsed, false)));
        const mutationResult = result;
        const affectedRows = mutationResult?.rowsAffected ?? mutationResult?.[0]?.affectedRows ?? 0;
        reservedFreePizza = affectedRows > 0;
        return reservedFreePizza;
      };
      const releaseFreePizzaBenefit = async () => {
        if (!reservedFreePizza) return;
        reservedFreePizza = false;
        await db.update(users).set({ clubFreePizzaUsed: false }).where(eq12(users.id, ctx.user.id));
      };
      if (userForClub && userForClub.clubStatus === "active" && userForClub.clubPlan) {
        const planConfig = await getClubPlanConfig(userForClub.clubPlan);
        if (planConfig) {
          clubFreeDelivery = planConfig.freeDelivery;
          let freePizzaAlreadyUsed = Boolean(userForClub.clubFreePizzaUsed);
          const now2 = /* @__PURE__ */ new Date();
          if (freePizzaAlreadyUsed && userForClub.clubFreePizzaResetAt && now2 > userForClub.clubFreePizzaResetAt) {
            const nextReset = new Date(now2.getFullYear(), now2.getMonth() + 1, 1);
            await db.update(users).set({ clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset }).where(and9(eq12(users.id, ctx.user.id), lte3(users.clubFreePizzaResetAt, now2)));
            freePizzaAlreadyUsed = false;
          }
          if (planConfig.freePizzaPerMonth && !freePizzaAlreadyUsed) {
            const pizzaCategoryIds = getPizzaCategoryIds(await getCategories());
            const candidateFreePizzaDiscount = getFreePizzaDiscountForCart(input.items, productMap, pizzaCategoryIds);
            if (candidateFreePizzaDiscount > 0 && await reserveFreePizzaBenefit()) {
              clubFreePizzaDiscount = candidateFreePizzaDiscount;
            }
          }
          const clubDiscountBase = Math.max(0, subtotal - discountAmount - clubFreePizzaDiscount);
          clubDiscountAmount = clubDiscountBase * planConfig.discountPercent / 100;
        }
      }
      discountAmount += clubFreePizzaDiscount + clubDiscountAmount;
      const POINTS_TO_BRL = 0.1;
      let pointsDiscount = 0;
      let pointsUsed = 0;
      let rawDeliveryFee = 0;
      if (input.deliveryCep || input.deliveryNeighborhood) {
        if (input.deliveryNeighborhood) {
          const zone = await getDeliveryZoneByNeighborhood(input.deliveryNeighborhood);
          if (zone) rawDeliveryFee = parseFloat(zone.deliveryFee);
          else {
            const feeStr = dbSettings.deliveryFee;
            rawDeliveryFee = feeStr ? parseFloat(feeStr) : 0;
          }
        } else {
          const feeStr = dbSettings.deliveryFee;
          rawDeliveryFee = feeStr ? parseFloat(feeStr) : 0;
        }
      }
      const deliveryFee = clubFreeDelivery ? 0 : rawDeliveryFee;
      if (input.pointsToRedeem && input.pointsToRedeem >= 50) {
        const userBalance = await getUserLoyaltyPoints(ctx.user.id);
        const payableBeforePoints = Math.max(0, subtotal - discountAmount + deliveryFee);
        const maxPointsByTotal = Math.floor(payableBeforePoints / POINTS_TO_BRL);
        const pts = Math.min(input.pointsToRedeem, userBalance, maxPointsByTotal);
        if (pts >= 50) {
          pointsDiscount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
          pointsUsed = pts;
          discountAmount += pointsDiscount;
        }
      }
      const minOrderValueStr = dbSettings.minOrderValue;
      const minOrderValue = minOrderValueStr ? parseFloat(minOrderValueStr) : 0;
      const totalBeforeCheck = Math.max(0, subtotal - discountAmount + deliveryFee);
      if (minOrderValue > 0 && subtotal - discountAmount < minOrderValue) {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: `Valor m\xEDnimo do pedido \xE9 R$ ${minOrderValue.toFixed(2).replace(".", ",")}. Adicione mais itens ao carrinho.`
        });
      }
      const total = totalBeforeCheck;
      const routedStore = await pickStoreForDeliveryAddress({
        deliveryAddress: input.deliveryAddress,
        deliveryNeighborhood: input.deliveryNeighborhood ?? null,
        deliveryCity: input.deliveryCity ?? null,
        deliveryCep: input.deliveryCep ?? null
      });
      const orderData = {
        storeId: routedStore.storeId ?? null,
        userId: ctx.user.id,
        customerName: input.customerName,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        deliveryAddress: input.deliveryAddress,
        deliveryNeighborhood: input.deliveryNeighborhood ?? null,
        deliveryCity: input.deliveryCity ?? null,
        deliveryCep: input.deliveryCep ?? null,
        deliveryComplement: input.deliveryComplement ?? null,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
        couponCode: input.couponCode ?? null,
        pointsDiscount: pointsDiscount.toFixed(2),
        pointsUsed,
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? null
      };
      const orderItemsData = resolvedItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productPrice: item.productPrice,
        quantity: item.quantity,
        notes: item.notes ?? null,
        subtotal: (parseFloat(item.productPrice) * item.quantity).toFixed(2)
      }));
      let orderId;
      try {
        orderId = await createOrder(orderData, orderItemsData);
        await bootstrapOrderLifecycle(orderId);
      } catch (error) {
        await releaseFreePizzaBenefit().catch((releaseError) => {
          console.error("[orders.create] failed to release free pizza benefit after create error:", releaseError);
        });
        throw error;
      }
      if (pointsUsed > 0) {
        let debit;
        try {
          debit = await deductLoyaltyPointsAtomic(
            ctx.user.id,
            pointsUsed,
            orderId,
            `-${pointsUsed} pontos resgatados no pedido #${orderId}`
          );
        } catch (debitErr) {
          try {
            await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            await releaseFreePizzaBenefit();
          } catch (cancelErr) {
            console.error("[orders.create] failed to cancel order after debit error:", cancelErr);
          }
          console.error("[orders.create] debit points failed unexpectedly:", debitErr);
          throw new TRPCError7({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha ao processar pontos de fidelidade."
          });
        }
        if (!debit.ok) {
          try {
            await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            await releaseFreePizzaBenefit();
          } catch (cancelErr) {
            console.error("[orders.create] failed to cancel order after debit race:", cancelErr);
          }
          throw new TRPCError7({
            code: "BAD_REQUEST",
            message: `Saldo de pontos insuficiente. Saldo atual: ${debit.newBalance}.`
          });
        }
      }
      if (couponToApply) {
        const accepted = await incrementCouponUsage(couponToApply.code);
        if (!accepted) {
          try {
            await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            if (pointsUsed > 0) {
              await addLoyaltyPoints(ctx.user.id, pointsUsed, orderId, `Estorno por falha ao aplicar cupom no pedido #${orderId}`);
            }
            await releaseFreePizzaBenefit();
          } catch (cleanupErr) {
            console.error("[orders.create] cleanup after coupon race failed:", cleanupErr);
          }
          throw new TRPCError7({ code: "BAD_REQUEST", message: "Este cupom atingiu o limite de usos." });
        }
        try {
          await registerCouponRedemption(couponToApply.id, couponToApply.code, orderId, ctx.user.id);
        } catch (redErr) {
          console.error("[orders.create] registerCouponRedemption failed:", redErr);
        }
      }
      const itemsList = resolvedItems.map((i) => `\u2022 ${i.productName} x${i.quantity} \u2014 R$ ${(parseFloat(i.productPrice) * i.quantity).toFixed(2)}`).join("\n");
      await notifyOwner3({
        title: `\u{1F355} Novo Pedido #${orderId} - ${input.customerName}`,
        content: `**Cliente:** ${input.customerName}
**Telefone:** ${input.customerPhone ?? "N/A"}
**Endere\xE7o:** ${input.deliveryAddress}
**Pagamento:** ${input.paymentMethod}

**Itens:**
${itemsList}

**Total: R$ ${total.toFixed(2)}**`
      }).catch(console.error);
      sendPushToAdmins({
        title: `\u{1F355} Novo Pedido #${orderId}`,
        body: `${input.customerName} \u2014 R$ ${total.toFixed(2)}`,
        url: "/admin",
        tag: `new-order-${orderId}`
      }).catch(console.error);
      if (input.customerPhone) {
        sendWhatsApp(
          input.customerPhone,
          WhatsAppTemplates.orderConfirmed(input.customerName, orderId, total.toFixed(2))
        ).catch(console.error);
      }
      return { orderId, total };
    }),
    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUser(ctx.user.id)),
    byId: protectedProcedure.input(z7.object({ id: z7.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const items = await getOrderItems(input.id);
      return { ...order, items };
    }),
    // Admin
    list: staffProcedure.input(
      z7.object({
        status: z7.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).optional(),
        limit: z7.number().int().min(1).max(5e4).optional(),
        offset: z7.number().int().min(0).optional(),
        storeId: z7.number().optional(),
        startDate: z7.date().optional(),
        endDate: z7.date().optional()
      }).optional()
    ).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllOrders({ ...input, storeId });
    }),
    alertFeed: staffProcedure.input(
      z7.object({
        limit: z7.number().int().min(1).max(50).optional(),
        storeId: z7.number().optional()
      }).optional()
    ).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getOrderAlertFeed(storeId, input?.limit ?? 20);
    }),
    updateStatus: staffProcedure.input(
      z7.object({
        id: z7.number(),
        status: z7.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"])
      })
    ).mutation(async ({ input, ctx }) => {
      const TRANSITIONS = {
        pending: ["confirmed", "preparing", "cancelled"],
        confirmed: ["preparing", "out_for_delivery", "cancelled"],
        preparing: ["out_for_delivery", "cancelled"],
        out_for_delivery: ["delivered", "cancelled"],
        delivered: [],
        // estado terminal
        cancelled: []
        // estado terminal
      };
      const allowedFrom = Object.entries(TRANSITIONS).filter(([, nexts]) => nexts.includes(input.status)).map(([from]) => from);
      if (allowedFrom.length === 0) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: `Transi\xE7\xE3o inv\xE1lida para ${input.status}.` });
      }
      const currentOrder = await getOrderById(input.id);
      if (!currentOrder) {
        throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xC3\xA3o encontrado." });
      }
      if (input.status === "preparing" && currentOrder.paymentMethod === "pix" && currentOrder.paymentStatus !== "paid") {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: "Marque o PIX como recebido antes de preparar este pedido."
        });
      }
      const guard = await updateOrderStatusGuarded(input.id, input.status, allowedFrom);
      if (!guard.ok) {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: guard.previous ? `N\xE3o \xE9 poss\xEDvel ir de ${guard.previous} para ${input.status}.` : "Pedido n\xE3o encontrado."
        });
      }
      if (guard.previous) {
        await applyOrderStatusLifecycle(input.id, guard.previous, input.status, {
          actorUserId: ctx.user.id,
          source: ctx.user.role === "manager" ? "manager" : "admin"
        });
      }
      const order = await getOrderById(input.id);
      if (order) {
        if ((input.status === "confirmed" || input.status === "preparing") && order.userId) {
          (async () => {
            try {
              await markConversions(order.userId, input.id);
            } catch (e) {
              console.error("markConversions error:", e);
            }
          })();
        }
        if (input.status === "cancelled") {
          (async () => {
            try {
              await refundLoyaltyPointsForOrder(input.id);
            } catch (e) {
              console.error("refund points error:", e);
            }
            try {
              await revertCouponRedemption(input.id);
            } catch (e) {
              console.error("revert coupon error:", e);
            }
          })();
        }
        if (input.status === "delivered" && order.userId && order.total && order.paymentStatus !== "failed" && order.paymentStatus !== "refunded") {
          const pointsToAdd = Math.floor(Number(order.total));
          if (pointsToAdd > 0) {
            (async () => {
              try {
                const credited = await creditLoyaltyForOrderIdempotent(
                  input.id,
                  order.userId,
                  pointsToAdd,
                  `+${pointsToAdd} pontos pelo pedido #${input.id}`
                );
                if (credited) {
                  await sendPushToUser(order.userId, {
                    title: "\u2B50 Pontos creditados!",
                    body: `+${pointsToAdd} pontos foram adicionados ao seu saldo Bonatto!`,
                    url: "/minha-conta",
                    tag: `loyalty-${input.id}`
                  });
                }
              } catch (e) {
                console.error("Loyalty points error:", e);
              }
            })();
          }
        }
        const customerName = order.customerName ?? "Cliente";
        const phone = order.customerPhone;
        const statusToEvent = {
          confirmed: "order_confirmed",
          preparing: "order_preparing",
          out_for_delivery: "order_out_for_delivery",
          delivered: "order_delivered",
          cancelled: "order_cancelled"
        };
        const eventName = statusToEvent[input.status];
        const interpolate = (text2) => text2.replace(/\{\{clientName\}\}/g, customerName).replace(/\{\{orderId\}\}/g, String(input.id)).replace(/\{\{total\}\}/g, order.total ? `R$ ${Number(order.total).toFixed(2).replace(".", ",")}` : "");
        if (order.userId && eventName) {
          const pushFallbacks = {
            confirmed: { title: "\u2705 Pedido Confirmado!", body: `Seu pedido #${input.id} foi confirmado pela Bonatto Pizza.` },
            preparing: { title: "\u{1F468}\u200D\u{1F373} Preparando seu pedido!", body: `Seu pedido #${input.id} est\xE1 sendo preparado com carinho.` },
            out_for_delivery: { title: "\u{1F6F5} Saiu para entrega!", body: `Seu pedido #${input.id} est\xE1 a caminho. Aguarde!` },
            delivered: { title: "\u{1F389} Pedido entregue!", body: `Seu pedido #${input.id} foi entregue. Bom apetite!` },
            cancelled: { title: "\u274C Pedido cancelado", body: `Seu pedido #${input.id} foi cancelado. Entre em contato conosco.` }
          };
          (async () => {
            try {
              const tpl = await pickRandomTemplate(eventName, "push");
              const payload = tpl ? { title: interpolate(tpl.title), body: interpolate(tpl.body) } : pushFallbacks[input.status];
              if (payload) {
                await sendPushToUser(order.userId, { ...payload, url: "/minha-conta", tag: `order-status-${input.id}` });
              }
            } catch (e) {
              console.error("Push error:", e);
            }
          })();
        }
        if (phone && eventName) {
          const waMsgFallbacks = {
            confirmed: WhatsAppTemplates.orderConfirmed(customerName, input.id, order.total),
            preparing: WhatsAppTemplates.orderPreparing(customerName, input.id),
            out_for_delivery: WhatsAppTemplates.orderOutForDelivery(customerName, input.id),
            delivered: WhatsAppTemplates.orderDelivered(customerName, input.id),
            cancelled: WhatsAppTemplates.orderCancelled(customerName, input.id)
          };
          (async () => {
            try {
              const tpl = await pickRandomTemplate(eventName, "whatsapp");
              const msg = tpl ? interpolate(tpl.body) : waMsgFallbacks[input.status];
              if (msg) await sendWhatsApp(phone, msg);
            } catch (e) {
              console.error("WhatsApp error:", e);
            }
          })();
        }
        if (order.userId) {
          const orderTriggerMap = {
            delivered: "order_delivered",
            cancelled: "order_cancelled"
          };
          const journeyTrigger = orderTriggerMap[input.status];
          if (journeyTrigger) {
            fireJourneyTrigger(journeyTrigger, order.userId, order.customerPhone ?? void 0).catch(() => {
            });
          }
          if (input.status === "delivered") {
            (async () => {
              try {
                const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
                const { orders: ordersTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
                const { and: _and, eq: _eq, gte: _gte, lt: _lt, ne: _ne } = await import("drizzle-orm");
                const db = await getDb2();
                if (!db) return;
                const now = /* @__PURE__ */ new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                const prevDelivered = await db.select({ id: ordersTable.id }).from(ordersTable).where(_and(
                  _eq(ordersTable.userId, order.userId),
                  _eq(ordersTable.status, "delivered"),
                  _gte(ordersTable.createdAt, monthStart),
                  _lt(ordersTable.createdAt, monthEnd),
                  _ne(ordersTable.id, input.id)
                )).limit(1);
                if (prevDelivered.length === 0) {
                  fireJourneyTrigger("first_order_month", order.userId, order.customerPhone ?? void 0).catch(() => {
                  });
                }
              } catch (e) {
                console.error("first_order_month trigger error:", e);
              }
            })();
          }
        }
      }
      return { ok: true };
    }),
    updatePaymentStatus: staffProcedure.input(
      z7.object({
        id: z7.number(),
        paymentStatus: z7.enum(["pending", "paid", "failed", "refunded"]),
        stripePaymentIntentId: z7.string().optional()
      })
    ).mutation(
      ({ input }) => updateOrderPaymentStatus(input.id, input.paymentStatus, input.stripePaymentIntentId)
    ),
    confirmPixReceived: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xC3\xA3o encontrado." });
      if (order.paymentMethod !== "pix") {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Este pedido n\xC3\xA3o foi feito com PIX." });
      }
      if (order.paymentStatus !== "paid") {
        await updateOrderPaymentStatus(input.id, "paid");
      }
      return { ok: true };
    })
  }),
  // --- MARKETPLACES ----------------------------------------------------------
  marketplaces: router({
    overview: adminProcedure3.query(async () => {
      return getMarketplaceOverview();
    }),
    saveConfig: adminProcedure3.input(
      z7.object({
        providerId: marketplaceProviderIdSchema,
        config: marketplaceConfigSchema.partial()
      })
    ).mutation(async ({ input }) => {
      return saveMarketplaceConfig(input.providerId, input.config);
    }),
    testConnection: adminProcedure3.input(z7.object({ providerId: marketplaceProviderIdSchema })).mutation(async ({ input }) => {
      return testMarketplaceConnection(input.providerId);
    }),
    syncCatalog: adminProcedure3.input(z7.object({ providerId: marketplaceProviderIdSchema, merchantId: z7.string().optional() })).mutation(async ({ input }) => {
      return runMarketplaceCatalogSync(input.providerId, input.merchantId);
    }),
    syncPromotions: adminProcedure3.input(
      z7.object({
        providerId: marketplaceProviderIdSchema,
        merchantId: z7.string().optional(),
        aggregationIds: z7.array(z7.string().min(1)).optional()
      })
    ).mutation(async ({ input }) => {
      return runMarketplacePromotionsSync(input.providerId, {
        merchantId: input.merchantId,
        aggregationIds: input.aggregationIds
      });
    }),
    pullOrders: adminProcedure3.input(z7.object({ providerId: marketplaceProviderIdSchema })).mutation(async ({ input }) => {
      return pullMarketplaceOrders(input.providerId);
    })
  }),
  // --- INTEGRATIONS ----------------------------------------------------------
  integrations: router({
    ifood: router({
      status: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().getStatus(restaurantId);
      }),
      connect: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().connect(restaurantId);
      }),
      disconnect: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().disconnect(restaurantId);
      }),
      orders: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().getOrders(restaurantId);
      }),
      generateTestOrder: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().generateTestOrder(restaurantId);
      }),
      logs: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return listIfoodIntegrationLogs(restaurantId);
      }),
      confirmOrder: staffProcedure.input(z7.object({ id: z7.number(), storeId: z7.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().confirmOrder(input.id, restaurantId);
      }),
      startPreparation: staffProcedure.input(z7.object({ id: z7.number(), storeId: z7.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().startPreparation(input.id, restaurantId);
      }),
      dispatch: staffProcedure.input(z7.object({ id: z7.number(), storeId: z7.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().dispatchOrder(input.id, restaurantId);
      }),
      conclude: staffProcedure.input(z7.object({ id: z7.number(), storeId: z7.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().concludeOrder(input.id, restaurantId);
      }),
      cancel: staffProcedure.input(z7.object({ id: z7.number(), storeId: z7.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId);
        return getIfoodProvider().cancelOrder(input.id, restaurantId);
      })
    })
  }),
  // --- IFOOD ------------------------------------------------------------------
  ifood: router({
    merchants: adminProcedure3.query(async () => {
      return listIfoodMerchants();
    }),
    syncCatalog: adminProcedure3.input(z7.object({ merchantId: z7.string().optional() }).optional()).mutation(async ({ input }) => {
      return syncIfoodCatalog(input?.merchantId);
    }),
    syncPromotions: adminProcedure3.input(
      z7.object({
        merchantId: z7.string().optional(),
        aggregationIds: z7.array(z7.string().min(1)).optional()
      }).optional()
    ).mutation(async ({ input }) => {
      return syncIfoodPromotions({
        merchantId: input?.merchantId,
        aggregationIds: input?.aggregationIds
      });
    }),
    confirmOrder: adminProcedure3.input(z7.object({ ifoodOrderId: z7.string() })).mutation(async ({ input }) => {
      await confirmIfoodOrder(input.ifoodOrderId);
      return { success: true };
    }),
    startPreparation: adminProcedure3.input(z7.object({ ifoodOrderId: z7.string() })).mutation(async ({ input }) => {
      await startPreparationIfoodOrder(input.ifoodOrderId);
      return { success: true };
    }),
    dispatch: adminProcedure3.input(z7.object({ ifoodOrderId: z7.string() })).mutation(async ({ input }) => {
      await dispatchIfoodOrder(input.ifoodOrderId);
      return { success: true };
    }),
    cancelOrder: adminProcedure3.input(z7.object({ ifoodOrderId: z7.string(), reason: z7.string().default("Pedido cancelado pelo restaurante") })).mutation(async ({ input }) => {
      await cancelIfoodOrder(input.ifoodOrderId, input.reason);
      return { success: true };
    })
  }),
  // --- NFC-e (Focus NFe) -------------------------------------------------------
  nfce: router({
    emitir: adminProcedure3.input(z7.object({ orderId: z7.number() })).mutation(async ({ input }) => {
      const result = await emitirNfce(input.orderId);
      if (!result.success) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao emitir NFC-e" });
      return result;
    }),
    cancelar: adminProcedure3.input(z7.object({ orderId: z7.number(), justificativa: z7.string().min(15) })).mutation(async ({ input }) => {
      const result = await cancelarNfce(input.orderId, input.justificativa);
      if (!result.success) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao cancelar NFC-e" });
      return result;
    })
  }),
  // --- PAYMENTS ---------------------------------------------------------------
  payments: router({
    createIntent: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ input, ctx }) => {
      await assertPaymentMethodEnabled("credit_card");
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      const amountInReais = parseFloat(order.total ?? "0");
      if (amountInReais <= 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "Valor do pedido inv\xE1lido" });
      const paymentIntent = await createPaymentIntent(amountInReais, "brl", {
        orderId: String(input.orderId)
      });
      return { clientSecret: paymentIntent.client_secret };
    }),
    createCheckoutSession: protectedProcedure.input(z7.object({
      orderId: z7.number(),
      origin: z7.string().url()
    })).mutation(async ({ input, ctx }) => {
      await assertPaymentMethodEnabled("credit_card");
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      const amountInReais = parseFloat(order.total ?? "0");
      if (amountInReais < 0.5) throw new TRPCError7({ code: "BAD_REQUEST", message: "Valor m\xEDnimo para pagamento online \xE9 R$ 0,50" });
      const session = await createCheckoutSession({
        orderId: input.orderId,
        amountInReais,
        customerEmail: ctx.user.email ?? void 0,
        successUrl: `${input.origin}/pagamento/sucesso?orderId=${input.orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${input.origin}/pagamento/cancelado?orderId=${input.orderId}`,
        metadata: {
          userId: String(ctx.user.id),
          customerName: ctx.user.name ?? ""
        },
        orderDescription: `Pedido #${input.orderId} \u2014 Bonatto Pizza`
      });
      return { checkoutUrl: session.url, sessionId: session.id };
    }),
    getMyTransactions: protectedProcedure.query(({ ctx }) => getTransactionsByUser(ctx.user.id)),
    // ─── Saved Cards ─────────────────────────────────────────────────────────────
    createSetupIntent: protectedProcedure.input(z7.object({ origin: z7.string().url() })).mutation(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError7({ code: "NOT_FOUND" });
      const stripeCustomerId = await getOrCreateStripeCustomer({
        userId: ctx.user.id,
        stripeCustomerId: user.stripeCustomerId,
        email: user.email,
        name: user.name
      });
      const setupIntent = await createSetupIntent(stripeCustomerId);
      return { clientSecret: setupIntent.client_secret, stripeCustomerId };
    }),
    listSavedCards: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.stripeCustomerId) return [];
      try {
        return await listSavedCards(user.stripeCustomerId);
      } catch {
        return [];
      }
    }),
    deleteCard: protectedProcedure.input(z7.object({ paymentMethodId: z7.string() })).mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.stripeCustomerId) throw new TRPCError7({ code: "BAD_REQUEST", message: "Nenhum cart\xE3o salvo" });
      const cards = await listSavedCards(user.stripeCustomerId);
      const card = cards.find((c) => c.id === input.paymentMethodId);
      if (!card) throw new TRPCError7({ code: "NOT_FOUND", message: "Cart\xE3o n\xE3o encontrado" });
      await detachPaymentMethod(input.paymentMethodId);
      return { success: true };
    }),
    checkoutWithSavedCard: protectedProcedure.input(z7.object({
      orderId: z7.number(),
      paymentMethodId: z7.string(),
      origin: z7.string().url()
    })).mutation(async ({ input, ctx }) => {
      const paymentSettings = await assertPaymentMethodEnabled("credit_card");
      if (!paymentSettings.config.orders.savedCardsEnabled) {
        throw new TRPCError7({
          code: "PRECONDITION_FAILED",
          message: "O uso de cart\xF5es salvos est\xE1 desativado no momento."
        });
      }
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN" });
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError7({ code: "NOT_FOUND" });
      const stripeCustomerId = await getOrCreateStripeCustomer({
        userId: ctx.user.id,
        stripeCustomerId: user.stripeCustomerId,
        email: user.email,
        name: user.name
      });
      const amountInReais = parseFloat(order.total ?? "0");
      if (amountInReais < 0.5) throw new TRPCError7({ code: "BAD_REQUEST", message: "Valor m\xEDnimo \xE9 R$ 0,50" });
      const session = await createCheckoutSessionWithSavedCard({
        orderId: input.orderId,
        amountInReais,
        stripeCustomerId,
        paymentMethodId: input.paymentMethodId,
        successUrl: `${input.origin}/pagamento/sucesso?orderId=${input.orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${input.origin}/pagamento/cancelado?orderId=${input.orderId}`,
        metadata: { userId: String(ctx.user.id), customerName: user.name ?? "" }
      });
      return { checkoutUrl: session.url, sessionId: session.id };
    }),
    createManualPixCode: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ input, ctx }) => {
      const paymentSettings = await assertPaymentMethodEnabled("pix");
      if (paymentSettings.config.orders.pixMode !== "manual_key") {
        throw new TRPCError7({
          code: "PRECONDITION_FAILED",
          message: "O PIX manual n\xE3o est\xE1 ativo para pedidos."
        });
      }
      const adminPaymentSettings = await getPaymentSettingsAdmin();
      const pixKey = adminPaymentSettings.pixKey.trim();
      if (!pixKey) {
        throw new TRPCError7({
          code: "PRECONDITION_FAILED",
          message: "Configure a chave PIX na aba de pagamentos do admin."
        });
      }
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN" });
      const amount = parseFloat(order.total ?? "0");
      if (amount <= 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "Valor do pedido inv\xE1lido" });
      const txId = `PED${order.id}${Date.now()}`.substring(0, 25);
      const pixCopiaECola = generatePixCode(
        pixKey,
        adminPaymentSettings.config.pix.merchantName,
        amount,
        txId,
        adminPaymentSettings.config.pix.merchantCity
      );
      return {
        chargeId: `manual:${order.id}`,
        qrCodeImage: generatePixQrCodeUrl(pixCopiaECola),
        pixCopiaECola,
        expirationDate: "",
        value: amount,
        autoConfirm: false,
        instructions: adminPaymentSettings.config.pix.instructions
      };
    })
  }),
  // --- ASAAS PIX ---------------------------------------------------------------
  asaas: router({
    /** Gera cobrança PIX via Asaas e retorna QR Code */
    createPix: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ input, ctx }) => {
      const paymentSettings = await assertPaymentMethodEnabled("pix");
      if (paymentSettings.config.orders.pixMode !== "dynamic_asaas") {
        throw new TRPCError7({
          code: "PRECONDITION_FAILED",
          message: "O PIX autom\xE1tico via Asaas n\xE3o est\xE1 ativo para pedidos."
        });
      }
      if (!process.env.ASAAS_API_KEY) {
        throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Integra\xE7\xE3o Asaas n\xE3o configurada. Configure ASAAS_API_KEY nas vari\xE1veis de ambiente." });
      }
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN" });
      if (order.paymentStatus === "paid") throw new TRPCError7({ code: "BAD_REQUEST", message: "Pedido j\xE1 pago" });
      if (order.asaasPaymentId) {
        const status = await getChargeStatus(order.asaasPaymentId);
        if (status === "RECEIVED" || status === "CONFIRMED") {
          await updateOrderPaymentStatus(input.orderId, "paid", void 0, void 0, order.asaasPaymentId);
          return { alreadyPaid: true, status, chargeId: order.asaasPaymentId, qrCodeImage: "", pixCopiaECola: "", expirationDate: "", value: 0 };
        }
      }
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError7({ code: "NOT_FOUND" });
      const customerId = await getOrCreateAsaasCustomer({
        name: order.customerName,
        email: user.email ?? void 0,
        phone: order.customerPhone ?? void 0
      });
      const charge = await createPixCharge({
        customerId,
        value: parseFloat(order.total ?? "0"),
        description: `Pedido #${order.id} \u2014 Bonatto Pizza`,
        externalReference: String(order.id)
      });
      await updateOrderPaymentStatus(input.orderId, "pending", void 0, void 0, charge.id);
      return {
        alreadyPaid: false,
        chargeId: charge.id,
        qrCodeImage: charge.encodedImage,
        pixCopiaECola: charge.payload,
        expirationDate: charge.expirationDate,
        value: charge.value
      };
    }),
    /** Consulta status de cobrança PIX */
    checkPixStatus: protectedProcedure.input(z7.object({ orderId: z7.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN" });
      if (order.paymentStatus === "paid") return { status: "CONFIRMED", paid: true };
      if (!order.asaasPaymentId) return { status: "PENDING", paid: false };
      const status = await getChargeStatus(order.asaasPaymentId);
      const paid = status === "RECEIVED" || status === "CONFIRMED";
      if (paid) {
        await updateOrderPaymentStatus(input.orderId, "paid", void 0, void 0, order.asaasPaymentId);
      }
      return { status, paid };
    })
  }),
  // --- USER PROFILE ---------------------------------------------------------------
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) return null;
      const {
        passwordHash: _ph,
        resetToken: _rt,
        resetTokenExpiresAt: _rte,
        ...safeUser
      } = user;
      return safeUser;
    }),
    update: protectedProcedure.input(z7.object({
      name: z7.string().optional(),
      phone: z7.string().optional(),
      savedAddress: z7.string().optional(),
      savedCep: z7.string().optional(),
      savedCity: z7.string().optional()
    })).mutation(({ input, ctx }) => updateUserProfile(ctx.user.id, input)),
    myCoupons: protectedProcedure.query(({ ctx }) => getCouponsByUser(ctx.user.id))
  }),
  // --- UP-SELLS ---------------------------------------------------------------
  upsells: router({
    forCart: publicProcedure.input(z7.object({ productIds: z7.array(z7.number()), cartTotal: z7.number() })).query(({ input }) => getUpsellsForCart(input.productIds, input.cartTotal)),
    all: staffProcedure.query(() => getAllUpsells()),
    create: staffProcedure.input(z7.object({
      suggestedProductId: z7.number(),
      triggerProductId: z7.number().optional(),
      triggerMinTotal: z7.string().optional(),
      type: z7.enum(["upsell", "downsell"]).default("upsell"),
      title: z7.string().min(1),
      description: z7.string().optional(),
      discountPercent: z7.number().default(0),
      active: z7.boolean().default(true),
      sortOrder: z7.number().default(0)
    })).mutation(({ input }) => createUpsell(input)),
    update: staffProcedure.input(z7.object({ id: z7.number(), data: z7.object({
      title: z7.string().optional(),
      description: z7.string().optional(),
      discountPercent: z7.number().optional(),
      active: z7.boolean().optional(),
      sortOrder: z7.number().optional()
    }) })).mutation(({ input }) => updateUpsell(input.id, input.data)),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(({ input }) => deleteUpsell(input.id))
  }),
  // --- PROMOTIONS ---------------------------------------------------------------
  promotions: router({
    // Only logged-in customers can see promotions that requiresLogin=true
    active: protectedProcedure.query(() => getActivePromotions()),
    // Public promotions (requiresLogin=false) visible to everyone
    publicActive: publicProcedure.query(
      () => getActivePromotions().then((promos) => promos.filter((p) => !p.requiresLogin))
    ),
    all: staffProcedure.query(() => getAllPromotions()),
    create: staffProcedure.input(z7.object({
      title: z7.string().min(1),
      description: z7.string().optional(),
      imageUrl: z7.string().optional(),
      couponCode: z7.string().optional(),
      active: z7.boolean().default(true),
      requiresLogin: z7.boolean().default(true),
      startsAt: z7.date().optional(),
      endsAt: z7.date().optional()
    })).mutation(async ({ input }) => {
      const result = await createPromotion(input);
      await createClientAlert({
        type: "promotion",
        title: `\u{1F37D}\uFE0F Nova promo\xE7\xE3o: ${input.title}`,
        message: input.description ?? "Confira a nova promo\xE7\xE3o dispon\xEDvel no card\xE1pio!",
        icon: "\u{1F37D}\uFE0F",
        url: "/minha-conta",
        expiresAt: input.endsAt
      });
      return result;
    }),
    update: staffProcedure.input(z7.object({ id: z7.number(), data: z7.object({
      title: z7.string().optional(),
      description: z7.string().optional(),
      imageUrl: z7.string().optional(),
      couponCode: z7.string().optional(),
      active: z7.boolean().optional(),
      requiresLogin: z7.boolean().optional(),
      endsAt: z7.date().optional()
    }) })).mutation(({ input }) => updatePromotion(input.id, input.data)),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(({ input }) => deletePromotion(input.id))
  }),
  // --- RAFFLES ---------------------------------------------------------------
  raffles: router({
    active: publicProcedure.query(() => getActiveRaffles()),
    all: staffProcedure.query(() => getAllRaffles()),
    entries: staffProcedure.input(z7.object({ raffleId: z7.number() })).query(({ input }) => getRaffleEntries(input.raffleId)),
    enter: protectedProcedure.input(z7.object({ raffleId: z7.number() })).mutation(({ input, ctx }) => enterRaffle(input.raffleId, ctx.user.id, ctx.user.name ?? "Cliente")),
    draw: staffProcedure.input(z7.object({ raffleId: z7.number() })).mutation(({ input }) => drawRaffleWinner(input.raffleId)),
    create: staffProcedure.input(z7.object({
      title: z7.string().min(1),
      description: z7.string().optional(),
      prize: z7.string().min(1),
      imageUrl: z7.string().optional(),
      endsAt: z7.date().optional()
    })).mutation(async ({ input }) => {
      const result = await createRaffle({ ...input, status: "active" });
      await createClientAlert({
        type: "raffle",
        title: `\u{1F31F} Novo sorteio: ${input.title}`,
        message: `Pr\xEAmio: ${input.prize}. ${input.description ?? "Participe agora e concorra!"}`,
        icon: "\u{1F31F}",
        url: "/minha-conta",
        expiresAt: input.endsAt
      });
      return result;
    }),
    update: staffProcedure.input(z7.object({ id: z7.number(), data: z7.object({
      title: z7.string().optional(),
      description: z7.string().optional(),
      prize: z7.string().optional(),
      status: z7.enum(["active", "closed", "drawn"]).optional(),
      endsAt: z7.date().optional()
    }) })).mutation(({ input }) => updateRaffle(input.id, input.data))
  }),
  inventory: router({
    list: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      activeOnly: z7.boolean().optional(),
      lowStockOnly: z7.boolean().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getIngredients({ storeId, activeOnly: input?.activeOnly ?? true, lowStockOnly: input?.lowStockOnly ?? false });
    }),
    lowStock: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getIngredients({ storeId, activeOnly: true, lowStockOnly: true });
    }),
    movements: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      ingredientId: z7.number().optional(),
      orderId: z7.number().optional(),
      limit: z7.number().min(1).max(500).optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getInventoryMovements({
        storeId,
        ingredientId: input?.ingredientId,
        orderId: input?.orderId,
        limit: input?.limit
      });
    }),
    create: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      name: z7.string().min(1).max(160),
      category: z7.string().max(120).optional(),
      unit: z7.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]),
      currentStock: z7.string().regex(/^-?\d+(\.\d{1,3})?$/),
      minimumStock: z7.string().regex(/^-?\d+(\.\d{1,3})?$/),
      unitCost: z7.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
      supplier: z7.string().max(160).optional(),
      notes: z7.string().max(5e3).optional(),
      active: z7.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return createIngredient({
        storeId,
        name: input.name,
        category: input.category ?? null,
        unit: input.unit,
        currentStock: input.currentStock,
        minimumStock: input.minimumStock,
        unitCost: input.unitCost ?? "0.0000",
        supplier: input.supplier ?? null,
        notes: input.notes ?? null,
        active: input.active ?? true
      });
    }),
    update: staffProcedure.input(z7.object({
      id: z7.number(),
      name: z7.string().min(1).max(160).optional(),
      category: z7.string().max(120).optional(),
      unit: z7.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]).optional(),
      currentStock: z7.string().regex(/^-?\d+(\.\d{1,3})?$/).optional(),
      minimumStock: z7.string().regex(/^-?\d+(\.\d{1,3})?$/).optional(),
      unitCost: z7.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
      supplier: z7.string().max(160).optional(),
      notes: z7.string().max(5e3).optional(),
      active: z7.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateIngredient(id, data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteIngredient(input.id);
      return { ok: true };
    }),
    adjust: staffProcedure.input(z7.object({
      ingredientId: z7.number(),
      quantityDelta: z7.string().regex(/^-?\d+(\.\d{1,3})?$/),
      movementType: z7.enum(["entry", "manual_adjustment", "waste", "reversal"]),
      reason: z7.string().max(255).optional()
    })).mutation(async ({ input, ctx }) => {
      return adjustIngredientStock({
        ingredientId: input.ingredientId,
        quantityDelta: input.quantityDelta,
        movementType: input.movementType,
        reason: input.reason ?? null,
        performedByUserId: ctx.user.id
      });
    }),
    recipe: staffProcedure.input(z7.object({ productId: z7.number() })).query(({ input }) => getProductRecipe(input.productId)),
    setRecipe: staffProcedure.input(z7.object({
      productId: z7.number(),
      items: z7.array(z7.object({
        ingredientId: z7.number(),
        quantity: z7.string().regex(/^\d+(\.\d{1,3})?$/),
        wastePercent: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional()
      }))
    })).mutation(({ input }) => setProductRecipe(input.productId, input.items)),
    syncOrderConsumption: staffProcedure.input(z7.object({ orderId: z7.number(), mode: z7.enum(["consume", "reverse"]) })).mutation(async ({ input }) => {
      return input.mode === "consume" ? consumeInventoryForOrder(input.orderId) : reverseInventoryForOrder(input.orderId);
    })
  }),
  staffMembers: router({
    list: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      role: z7.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).optional(),
      activeOnly: z7.boolean().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      const staff = await getStaffMembers({ storeId, role: input?.role, activeOnly: input?.activeOnly ?? true });
      return Promise.all(
        staff.map(async (member) => {
          if (member.role !== "waiter") return member;
          const accessToken = await ensureStaffAccessToken(member.id);
          return { ...member, accessToken };
        })
      );
    }),
    create: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      userId: z7.number().optional(),
      name: z7.string().min(2).max(200),
      phone: z7.string().optional(),
      email: z7.string().email().optional(),
      role: z7.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]),
      active: z7.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const id = await createStaffMember({
        storeId,
        userId: input.userId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        role: input.role,
        active: input.active ?? true
      });
      const accessToken = input.role === "waiter" ? await ensureStaffAccessToken(id) : null;
      return { id, accessToken };
    }),
    update: staffProcedure.input(z7.object({
      id: z7.number(),
      name: z7.string().min(2).max(200).optional(),
      phone: z7.string().optional(),
      email: z7.string().email().optional(),
      role: z7.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).optional(),
      active: z7.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateStaffMember(id, data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteStaffMember(input.id);
      return { ok: true };
    }),
    regenerateAccessToken: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      const accessToken = await regenerateStaffAccessToken(input.id);
      return { accessToken };
    })
  }),
  diningRoom: router({
    tables: staffProcedure.input(z7.object({ storeId: z7.number().optional(), activeOnly: z7.boolean().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getDiningTables({ storeId, activeOnly: input?.activeOnly ?? true });
    }),
    createTable: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      name: z7.string().min(1).max(80),
      capacity: z7.number().int().min(1).max(50).optional(),
      active: z7.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return createDiningTable({
        storeId,
        name: input.name,
        capacity: input.capacity ?? 4,
        status: "free",
        active: input.active ?? true
      });
    }),
    updateTable: staffProcedure.input(z7.object({
      id: z7.number(),
      name: z7.string().min(1).max(80).optional(),
      status: z7.enum(["free", "occupied", "reserved", "awaiting_closure"]).optional(),
      capacity: z7.number().int().min(1).max(50).optional(),
      active: z7.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateDiningTable(id, data);
      return { ok: true };
    }),
    deleteTable: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteDiningTable(input.id);
      return { ok: true };
    }),
    sessions: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      status: z7.enum(["open", "awaiting_closure", "closed", "cancelled"]).optional(),
      waiterStaffId: z7.number().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getTableSessions({ storeId, status: input?.status, waiterStaffId: input?.waiterStaffId });
    }),
    openSession: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      tableId: z7.number(),
      waiterStaffId: z7.number().optional(),
      customerName: z7.string().max(200).optional(),
      guestCount: z7.number().int().min(1).max(50).optional(),
      notes: z7.string().max(5e3).optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return openTableSession({
        tableId: input.tableId,
        storeId,
        waiterStaffId: input.waiterStaffId ?? null,
        customerName: input.customerName ?? null,
        guestCount: input.guestCount ?? 1,
        status: "open",
        notes: input.notes ?? null,
        subtotal: "0.00",
        discountAmount: "0.00",
        total: "0.00"
      });
    }),
    updateSession: staffProcedure.input(z7.object({
      id: z7.number(),
      waiterStaffId: z7.number().optional(),
      customerName: z7.string().max(200).optional(),
      guestCount: z7.number().int().min(1).max(50).optional(),
      notes: z7.string().max(5e3).optional(),
      status: z7.enum(["open", "awaiting_closure", "closed", "cancelled"]).optional(),
      subtotal: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      discountAmount: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      total: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateTableSession(id, data);
      return { ok: true };
    }),
    closeSession: staffProcedure.input(z7.object({
      id: z7.number(),
      subtotal: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      discountAmount: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      tipAmount: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      total: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      status: z7.enum(["awaiting_closure", "closed", "cancelled"]).optional(),
      closedByStaffId: z7.number().optional()
    })).mutation(async ({ input }) => {
      await closeTableSessionWithComputedTotals(input.id, {
        subtotal: input.subtotal,
        discountAmount: input.discountAmount,
        tipAmount: input.tipAmount,
        total: input.total,
        status: input.status,
        closedByStaffId: input.closedByStaffId ?? null
      });
      return { ok: true };
    }),
    attachOrder: staffProcedure.input(z7.object({ tableSessionId: z7.number(), orderId: z7.number() })).mutation(async ({ input }) => {
      await attachOrderToTableSessionAndSync(input.tableSessionId, input.orderId);
      return { ok: true };
    }),
    addItem: staffProcedure.input(z7.object({
      tableSessionId: z7.number(),
      productId: z7.number(),
      quantity: z7.number().int().min(1).max(100),
      notes: z7.string().max(500).optional(),
      addedByStaffId: z7.number().optional()
    })).mutation(async ({ input }) => {
      const itemId = await addTableSessionItem({
        tableSessionId: input.tableSessionId,
        productId: input.productId,
        quantity: input.quantity,
        notes: input.notes ?? null,
        addedByStaffId: input.addedByStaffId ?? null
      });
      return { ok: true, itemId };
    }),
    removeItem: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await removeTableSessionItem(input.id);
      return { ok: true };
    }),
    updateItemStatus: staffProcedure.input(z7.object({
      id: z7.number(),
      status: z7.enum(["pending", "preparing", "ready", "served", "cancelled"])
    })).mutation(async ({ input }) => {
      await updateTableSessionItemStatus(input.id, input.status);
      return { ok: true };
    })
  }),
  customerMetrics: router({
    list: staffProcedure.input(z7.object({ storeId: z7.number().optional(), limit: z7.number().min(1).max(500).optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getCustomerMetricsReport({ storeId: storeId ?? 0, limit: input?.limit });
    })
  }),
  // --- ADMIN USERS ---------------------------------------------------------------
  adminUsers: router({
    list: staffProcedure.input(z7.object({
      page: z7.number().int().min(1).optional(),
      pageSize: z7.number().int().min(1).max(100).optional(),
      search: z7.string().max(160).optional(),
      role: z7.enum(["user", "admin", "manager"]).optional(),
      status: z7.enum(["active", "inactive", "suspended", "setup_pending"]).optional(),
      clubStatus: z7.enum(["active", "pending", "cancelled", "none"]).optional(),
      loginMethod: z7.enum(["email", "phone", "google", "apple", "facebook", "instagram", "manus"]).optional(),
      hasOrders: z7.enum(["with_orders", "without_orders"]).optional(),
      storeId: z7.number().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAdminUsersPage({
        page: input?.page,
        pageSize: input?.pageSize,
        search: input?.search,
        role: input?.role,
        status: input?.status,
        clubStatus: input?.clubStatus,
        loginMethod: input?.loginMethod,
        hasOrders: input?.hasOrders,
        storeId
      });
    }),
    sendCoupon: adminProcedure3.input(z7.object({
      userId: z7.number(),
      code: z7.string().min(1),
      discountType: z7.enum(["percentage", "fixed"]),
      discountValue: z7.string(),
      minOrderValue: z7.string().optional(),
      maxUses: z7.number().optional(),
      expiresAt: z7.date().optional()
    })).mutation(({ input }) => createUserCoupon(input))
  }),
  reports: router({
    sales: staffProcedure.input(z7.object({ startDate: z7.date(), endDate: z7.date(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getSalesReport(input.startDate, input.endDate, storeId);
    }),
    topProducts: staffProcedure.input(
      z7.object({
        limit: z7.number().optional(),
        storeId: z7.number().optional(),
        startDate: z7.date().optional(),
        endDate: z7.date().optional()
      }).optional()
    ).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getTopProducts(input?.limit, storeId, {
        startDate: input?.startDate,
        endDate: input?.endDate
      });
    }),
    topCategories: staffProcedure.input(z7.object({ startDate: z7.date(), endDate: z7.date(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getTopCategories(input.startDate, input.endDate, storeId);
    }),
    ordersByPeriod: staffProcedure.input(z7.object({ startDate: z7.date(), endDate: z7.date(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getOrdersByPeriod(input.startDate, input.endDate, storeId);
    }),
    dailyRevenue: staffProcedure.input(z7.object({ days: z7.number().optional(), storeId: z7.number().optional(), timezoneOffset: z7.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getDailyRevenue(input?.days, storeId, input?.timezoneOffset);
    }),
    // Resumo de hoje calculado no servidor com suporte a timezone do cliente
    todaySummary: staffProcedure.input(z7.object({ timezoneOffset: z7.number().optional(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const now = /* @__PURE__ */ new Date();
      const todayStart = getTodayStartUtc(now);
      const todayEnd = getTodayEndUtc(now);
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1e3);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      const [today, yesterday] = await Promise.all([
        getSalesReport(todayStart, todayEnd, storeId),
        getSalesReport(yesterdayStart, yesterdayEnd, storeId)
      ]);
      return { today, yesterday };
    })
  }),
  // --- DRIVERS (MOTOBOYS) -----------------------------------------------------
  drivers: router({
    list: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllDrivers(false, storeId);
    }),
    create: staffProcedure.input(z7.object({ name: z7.string(), phone: z7.string().optional(), storeId: z7.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const token = crypto3.randomBytes(32).toString("hex");
      const id = await createDriver({ name: input.name, phone: input.phone ?? null, accessToken: token, active: true, storeId: storeId ?? null });
      return { id, accessToken: token };
    }),
    update: staffProcedure.input(z7.object({ id: z7.number(), name: z7.string().optional(), phone: z7.string().optional(), active: z7.boolean().optional() })).mutation(({ input }) => updateDriver(input.id, { name: input.name, phone: input.phone, active: input.active })),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(({ input }) => deleteDriver(input.id)),
    assignToOrder: staffProcedure.input(z7.object({ orderId: z7.number(), driverId: z7.number().nullable() })).mutation(async ({ input }) => {
      const prevOrder = await getOrderById(input.orderId);
      await assignDriverToOrder(input.orderId, input.driverId);
      const order = await getOrderById(input.orderId);
      if (input.driverId) {
        await sendPushToDriver(input.driverId, {
          title: "\u{1F6F5} Novo pedido atribu\xEDdo!",
          body: `Pedido #${input.orderId} \u2192 ${order?.deliveryAddress ?? "endere\xE7o n\xE3o informado"}`,
          url: "/motoboy",
          tag: `driver-order-${input.orderId}`
        });
        if (prevOrder?.driverId && prevOrder.driverId !== input.driverId) {
          await sendPushToDriver(prevOrder.driverId, {
            title: "Pedido removido da sua fila",
            body: `O pedido #${input.orderId} foi reatribu\xEDdo a outro entregador.`,
            url: "/motoboy",
            tag: `driver-unassigned-${input.orderId}`
          });
        }
      } else if (prevOrder?.driverId) {
        await sendPushToDriver(prevOrder.driverId, {
          title: "Pedido removido da sua fila",
          body: `O pedido #${input.orderId} foi removido da sua fila de entregas.`,
          url: "/motoboy",
          tag: `driver-unassigned-${input.orderId}`
        });
      }
    }),
    allLocations: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllActiveDriverLocations(storeId);
    }),
    updateLocation: publicProcedure.input(z7.object({ token: z7.string(), lat: z7.string(), lng: z7.string(), orderId: z7.number().optional() })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      await upsertDriverLocation(driver.id, input.lat, input.lng, input.orderId);
      return { ok: true };
    }),
    myActiveOrder: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      const loc = await getDriverLocation(driver.id);
      return { driver: { id: driver.id, name: driver.name }, activeOrderId: loc?.orderId ?? null };
    }),
    locationByOrder: protectedProcedure.input(z7.object({ orderId: z7.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      const isStaff = ctx.user.role === "admin" || ctx.user.role === "manager";
      if (order.userId !== ctx.user.id && !isStaff) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      if (!order.driverId) return null;
      const driverId = order.driverId;
      const loc = await getDriverLocation(driverId);
      if (!loc) return null;
      const driverInfo = await getDriverById(driverId);
      return { lat: loc.lat, lng: loc.lng, driverName: driverInfo?.name ?? "Motoboy", updatedAt: loc.updatedAt };
    }),
    // --- DRIVER APP: novas procedures ---
    // Dashboard do dia: entregas, ganhos, avaliação
    todayStats: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverTodayStats(driver.id);
    }),
    // Detalhes do pedido ativo (endereço, itens, cliente) — mantido por compatibilidade
    activeOrderDetails: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverActiveOrderDetails(driver.id);
    }),
    // Lista de TODOS os pedidos atribuídos ao motoboy (out_for_delivery)
    assignedOrders: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverAssignedOrders(driver.id);
    }),
    // Histórico de entregas do dia
    todayDeliveries: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverTodayDeliveries(driver.id);
    }),
    // Confirmar entrega: status → delivered + push para cliente
    confirmDelivery: publicProcedure.input(z7.object({ token: z7.string(), orderId: z7.number() })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      const result = await driverConfirmDelivery(driver.id, input.orderId);
      if (!result.success) throw new TRPCError7({ code: "BAD_REQUEST", message: result.error ?? "Erro ao confirmar entrega" });
      if (result.customerId) {
        await sendPushToUser(result.customerId, {
          title: "Pedido entregue! \u{1F355}",
          body: `Seu pedido #${input.orderId} chegou. Que tal avaliar a entrega?`,
          url: `/meus-pedidos?avaliar=${input.orderId}`,
          tag: `delivery-confirmed-${input.orderId}`
        });
        await createClientNotification({
          userId: result.customerId,
          title: "Pedido entregue! \u{1F355}",
          message: `Seu pedido #${input.orderId} foi entregue. Avalie a experi\xEAncia!`,
          type: "order"
        });
      }
      await sendPushToAdmins({
        title: "Entrega confirmada",
        body: `Pedido #${input.orderId} entregue por ${driver.name}`,
        url: "/admin",
        tag: `delivery-confirmed-${input.orderId}`
      });
      return { success: true };
    }),
    // Salvar push subscription do motoboy
    savePushSubscription: publicProcedure.input(z7.object({
      token: z7.string(),
      endpoint: z7.string(),
      p256dh: z7.string(),
      auth: z7.string(),
      userAgent: z7.string().optional()
    })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      await saveDriverPushSubscription(driver.id, input.endpoint, input.p256dh, input.auth, input.userAgent);
      return { ok: true };
    }),
    // Remover push subscription do motoboy
    removePushSubscription: publicProcedure.input(z7.object({ token: z7.string(), endpoint: z7.string() })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      await removeDriverPushSubscription(driver.id, input.endpoint);
      return { ok: true };
    })
  }),
  waiters: router({
    me: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      return waiter;
    }),
    tables: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      return getDiningTables({ storeId: waiter.storeId ?? void 0, activeOnly: true });
    }),
    sessions: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      const sessions = await getTableSessions({ storeId: waiter.storeId ?? void 0 });
      return sessions.filter(
        (session) => (session.status === "open" || session.status === "awaiting_closure") && (session.waiterStaffId == null || session.waiterStaffId === waiter.id)
      );
    }),
    menu: publicProcedure.input(z7.object({ token: z7.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      return getProducts({ storeId: waiter.storeId ?? void 0, activeOnly: true });
    }),
    openSession: publicProcedure.input(z7.object({
      token: z7.string(),
      tableId: z7.number(),
      customerName: z7.string().max(200).optional(),
      guestCount: z7.number().int().min(1).max(50).optional(),
      notes: z7.string().max(5e3).optional()
    })).mutation(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      const id = await openTableSession({
        tableId: input.tableId,
        storeId: waiter.storeId ?? null,
        waiterStaffId: waiter.id,
        customerName: input.customerName ?? null,
        guestCount: input.guestCount ?? 1,
        status: "open",
        notes: input.notes ?? null,
        subtotal: "0.00",
        discountAmount: "0.00",
        tipAmount: "0.00",
        total: "0.00"
      });
      return { id };
    }),
    addItem: publicProcedure.input(z7.object({
      token: z7.string(),
      tableSessionId: z7.number(),
      productId: z7.number(),
      quantity: z7.number().int().min(1).max(100),
      notes: z7.string().max(500).optional()
    })).mutation(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      await updateTableSession(input.tableSessionId, { waiterStaffId: waiter.id });
      const itemId = await addTableSessionItem({
        tableSessionId: input.tableSessionId,
        productId: input.productId,
        quantity: input.quantity,
        notes: input.notes ?? null,
        addedByStaffId: waiter.id
      });
      return { itemId };
    }),
    closeSession: publicProcedure.input(z7.object({
      token: z7.string(),
      id: z7.number(),
      discountAmount: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      tipAmount: z7.string().regex(/^\d+(\.\d{1,2})?$/).optional()
    })).mutation(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      await updateTableSession(input.id, { waiterStaffId: waiter.id });
      await closeTableSessionWithComputedTotals(input.id, {
        status: "closed",
        discountAmount: input.discountAmount,
        tipAmount: input.tipAmount,
        closedByStaffId: waiter.id
      });
      return { ok: true };
    })
  }),
  // --- PAYMENT SETTINGS -------------------------------------------------------
  paymentSettings: router({
    getPublic: publicProcedure.query(() => getPaymentSettingsPublic()),
    getAdmin: adminProcedure3.query(() => getPaymentSettingsAdmin()),
    save: adminProcedure3.input(z7.object({
      config: paymentConfigSchema,
      pixKey: z7.string().max(120)
    })).mutation(async ({ input }) => {
      await savePaymentSettings(input);
      return getPaymentSettingsAdmin();
    })
  }),
  // --- STORE SETTINGS ---------------------------------------------------------
  storeSettings: router({
    // Qualquer um pode ler (para validar horário/CEP no frontend)
    get: publicProcedure.query(async () => {
      const settings = await getAllStoreSettings();
      const { pixKey: _pk, whatsappNumber: _wn, ...publicSettings } = settings;
      return publicSettings;
    }),
    // Staff endpoint with all settings including sensitive fields
    getAdmin: staffProcedure.query(() => getAllStoreSettings()),
    // Staff pode salvar configurações da loja
    save: staffProcedure.input(z7.object({
      storeHours: z7.record(z7.string(), z7.union([
        z7.null(),
        z7.object({ open: z7.string(), close: z7.string() })
      ])),
      deliveryCepPrefixes: z7.array(z7.string()),
      pixKey: z7.string().optional(),
      whatsappNumber: z7.string().optional(),
      deliveryFee: z7.string().optional(),
      minOrderValue: z7.string().optional()
    })).mutation(async ({ input }) => {
      await setStoreSetting("storeHours", JSON.stringify(input.storeHours));
      await setStoreSetting("deliveryCepPrefixes", JSON.stringify(input.deliveryCepPrefixes));
      if (input.pixKey !== void 0) await setStoreSetting("pixKey", input.pixKey);
      if (input.whatsappNumber !== void 0) await setStoreSetting("whatsappNumber", input.whatsappNumber);
      if (input.deliveryFee !== void 0) await setStoreSetting("deliveryFee", input.deliveryFee);
      if (input.minOrderValue !== void 0) await setStoreSetting("minOrderValue", input.minOrderValue);
      return { success: true };
    }),
    savePizzaFlavorConfig: staffProcedure.input(z7.object({
      enabled: z7.boolean(),
      pricingMode: z7.enum(["highest"]).default("highest"),
      maxFlavorsBySize: z7.object({
        small: z7.number().int().min(1).max(4),
        medium: z7.number().int().min(1).max(4),
        large: z7.number().int().min(1).max(4),
        family: z7.number().int().min(1).max(4)
      })
    })).mutation(async ({ input }) => {
      await setStoreSetting("pizzaFlavorConfig", JSON.stringify(input));
      return { success: true };
    })
  }),
  // --- DELIVERY RATINGS -----------------------------------------------------------
  ratings: router({
    // Cliente avalia a entrega após receber o pedido
    submit: protectedProcedure.input(z7.object({
      orderId: z7.number(),
      rating: z7.number().min(1).max(5),
      comment: z7.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN", message: "Pedido n\xE3o pertence a voc\xEA" });
      if (order.status !== "delivered") throw new TRPCError7({ code: "BAD_REQUEST", message: "Pedido ainda n\xE3o foi entregue" });
      if (!order.driverId) throw new TRPCError7({ code: "BAD_REQUEST", message: "Pedido sem motoboy atribu\xEDdo" });
      const existing = await getRatingByOrder(input.orderId);
      if (existing) throw new TRPCError7({ code: "CONFLICT", message: "Pedido j\xE1 foi avaliado" });
      await submitDeliveryRating({
        orderId: input.orderId,
        driverId: order.driverId,
        userId: ctx.user.id,
        rating: input.rating,
        comment: input.comment ?? null
      });
      const userPhone = ctx.user.phone ?? void 0;
      fireJourneyTrigger("rating_submitted", ctx.user.id, userPhone).catch(() => {
      });
      if (input.rating <= 3) {
        fireJourneyTrigger("rating_negative", ctx.user.id, userPhone).catch(() => {
        });
      }
      return { success: true };
    }),
    // Verificar se um pedido já foi avaliado
    getByOrder: protectedProcedure.input(z7.object({ orderId: z7.number() })).query(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order || order.userId !== ctx.user.id) return null;
      return getRatingByOrder(input.orderId);
    }),
    // Perfil público do motoboy com avaliações e histórico
    driverProfile: publicProcedure.input(z7.object({ driverId: z7.number() })).query(async ({ input }) => {
      const driver = await getDriverById(input.driverId);
      if (!driver) throw new TRPCError7({ code: "NOT_FOUND", message: "Motoboy n\xE3o encontrado" });
      const [ratings, stats, history] = await Promise.all([
        getDriverRatings(input.driverId),
        getDriverAverageRating(input.driverId),
        getDriverDeliveryHistory(input.driverId)
      ]);
      const { accessToken: _at, phone: _ph, ...safeDriver } = driver;
      const safeRatings = ratings.map(({ userId: _uid, ...r }) => r);
      return { driver: safeDriver, ratings: safeRatings, stats, history };
    }),
    // Admin: ver todas as avaliações de um motoboy
    driverRatings: adminProcedure3.input(z7.object({ driverId: z7.number() })).query(({ input }) => getDriverRatings(input.driverId))
  }),
  // --- ADDRESSES --------------------------------------------------------------
  addresses: router({
    list: protectedProcedure.query(({ ctx }) => getUserAddresses(ctx.user.id)),
    create: protectedProcedure.input(z7.object({
      label: z7.string().min(1).max(50),
      address: z7.string().min(1),
      cep: z7.string().optional(),
      city: z7.string().optional(),
      isDefault: z7.boolean().optional()
    })).mutation(({ ctx, input }) => createUserAddress({ ...input, userId: ctx.user.id, isDefault: input.isDefault ?? false })),
    update: protectedProcedure.input(z7.object({
      id: z7.number(),
      label: z7.string().min(1).max(50).optional(),
      address: z7.string().min(1).optional(),
      cep: z7.string().optional(),
      city: z7.string().optional(),
      isDefault: z7.boolean().optional()
    })).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateUserAddress(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z7.object({ id: z7.number() })).mutation(({ ctx, input }) => deleteUserAddress(input.id, ctx.user.id))
  }),
  // --- FAVORITES --------------------------------------------------------------
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => getUserFavorites(ctx.user.id)),
    toggle: protectedProcedure.input(z7.object({ productId: z7.number() })).mutation(({ ctx, input }) => toggleFavorite(ctx.user.id, input.productId))
  }),
  // --- NOTIFICATIONS ----------------------------------------------------------
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => getClientNotifications(ctx.user.id)),
    unreadCount: protectedProcedure.query(({ ctx }) => getUnreadNotificationCount(ctx.user.id)),
    markRead: protectedProcedure.mutation(({ ctx }) => markNotificationsRead(ctx.user.id)),
    send: adminProcedure3.input(z7.object({
      userId: z7.number(),
      title: z7.string(),
      message: z7.string(),
      type: z7.enum(["order", "promo", "system"]).optional()
    })).mutation(({ input }) => createClientNotification({ ...input, type: input.type ?? "system" })),
    // --- Agendamento de notificações ---
    scheduleList: staffProcedure.query(() => listScheduledNotifications()),
    scheduleCreate: adminProcedure3.input(z7.object({
      title: z7.string().min(1).max(200),
      message: z7.string().min(1),
      channel: z7.enum(["push", "whatsapp", "both"]).default("push"),
      targetAudience: z7.enum(["all", "active", "inactive", "club"]).default("all"),
      scheduledAt: z7.date(),
      recurrence: z7.enum(["once", "daily", "weekly"]).default("once"),
      neighborhoodFilter: z7.array(z7.string()).optional().nullable()
    })).mutation(({ ctx, input }) => createScheduledNotification({
      title: input.title,
      message: input.message,
      channel: input.channel,
      targetAudience: input.targetAudience,
      scheduledAt: input.scheduledAt,
      recurrence: input.recurrence,
      neighborhoodFilter: input.neighborhoodFilter && input.neighborhoodFilter.length > 0 ? JSON.stringify(input.neighborhoodFilter) : null,
      status: "pending",
      sentCount: 0,
      createdBy: ctx.user.id
    })),
    scheduleCancel: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(({ input }) => cancelScheduledNotification(input.id)),
    scheduleDelete: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(({ input }) => deleteScheduledNotification(input.id))
  }),
  // --- LOYALTY ----------------------------------------------------------------
  loyalty: router({
    points: protectedProcedure.query(({ ctx }) => getUserLoyaltyPoints(ctx.user.id)),
    spendingHistory: protectedProcedure.query(({ ctx }) => getUserSpendingHistory(ctx.user.id)),
    history: protectedProcedure.query(({ ctx }) => getLoyaltyHistory(ctx.user.id)),
    // Preview do desconto de pontos (sem debitar — o débito acontece no createOrder)
    preview: protectedProcedure.input(z7.object({ points: z7.number().int().min(50).max(5e3) })).query(async ({ ctx, input }) => {
      const POINTS_TO_BRL = 0.1;
      const balance = await getUserLoyaltyPoints(ctx.user.id);
      const pts = Math.min(input.points, balance);
      if (pts < 50) throw new TRPCError7({ code: "BAD_REQUEST", message: "Pontos insuficientes para resgate." });
      const discount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
      return { discount, pointsUsed: pts, balance };
    }),
    // Admin: adicionar pontos manualmente
    adminAdd: adminProcedure3.input(z7.object({ userId: z7.number(), points: z7.number().int().min(1), description: z7.string().optional() })).mutation(async ({ input }) => {
      await addLoyaltyPoints(input.userId, input.points, void 0, input.description ?? `+${input.points} pontos (manual)`);
      return { ok: true };
    })
  }),
  // --- AVATAR -----------------------------------------------------------------------------
  avatar: router({
    upload: protectedProcedure.input(z7.object({
      base64: z7.string().max(4e6),
      // ~3MB base64 limit for avatars
      mimeType: z7.enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
    })).mutation(async ({ ctx, input }) => {
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const key = `avatars/user-${ctx.user.id}-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, input.mimeType);
      await updateUserAvatar(ctx.user.id, url);
      return { url };
    }),
    update: protectedProcedure.input(z7.object({ avatarUrl: z7.string().url() })).mutation(({ ctx, input }) => updateUserAvatar(ctx.user.id, input.avatarUrl))
  }),
  // --- CHAT (mensagens do pedido) ---
  chat: router({
    messages: protectedProcedure.input(z7.object({ orderId: z7.number() })).query(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError7({ code: "FORBIDDEN" });
      }
      const msgs = await getOrderMessages(input.orderId);
      return { messages: msgs, aiPaused: order.aiPaused ?? false };
    }),
    send: protectedProcedure.input(z7.object({ orderId: z7.number(), message: z7.string().min(1).max(1e3), senderRole: z7.enum(["customer", "admin"]).optional() })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError7({ code: "FORBIDDEN" });
      }
      const senderRole = input.senderRole ?? (ctx.user.role === "admin" ? "admin" : "customer");
      if (senderRole === "admin" && ctx.user.role !== "admin") {
        throw new TRPCError7({ code: "FORBIDDEN" });
      }
      const msg = await sendOrderMessage({ orderId: input.orderId, userId: ctx.user.id, senderRole, message: input.message });
      const pushPreview = input.message.length > 100 ? input.message.slice(0, 97) + "..." : input.message;
      if (senderRole === "customer") {
        await sendPushToAdmins({
          title: "Nova mensagem de cliente",
          body: `Pedido #${input.orderId} - ${order.customerName}: ${pushPreview}`,
          url: `/admin?tab=messages&order=${input.orderId}`,
          tag: `admin-chat-${input.orderId}`
        });
      }
      if (senderRole === "admin") {
        await sendPushToUser(order.userId, {
          title: "Mensagem da Bonatto Pizza",
          body: pushPreview,
          url: `/rastrear/${input.orderId}`,
          tag: `customer-chat-${input.orderId}`
        });
      }
      if (senderRole === "admin" && order.driverId) {
        await sendPushToDriver(order.driverId, {
          title: "Mensagem do restaurante",
          body: pushPreview,
          url: "/motoboy",
          tag: `driver-msg-${input.orderId}`
        });
      }
      return msg;
    }),
    markRead: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const order = await getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN" });
      }
      const readerRole = ctx.user.role === "admin" ? "admin" : "customer";
      await markMessagesRead(input.orderId, readerRole);
      return { ok: true };
    }),
    unreadCount: protectedProcedure.input(z7.object({ orderId: z7.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const order = await getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) return { count: 0 };
      }
      const readerRole = ctx.user.role === "admin" ? "admin" : "customer";
      return { count: await getUnreadCountForOrder(input.orderId, readerRole) };
    }),
    totalUnread: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin" || ctx.user.role === "manager") {
        return { count: await getTotalUnreadForAdmin() };
      }
      return { count: await getTotalUnreadForUser(ctx.user.id) };
    }),
    // IA responde automaticamente quando o cliente envia uma mensagem
    aiReply: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError7({ code: "FORBIDDEN" });
      }
      const [items, messages, products2, dbSettings] = await Promise.all([
        getOrderItems(input.orderId),
        getOrderMessages(input.orderId),
        getProducts({ activeOnly: true }),
        getAllStoreSettings()
      ]);
      const statusMap = {
        pending: "Aguardando confirma\xE7\xE3o",
        confirmed: "Confirmado",
        preparing: "Em preparo",
        out_for_delivery: "Saiu para entrega",
        delivered: "Entregue",
        cancelled: "Cancelado"
      };
      const itemsList = items.map((i) => `${i.productName} x${i.quantity} (R$ ${(parseFloat(i.productPrice) * i.quantity).toFixed(2)})`).join(", ");
      const menuSummary = products2.slice(0, 30).map((p) => `${p.name} \u2014 R$ ${p.price}`).join("; ");
      const history = messages.slice(-10).map((m) => `${m.senderRole === "admin" ? "Atendente" : "Cliente"}: ${m.message}`).join("\n");
      const { callLLM: callLLM2 } = await Promise.resolve().then(() => (init_llm2(), llm_exports2));
      const { content } = await callLLM2({
        messages: [
          {
            role: "system",
            content: `Voc\xEA \xE9 a assistente virtual da Bonatto Pizza, uma pizzaria artesanal em Mateus Leme/MG. Responda de forma simp\xE1tica, direta e em portugu\xEAs brasileiro. M\xE1ximo 3 frases curtas. Nunca invente informa\xE7\xF5es \u2014 baseie-se apenas no contexto fornecido.

Pedido #${order.id}:
- Cliente: ${order.customerName}
- Status: ${statusMap[order.status] ?? order.status}
- Itens: ${itemsList}
- Endere\xE7o: ${order.deliveryAddress}
- Pagamento: ${order.paymentMethod} (${order.paymentStatus === "paid" ? "pago" : "pendente"})

Card\xE1pio atual (resumo): ${menuSummary}

Hor\xE1rio de funcionamento: ${buildHoursDescription(dbSettings.storeHours)}.
Telefone/WhatsApp: ${dbSettings.whatsappNumber ?? "(37) 99999-0000"}`
          },
          ...messages.slice(-6).map((m) => ({
            role: m.senderRole === "admin" ? "assistant" : "user",
            content: m.message
          }))
        ],
        temperature: 0.6,
        maxTokens: 200
      });
      if (order.aiPaused) return { reply: "" };
      const adminUser = await getUserById(ctx.user.id);
      const adminId = adminUser?.id ?? ctx.user.id;
      const reply = content.trim();
      await sendOrderMessage({ orderId: input.orderId, userId: adminId, senderRole: "admin", message: reply });
      await sendPushToUser(order.userId, {
        title: "Resposta da Bonatto Pizza",
        body: reply.length > 100 ? reply.slice(0, 97) + "..." : reply,
        url: `/rastrear/${input.orderId}`,
        tag: `customer-chat-ai-${input.orderId}`
      });
      return { reply };
    }),
    // Solicitar atendente humano — pausa a IA e notifica o admin
    requestHuman: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id) throw new TRPCError7({ code: "FORBIDDEN" });
      await setOrderAiPaused(input.orderId, true);
      await sendPushToAdmins({
        title: "\u{1F9D1} Atendimento Humano Solicitado",
        body: `Pedido #${input.orderId} \u2014 ${order.customerName} quer falar com um atendente.`,
        url: `/admin?tab=messages&order=${input.orderId}`
      });
      const systemMsg = "Entendido! Vou chamar um atendente para voc\xEA. Aguarde um momento \u2014 normalmente respondemos em poucos minutos. \u{1F642}";
      await sendOrderMessage({ orderId: input.orderId, userId: ctx.user.id, senderRole: "admin", message: systemMsg });
      return { ok: true };
    }),
    // Retomar IA (admin pode reativar)
    resumeAI: protectedProcedure.input(z7.object({ orderId: z7.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError7({ code: "FORBIDDEN" });
      await setOrderAiPaused(input.orderId, false);
      return { ok: true };
    }),
    ordersWithMessages: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getOrdersWithMessages(storeId);
    })
  }),
  // ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
  push: router({
    subscribe: protectedProcedure.input(z7.object({
      endpoint: z7.string().url(),
      p256dh: z7.string(),
      auth: z7.string(),
      userAgent: z7.string().max(512).optional()
    })).mutation(async ({ ctx, input }) => {
      const safeUserAgent = input.userAgent?.substring(0, 512);
      await savePushSubscription(ctx.user.id, input.endpoint, input.p256dh, input.auth, safeUserAgent);
      return { ok: true };
    }),
    unsubscribe: protectedProcedure.input(z7.object({ endpoint: z7.string() })).mutation(async ({ ctx, input }) => {
      await removePushSubscription(ctx.user.id, input.endpoint);
      return { ok: true };
    }),
    vapidPublicKey: publicProcedure.query(() => {
      return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
    })
  }),
  // ─── MARKETING AUTOMATION ──────────────────────────────────────────────────
  automations: router({
    listJourneys: adminProcedure3.query(async () => {
      const list = await listJourneys();
      return list.map((j) => ({ ...j, steps: JSON.parse(j.steps) }));
    }),
    getJourney: adminProcedure3.input(z7.object({ id: z7.number() })).query(async ({ input }) => {
      const j = await getJourneyById(input.id);
      if (!j) throw new TRPCError7({ code: "NOT_FOUND" });
      return { ...j, steps: JSON.parse(j.steps) };
    }),
    createJourney: adminProcedure3.input(z7.object({
      name: z7.string().min(1),
      description: z7.string().optional(),
      trigger: z7.enum(["checkout_abandoned", "tag_inativo_15", "tag_inativo_30", "tag_inativo_60", "tag_inativo_custom", "first_order", "new_user", "club_subscriber", "manual", "order_delivered", "order_cancelled", "birthday", "loyalty_milestone", "rating_submitted", "rating_negative", "club_expiring", "first_order_month"]),
      steps: z7.array(z7.object({
        id: z7.string(),
        type: z7.enum(["wait", "send_whatsapp", "send_push", "condition", "add_tag", "remove_tag", "webhook", "send_coupon", "update_loyalty", "send_alert", "split_ab", "pause_journey", "notify_admin"]),
        label: z7.string(),
        delayMinutes: z7.number().optional(),
        message: z7.string().optional(),
        title: z7.string().optional(),
        condition: z7.enum(["purchased_since_start", "has_tag", "has_min_orders", "has_min_points"]).optional(),
        conditionTag: z7.string().optional(),
        conditionValue: z7.number().optional(),
        onTrue: z7.enum(["continue", "stop"]).optional(),
        onFalse: z7.enum(["continue", "stop"]).optional(),
        tag: z7.string().optional(),
        couponDiscountType: z7.enum(["percentage", "fixed"]).optional(),
        couponDiscountValue: z7.number().optional(),
        couponExpiryDays: z7.number().optional(),
        loyaltyPoints: z7.number().optional(),
        loyaltyDescription: z7.string().optional(),
        alertTitle: z7.string().optional(),
        alertMessage: z7.string().optional(),
        alertIcon: z7.string().optional(),
        alertUrl: z7.string().optional(),
        messageA: z7.string().optional(),
        messageB: z7.string().optional(),
        titleA: z7.string().optional(),
        titleB: z7.string().optional(),
        splitChannel: z7.enum(["whatsapp", "push"]).optional(),
        webhookUrl: z7.string().optional(),
        secret: z7.string().optional(),
        pauseJourneyId: z7.number().optional(),
        adminTaskTitle: z7.string().optional(),
        adminTaskMessage: z7.string().optional(),
        adminTaskPriority: z7.enum(["low", "normal", "high"]).optional()
      })),
      daysInactive: z7.number().optional()
    })).mutation(async ({ input }) => {
      const id = await createJourney(input);
      return { id };
    }),
    updateJourney: adminProcedure3.input(z7.object({
      id: z7.number(),
      name: z7.string().optional(),
      description: z7.string().optional(),
      trigger: z7.enum(["checkout_abandoned", "tag_inativo_15", "tag_inativo_30", "tag_inativo_60", "tag_inativo_custom", "first_order", "new_user", "club_subscriber", "manual", "order_delivered", "order_cancelled", "birthday", "loyalty_milestone", "rating_submitted", "rating_negative", "club_expiring", "first_order_month"]).optional(),
      status: z7.enum(["active", "paused", "draft"]).optional(),
      steps: z7.array(z7.object({
        id: z7.string(),
        type: z7.enum(["wait", "send_whatsapp", "send_push", "condition", "add_tag", "remove_tag", "webhook", "send_coupon", "update_loyalty", "send_alert", "split_ab", "pause_journey", "notify_admin"]),
        label: z7.string(),
        delayMinutes: z7.number().optional(),
        message: z7.string().optional(),
        title: z7.string().optional(),
        condition: z7.enum(["purchased_since_start", "has_tag", "has_min_orders", "has_min_points"]).optional(),
        conditionTag: z7.string().optional(),
        conditionValue: z7.number().optional(),
        onTrue: z7.enum(["continue", "stop"]).optional(),
        onFalse: z7.enum(["continue", "stop"]).optional(),
        tag: z7.string().optional(),
        couponDiscountType: z7.enum(["percentage", "fixed"]).optional(),
        couponDiscountValue: z7.number().optional(),
        couponExpiryDays: z7.number().optional(),
        loyaltyPoints: z7.number().optional(),
        loyaltyDescription: z7.string().optional(),
        alertTitle: z7.string().optional(),
        alertMessage: z7.string().optional(),
        alertIcon: z7.string().optional(),
        alertUrl: z7.string().optional(),
        messageA: z7.string().optional(),
        messageB: z7.string().optional(),
        titleA: z7.string().optional(),
        titleB: z7.string().optional(),
        splitChannel: z7.enum(["whatsapp", "push"]).optional(),
        webhookUrl: z7.string().optional(),
        secret: z7.string().optional()
      })).optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateJourney(id, data);
      return { ok: true };
    }),
    deleteJourney: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteJourney(input.id);
      return { ok: true };
    }),
    duplicateJourney: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      const newId = await duplicateJourney(input.id);
      if (newId === -1) throw new TRPCError7({ code: "NOT_FOUND", message: "Jornada n\xE3o encontrada" });
      return { id: newId };
    }),
    toggleJourney: adminProcedure3.input(z7.object({ id: z7.number(), status: z7.enum(["active", "paused", "draft"]) })).mutation(async ({ input }) => {
      await updateJourney(input.id, { status: input.status });
      return { ok: true };
    }),
    listExecutions: adminProcedure3.input(z7.object({ journeyId: z7.number().optional(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const executions = await listExecutions(input.journeyId);
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      if (!storeId || executions.length === 0) return executions;
      const db = await getDb();
      if (!db) return executions;
      const storeUserRows = await db.selectDistinct({ userId: orders.userId }).from(orders).where(and9(eq12(orders.storeId, storeId), isNotNull2(orders.userId)));
      const allowedUserIds = new Set(storeUserRows.map((row) => row.userId).filter((value) => typeof value === "number"));
      return executions.filter((execution) => allowedUserIds.has(execution.userId));
    }),
    cancelExecution: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await cancelExecution(input.id);
      return { ok: true };
    }),
    triggerJourney: adminProcedure3.input(z7.object({ journeyId: z7.number(), userIds: z7.array(z7.number()) })).mutation(async ({ input }) => {
      let started = 0;
      for (const uid of input.userIds) {
        const r = await startJourneyExecution(input.journeyId, uid);
        if (r > 0) started++;
      }
      return { started };
    }),
    listCustomerTags: adminProcedure3.query(async () => {
      const result = await getAllCustomerTagsWithUsers();
      return result[0];
    }),
    refreshTags: adminProcedure3.mutation(async () => {
      await refreshCustomerTags();
      return { ok: true };
    }),
    listAbandonedCarts: adminProcedure3.input(z7.object({ status: z7.enum(["pending", "recovered", "expired"]).optional() })).query(async ({ input }) => listAbandonedCarts(input.status)),
    registerAbandonedCart: protectedProcedure.input(z7.object({
      customerName: z7.string(),
      customerPhone: z7.string().optional(),
      items: z7.array(z7.object({
        productId: z7.number(),
        productName: z7.string(),
        quantity: z7.number(),
        productPrice: z7.string()
      })),
      total: z7.string()
    })).mutation(async ({ ctx, input }) => {
      const id = await registerAbandonedCart({ userId: ctx.user.id, ...input });
      return { id };
    }),
    generateWebhookToken: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      const token = crypto3.randomBytes(32).toString("hex");
      await updateJourney(input.id, { webhookToken: token });
      return { token };
    }),
    getWebhookToken: adminProcedure3.input(z7.object({ id: z7.number() })).query(async ({ input }) => {
      const j = await getJourneyById(input.id);
      if (!j) throw new TRPCError7({ code: "NOT_FOUND" });
      return { token: j.webhookToken };
    }),
    processExecutions: adminProcedure3.mutation(async () => {
      await processJourneyExecutions();
      return { ok: true };
    }),
    getExecutionLogs: adminProcedure3.input(z7.object({ executionId: z7.number() })).query(async ({ input }) => {
      const execs = await listExecutions();
      const exec = execs.find((e) => e.id === input.executionId);
      if (!exec) throw new TRPCError7({ code: "NOT_FOUND" });
      return {
        ...exec,
        logs: exec.logs ? JSON.parse(exec.logs) : []
      };
    }),
    testTrigger: adminProcedure3.input(z7.object({
      journeyId: z7.number(),
      trigger: z7.enum(["checkout_abandoned", "tag_inativo_15", "tag_inativo_30", "tag_inativo_60", "tag_inativo_custom", "first_order", "new_user", "club_subscriber", "manual", "order_delivered", "order_cancelled", "birthday", "loyalty_milestone", "rating_submitted", "rating_negative", "club_expiring", "first_order_month"]),
      userId: z7.number().optional(),
      phone: z7.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const targetUserId = input.userId ?? ctx.user.id;
      await startJourneyExecution(input.journeyId, targetUserId, input.phone);
      return { ok: true, message: `Gatilho disparado para jornada #${input.journeyId} com usu\xE1rio #${targetUserId}` };
    }),
    // ── Painel A/B: estatísticas de grupos A e B por jornada ─────────────────
    getAbStats: adminProcedure3.input(z7.object({ journeyId: z7.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { groupA: 0, groupB: 0, conversionA: 0, conversionB: 0, revenueA: 0, revenueB: 0 };
      const execs = await db.select().from(journeyExecutions).where(eq12(journeyExecutions.journeyId, input.journeyId));
      const groupA = execs.filter((e) => e.abGroup === "A");
      const groupB = execs.filter((e) => e.abGroup === "B");
      const convA = groupA.filter((e) => e.convertedAt !== null).length;
      const convB = groupB.filter((e) => e.convertedAt !== null).length;
      const convOrderIdsA = groupA.map((e) => e.conversionOrderId).filter(Boolean);
      const convOrderIdsB = groupB.map((e) => e.conversionOrderId).filter(Boolean);
      let revenueA = 0;
      let revenueB = 0;
      if (convOrderIdsA.length > 0) {
        const ordersA = await db.select({ total: orders.total }).from(orders).where(inArray4(orders.id, convOrderIdsA));
        revenueA = ordersA.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      }
      if (convOrderIdsB.length > 0) {
        const ordersB = await db.select({ total: orders.total }).from(orders).where(inArray4(orders.id, convOrderIdsB));
        revenueB = ordersB.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      }
      return {
        groupA: groupA.length,
        groupB: groupB.length,
        conversionA: convA,
        conversionB: convB,
        conversionRateA: groupA.length > 0 ? Math.round(convA / groupA.length * 100) : 0,
        conversionRateB: groupB.length > 0 ? Math.round(convB / groupB.length * 100) : 0,
        revenueA: Math.round(revenueA * 100) / 100,
        revenueB: Math.round(revenueB * 100) / 100
      };
    }),
    // ── Métricas globais de automações ───────────────────────────────────────
    getGlobalMetrics: adminProcedure3.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { totalExecutions: 0, completedExecutions: 0, conversions: 0, conversionRate: 0, attributedRevenue: 0, activeJourneys: 0, topJourneys: [] };
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      const now = /* @__PURE__ */ new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let allExecs = await db.select().from(journeyExecutions).where(gte4(journeyExecutions.startedAt, monthStart));
      if (storeId) {
        const storeUserRows = await db.selectDistinct({ userId: orders.userId }).from(orders).where(and9(eq12(orders.storeId, storeId), isNotNull2(orders.userId)));
        const allowedUserIds = new Set(storeUserRows.map((row) => row.userId).filter((value) => typeof value === "number"));
        allExecs = allExecs.filter((execution) => allowedUserIds.has(execution.userId));
      }
      const completed = allExecs.filter((e) => e.status === "completed").length;
      const conversions = allExecs.filter((e) => e.convertedAt !== null).length;
      const convOrderIds = allExecs.map((e) => e.conversionOrderId).filter(Boolean);
      let attributedRevenue = 0;
      if (convOrderIds.length > 0) {
        const convOrders = await db.select({ total: orders.total }).from(orders).where(inArray4(orders.id, convOrderIds));
        attributedRevenue = convOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      }
      const activeJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys).where(eq12(journeys.status, "active"));
      const execsByJourney = allExecs.reduce((acc, e) => {
        acc[e.journeyId] = (acc[e.journeyId] ?? 0) + 1;
        return acc;
      }, {});
      const allJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys);
      const topJourneys = Object.entries(execsByJourney).sort(([, a], [, b]) => b - a).slice(0, 5).map(([jId, count]) => ({
        id: Number(jId),
        name: allJourneysList.find((j) => j.id === Number(jId))?.name ?? `Jornada #${jId}`,
        executions: count,
        conversions: allExecs.filter((e) => e.journeyId === Number(jId) && e.convertedAt !== null).length
      }));
      return {
        totalExecutions: allExecs.length,
        completedExecutions: completed,
        conversions,
        conversionRate: allExecs.length > 0 ? Math.round(conversions / allExecs.length * 100) : 0,
        attributedRevenue: Math.round(attributedRevenue * 100) / 100,
        activeJourneys: activeJourneysList.length,
        topJourneys
      };
    }),
    // ── Histórico de jornadas por cliente ────────────────────────────────────
    getCustomerJourneyHistory: adminProcedure3.input(z7.object({ userId: z7.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const execs = await db.select().from(journeyExecutions).where(eq12(journeyExecutions.userId, input.userId)).orderBy(desc3(journeyExecutions.startedAt)).limit(50);
      const journeyIds = Array.from(new Set(execs.map((e) => e.journeyId)));
      const journeyList = journeyIds.length > 0 ? await db.select({ id: journeys.id, name: journeys.name, trigger: journeys.trigger }).from(journeys).where(inArray4(journeys.id, journeyIds)) : [];
      return execs.map((e) => ({
        ...e,
        journeyName: journeyList.find((j) => j.id === e.journeyId)?.name ?? `Jornada #${e.journeyId}`,
        journeyTrigger: journeyList.find((j) => j.id === e.journeyId)?.trigger ?? "manual",
        logs: e.logs ? JSON.parse(e.logs) : []
      }));
    })
  }),
  // ─── CRM ───────────────────────────────────────────────────────────────────
  crm: router({
    listCustomers: staffProcedure.input(z7.object({
      search: z7.string().optional(),
      tag: z7.string().optional(),
      limit: z7.number().optional(),
      offset: z7.number().optional(),
      storeId: z7.number().optional()
    })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      if (input.tag) {
        const customers2 = await getCrmCustomersByTag(input.tag);
        return { customers: customers2, total: customers2.length };
      }
      const [customers, total] = await Promise.all([
        getCrmCustomers({ search: input.search, limit: input.limit, offset: input.offset, storeId }),
        countCrmCustomers(input.search, storeId)
      ]);
      return { customers, total };
    }),
    getCustomerDetail: adminProcedure3.input(z7.object({ userId: z7.number(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const detail = await getCrmCustomerDetail(input.userId, storeId);
      if (!detail) throw new TRPCError7({ code: "NOT_FOUND" });
      const [tags, executions, carts] = await Promise.all([
        getTagsForCustomer(input.userId),
        getJourneyExecutionsByUser(input.userId),
        getAbandonedCartsByUser(input.userId)
      ]);
      return { ...detail, tags, executions, carts };
    }),
    assignTag: adminProcedure3.input(z7.object({ userId: z7.number(), tag: z7.string() })).mutation(async ({ input }) => {
      await assignTagToCustomer(input.userId, input.tag);
      return { ok: true };
    }),
    removeTag: adminProcedure3.input(z7.object({ userId: z7.number(), tag: z7.string() })).mutation(async ({ input }) => {
      await removeTagFromCustomer(input.userId, input.tag);
      return { ok: true };
    }),
    getStats: adminProcedure3.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getCrmStats(storeId);
    }),
    // ── Tags Personalizadas ──────────────────────────────────────────────
    listCustomTags: adminProcedure3.query(async () => {
      return listCustomTags();
    }),
    createCustomTag: adminProcedure3.input(z7.object({ name: z7.string().min(1).max(100), color: z7.string().default("#6b7280"), description: z7.string().optional() })).mutation(async ({ input }) => {
      const id = await createCustomTag(input);
      return { id };
    }),
    updateCustomTag: adminProcedure3.input(z7.object({ id: z7.number(), name: z7.string().optional(), color: z7.string().optional(), description: z7.string().optional() })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCustomTag(id, data);
      return { ok: true };
    }),
    deleteCustomTag: adminProcedure3.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteCustomTag(input.id);
      return { ok: true };
    }),
    assignCustomTag: adminProcedure3.input(z7.object({ userId: z7.number(), tagId: z7.number() })).mutation(async ({ input }) => {
      await assignCustomTagToCustomer(input.userId, input.tagId);
      return { ok: true };
    }),
    removeCustomTag: adminProcedure3.input(z7.object({ userId: z7.number(), tagId: z7.number() })).mutation(async ({ input }) => {
      await removeCustomTagFromCustomer(input.userId, input.tagId);
      return { ok: true };
    }),
    getCustomTagsForCustomer: adminProcedure3.input(z7.object({ userId: z7.number() })).query(async ({ input }) => {
      return getCustomTagsForCustomer(input.userId);
    }),
    getCustomersByCustomTag: adminProcedure3.input(z7.object({ tagName: z7.string() })).query(async ({ input }) => {
      return getCustomersByCustomTagName(input.tagName);
    }),
    triggerJourneyForTag: adminProcedure3.input(z7.object({ journeyId: z7.number(), tag: z7.string() })).mutation(async ({ input }) => {
      const customers = await getCrmCustomersByTag(input.tag);
      let started = 0;
      for (const c of customers) {
        const r = await startJourneyExecution(input.journeyId, c.id, c.phone ?? void 0);
        if (r > 0) started++;
      }
      return { started, total: customers.length };
    }),
    triggerJourneyForCustomer: adminProcedure3.input(z7.object({ journeyId: z7.number(), userId: z7.number() })).mutation(async ({ input }) => {
      const db = await Promise.resolve().then(() => (init_db(), db_exports));
      const detail = await db.getCrmCustomerDetail(input.userId);
      if (!detail) throw new TRPCError7({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado" });
      const r = await startJourneyExecution(input.journeyId, input.userId, detail.user.phone ?? void 0);
      return { started: r > 0 ? 1 : 0 };
    })
  }),
  // ── Templates de Notificação ──────────────────────────────────────────────
  notificationTemplates: router({
    list: staffProcedure.input(z7.object({ event: z7.string().optional(), channel: z7.string().optional() }).optional()).query(async ({ input }) => listNotificationTemplates(input ?? {})),
    seed: staffProcedure.mutation(async () => {
      await seedNotificationTemplates();
      return { ok: true };
    }),
    create: staffProcedure.input(z7.object({
      event: z7.enum(["order_confirmed", "order_preparing", "order_out_for_delivery", "order_delivered", "order_cancelled", "cart_abandoned_step1", "cart_abandoned_step2", "cart_abandoned_step3", "reactivation_15", "reactivation_30", "reactivation_60", "custom"]),
      channel: z7.enum(["push", "whatsapp", "both"]).default("both"),
      title: z7.string().min(1).max(200),
      body: z7.string().min(1),
      redirectUrl: z7.string().max(500).optional(),
      isActive: z7.boolean().default(true)
    })).mutation(async ({ input }) => {
      const id = await createNotificationTemplate(input);
      return { id };
    }),
    update: staffProcedure.input(z7.object({
      id: z7.number(),
      title: z7.string().min(1).max(200).optional(),
      body: z7.string().min(1).optional(),
      isActive: z7.boolean().optional(),
      channel: z7.enum(["push", "whatsapp", "both"]).optional(),
      redirectUrl: z7.string().max(500).optional().nullable()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateNotificationTemplate(id, data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteNotificationTemplate(input.id);
      return { ok: true };
    }),
    // Disparo de notificação personalizada em massa
    sendCustom: staffProcedure.input(z7.object({
      title: z7.string().min(1).max(200),
      body: z7.string().min(1),
      redirectUrl: z7.string().optional(),
      // ex: "/cardapio", "/promocoes", URL completa
      tag: z7.string().optional()
      // tag de cliente para segmentar (ex: "inativo_30")
      // se tag for undefined, envia para todos
    })).mutation(async ({ input }) => {
      let userIds;
      if (input.tag) {
        const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const { customerTags: customerTags2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
        const { eq: eq14 } = await import("drizzle-orm");
        const db = await getDb2();
        if (db) {
          const rows = await db.select({ userId: customerTags2.userId }).from(customerTags2).where(eq14(customerTags2.tag, input.tag));
          userIds = rows.map((r) => r.userId);
          if (userIds.length === 0) return { sent: 0, failed: 0, skipped: true };
        }
      }
      const result = await sendPushToAllUsers(
        {
          title: input.title,
          body: input.body,
          url: input.redirectUrl ?? "/",
          tag: input.tag ? `custom-${input.tag}` : "custom"
        },
        userIds
      );
      return result;
    })
  }),
  // --- ZONAS DE ENTREGA POR BAIRRO ---
  deliveryZones: router({
    // Público: buscar zona por bairro (usado no checkout)
    search: publicProcedure.input(z7.object({ query: z7.string().min(1) })).query(async ({ input }) => {
      return searchDeliveryZones(input.query);
    }),
    getByNeighborhood: publicProcedure.input(z7.object({ neighborhood: z7.string() })).query(async ({ input }) => {
      return getDeliveryZoneByNeighborhood(input.neighborhood);
    }),
    // Staff: CRUD completo
    list: staffProcedure.query(async () => {
      return getAllDeliveryZones(false);
    }),
    create: staffProcedure.input(z7.object({
      neighborhood: z7.string().min(1).max(200),
      city: z7.string().max(200).optional(),
      deliveryFee: z7.string(),
      estimatedMinutes: z7.number().int().min(1).optional()
    })).mutation(async ({ input }) => {
      const id = await createDeliveryZone(input);
      return { id };
    }),
    update: staffProcedure.input(z7.object({
      id: z7.number(),
      neighborhood: z7.string().min(1).max(200).optional(),
      city: z7.string().max(200).optional(),
      deliveryFee: z7.string().optional(),
      estimatedMinutes: z7.number().int().min(1).optional(),
      isActive: z7.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateDeliveryZone(id, data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteDeliveryZone(input.id);
      return { ok: true };
    })
  }),
  // --- LOJAS (MULTI-TENANT) --------------------------------------------------
  stores: storesRouter,
  restaurantNetwork: router({
    distributionProducts: staffProcedure.input(z7.object({ activeOnly: z7.boolean().optional() }).optional()).query(({ input }) => listDistributionProducts({ activeOnly: input?.activeOnly ?? true })),
    createDistributionProduct: adminProcedure3.input(distributionProductSchema).mutation(({ ctx, input }) => createDistributionProduct(input, ctx.user.id)),
    updateDistributionProduct: adminProcedure3.input(updateDistributionProductSchema).mutation(({ ctx, input }) => updateDistributionProduct(input, ctx.user.id)),
    overview: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      startDate: z7.date(),
      endDate: z7.date()
    })).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getFinancialOverview({ storeId, startDate: input.startDate, endDate: input.endDate });
    }),
    supplyOrders: staffProcedure.input(z7.object({
      storeId: z7.number().optional(),
      status: z7.string().optional()
    }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return listSupplyOrders({ storeId, status: input?.status });
    }),
    supplyOrderDetails: staffProcedure.input(z7.object({ id: z7.number() })).query(async ({ input }) => getSupplyOrderDetails(input.id)),
    createSupplyOrder: staffProcedure.input(createSupplyOrderSchema).mutation(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      if (!storeId) throw new TRPCError7({ code: "BAD_REQUEST", message: "Selecione uma loja para criar o pedido ao centro de distribui\xE7\xE3o." });
      return createSupplyOrder({ ...input, storeId }, ctx.user.id);
    }),
    updateSupplyOrderStatus: staffProcedure.input(updateSupplyOrderStatusSchema).mutation(async ({ ctx, input }) => updateSupplyOrderStatus(input, ctx.user.id)),
    createExpense: staffProcedure.input(createExpenseSchema).mutation(async ({ ctx, input }) => {
      const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
      return createExpense(input, ctx.user.id, scopedStoreId);
    }),
    createFinancialFee: staffProcedure.input(createFinancialFeeSchema).mutation(async ({ ctx, input }) => {
      const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
      return createFinancialFee(input, ctx.user.id, scopedStoreId);
    }),
    upsertMonthlyClosing: staffProcedure.input(createMonthlyClosingSchema).mutation(async ({ ctx, input }) => {
      const scopedStoreId = await resolveStoreId(ctx.user, input.storeId);
      return upsertMonthlyClosing(input, ctx.user.id, scopedStoreId);
    }),
    monthlyClosings: staffProcedure.input(z7.object({ storeId: z7.number().optional(), year: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return listMonthlyClosings({ storeId, year: input?.year });
    }),
    auditLogs: staffProcedure.input(z7.object({ storeId: z7.number().optional(), limit: z7.number().min(1).max(250).optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return listAuditLogs({ storeId, limit: input?.limit });
    })
  }),
  // --- CLUBE DO BONATTO -------------------------------------------------------
  club: clubRouter,
  // --- MENU SLIDES -----------------------------------------------------------
  analytics: router({
    salesOverview: staffProcedure.input(z7.object({
      startDate: z7.date(),
      endDate: z7.date(),
      storeId: z7.number().optional()
    })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getSalesOverview(input.startDate, input.endDate, storeId);
    }),
    salesTimeSeries: staffProcedure.input(z7.object({
      startDate: z7.date(),
      endDate: z7.date(),
      storeId: z7.number().optional(),
      timezoneOffset: z7.number().optional()
    })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getSalesTimeSeries(input.startDate, input.endDate, storeId, input.timezoneOffset);
    }),
    recentOrders: staffProcedure.input(z7.object({ limit: z7.number().int().min(1).max(50).optional(), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getRecentOrdersFeed(input.limit ?? 20, storeId);
    }),
    globalSearch: staffProcedure.input(z7.object({ query: z7.string().trim().min(2).max(80), storeId: z7.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
      const { sql: sql8 } = await import("drizzle-orm");
      const likeQuery = `%${input.query}%`;
      const storeClause = storeId ? sql8`AND o.storeId = ${storeId}` : sql8``;
      const messageStoreClause = storeId ? sql8`AND ord.storeId = ${storeId}` : sql8``;
      const tableStoreClause = storeId ? sql8`AND dt.storeId = ${storeId}` : sql8``;
      const [ordersResult, customersResult, tablesResult, conversationsResult] = await Promise.all([
        db.execute(sql8`
            SELECT o.id, o.customerName, o.customerPhone, o.status, o.total, o.createdAt
            FROM orders o
            WHERE (
              CAST(o.id AS CHAR) LIKE ${likeQuery}
              OR o.customerName LIKE ${likeQuery}
              OR o.customerPhone LIKE ${likeQuery}
            )
            ${storeClause}
            ORDER BY o.createdAt DESC
            LIMIT 8
          `),
        db.execute(sql8`
            SELECT u.id, u.name, u.email, u.phone, MAX(o.createdAt) AS lastOrderAt
            FROM users u
            LEFT JOIN orders o ON o.userId = u.id
            WHERE u.role = 'user'
              AND (
                u.name LIKE ${likeQuery}
                OR u.email LIKE ${likeQuery}
                OR u.phone LIKE ${likeQuery}
              )
              ${storeId ? sql8`AND EXISTS (SELECT 1 FROM orders ox WHERE ox.userId = u.id AND ox.storeId = ${storeId})` : sql8``}
            GROUP BY u.id, u.name, u.email, u.phone
            ORDER BY lastOrderAt DESC
            LIMIT 8
          `),
        db.execute(sql8`
            SELECT dt.id, dt.name, dt.status, ts.id AS sessionId, ts.customerName, ts.updatedAt
            FROM dining_tables dt
            LEFT JOIN table_sessions ts ON ts.tableId = dt.id AND ts.status IN ('open', 'awaiting_closure')
            WHERE (
              dt.name LIKE ${likeQuery}
              OR ts.customerName LIKE ${likeQuery}
            )
            ${tableStoreClause}
            ORDER BY ts.updatedAt DESC, dt.updatedAt DESC
            LIMIT 8
          `),
        db.execute(sql8`
            SELECT ord.id AS orderId, ord.customerName, MAX(om.createdAt) AS lastMessageAt, MAX(om.message) AS lastMessage
            FROM order_messages om
            INNER JOIN orders ord ON ord.id = om.orderId
            WHERE (
              ord.customerName LIKE ${likeQuery}
              OR CAST(ord.id AS CHAR) LIKE ${likeQuery}
              OR om.message LIKE ${likeQuery}
            )
            ${messageStoreClause}
            GROUP BY ord.id, ord.customerName
            ORDER BY lastMessageAt DESC
            LIMIT 8
          `)
      ]);
      return {
        orders: ordersResult[0],
        customers: customersResult[0],
        tables: tablesResult[0],
        conversations: conversationsResult[0]
      };
    }),
    dashboardSnapshot: staffProcedure.input(z7.object({ storeId: z7.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAdminDashboardSnapshot(storeId);
    })
  }),
  menuSlides: router({
    uploadImage: staffProcedure.input(z7.object({
      base64: z7.string().max(43e5),
      // keep below Vercel request-size limits
      mimeType: z7.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z7.string().max(255).optional()
    })).mutation(async ({ input }) => {
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 85, 1920);
      const key = `banners/slide-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] banner comprimido ${reductionPct}% \u2192 WebP`);
      return { url };
    }),
    list: publicProcedure.query(() => getMenuSlides(true)),
    listAll: staffProcedure.query(() => getMenuSlides(false)),
    seed: staffProcedure.mutation(() => seedMenuSlides()),
    create: staffProcedure.input(z7.object({
      title: z7.string().min(1).max(200),
      subtitle: z7.string().max(300).optional().nullable(),
      imageUrl: z7.string().max(2e3).optional().nullable(),
      videoUrl: z7.string().max(2e3).optional().nullable(),
      badgeText: z7.string().max(80).optional().nullable(),
      ctaText: z7.string().max(80).optional().nullable(),
      ctaLink: z7.string().max(500).optional().nullable(),
      sortOrder: z7.number().int().optional()
    })).mutation(({ input }) => createMenuSlide(input)),
    update: staffProcedure.input(z7.object({
      id: z7.number(),
      title: z7.string().min(1).max(200).optional(),
      subtitle: z7.string().max(300).optional().nullable(),
      imageUrl: z7.string().max(2e3).optional().nullable(),
      videoUrl: z7.string().max(2e3).optional().nullable(),
      badgeText: z7.string().max(80).optional().nullable(),
      ctaText: z7.string().max(80).optional().nullable(),
      ctaLink: z7.string().max(500).optional().nullable(),
      sortOrder: z7.number().int().optional(),
      isActive: z7.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateMenuSlide(id, data);
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteMenuSlide(input.id);
      return { ok: true };
    })
  }),
  // --- CARROSSEL HERO --------------------------------------------------------
  carousel: router({
    list: publicProcedure.query(() => getCarouselImages(true)),
    listAll: staffProcedure.query(() => getCarouselImages(false)),
    uploadImage: staffProcedure.input(z7.object({
      base64: z7.string().max(43e5),
      // keep below Vercel request-size limits
      mimeType: z7.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z7.string().max(255).optional()
    })).mutation(async ({ input }) => {
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 85, 1920);
      const key = `carousel/hero-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] carrossel comprimido ${reductionPct}% \u2192 WebP`);
      return { url };
    }),
    create: staffProcedure.input(z7.object({ imageUrl: z7.string().min(1), title: z7.string().optional().nullable(), sortOrder: z7.number().optional() })).mutation(({ input }) => createCarouselImage(input)),
    update: staffProcedure.input(z7.object({ id: z7.number(), imageUrl: z7.string().optional(), title: z7.string().optional().nullable(), sortOrder: z7.number().optional(), active: z7.boolean().optional() })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateCarouselImage(id, data);
    }),
    delete: staffProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
      await deleteCarouselImage(input.id);
      return { ok: true };
    })
  }),
  // ─── RECOVERY DASHBOARD ─────────────────────────────────────────────────────────────
  recovery: router({
    /** KPIs gerais de recuperação de receita */
    stats: adminProcedure3.input(z7.object({
      period: z7.enum(["7d", "30d", "90d"]).default("30d")
    })).query(async ({ input }) => {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { sql: sql8 } = await import("drizzle-orm");
      const db = await getDb2();
      if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
      const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
      const [cartStats] = await db.execute(sql8`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            ROUND(SUM(CASE WHEN status = 'recovered' THEN CAST(total AS DECIMAL(10,2)) ELSE 0 END), 2) AS recoveredRevenue
          FROM abandoned_carts
          WHERE createdAt >= ${since}
        `);
      const [reactivationStats] = await db.execute(sql8`
          SELECT
            COUNT(DISTINCT userId) AS totalInactive,
            SUM(CASE WHEN type = 'reactivation_15d' THEN 1 ELSE 0 END) AS sent15d,
            SUM(CASE WHEN type = 'reactivation_30d' THEN 1 ELSE 0 END) AS sent30d,
            SUM(CASE WHEN type = 'reactivation_60d' THEN 1 ELSE 0 END) AS sent60d
          FROM automation_events
          WHERE createdAt >= ${since} AND type LIKE 'reactivation_%' AND channel = 'whatsapp'
        `);
      const [conversionStats] = await db.execute(sql8`
          SELECT
            COUNT(*) AS totalConversions,
            ROUND(SUM(o.total), 2) AS conversionRevenue
          FROM automation_events ae
          JOIN orders o ON o.id = ae.orderId
          WHERE ae.createdAt >= ${since} AND ae.type = 'conversion'
        `);
      const [stepStats] = await db.execute(sql8`
          SELECT
            step,
            COUNT(*) AS sent,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted
          FROM automation_events
          WHERE createdAt >= ${since} AND type LIKE 'cart_step%'
          GROUP BY step
          ORDER BY step
        `);
      const cart = cartStats[0] ?? { total: 0, recovered: 0, expired: 0, pending: 0, recoveredRevenue: "0" };
      const react = reactivationStats[0] ?? { totalInactive: 0, sent15d: 0, sent30d: 0, sent60d: 0 };
      const conv = conversionStats[0] ?? { totalConversions: 0, conversionRevenue: "0" };
      const steps = stepStats;
      const recoveryRate = Number(cart.total) > 0 ? Math.round(Number(cart.recovered) / Number(cart.total) * 100) : 0;
      return {
        period: input.period,
        carts: {
          total: Number(cart.total),
          recovered: Number(cart.recovered),
          expired: Number(cart.expired),
          pending: Number(cart.pending),
          recoveryRate,
          recoveredRevenue: Number(cart.recoveredRevenue)
        },
        reactivation: {
          sent15d: Number(react.sent15d),
          sent30d: Number(react.sent30d),
          sent60d: Number(react.sent60d),
          totalSent: Number(react.sent15d) + Number(react.sent30d) + Number(react.sent60d)
        },
        conversions: {
          total: Number(conv.totalConversions),
          revenue: Number(conv.conversionRevenue)
        },
        steps: steps.map((s) => ({
          step: Number(s.step),
          sent: Number(s.sent),
          converted: Number(s.converted),
          conversionRate: Number(s.sent) > 0 ? Math.round(Number(s.converted) / Number(s.sent) * 100) : 0
        }))
      };
    }),
    /** Lista de carrinhos abandonados com filtro */
    abandonedCarts: adminProcedure3.input(z7.object({
      status: z7.enum(["pending", "recovered", "expired"]).optional(),
      limit: z7.number().min(1).max(100).default(50)
    })).query(async ({ input }) => {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb2();
      if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
      const { abandonedCarts: acTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const conditions = [];
      if (input.status) conditions.push(eqFn(acTable.status, input.status));
      const rows = await db.select().from(acTable).where(conditions.length > 0 ? andFn(...conditions) : void 0).orderBy(acTable.createdAt).limit(input.limit);
      return rows.map((r) => ({ ...r, items: JSON.parse(r.items) }));
    }),
    /** Lista de eventos de automação para auditoria */
    events: adminProcedure3.input(z7.object({
      type: z7.string().optional(),
      limit: z7.number().min(1).max(200).default(100)
    })).query(async ({ input }) => {
      const { getDb: getDb3 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb3();
      if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
      const { automationEvents: aeTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const conditions = [];
      if (input.type) conditions.push(eqFn(aeTable.type, input.type));
      return db.select().from(aeTable).where(conditions.length > 0 ? andFn(...conditions) : void 0).orderBy(aeTable.createdAt).limit(input.limit);
    }),
    /** Disparo manual de reativação */
    triggerReactivation: adminProcedure3.mutation(async () => {
      await processReactivation();
      return { ok: true };
    })
  }),
  // --- CARRINHO ABANDONADO (CLIENTE) -----------------------------------------
  cart: router({
    /** Lista carrinhos pendentes do usuário logado */
    myAbandoned: protectedProcedure.query(async ({ ctx }) => {
      const { getDb: getDb4 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb4();
      if (!db) return [];
      const { abandonedCarts: acTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const rows = await db.select().from(acTable).where(andFn(eqFn(acTable.userId, ctx.user.id), eqFn(acTable.status, "pending"))).orderBy(acTable.createdAt);
      return rows.map((r) => ({
        id: r.id,
        total: r.total,
        couponCode: r.couponCode,
        currentStep: r.currentStep,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        items: JSON.parse(r.items)
      }));
    }),
    /** Descarta (marca como expirado) um carrinho abandonado do usuário */
    dismiss: protectedProcedure.input(z7.object({ cartId: z7.number() })).mutation(async ({ ctx, input }) => {
      const { getDb: getDb4 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb4();
      if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
      const { abandonedCarts: acTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      await db.update(acTable).set({ status: "expired" }).where(andFn(eqFn(acTable.id, input.cartId), eqFn(acTable.userId, ctx.user.id)));
      return { ok: true };
    }),
    /** Busca um carrinho pelo ID para restaurar no checkout */
    getById: protectedProcedure.input(z7.object({ cartId: z7.number() })).query(async ({ ctx, input }) => {
      const { getDb: getDb4 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb4();
      if (!db) return null;
      const { abandonedCarts: acTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const [row] = await db.select().from(acTable).where(andFn(eqFn(acTable.id, input.cartId), eqFn(acTable.userId, ctx.user.id))).limit(1);
      if (!row) return null;
      return {
        id: row.id,
        total: row.total,
        couponCode: row.couponCode,
        items: JSON.parse(row.items)
      };
    })
  }),
  // --- CLIENT ALERTS ----------------------------------------------------------
  clientAlerts: router({
    // Lista alertas ativos não lidos pelo cliente logado
    list: protectedProcedure.query(({ ctx }) => listClientAlerts(ctx.user.id)),
    // Conta alertas não lidos (para badge no nav)
    unreadCount: protectedProcedure.query(({ ctx }) => countUnreadClientAlerts(ctx.user.id)),
    // Marca alerta como lido
    dismiss: protectedProcedure.input(z7.object({ alertId: z7.number() })).mutation(({ input, ctx }) => dismissClientAlert(input.alertId, ctx.user.id)),
    // Admin: criar alerta manual (novidades do clube, comunicados etc.)
    createManual: staffProcedure.input(z7.object({
      type: z7.enum(["promotion", "raffle", "coupon", "club", "custom"]),
      title: z7.string().min(1),
      message: z7.string().min(1),
      icon: z7.string().optional(),
      url: z7.string().optional(),
      expiresAt: z7.date().optional()
    })).mutation(({ input }) => createClientAlert(input))
  })
});

// server/_core/bootstrapRoute.ts
import { z as z8 } from "zod";

// server/bootstrapAccess.ts
init_schema();
init_db();
import bcrypt2 from "bcryptjs";
import crypto4 from "crypto";
import { eq as eq13 } from "drizzle-orm";
function buildDefaultPassword() {
  return `Bonatto@${crypto4.randomBytes(6).toString("hex")}!`;
}
async function bootstrapAdminAndDriver(input = {}) {
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL nao configurada ou banco indisponivel.");
  }
  const adminEmail = input.adminEmail?.trim().toLowerCase() || "admin@bonatto.local";
  const adminName = input.adminName?.trim() || "Administrador Bonatto";
  const adminPassword = input.adminPassword?.trim() || buildDefaultPassword();
  const driverName = input.driverName?.trim() || "Motoboy Bonatto";
  const driverPhone = input.driverPhone?.trim() || null;
  const existingAdmin = await db.select().from(users).where(eq13(users.email, adminEmail)).limit(1);
  const passwordHash = await bcrypt2.hash(adminPassword, 12);
  if (existingAdmin[0]) {
    await db.update(users).set({
      name: adminName,
      passwordHash,
      loginMethod: "email",
      role: "admin",
      emailVerified: true,
      lastSignedIn: /* @__PURE__ */ new Date()
    }).where(eq13(users.id, existingAdmin[0].id));
  } else {
    await db.insert(users).values({
      openId: `email_${crypto4.randomBytes(16).toString("hex")}`,
      name: adminName,
      email: adminEmail,
      passwordHash,
      loginMethod: "email",
      role: "admin",
      emailVerified: true,
      lastSignedIn: /* @__PURE__ */ new Date()
    });
  }
  const driverToken = crypto4.randomBytes(32).toString("hex");
  const existingDriver = await db.select().from(drivers).where(eq13(drivers.name, driverName)).limit(1);
  if (existingDriver[0]) {
    await db.update(drivers).set({
      name: driverName,
      phone: driverPhone,
      active: true,
      accessToken: driverToken
    }).where(eq13(drivers.id, existingDriver[0].id));
  } else {
    await db.insert(drivers).values({
      name: driverName,
      phone: driverPhone,
      active: true,
      accessToken: driverToken
    });
  }
  return {
    admin: {
      email: adminEmail,
      password: adminPassword,
      role: "admin"
    },
    motoboy: {
      name: driverName,
      token: driverToken,
      appUrl: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/motoboy`
    }
  };
}

// server/_core/bootstrapRoute.ts
var bootstrapSchema = z8.object({
  adminEmail: z8.string().email().optional(),
  adminName: z8.string().min(2).max(120).optional(),
  adminPassword: z8.string().min(8).max(120).optional(),
  driverName: z8.string().min(2).max(120).optional(),
  driverPhone: z8.string().max(30).nullable().optional()
});
function registerBootstrapRoute(app) {
  app.post("/api/bootstrap/access", async (req, res) => {
    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (!expectedSecret) {
      return res.status(404).json({ error: "Not found" });
    }
    const providedSecret = req.headers["x-bootstrap-secret"]?.trim() || (req.headers.authorization?.replace(/^Bearer\s+/i, "").trim() ?? "");
    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = bootstrapSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Payload invalido",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }
    try {
      const result = await bootstrapAdminAndDriver(parsed.data);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("[bootstrap-route] erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao criar acessos"
      });
    }
  });
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/oauth.ts
init_db();
import { SignJWT as SignJWT2, jwtVerify as jwtVerify2 } from "jose";
init_env();
var GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function getStateSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || "bonatto-oauth-state-dev-secret");
}
function buildBaseAppUrl(req) {
  return (ENV.publicAppUrl || `${req.protocol}://${req.get("host") ?? ""}`).replace(/\/+$/, "");
}
function buildCallbackUrl(req) {
  return `${buildBaseAppUrl(req)}/api/oauth/callback`;
}
function sanitizeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
async function signOAuthState(payload) {
  return new SignJWT2(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime("10m").sign(getStateSecret());
}
async function parseSignedState(state) {
  const { payload } = await jwtVerify2(state, getStateSecret(), {
    algorithms: ["HS256"]
  });
  const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
  const returnPath = typeof payload.returnPath === "string" ? payload.returnPath : "/";
  const provider = payload.provider === "google" ? payload.provider : void 0;
  if (!redirectUri) {
    throw new Error("Invalid OAuth state payload");
  }
  return {
    provider,
    redirectUri,
    returnPath: sanitizeReturnPath(returnPath)
  };
}
function parseLegacyOAuthState(state) {
  const decoded = Buffer.from(state, "base64").toString("utf-8");
  const [redirectUri = "", returnPath = "/"] = decoded.split("|");
  if (!redirectUri) {
    throw new Error("Invalid OAuth state payload");
  }
  return {
    redirectUri,
    returnPath: sanitizeReturnPath(returnPath)
  };
}
async function parseOAuthState(state) {
  try {
    return await parseSignedState(state);
  } catch {
    return parseLegacyOAuthState(state);
  }
}
async function exchangeGoogleCodeForTokens(code, redirectUri) {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error("Google OAuth is not configured");
  }
  const body = new URLSearchParams({
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    const text2 = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${text2}`);
  }
  return await response.json();
}
async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    const text2 = await response.text();
    throw new Error(`Google userinfo failed: ${response.status} ${text2}`);
  }
  return await response.json();
}
async function resolveGoogleUser(profile) {
  const providerUserId = profile.sub;
  const normalizedEmail = profile.email?.trim().toLowerCase();
  let user = await getUserByAuthProvider("google", providerUserId);
  let isNew = false;
  if (!user && normalizedEmail && profile.email_verified) {
    user = await getUserByEmail(normalizedEmail);
  }
  if (!user) {
    const openId = `google:${providerUserId}`;
    await upsertUser({
      openId,
      name: profile.name ?? "Cliente Bonatto",
      email: normalizedEmail ?? null,
      loginMethod: "google",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    user = await getUserByOpenId(openId);
    isNew = true;
  }
  if (!user) {
    throw new Error("Failed to resolve Google user");
  }
  await updateUserSocialProfile(user.id, {
    name: !user.name && profile.name ? profile.name : void 0,
    email: !user.email && normalizedEmail && profile.email_verified ? normalizedEmail : void 0,
    avatarUrl: profile.picture ?? void 0,
    loginMethod: "google",
    emailVerified: profile.email_verified === true ? true : void 0,
    lastSignedIn: /* @__PURE__ */ new Date()
  });
  await linkCustomerAuthProvider({
    userId: user.id,
    provider: "google",
    providerUserId,
    providerEmail: normalizedEmail ?? null,
    isPrimary: user.loginMethod === "google" || !user.loginMethod
  });
  const refreshedUser = await getUserById(user.id);
  if (!refreshedUser) {
    throw new Error("Failed to reload Google user");
  }
  return { user: refreshedUser, isNew };
}
async function finalizeLogin(req, res, openId, name, returnPath) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: DEFAULT_SESSION_MS
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
  res.redirect(302, sanitizeReturnPath(returnPath));
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/google/start", async (req, res) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).json({ error: "Google OAuth is not configured" });
      return;
    }
    try {
      const redirectUri = buildCallbackUrl(req);
      const returnPath = sanitizeReturnPath(getQueryParam(req, "returnTo"));
      const state = await signOAuthState({
        provider: "google",
        redirectUri,
        returnPath
      });
      const url = new URL(GOOGLE_AUTH_ENDPOINT);
      url.searchParams.set("client_id", ENV.googleClientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");
      res.redirect(302, url.toString());
    } catch (error) {
      console.error("[OAuth] Google start failed", error);
      res.status(500).json({ error: "Google OAuth start failed" });
    }
  });
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const parsedState = await parseOAuthState(state);
      const expectedCallback = buildCallbackUrl(req);
      if (!parsedState.redirectUri || parsedState.redirectUri !== expectedCallback) {
        return res.status(400).json({ error: "Invalid OAuth redirect target" });
      }
      if (parsedState.provider === "google") {
        const tokenResponse2 = await exchangeGoogleCodeForTokens(code, expectedCallback);
        const profile = await fetchGoogleUserInfo(tokenResponse2.access_token);
        if (!profile.sub) {
          res.status(400).json({ error: "Google user id missing" });
          return;
        }
        const { user, isNew: isNew2 } = await resolveGoogleUser(profile);
        if (isNew2) {
          fireJourneyTrigger("new_user", user.id, user.phone ?? void 0).catch(
            (error) => console.error("[OAuth] new_user trigger failed", error)
          );
        }
        await finalizeLogin(req, res, user.openId, user.name ?? "Cliente Bonatto", parsedState.returnPath);
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      const { isNew } = await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      if (isNew) {
        const newUser = await getUserByOpenId(userInfo.openId);
        if (newUser) {
          fireJourneyTrigger("new_user", newUser.id, newUser.phone ?? void 0).catch(
            (error) => console.error("[OAuth] new_user trigger failed", error)
          );
        }
      }
      await finalizeLogin(req, res, userInfo.openId, userInfo.name || "", parsedState.returnPath);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
init_env();
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/apiApp.ts
var globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisicoes. Tente novamente em alguns minutos." },
  skip: (req) => req.path.startsWith("/api/stripe/webhook")
});
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Muitas tentativas de autenticacao. Aguarde 15 minutos." }
});
var criticalLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de operacoes atingido. Tente novamente em breve." }
});
var uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1e3,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos uploads em pouco tempo. Aguarde alguns minutos." }
});
var messagingLimiter = rateLimit({
  windowMs: 5 * 60 * 1e3,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas acoes de mensagens ou notificacoes. Tente novamente em instantes." }
});
var bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite temporario atingido para bootstrap administrativo." }
});
var oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de autenticacao social. Aguarde alguns minutos." }
});
function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
function buildAllowedHosts(publicAppUrl, hostHeader) {
  const allowedHosts = /* @__PURE__ */ new Set();
  if (publicAppUrl) {
    const hostname = hostnameOf(publicAppUrl);
    if (hostname) allowedHosts.add(hostname);
  }
  if (hostHeader) {
    allowedHosts.add(hostHeader.split(":")[0].toLowerCase());
  }
  return allowedHosts;
}
async function configureApiApp(app) {
  const publicAppUrl = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: "sameorigin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      noSniff: true,
      strictTransportSecurity: { maxAge: 31536e3, includeSubDomains: true },
      xssFilter: true
    })
  );
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/automations/webhook/:token", handleAutomationWebhook);
  app.post("/api/asaas/webhook", express.json({ limit: "256kb" }), async (req, res) => {
    try {
      const token = req.headers["asaas-access-token"] ?? "";
      if (!verifyAsaasWebhook(token)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const event = req.body;
      console.log(`[Asaas Webhook] Event: ${event.event} | ID: ${event.id ?? "?"}`);
      if (event.id) {
        try {
          const first = await recordWebhookEventOnce("asaas", event.id, event.event);
          if (!first) {
            return res.json({ received: true, duplicate: true });
          }
        } catch (error) {
          console.error("[Asaas Webhook] idempotency ledger failed:", error);
        }
      }
      if ((event.event === "PAYMENT_RECEIVED" || event.event === "PAYMENT_CONFIRMED") && event.payment) {
        const orderId = event.payment.externalReference ? parseInt(event.payment.externalReference, 10) : null;
        if (orderId && !Number.isNaN(orderId)) {
          await updateOrderPaymentStatus(orderId, "paid", void 0, void 0, event.payment.id);
          await createTransaction({
            orderId,
            stripePaymentIntentId: event.payment.id,
            amount: String(event.payment.value ?? 0),
            currency: "brl",
            status: "succeeded",
            paymentMethod: "pix",
            metadata: JSON.stringify({
              asaasPaymentId: event.payment.id,
              netValue: event.payment.netValue
            })
          });
          notifyOwnerAdapter({
            title: `PIX confirmado - Pedido #${orderId}`,
            body: `Pagamento de R$ ${(event.payment.value ?? 0).toFixed(2)} recebido via Asaas.`
          }).catch(console.error);
        }
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("[Asaas Webhook] Error:", error);
      return res.status(500).json({ error: "Internal error" });
    }
  });
  app.use("/api/trpc", (req, res, next) => {
    if (req.method !== "POST" && req.method !== "GET") {
      return next();
    }
    const origin = req.headers.origin ?? "";
    const referer = req.headers.referer ?? "";
    const allowedHosts = buildAllowedHosts(publicAppUrl, req.headers.host);
    const originHost = origin ? hostnameOf(origin) : null;
    const refererHost = referer ? hostnameOf(referer) : null;
    if (!origin && !referer) {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Origin obrigatorio" });
      }
      return next();
    }
    const checkHost = origin ? originHost : refererHost;
    if (!checkHost || !allowedHosts.has(checkHost)) {
      return res.status(403).json({ error: "Origin nao autorizado" });
    }
    return next();
  });
  app.use("/api/trpc", express.json({ limit: "6mb" }));
  app.use("/api/trpc", express.urlencoded({ limit: "6mb", extended: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.use("/api/bootstrap/access", bootstrapLimiter);
  app.use("/api/oauth", oauthLimiter);
  app.use("/api", globalLimiter);
  const authProcedures = /* @__PURE__ */ new Set([
    "auth.loginEmail",
    "auth.registerEmail",
    "auth.forgotPassword",
    "auth.resetPassword"
  ]);
  const criticalProcedures = /* @__PURE__ */ new Set([
    "orders.create",
    "coupons.validate",
    "payments.createIntent",
    "payments.createCheckoutSession",
    "payments.checkoutWithSavedCard",
    "club.subscribe",
    "asaas.createPix"
  ]);
  const uploadProcedures = /* @__PURE__ */ new Set([
    "avatar.upload",
    "products.uploadImage",
    "menuSlides.uploadImage",
    "carousel.uploadImage"
  ]);
  const messagingProcedures = /* @__PURE__ */ new Set([
    "chat.send",
    "push.subscribe",
    "push.unsubscribe",
    "drivers.savePushSubscription",
    "drivers.removePushSubscription"
  ]);
  const applyLimiter = (limiter, match) => (req, res, next) => {
    const raw = req.path.replace(/^\/+/, "");
    const procedures = raw.split(",").map((procedure) => procedure.trim()).filter(Boolean);
    if (procedures.some(match)) {
      return limiter(req, res, next);
    }
    return next();
  };
  app.use("/api/trpc", applyLimiter(authLimiter, (procedure) => authProcedures.has(procedure)));
  app.use("/api/trpc", applyLimiter(criticalLimiter, (procedure) => criticalProcedures.has(procedure)));
  app.use("/api/trpc", applyLimiter(uploadLimiter, (procedure) => uploadProcedures.has(procedure)));
  app.use("/api/trpc", applyLimiter(messagingLimiter, (procedure) => messagingProcedures.has(procedure)));
  registerBootstrapRoute(app);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// api/_all-source.ts
var appPromise = (async () => {
  const app = express2();
  await configureApiApp(app);
  return app;
})();
async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
