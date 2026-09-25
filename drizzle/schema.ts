import {
  boolean,
  decimal,
  index,
    integer,
      pgTable,
    serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  firstName: varchar("firstName", { length: 160 }),
  lastName: varchar("lastName", { length: 160 }),
  email: varchar("email", { length: 320 }),
  username: varchar("username", { length: 191 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 32 }).$type<"user" | "admin" | "manager">().default("user").notNull(),
  phone: varchar("phone", { length: 20 }),
  status: varchar("status", { length: 32 }).$type<"active" | "inactive" | "suspended" | "setup_pending">().default("active").notNull(),
  savedAddress: text("savedAddress"),
  savedStreet: varchar("savedStreet", { length: 240 }),
  savedNumber: varchar("savedNumber", { length: 40 }),
  savedComplement: varchar("savedComplement", { length: 160 }),
  savedNeighborhood: varchar("savedNeighborhood", { length: 160 }),
  savedCep: varchar("savedCep", { length: 10 }),
  savedCity: varchar("savedCity", { length: 100 }),
  savedState: varchar("savedState", { length: 2 }),
  savedLatitude: decimal("savedLatitude", { precision: 10, scale: 7 }),
  savedLongitude: decimal("savedLongitude", { precision: 10, scale: 7 }),
  savedGeocodedAt: timestamp("savedGeocodedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: text("passwordHash"),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
  sessionInvalidBefore: timestamp("sessionInvalidBefore"),
  totpSecretEncrypted: text("totpSecretEncrypted"),
  totpPendingSecretEncrypted: text("totpPendingSecretEncrypted"),
  totpEnabled: boolean("totpEnabled").default(false).notNull(),
  totpConfirmedAt: timestamp("totpConfirmedAt"),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  profileCompleted: boolean("profileCompleted").default(false).notNull(),
  avatarUrl: text("avatarUrl"),
  loyaltyPoints: integer("loyaltyPoints").default(0).notNull(),
  // Clube do Bonatto
  clubPlan: varchar("clubPlan", { length: 32 }).$type<"bonattao" | "basico">(),
  clubStatus: varchar("clubStatus", { length: 32 }).$type<"active" | "pending" | "cancelled">(),
  clubStartDate: timestamp("clubStartDate"),
  clubNextBillingDate: timestamp("clubNextBillingDate"),
  clubFreePizzaUsed: boolean("clubFreePizzaUsed").default(false).notNull(),
  clubFreePizzaResetAt: timestamp("clubFreePizzaResetAt"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
}, (t) => ({
  emailIdx: index("users_email_idx").on(t.email),
  resetTokenIdx: index("users_reset_token_idx").on(t.resetToken),
  phoneIdx: index("users_phone_idx").on(t.phone),
}));

// --- STORES (UNIDADES) -------------------------------------------------------
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
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
  status: varchar("status", { length: 32 }).$type<"active" | "inactive" | "suspended" | "setup_pending">().default("active").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  // Dados fiscais para emissão de NFC-e via Focus NFe
  cnpj: varchar("cnpj", { length: 18 }),
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 30 }),
  regimeTributario: integer("regimeTributario").default(1), // 1=Simples Nacional, 3=Lucro Real
  csc: varchar("csc", { length: 100 }), // Código de Segurança do Contribuinte
  cscId: varchar("cscId", { length: 10 }), // ID do CSC
  focusNfeToken: varchar("focusNfeToken", { length: 200 }), // Token da loja no Focus NFe
  nfceEnabled: boolean("nfceEnabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  slugIdx: uniqueIndex("stores_slug_idx").on(t.slug),
  activeIdx: index("stores_active_idx").on(t.active),
  statusIdx: index("stores_status_idx").on(t.status),
}));
export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

// --- ACESSO POR UNIDADE -------------------------------------------------------
export const userStoreAccess = pgTable("user_store_access", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  storeId: integer("storeId").notNull(),
  role: varchar("role", { length: 32 }).$type<"admin" | "manager" | "cashier" | "kitchen" | "marketing" | "finance" | "viewer">().default("viewer").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("user_store_access_user_idx").on(t.userId),
  storeIdx: index("user_store_access_store_idx").on(t.storeId),
  storeRoleIdx: index("user_store_access_store_role_idx").on(t.storeId, t.role),
  uniqueAccess: uniqueIndex("user_store_access_unique").on(t.userId, t.storeId),
}));
export type UserStoreAccess = typeof userStoreAccess.$inferSelect;

export const storeAuditLogs = pgTable("store_audit_logs", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  actorUserId: integer("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: varchar("resourceId", { length: 96 }),
  requestId: varchar("requestId", { length: 96 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeCreatedIdx: index("store_audit_logs_store_created_idx").on(t.storeId, t.createdAt),
  actorIdx: index("store_audit_logs_actor_idx").on(t.actorUserId, t.createdAt),
  actionIdx: index("store_audit_logs_action_idx").on(t.action, t.createdAt),
}));

export const storeSitePages = pgTable("store_site_pages", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  pageKey: varchar("pageKey", { length: 32 }).$type<"home" | "menu" | "club" | "landing">().notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  draftContent: text("draftContent").notNull(),
  publishedVersionId: integer("publishedVersionId"),
  updatedByUserId: integer("updatedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storePageUnique: uniqueIndex("store_site_pages_store_page_uq").on(t.storeId, t.pageKey),
  storeIdx: index("store_site_pages_store_idx").on(t.storeId),
}));

export const storeSitePageVersions = pgTable("store_site_page_versions", {
  id: serial("id").primaryKey(),
  pageId: integer("pageId").notNull(),
  versionNumber: integer("versionNumber").notNull(),
  content: text("content").notNull(),
  note: varchar("note", { length: 240 }),
  createdByUserId: integer("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  pageVersionUnique: uniqueIndex("store_site_page_versions_uq").on(t.pageId, t.versionNumber),
  pageIdx: index("store_site_page_versions_page_idx").on(t.pageId, t.createdAt),
}));

export const customerStoreAccounts = pgTable("customer_store_accounts", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  userId: integer("userId").notNull(),
  loyaltyPoints: integer("loyaltyPoints").default(0).notNull(),
  clubPlan: varchar("clubPlan", { length: 32 }).$type<"bonattao" | "basico">(),
  clubStatus: varchar("clubStatus", { length: 32 }).$type<"active" | "pending" | "cancelled">(),
  clubStartDate: timestamp("clubStartDate"),
  clubNextBillingDate: timestamp("clubNextBillingDate"),
  clubFreePizzaUsed: boolean("clubFreePizzaUsed").default(false).notNull(),
  clubFreePizzaResetAt: timestamp("clubFreePizzaResetAt"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeUserIdx: index("customer_store_accounts_store_user_idx").on(t.storeId, t.userId),
  uniqueAccount: uniqueIndex("customer_store_accounts_unique").on(t.storeId, t.userId),
}));

export const storeTrackingSettings = pgTable("store_tracking_settings", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  metaPixelEnabled: boolean("metaPixelEnabled").default(false).notNull(),
  metaPixelId: varchar("metaPixelId", { length: 64 }),
  googleAnalyticsEnabled: boolean("googleAnalyticsEnabled").default(false).notNull(),
  googleAnalyticsId: varchar("googleAnalyticsId", { length: 64 }),
  googleAdsEnabled: boolean("googleAdsEnabled").default(false).notNull(),
  googleAdsId: varchar("googleAdsId", { length: 64 }),
  tiktokPixelEnabled: boolean("tiktokPixelEnabled").default(false).notNull(),
  tiktokPixelId: varchar("tiktokPixelId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeUnique: uniqueIndex("store_tracking_settings_store_uq").on(t.storeId),
}));

export const marketingSessions = pgTable("marketing_sessions", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  visitorId: varchar("visitorId", { length: 96 }).notNull(),
  sessionId: varchar("sessionId", { length: 96 }).notNull(),
  userId: integer("userId"),
  utmSource: varchar("utmSource", { length: 160 }),
  utmMedium: varchar("utmMedium", { length: 160 }),
  utmCampaign: varchar("utmCampaign", { length: 200 }),
  utmContent: varchar("utmContent", { length: 200 }),
  utmTerm: varchar("utmTerm", { length: 200 }),
  fbclid: varchar("fbclid", { length: 255 }),
  gclid: varchar("gclid", { length: 255 }),
  ttclid: varchar("ttclid", { length: 255 }),
  referrer: text("referrer"),
  landingPage: text("landingPage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeSessionUnique: uniqueIndex("marketing_sessions_store_session_uq").on(t.storeId, t.sessionId),
  storeCreatedIdx: index("marketing_sessions_store_created_idx").on(t.storeId, t.createdAt),
  storeSourceCreatedIdx: index("marketing_sessions_store_source_created_idx").on(t.storeId, t.utmSource, t.createdAt),
  visitorIdx: index("marketing_sessions_visitor_idx").on(t.visitorId),
}));

export const orderAttributions = pgTable("order_attributions", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  storeId: integer("storeId").notNull(),
  visitorId: varchar("visitorId", { length: 96 }),
  sessionId: varchar("sessionId", { length: 96 }),
  utmSource: varchar("utmSource", { length: 160 }),
  utmMedium: varchar("utmMedium", { length: 160 }),
  utmCampaign: varchar("utmCampaign", { length: 200 }),
  utmContent: varchar("utmContent", { length: 200 }),
  utmTerm: varchar("utmTerm", { length: 200 }),
  fbclid: varchar("fbclid", { length: 255 }),
  gclid: varchar("gclid", { length: 255 }),
  ttclid: varchar("ttclid", { length: 255 }),
  referrer: text("referrer"),
  landingPage: text("landingPage"),
  firstTouchSource: varchar("firstTouchSource", { length: 160 }),
  firstTouchMedium: varchar("firstTouchMedium", { length: 160 }),
  firstTouchCampaign: varchar("firstTouchCampaign", { length: 200 }),
  lastTouchSource: varchar("lastTouchSource", { length: 160 }),
  lastTouchMedium: varchar("lastTouchMedium", { length: 160 }),
  lastTouchCampaign: varchar("lastTouchCampaign", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderUnique: uniqueIndex("order_attributions_order_uq").on(t.orderId),
  storeCreatedIdx: index("order_attributions_store_created_idx").on(t.storeId, t.createdAt),
  storeSourceCreatedIdx: index("order_attributions_store_source_created_idx").on(t.storeId, t.utmSource, t.createdAt),
  sessionIdx: index("order_attributions_session_idx").on(t.sessionId),
}));

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 96 }).notNull(),
  eventType: varchar("eventType", { length: 48 }).$type<
    "STORE_VIEW" | "MENU_VIEW" | "CATEGORY_VIEW" | "PRODUCT_VIEW" |
    "ADD_TO_CART" | "REMOVE_FROM_CART" | "CART_VIEW" |
    "CHECKOUT_STARTED" | "CHECKOUT_STEP_COMPLETED" |
    "ORDER_CREATED" | "ORDER_PAID" | "ORDER_CONFIRMED" |
    "ORDER_PREPARING" | "ORDER_READY" | "ORDER_DISPATCHED" |
    "ORDER_COMPLETED" | "ORDER_CANCELLED"
  >().notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  storeId: integer("storeId").notNull(),
  sessionId: varchar("sessionId", { length: 96 }).notNull(),
  visitorId: varchar("visitorId", { length: 96 }),
  customerId: integer("customerId"),
  productId: integer("productId"),
  categoryId: integer("categoryId"),
  orderId: integer("orderId"),
  source: varchar("source", { length: 80 }),
  utmSource: varchar("utmSource", { length: 160 }),
  utmMedium: varchar("utmMedium", { length: 160 }),
  utmCampaign: varchar("utmCampaign", { length: 200 }),
  utmContent: varchar("utmContent", { length: 200 }),
  utmTerm: varchar("utmTerm", { length: 200 }),
  deviceType: varchar("deviceType", { length: 32 }).$type<"mobile" | "tablet" | "desktop" | "unknown">().default("unknown").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  eventUnique: uniqueIndex("analytics_events_event_uq").on(t.eventId),
  storeEventOccurredIdx: index("analytics_events_store_event_occurred_idx").on(t.storeId, t.eventType, t.occurredAt),
  storeSessionOccurredIdx: index("analytics_events_store_session_occurred_idx").on(t.storeId, t.sessionId, t.occurredAt),
  productEventOccurredIdx: index("analytics_events_product_event_occurred_idx").on(t.storeId, t.productId, t.eventType, t.occurredAt),
  categoryEventOccurredIdx: index("analytics_events_category_event_occurred_idx").on(t.storeId, t.categoryId, t.eventType, t.occurredAt),
  orderEventIdx: index("analytics_events_order_event_idx").on(t.orderId, t.eventType),
}));
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export const menuRecommendationDismissals = pgTable("menu_recommendation_dismissals", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  recommendationKey: varchar("recommendationKey", { length: 220 }).notNull(),
  ruleType: varchar("ruleType", { length: 64 }).notNull(),
  productId: integer("productId"),
  categoryId: integer("categoryId"),
  dismissedByUserId: integer("dismissedByUserId"),
  dismissedAt: timestamp("dismissedAt").defaultNow().notNull(),
}, (t) => ({
  storeKeyUnique: uniqueIndex("menu_recommendation_dismissals_store_key_uq").on(t.storeId, t.recommendationKey),
  productIdx: index("menu_recommendation_dismissals_product_idx").on(t.storeId, t.productId),
  categoryIdx: index("menu_recommendation_dismissals_category_idx").on(t.storeId, t.categoryId),
}));
export type MenuRecommendationDismissal = typeof menuRecommendationDismissals.$inferSelect;

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  icon: varchar("icon", { length: 64 }),
  externalSource: varchar("externalSource", { length: 32 }),
  externalMerchantId: varchar("externalMerchantId", { length: 128 }),
  externalId: varchar("externalId", { length: 128 }),
  sortOrder: integer("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("categories_store_idx").on(t.storeId),
  storeSlugUnique: uniqueIndex("categories_store_slug_unique").on(t.storeId, t.slug),
  activeOrderIdx: index("categories_active_order_idx").on(t.active, t.sortOrder),
  externalIdx: uniqueIndex("categories_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
}));

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  categoryId: integer("categoryId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("imageUrl"),
  externalSource: varchar("externalSource", { length: 32 }),
  externalMerchantId: varchar("externalMerchantId", { length: 128 }),
  externalId: varchar("externalId", { length: 128 }),
  externalCode: varchar("externalCode", { length: 128 }),
  sku: varchar("sku", { length: 128 }),
  shortDescription: varchar("shortDescription", { length: 320 }),
  productType: varchar("productType", { length: 32 }).$type<"simple" | "sizes" | "variants" | "buildable" | "multi_flavor" | "combo" | "weight" | "quantity" | "variable_price">().default("simple").notNull(),
  pricingEngine: varchar("pricingEngine", { length: 32 }).$type<"legacy_v1" | "configured_v2">().default("legacy_v1").notNull(),
  editorialStatus: varchar("editorialStatus", { length: 32 }).$type<"draft" | "published" | "scheduled" | "archived">().default("published").notNull(),
  preparationTime: integer("preparationTime"),
  allergenNotice: text("allergenNotice"),
  nutritionalInfo: text("nutritionalInfo"),
  tags: text("tags"),
  minQuantity: integer("minQuantity").default(1).notNull(),
  maxQuantity: integer("maxQuantity").default(99).notNull(),
  couponEligible: boolean("couponEligible").default(true).notNull(),
  pointsEligible: boolean("pointsEligible").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  scheduledPublishAt: timestamp("scheduledPublishAt"),
  publishedAt: timestamp("publishedAt"),
  archivedAt: timestamp("archivedAt"),
  active: boolean("active").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("products_store_idx").on(t.storeId),
  categoryIdx: index("products_category_idx").on(t.categoryId),
  activeIdx: index("products_active_idx").on(t.active),
  externalIdx: uniqueIndex("products_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
  storeSkuUnique: uniqueIndex("products_store_sku_uq").on(t.storeId, t.sku),
  editorialIdx: index("products_editorial_idx").on(t.storeId, t.editorialStatus, t.active),
}));

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  code: varchar("code", { length: 50 }).notNull(),
  externalSource: varchar("externalSource", { length: 32 }),
  externalMerchantId: varchar("externalMerchantId", { length: 128 }),
  externalId: varchar("externalId", { length: 128 }),
  discountType: varchar("discountType", { length: 32 }).$type<"percentage" | "fixed">().notNull(),
  discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
  minOrderValue: decimal("minOrderValue", { precision: 10, scale: 2 }).default("0"),
  maxUses: integer("maxUses"),
  usedCount: integer("usedCount").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  // If userId is set, this coupon is exclusive to that user
  userId: integer("userId"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("coupons_store_idx").on(t.storeId),
  storeCodeUnique: uniqueIndex("coupons_store_code_unique").on(t.storeId, t.code),
  userIdx: index("coupons_user_idx").on(t.userId),
  externalIdx: uniqueIndex("coupons_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
}));

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 40 }),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }),
  storeId: integer("storeId"),  // qual unidade recebeu o pedido
  userId: integer("userId"),
  serviceType: varchar("serviceType", { length: 32 }).$type<"delivery" | "pickup" | "dine_in" | "counter">().default("delivery").notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 20 }),
  deliveryAddress: text("deliveryAddress").notNull(),
  deliveryNeighborhood: varchar("deliveryNeighborhood", { length: 120 }),
  deliveryCity: varchar("deliveryCity", { length: 100 }),
  deliveryCep: varchar("deliveryCep", { length: 10 }),
  deliveryComplement: varchar("deliveryComplement", { length: 200 }),
  deliveryState: varchar("deliveryState", { length: 2 }),
  deliveryLatitude: decimal("deliveryLatitude", { precision: 10, scale: 7 }),
  deliveryLongitude: decimal("deliveryLongitude", { precision: 10, scale: 7 }),
  deliveryStraightLineMeters: integer("deliveryStraightLineMeters"),
  deliveryRouteDistanceMeters: integer("deliveryRouteDistanceMeters"),
  deliveryDistanceMeters: integer("deliveryDistanceMeters"),
  deliveryEstimatedMinutes: integer("deliveryEstimatedMinutes"),
  deliveryDistanceZoneId: integer("deliveryDistanceZoneId"),
  deliveryStoreLatitude: decimal("deliveryStoreLatitude", { precision: 10, scale: 7 }),
  deliveryStoreLongitude: decimal("deliveryStoreLongitude", { precision: 10, scale: 7 }),
  deliveryGeocodingProvider: varchar("deliveryGeocodingProvider", { length: 64 }),
  deliveryRoutingProvider: varchar("deliveryRoutingProvider", { length: 64 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0"),
  deliveryFee: decimal("deliveryFee", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  couponCode: varchar("couponCode", { length: 50 }),
  status: varchar("status", { length: 32 }).$type<"pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled">().default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 32 }).$type<"credit_card" | "debit_card" | "pix" | "cash">().notNull(),
  paymentStatus: varchar("paymentStatus", { length: 32 }).$type<"pending" | "paid" | "failed" | "refunded">().default("pending").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  asaasPaymentId: varchar("asaasPaymentId", { length: 255 }),
  pointsDiscount: decimal("pointsDiscount", { precision: 10, scale: 2 }).default("0"),
  pointsUsed: integer("pointsUsed").default(0),
  notes: text("notes"),
  driverId: integer("driverId"),
  driverAcceptedAt: timestamp("driverAcceptedAt"),
  deliveryConfirmationCode: varchar("deliveryConfirmationCode", { length: 4 }),
  tableSessionId: integer("tableSessionId"),
  predictedReadyAt: timestamp("predictedReadyAt"),
  predictedDeliveredAt: timestamp("predictedDeliveredAt"),
  predictionLabel: varchar("predictionLabel", { length: 120 }),
  confirmedAt: timestamp("confirmedAt"),
  preparingAt: timestamp("preparingAt"),
  readyAt: timestamp("readyAt"),
  outForDeliveryAt: timestamp("outForDeliveryAt"),
  deliveredAt: timestamp("deliveredAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReasonCode: varchar("cancellationReasonCode", { length: 32 }).$type<
    "customer_request" | "payment" | "address" | "out_of_stock" | "delay" | "operational" | "other"
  >(),
  cancellationReason: varchar("cancellationReason", { length: 500 }),
  cancelledByUserId: integer("cancelledByUserId"),
  aiPaused: boolean("aiPaused").default(false).notNull(),
  // iFood integration
  ifoodOrderId: varchar("ifoodOrderId", { length: 100 }),
  source: varchar("source", { length: 32 }).$type<"app" | "ifood" | "whatsapp" | "phone">().default("app"),
  // NFC-e fiscal
  nfceKey: varchar("nfceKey", { length: 100 }), // chave de acesso da NFC-e
  nfceStatus: varchar("nfceStatus", { length: 32 }).$type<"pending" | "authorized" | "cancelled" | "error">(),
  nfceUrl: text("nfceUrl"), // URL do DANFE
  customerCpf: varchar("customerCpf", { length: 14 }), // CPF do cliente (opcional)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("orders_store_idx").on(t.storeId),
  userIdx: index("orders_user_idx").on(t.userId),
  statusIdx: index("orders_status_idx").on(t.status),
  driverIdx: index("orders_driver_idx").on(t.driverId),
  createdAtIdx: index("orders_created_at_idx").on(t.createdAt),
  userStatusIdx: index("orders_user_status_idx").on(t.userId, t.status),
  orderNumberUnique: uniqueIndex("orders_order_number_uq").on(t.orderNumber),
  idempotencyUnique: uniqueIndex("orders_idempotency_key_uq").on(t.idempotencyKey),
}));

export const orderRequests = pgTable("order_requests", {
  id: serial("id").primaryKey(),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  requestFingerprint: varchar("requestFingerprint", { length: 64 }).notNull(),
  userId: integer("userId").notNull(),
  storeId: integer("storeId").notNull(),
  status: varchar("status", { length: 24 }).$type<"processing" | "completed" | "failed">().default("processing").notNull(),
  orderId: integer("orderId"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  keyUnique: uniqueIndex("order_requests_idempotency_uq").on(t.idempotencyKey),
  userStoreIdx: index("order_requests_user_store_idx").on(t.userId, t.storeId),
  statusIdx: index("order_requests_status_idx").on(t.status, t.updatedAt),
}));
export type OrderRequest = typeof orderRequests.$inferSelect;

export const eventOutbox = pgTable("event_outbox", {
  id: serial("id").primaryKey(),
  eventKey: varchar("eventKey", { length: 160 }).notNull(),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  aggregateType: varchar("aggregateType", { length: 64 }).notNull(),
  aggregateId: varchar("aggregateId", { length: 96 }).notNull(),
  storeId: integer("storeId"),
  payload: text("payload").notNull(),
  status: varchar("status", { length: 24 }).$type<"pending" | "processing" | "processed" | "failed" | "discarded">().default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  availableAt: timestamp("availableAt").defaultNow().notNull(),
  lockedAt: timestamp("lockedAt"),
  processedAt: timestamp("processedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  eventKeyUnique: uniqueIndex("event_outbox_event_key_uq").on(t.eventKey),
  statusAvailableIdx: index("event_outbox_status_available_idx").on(t.status, t.availableAt),
  aggregateIdx: index("event_outbox_aggregate_idx").on(t.aggregateType, t.aggregateId),
  storeIdx: index("event_outbox_store_idx").on(t.storeId, t.createdAt),
}));
export type EventOutbox = typeof eventOutbox.$inferSelect;

export const ifoodIntegrations = pgTable("ifood_integrations", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull(),
  merchantId: varchar("merchant_id", { length: 120 }),
  merchantName: varchar("merchant_name", { length: 220 }),
  status: varchar("status", { length: 32 }).$type<"disconnected" | "connecting" | "connected" | "error">().default("disconnected").notNull(),
  mode: varchar("mode", { length: 32 }).$type<"mock" | "production">().default("mock").notNull(),
  lastConnectedAt: timestamp("last_connected_at"),
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  restaurantIdx: uniqueIndex("ifood_integrations_restaurant_uq").on(t.restaurantId),
  statusIdx: index("ifood_integrations_status_idx").on(t.status),
}));

export const externalOrders = pgTable("external_orders", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull(),
  channel: varchar("channel", { length: 40 }).notNull(),
  externalOrderId: varchar("external_order_id", { length: 120 }).notNull(),
  displayId: varchar("display_id", { length: 40 }).notNull(),
  status: varchar("status", { length: 32 }).$type<"novo" | "confirmado" | "em_preparo" | "saiu_para_entrega" | "concluido" | "cancelado">().default("novo").notNull(),
  customerName: varchar("customer_name", { length: 220 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  externalIdx: uniqueIndex("external_orders_channel_external_uq").on(t.channel, t.externalOrderId),
  restaurantIdx: index("external_orders_restaurant_idx").on(t.restaurantId),
  statusIdx: index("external_orders_status_idx").on(t.status),
  createdAtIdx: index("external_orders_created_idx").on(t.createdAt),
}));

export const ifoodLogs = pgTable("ifood_logs", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  message: text("message").notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  restaurantIdx: index("ifood_logs_restaurant_idx").on(t.restaurantId),
  createdAtIdx: index("ifood_logs_created_idx").on(t.createdAt),
}));

// --- LOYALTY TRANSACTIONS ---------------------------------------------------
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  userId: integer("userId").notNull(),
  orderId: integer("orderId"),
  type: varchar("type", { length: 32 }).$type<"earn" | "redeem" | "refund" | "adjustment" | "manual">().notNull(),
  points: integer("points").notNull(), // positive = earn, negative = redeem
  description: varchar("description", { length: 255 }),
  balanceBefore: integer("balanceBefore").notNull(),
  balanceAfter: integer("balanceAfter").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("loyalty_tx_user_idx").on(t.userId),
  orderIdx: index("loyalty_tx_order_idx").on(t.orderId),
}));
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  productId: integer("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  productPrice: decimal("productPrice", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  snapshotVersion: integer("snapshotVersion").default(1).notNull(),
  configurationSnapshot: text("configurationSnapshot"),
  pricingBreakdown: text("pricingBreakdown"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("order_items_order_idx").on(t.orderId),
  productIdx: index("order_items_product_idx").on(t.productId),
}));

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("brl").notNull(),
  status: varchar("status", { length: 32 }).$type<"pending" | "succeeded" | "failed" | "refunded">().default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("transactions_order_idx").on(t.orderId),
  // Idempotência: um mesmo PaymentIntent/chargeId só pode produzir uma transação bem-sucedida.
  uniqueOrderIntent: uniqueIndex("transactions_order_intent_uq").on(t.orderId, t.stripePaymentIntentId),
}));

// --- WEBHOOK EVENTS (Stripe/Asaas) idempotency ------------------------------
// Armazena o eventId do provedor para garantir que cada evento seja processado
// apenas uma vez, mesmo em retries.
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 32 }).$type<"stripe" | "asaas">().notNull(),
  eventId: varchar("eventId", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 120 }),
  status: varchar("status", { length: 24 }).$type<"processing" | "processed" | "failed">().default("processed").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("lastError"),
  lockedAt: timestamp("lockedAt"),
  processedAt: timestamp("processedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  uniqueProviderEvent: uniqueIndex("webhook_events_provider_event_uq").on(t.provider, t.eventId),
  statusIdx: index("webhook_events_status_idx").on(t.status, t.updatedAt),
}));
export type WebhookEvent = typeof webhookEvents.$inferSelect;

// --- LOYALTY CREDIT LEDGER (idempotência por pedido) ------------------------
// Garante que a mesma venda (orderId) só credite pontos uma única vez,
// mesmo que o status alterne entre delivered/preparing/delivered.
export const loyaltyOrderCredits = pgTable("loyalty_order_credits", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  orderId: integer("orderId").notNull(),
  userId: integer("userId").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqueOrder: uniqueIndex("loyalty_order_credits_order_uq").on(t.orderId),
  userIdx: index("loyalty_order_credits_user_idx").on(t.userId),
}));
export type LoyaltyOrderCredit = typeof loyaltyOrderCredits.$inferSelect;

// --- COUPON REDEMPTIONS (cupom por usuário/pedido) --------------------------
// Controla uso de cupom por pedido para permitir estorno em cancelamento e
// impedir re-uso por usuário de cupons nominais.
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  couponId: integer("couponId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  orderId: integer("orderId").notNull(),
  userId: integer("userId"),
  reverted: boolean("reverted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqueOrderCoupon: uniqueIndex("coupon_redemptions_order_uq").on(t.orderId),
  couponIdx: index("coupon_redemptions_coupon_idx").on(t.couponId),
  userIdx: index("coupon_redemptions_user_idx").on(t.userId),
}));
export type CouponRedemption = typeof couponRedemptions.$inferSelect;

// --- UP-SELLS / DOWN-SELLS ----------------------------------------------------
// Defines product suggestions shown at checkout based on cart contents
export const upsells = pgTable("upsells", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  // The product being suggested
  suggestedProductId: integer("suggestedProductId").notNull(),
  // Optional: only trigger when this product is in the cart (null = always show)
  triggerProductId: integer("triggerProductId"),
  // Optional: only trigger when cart total >= this value
  triggerMinTotal: decimal("triggerMinTotal", { precision: 10, scale: 2 }),
  type: varchar("type", { length: 32 }).$type<"upsell" | "downsell">().default("upsell").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  discountPercent: integer("discountPercent").default(0),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  triggerType: varchar("triggerType", { length: 32 }).$type<"product_selected" | "size_selected" | "modifier_selected" | "category_selected" | "cart_value" | "missing_category" | "checkout">().default("checkout").notNull(),
  triggerSizeId: integer("triggerSizeId"),
  triggerModifierId: integer("triggerModifierId"),
  triggerCategoryId: integer("triggerCategoryId"),
  displayType: varchar("displayType", { length: 32 }).$type<"inline" | "modal" | "cart" | "checkout">().default("checkout").notNull(),
  priority: integer("priority").default(0).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  weekdays: varchar("weekdays", { length: 32 }),
  startTime: varchar("startTime", { length: 5 }),
  endTime: varchar("endTime", { length: 5 }),
  maxDisplaysPerCart: integer("maxDisplaysPerCart").default(1).notNull(),
  dismissible: boolean("dismissible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("upsells_store_idx").on(t.storeId),
}));

// --- PROMOTIONS ---------------------------------------------------------------
// Promotions visible to logged-in customers in their dashboard
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("promotions_store_idx").on(t.storeId),
  externalIdx: uniqueIndex("promotions_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
}));

// --- RAFFLES (SORTEIOS) -------------------------------------------------------
export const raffles = pgTable("raffles", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  prize: varchar("prize", { length: 300 }).notNull(),
  imageUrl: text("imageUrl"),
  status: varchar("status", { length: 32 }).$type<"active" | "closed" | "drawn">().default("active").notNull(),
  winnerId: integer("winnerId"),
  winnerName: varchar("winnerName", { length: 200 }),
  drawDate: timestamp("drawDate"),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("raffles_store_idx").on(t.storeId),
}));

// --- RAFFLE ENTRIES -----------------------------------------------------------
export const raffleEntries = pgTable("raffle_entries", {
  id: serial("id").primaryKey(),
  raffleId: integer("raffleId").notNull(),
  userId: integer("userId").notNull(),
  userName: varchar("userName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  raffleIdx: index("raffle_entries_raffle_idx").on(t.raffleId),
  userIdx: index("raffle_entries_user_idx").on(t.userId),
  uniqueEntry: uniqueIndex("raffle_entries_unique").on(t.raffleId, t.userId),
}));

// --- STORE SETTINGS ---------------------------------------------------------
// Configurações da loja editáveis pelo admin (horários, área de entrega, etc.)
export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("store_settings_store_idx").on(t.storeId),
  storeKeyUnique: uniqueIndex("store_settings_store_key_unique").on(t.storeId, t.key),
}));

// --- DRIVERS (MOTOBOYS) ---
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId"),  // qual unidade o motoboy pertence (null = global)
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  // Token de acesso único para o app do motoboy (sem login)
  accessToken: varchar("accessToken", { length: 128 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("drivers_store_idx").on(t.storeId),
}));

// Posição GPS do motoboy atualizada em tempo real
export const driverLocations = pgTable("driver_locations", {
  id: serial("id").primaryKey(),
  driverId: integer("driverId").notNull(),
  orderId: integer("orderId"),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  driverIdx: index("driver_locations_driver_idx").on(t.driverId),
  orderIdx: index("driver_locations_order_idx").on(t.orderId),
  driverUpdatedIdx: index("driver_locations_driver_updated_idx").on(t.driverId, t.updatedAt),
}));

// Avaliações de entrega feitas pelos clientes
export const deliveryRatings = pgTable("delivery_ratings", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().unique(),
  driverId: integer("driverId").notNull(),
  userId: integer("userId").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  driverIdx: index("delivery_ratings_driver_idx").on(t.driverId),
  userIdx: index("delivery_ratings_user_idx").on(t.userId),
}));

export const orderReviews = pgTable("order_reviews", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().unique(),
  storeId: integer("storeId").notNull(),
  userId: integer("userId").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("order_reviews_store_idx").on(t.storeId, t.createdAt),
  userIdx: index("order_reviews_user_idx").on(t.userId, t.createdAt),
}));

export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  orderReviewId: integer("orderReviewId").notNull(),
  orderId: integer("orderId").notNull(),
  orderItemId: integer("orderItemId").notNull(),
  storeId: integer("storeId").notNull(),
  userId: integer("userId").notNull(),
  productId: integer("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderItemUnique: uniqueIndex("product_reviews_order_item_uq").on(t.orderId, t.orderItemId),
  storeIdx: index("product_reviews_store_idx").on(t.storeId, t.createdAt),
  productIdx: index("product_reviews_product_idx").on(t.productId, t.createdAt),
}));

// Endereços salvos do cliente
export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  address: text("address").notNull(),
  cep: varchar("cep", { length: 10 }),
  street: varchar("street", { length: 240 }),
  number: varchar("number", { length: 40 }),
  complement: varchar("complement", { length: 160 }),
  neighborhood: varchar("neighborhood", { length: 160 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  geocodedAt: timestamp("geocodedAt"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("user_addresses_user_idx").on(t.userId),
}));

// Produtos favoritos do cliente
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  productId: integer("productId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("favorites_user_idx").on(t.userId),
  uniqueFav: uniqueIndex("favorites_unique").on(t.userId, t.productId),
}));

// Notificações in-app para o cliente
export const clientNotifications = pgTable("client_notifications", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId"),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  imageUrl: text("imageUrl"),
  url: text("url"),
  type: varchar("type", { length: 32 }).$type<"order" | "promo" | "system">().default("system").notNull(),
  read: boolean("read").default(false).notNull(),
  dedupeKey: varchar("dedupeKey", { length: 160 }),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeUserIdx: index("client_notifications_store_user_idx").on(t.storeId, t.userId),
  userIdx: index("client_notifications_user_idx").on(t.userId),
  userReadIdx: index("client_notifications_user_read_idx").on(t.userId, t.read),
  userArchivedIdx: index("client_notifications_user_archived_idx").on(t.userId, t.archivedAt),
  dedupeIdx: uniqueIndex("client_notifications_dedupe_uq").on(t.storeId, t.userId, t.dedupeKey),
  createdAtIdx: index("client_notifications_created_at_idx").on(t.createdAt),
}));


// ORDER MESSAGES (chat cliente <-> restaurante)
export const orderMessages = pgTable("order_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  userId: integer("userId").notNull(),
  senderRole: varchar("senderRole", { length: 32 }).$type<"customer" | "admin">().notNull(),
  message: varchar("message", { length: 1000 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("order_messages_order_idx").on(t.orderId),
  orderCreatedIdx: index("order_messages_order_created_idx").on(t.orderId, t.createdAt),
}));

// --- OPERATIONAL FOUNDATION --------------------------------------------------

export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId"),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 120 }),
  unit: varchar("unit", { length: 32 }).$type<"g" | "kg" | "ml" | "l" | "unit" | "pack" | "slice" | "portion">().notNull(),
  currentStock: decimal("currentStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
  minimumStock: decimal("minimumStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 4 }).default("0.0000").notNull(),
  supplier: varchar("supplier", { length: 160 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("ingredients_store_idx").on(t.storeId),
  activeIdx: index("ingredients_active_idx").on(t.active),
  nameIdx: index("ingredients_name_idx").on(t.name),
}));
export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = typeof ingredients.$inferInsert;

export const productIngredients = pgTable("product_ingredients", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull(),
  ingredientId: integer("ingredientId").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  wastePercent: decimal("wastePercent", { precision: 5, scale: 2 }).default("0.00").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  productIdx: index("product_ingredients_product_idx").on(t.productId),
  ingredientIdx: index("product_ingredients_ingredient_idx").on(t.ingredientId),
  uniqueBinding: uniqueIndex("product_ingredients_unique").on(t.productId, t.ingredientId),
}));
export type ProductIngredient = typeof productIngredients.$inferSelect;
export type InsertProductIngredient = typeof productIngredients.$inferInsert;

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  ingredientId: integer("ingredientId").notNull(),
  storeId: integer("storeId"),
  orderId: integer("orderId"),
  orderItemId: integer("orderItemId"),
  movementType: varchar("movementType", { length: 32 }).$type<"entry" | "manual_adjustment" | "sale_consumption" | "reversal" | "waste">().notNull(),
  quantityDelta: decimal("quantityDelta", { precision: 12, scale: 3 }).notNull(),
  previousStock: decimal("previousStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
  nextStock: decimal("nextStock", { precision: 12, scale: 3 }).default("0.000").notNull(),
  reason: varchar("reason", { length: 255 }),
  performedByUserId: integer("performedByUserId"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  ingredientIdx: index("inventory_movements_ingredient_idx").on(t.ingredientId),
  orderIdx: index("inventory_movements_order_idx").on(t.orderId),
  typeIdx: index("inventory_movements_type_idx").on(t.movementType),
  createdIdx: index("inventory_movements_created_idx").on(t.createdAt),
}));
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

export const orderStageLogs = pgTable("order_stage_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  previousStatus: varchar("previousStatus", { length: 32 }).$type<"pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled">(),
  nextStatus: varchar("nextStatus", { length: 32 }).$type<"pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled">().notNull(),
  stage: varchar("stage", { length: 32 }).$type<"created" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled">().notNull(),
  source: varchar("source", { length: 32 }).$type<"system" | "admin" | "manager" | "driver" | "automation" | "customer">().default("system").notNull(),
  changedByUserId: integer("changedByUserId"),
  changedByDriverId: integer("changedByDriverId"),
  notes: varchar("notes", { length: 255 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("order_stage_logs_order_idx").on(t.orderId),
  stageIdx: index("order_stage_logs_stage_idx").on(t.stage),
  createdIdx: index("order_stage_logs_created_idx").on(t.createdAt),
}));
export type OrderStageLog = typeof orderStageLogs.$inferSelect;
export type InsertOrderStageLog = typeof orderStageLogs.$inferInsert;

export const productivityEvents = pgTable("productivity_events", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId"),
  storeId: integer("storeId"),
  eventType: varchar("eventType", { length: 32 }).$type<"acceptance_time" | "prep_time" | "dispatch_time" | "delivery_time" | "total_time" | "delay">().notNull(),
  actorType: varchar("actorType", { length: 32 }).$type<"system" | "user" | "staff" | "driver">().default("system").notNull(),
  actorUserId: integer("actorUserId"),
  actorDriverId: integer("actorDriverId"),
  valueSeconds: integer("valueSeconds").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("productivity_events_order_idx").on(t.orderId),
  typeIdx: index("productivity_events_type_idx").on(t.eventType),
  storeIdx: index("productivity_events_store_idx").on(t.storeId),
  createdIdx: index("productivity_events_created_idx").on(t.createdAt),
}));
export type ProductivityEvent = typeof productivityEvents.$inferSelect;
export type InsertProductivityEvent = typeof productivityEvents.$inferInsert;

export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId"),
  userId: integer("userId"),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  role: varchar("role", { length: 32 }).$type<"waiter" | "cashier" | "attendant" | "kitchen" | "driver" | "manager" | "admin">().notNull(),
  accessToken: varchar("accessToken", { length: 128 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("staff_members_store_idx").on(t.storeId),
  roleIdx: index("staff_members_role_idx").on(t.role),
  userIdx: uniqueIndex("staff_members_user_unique").on(t.userId),
  accessTokenIdx: uniqueIndex("staff_members_access_token_unique").on(t.accessToken),
}));
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = typeof staffMembers.$inferInsert;

export const deliveryPredictions = pgTable("delivery_predictions", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  kind: varchar("kind", { length: 32 }).$type<"delivery" | "pickup" | "dine_in">().default("delivery").notNull(),
  predictionLabel: varchar("predictionLabel", { length: 120 }).notNull(),
  minMinutes: integer("minMinutes").notNull(),
  maxMinutes: integer("maxMinutes").notNull(),
  prepBaseMinutes: integer("prepBaseMinutes").default(0).notNull(),
  deliveryBaseMinutes: integer("deliveryBaseMinutes").default(0).notNull(),
  queuePressure: integer("queuePressure").default(0).notNull(),
  neighborhood: varchar("neighborhood", { length: 120 }),
  method: varchar("method", { length: 80 }).default("heuristic").notNull(),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: uniqueIndex("delivery_predictions_order_unique").on(t.orderId),
  kindIdx: index("delivery_predictions_kind_idx").on(t.kind),
}));
export type DeliveryPrediction = typeof deliveryPredictions.$inferSelect;
export type InsertDeliveryPrediction = typeof deliveryPredictions.$inferInsert;

export const diningTables = pgTable("dining_tables", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId"),
  name: varchar("name", { length: 80 }).notNull(),
  status: varchar("status", { length: 32 }).$type<"free" | "occupied" | "reserved" | "awaiting_closure">().default("free").notNull(),
  capacity: integer("capacity").default(4).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("dining_tables_store_idx").on(t.storeId),
  statusIdx: index("dining_tables_status_idx").on(t.status),
  uniqueNamePerStore: uniqueIndex("dining_tables_store_name_unique").on(t.storeId, t.name),
}));
export type DiningTable = typeof diningTables.$inferSelect;
export type InsertDiningTable = typeof diningTables.$inferInsert;

export const tableSessions = pgTable("table_sessions", {
  id: serial("id").primaryKey(),
  tableId: integer("tableId").notNull(),
  storeId: integer("storeId"),
  waiterStaffId: integer("waiterStaffId"),
  customerName: varchar("customerName", { length: 200 }),
  guestCount: integer("guestCount").default(1).notNull(),
  status: varchar("status", { length: 32 }).$type<"open" | "awaiting_closure" | "closed" | "cancelled">().default("open").notNull(),
  notes: text("notes"),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00").notNull(),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  tipAmount: decimal("tipAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  closedByStaffId: integer("closedByStaffId"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  tableIdx: index("table_sessions_table_idx").on(t.tableId),
  waiterIdx: index("table_sessions_waiter_idx").on(t.waiterStaffId),
  statusIdx: index("table_sessions_status_idx").on(t.status),
  closedByIdx: index("table_sessions_closed_by_idx").on(t.closedByStaffId),
}));
export type TableSession = typeof tableSessions.$inferSelect;
export type InsertTableSession = typeof tableSessions.$inferInsert;

export const tableOrderLinks = pgTable("table_order_links", {
  id: serial("id").primaryKey(),
  tableSessionId: integer("tableSessionId").notNull(),
  orderId: integer("orderId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tableSessionIdx: index("table_order_links_session_idx").on(t.tableSessionId),
  orderIdx: uniqueIndex("table_order_links_order_unique").on(t.orderId),
}));
export type TableOrderLink = typeof tableOrderLinks.$inferSelect;

export const tableSessionItems = pgTable("table_session_items", {
  id: serial("id").primaryKey(),
  tableSessionId: integer("tableSessionId").notNull(),
  productId: integer("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  notes: text("notes"),
  addedByStaffId: integer("addedByStaffId"),
  status: varchar("status", { length: 32 }).$type<"pending" | "preparing" | "ready" | "served" | "cancelled">().default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  readyAt: timestamp("readyAt"),
  servedAt: timestamp("servedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  tableSessionIdx: index("table_session_items_session_idx").on(t.tableSessionId),
  productIdx: index("table_session_items_product_idx").on(t.productId),
  requestedAtIdx: index("table_session_items_requested_at_idx").on(t.requestedAt),
  statusIdx: index("table_session_items_status_idx").on(t.status),
}));
export type TableSessionItem = typeof tableSessionItems.$inferSelect;
export type InsertTableSessionItem = typeof tableSessionItems.$inferInsert;

export const notificationCampaigns = pgTable("notification_campaigns", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId"),
  name: varchar("name", { length: 200 }).notNull(),
  channel: varchar("channel", { length: 32 }).$type<"push" | "whatsapp" | "sms" | "email">().notNull(),
  status: varchar("status", { length: 32 }).$type<"draft" | "scheduled" | "sending" | "sent" | "error">().default("draft").notNull(),
  audienceType: varchar("audienceType", { length: 80 }).default("custom").notNull(),
  messageTitle: varchar("messageTitle", { length: 200 }),
  messageBody: text("messageBody").notNull(),
  estimatedRecipients: integer("estimatedRecipients").default(0).notNull(),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdByUserId: integer("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("notification_campaigns_store_idx").on(t.storeId),
  statusIdx: index("notification_campaigns_status_idx").on(t.status),
}));
export type NotificationCampaign = typeof notificationCampaigns.$inferSelect;
export type InsertNotificationCampaign = typeof notificationCampaigns.$inferInsert;

export const campaignSegments = pgTable("campaign_segments", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull(),
  filterKey: varchar("filterKey", { length: 80 }).notNull(),
  operator: varchar("operator", { length: 20 }).default("eq").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  campaignIdx: index("campaign_segments_campaign_idx").on(t.campaignId),
  filterIdx: index("campaign_segments_filter_idx").on(t.filterKey),
}));
export type CampaignSegment = typeof campaignSegments.$inferSelect;

export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId"),
  userId: integer("userId"),
  channel: varchar("channel", { length: 32 }).$type<"push" | "whatsapp" | "sms" | "email">().notNull(),
  destination: varchar("destination", { length: 320 }),
  status: varchar("status", { length: 32 }).$type<"queued" | "sent" | "delivered" | "opened" | "clicked" | "converted" | "failed">().default("queued").notNull(),
  providerMessageId: varchar("providerMessageId", { length: 120 }),
  convertedOrderId: integer("convertedOrderId"),
  metadata: text("metadata"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  campaignIdx: index("notification_logs_campaign_idx").on(t.campaignId),
  userIdx: index("notification_logs_user_idx").on(t.userId),
  statusIdx: index("notification_logs_status_idx").on(t.status),
}));
export type NotificationLog = typeof notificationLogs.$inferSelect;

export const customerMetrics = pgTable("customer_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  storeId: integer("storeId").default(0).notNull(),
  firstOrderAt: timestamp("firstOrderAt"),
  lastOrderAt: timestamp("lastOrderAt"),
  totalOrders: integer("totalOrders").default(0).notNull(),
  deliveredOrders: integer("deliveredOrders").default(0).notNull(),
  cancelledOrders: integer("cancelledOrders").default(0).notNull(),
  firstOrderCount: integer("firstOrderCount").default(0).notNull(),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0.00").notNull(),
  averageTicket: decimal("averageTicket", { precision: 12, scale: 2 }).default("0.00").notNull(),
  favoriteNeighborhood: varchar("favoriteNeighborhood", { length: 120 }),
  favoriteOrderDay: varchar("favoriteOrderDay", { length: 20 }),
  favoriteOrderHour: integer("favoriteOrderHour"),
  favoriteProductName: varchar("favoriteProductName", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userStoreUnique: uniqueIndex("customer_metrics_user_store_unique").on(t.userId, t.storeId),
  ordersIdx: index("customer_metrics_orders_idx").on(t.totalOrders),
  spentIdx: index("customer_metrics_spent_idx").on(t.totalSpent),
}));
export type CustomerMetric = typeof customerMetrics.$inferSelect;
export type InsertCustomerMetric = typeof customerMetrics.$inferInsert;

export const customerAuthProviders = pgTable("customer_auth_providers", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 32 }).$type<"email" | "phone" | "google" | "apple" | "facebook" | "instagram" | "manus">().notNull(),
  providerUserId: varchar("providerUserId", { length: 191 }).notNull(),
  providerEmail: varchar("providerEmail", { length: 320 }),
  providerPhone: varchar("providerPhone", { length: 20 }),
  providerUsername: varchar("providerUsername", { length: 191 }),
  displayName: varchar("displayName", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  accountType: varchar("accountType", { length: 64 }),
  accessTokenEncrypted: text("accessTokenEncrypted"),
  refreshTokenEncrypted: text("refreshTokenEncrypted"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  grantedScopes: text("grantedScopes"),
  rawProfileJson: text("rawProfileJson"),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  consentVersion: varchar("consentVersion", { length: 32 }),
  consentedAt: timestamp("consentedAt"),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  disconnectedAt: timestamp("disconnectedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("customer_auth_providers_user_idx").on(t.userId),
  uniqueProviderUser: uniqueIndex("customer_auth_providers_provider_user_unique").on(t.provider, t.providerUserId),
  uniqueUserProvider: uniqueIndex("customer_auth_providers_user_provider_unique").on(t.userId, t.provider),
}));
export type CustomerAuthProvider = typeof customerAuthProviders.$inferSelect;
export type InsertCustomerAuthProvider = typeof customerAuthProviders.$inferInsert;

export const authEventLogs = pgTable("auth_event_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  provider: varchar("provider", { length: 32 }),
  event: varchar("event", { length: 32 }).$type<
    "login_success" | "login_failure" | "provider_connected" | "provider_disconnected" |
    "profile_synced" | "account_deleted" | "two_factor_challenge" |
    "two_factor_failure" | "two_factor_enabled" | "two_factor_disabled"
  >().notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userCreatedIdx: index("auth_event_logs_user_created_idx").on(t.userId, t.createdAt),
  eventCreatedIdx: index("auth_event_logs_event_created_idx").on(t.event, t.createdAt),
}));
export type AuthEventLog = typeof authEventLogs.$inferSelect;

export const authSessions = pgTable("auth_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  deviceLabel: varchar("deviceLabel", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedReason: varchar("revokedReason", { length: 80 }),
}, (t) => ({
  userActiveIdx: index("auth_sessions_user_active_idx").on(t.userId, t.revokedAt, t.lastSeenAt),
  expiresIdx: index("auth_sessions_expires_idx").on(t.expiresAt),
}));
export type AuthSession = typeof authSessions.$inferSelect;

export const twoFactorChallenges = pgTable("two_factor_challenges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
}, (t) => ({
  userIdx: index("two_factor_challenges_user_idx").on(t.userId, t.expiresAt),
  tokenIdx: uniqueIndex("two_factor_challenges_token_uq").on(t.tokenHash),
}));
export type TwoFactorChallenge = typeof twoFactorChallenges.$inferSelect;

export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  kind: varchar("kind", { length: 32 }).$type<"terms" | "privacy" | "social_sync">().notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  granted: boolean("granted").default(true).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userKindCreatedIdx: index("user_consents_user_kind_created_idx").on(t.userId, t.kind, t.createdAt),
}));
export type UserConsent = typeof userConsents.$inferSelect;

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  phone: varchar("phone", { length: 20 }).notNull(),
  purpose: varchar("purpose", { length: 32 }).$type<"login" | "verify_phone">().default("login").notNull(),
  codeHash: varchar("codeHash", { length: 255 }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  requestIp: varchar("requestIp", { length: 64 }),
  userAgent: text("userAgent"),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  phoneIdx: index("otp_codes_phone_idx").on(t.phone),
  phonePurposeIdx: index("otp_codes_phone_purpose_idx").on(t.phone, t.purpose),
  expiresIdx: index("otp_codes_expires_idx").on(t.expiresAt),
}));
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;

// --- TYPES ----------------------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Upsell = typeof upsells.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Raffle = typeof raffles.$inferSelect;
export type RaffleEntry = typeof raffleEntries.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type DeliveryRating = typeof deliveryRatings.$inferSelect;
export type InsertDeliveryRating = typeof deliveryRatings.$inferInsert;
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = typeof userAddresses.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type ClientNotification = typeof clientNotifications.$inferSelect;
export type OrderMessage = typeof orderMessages.$inferSelect;

// Push Subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("push_subscriptions_user_idx").on(t.userId),
}));
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// ── MARKETING AUTOMATION ─────────────────────────────────────────────────────

// Tags automáticas de clientes
export const customerTags = pgTable("customer_tags", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  userId: integer("userId").notNull(),
  tag: varchar("tag", { length: 32 }).$type<"novo" | "recorrente" | "indeciso" | "inativo_15" | "inativo_30" | "inativo_60">().notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("customer_tags_store_idx").on(t.storeId),
  userIdx: index("customer_tags_user_idx").on(t.userId),
  tagIdx: index("customer_tags_tag_idx").on(t.tag),
  uniqueUserTag: uniqueIndex("customer_tags_unique").on(t.storeId, t.userId, t.tag),
}));
export type CustomerTag = typeof customerTags.$inferSelect;

// Tags personalizadas (criadas pelo admin)
export const customTags = pgTable("custom_tags", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6b7280").notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("custom_tags_store_idx").on(t.storeId),
  uniqueName: uniqueIndex("custom_tags_store_name_unique").on(t.storeId, t.name),
}));
export type CustomTag = typeof customTags.$inferSelect;

// Atribuição de tags personalizadas a clientes
export const customCustomerTags = pgTable("custom_customer_tags", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  userId: integer("userId").notNull(),
  tagId: integer("tagId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("custom_customer_tags_store_idx").on(t.storeId),
  userIdx: index("custom_customer_tags_user_idx").on(t.userId),
  tagIdx: index("custom_customer_tags_tag_idx").on(t.tagId),
  uniqueUserTag: uniqueIndex("custom_customer_tags_unique").on(t.storeId, t.userId, t.tagId),
}));
export type CustomCustomerTag = typeof customCustomerTags.$inferSelect;

// Carrinhos abandonados
export const abandonedCarts = pgTable("abandoned_carts", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  userId: integer("userId").notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 30 }),
  items: text("items").notNull(),
  total: varchar("total", { length: 20 }).notNull(),
  orderId: integer("orderId"),                          // referência ao pedido original (Pix gerado)
  status: varchar("status", { length: 32 }).$type<"pending" | "recovered" | "expired">().default("pending").notNull(),
  currentStep: integer("currentStep").default(0).notNull(), // 0=detectado, 1=etapa1, 2=etapa2, 3=etapa3
  couponCode: varchar("couponCode", { length: 60 }),    // cupom gerado na etapa 3
  firstReminderSentAt: timestamp("firstReminderSentAt"),
  secondReminderSentAt: timestamp("secondReminderSentAt"),
  thirdReminderSentAt: timestamp("thirdReminderSentAt"),
  recoveredAt: timestamp("recoveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, (t) => ({
  storeIdx: index("abandoned_carts_store_idx").on(t.storeId),
  userIdx: index("abandoned_carts_user_idx").on(t.userId),
  statusExpiresIdx: index("abandoned_carts_status_expires_idx").on(t.status, t.expiresAt),
}));
export type AbandonedCart = typeof abandonedCarts.$inferSelect;

// Jornadas de automação
export const journeys = pgTable("journeys", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  trigger: varchar("trigger", { length: 32 }).$type<"checkout_abandoned" | "tag_inativo_15" | "tag_inativo_30" | "tag_inativo_60" | "tag_inativo_custom" | "first_order" | "new_user" | "club_subscriber" | "manual" | "order_delivered" | "order_cancelled" | "birthday" | "loyalty_milestone" | "rating_submitted" | "rating_negative" | "club_expiring" | "first_order_month">().notNull(),
  // Campos extras para triggers configuráveis
  daysInactive: integer("daysInactive"),          // para tag_inativo_custom
  exitOnOrder: boolean("exitOnOrder").default(false).notNull(), // exit condition
  status: varchar("status", { length: 32 }).$type<"active" | "paused" | "draft">().default("draft").notNull(),
  steps: text("steps").notNull(),
  webhookToken: varchar("webhookToken", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("journeys_store_idx").on(t.storeId),
  statusIdx: index("journeys_status_idx").on(t.status),
}));
export type Journey = typeof journeys.$inferSelect;

// Execuções de jornadas
export const journeyExecutions = pgTable("journey_executions", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  journeyId: integer("journeyId").notNull(),
  userId: integer("userId").notNull(),
  phone: varchar("phone", { length: 30 }),
  status: varchar("status", { length: 32 }).$type<"running" | "completed" | "cancelled" | "failed">().default("running").notNull(),
  currentStep: integer("currentStep").default(0).notNull(),
  metadata: text("metadata"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  nextStepAt: timestamp("nextStepAt"),
  completedAt: timestamp("completedAt"),
  lastMessageAt: timestamp("lastMessageAt"),          // última mensagem enviada
  convertedAt: timestamp("convertedAt"),              // quando o cliente comprou durante a jornada
  conversionOrderId: integer("conversionOrderId"),        // pedido que gerou a conversão
  logs: text("logs"),
  abGroup: varchar("abGroup", { length: 1 }),  // "A" ou "B" para split_ab
  adminTaskTitle: varchar("adminTaskTitle", { length: 200 }), // título da tarefa criada
}, (t) => ({
  storeIdx: index("journey_executions_store_idx").on(t.storeId),
  journeyIdx: index("journey_executions_journey_idx").on(t.journeyId),
  userIdx: index("journey_executions_user_idx").on(t.userId),
  statusNextStepIdx: index("journey_executions_status_next_idx").on(t.status, t.nextStepAt),
}));
export type JourneyExecution = typeof journeyExecutions.$inferSelect;

// Templates de notificação variados
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  event: varchar("event", { length: 32 }).$type<"order_confirmed" | "order_preparing" | "order_out_for_delivery" | "order_delivered" | "order_cancelled" | "cart_abandoned_step1" | "cart_abandoned_step2" | "cart_abandoned_step3" | "reactivation_15" | "reactivation_30" | "reactivation_60" | "custom">().notNull(),
  channel: varchar("channel", { length: 32 }).$type<"push" | "whatsapp" | "both">().default("both").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  imageUrl: text("imageUrl"),
  redirectUrl: varchar("redirectUrl", { length: 500 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("notification_templates_store_idx").on(t.storeId),
  storeEventChannelIdx: index("notification_templates_store_event_channel_idx").on(t.storeId, t.event, t.channel),
}));
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// --- ENTREGA POR DISTÂNCIA -----------------------------------------------------
export const storeDeliverySettings = pgTable("store_delivery_settings", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().references(() => stores.id, { onDelete: "cascade" }),
  deliveryEnabled: boolean("deliveryEnabled").default(false).notNull(),
  maxDeliveryDistanceMeters: integer("maxDeliveryDistanceMeters").default(0).notNull(),
  originPostalCode: varchar("originPostalCode", { length: 10 }),
  originStreet: varchar("originStreet", { length: 240 }),
  originNumber: varchar("originNumber", { length: 40 }),
  originComplement: varchar("originComplement", { length: 160 }),
  originNeighborhood: varchar("originNeighborhood", { length: 160 }),
  originCity: varchar("originCity", { length: 120 }),
  originState: varchar("originState", { length: 2 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  geocodedAddress: text("geocodedAddress"),
  geocodingProvider: varchar("geocodingProvider", { length: 64 }),
  geocodedAt: timestamp("geocodedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeUnique: uniqueIndex("store_delivery_settings_store_uq").on(t.storeId),
  enabledIdx: index("store_delivery_settings_enabled_idx").on(t.deliveryEnabled),
}));
export type StoreDeliverySetting = typeof storeDeliverySettings.$inferSelect;
export type InsertStoreDeliverySetting = typeof storeDeliverySettings.$inferInsert;

export const deliveryDistanceZones = pgTable("delivery_distance_zones", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().references(() => stores.id, { onDelete: "cascade" }),
  minDistanceMeters: integer("minDistanceMeters").notNull(),
  maxDistanceMeters: integer("maxDistanceMeters").notNull(),
  deliveryFeeCents: integer("deliveryFeeCents").notNull(),
  estimatedMinutes: integer("estimatedMinutes").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("delivery_distance_zones_store_idx").on(t.storeId),
  storeActiveSortIdx: index("delivery_distance_zones_store_active_sort_idx").on(t.storeId, t.active, t.sortOrder),
  storeBoundsUnique: uniqueIndex("delivery_distance_zones_store_bounds_uq").on(t.storeId, t.minDistanceMeters, t.maxDistanceMeters),
}));
export type DeliveryDistanceZone = typeof deliveryDistanceZones.$inferSelect;
export type InsertDeliveryDistanceZone = typeof deliveryDistanceZones.$inferInsert;

export const deliveryGeocodingCache = pgTable("delivery_geocoding_cache", {
  id: serial("id").primaryKey(),
  addressKey: varchar("addressKey", { length: 64 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  provider: varchar("provider", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  addressKeyUnique: uniqueIndex("delivery_geocoding_cache_key_uq").on(t.addressKey),
  expiresIdx: index("delivery_geocoding_cache_expires_idx").on(t.expiresAt),
}));

export const deliveryRouteCache = pgTable("delivery_route_cache", {
  id: serial("id").primaryKey(),
  routeKey: varchar("routeKey", { length: 64 }).notNull(),
  storeId: integer("storeId").notNull().references(() => stores.id, { onDelete: "cascade" }),
  routeDistanceMeters: integer("routeDistanceMeters").notNull(),
  straightLineDistanceMeters: integer("straightLineDistanceMeters").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  routeKeyUnique: uniqueIndex("delivery_route_cache_key_uq").on(t.routeKey),
  storeIdx: index("delivery_route_cache_store_idx").on(t.storeId),
  expiresIdx: index("delivery_route_cache_expires_idx").on(t.expiresAt),
}));

// --- LEGADO: ZONAS DE ENTREGA POR BAIRRO ------------------------------------
// Mantido temporariamente apenas para compatibilidade/histórico. Não usar como
// fonte de preço, prazo ou cobertura em novos checkouts/pedidos.
export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  neighborhood: varchar("neighborhood", { length: 200 }).notNull(), // nome do bairro
  city: varchar("city", { length: 200 }).notNull().default(""),
  deliveryFee: decimal("deliveryFee", { precision: 8, scale: 2 }).notNull().default("0.00"),
  estimatedMinutes: integer("estimatedMinutes").default(45).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("delivery_zones_store_idx").on(t.storeId),
  storeNeighborhoodIdx: index("delivery_zones_store_neighborhood_idx").on(t.storeId, t.neighborhood),
}));
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type InsertDeliveryZone = typeof deliveryZones.$inferInsert;

// --- CLUBE DO BONATTO ---
export const clubPayments = pgTable("club_payments", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  userId: integer("userId").notNull(),
  plan: varchar("plan", { length: 32 }).$type<"bonattao" | "basico">().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  pixCode: text("pixCode"),
  pixQrCode: text("pixQrCode"),
  status: varchar("status", { length: 32 }).$type<"pending" | "paid" | "expired">().default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("club_payments_store_idx").on(t.storeId),
  userIdx: index("club_payments_user_idx").on(t.userId),
  statusIdx: index("club_payments_status_idx").on(t.status),
}));
export type ClubPayment = typeof clubPayments.$inferSelect;
export type InsertClubPayment = typeof clubPayments.$inferInsert;

// --- SLIDES DO CARDÁPIO ---
export const menuSlides = pgTable("menu_slides", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 300 }),
  imageUrl: text("imageUrl"),
  videoUrl: text("videoUrl"),
  badgeText: varchar("badgeText", { length: 80 }),
  ctaText: varchar("ctaText", { length: 80 }),
  ctaLink: varchar("ctaLink", { length: 500 }),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("menu_slides_store_idx").on(t.storeId),
}));
export type MenuSlide = typeof menuSlides.$inferSelect;
export type InsertMenuSlide = typeof menuSlides.$inferInsert;

// --- NOTIFICAÇÕES AGENDADAS ---
export const scheduledNotifications = pgTable("scheduled_notifications", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  imageUrl: text("imageUrl"),
  channel: varchar("channel", { length: 32 }).$type<"push" | "whatsapp" | "both">().default("push").notNull(),
  targetAudience: varchar("targetAudience", { length: 32 }).$type<"all" | "active" | "inactive" | "club">().default("all").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  recurrence: varchar("recurrence", { length: 32 }).$type<"once" | "daily" | "weekly">().default("once").notNull(),
  status: varchar("status", { length: 32 }).$type<"pending" | "sent" | "cancelled" | "failed">().default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  sentCount: integer("sentCount").default(0).notNull(),
  neighborhoodFilter: text("neighborhoodFilter"), // JSON array of neighborhood names, null = all
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("scheduled_notifications_store_idx").on(t.storeId),
  storeScheduledStatusIdx: index("scheduled_notifications_store_scheduled_status_idx").on(t.storeId, t.scheduledAt, t.status),
  scheduledAtStatusIdx: index("scheduled_notifications_scheduled_status_idx").on(t.scheduledAt, t.status),
  statusIdx: index("scheduled_notifications_status_idx").on(t.status),
}));
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type InsertScheduledNotification = typeof scheduledNotifications.$inferInsert;

// --- CARROSSEL HERO ---
export const carouselImages = pgTable("carousel_images", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  imageUrl: text("imageUrl").notNull(),
  title: varchar("title", { length: 200 }),
  destinationType: varchar("destinationType", { length: 24 }).default("none").notNull(),
  destinationValue: text("destinationValue"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("carousel_images_store_idx").on(t.storeId),
}));
export type CarouselImage = typeof carouselImages.$inferSelect;
export type InsertCarouselImage = typeof carouselImages.$inferInsert;

// --- DRIVER PUSH SUBSCRIPTIONS -----------------------------------------------
// Push subscriptions para motoboys (autenticados por token, não por userId)
export const driverPushSubscriptions = pgTable("driver_push_subscriptions", {
  id: serial("id").primaryKey(),
  driverId: integer("driverId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  driverIdx: index("driver_push_subscriptions_driver_idx").on(t.driverId),
}));
export type DriverPushSubscription = typeof driverPushSubscriptions.$inferSelect;
export type InsertDriverPushSubscription = typeof driverPushSubscriptions.$inferInsert;

// --- AUTOMATION EVENTS (log de auditoria de envios) --------------------------
export const automationEvents = pgTable("automation_events", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull().default(0),
  type: varchar("type", { length: 60 }).notNull(), // 'cart_step1', 'cart_step2', 'cart_step3', 'reactivation_15d', etc.
  userId: integer("userId"),
  orderId: integer("orderId"),
  cartId: integer("cartId"),
  channel: varchar("channel", { length: 32 }).$type<"whatsapp" | "push" | "email">().notNull(),
  step: integer("step"),
  status: varchar("status", { length: 32 }).$type<"sent" | "delivered" | "read" | "converted" | "failed">().notNull(),
  abVariant: varchar("abVariant", { length: 2 }), // 'A' ou 'B' para testes A/B
  metadata: text("metadata"),                     // JSON com detalhes extras
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("automation_events_store_idx").on(t.storeId),
  userIdx: index("automation_events_user_idx").on(t.userId),
  typeStepIdx: index("automation_events_type_step_idx").on(t.type, t.step),
  createdAtIdx: index("automation_events_created_idx").on(t.createdAt),
}));
export type AutomationEvent = typeof automationEvents.$inferSelect;
export type InsertAutomationEvent = typeof automationEvents.$inferInsert;

// --- CLIENT ALERTS (alertas no painel do cliente) ----------------------------
// Alertas criados automaticamente quando o admin cria promoções, sorteios, cupons ou novidades do clube
export const clientAlerts = pgTable("client_alerts", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 32 }).$type<"promotion" | "raffle" | "coupon" | "club" | "custom">().notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  imageUrl: text("imageUrl"),
  icon: varchar("icon", { length: 10 }).default("🔔"),  // emoji
  url: varchar("url", { length: 500 }),                  // link de destino (ex: /promocoes)
  storeId: integer("storeId"),                               // null = todas as lojas
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),                     // null = sem expiração
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  typeIdx: index("client_alerts_type_idx").on(t.type),
  activeIdx: index("client_alerts_active_idx").on(t.active),
  createdAtIdx: index("client_alerts_created_idx").on(t.createdAt),
}));
export type ClientAlert = typeof clientAlerts.$inferSelect;
export type InsertClientAlert = typeof clientAlerts.$inferInsert;

// Tabela de leitura: registra quais usuários já leram cada alerta
export const clientAlertReads = pgTable("client_alert_reads", {
  id: serial("id").primaryKey(),
  alertId: integer("alertId").notNull(),
  userId: integer("userId").notNull(),
  readAt: timestamp("readAt").defaultNow().notNull(),
}, (t) => ({
  alertUserIdx: uniqueIndex("client_alert_reads_alert_user_idx").on(t.alertId, t.userId),
  userIdx: index("client_alert_reads_user_idx").on(t.userId),
}));
export type ClientAlertRead = typeof clientAlertReads.$inferSelect;

// --- COMMERCE PLATFORM -------------------------------------------------------
export const productOptionGroups = pgTable("product_option_groups", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(), kind: varchar("kind", { length: 32 }).$type<"single" | "multiple" | "flavor" | "size" | "edge">().default("multiple").notNull(),
  description: text("description"), required: boolean("required").default(false).notNull(), minSelections: integer("minSelections").default(0).notNull(), maxSelections: integer("maxSelections").default(1).notNull(),
  freeSelections: integer("freeSelections").default(0).notNull(), allowRepeatedOptions: boolean("allowRepeatedOptions").default(false).notNull(), appliesToAllSizes: boolean("appliesToAllSizes").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_option_groups_product_idx").on(t.storeId, t.productId, t.active) }));

export const productOptions = pgTable("product_options", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), groupId: integer("groupId").notNull(), name: varchar("name", { length: 160 }).notNull(),
  description: text("description"), priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(), linkedProductId: integer("linkedProductId"),
  ingredientId: integer("ingredientId"), ingredientQuantity: decimal("ingredientQuantity", { precision: 10, scale: 3 }), imageUrl: text("imageUrl"),
  maxQuantity: integer("maxQuantity").default(1).notNull(), allowRepeat: boolean("allowRepeat").default(false).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ groupIdx: index("product_options_group_idx").on(t.storeId, t.groupId, t.active) }));

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  productId: integer("productId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  altText: varchar("altText", { length: 240 }),
  kind: varchar("kind", { length: 32 }).$type<"primary" | "gallery" | "flavor" | "nutrition">().default("gallery").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_images_product_idx").on(t.storeId, t.productId, t.active, t.sortOrder) }));

export const productSizes = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  productId: integer("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  internalCode: varchar("internalCode", { length: 128 }),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  promotionalPrice: decimal("promotionalPrice", { precision: 10, scale: 2 }),
  promotionStartsAt: timestamp("promotionStartsAt"),
  promotionEndsAt: timestamp("promotionEndsAt"),
  serves: integer("serves"),
  minFlavors: integer("minFlavors"),
  maxFlavors: integer("maxFlavors"),
  maxAddons: integer("maxAddons"),
  preparationTime: integer("preparationTime"),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  productIdx: index("product_sizes_product_idx").on(t.storeId, t.productId, t.active, t.sortOrder),
  productCodeUnique: uniqueIndex("product_sizes_code_uq").on(t.storeId, t.productId, t.internalCode),
}));

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(),
  name: varchar("name", { length: 160 }).notNull(), sku: varchar("sku", { length: 128 }), price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  promotionalPrice: decimal("promotionalPrice", { precision: 10, scale: 2 }), active: boolean("active").default(true).notNull(), sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_variants_product_idx").on(t.storeId, t.productId, t.active), storeSkuUnique: uniqueIndex("product_variants_store_sku_uq").on(t.storeId, t.sku) }));

export const productAvailability = pgTable("product_availability", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(),
  weekday: integer("weekday"), startTime: varchar("startTime", { length: 5 }), endTime: varchar("endTime", { length: 5 }), startsAt: timestamp("startsAt"), expiresAt: timestamp("expiresAt"),
  channel: varchar("channel", { length: 32 }).$type<"all" | "delivery" | "pickup" | "dine_in" | "counter">().default("all").notNull(),
  unavailableBehavior: varchar("unavailableBehavior", { length: 32 }).$type<"hide" | "show_unavailable" | "show_return_time">().default("show_unavailable").notNull(),
  stockLimit: integer("stockLimit"), pausedUntil: timestamp("pausedUntil"), active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_availability_product_idx").on(t.storeId, t.productId, t.active) }));

export const modifierSizeRules = pgTable("modifier_size_rules", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), modifierOptionId: integer("modifierOptionId").notNull(), productSizeId: integer("productSizeId").notNull(),
  enabled: boolean("enabled").default(true).notNull(), priceOverride: decimal("priceOverride", { precision: 10, scale: 2 }), maxQuantityOverride: integer("maxQuantityOverride"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ optionSizeUnique: uniqueIndex("modifier_size_rules_uq").on(t.storeId, t.modifierOptionId, t.productSizeId) }));

export const multiFlavorSettings = pgTable("multi_flavor_settings", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(),
  enabled: boolean("enabled").default(false).notNull(), pricingRule: varchar("pricingRule", { length: 32 }).$type<"highest_price" | "average_price" | "proportional_price" | "size_fixed_price" | "base_plus_difference">().default("highest_price").notNull(),
  allowRepeatedFlavors: boolean("allowRepeatedFlavors").default(false).notNull(), visualDivisions: boolean("visualDivisions").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productUnique: uniqueIndex("multi_flavor_settings_product_uq").on(t.storeId, t.productId) }));

export const productFlavors = pgTable("product_flavors", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(),
  name: varchar("name", { length: 160 }).notNull(), description: text("description"), imageUrl: text("imageUrl"), ingredients: text("ingredients"), removableIngredients: text("removableIngredients"),
  active: boolean("active").default(true).notNull(), sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_flavors_product_idx").on(t.storeId, t.productId, t.active, t.sortOrder) }));

export const flavorSizePrices = pgTable("flavor_size_prices", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), flavorId: integer("flavorId").notNull(), productSizeId: integer("productSizeId").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ flavorSizeUnique: uniqueIndex("flavor_size_prices_uq").on(t.storeId, t.flavorId, t.productSizeId) }));

export const productDrafts = pgTable("product_drafts", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId"), createdByUserId: integer("createdByUserId").notNull(),
  baseVersion: integer("baseVersion").default(0).notNull(), status: varchar("status", { length: 32 }).$type<"editing" | "ready" | "published" | "discarded">().default("editing").notNull(),
  draftData: text("draftData").notNull(), tutorialProgress: text("tutorialProgress"), lastSavedAt: timestamp("lastSavedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_drafts_product_idx").on(t.storeId, t.productId, t.status), userIdx: index("product_drafts_user_idx").on(t.createdByUserId, t.status) }));

export const productRevisions = pgTable("product_revisions", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(), version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(), note: varchar("note", { length: 240 }), createdByUserId: integer("createdByUserId"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ productVersionUnique: uniqueIndex("product_revisions_uq").on(t.storeId, t.productId, t.version), productIdx: index("product_revisions_product_idx").on(t.productId, t.createdAt) }));

export const productAuditLogs = pgTable("product_audit_logs", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(), actorUserId: integer("actorUserId"),
  action: varchar("action", { length: 80 }).notNull(), fieldName: varchar("fieldName", { length: 160 }), previousValue: text("previousValue"), newValue: text("newValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_audit_logs_product_idx").on(t.storeId, t.productId, t.createdAt) }));

export const productCombos = pgTable("product_combos", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), productId: integer("productId").notNull(), name: varchar("name", { length: 160 }).notNull(),
  description: text("description"), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ productUnique: uniqueIndex("product_combos_product_uq").on(t.storeId, t.productId) }));

export const comboGroups = pgTable("combo_groups", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), comboId: integer("comboId").notNull(), name: varchar("name", { length: 120 }).notNull(),
  required: boolean("required").default(true).notNull(), minSelections: integer("minSelections").default(1).notNull(), maxSelections: integer("maxSelections").default(1).notNull(), sortOrder: integer("sortOrder").default(0).notNull(), active: boolean("active").default(true).notNull(),
}, (t) => ({ comboIdx: index("combo_groups_combo_idx").on(t.storeId, t.comboId) }));

export const comboGroupItems = pgTable("combo_group_items", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), groupId: integer("groupId").notNull(), productId: integer("productId").notNull(),
  sizeId: integer("sizeId"), priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(), active: boolean("active").default(true).notNull(),
}, (t) => ({ groupIdx: index("combo_group_items_group_idx").on(t.storeId, t.groupId) }));

export const orderItemSelections = pgTable("order_item_selections", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), orderId: integer("orderId").notNull(), orderItemId: integer("orderItemId").notNull(),
  groupName: varchar("groupName", { length: 120 }).notNull(), optionName: varchar("optionName", { length: 160 }).notNull(), optionId: integer("optionId"), linkedProductId: integer("linkedProductId"),
  priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(), quantity: integer("quantity").default(1).notNull(), totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0").notNull(), metadata: text("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ orderIdx: index("order_item_selections_order_idx").on(t.storeId, t.orderId), itemIdx: index("order_item_selections_item_idx").on(t.orderItemId) }));

// --- OPERATIONS PLATFORM -----------------------------------------------------
export const kitchenTickets = pgTable("kitchen_tickets", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), orderId: integer("orderId").notNull(), station: varchar("station", { length: 80 }).default("cozinha").notNull(),
  status: varchar("status", { length: 32 }).$type<"queued" | "preparing" | "ready" | "completed" | "cancelled">().default("queued").notNull(), priority: varchar("priority", { length: 32 }).$type<"normal" | "high" | "urgent">().default("normal").notNull(),
  promisedAt: timestamp("promisedAt"), startedAt: timestamp("startedAt"), readyAt: timestamp("readyAt"), completedAt: timestamp("completedAt"), printedAt: timestamp("printedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ orderUnique: uniqueIndex("kitchen_tickets_order_uq").on(t.storeId, t.orderId), boardIdx: index("kitchen_tickets_board_idx").on(t.storeId, t.status, t.createdAt) }));

// --- GROWTH PLATFORM ---------------------------------------------------------
export const growthSettings = pgTable("growth_settings", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), cashbackPercent: decimal("cashbackPercent", { precision: 5, scale: 2 }).default("0").notNull(),
  pointsPerReal: decimal("pointsPerReal", { precision: 8, scale: 3 }).default("1").notNull(), referralReferrerPoints: integer("referralReferrerPoints").default(100).notNull(),
  referralReferredPoints: integer("referralReferredPoints").default(50).notNull(), npsEnabled: boolean("npsEnabled").default(true).notNull(), config: text("config"), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ storeUnique: uniqueIndex("growth_settings_store_uq").on(t.storeId) }));

export const reviewRewardCredits = pgTable("review_reward_credits", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  orderId: integer("orderId").notNull(),
  orderReviewId: integer("orderReviewId").notNull(),
  userId: integer("userId").notNull(),
  eligibleAmount: decimal("eligibleAmount", { precision: 10, scale: 2 }).notNull(),
  cashbackValue: decimal("cashbackValue", { precision: 10, scale: 2 }).notNull(),
  rewardPercent: decimal("rewardPercent", { precision: 5, scale: 2 }).notNull(),
  pointsPerReal: decimal("pointsPerReal", { precision: 8, scale: 3 }).notNull(),
  pointsAwarded: integer("pointsAwarded").notNull(),
  offerExpiresAt: timestamp("offerExpiresAt"),
  configSnapshot: text("configSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderUnique: uniqueIndex("review_reward_credits_order_uq").on(t.orderId),
  reviewUnique: uniqueIndex("review_reward_credits_review_uq").on(t.orderReviewId),
  storeCreatedIdx: index("review_reward_credits_store_created_idx").on(t.storeId, t.createdAt),
  userCreatedIdx: index("review_reward_credits_user_created_idx").on(t.userId, t.createdAt),
}));

export const rewardCatalog = pgTable("reward_catalog", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  rewardType: varchar("rewardType", { length: 32 }).$type<"discount" | "product" | "free_delivery" | "cashback">().notNull(),
  pointsCost: integer("pointsCost").default(0).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).default("0").notNull(),
  productId: integer("productId"),
  category: varchar("category", { length: 80 }),
  icon: varchar("icon", { length: 64 }),
  imageUrl: text("imageUrl"),
  badgeText: varchar("badgeText", { length: 64 }),
  buttonText: varchar("buttonText", { length: 64 }).default("Resgatar").notNull(),
  stock: integer("stock"),
  totalRedemptions: integer("totalRedemptions").default(0).notNull(),
  maxRedemptionsPerUser: integer("maxRedemptionsPerUser"),
  active: boolean("active").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("reward_catalog_store_idx").on(t.storeId, t.active),
  displayIdx: index("reward_catalog_display_idx").on(t.storeId, t.archivedAt, t.sortOrder),
}));

export const rewardCoupons = pgTable("reward_coupons", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  rewardId: integer("rewardId").notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).$type<"available" | "reserved" | "redeemed" | "used" | "expired" | "cancelled">().default("available").notNull(),
  assignedUserId: integer("assignedUserId"),
  redemptionId: integer("redemptionId"),
  reservedAt: timestamp("reservedAt"),
  redeemedAt: timestamp("redeemedAt"),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  storeCodeUnique: uniqueIndex("reward_coupons_store_code_uq").on(t.storeId, t.code),
  rewardStatusIdx: index("reward_coupons_reward_status_idx").on(t.rewardId, t.status),
  userIdx: index("reward_coupons_user_idx").on(t.assignedUserId),
  redemptionIdx: uniqueIndex("reward_coupons_redemption_uq").on(t.redemptionId),
}));

export const rewardRedemptions = pgTable("reward_redemptions", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  rewardId: integer("rewardId").notNull(),
  userId: integer("userId").notNull(),
  couponId: integer("couponId"),
  pointsSpent: integer("pointsSpent").notNull(),
  status: varchar("status", { length: 32 }).$type<"pending" | "completed" | "cancelled" | "refunded" | "expired">().default("pending").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReason: varchar("cancellationReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  idempotencyUnique: uniqueIndex("reward_redemptions_idempotency_uq").on(t.storeId, t.userId, t.idempotencyKey),
  rewardIdx: index("reward_redemptions_reward_idx").on(t.rewardId, t.status),
  userIdx: index("reward_redemptions_user_idx").on(t.userId, t.status),
  couponUnique: uniqueIndex("reward_redemptions_coupon_uq").on(t.couponId),
}));

export const rewardCouponUsages = pgTable("reward_coupon_usages", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  couponId: integer("couponId").notNull(),
  redemptionId: integer("redemptionId").notNull(),
  userId: integer("userId").notNull(),
  orderId: integer("orderId").notNull(),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
}, (t) => ({
  couponUnique: uniqueIndex("reward_coupon_usages_coupon_uq").on(t.couponId),
  orderUnique: uniqueIndex("reward_coupon_usages_order_uq").on(t.orderId),
  userIdx: index("reward_coupon_usages_user_idx").on(t.userId, t.usedAt),
}));

export type Reward = typeof rewardCatalog.$inferSelect;
export type RewardCoupon = typeof rewardCoupons.$inferSelect;
export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
export type RewardCouponUsage = typeof rewardCouponUsages.$inferSelect;

export const npsResponses = pgTable("nps_responses", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), orderId: integer("orderId").notNull(), userId: integer("userId"), score: integer("score").notNull(), comment: text("comment"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ orderUnique: uniqueIndex("nps_responses_order_uq").on(t.storeId, t.orderId) }));

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), referrerUserId: integer("referrerUserId").notNull(), referredUserId: integer("referredUserId"),
  code: varchar("code", { length: 32 }).notNull(), status: varchar("status", { length: 32 }).$type<"pending" | "converted" | "rewarded" | "cancelled">().default("pending").notNull(),
  convertedOrderId: integer("convertedOrderId"), createdAt: timestamp("createdAt").defaultNow().notNull(), convertedAt: timestamp("convertedAt"),
}, (t) => ({ storeCodeUnique: uniqueIndex("referrals_store_code_uq").on(t.storeId, t.code), referrerIdx: index("referrals_referrer_idx").on(t.storeId, t.referrerUserId) }));

// --- INTEGRATION AND INTELLIGENCE PLATFORM ----------------------------------
export const integrationConnections = pgTable("integration_connections", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), provider: varchar("provider", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).$type<"disconnected" | "connecting" | "connected" | "degraded" | "error">().default("disconnected").notNull(), config: text("config"), credentialsRef: varchar("credentialsRef", { length: 191 }),
  lastSuccessAt: timestamp("lastSuccessAt"), lastFailureAt: timestamp("lastFailureAt"), lastError: text("lastError"), latencyMs: integer("latencyMs"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ providerUnique: uniqueIndex("integration_connections_provider_uq").on(t.storeId, t.provider), healthIdx: index("integration_connections_health_idx").on(t.storeId, t.status) }));

export const intelligenceSuggestions = pgTable("intelligence_suggestions", {
  id: serial("id").primaryKey(), storeId: integer("storeId").notNull(), kind: varchar("kind", { length: 32 }).$type<"campaign" | "demand" | "purchase" | "pricing" | "staffing">().notNull(),
  title: varchar("title", { length: 200 }).notNull(), description: text("description").notNull(), confidence: decimal("confidence", { precision: 5, scale: 2 }).default("0").notNull(),
  impactValue: decimal("impactValue", { precision: 12, scale: 2 }), payload: text("payload"), status: varchar("status", { length: 32 }).$type<"new" | "accepted" | "dismissed" | "applied">().default("new").notNull(),
  validUntil: timestamp("validUntil"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ storeKindIdx: index("intelligence_suggestions_store_kind_idx").on(t.storeId, t.kind, t.status) }));
