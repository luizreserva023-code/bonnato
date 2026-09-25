const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "../drizzle/schema.ts");
let src = fs.readFileSync(file, "utf8");

src = src.replace('  tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),\n', "");
src = src.replace('  tenantIdx: index("stores_tenant_idx").on(t.tenantKey),\n', "");

const start = src.indexOf("// Associação de gerentes a lojas");
const end = src.indexOf("export const categories");
if (start < 0 || end < 0) throw new Error("Schema access block markers not found");

const block = `// --- ACESSO POR UNIDADE -------------------------------------------------------
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

`;

src = src.slice(0, start) + block + src.slice(end);
const trackingBlock = `export const marketingSessions = pgTable("marketing_sessions", {
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

`;

src = src.replace("export const categories", trackingBlock + "export const categories");
src = src.replace(/\n\s*tenantKey: varchar\("tenantKey", \{ length: 100 \}\)\.notNull\(\)\.default\("bonatto"\),/g, "");
src = src.replace(/\n\s*tenantUserIdx: index\("[^"]+"\)\.on\(t\.tenantKey, t\.userId\),/g, "");
src = src.replace('  storeId: integer("storeId"),\n  userId: integer("userId").notNull(),', '  storeId: integer("storeId").notNull(),\n  userId: integer("userId").notNull(),');
src = src.replace('  storeId: integer("storeId"),\n  orderId: integer("orderId").notNull(),', '  storeId: integer("storeId").notNull(),\n  orderId: integer("orderId").notNull(),');

fs.writeFileSync(file, src);
console.log("Refactored Bonatto schema", file);
