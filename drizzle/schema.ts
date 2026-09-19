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
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  firstName: varchar("firstName", { length: 160 }),
  lastName: varchar("lastName", { length: 160 }),
  email: varchar("email", { length: 320 }),
  username: varchar("username", { length: 191 }),
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
  profileCompleted: boolean("profileCompleted").default(false).notNull(),
  avatarUrl: text("avatarUrl"),
  loyaltyPoints: int("loyaltyPoints").default(0).notNull(),
  // Clube do Bonatto
  clubPlan: mysqlEnum("clubPlan", ["bonattao", "basico"]),
  clubStatus: mysqlEnum("clubStatus", ["active", "pending", "cancelled"]),
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
export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),
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
  regimeTributario: int("regimeTributario").default(1), // 1=Simples Nacional, 3=Lucro Real
  csc: varchar("csc", { length: 100 }), // Código de Segurança do Contribuinte
  cscId: varchar("cscId", { length: 10 }), // ID do CSC
  focusNfeToken: varchar("focusNfeToken", { length: 200 }), // Token da loja no Focus NFe
  nfceEnabled: boolean("nfceEnabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  slugIdx: uniqueIndex("stores_slug_idx").on(t.slug),
  tenantIdx: index("stores_tenant_idx").on(t.tenantKey),
  activeIdx: index("stores_active_idx").on(t.active),
  statusIdx: index("stores_status_idx").on(t.status),
}));
export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

// Associação de gerentes a lojas
export const storeManagers = mysqlTable("store_managers", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("store_managers_store_idx").on(t.storeId),
  userIdx: index("store_managers_user_idx").on(t.userId),
  uniqueManager: uniqueIndex("store_managers_unique").on(t.storeId, t.userId),
}));
export type StoreManager = typeof storeManagers.$inferSelect;

// Acesso administrativo no nivel da marca. Diferente de storeManagers, esta
// associacao acompanha automaticamente todas as unidades atuais e futuras do tenant.
export const tenantMemberships = mysqlTable("tenant_memberships", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "manager", "site_editor", "marketing"]).default("admin").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdx: index("tenant_memberships_tenant_idx").on(t.tenantKey),
  userIdx: index("tenant_memberships_user_idx").on(t.userId),
  uniqueMembership: uniqueIndex("tenant_memberships_unique").on(t.tenantKey, t.userId),
}));
export type TenantMembership = typeof tenantMemberships.$inferSelect;

export const tenantSitePages = mysqlTable("tenant_site_pages", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  pageKey: mysqlEnum("pageKey", ["home", "menu", "club", "landing"]).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  draftContent: text("draftContent").notNull(),
  publishedVersionId: int("publishedVersionId"),
  updatedByUserId: int("updatedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storePageUnique: uniqueIndex("tenant_site_pages_store_page_uq").on(t.storeId, t.pageKey),
  storeIdx: index("tenant_site_pages_store_idx").on(t.storeId),
}));

export const tenantSitePageVersions = mysqlTable("tenant_site_page_versions", {
  id: int("id").autoincrement().primaryKey(),
  pageId: int("pageId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  content: text("content").notNull(),
  note: varchar("note", { length: 240 }),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  pageVersionUnique: uniqueIndex("tenant_site_page_versions_uq").on(t.pageId, t.versionNumber),
  pageIdx: index("tenant_site_page_versions_page_idx").on(t.pageId, t.createdAt),
}));

// Estado do cliente por marca. A conta de login continua global, mas saldo e
// assinatura nao atravessam tenants diferentes.
export const tenantCustomerAccounts = mysqlTable("tenant_customer_accounts", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull(),
  userId: int("userId").notNull(),
  loyaltyPoints: int("loyaltyPoints").default(0).notNull(),
  clubPlan: mysqlEnum("clubPlan", ["bonattao", "basico"]),
  clubStatus: mysqlEnum("clubStatus", ["active", "pending", "cancelled"]),
  clubStartDate: timestamp("clubStartDate"),
  clubNextBillingDate: timestamp("clubNextBillingDate"),
  clubFreePizzaUsed: boolean("clubFreePizzaUsed").default(false).notNull(),
  clubFreePizzaResetAt: timestamp("clubFreePizzaResetAt"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tenantIdx: index("tenant_customer_accounts_tenant_idx").on(t.tenantKey),
  userIdx: index("tenant_customer_accounts_user_idx").on(t.userId),
  uniqueAccount: uniqueIndex("tenant_customer_accounts_unique").on(t.tenantKey, t.userId),
}));
export type TenantCustomerAccount = typeof tenantCustomerAccounts.$inferSelect;

// Configuracao white label por estabelecimento. Segredos de provedores nunca
// ficam nesta tabela; apenas escolhas publicas e flags de disponibilidade.
export const storeWhiteLabelConfigs = mysqlTable("store_white_label_configs", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "setup_pending"]).default("setup_pending").notNull(),
  plan: mysqlEnum("plan", ["essential", "pro", "enterprise", "custom"]).default("essential").notNull(),
  domain: varchar("domain", { length: 191 }),
  subdomain: varchar("subdomain", { length: 100 }),
  brandName: varchar("brandName", { length: 200 }).notNull(),
  shortName: varchar("shortName", { length: 100 }).notNull(),
  tagline: varchar("tagline", { length: 240 }),
  adminTitle: varchar("adminTitle", { length: 200 }),
  deliveryLabel: varchar("deliveryLabel", { length: 200 }),
  logoUrl: text("logoUrl"),
  wordmarkUrl: text("wordmarkUrl"),
  faviconUrl: text("faviconUrl"),
  waiterLogoUrl: text("waiterLogoUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#6E0D12").notNull(),
  primaryDarkColor: varchar("primaryDarkColor", { length: 20 }).default("#450709").notNull(),
  accentColor: varchar("accentColor", { length: 20 }).default("#e05c5c").notNull(),
  backgroundColor: varchar("backgroundColor", { length: 20 }).default("#fffaf8").notNull(),
  textColor: varchar("textColor", { length: 20 }).default("#211719").notNull(),
  featureFlags: text("featureFlags").notNull(),
  providerConfig: text("providerConfig").notNull(),
  pageConfig: text("pageConfig").notNull(),
  contactConfig: text("contactConfig"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeUnique: uniqueIndex("store_white_label_store_unique").on(t.storeId),
  domainUnique: uniqueIndex("store_white_label_domain_unique").on(t.domain),
  subdomainUnique: uniqueIndex("store_white_label_subdomain_unique").on(t.subdomain),
  statusIdx: index("store_white_label_status_idx").on(t.status),
}));
export type StoreWhiteLabelConfig = typeof storeWhiteLabelConfigs.$inferSelect;
export type InsertStoreWhiteLabelConfig = typeof storeWhiteLabelConfigs.$inferInsert;

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull(),
  legalName: varchar("legalName", { length: 200 }).notNull(),
  displayName: varchar("displayName", { length: 200 }).notNull(),
  document: varchar("document", { length: 32 }),
  status: mysqlEnum("status", ["setup_pending", "active", "suspended", "cancelled"]).default("setup_pending").notNull(),
  ownerUserId: int("ownerUserId"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ tenantKeyUnique: uniqueIndex("tenants_key_uq").on(t.tenantKey), statusIdx: index("tenants_status_idx").on(t.status) }));

export const tenantDomains = mysqlTable("tenant_domains", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  kind: mysqlEnum("kind", ["platform_subdomain", "custom_domain"]).notNull(),
  status: mysqlEnum("status", ["pending", "verifying", "verified", "active", "failed", "disabled"]).default("pending").notNull(),
  verificationToken: varchar("verificationToken", { length: 96 }).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  activatedAt: timestamp("activatedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ hostnameUnique: uniqueIndex("tenant_domains_hostname_uq").on(t.hostname), tenantIdx: index("tenant_domains_tenant_idx").on(t.tenantId, t.status) }));

export const tenantPlans = mysqlTable("tenant_plans", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).default("0").notNull(),
  entitlements: text("entitlements").notNull(),
  limits: text("limits").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ codeUnique: uniqueIndex("tenant_plans_code_uq").on(t.code) }));

export const tenantSubscriptions = mysqlTable("tenant_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  planId: int("planId").notNull(),
  status: mysqlEnum("status", ["trialing", "active", "past_due", "suspended", "cancelled"]).default("trialing").notNull(),
  provider: varchar("provider", { length: 32 }),
  externalCustomerId: varchar("externalCustomerId", { length: 191 }),
  externalSubscriptionId: varchar("externalSubscriptionId", { length: 191 }),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodEndsAt: timestamp("currentPeriodEndsAt"),
  graceEndsAt: timestamp("graceEndsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ tenantUnique: uniqueIndex("tenant_subscriptions_tenant_uq").on(t.tenantId), statusIdx: index("tenant_subscriptions_status_idx").on(t.status) }));

export const tenantAuditLogs = mysqlTable("tenant_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  storeId: int("storeId"),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: varchar("resourceId", { length: 96 }),
  requestId: varchar("requestId", { length: 96 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ tenantCreatedIdx: index("tenant_audit_tenant_created_idx").on(t.tenantId, t.createdAt) }));

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  icon: varchar("icon", { length: 64 }),
  externalSource: varchar("externalSource", { length: 32 }),
  externalMerchantId: varchar("externalMerchantId", { length: 128 }),
  externalId: varchar("externalId", { length: 128 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("categories_store_idx").on(t.storeId),
  storeSlugUnique: uniqueIndex("categories_store_slug_unique").on(t.storeId, t.slug),
  activeOrderIdx: index("categories_active_order_idx").on(t.active, t.sortOrder),
  externalIdx: uniqueIndex("categories_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
}));

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  categoryId: int("categoryId").notNull(),
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
  productType: mysqlEnum("productType", ["simple", "sizes", "variants", "buildable", "multi_flavor", "combo", "weight", "quantity", "variable_price"]).default("simple").notNull(),
  pricingEngine: mysqlEnum("pricingEngine", ["legacy_v1", "configured_v2"]).default("legacy_v1").notNull(),
  editorialStatus: mysqlEnum("editorialStatus", ["draft", "published", "scheduled", "archived"]).default("published").notNull(),
  preparationTime: int("preparationTime"),
  allergenNotice: text("allergenNotice"),
  nutritionalInfo: text("nutritionalInfo"),
  tags: text("tags"),
  minQuantity: int("minQuantity").default(1).notNull(),
  maxQuantity: int("maxQuantity").default(99).notNull(),
  couponEligible: boolean("couponEligible").default(true).notNull(),
  pointsEligible: boolean("pointsEligible").default(true).notNull(),
  version: int("version").default(1).notNull(),
  scheduledPublishAt: timestamp("scheduledPublishAt"),
  publishedAt: timestamp("publishedAt"),
  archivedAt: timestamp("archivedAt"),
  active: boolean("active").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("products_store_idx").on(t.storeId),
  categoryIdx: index("products_category_idx").on(t.categoryId),
  activeIdx: index("products_active_idx").on(t.active),
  externalIdx: uniqueIndex("products_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
  storeSkuUnique: uniqueIndex("products_store_sku_uq").on(t.storeId, t.sku),
  editorialIdx: index("products_editorial_idx").on(t.storeId, t.editorialStatus, t.active),
}));

export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  code: varchar("code", { length: 50 }).notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("coupons_store_idx").on(t.storeId),
  storeCodeUnique: uniqueIndex("coupons_store_code_unique").on(t.storeId, t.code),
  userIdx: index("coupons_user_idx").on(t.userId),
  externalIdx: uniqueIndex("coupons_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
}));

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId"),  // qual unidade recebeu o pedido
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
  nfceKey: varchar("nfceKey", { length: 100 }), // chave de acesso da NFC-e
  nfceStatus: mysqlEnum("nfceStatus", ["pending", "authorized", "cancelled", "error"]),
  nfceUrl: text("nfceUrl"), // URL do DANFE
  customerCpf: varchar("customerCpf", { length: 14 }), // CPF do cliente (opcional)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("orders_store_idx").on(t.storeId),
  userIdx: index("orders_user_idx").on(t.userId),
  statusIdx: index("orders_status_idx").on(t.status),
  driverIdx: index("orders_driver_idx").on(t.driverId),
  createdAtIdx: index("orders_created_at_idx").on(t.createdAt),
  userStatusIdx: index("orders_user_status_idx").on(t.userId, t.status),
}));

export const ifoodIntegrations = mysqlTable("ifood_integrations", {
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
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  restaurantIdx: uniqueIndex("ifood_integrations_restaurant_uq").on(t.restaurantId),
  statusIdx: index("ifood_integrations_status_idx").on(t.status),
}));

export const externalOrders = mysqlTable("external_orders", {
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
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  externalIdx: uniqueIndex("external_orders_channel_external_uq").on(t.channel, t.externalOrderId),
  restaurantIdx: index("external_orders_restaurant_idx").on(t.restaurantId),
  statusIdx: index("external_orders_status_idx").on(t.status),
  createdAtIdx: index("external_orders_created_idx").on(t.createdAt),
}));

export const ifoodLogs = mysqlTable("ifood_logs", {
  id: int("id").autoincrement().primaryKey(),
  restaurantId: int("restaurant_id").notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  message: text("message").notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  restaurantIdx: index("ifood_logs_restaurant_idx").on(t.restaurantId),
  createdAtIdx: index("ifood_logs_created_idx").on(t.createdAt),
}));

// --- LOYALTY TRANSACTIONS ---------------------------------------------------
export const loyaltyTransactions = mysqlTable("loyalty_transactions", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),
  storeId: int("storeId"),
  userId: int("userId").notNull(),
  orderId: int("orderId"),
  type: mysqlEnum("type", ["earn", "redeem", "refund", "adjustment", "manual"]).notNull(),
  points: int("points").notNull(), // positive = earn, negative = redeem
  description: varchar("description", { length: 255 }),
  balanceBefore: int("balanceBefore").notNull(),
  balanceAfter: int("balanceAfter").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tenantUserIdx: index("loyalty_tx_tenant_user_idx").on(t.tenantKey, t.userId),
  userIdx: index("loyalty_tx_user_idx").on(t.userId),
  orderIdx: index("loyalty_tx_order_idx").on(t.orderId),
}));
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  productPrice: decimal("productPrice", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").notNull(),
  notes: text("notes"),
  snapshotVersion: int("snapshotVersion").default(1).notNull(),
  configurationSnapshot: text("configurationSnapshot"),
  pricingBreakdown: text("pricingBreakdown"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("order_items_order_idx").on(t.orderId),
  productIdx: index("order_items_product_idx").on(t.productId),
}));

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("brl").notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  orderIdx: index("transactions_order_idx").on(t.orderId),
  // Idempotência: um mesmo PaymentIntent/chargeId só pode produzir uma transação bem-sucedida.
  uniqueOrderIntent: uniqueIndex("transactions_order_intent_uq").on(t.orderId, t.stripePaymentIntentId),
}));

// --- WEBHOOK EVENTS (Stripe/Asaas) idempotency ------------------------------
// Armazena o eventId do provedor para garantir que cada evento seja processado
// apenas uma vez, mesmo em retries.
export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["stripe", "asaas"]).notNull(),
  eventId: varchar("eventId", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 120 }),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
}, (t) => ({
  uniqueProviderEvent: uniqueIndex("webhook_events_provider_event_uq").on(t.provider, t.eventId),
}));
export type WebhookEvent = typeof webhookEvents.$inferSelect;

// --- LOYALTY CREDIT LEDGER (idempotência por pedido) ------------------------
// Garante que a mesma venda (orderId) só credite pontos uma única vez,
// mesmo que o status alterne entre delivered/preparing/delivered.
export const loyaltyOrderCredits = mysqlTable("loyalty_order_credits", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),
  storeId: int("storeId"),
  orderId: int("orderId").notNull(),
  userId: int("userId").notNull(),
  points: int("points").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqueOrder: uniqueIndex("loyalty_order_credits_order_uq").on(t.orderId),
  tenantUserIdx: index("loyalty_order_credits_tenant_user_idx").on(t.tenantKey, t.userId),
  userIdx: index("loyalty_order_credits_user_idx").on(t.userId),
}));
export type LoyaltyOrderCredit = typeof loyaltyOrderCredits.$inferSelect;

// --- COUPON REDEMPTIONS (cupom por usuário/pedido) --------------------------
// Controla uso de cupom por pedido para permitir estorno em cancelamento e
// impedir re-uso por usuário de cupons nominais.
export const couponRedemptions = mysqlTable("coupon_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  couponId: int("couponId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  orderId: int("orderId").notNull(),
  userId: int("userId"),
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
export const upsells = mysqlTable("upsells", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
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
  triggerType: mysqlEnum("triggerType", ["product_selected", "size_selected", "modifier_selected", "category_selected", "cart_value", "missing_category", "checkout"]).default("checkout").notNull(),
  triggerSizeId: int("triggerSizeId"),
  triggerModifierId: int("triggerModifierId"),
  triggerCategoryId: int("triggerCategoryId"),
  displayType: mysqlEnum("displayType", ["inline", "modal", "cart", "checkout"]).default("checkout").notNull(),
  priority: int("priority").default(0).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  weekdays: varchar("weekdays", { length: 32 }),
  startTime: varchar("startTime", { length: 5 }),
  endTime: varchar("endTime", { length: 5 }),
  maxDisplaysPerCart: int("maxDisplaysPerCart").default(1).notNull(),
  dismissible: boolean("dismissible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("upsells_store_idx").on(t.storeId),
}));

// --- PROMOTIONS ---------------------------------------------------------------
// Promotions visible to logged-in customers in their dashboard
export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("promotions_store_idx").on(t.storeId),
  externalIdx: uniqueIndex("promotions_external_uq").on(t.storeId, t.externalSource, t.externalMerchantId, t.externalId),
}));

// --- RAFFLES (SORTEIOS) -------------------------------------------------------
export const raffles = mysqlTable("raffles", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("raffles_store_idx").on(t.storeId),
}));

// --- RAFFLE ENTRIES -----------------------------------------------------------
export const raffleEntries = mysqlTable("raffle_entries", {
  id: int("id").autoincrement().primaryKey(),
  raffleId: int("raffleId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  raffleIdx: index("raffle_entries_raffle_idx").on(t.raffleId),
  userIdx: index("raffle_entries_user_idx").on(t.userId),
  uniqueEntry: uniqueIndex("raffle_entries_unique").on(t.raffleId, t.userId),
}));

// --- STORE SETTINGS ---------------------------------------------------------
// Configurações da loja editáveis pelo admin (horários, área de entrega, etc.)
export const storeSettings = mysqlTable("store_settings", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("store_settings_store_idx").on(t.storeId),
  storeKeyUnique: uniqueIndex("store_settings_store_key_unique").on(t.storeId, t.key),
}));

// --- DRIVERS (MOTOBOYS) ---
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId"),  // qual unidade o motoboy pertence (null = global)
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  // Token de acesso único para o app do motoboy (sem login)
  accessToken: varchar("accessToken", { length: 128 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("drivers_store_idx").on(t.storeId),
}));

// Posição GPS do motoboy atualizada em tempo real
export const driverLocations = mysqlTable("driver_locations", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  orderId: int("orderId"),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  driverIdx: index("driver_locations_driver_idx").on(t.driverId),
  orderIdx: index("driver_locations_order_idx").on(t.orderId),
  driverUpdatedIdx: index("driver_locations_driver_updated_idx").on(t.driverId, t.updatedAt),
}));

// Avaliações de entrega feitas pelos clientes
export const deliveryRatings = mysqlTable("delivery_ratings", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().unique(),
  driverId: int("driverId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  driverIdx: index("delivery_ratings_driver_idx").on(t.driverId),
  userIdx: index("delivery_ratings_user_idx").on(t.userId),
}));

// Endereços salvos do cliente
export const userAddresses = mysqlTable("user_addresses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  address: text("address").notNull(),
  cep: varchar("cep", { length: 10 }),
  city: varchar("city", { length: 100 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("user_addresses_user_idx").on(t.userId),
}));

// Produtos favoritos do cliente
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("favorites_user_idx").on(t.userId),
  uniqueFav: uniqueIndex("favorites_unique").on(t.userId, t.productId),
}));

// Notificações in-app para o cliente
export const clientNotifications = mysqlTable("client_notifications", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId"),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["order", "promo", "system"]).default("system").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  storeUserIdx: index("client_notifications_store_user_idx").on(t.storeId, t.userId),
  userIdx: index("client_notifications_user_idx").on(t.userId),
  userReadIdx: index("client_notifications_user_read_idx").on(t.userId, t.read),
  createdAtIdx: index("client_notifications_created_at_idx").on(t.createdAt),
}));


// ORDER MESSAGES (chat cliente <-> restaurante)
export const orderMessages = mysqlTable("order_messages", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  userId: int("userId").notNull(),
  senderRole: mysqlEnum("senderRole", ["customer", "admin"]).notNull(),
  message: varchar("message", { length: 1000 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("order_messages_order_idx").on(t.orderId),
  orderCreatedIdx: index("order_messages_order_created_idx").on(t.orderId, t.createdAt),
}));

// --- OPERATIONAL FOUNDATION --------------------------------------------------

export const ingredients = mysqlTable("ingredients", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("ingredients_store_idx").on(t.storeId),
  activeIdx: index("ingredients_active_idx").on(t.active),
  nameIdx: index("ingredients_name_idx").on(t.name),
}));
export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = typeof ingredients.$inferInsert;

export const productIngredients = mysqlTable("product_ingredients", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  ingredientId: int("ingredientId").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  wastePercent: decimal("wastePercent", { precision: 5, scale: 2 }).default("0.00").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  productIdx: index("product_ingredients_product_idx").on(t.productId),
  ingredientIdx: index("product_ingredients_ingredient_idx").on(t.ingredientId),
  uniqueBinding: uniqueIndex("product_ingredients_unique").on(t.productId, t.ingredientId),
}));
export type ProductIngredient = typeof productIngredients.$inferSelect;
export type InsertProductIngredient = typeof productIngredients.$inferInsert;

export const inventoryMovements = mysqlTable("inventory_movements", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  ingredientIdx: index("inventory_movements_ingredient_idx").on(t.ingredientId),
  orderIdx: index("inventory_movements_order_idx").on(t.orderId),
  typeIdx: index("inventory_movements_type_idx").on(t.movementType),
  createdIdx: index("inventory_movements_created_idx").on(t.createdAt),
}));
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

export const orderStageLogs = mysqlTable("order_stage_logs", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  orderIdx: index("order_stage_logs_order_idx").on(t.orderId),
  stageIdx: index("order_stage_logs_stage_idx").on(t.stage),
  createdIdx: index("order_stage_logs_created_idx").on(t.createdAt),
}));
export type OrderStageLog = typeof orderStageLogs.$inferSelect;
export type InsertOrderStageLog = typeof orderStageLogs.$inferInsert;

export const productivityEvents = mysqlTable("productivity_events", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId"),
  storeId: int("storeId"),
  eventType: mysqlEnum("eventType", ["acceptance_time", "prep_time", "dispatch_time", "delivery_time", "total_time", "delay"]).notNull(),
  actorType: mysqlEnum("actorType", ["system", "user", "staff", "driver"]).default("system").notNull(),
  actorUserId: int("actorUserId"),
  actorDriverId: int("actorDriverId"),
  valueSeconds: int("valueSeconds").notNull(),
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

export const staffMembers = mysqlTable("staff_members", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("staff_members_store_idx").on(t.storeId),
  roleIdx: index("staff_members_role_idx").on(t.role),
  userIdx: uniqueIndex("staff_members_user_unique").on(t.userId),
  accessTokenIdx: uniqueIndex("staff_members_access_token_unique").on(t.accessToken),
}));
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = typeof staffMembers.$inferInsert;

export const deliveryPredictions = mysqlTable("delivery_predictions", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  orderIdx: uniqueIndex("delivery_predictions_order_unique").on(t.orderId),
  kindIdx: index("delivery_predictions_kind_idx").on(t.kind),
}));
export type DeliveryPrediction = typeof deliveryPredictions.$inferSelect;
export type InsertDeliveryPrediction = typeof deliveryPredictions.$inferInsert;

export const diningTables = mysqlTable("dining_tables", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId"),
  name: varchar("name", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["free", "occupied", "reserved", "awaiting_closure"]).default("free").notNull(),
  capacity: int("capacity").default(4).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("dining_tables_store_idx").on(t.storeId),
  statusIdx: index("dining_tables_status_idx").on(t.status),
  uniqueNamePerStore: uniqueIndex("dining_tables_store_name_unique").on(t.storeId, t.name),
}));
export type DiningTable = typeof diningTables.$inferSelect;
export type InsertDiningTable = typeof diningTables.$inferInsert;

export const tableSessions = mysqlTable("table_sessions", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tableIdx: index("table_sessions_table_idx").on(t.tableId),
  waiterIdx: index("table_sessions_waiter_idx").on(t.waiterStaffId),
  statusIdx: index("table_sessions_status_idx").on(t.status),
  closedByIdx: index("table_sessions_closed_by_idx").on(t.closedByStaffId),
}));
export type TableSession = typeof tableSessions.$inferSelect;
export type InsertTableSession = typeof tableSessions.$inferInsert;

export const tableOrderLinks = mysqlTable("table_order_links", {
  id: int("id").autoincrement().primaryKey(),
  tableSessionId: int("tableSessionId").notNull(),
  orderId: int("orderId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tableSessionIdx: index("table_order_links_session_idx").on(t.tableSessionId),
  orderIdx: uniqueIndex("table_order_links_order_unique").on(t.orderId),
}));
export type TableOrderLink = typeof tableOrderLinks.$inferSelect;

export const tableSessionItems = mysqlTable("table_session_items", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  tableSessionIdx: index("table_session_items_session_idx").on(t.tableSessionId),
  productIdx: index("table_session_items_product_idx").on(t.productId),
  requestedAtIdx: index("table_session_items_requested_at_idx").on(t.requestedAt),
  statusIdx: index("table_session_items_status_idx").on(t.status),
}));
export type TableSessionItem = typeof tableSessionItems.$inferSelect;
export type InsertTableSessionItem = typeof tableSessionItems.$inferInsert;

export const notificationCampaigns = mysqlTable("notification_campaigns", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("notification_campaigns_store_idx").on(t.storeId),
  statusIdx: index("notification_campaigns_status_idx").on(t.status),
}));
export type NotificationCampaign = typeof notificationCampaigns.$inferSelect;
export type InsertNotificationCampaign = typeof notificationCampaigns.$inferInsert;

export const campaignSegments = mysqlTable("campaign_segments", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  filterKey: varchar("filterKey", { length: 80 }).notNull(),
  operator: varchar("operator", { length: 20 }).default("eq").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  campaignIdx: index("campaign_segments_campaign_idx").on(t.campaignId),
  filterIdx: index("campaign_segments_filter_idx").on(t.filterKey),
}));
export type CampaignSegment = typeof campaignSegments.$inferSelect;

export const notificationLogs = mysqlTable("notification_logs", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  campaignIdx: index("notification_logs_campaign_idx").on(t.campaignId),
  userIdx: index("notification_logs_user_idx").on(t.userId),
  statusIdx: index("notification_logs_status_idx").on(t.status),
}));
export type NotificationLog = typeof notificationLogs.$inferSelect;

export const customerMetrics = mysqlTable("customer_metrics", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userStoreUnique: uniqueIndex("customer_metrics_user_store_unique").on(t.userId, t.storeId),
  ordersIdx: index("customer_metrics_orders_idx").on(t.totalOrders),
  spentIdx: index("customer_metrics_spent_idx").on(t.totalSpent),
}));
export type CustomerMetric = typeof customerMetrics.$inferSelect;
export type InsertCustomerMetric = typeof customerMetrics.$inferInsert;

export const customerAuthProviders = mysqlTable("customer_auth_providers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["email", "phone", "google", "apple", "facebook", "instagram", "manus"]).notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("customer_auth_providers_user_idx").on(t.userId),
  uniqueProviderUser: uniqueIndex("customer_auth_providers_provider_user_unique").on(t.provider, t.providerUserId),
  uniqueUserProvider: uniqueIndex("customer_auth_providers_user_provider_unique").on(t.userId, t.provider),
}));
export type CustomerAuthProvider = typeof customerAuthProviders.$inferSelect;
export type InsertCustomerAuthProvider = typeof customerAuthProviders.$inferInsert;

export const authEventLogs = mysqlTable("auth_event_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  provider: varchar("provider", { length: 32 }),
  event: mysqlEnum("event", ["login_success", "login_failure", "provider_connected", "provider_disconnected", "profile_synced", "account_deleted"]).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userCreatedIdx: index("auth_event_logs_user_created_idx").on(t.userId, t.createdAt),
  eventCreatedIdx: index("auth_event_logs_event_created_idx").on(t.event, t.createdAt),
}));
export type AuthEventLog = typeof authEventLogs.$inferSelect;

export const userConsents = mysqlTable("user_consents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: mysqlEnum("kind", ["terms", "privacy", "social_sync"]).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  granted: boolean("granted").default(true).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userKindCreatedIdx: index("user_consents_user_kind_created_idx").on(t.userId, t.kind, t.createdAt),
}));
export type UserConsent = typeof userConsents.$inferSelect;

export const otpCodes = mysqlTable("otp_codes", {
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
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
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
export const customerTags = mysqlTable("customer_tags", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  userId: int("userId").notNull(),
  tag: mysqlEnum("tag", ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"]).notNull(),
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
export const customTags = mysqlTable("custom_tags", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
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
export const customCustomerTags = mysqlTable("custom_customer_tags", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  userId: int("userId").notNull(),
  tagId: int("tagId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("custom_customer_tags_store_idx").on(t.storeId),
  userIdx: index("custom_customer_tags_user_idx").on(t.userId),
  tagIdx: index("custom_customer_tags_tag_idx").on(t.tagId),
  uniqueUserTag: uniqueIndex("custom_customer_tags_unique").on(t.storeId, t.userId, t.tagId),
}));
export type CustomCustomerTag = typeof customCustomerTags.$inferSelect;

// Carrinhos abandonados
export const abandonedCarts = mysqlTable("abandoned_carts", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  userId: int("userId").notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 30 }),
  items: text("items").notNull(),
  total: varchar("total", { length: 20 }).notNull(),
  orderId: int("orderId"),                          // referência ao pedido original (Pix gerado)
  status: mysqlEnum("status", ["pending", "recovered", "expired"]).default("pending").notNull(),
  currentStep: int("currentStep").default(0).notNull(), // 0=detectado, 1=etapa1, 2=etapa2, 3=etapa3
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
export const journeys = mysqlTable("journeys", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  trigger: mysqlEnum("trigger", [
    "checkout_abandoned",
    "tag_inativo_15",
    "tag_inativo_30",
    "tag_inativo_60",
    "tag_inativo_custom",   // N dias configurável
    "first_order",
    "new_user",
    "club_subscriber",
    "manual",
    "order_delivered",
    "order_cancelled",
    "birthday",
    "loyalty_milestone",
    "rating_submitted",
    "rating_negative",      // avaliação ≤ 3 estrelas
    "club_expiring",
    "first_order_month",    // primeiro pedido do mês
  ]).notNull(),
  // Campos extras para triggers configuráveis
  daysInactive: int("daysInactive"),          // para tag_inativo_custom
  exitOnOrder: boolean("exitOnOrder").default(false).notNull(), // exit condition
  status: mysqlEnum("status", ["active", "paused", "draft"]).default("draft").notNull(),
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
export const journeyExecutions = mysqlTable("journey_executions", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  journeyId: int("journeyId").notNull(),
  userId: int("userId").notNull(),
  phone: varchar("phone", { length: 30 }),
  status: mysqlEnum("status", ["running", "completed", "cancelled", "failed"]).default("running").notNull(),
  currentStep: int("currentStep").default(0).notNull(),
  metadata: text("metadata"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  nextStepAt: timestamp("nextStepAt"),
  completedAt: timestamp("completedAt"),
  lastMessageAt: timestamp("lastMessageAt"),          // última mensagem enviada
  convertedAt: timestamp("convertedAt"),              // quando o cliente comprou durante a jornada
  conversionOrderId: int("conversionOrderId"),        // pedido que gerou a conversão
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
export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
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
    "custom",
  ]).notNull(),
  channel: mysqlEnum("channel", ["push", "whatsapp", "both"]).default("both").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  redirectUrl: varchar("redirectUrl", { length: 500 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("notification_templates_store_idx").on(t.storeId),
  storeEventChannelIdx: index("notification_templates_store_event_channel_idx").on(t.storeId, t.event, t.channel),
}));
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// --- ZONAS DE ENTREGA POR BAIRRO ---
export const deliveryZones = mysqlTable("delivery_zones", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  neighborhood: varchar("neighborhood", { length: 200 }).notNull(), // nome do bairro
  city: varchar("city", { length: 200 }).notNull().default(""),
  deliveryFee: decimal("deliveryFee", { precision: 8, scale: 2 }).notNull().default("0.00"),
  estimatedMinutes: int("estimatedMinutes").default(45).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("delivery_zones_store_idx").on(t.storeId),
  storeNeighborhoodIdx: index("delivery_zones_store_neighborhood_idx").on(t.storeId, t.neighborhood),
}));
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type InsertDeliveryZone = typeof deliveryZones.$inferInsert;

// --- CLUBE DO BONATTO ---
export const clubPayments = mysqlTable("club_payments", {
  id: int("id").autoincrement().primaryKey(),
  tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),
  storeId: int("storeId").notNull().default(0),
  userId: int("userId").notNull(),
  plan: mysqlEnum("plan", ["bonattao", "basico"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  pixCode: text("pixCode"),
  pixQrCode: text("pixQrCode"),
  status: mysqlEnum("status", ["pending", "paid", "expired"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tenantUserIdx: index("club_payments_tenant_user_idx").on(t.tenantKey, t.userId),
  storeIdx: index("club_payments_store_idx").on(t.storeId),
  userIdx: index("club_payments_user_idx").on(t.userId),
  statusIdx: index("club_payments_status_idx").on(t.status),
}));
export type ClubPayment = typeof clubPayments.$inferSelect;
export type InsertClubPayment = typeof clubPayments.$inferInsert;

// --- SLIDES DO CARDÁPIO ---
export const menuSlides = mysqlTable("menu_slides", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("menu_slides_store_idx").on(t.storeId),
}));
export type MenuSlide = typeof menuSlides.$inferSelect;
export type InsertMenuSlide = typeof menuSlides.$inferInsert;

// --- NOTIFICAÇÕES AGENDADAS ---
export const scheduledNotifications = mysqlTable("scheduled_notifications", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  channel: mysqlEnum("channel", ["push", "whatsapp", "both"]).default("push").notNull(),
  targetAudience: mysqlEnum("targetAudience", ["all", "active", "inactive", "club"]).default("all").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  recurrence: mysqlEnum("recurrence", ["once", "daily", "weekly"]).default("once").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "cancelled", "failed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  sentCount: int("sentCount").default(0).notNull(),
  neighborhoodFilter: text("neighborhoodFilter"), // JSON array of neighborhood names, null = all
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("scheduled_notifications_store_idx").on(t.storeId),
  storeScheduledStatusIdx: index("scheduled_notifications_store_scheduled_status_idx").on(t.storeId, t.scheduledAt, t.status),
  scheduledAtStatusIdx: index("scheduled_notifications_scheduled_status_idx").on(t.scheduledAt, t.status),
  statusIdx: index("scheduled_notifications_status_idx").on(t.status),
}));
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type InsertScheduledNotification = typeof scheduledNotifications.$inferInsert;

// --- CARROSSEL HERO ---
export const carouselImages = mysqlTable("carousel_images", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  imageUrl: text("imageUrl").notNull(),
  title: varchar("title", { length: 200 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("carousel_images_store_idx").on(t.storeId),
}));
export type CarouselImage = typeof carouselImages.$inferSelect;
export type InsertCarouselImage = typeof carouselImages.$inferInsert;

// --- DRIVER PUSH SUBSCRIPTIONS -----------------------------------------------
// Push subscriptions para motoboys (autenticados por token, não por userId)
export const driverPushSubscriptions = mysqlTable("driver_push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  driverIdx: index("driver_push_subscriptions_driver_idx").on(t.driverId),
}));
export type DriverPushSubscription = typeof driverPushSubscriptions.$inferSelect;
export type InsertDriverPushSubscription = typeof driverPushSubscriptions.$inferInsert;

// --- AUTOMATION EVENTS (log de auditoria de envios) --------------------------
export const automationEvents = mysqlTable("automation_events", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().default(0),
  type: varchar("type", { length: 60 }).notNull(), // 'cart_step1', 'cart_step2', 'cart_step3', 'reactivation_15d', etc.
  userId: int("userId"),
  orderId: int("orderId"),
  cartId: int("cartId"),
  channel: mysqlEnum("channel", ["whatsapp", "push", "email"]).notNull(),
  step: int("step"),
  status: mysqlEnum("status", ["sent", "delivered", "read", "converted", "failed"]).notNull(),
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
export const clientAlerts = mysqlTable("client_alerts", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["promotion", "raffle", "coupon", "club", "custom"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  icon: varchar("icon", { length: 10 }).default("🔔"),  // emoji
  url: varchar("url", { length: 500 }),                  // link de destino (ex: /promocoes)
  storeId: int("storeId"),                               // null = todas as lojas
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
export const clientAlertReads = mysqlTable("client_alert_reads", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull(),
  userId: int("userId").notNull(),
  readAt: timestamp("readAt").defaultNow().notNull(),
}, (t) => ({
  alertUserIdx: uniqueIndex("client_alert_reads_alert_user_idx").on(t.alertId, t.userId),
  userIdx: index("client_alert_reads_user_idx").on(t.userId),
}));
export type ClientAlertRead = typeof clientAlertReads.$inferSelect;

// --- COMMERCE PLATFORM -------------------------------------------------------
export const productOptionGroups = mysqlTable("product_option_groups", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(), kind: mysqlEnum("kind", ["single", "multiple", "flavor", "size", "edge"]).default("multiple").notNull(),
  description: text("description"), required: boolean("required").default(false).notNull(), minSelections: int("minSelections").default(0).notNull(), maxSelections: int("maxSelections").default(1).notNull(),
  freeSelections: int("freeSelections").default(0).notNull(), allowRepeatedOptions: boolean("allowRepeatedOptions").default(false).notNull(), appliesToAllSizes: boolean("appliesToAllSizes").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productIdx: index("product_option_groups_product_idx").on(t.storeId, t.productId, t.active) }));

export const productOptions = mysqlTable("product_options", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), groupId: int("groupId").notNull(), name: varchar("name", { length: 160 }).notNull(),
  description: text("description"), priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(), linkedProductId: int("linkedProductId"),
  ingredientId: int("ingredientId"), ingredientQuantity: decimal("ingredientQuantity", { precision: 10, scale: 3 }), imageUrl: text("imageUrl"),
  maxQuantity: int("maxQuantity").default(1).notNull(), allowRepeat: boolean("allowRepeat").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ groupIdx: index("product_options_group_idx").on(t.storeId, t.groupId, t.active) }));

export const productImages = mysqlTable("product_images", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  altText: varchar("altText", { length: 240 }),
  kind: mysqlEnum("kind", ["primary", "gallery", "flavor", "nutrition"]).default("gallery").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_images_product_idx").on(t.storeId, t.productId, t.active, t.sortOrder) }));

export const productSizes = mysqlTable("product_sizes", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  internalCode: varchar("internalCode", { length: 128 }),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  promotionalPrice: decimal("promotionalPrice", { precision: 10, scale: 2 }),
  promotionStartsAt: timestamp("promotionStartsAt"),
  promotionEndsAt: timestamp("promotionEndsAt"),
  serves: int("serves"),
  minFlavors: int("minFlavors"),
  maxFlavors: int("maxFlavors"),
  maxAddons: int("maxAddons"),
  preparationTime: int("preparationTime"),
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  productIdx: index("product_sizes_product_idx").on(t.storeId, t.productId, t.active, t.sortOrder),
  productCodeUnique: uniqueIndex("product_sizes_code_uq").on(t.storeId, t.productId, t.internalCode),
}));

export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(),
  name: varchar("name", { length: 160 }).notNull(), sku: varchar("sku", { length: 128 }), price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  promotionalPrice: decimal("promotionalPrice", { precision: 10, scale: 2 }), active: boolean("active").default(true).notNull(), sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productIdx: index("product_variants_product_idx").on(t.storeId, t.productId, t.active), storeSkuUnique: uniqueIndex("product_variants_store_sku_uq").on(t.storeId, t.sku) }));

export const productAvailability = mysqlTable("product_availability", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(),
  weekday: int("weekday"), startTime: varchar("startTime", { length: 5 }), endTime: varchar("endTime", { length: 5 }), startsAt: timestamp("startsAt"), expiresAt: timestamp("expiresAt"),
  channel: mysqlEnum("channel", ["all", "delivery", "pickup", "dine_in", "counter"]).default("all").notNull(),
  unavailableBehavior: mysqlEnum("unavailableBehavior", ["hide", "show_unavailable", "show_return_time"]).default("show_unavailable").notNull(),
  stockLimit: int("stockLimit"), pausedUntil: timestamp("pausedUntil"), active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productIdx: index("product_availability_product_idx").on(t.storeId, t.productId, t.active) }));

export const modifierSizeRules = mysqlTable("modifier_size_rules", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), modifierOptionId: int("modifierOptionId").notNull(), productSizeId: int("productSizeId").notNull(),
  enabled: boolean("enabled").default(true).notNull(), priceOverride: decimal("priceOverride", { precision: 10, scale: 2 }), maxQuantityOverride: int("maxQuantityOverride"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ optionSizeUnique: uniqueIndex("modifier_size_rules_uq").on(t.storeId, t.modifierOptionId, t.productSizeId) }));

export const multiFlavorSettings = mysqlTable("multi_flavor_settings", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(),
  enabled: boolean("enabled").default(false).notNull(), pricingRule: mysqlEnum("pricingRule", ["highest_price", "average_price", "proportional_price", "size_fixed_price", "base_plus_difference"]).default("highest_price").notNull(),
  allowRepeatedFlavors: boolean("allowRepeatedFlavors").default(false).notNull(), visualDivisions: boolean("visualDivisions").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productUnique: uniqueIndex("multi_flavor_settings_product_uq").on(t.storeId, t.productId) }));

export const productFlavors = mysqlTable("product_flavors", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(),
  name: varchar("name", { length: 160 }).notNull(), description: text("description"), imageUrl: text("imageUrl"), ingredients: text("ingredients"), removableIngredients: text("removableIngredients"),
  active: boolean("active").default(true).notNull(), sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productIdx: index("product_flavors_product_idx").on(t.storeId, t.productId, t.active, t.sortOrder) }));

export const flavorSizePrices = mysqlTable("flavor_size_prices", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), flavorId: int("flavorId").notNull(), productSizeId: int("productSizeId").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ flavorSizeUnique: uniqueIndex("flavor_size_prices_uq").on(t.storeId, t.flavorId, t.productSizeId) }));

export const productDrafts = mysqlTable("product_drafts", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId"), createdByUserId: int("createdByUserId").notNull(),
  baseVersion: int("baseVersion").default(0).notNull(), status: mysqlEnum("status", ["editing", "ready", "published", "discarded"]).default("editing").notNull(),
  draftData: text("draftData").notNull(), tutorialProgress: text("tutorialProgress"), lastSavedAt: timestamp("lastSavedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productIdx: index("product_drafts_product_idx").on(t.storeId, t.productId, t.status), userIdx: index("product_drafts_user_idx").on(t.createdByUserId, t.status) }));

export const productRevisions = mysqlTable("product_revisions", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(), version: int("version").notNull(),
  snapshot: text("snapshot").notNull(), note: varchar("note", { length: 240 }), createdByUserId: int("createdByUserId"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ productVersionUnique: uniqueIndex("product_revisions_uq").on(t.storeId, t.productId, t.version), productIdx: index("product_revisions_product_idx").on(t.productId, t.createdAt) }));

export const productAuditLogs = mysqlTable("product_audit_logs", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(), actorUserId: int("actorUserId"),
  action: varchar("action", { length: 80 }).notNull(), fieldName: varchar("fieldName", { length: 160 }), previousValue: text("previousValue"), newValue: text("newValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ productIdx: index("product_audit_logs_product_idx").on(t.storeId, t.productId, t.createdAt) }));

export const productCombos = mysqlTable("product_combos", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), productId: int("productId").notNull(), name: varchar("name", { length: 160 }).notNull(),
  description: text("description"), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ productUnique: uniqueIndex("product_combos_product_uq").on(t.storeId, t.productId) }));

export const comboGroups = mysqlTable("combo_groups", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), comboId: int("comboId").notNull(), name: varchar("name", { length: 120 }).notNull(),
  required: boolean("required").default(true).notNull(), minSelections: int("minSelections").default(1).notNull(), maxSelections: int("maxSelections").default(1).notNull(), sortOrder: int("sortOrder").default(0).notNull(), active: boolean("active").default(true).notNull(),
}, (t) => ({ comboIdx: index("combo_groups_combo_idx").on(t.storeId, t.comboId) }));

export const comboGroupItems = mysqlTable("combo_group_items", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), groupId: int("groupId").notNull(), productId: int("productId").notNull(),
  sizeId: int("sizeId"), priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(), active: boolean("active").default(true).notNull(),
}, (t) => ({ groupIdx: index("combo_group_items_group_idx").on(t.storeId, t.groupId) }));

export const orderItemSelections = mysqlTable("order_item_selections", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), orderId: int("orderId").notNull(), orderItemId: int("orderItemId").notNull(),
  groupName: varchar("groupName", { length: 120 }).notNull(), optionName: varchar("optionName", { length: 160 }).notNull(), optionId: int("optionId"), linkedProductId: int("linkedProductId"),
  priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(), quantity: int("quantity").default(1).notNull(), totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0").notNull(), metadata: text("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ orderIdx: index("order_item_selections_order_idx").on(t.storeId, t.orderId), itemIdx: index("order_item_selections_item_idx").on(t.orderItemId) }));

// --- OPERATIONS PLATFORM -----------------------------------------------------
export const kitchenTickets = mysqlTable("kitchen_tickets", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), orderId: int("orderId").notNull(), station: varchar("station", { length: 80 }).default("cozinha").notNull(),
  status: mysqlEnum("status", ["queued", "preparing", "ready", "completed", "cancelled"]).default("queued").notNull(), priority: mysqlEnum("priority", ["normal", "high", "urgent"]).default("normal").notNull(),
  promisedAt: timestamp("promisedAt"), startedAt: timestamp("startedAt"), readyAt: timestamp("readyAt"), completedAt: timestamp("completedAt"), printedAt: timestamp("printedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ orderUnique: uniqueIndex("kitchen_tickets_order_uq").on(t.storeId, t.orderId), boardIdx: index("kitchen_tickets_board_idx").on(t.storeId, t.status, t.createdAt) }));

// --- GROWTH PLATFORM ---------------------------------------------------------
export const growthSettings = mysqlTable("growth_settings", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), cashbackPercent: decimal("cashbackPercent", { precision: 5, scale: 2 }).default("0").notNull(),
  pointsPerReal: decimal("pointsPerReal", { precision: 8, scale: 3 }).default("1").notNull(), referralReferrerPoints: int("referralReferrerPoints").default(100).notNull(),
  referralReferredPoints: int("referralReferredPoints").default(50).notNull(), npsEnabled: boolean("npsEnabled").default(true).notNull(), config: text("config"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ storeUnique: uniqueIndex("growth_settings_store_uq").on(t.storeId) }));

export const rewardCatalog = mysqlTable("reward_catalog", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  rewardType: mysqlEnum("rewardType", ["discount", "product", "free_delivery", "cashback"]).notNull(),
  pointsCost: int("pointsCost").default(0).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).default("0").notNull(),
  productId: int("productId"),
  category: varchar("category", { length: 80 }),
  icon: varchar("icon", { length: 64 }),
  imageUrl: text("imageUrl"),
  badgeText: varchar("badgeText", { length: 64 }),
  buttonText: varchar("buttonText", { length: 64 }).default("Resgatar").notNull(),
  stock: int("stock"),
  totalRedemptions: int("totalRedemptions").default(0).notNull(),
  maxRedemptionsPerUser: int("maxRedemptionsPerUser"),
  active: boolean("active").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeIdx: index("reward_catalog_store_idx").on(t.storeId, t.active),
  displayIdx: index("reward_catalog_display_idx").on(t.storeId, t.archivedAt, t.sortOrder),
}));

export const rewardCoupons = mysqlTable("reward_coupons", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  rewardId: int("rewardId").notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["available", "reserved", "redeemed", "used", "expired", "cancelled"]).default("available").notNull(),
  assignedUserId: int("assignedUserId"),
  redemptionId: int("redemptionId"),
  reservedAt: timestamp("reservedAt"),
  redeemedAt: timestamp("redeemedAt"),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  storeCodeUnique: uniqueIndex("reward_coupons_store_code_uq").on(t.storeId, t.code),
  rewardStatusIdx: index("reward_coupons_reward_status_idx").on(t.rewardId, t.status),
  userIdx: index("reward_coupons_user_idx").on(t.assignedUserId),
  redemptionIdx: uniqueIndex("reward_coupons_redemption_uq").on(t.redemptionId),
}));

export const rewardRedemptions = mysqlTable("reward_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  rewardId: int("rewardId").notNull(),
  userId: int("userId").notNull(),
  couponId: int("couponId"),
  pointsSpent: int("pointsSpent").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "cancelled", "refunded", "expired"]).default("pending").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull(),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancellationReason: varchar("cancellationReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  idempotencyUnique: uniqueIndex("reward_redemptions_idempotency_uq").on(t.storeId, t.userId, t.idempotencyKey),
  rewardIdx: index("reward_redemptions_reward_idx").on(t.rewardId, t.status),
  userIdx: index("reward_redemptions_user_idx").on(t.userId, t.status),
  couponUnique: uniqueIndex("reward_redemptions_coupon_uq").on(t.couponId),
}));

export const rewardCouponUsages = mysqlTable("reward_coupon_usages", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  couponId: int("couponId").notNull(),
  redemptionId: int("redemptionId").notNull(),
  userId: int("userId").notNull(),
  orderId: int("orderId").notNull(),
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

export const npsResponses = mysqlTable("nps_responses", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), orderId: int("orderId").notNull(), userId: int("userId"), score: int("score").notNull(), comment: text("comment"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ orderUnique: uniqueIndex("nps_responses_order_uq").on(t.storeId, t.orderId) }));

export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), referrerUserId: int("referrerUserId").notNull(), referredUserId: int("referredUserId"),
  code: varchar("code", { length: 32 }).notNull(), status: mysqlEnum("status", ["pending", "converted", "rewarded", "cancelled"]).default("pending").notNull(),
  convertedOrderId: int("convertedOrderId"), createdAt: timestamp("createdAt").defaultNow().notNull(), convertedAt: timestamp("convertedAt"),
}, (t) => ({ storeCodeUnique: uniqueIndex("referrals_store_code_uq").on(t.storeId, t.code), referrerIdx: index("referrals_referrer_idx").on(t.storeId, t.referrerUserId) }));

// --- INTEGRATION AND INTELLIGENCE PLATFORM ----------------------------------
export const integrationConnections = mysqlTable("integration_connections", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), provider: varchar("provider", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["disconnected", "connecting", "connected", "degraded", "error"]).default("disconnected").notNull(), config: text("config"), credentialsRef: varchar("credentialsRef", { length: 191 }),
  lastSuccessAt: timestamp("lastSuccessAt"), lastFailureAt: timestamp("lastFailureAt"), lastError: text("lastError"), latencyMs: int("latencyMs"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ providerUnique: uniqueIndex("integration_connections_provider_uq").on(t.storeId, t.provider), healthIdx: index("integration_connections_health_idx").on(t.storeId, t.status) }));

export const intelligenceSuggestions = mysqlTable("intelligence_suggestions", {
  id: int("id").autoincrement().primaryKey(), storeId: int("storeId").notNull(), kind: mysqlEnum("kind", ["campaign", "demand", "purchase", "pricing", "staffing"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(), description: text("description").notNull(), confidence: decimal("confidence", { precision: 5, scale: 2 }).default("0").notNull(),
  impactValue: decimal("impactValue", { precision: 12, scale: 2 }), payload: text("payload"), status: mysqlEnum("status", ["new", "accepted", "dismissed", "applied"]).default("new").notNull(),
  validUntil: timestamp("validUntil"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ storeKindIdx: index("intelligence_suggestions_store_kind_idx").on(t.storeId, t.kind, t.status) }));
