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
      facebookAppId: process.env.FACEBOOK_APP_ID ?? "",
      facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? "",
      appleClientId: process.env.APPLE_CLIENT_ID ?? "",
      appleTeamId: process.env.APPLE_TEAM_ID ?? "",
      appleKeyId: process.env.APPLE_KEY_ID ?? "",
      applePrivateKey: process.env.APPLE_PRIVATE_KEY ?? "",
      instagramAppId: process.env.INSTAGRAM_APP_ID ?? "",
      instagramAppSecret: process.env.INSTAGRAM_APP_SECRET ?? "",
      metaGraphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v24.0",
      oauthEncryptionKey: process.env.OAUTH_ENCRYPTION_KEY ?? rawJwtSecret,
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
  authEventLogs: () => authEventLogs,
  automationEvents: () => automationEvents,
  campaignSegments: () => campaignSegments,
  carouselImages: () => carouselImages,
  categories: () => categories,
  clientAlertReads: () => clientAlertReads,
  clientAlerts: () => clientAlerts,
  clientNotifications: () => clientNotifications,
  clubPayments: () => clubPayments,
  comboGroupItems: () => comboGroupItems,
  comboGroups: () => comboGroups,
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
  flavorSizePrices: () => flavorSizePrices,
  growthSettings: () => growthSettings,
  ifoodIntegrations: () => ifoodIntegrations,
  ifoodLogs: () => ifoodLogs,
  ingredients: () => ingredients,
  integrationConnections: () => integrationConnections,
  intelligenceSuggestions: () => intelligenceSuggestions,
  inventoryMovements: () => inventoryMovements,
  journeyExecutions: () => journeyExecutions,
  journeys: () => journeys,
  kitchenTickets: () => kitchenTickets,
  loyaltyOrderCredits: () => loyaltyOrderCredits,
  loyaltyTransactions: () => loyaltyTransactions,
  menuSlides: () => menuSlides,
  modifierSizeRules: () => modifierSizeRules,
  multiFlavorSettings: () => multiFlavorSettings,
  notificationCampaigns: () => notificationCampaigns,
  notificationLogs: () => notificationLogs,
  notificationTemplates: () => notificationTemplates,
  npsResponses: () => npsResponses,
  orderItemSelections: () => orderItemSelections,
  orderItems: () => orderItems,
  orderMessages: () => orderMessages,
  orderStageLogs: () => orderStageLogs,
  orders: () => orders,
  otpCodes: () => otpCodes,
  productAuditLogs: () => productAuditLogs,
  productAvailability: () => productAvailability,
  productCombos: () => productCombos,
  productDrafts: () => productDrafts,
  productFlavors: () => productFlavors,
  productImages: () => productImages,
  productIngredients: () => productIngredients,
  productOptionGroups: () => productOptionGroups,
  productOptions: () => productOptions,
  productRevisions: () => productRevisions,
  productSizes: () => productSizes,
  productVariants: () => productVariants,
  productivityEvents: () => productivityEvents,
  products: () => products,
  promotions: () => promotions,
  pushSubscriptions: () => pushSubscriptions,
  raffleEntries: () => raffleEntries,
  raffles: () => raffles,
  referrals: () => referrals,
  rewardCatalog: () => rewardCatalog,
  rewardCouponUsages: () => rewardCouponUsages,
  rewardCoupons: () => rewardCoupons,
  rewardRedemptions: () => rewardRedemptions,
  scheduledNotifications: () => scheduledNotifications,
  staffMembers: () => staffMembers,
  storeManagers: () => storeManagers,
  storeSettings: () => storeSettings,
  storeWhiteLabelConfigs: () => storeWhiteLabelConfigs,
  stores: () => stores,
  tableOrderLinks: () => tableOrderLinks,
  tableSessionItems: () => tableSessionItems,
  tableSessions: () => tableSessions,
  tenantAuditLogs: () => tenantAuditLogs,
  tenantCustomerAccounts: () => tenantCustomerAccounts,
  tenantDomains: () => tenantDomains,
  tenantMemberships: () => tenantMemberships,
  tenantPlans: () => tenantPlans,
  tenantSitePageVersions: () => tenantSitePageVersions,
  tenantSitePages: () => tenantSitePages,
  tenantSubscriptions: () => tenantSubscriptions,
  tenants: () => tenants,
  transactions: () => transactions,
  upsells: () => upsells,
  userAddresses: () => userAddresses,
  userConsents: () => userConsents,
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
var users, stores, storeManagers, tenantMemberships, tenantSitePages, tenantSitePageVersions, tenantCustomerAccounts, storeWhiteLabelConfigs, tenants, tenantDomains, tenantPlans, tenantSubscriptions, tenantAuditLogs, categories, products, coupons, orders, ifoodIntegrations, externalOrders, ifoodLogs, loyaltyTransactions, orderItems, transactions, webhookEvents, loyaltyOrderCredits, couponRedemptions, upsells, promotions, raffles, raffleEntries, storeSettings, drivers, driverLocations, deliveryRatings, userAddresses, favorites, clientNotifications, orderMessages, ingredients, productIngredients, inventoryMovements, orderStageLogs, productivityEvents, staffMembers, deliveryPredictions, diningTables, tableSessions, tableOrderLinks, tableSessionItems, notificationCampaigns, campaignSegments, notificationLogs, customerMetrics, customerAuthProviders, authEventLogs, userConsents, otpCodes, pushSubscriptions, customerTags, customTags, customCustomerTags, abandonedCarts, journeys, journeyExecutions, notificationTemplates, deliveryZones, clubPayments, menuSlides, scheduledNotifications, carouselImages, driverPushSubscriptions, automationEvents, clientAlerts, clientAlertReads, productOptionGroups, productOptions, productImages, productSizes, productVariants, productAvailability, modifierSizeRules, multiFlavorSettings, productFlavors, flavorSizePrices, productDrafts, productRevisions, productAuditLogs, productCombos, comboGroups, comboGroupItems, orderItemSelections, kitchenTickets, growthSettings, rewardCatalog, rewardCoupons, rewardRedemptions, rewardCouponUsages, npsResponses, referrals, integrationConnections, intelligenceSuggestions;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
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
      stripeCustomerId: varchar("stripeCustomerId", { length: 255 })
    }, (t2) => ({
      emailIdx: index("users_email_idx").on(t2.email),
      resetTokenIdx: index("users_reset_token_idx").on(t2.resetToken),
      phoneIdx: index("users_phone_idx").on(t2.phone)
    }));
    stores = mysqlTable("stores", {
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
      tenantIdx: index("stores_tenant_idx").on(t2.tenantKey),
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
    tenantMemberships = mysqlTable("tenant_memberships", {
      id: int("id").autoincrement().primaryKey(),
      tenantKey: varchar("tenantKey", { length: 100 }).notNull(),
      userId: int("userId").notNull(),
      role: mysqlEnum("role", ["owner", "admin", "manager", "site_editor", "marketing"]).default("admin").notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      tenantIdx: index("tenant_memberships_tenant_idx").on(t2.tenantKey),
      userIdx: index("tenant_memberships_user_idx").on(t2.userId),
      uniqueMembership: uniqueIndex("tenant_memberships_unique").on(t2.tenantKey, t2.userId)
    }));
    tenantSitePages = mysqlTable("tenant_site_pages", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      pageKey: mysqlEnum("pageKey", ["home", "menu", "club", "landing"]).notNull(),
      title: varchar("title", { length: 160 }).notNull(),
      draftContent: text("draftContent").notNull(),
      publishedVersionId: int("publishedVersionId"),
      updatedByUserId: int("updatedByUserId"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storePageUnique: uniqueIndex("tenant_site_pages_store_page_uq").on(t2.storeId, t2.pageKey),
      storeIdx: index("tenant_site_pages_store_idx").on(t2.storeId)
    }));
    tenantSitePageVersions = mysqlTable("tenant_site_page_versions", {
      id: int("id").autoincrement().primaryKey(),
      pageId: int("pageId").notNull(),
      versionNumber: int("versionNumber").notNull(),
      content: text("content").notNull(),
      note: varchar("note", { length: 240 }),
      createdByUserId: int("createdByUserId"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      pageVersionUnique: uniqueIndex("tenant_site_page_versions_uq").on(t2.pageId, t2.versionNumber),
      pageIdx: index("tenant_site_page_versions_page_idx").on(t2.pageId, t2.createdAt)
    }));
    tenantCustomerAccounts = mysqlTable("tenant_customer_accounts", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      tenantIdx: index("tenant_customer_accounts_tenant_idx").on(t2.tenantKey),
      userIdx: index("tenant_customer_accounts_user_idx").on(t2.userId),
      uniqueAccount: uniqueIndex("tenant_customer_accounts_unique").on(t2.tenantKey, t2.userId)
    }));
    storeWhiteLabelConfigs = mysqlTable("store_white_label_configs", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeUnique: uniqueIndex("store_white_label_store_unique").on(t2.storeId),
      domainUnique: uniqueIndex("store_white_label_domain_unique").on(t2.domain),
      subdomainUnique: uniqueIndex("store_white_label_subdomain_unique").on(t2.subdomain),
      statusIdx: index("store_white_label_status_idx").on(t2.status)
    }));
    tenants = mysqlTable("tenants", {
      id: int("id").autoincrement().primaryKey(),
      tenantKey: varchar("tenantKey", { length: 100 }).notNull(),
      legalName: varchar("legalName", { length: 200 }).notNull(),
      displayName: varchar("displayName", { length: 200 }).notNull(),
      document: varchar("document", { length: 32 }),
      status: mysqlEnum("status", ["setup_pending", "active", "suspended", "cancelled"]).default("setup_pending").notNull(),
      ownerUserId: int("ownerUserId"),
      metadata: text("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ tenantKeyUnique: uniqueIndex("tenants_key_uq").on(t2.tenantKey), statusIdx: index("tenants_status_idx").on(t2.status) }));
    tenantDomains = mysqlTable("tenant_domains", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ hostnameUnique: uniqueIndex("tenant_domains_hostname_uq").on(t2.hostname), tenantIdx: index("tenant_domains_tenant_idx").on(t2.tenantId, t2.status) }));
    tenantPlans = mysqlTable("tenant_plans", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 64 }).notNull(),
      name: varchar("name", { length: 120 }).notNull(),
      monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).default("0").notNull(),
      entitlements: text("entitlements").notNull(),
      limits: text("limits").notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ codeUnique: uniqueIndex("tenant_plans_code_uq").on(t2.code) }));
    tenantSubscriptions = mysqlTable("tenant_subscriptions", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ tenantUnique: uniqueIndex("tenant_subscriptions_tenant_uq").on(t2.tenantId), statusIdx: index("tenant_subscriptions_status_idx").on(t2.status) }));
    tenantAuditLogs = mysqlTable("tenant_audit_logs", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({ tenantCreatedIdx: index("tenant_audit_tenant_created_idx").on(t2.tenantId, t2.createdAt) }));
    categories = mysqlTable("categories", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("categories_store_idx").on(t2.storeId),
      storeSlugUnique: uniqueIndex("categories_store_slug_unique").on(t2.storeId, t2.slug),
      activeOrderIdx: index("categories_active_order_idx").on(t2.active, t2.sortOrder),
      externalIdx: uniqueIndex("categories_external_uq").on(t2.storeId, t2.externalSource, t2.externalMerchantId, t2.externalId)
    }));
    products = mysqlTable("products", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("products_store_idx").on(t2.storeId),
      categoryIdx: index("products_category_idx").on(t2.categoryId),
      activeIdx: index("products_active_idx").on(t2.active),
      externalIdx: uniqueIndex("products_external_uq").on(t2.storeId, t2.externalSource, t2.externalMerchantId, t2.externalId),
      storeSkuUnique: uniqueIndex("products_store_sku_uq").on(t2.storeId, t2.sku),
      editorialIdx: index("products_editorial_idx").on(t2.storeId, t2.editorialStatus, t2.active)
    }));
    coupons = mysqlTable("coupons", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      storeIdx: index("coupons_store_idx").on(t2.storeId),
      storeCodeUnique: uniqueIndex("coupons_store_code_unique").on(t2.storeId, t2.code),
      userIdx: index("coupons_user_idx").on(t2.userId),
      externalIdx: uniqueIndex("coupons_external_uq").on(t2.storeId, t2.externalSource, t2.externalMerchantId, t2.externalId)
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
      tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),
      storeId: int("storeId"),
      userId: int("userId").notNull(),
      orderId: int("orderId"),
      type: mysqlEnum("type", ["earn", "redeem", "refund", "adjustment", "manual"]).notNull(),
      points: int("points").notNull(),
      // positive = earn, negative = redeem
      description: varchar("description", { length: 255 }),
      balanceBefore: int("balanceBefore").notNull(),
      balanceAfter: int("balanceAfter").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      tenantUserIdx: index("loyalty_tx_tenant_user_idx").on(t2.tenantKey, t2.userId),
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
      snapshotVersion: int("snapshotVersion").default(1).notNull(),
      configurationSnapshot: text("configurationSnapshot"),
      pricingBreakdown: text("pricingBreakdown"),
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
      tenantKey: varchar("tenantKey", { length: 100 }).notNull().default("bonatto"),
      storeId: int("storeId"),
      orderId: int("orderId").notNull(),
      userId: int("userId").notNull(),
      points: int("points").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      uniqueOrder: uniqueIndex("loyalty_order_credits_order_uq").on(t2.orderId),
      tenantUserIdx: index("loyalty_order_credits_tenant_user_idx").on(t2.tenantKey, t2.userId),
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      storeIdx: index("upsells_store_idx").on(t2.storeId)
    }));
    promotions = mysqlTable("promotions", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("promotions_store_idx").on(t2.storeId),
      externalIdx: uniqueIndex("promotions_external_uq").on(t2.storeId, t2.externalSource, t2.externalMerchantId, t2.externalId)
    }));
    raffles = mysqlTable("raffles", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("raffles_store_idx").on(t2.storeId)
    }));
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
      storeId: int("storeId").notNull().default(0),
      key: varchar("key", { length: 100 }).notNull(),
      value: text("value").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("store_settings_store_idx").on(t2.storeId),
      storeKeyUnique: uniqueIndex("store_settings_store_key_unique").on(t2.storeId, t2.key)
    }));
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
      storeId: int("storeId"),
      userId: int("userId").notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      message: text("message").notNull(),
      type: mysqlEnum("type", ["order", "promo", "system"]).default("system").notNull(),
      read: boolean("read").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      storeUserIdx: index("client_notifications_store_user_idx").on(t2.storeId, t2.userId),
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      userIdx: index("customer_auth_providers_user_idx").on(t2.userId),
      uniqueProviderUser: uniqueIndex("customer_auth_providers_provider_user_unique").on(t2.provider, t2.providerUserId),
      uniqueUserProvider: uniqueIndex("customer_auth_providers_user_provider_unique").on(t2.userId, t2.provider)
    }));
    authEventLogs = mysqlTable("auth_event_logs", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId"),
      provider: varchar("provider", { length: 32 }),
      event: mysqlEnum("event", ["login_success", "login_failure", "provider_connected", "provider_disconnected", "profile_synced", "account_deleted"]).notNull(),
      ipAddress: varchar("ipAddress", { length: 64 }),
      userAgent: text("userAgent"),
      metadataJson: text("metadataJson"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userCreatedIdx: index("auth_event_logs_user_created_idx").on(t2.userId, t2.createdAt),
      eventCreatedIdx: index("auth_event_logs_event_created_idx").on(t2.event, t2.createdAt)
    }));
    userConsents = mysqlTable("user_consents", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      kind: mysqlEnum("kind", ["terms", "privacy", "social_sync"]).notNull(),
      version: varchar("version", { length: 32 }).notNull(),
      granted: boolean("granted").default(true).notNull(),
      ipAddress: varchar("ipAddress", { length: 64 }),
      userAgent: text("userAgent"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      userKindCreatedIdx: index("user_consents_user_kind_created_idx").on(t2.userId, t2.kind, t2.createdAt)
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
      storeId: int("storeId").notNull().default(0),
      userId: int("userId").notNull(),
      tag: mysqlEnum("tag", ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"]).notNull(),
      assignedAt: timestamp("assignedAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      storeIdx: index("customer_tags_store_idx").on(t2.storeId),
      userIdx: index("customer_tags_user_idx").on(t2.userId),
      tagIdx: index("customer_tags_tag_idx").on(t2.tag),
      uniqueUserTag: uniqueIndex("customer_tags_unique").on(t2.storeId, t2.userId, t2.tag)
    }));
    customTags = mysqlTable("custom_tags", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull().default(0),
      name: varchar("name", { length: 100 }).notNull(),
      color: varchar("color", { length: 20 }).default("#6b7280").notNull(),
      description: varchar("description", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      storeIdx: index("custom_tags_store_idx").on(t2.storeId),
      uniqueName: uniqueIndex("custom_tags_store_name_unique").on(t2.storeId, t2.name)
    }));
    customCustomerTags = mysqlTable("custom_customer_tags", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull().default(0),
      userId: int("userId").notNull(),
      tagId: int("tagId").notNull(),
      assignedAt: timestamp("assignedAt").defaultNow().notNull()
    }, (t2) => ({
      storeIdx: index("custom_customer_tags_store_idx").on(t2.storeId),
      userIdx: index("custom_customer_tags_user_idx").on(t2.userId),
      tagIdx: index("custom_customer_tags_tag_idx").on(t2.tagId),
      uniqueUserTag: uniqueIndex("custom_customer_tags_unique").on(t2.storeId, t2.userId, t2.tagId)
    }));
    abandonedCarts = mysqlTable("abandoned_carts", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull().default(0),
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
      storeIdx: index("abandoned_carts_store_idx").on(t2.storeId),
      userIdx: index("abandoned_carts_user_idx").on(t2.userId),
      statusExpiresIdx: index("abandoned_carts_status_expires_idx").on(t2.status, t2.expiresAt)
    }));
    journeys = mysqlTable("journeys", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull().default(0),
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
      storeIdx: index("journeys_store_idx").on(t2.storeId),
      statusIdx: index("journeys_status_idx").on(t2.status)
    }));
    journeyExecutions = mysqlTable("journey_executions", {
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
      storeIdx: index("journey_executions_store_idx").on(t2.storeId),
      journeyIdx: index("journey_executions_journey_idx").on(t2.journeyId),
      userIdx: index("journey_executions_user_idx").on(t2.userId),
      statusNextStepIdx: index("journey_executions_status_next_idx").on(t2.status, t2.nextStepAt)
    }));
    notificationTemplates = mysqlTable("notification_templates", {
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
        "custom"
      ]).notNull(),
      channel: mysqlEnum("channel", ["push", "whatsapp", "both"]).default("both").notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      body: text("body").notNull(),
      redirectUrl: varchar("redirectUrl", { length: 500 }),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("notification_templates_store_idx").on(t2.storeId),
      storeEventChannelIdx: index("notification_templates_store_event_channel_idx").on(t2.storeId, t2.event, t2.channel)
    }));
    deliveryZones = mysqlTable("delivery_zones", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull().default(0),
      neighborhood: varchar("neighborhood", { length: 200 }).notNull(),
      // nome do bairro
      city: varchar("city", { length: 200 }).notNull().default(""),
      deliveryFee: decimal("deliveryFee", { precision: 8, scale: 2 }).notNull().default("0.00"),
      estimatedMinutes: int("estimatedMinutes").default(45).notNull(),
      isActive: boolean("isActive").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("delivery_zones_store_idx").on(t2.storeId),
      storeNeighborhoodIdx: index("delivery_zones_store_neighborhood_idx").on(t2.storeId, t2.neighborhood)
    }));
    clubPayments = mysqlTable("club_payments", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      tenantUserIdx: index("club_payments_tenant_user_idx").on(t2.tenantKey, t2.userId),
      storeIdx: index("club_payments_store_idx").on(t2.storeId),
      userIdx: index("club_payments_user_idx").on(t2.userId),
      statusIdx: index("club_payments_status_idx").on(t2.status)
    }));
    menuSlides = mysqlTable("menu_slides", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("menu_slides_store_idx").on(t2.storeId)
    }));
    scheduledNotifications = mysqlTable("scheduled_notifications", {
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
      neighborhoodFilter: text("neighborhoodFilter"),
      // JSON array of neighborhood names, null = all
      createdBy: int("createdBy").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("scheduled_notifications_store_idx").on(t2.storeId),
      storeScheduledStatusIdx: index("scheduled_notifications_store_scheduled_status_idx").on(t2.storeId, t2.scheduledAt, t2.status),
      scheduledAtStatusIdx: index("scheduled_notifications_scheduled_status_idx").on(t2.scheduledAt, t2.status),
      statusIdx: index("scheduled_notifications_status_idx").on(t2.status)
    }));
    carouselImages = mysqlTable("carousel_images", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull().default(0),
      imageUrl: text("imageUrl").notNull(),
      title: varchar("title", { length: 200 }),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("carousel_images_store_idx").on(t2.storeId)
    }));
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
      storeId: int("storeId").notNull().default(0),
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
      storeIdx: index("automation_events_store_idx").on(t2.storeId),
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
    productOptionGroups = mysqlTable("product_option_groups", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      name: varchar("name", { length: 120 }).notNull(),
      kind: mysqlEnum("kind", ["single", "multiple", "flavor", "size", "edge"]).default("multiple").notNull(),
      description: text("description"),
      required: boolean("required").default(false).notNull(),
      minSelections: int("minSelections").default(0).notNull(),
      maxSelections: int("maxSelections").default(1).notNull(),
      freeSelections: int("freeSelections").default(0).notNull(),
      allowRepeatedOptions: boolean("allowRepeatedOptions").default(false).notNull(),
      appliesToAllSizes: boolean("appliesToAllSizes").default(true).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productIdx: index("product_option_groups_product_idx").on(t2.storeId, t2.productId, t2.active) }));
    productOptions = mysqlTable("product_options", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      groupId: int("groupId").notNull(),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(),
      linkedProductId: int("linkedProductId"),
      ingredientId: int("ingredientId"),
      ingredientQuantity: decimal("ingredientQuantity", { precision: 10, scale: 3 }),
      imageUrl: text("imageUrl"),
      maxQuantity: int("maxQuantity").default(1).notNull(),
      allowRepeat: boolean("allowRepeat").default(false).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ groupIdx: index("product_options_group_idx").on(t2.storeId, t2.groupId, t2.active) }));
    productImages = mysqlTable("product_images", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      imageUrl: text("imageUrl").notNull(),
      altText: varchar("altText", { length: 240 }),
      kind: mysqlEnum("kind", ["primary", "gallery", "flavor", "nutrition"]).default("gallery").notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({ productIdx: index("product_images_product_idx").on(t2.storeId, t2.productId, t2.active, t2.sortOrder) }));
    productSizes = mysqlTable("product_sizes", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      productIdx: index("product_sizes_product_idx").on(t2.storeId, t2.productId, t2.active, t2.sortOrder),
      productCodeUnique: uniqueIndex("product_sizes_code_uq").on(t2.storeId, t2.productId, t2.internalCode)
    }));
    productVariants = mysqlTable("product_variants", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      name: varchar("name", { length: 160 }).notNull(),
      sku: varchar("sku", { length: 128 }),
      price: decimal("price", { precision: 10, scale: 2 }).notNull(),
      promotionalPrice: decimal("promotionalPrice", { precision: 10, scale: 2 }),
      active: boolean("active").default(true).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productIdx: index("product_variants_product_idx").on(t2.storeId, t2.productId, t2.active), storeSkuUnique: uniqueIndex("product_variants_store_sku_uq").on(t2.storeId, t2.sku) }));
    productAvailability = mysqlTable("product_availability", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      weekday: int("weekday"),
      startTime: varchar("startTime", { length: 5 }),
      endTime: varchar("endTime", { length: 5 }),
      startsAt: timestamp("startsAt"),
      expiresAt: timestamp("expiresAt"),
      channel: mysqlEnum("channel", ["all", "delivery", "pickup", "dine_in", "counter"]).default("all").notNull(),
      unavailableBehavior: mysqlEnum("unavailableBehavior", ["hide", "show_unavailable", "show_return_time"]).default("show_unavailable").notNull(),
      stockLimit: int("stockLimit"),
      pausedUntil: timestamp("pausedUntil"),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productIdx: index("product_availability_product_idx").on(t2.storeId, t2.productId, t2.active) }));
    modifierSizeRules = mysqlTable("modifier_size_rules", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      modifierOptionId: int("modifierOptionId").notNull(),
      productSizeId: int("productSizeId").notNull(),
      enabled: boolean("enabled").default(true).notNull(),
      priceOverride: decimal("priceOverride", { precision: 10, scale: 2 }),
      maxQuantityOverride: int("maxQuantityOverride"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ optionSizeUnique: uniqueIndex("modifier_size_rules_uq").on(t2.storeId, t2.modifierOptionId, t2.productSizeId) }));
    multiFlavorSettings = mysqlTable("multi_flavor_settings", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      enabled: boolean("enabled").default(false).notNull(),
      pricingRule: mysqlEnum("pricingRule", ["highest_price", "average_price", "proportional_price", "size_fixed_price", "base_plus_difference"]).default("highest_price").notNull(),
      allowRepeatedFlavors: boolean("allowRepeatedFlavors").default(false).notNull(),
      visualDivisions: boolean("visualDivisions").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productUnique: uniqueIndex("multi_flavor_settings_product_uq").on(t2.storeId, t2.productId) }));
    productFlavors = mysqlTable("product_flavors", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      imageUrl: text("imageUrl"),
      ingredients: text("ingredients"),
      removableIngredients: text("removableIngredients"),
      active: boolean("active").default(true).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productIdx: index("product_flavors_product_idx").on(t2.storeId, t2.productId, t2.active, t2.sortOrder) }));
    flavorSizePrices = mysqlTable("flavor_size_prices", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      flavorId: int("flavorId").notNull(),
      productSizeId: int("productSizeId").notNull(),
      price: decimal("price", { precision: 10, scale: 2 }).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ flavorSizeUnique: uniqueIndex("flavor_size_prices_uq").on(t2.storeId, t2.flavorId, t2.productSizeId) }));
    productDrafts = mysqlTable("product_drafts", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId"),
      createdByUserId: int("createdByUserId").notNull(),
      baseVersion: int("baseVersion").default(0).notNull(),
      status: mysqlEnum("status", ["editing", "ready", "published", "discarded"]).default("editing").notNull(),
      draftData: text("draftData").notNull(),
      tutorialProgress: text("tutorialProgress"),
      lastSavedAt: timestamp("lastSavedAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productIdx: index("product_drafts_product_idx").on(t2.storeId, t2.productId, t2.status), userIdx: index("product_drafts_user_idx").on(t2.createdByUserId, t2.status) }));
    productRevisions = mysqlTable("product_revisions", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      version: int("version").notNull(),
      snapshot: text("snapshot").notNull(),
      note: varchar("note", { length: 240 }),
      createdByUserId: int("createdByUserId"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({ productVersionUnique: uniqueIndex("product_revisions_uq").on(t2.storeId, t2.productId, t2.version), productIdx: index("product_revisions_product_idx").on(t2.productId, t2.createdAt) }));
    productAuditLogs = mysqlTable("product_audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      actorUserId: int("actorUserId"),
      action: varchar("action", { length: 80 }).notNull(),
      fieldName: varchar("fieldName", { length: 160 }),
      previousValue: text("previousValue"),
      newValue: text("newValue"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({ productIdx: index("product_audit_logs_product_idx").on(t2.storeId, t2.productId, t2.createdAt) }));
    productCombos = mysqlTable("product_combos", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      productId: int("productId").notNull(),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ productUnique: uniqueIndex("product_combos_product_uq").on(t2.storeId, t2.productId) }));
    comboGroups = mysqlTable("combo_groups", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      comboId: int("comboId").notNull(),
      name: varchar("name", { length: 120 }).notNull(),
      required: boolean("required").default(true).notNull(),
      minSelections: int("minSelections").default(1).notNull(),
      maxSelections: int("maxSelections").default(1).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      active: boolean("active").default(true).notNull()
    }, (t2) => ({ comboIdx: index("combo_groups_combo_idx").on(t2.storeId, t2.comboId) }));
    comboGroupItems = mysqlTable("combo_group_items", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      groupId: int("groupId").notNull(),
      productId: int("productId").notNull(),
      sizeId: int("sizeId"),
      priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(),
      active: boolean("active").default(true).notNull()
    }, (t2) => ({ groupIdx: index("combo_group_items_group_idx").on(t2.storeId, t2.groupId) }));
    orderItemSelections = mysqlTable("order_item_selections", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      orderId: int("orderId").notNull(),
      orderItemId: int("orderItemId").notNull(),
      groupName: varchar("groupName", { length: 120 }).notNull(),
      optionName: varchar("optionName", { length: 160 }).notNull(),
      optionId: int("optionId"),
      linkedProductId: int("linkedProductId"),
      priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0").notNull(),
      quantity: int("quantity").default(1).notNull(),
      totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0").notNull(),
      metadata: text("metadata"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({ orderIdx: index("order_item_selections_order_idx").on(t2.storeId, t2.orderId), itemIdx: index("order_item_selections_item_idx").on(t2.orderItemId) }));
    kitchenTickets = mysqlTable("kitchen_tickets", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      orderId: int("orderId").notNull(),
      station: varchar("station", { length: 80 }).default("cozinha").notNull(),
      status: mysqlEnum("status", ["queued", "preparing", "ready", "completed", "cancelled"]).default("queued").notNull(),
      priority: mysqlEnum("priority", ["normal", "high", "urgent"]).default("normal").notNull(),
      promisedAt: timestamp("promisedAt"),
      startedAt: timestamp("startedAt"),
      readyAt: timestamp("readyAt"),
      completedAt: timestamp("completedAt"),
      printedAt: timestamp("printedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ orderUnique: uniqueIndex("kitchen_tickets_order_uq").on(t2.storeId, t2.orderId), boardIdx: index("kitchen_tickets_board_idx").on(t2.storeId, t2.status, t2.createdAt) }));
    growthSettings = mysqlTable("growth_settings", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      cashbackPercent: decimal("cashbackPercent", { precision: 5, scale: 2 }).default("0").notNull(),
      pointsPerReal: decimal("pointsPerReal", { precision: 8, scale: 3 }).default("1").notNull(),
      referralReferrerPoints: int("referralReferrerPoints").default(100).notNull(),
      referralReferredPoints: int("referralReferredPoints").default(50).notNull(),
      npsEnabled: boolean("npsEnabled").default(true).notNull(),
      config: text("config"),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ storeUnique: uniqueIndex("growth_settings_store_uq").on(t2.storeId) }));
    rewardCatalog = mysqlTable("reward_catalog", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeIdx: index("reward_catalog_store_idx").on(t2.storeId, t2.active),
      displayIdx: index("reward_catalog_display_idx").on(t2.storeId, t2.archivedAt, t2.sortOrder)
    }));
    rewardCoupons = mysqlTable("reward_coupons", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      storeCodeUnique: uniqueIndex("reward_coupons_store_code_uq").on(t2.storeId, t2.code),
      rewardStatusIdx: index("reward_coupons_reward_status_idx").on(t2.rewardId, t2.status),
      userIdx: index("reward_coupons_user_idx").on(t2.assignedUserId),
      redemptionIdx: uniqueIndex("reward_coupons_redemption_uq").on(t2.redemptionId)
    }));
    rewardRedemptions = mysqlTable("reward_redemptions", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({
      idempotencyUnique: uniqueIndex("reward_redemptions_idempotency_uq").on(t2.storeId, t2.userId, t2.idempotencyKey),
      rewardIdx: index("reward_redemptions_reward_idx").on(t2.rewardId, t2.status),
      userIdx: index("reward_redemptions_user_idx").on(t2.userId, t2.status),
      couponUnique: uniqueIndex("reward_redemptions_coupon_uq").on(t2.couponId)
    }));
    rewardCouponUsages = mysqlTable("reward_coupon_usages", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      couponId: int("couponId").notNull(),
      redemptionId: int("redemptionId").notNull(),
      userId: int("userId").notNull(),
      orderId: int("orderId").notNull(),
      usedAt: timestamp("usedAt").defaultNow().notNull()
    }, (t2) => ({
      couponUnique: uniqueIndex("reward_coupon_usages_coupon_uq").on(t2.couponId),
      orderUnique: uniqueIndex("reward_coupon_usages_order_uq").on(t2.orderId),
      userIdx: index("reward_coupon_usages_user_idx").on(t2.userId, t2.usedAt)
    }));
    npsResponses = mysqlTable("nps_responses", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      orderId: int("orderId").notNull(),
      userId: int("userId"),
      score: int("score").notNull(),
      comment: text("comment"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({ orderUnique: uniqueIndex("nps_responses_order_uq").on(t2.storeId, t2.orderId) }));
    referrals = mysqlTable("referrals", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      referrerUserId: int("referrerUserId").notNull(),
      referredUserId: int("referredUserId"),
      code: varchar("code", { length: 32 }).notNull(),
      status: mysqlEnum("status", ["pending", "converted", "rewarded", "cancelled"]).default("pending").notNull(),
      convertedOrderId: int("convertedOrderId"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      convertedAt: timestamp("convertedAt")
    }, (t2) => ({ storeCodeUnique: uniqueIndex("referrals_store_code_uq").on(t2.storeId, t2.code), referrerIdx: index("referrals_referrer_idx").on(t2.storeId, t2.referrerUserId) }));
    integrationConnections = mysqlTable("integration_connections", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      provider: varchar("provider", { length: 64 }).notNull(),
      status: mysqlEnum("status", ["disconnected", "connecting", "connected", "degraded", "error"]).default("disconnected").notNull(),
      config: text("config"),
      credentialsRef: varchar("credentialsRef", { length: 191 }),
      lastSuccessAt: timestamp("lastSuccessAt"),
      lastFailureAt: timestamp("lastFailureAt"),
      lastError: text("lastError"),
      latencyMs: int("latencyMs"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ providerUnique: uniqueIndex("integration_connections_provider_uq").on(t2.storeId, t2.provider), healthIdx: index("integration_connections_health_idx").on(t2.storeId, t2.status) }));
    intelligenceSuggestions = mysqlTable("intelligence_suggestions", {
      id: int("id").autoincrement().primaryKey(),
      storeId: int("storeId").notNull(),
      kind: mysqlEnum("kind", ["campaign", "demand", "purchase", "pricing", "staffing"]).notNull(),
      title: varchar("title", { length: 200 }).notNull(),
      description: text("description").notNull(),
      confidence: decimal("confidence", { precision: 5, scale: 2 }).default("0").notNull(),
      impactValue: decimal("impactValue", { precision: 12, scale: 2 }),
      payload: text("payload"),
      status: mysqlEnum("status", ["new", "accepted", "dismissed", "applied"]).default("new").notNull(),
      validUntil: timestamp("validUntil"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (t2) => ({ storeKindIdx: index("intelligence_suggestions_store_kind_idx").on(t2.storeId, t2.kind, t2.status) }));
  }
});

// server/runtimeSchema.ts
function shouldRunRuntimeSchemaMigrations() {
  return process.env.RUNTIME_SCHEMA_MIGRATIONS === "true";
}
var init_runtimeSchema = __esm({
  "server/runtimeSchema.ts"() {
    "use strict";
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addLoyaltyPoints: () => addLoyaltyPoints,
  addTableSessionItem: () => addTableSessionItem,
  adjustIngredientStock: () => adjustIngredientStock,
  anonymizeUserAccount: () => anonymizeUserAccount,
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
  disconnectCustomerAuthProvider: () => disconnectCustomerAuthProvider,
  dismissClientAlert: () => dismissClientAlert,
  drawRaffleWinner: () => drawRaffleWinner,
  driverConfirmDelivery: () => driverConfirmDelivery,
  ensureRuntimeSchema: () => ensureRuntimeSchema,
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
  getCouponById: () => getCouponById,
  getCouponsByUser: () => getCouponsByUser,
  getCrmCustomerDetail: () => getCrmCustomerDetail,
  getCrmCustomers: () => getCrmCustomers,
  getCrmCustomersByTag: () => getCrmCustomersByTag,
  getCrmStats: () => getCrmStats,
  getCustomTagsForCustomer: () => getCustomTagsForCustomer,
  getCustomerAuthProvider: () => getCustomerAuthProvider,
  getCustomerAuthProviders: () => getCustomerAuthProviders,
  getCustomerMetricsReport: () => getCustomerMetricsReport,
  getCustomersByCustomTagName: () => getCustomersByCustomTagName,
  getDailyRevenue: () => getDailyRevenue,
  getDb: () => getDb,
  getDeliveryZoneByNeighborhood: () => getDeliveryZoneByNeighborhood,
  getDiningTableById: () => getDiningTableById,
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
  getStaffMemberById: () => getStaffMemberById,
  getStaffMembers: () => getStaffMembers,
  getStoreSetting: () => getStoreSetting,
  getTableSessionById: () => getTableSessionById,
  getTableSessionItemById: () => getTableSessionItemById,
  getTableSessions: () => getTableSessions,
  getTagsForCustomer: () => getTagsForCustomer,
  getTenantCustomerAccount: () => getTenantCustomerAccount,
  getTenantScope: () => getTenantScope,
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
  markUserLogin: () => markUserLogin,
  openTableSession: () => openTableSession,
  pickRandomTemplate: () => pickRandomTemplate,
  pickStoreForDeliveryAddress: () => pickStoreForDeliveryAddress,
  recordAuthEvent: () => recordAuthEvent,
  recordUserConsent: () => recordUserConsent,
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
async function hasConstraint(db, tableName, constraintName) {
  const result = await db.execute(sql.raw(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND CONSTRAINT_NAME = '${constraintName}' LIMIT 1`
  ));
  const rows = result[0] ?? [];
  return rows.length > 0;
}
async function getIndexColumns(db, tableName, indexName) {
  const result = await db.execute(sql.raw(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`));
  const rows = result[0] ?? [];
  return rows.sort((a, b) => Number(a.Seq_in_index ?? 0) - Number(b.Seq_in_index ?? 0)).map((row) => String(row.Column_name ?? "")).filter(Boolean);
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
    const socialUserColumns = [
      ["firstName", "ALTER TABLE `users` ADD `firstName` varchar(160) NULL AFTER `name`"],
      ["lastName", "ALTER TABLE `users` ADD `lastName` varchar(160) NULL AFTER `firstName`"],
      ["username", "ALTER TABLE `users` ADD `username` varchar(191) NULL AFTER `email`"],
      ["profileCompleted", "ALTER TABLE `users` ADD `profileCompleted` boolean NOT NULL DEFAULT false AFTER `emailVerified`"]
    ];
    for (const [column, statement] of socialUserColumns) {
      if (!await hasColumn(db, "users", column)) await db.execute(sql.raw(statement));
    }
    if (!await hasColumn(db, "stores", "displayName")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `displayName` varchar(200)"));
    }
    if (!await hasColumn(db, "stores", "tenantKey")) {
      await db.execute(sql.raw("ALTER TABLE `stores` ADD `tenantKey` varchar(100) NULL AFTER `id`"));
      await db.execute(sql.raw("UPDATE `stores` SET `tenantKey` = CASE WHEN `isDefault` = 1 OR LOWER(`name`) LIKE '%bonatto%' OR LOWER(`name`) LIKE '%bonnato%' THEN 'bonatto' ELSE `slug` END WHERE `tenantKey` IS NULL OR `tenantKey` = ''"));
      await db.execute(sql.raw("ALTER TABLE `stores` MODIFY `tenantKey` varchar(100) NOT NULL DEFAULT 'bonatto'"));
    }
    if (!await hasIndex(db, "stores", "stores_tenant_idx")) {
      await db.execute(sql.raw("CREATE INDEX `stores_tenant_idx` ON `stores` (`tenantKey`)"));
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
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`store_white_label_configs\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`storeId\` int NOT NULL,
        \`status\` enum('active','inactive','setup_pending') NOT NULL DEFAULT 'setup_pending',
        \`plan\` enum('essential','pro','enterprise','custom') NOT NULL DEFAULT 'essential',
        \`domain\` varchar(191),
        \`subdomain\` varchar(100),
        \`brandName\` varchar(200) NOT NULL,
        \`shortName\` varchar(100) NOT NULL,
        \`tagline\` varchar(240),
        \`adminTitle\` varchar(200),
        \`deliveryLabel\` varchar(200),
        \`logoUrl\` text,
        \`wordmarkUrl\` text,
        \`faviconUrl\` text,
        \`waiterLogoUrl\` text,
        \`primaryColor\` varchar(20) NOT NULL DEFAULT '#6E0D12',
        \`primaryDarkColor\` varchar(20) NOT NULL DEFAULT '#450709',
        \`accentColor\` varchar(20) NOT NULL DEFAULT '#e05c5c',
        \`backgroundColor\` varchar(20) NOT NULL DEFAULT '#fffaf8',
        \`textColor\` varchar(20) NOT NULL DEFAULT '#211719',
        \`featureFlags\` text NOT NULL,
        \`providerConfig\` text NOT NULL,
        \`pageConfig\` text NOT NULL,
        \`contactConfig\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`store_white_label_store_unique\` (\`storeId\`),
        UNIQUE KEY \`store_white_label_domain_unique\` (\`domain\`),
        UNIQUE KEY \`store_white_label_subdomain_unique\` (\`subdomain\`),
        KEY \`store_white_label_status_idx\` (\`status\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`tenant_memberships\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`tenantKey\` varchar(100) NOT NULL,
        \`userId\` int NOT NULL,
        \`role\` enum('owner','admin','manager') NOT NULL DEFAULT 'admin',
        \`active\` boolean NOT NULL DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`tenant_memberships_unique\` (\`tenantKey\`,\`userId\`),
        KEY \`tenant_memberships_tenant_idx\` (\`tenantKey\`),
        KEY \`tenant_memberships_user_idx\` (\`userId\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`tenant_customer_accounts\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`tenantKey\` varchar(100) NOT NULL,
        \`userId\` int NOT NULL,
        \`loyaltyPoints\` int NOT NULL DEFAULT 0,
        \`clubPlan\` enum('bonattao','basico'),
        \`clubStatus\` enum('active','pending','cancelled'),
        \`clubStartDate\` timestamp NULL,
        \`clubNextBillingDate\` timestamp NULL,
        \`clubFreePizzaUsed\` boolean NOT NULL DEFAULT false,
        \`clubFreePizzaResetAt\` timestamp NULL,
        \`stripeCustomerId\` varchar(255),
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`tenant_customer_accounts_unique\` (\`tenantKey\`,\`userId\`),
        KEY \`tenant_customer_accounts_tenant_idx\` (\`tenantKey\`),
        KEY \`tenant_customer_accounts_user_idx\` (\`userId\`),
        CONSTRAINT \`tenant_customer_accounts_points_nonnegative_chk\` CHECK (\`loyaltyPoints\` >= 0)
      )
    `));
    await db.execute(sql.raw(`
      INSERT IGNORE INTO \`tenant_customer_accounts\`
        (\`tenantKey\`, \`userId\`, \`loyaltyPoints\`, \`clubPlan\`, \`clubStatus\`, \`clubStartDate\`,
         \`clubNextBillingDate\`, \`clubFreePizzaUsed\`, \`clubFreePizzaResetAt\`, \`stripeCustomerId\`)
      SELECT 'bonatto', \`id\`, \`loyaltyPoints\`, \`clubPlan\`, \`clubStatus\`, \`clubStartDate\`,
             \`clubNextBillingDate\`, \`clubFreePizzaUsed\`, \`clubFreePizzaResetAt\`, \`stripeCustomerId\`
      FROM \`users\`
    `));
    const defaultStoreSql = "COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0)";
    const tenantLedgerTables = ["loyalty_transactions", "loyalty_order_credits"];
    for (const tableName of tenantLedgerTables) {
      if (!await hasColumn(db, tableName, "tenantKey")) {
        await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` ADD \`tenantKey\` varchar(100) NOT NULL DEFAULT 'bonatto' AFTER \`id\``));
      }
      if (!await hasColumn(db, tableName, "storeId")) {
        await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` ADD \`storeId\` int NULL AFTER \`tenantKey\``));
        await db.execute(sql.raw(`
          UPDATE \`${tableName}\` ledger
          LEFT JOIN \`orders\` o ON o.\`id\` = ledger.\`orderId\`
          LEFT JOIN \`stores\` s ON s.\`id\` = o.\`storeId\`
          SET ledger.\`storeId\` = o.\`storeId\`, ledger.\`tenantKey\` = COALESCE(s.\`tenantKey\`, 'bonatto')
          WHERE ledger.\`storeId\` IS NULL
        `));
      }
      const indexName = tableName === "loyalty_transactions" ? "loyalty_tx_tenant_user_idx" : "loyalty_order_credits_tenant_user_idx";
      if (!await hasIndex(db, tableName, indexName)) {
        await db.execute(sql.raw(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`tenantKey\`,\`userId\`)`));
      }
    }
    if (!await hasColumn(db, "club_payments", "tenantKey")) {
      await db.execute(sql.raw("ALTER TABLE `club_payments` ADD `tenantKey` varchar(100) NOT NULL DEFAULT 'bonatto' AFTER `id`"));
    }
    if (!await hasColumn(db, "club_payments", "storeId")) {
      await db.execute(sql.raw("ALTER TABLE `club_payments` ADD `storeId` int NULL AFTER `tenantKey`"));
      await db.execute(sql.raw(`UPDATE \`club_payments\` SET \`storeId\` = ${defaultStoreSql} WHERE \`storeId\` IS NULL`));
      await db.execute(sql.raw("ALTER TABLE `club_payments` MODIFY `storeId` int NOT NULL DEFAULT 0"));
    }
    if (!await hasIndex(db, "club_payments", "club_payments_tenant_user_idx")) {
      await db.execute(sql.raw("CREATE INDEX `club_payments_tenant_user_idx` ON `club_payments` (`tenantKey`,`userId`)"));
    }
    if (!await hasIndex(db, "club_payments", "club_payments_store_idx")) {
      await db.execute(sql.raw("CREATE INDEX `club_payments_store_idx` ON `club_payments` (`storeId`)"));
    }
    if (!await hasColumn(db, "client_notifications", "storeId")) {
      await db.execute(sql.raw("ALTER TABLE `client_notifications` ADD `storeId` int NULL AFTER `id`"));
      await db.execute(sql.raw(`UPDATE \`client_notifications\` SET \`storeId\` = ${defaultStoreSql} WHERE \`storeId\` IS NULL`));
    }
    if (!await hasIndex(db, "client_notifications", "client_notifications_store_user_idx")) {
      await db.execute(sql.raw("CREATE INDEX `client_notifications_store_user_idx` ON `client_notifications` (`storeId`,`userId`)"));
    }
    const automationScopedTables = [
      ["customer_tags", "customer_tags_store_idx"],
      ["custom_tags", "custom_tags_store_idx"],
      ["custom_customer_tags", "custom_customer_tags_store_idx"],
      ["abandoned_carts", "abandoned_carts_store_idx"],
      ["journeys", "journeys_store_idx"],
      ["journey_executions", "journey_executions_store_idx"],
      ["automation_events", "automation_events_store_idx"]
    ];
    for (const [tableName, indexName] of automationScopedTables) {
      if (!await hasColumn(db, tableName, "storeId")) {
        await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` ADD \`storeId\` int NULL AFTER \`id\``));
        await db.execute(sql.raw(`UPDATE \`${tableName}\` SET \`storeId\` = ${defaultStoreSql} WHERE \`storeId\` IS NULL`));
        await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` MODIFY \`storeId\` int NOT NULL DEFAULT 0`));
      }
      if (!await hasIndex(db, tableName, indexName)) {
        await db.execute(sql.raw(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`storeId\`)`));
      }
    }
    if (await hasIndex(db, "customer_tags", "customer_tags_unique")) {
      const columns = await getIndexColumns(db, "customer_tags", "customer_tags_unique");
      if (columns.join(",") !== "storeId,userId,tag") {
        await db.execute(sql.raw("ALTER TABLE `customer_tags` DROP INDEX `customer_tags_unique`"));
      }
    }
    if (!await hasIndex(db, "customer_tags", "customer_tags_unique")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `customer_tags_unique` ON `customer_tags` (`storeId`,`userId`,`tag`)"));
    }
    if (await hasIndex(db, "custom_customer_tags", "custom_customer_tags_unique")) {
      const columns = await getIndexColumns(db, "custom_customer_tags", "custom_customer_tags_unique");
      if (columns.join(",") !== "storeId,userId,tagId") {
        await db.execute(sql.raw("ALTER TABLE `custom_customer_tags` DROP INDEX `custom_customer_tags_unique`"));
      }
    }
    if (!await hasIndex(db, "custom_customer_tags", "custom_customer_tags_unique")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `custom_customer_tags_unique` ON `custom_customer_tags` (`storeId`,`userId`,`tagId`)"));
    }
    if (await hasIndex(db, "custom_tags", "custom_tags_name_unique")) {
      await db.execute(sql.raw("ALTER TABLE `custom_tags` DROP INDEX `custom_tags_name_unique`"));
    }
    if (!await hasIndex(db, "custom_tags", "custom_tags_store_name_unique")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `custom_tags_store_name_unique` ON `custom_tags` (`storeId`,`name`)"));
    }
    if (!await hasColumn(db, "categories", "storeId")) {
      await db.execute(sql.raw("ALTER TABLE `categories` ADD `storeId` int NULL AFTER `id`"));
      await db.execute(sql.raw(`
        UPDATE \`categories\`
        SET \`storeId\` = COALESCE((SELECT \`id\` FROM (SELECT \`id\` FROM \`stores\` ORDER BY \`isDefault\` DESC, \`id\` LIMIT 1) default_store), 0)
        WHERE \`storeId\` IS NULL
      `));
      await db.execute(sql.raw("ALTER TABLE `categories` MODIFY `storeId` int NOT NULL DEFAULT 0"));
      if (await hasIndex(db, "categories", "categories_slug_unique")) {
        await db.execute(sql.raw("ALTER TABLE `categories` DROP INDEX `categories_slug_unique`"));
      }
      if (await hasIndex(db, "categories", "categories_external_uq")) {
        await db.execute(sql.raw("ALTER TABLE `categories` DROP INDEX `categories_external_uq`"));
      }
    }
    if (!await hasIndex(db, "categories", "categories_store_idx")) {
      await db.execute(sql.raw("CREATE INDEX `categories_store_idx` ON `categories` (`storeId`)"));
    }
    if (!await hasIndex(db, "categories", "categories_store_slug_unique")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `categories_store_slug_unique` ON `categories` (`storeId`,`slug`)"));
    }
    if (!await hasIndex(db, "categories", "categories_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn(db, "store_settings", "storeId")) {
      await db.execute(sql.raw("ALTER TABLE `store_settings` ADD `storeId` int NULL AFTER `id`"));
      await db.execute(sql.raw(`
        UPDATE \`store_settings\`
        SET \`storeId\` = COALESCE((SELECT \`id\` FROM (SELECT \`id\` FROM \`stores\` ORDER BY \`isDefault\` DESC, \`id\` LIMIT 1) default_store), 0)
        WHERE \`storeId\` IS NULL
      `));
      await db.execute(sql.raw("ALTER TABLE `store_settings` MODIFY `storeId` int NOT NULL DEFAULT 0"));
      if (await hasIndex(db, "store_settings", "store_settings_key_unique")) {
        await db.execute(sql.raw("ALTER TABLE `store_settings` DROP INDEX `store_settings_key_unique`"));
      }
    }
    if (!await hasIndex(db, "store_settings", "store_settings_store_idx")) {
      await db.execute(sql.raw("CREATE INDEX `store_settings_store_idx` ON `store_settings` (`storeId`)"));
    }
    if (!await hasIndex(db, "store_settings", "store_settings_store_key_unique")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `store_settings_store_key_unique` ON `store_settings` (`storeId`,`key`)"));
    }
    const promotionsWasGlobal = !await hasColumn(db, "promotions", "storeId");
    const tenantScopedTables = [
      ["upsells", "upsells_store_idx"],
      ["promotions", "promotions_store_idx"],
      ["raffles", "raffles_store_idx"],
      ["delivery_zones", "delivery_zones_store_idx"],
      ["menu_slides", "menu_slides_store_idx"],
      ["carousel_images", "carousel_images_store_idx"],
      ["notification_templates", "notification_templates_store_idx"],
      ["scheduled_notifications", "scheduled_notifications_store_idx"]
    ];
    for (const [tableName, indexName] of tenantScopedTables) {
      if (!await hasColumn(db, tableName, "storeId")) {
        await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` ADD \`storeId\` int NULL AFTER \`id\``));
        await db.execute(sql.raw(`
          UPDATE \`${tableName}\`
          SET \`storeId\` = COALESCE((SELECT \`id\` FROM (SELECT \`id\` FROM \`stores\` ORDER BY \`isDefault\` DESC, \`id\` LIMIT 1) default_store), 0)
          WHERE \`storeId\` IS NULL
        `));
        await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` MODIFY \`storeId\` int NOT NULL DEFAULT 0`));
      }
      if (!await hasIndex(db, tableName, indexName)) {
        await db.execute(sql.raw(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`storeId\`)`));
      }
    }
    if (!await hasIndex(db, "delivery_zones", "delivery_zones_store_neighborhood_idx")) {
      await db.execute(sql.raw("CREATE INDEX `delivery_zones_store_neighborhood_idx` ON `delivery_zones` (`storeId`,`neighborhood`)"));
    }
    if (!await hasIndex(db, "notification_templates", "notification_templates_store_event_channel_idx")) {
      await db.execute(sql.raw("CREATE INDEX `notification_templates_store_event_channel_idx` ON `notification_templates` (`storeId`,`event`,`channel`)"));
    }
    if (!await hasIndex(db, "scheduled_notifications", "scheduled_notifications_store_scheduled_status_idx")) {
      await db.execute(sql.raw("CREATE INDEX `scheduled_notifications_store_scheduled_status_idx` ON `scheduled_notifications` (`storeId`,`scheduledAt`,`status`)"));
    }
    if (promotionsWasGlobal && await hasIndex(db, "promotions", "promotions_external_uq")) {
      await db.execute(sql.raw("ALTER TABLE `promotions` DROP INDEX `promotions_external_uq`"));
    }
    if (!await hasIndex(db, "promotions", "promotions_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    await db.execute(sql.raw(`
      UPDATE \`products\`
      SET \`storeId\` = COALESCE((SELECT \`id\` FROM (SELECT \`id\` FROM \`stores\` ORDER BY \`isDefault\` DESC, \`id\` LIMIT 1) default_store), 0)
      WHERE \`storeId\` IS NULL
    `));
    await db.execute(sql.raw(`
      UPDATE \`coupons\`
      SET \`storeId\` = COALESCE((SELECT \`id\` FROM (SELECT \`id\` FROM \`stores\` ORDER BY \`isDefault\` DESC, \`id\` LIMIT 1) default_store), 0)
      WHERE \`storeId\` IS NULL
    `));
    await db.execute(sql.raw("ALTER TABLE `products` MODIFY `storeId` int NOT NULL DEFAULT 0"));
    await db.execute(sql.raw("ALTER TABLE `coupons` MODIFY `storeId` int NOT NULL DEFAULT 0"));
    if (await hasIndex(db, "coupons", "coupons_code_unique")) {
      await db.execute(sql.raw("ALTER TABLE `coupons` DROP INDEX `coupons_code_unique`"));
    }
    if (!await hasIndex(db, "coupons", "coupons_store_idx")) {
      await db.execute(sql.raw("CREATE INDEX `coupons_store_idx` ON `coupons` (`storeId`)"));
    }
    if (!await hasIndex(db, "coupons", "coupons_store_code_unique")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `coupons_store_code_unique` ON `coupons` (`storeId`,`code`)"));
    }
    const productsExternalColumns = await getIndexColumns(db, "products", "products_external_uq");
    if (productsExternalColumns.length > 0 && productsExternalColumns[0] !== "storeId") {
      await db.execute(sql.raw("ALTER TABLE `products` DROP INDEX `products_external_uq`"));
    }
    if (!await hasIndex(db, "products", "products_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    const couponsExternalColumns = await getIndexColumns(db, "coupons", "coupons_external_uq");
    if (couponsExternalColumns.length > 0 && couponsExternalColumns[0] !== "storeId") {
      await db.execute(sql.raw("ALTER TABLE `coupons` DROP INDEX `coupons_external_uq`"));
    }
    if (!await hasIndex(db, "coupons", "coupons_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`)"));
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
    const socialProviderColumns = [
      ["providerUsername", "ALTER TABLE `customer_auth_providers` ADD `providerUsername` varchar(191) NULL AFTER `providerPhone`"],
      ["displayName", "ALTER TABLE `customer_auth_providers` ADD `displayName` varchar(255) NULL AFTER `providerUsername`"],
      ["avatarUrl", "ALTER TABLE `customer_auth_providers` ADD `avatarUrl` text NULL AFTER `displayName`"],
      ["accountType", "ALTER TABLE `customer_auth_providers` ADD `accountType` varchar(64) NULL AFTER `avatarUrl`"],
      ["accessTokenEncrypted", "ALTER TABLE `customer_auth_providers` ADD `accessTokenEncrypted` text NULL AFTER `accountType`"],
      ["refreshTokenEncrypted", "ALTER TABLE `customer_auth_providers` ADD `refreshTokenEncrypted` text NULL AFTER `accessTokenEncrypted`"],
      ["tokenExpiresAt", "ALTER TABLE `customer_auth_providers` ADD `tokenExpiresAt` timestamp NULL AFTER `refreshTokenEncrypted`"],
      ["grantedScopes", "ALTER TABLE `customer_auth_providers` ADD `grantedScopes` text NULL AFTER `tokenExpiresAt`"],
      ["rawProfileJson", "ALTER TABLE `customer_auth_providers` ADD `rawProfileJson` text NULL AFTER `grantedScopes`"],
      ["consentVersion", "ALTER TABLE `customer_auth_providers` ADD `consentVersion` varchar(32) NULL AFTER `isPrimary`"],
      ["consentedAt", "ALTER TABLE `customer_auth_providers` ADD `consentedAt` timestamp NULL AFTER `consentVersion`"],
      ["lastSyncedAt", "ALTER TABLE `customer_auth_providers` ADD `lastSyncedAt` timestamp NULL AFTER `linkedAt`"],
      ["disconnectedAt", "ALTER TABLE `customer_auth_providers` ADD `disconnectedAt` timestamp NULL AFTER `lastSyncedAt`"]
    ];
    for (const [column, statement] of socialProviderColumns) {
      if (!await hasColumn(db, "customer_auth_providers", column)) await db.execute(sql.raw(statement));
    }
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`auth_event_logs\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NULL,
        \`provider\` varchar(32) NULL,
        \`event\` enum('login_success','login_failure','provider_connected','provider_disconnected','profile_synced','account_deleted') NOT NULL,
        \`ipAddress\` varchar(64) NULL,
        \`userAgent\` text NULL,
        \`metadataJson\` text NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`auth_event_logs_user_created_idx\` (\`userId\`,\`createdAt\`),
        KEY \`auth_event_logs_event_created_idx\` (\`event\`,\`createdAt\`)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`user_consents\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`kind\` enum('terms','privacy','social_sync') NOT NULL,
        \`version\` varchar(32) NOT NULL,
        \`granted\` boolean NOT NULL DEFAULT true,
        \`ipAddress\` varchar(64) NULL,
        \`userAgent\` text NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`user_consents_user_kind_created_idx\` (\`userId\`,\`kind\`,\`createdAt\`)
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
    const platformTables = [
      "CREATE TABLE IF NOT EXISTS `tenant_site_pages` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`pageKey` enum('home','menu','club','landing') NOT NULL,`title` varchar(160) NOT NULL,`draftContent` longtext NOT NULL,`publishedVersionId` int,`updatedByUserId` int,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `tenant_site_pages_store_page_uq` (`storeId`,`pageKey`),KEY `tenant_site_pages_store_idx` (`storeId`))",
      "CREATE TABLE IF NOT EXISTS `tenant_site_page_versions` (`id` int AUTO_INCREMENT PRIMARY KEY,`pageId` int NOT NULL,`versionNumber` int NOT NULL,`content` longtext NOT NULL,`note` varchar(240),`createdByUserId` int,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY `tenant_site_page_versions_uq` (`pageId`,`versionNumber`),KEY `tenant_site_page_versions_page_idx` (`pageId`,`createdAt`))",
      "CREATE TABLE IF NOT EXISTS `tenants` (`id` int AUTO_INCREMENT PRIMARY KEY,`tenantKey` varchar(100) NOT NULL,`legalName` varchar(200) NOT NULL,`displayName` varchar(200) NOT NULL,`document` varchar(32),`status` enum('setup_pending','active','suspended','cancelled') NOT NULL DEFAULT 'setup_pending',`ownerUserId` int,`metadata` text,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `tenants_key_uq` (`tenantKey`),KEY `tenants_status_idx` (`status`))",
      "CREATE TABLE IF NOT EXISTS `tenant_domains` (`id` int AUTO_INCREMENT PRIMARY KEY,`tenantId` int NOT NULL,`hostname` varchar(255) NOT NULL,`kind` enum('platform_subdomain','custom_domain') NOT NULL,`status` enum('pending','verifying','verified','active','failed','disabled') NOT NULL DEFAULT 'pending',`verificationToken` varchar(96) NOT NULL,`verifiedAt` timestamp NULL,`activatedAt` timestamp NULL,`lastError` text,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `tenant_domains_hostname_uq` (`hostname`),KEY `tenant_domains_tenant_idx` (`tenantId`,`status`))",
      "CREATE TABLE IF NOT EXISTS `tenant_plans` (`id` int AUTO_INCREMENT PRIMARY KEY,`code` varchar(64) NOT NULL,`name` varchar(120) NOT NULL,`monthlyPrice` decimal(10,2) NOT NULL DEFAULT 0,`entitlements` text NOT NULL,`limits` text NOT NULL,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `tenant_plans_code_uq` (`code`))",
      "CREATE TABLE IF NOT EXISTS `tenant_subscriptions` (`id` int AUTO_INCREMENT PRIMARY KEY,`tenantId` int NOT NULL,`planId` int NOT NULL,`status` enum('trialing','active','past_due','suspended','cancelled') NOT NULL DEFAULT 'trialing',`provider` varchar(32),`externalCustomerId` varchar(191),`externalSubscriptionId` varchar(191),`trialEndsAt` timestamp NULL,`currentPeriodEndsAt` timestamp NULL,`graceEndsAt` timestamp NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `tenant_subscriptions_tenant_uq` (`tenantId`),KEY `tenant_subscriptions_status_idx` (`status`))",
      "CREATE TABLE IF NOT EXISTS `tenant_audit_logs` (`id` int AUTO_INCREMENT PRIMARY KEY,`tenantId` int NOT NULL,`storeId` int,`actorUserId` int,`action` varchar(120) NOT NULL,`resourceType` varchar(80) NOT NULL,`resourceId` varchar(96),`requestId` varchar(96),`ipAddress` varchar(64),`metadata` text,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY `tenant_audit_tenant_created_idx` (`tenantId`,`createdAt`))",
      "CREATE TABLE IF NOT EXISTS `product_option_groups` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`name` varchar(120) NOT NULL,`kind` enum('single','multiple','flavor','size','edge') NOT NULL DEFAULT 'multiple',`required` boolean NOT NULL DEFAULT false,`minSelections` int NOT NULL DEFAULT 0,`maxSelections` int NOT NULL DEFAULT 1,`sortOrder` int NOT NULL DEFAULT 0,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `product_option_groups_product_idx` (`storeId`,`productId`,`active`))",
      "CREATE TABLE IF NOT EXISTS `product_options` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`groupId` int NOT NULL,`name` varchar(160) NOT NULL,`description` text,`priceDelta` decimal(10,2) NOT NULL DEFAULT 0,`linkedProductId` int,`ingredientId` int,`ingredientQuantity` decimal(10,3),`imageUrl` text,`sortOrder` int NOT NULL DEFAULT 0,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `product_options_group_idx` (`storeId`,`groupId`,`active`))",
      "CREATE TABLE IF NOT EXISTS `product_combos` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`name` varchar(160) NOT NULL,`description` text,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `product_combos_product_uq` (`storeId`,`productId`))",
      "CREATE TABLE IF NOT EXISTS `combo_groups` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`comboId` int NOT NULL,`name` varchar(120) NOT NULL,`minSelections` int NOT NULL DEFAULT 1,`maxSelections` int NOT NULL DEFAULT 1,`sortOrder` int NOT NULL DEFAULT 0,KEY `combo_groups_combo_idx` (`storeId`,`comboId`))",
      "CREATE TABLE IF NOT EXISTS `combo_group_items` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`groupId` int NOT NULL,`productId` int NOT NULL,`priceDelta` decimal(10,2) NOT NULL DEFAULT 0,`active` boolean NOT NULL DEFAULT true,KEY `combo_group_items_group_idx` (`storeId`,`groupId`))",
      "CREATE TABLE IF NOT EXISTS `order_item_selections` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`orderId` int NOT NULL,`orderItemId` int NOT NULL,`groupName` varchar(120) NOT NULL,`optionName` varchar(160) NOT NULL,`optionId` int,`linkedProductId` int,`priceDelta` decimal(10,2) NOT NULL DEFAULT 0,`quantity` int NOT NULL DEFAULT 1,`metadata` text,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY `order_item_selections_order_idx` (`storeId`,`orderId`),KEY `order_item_selections_item_idx` (`orderItemId`))",
      "CREATE TABLE IF NOT EXISTS `kitchen_tickets` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`orderId` int NOT NULL,`station` varchar(80) NOT NULL DEFAULT 'cozinha',`status` enum('queued','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'queued',`priority` enum('normal','high','urgent') NOT NULL DEFAULT 'normal',`promisedAt` timestamp NULL,`startedAt` timestamp NULL,`readyAt` timestamp NULL,`completedAt` timestamp NULL,`printedAt` timestamp NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `kitchen_tickets_order_uq` (`storeId`,`orderId`),KEY `kitchen_tickets_board_idx` (`storeId`,`status`,`createdAt`))",
      "CREATE TABLE IF NOT EXISTS `growth_settings` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`cashbackPercent` decimal(5,2) NOT NULL DEFAULT 0,`pointsPerReal` decimal(8,3) NOT NULL DEFAULT 1,`referralReferrerPoints` int NOT NULL DEFAULT 100,`referralReferredPoints` int NOT NULL DEFAULT 50,`npsEnabled` boolean NOT NULL DEFAULT true,`config` text,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `growth_settings_store_uq` (`storeId`))",
      "CREATE TABLE IF NOT EXISTS `reward_catalog` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`name` varchar(160) NOT NULL,`description` text,`rewardType` enum('discount','product','free_delivery','cashback') NOT NULL,`pointsCost` int NOT NULL DEFAULT 0,`value` decimal(10,2) NOT NULL DEFAULT 0,`productId` int,`category` varchar(80),`icon` varchar(64),`imageUrl` text,`badgeText` varchar(64),`buttonText` varchar(64) NOT NULL DEFAULT 'Resgatar',`stock` int,`totalRedemptions` int NOT NULL DEFAULT 0,`maxRedemptionsPerUser` int,`active` boolean NOT NULL DEFAULT true,`featured` boolean NOT NULL DEFAULT false,`sortOrder` int NOT NULL DEFAULT 0,`startsAt` timestamp NULL,`expiresAt` timestamp NULL,`archivedAt` timestamp NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `reward_catalog_store_idx` (`storeId`,`active`),KEY `reward_catalog_display_idx` (`storeId`,`archivedAt`,`sortOrder`),CONSTRAINT `reward_catalog_stock_nonnegative_chk` CHECK (`stock` IS NULL OR `stock` >= 0),CONSTRAINT `reward_catalog_redemptions_nonnegative_chk` CHECK (`totalRedemptions` >= 0))",
      "CREATE TABLE IF NOT EXISTS `reward_redemptions` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`rewardId` int NOT NULL,`userId` int NOT NULL,`couponId` int,`pointsSpent` int NOT NULL,`status` enum('pending','completed','cancelled','refunded','expired') NOT NULL DEFAULT 'pending',`idempotencyKey` varchar(96) NOT NULL,`redeemedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`expiresAt` timestamp NULL,`cancelledAt` timestamp NULL,`cancellationReason` varchar(500),`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `reward_redemptions_idempotency_uq` (`storeId`,`userId`,`idempotencyKey`),UNIQUE KEY `reward_redemptions_coupon_uq` (`couponId`),KEY `reward_redemptions_reward_idx` (`rewardId`,`status`),KEY `reward_redemptions_user_idx` (`userId`,`status`),CONSTRAINT `reward_redemptions_points_chk` CHECK (`pointsSpent` >= 0))",
      "CREATE TABLE IF NOT EXISTS `reward_coupons` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`rewardId` int NOT NULL,`code` varchar(64) NOT NULL,`status` enum('available','reserved','redeemed','used','expired','cancelled') NOT NULL DEFAULT 'available',`assignedUserId` int,`redemptionId` int,`reservedAt` timestamp NULL,`redeemedAt` timestamp NULL,`usedAt` timestamp NULL,`expiresAt` timestamp NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `reward_coupons_store_code_uq` (`storeId`,`code`),UNIQUE KEY `reward_coupons_redemption_uq` (`redemptionId`),KEY `reward_coupons_reward_status_idx` (`rewardId`,`status`),KEY `reward_coupons_user_idx` (`assignedUserId`))",
      "CREATE TABLE IF NOT EXISTS `reward_coupon_usages` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`couponId` int NOT NULL,`redemptionId` int NOT NULL,`userId` int NOT NULL,`orderId` int NOT NULL,`usedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY `reward_coupon_usages_coupon_uq` (`couponId`),UNIQUE KEY `reward_coupon_usages_order_uq` (`orderId`),KEY `reward_coupon_usages_user_idx` (`userId`,`usedAt`))",
      "CREATE TABLE IF NOT EXISTS `nps_responses` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`orderId` int NOT NULL,`userId` int,`score` int NOT NULL,`comment` text,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY `nps_responses_order_uq` (`storeId`,`orderId`))",
      "CREATE TABLE IF NOT EXISTS `referrals` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`referrerUserId` int NOT NULL,`referredUserId` int,`code` varchar(32) NOT NULL,`status` enum('pending','converted','rewarded','cancelled') NOT NULL DEFAULT 'pending',`convertedOrderId` int,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`convertedAt` timestamp NULL,UNIQUE KEY `referrals_store_code_uq` (`storeId`,`code`),KEY `referrals_referrer_idx` (`storeId`,`referrerUserId`))",
      "CREATE TABLE IF NOT EXISTS `integration_connections` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`provider` varchar(64) NOT NULL,`status` enum('disconnected','connecting','connected','degraded','error') NOT NULL DEFAULT 'disconnected',`config` text,`credentialsRef` varchar(191),`lastSuccessAt` timestamp NULL,`lastFailureAt` timestamp NULL,`lastError` text,`latencyMs` int,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `integration_connections_provider_uq` (`storeId`,`provider`),KEY `integration_connections_health_idx` (`storeId`,`status`))",
      "CREATE TABLE IF NOT EXISTS `intelligence_suggestions` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`kind` enum('campaign','demand','purchase','pricing','staffing') NOT NULL,`title` varchar(200) NOT NULL,`description` text NOT NULL,`confidence` decimal(5,2) NOT NULL DEFAULT 0,`impactValue` decimal(12,2),`payload` text,`status` enum('new','accepted','dismissed','applied') NOT NULL DEFAULT 'new',`validUntil` timestamp NULL,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `intelligence_suggestions_store_kind_idx` (`storeId`,`kind`,`status`))",
      "CREATE TABLE IF NOT EXISTS `product_images` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`imageUrl` text NOT NULL,`altText` varchar(240),`kind` enum('primary','gallery','flavor','nutrition') NOT NULL DEFAULT 'gallery',`sortOrder` int NOT NULL DEFAULT 0,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY `product_images_product_idx` (`storeId`,`productId`,`active`,`sortOrder`))",
      "CREATE TABLE IF NOT EXISTS `product_sizes` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`name` varchar(120) NOT NULL,`internalCode` varchar(128),`description` text,`price` decimal(10,2) NOT NULL,`promotionalPrice` decimal(10,2),`promotionStartsAt` timestamp NULL,`promotionEndsAt` timestamp NULL,`serves` int,`minFlavors` int,`maxFlavors` int,`maxAddons` int,`preparationTime` int,`active` boolean NOT NULL DEFAULT true,`sortOrder` int NOT NULL DEFAULT 0,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `product_sizes_code_uq` (`storeId`,`productId`,`internalCode`),KEY `product_sizes_product_idx` (`storeId`,`productId`,`active`,`sortOrder`))",
      "CREATE TABLE IF NOT EXISTS `product_variants` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`name` varchar(160) NOT NULL,`sku` varchar(128),`price` decimal(10,2) NOT NULL,`promotionalPrice` decimal(10,2),`active` boolean NOT NULL DEFAULT true,`sortOrder` int NOT NULL DEFAULT 0,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `product_variants_store_sku_uq` (`storeId`,`sku`),KEY `product_variants_product_idx` (`storeId`,`productId`,`active`))",
      "CREATE TABLE IF NOT EXISTS `product_availability` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`weekday` int,`startTime` varchar(5),`endTime` varchar(5),`startsAt` timestamp NULL,`expiresAt` timestamp NULL,`channel` enum('all','delivery','pickup','dine_in','counter') NOT NULL DEFAULT 'all',`unavailableBehavior` enum('hide','show_unavailable','show_return_time') NOT NULL DEFAULT 'show_unavailable',`stockLimit` int,`pausedUntil` timestamp NULL,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `product_availability_product_idx` (`storeId`,`productId`,`active`))",
      "CREATE TABLE IF NOT EXISTS `modifier_size_rules` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`modifierOptionId` int NOT NULL,`productSizeId` int NOT NULL,`enabled` boolean NOT NULL DEFAULT true,`priceOverride` decimal(10,2),`maxQuantityOverride` int,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `modifier_size_rules_uq` (`storeId`,`modifierOptionId`,`productSizeId`))",
      "CREATE TABLE IF NOT EXISTS `multi_flavor_settings` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`enabled` boolean NOT NULL DEFAULT false,`pricingRule` enum('highest_price','average_price','proportional_price','size_fixed_price','base_plus_difference') NOT NULL DEFAULT 'highest_price',`allowRepeatedFlavors` boolean NOT NULL DEFAULT false,`visualDivisions` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `multi_flavor_settings_product_uq` (`storeId`,`productId`))",
      "CREATE TABLE IF NOT EXISTS `product_flavors` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`name` varchar(160) NOT NULL,`description` text,`imageUrl` text,`ingredients` text,`removableIngredients` text,`active` boolean NOT NULL DEFAULT true,`sortOrder` int NOT NULL DEFAULT 0,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `product_flavors_product_idx` (`storeId`,`productId`,`active`,`sortOrder`))",
      "CREATE TABLE IF NOT EXISTS `flavor_size_prices` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`flavorId` int NOT NULL,`productSizeId` int NOT NULL,`price` decimal(10,2) NOT NULL,`active` boolean NOT NULL DEFAULT true,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY `flavor_size_prices_uq` (`storeId`,`flavorId`,`productSizeId`))",
      "CREATE TABLE IF NOT EXISTS `product_drafts` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int,`createdByUserId` int NOT NULL,`baseVersion` int NOT NULL DEFAULT 0,`status` enum('editing','ready','published','discarded') NOT NULL DEFAULT 'editing',`draftData` longtext NOT NULL,`tutorialProgress` text,`lastSavedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY `product_drafts_product_idx` (`storeId`,`productId`,`status`),KEY `product_drafts_user_idx` (`createdByUserId`,`status`))",
      "CREATE TABLE IF NOT EXISTS `product_revisions` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`version` int NOT NULL,`snapshot` longtext NOT NULL,`note` varchar(240),`createdByUserId` int,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY `product_revisions_uq` (`storeId`,`productId`,`version`),KEY `product_revisions_product_idx` (`productId`,`createdAt`))",
      "CREATE TABLE IF NOT EXISTS `product_audit_logs` (`id` int AUTO_INCREMENT PRIMARY KEY,`storeId` int NOT NULL,`productId` int NOT NULL,`actorUserId` int,`action` varchar(80) NOT NULL,`fieldName` varchar(160),`previousValue` longtext,`newValue` longtext,`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY `product_audit_logs_product_idx` (`storeId`,`productId`,`createdAt`))"
    ];
    for (const statement of platformTables) await db.execute(sql.raw(statement));
    const professionalCatalogColumns = {
      products: [
        ["sku", "varchar(128) NULL AFTER `externalCode`"],
        ["shortDescription", "varchar(320) NULL AFTER `sku`"],
        ["productType", "enum('simple','sizes','variants','buildable','multi_flavor','combo','weight','quantity','variable_price') NOT NULL DEFAULT 'simple' AFTER `shortDescription`"],
        ["pricingEngine", "enum('legacy_v1','configured_v2') NOT NULL DEFAULT 'legacy_v1' AFTER `productType`"],
        ["editorialStatus", "enum('draft','published','scheduled','archived') NOT NULL DEFAULT 'published' AFTER `pricingEngine`"],
        ["preparationTime", "int NULL AFTER `editorialStatus`"],
        ["allergenNotice", "text NULL AFTER `preparationTime`"],
        ["nutritionalInfo", "text NULL AFTER `allergenNotice`"],
        ["tags", "text NULL AFTER `nutritionalInfo`"],
        ["minQuantity", "int NOT NULL DEFAULT 1 AFTER `tags`"],
        ["maxQuantity", "int NOT NULL DEFAULT 99 AFTER `minQuantity`"],
        ["couponEligible", "boolean NOT NULL DEFAULT true AFTER `maxQuantity`"],
        ["pointsEligible", "boolean NOT NULL DEFAULT true AFTER `couponEligible`"],
        ["version", "int NOT NULL DEFAULT 1 AFTER `pointsEligible`"],
        ["scheduledPublishAt", "timestamp NULL AFTER `version`"],
        ["publishedAt", "timestamp NULL AFTER `scheduledPublishAt`"],
        ["archivedAt", "timestamp NULL AFTER `publishedAt`"]
      ],
      product_option_groups: [
        ["description", "text NULL AFTER `kind`"],
        ["freeSelections", "int NOT NULL DEFAULT 0 AFTER `maxSelections`"],
        ["allowRepeatedOptions", "boolean NOT NULL DEFAULT false AFTER `freeSelections`"],
        ["appliesToAllSizes", "boolean NOT NULL DEFAULT true AFTER `allowRepeatedOptions`"]
      ],
      product_options: [
        ["maxQuantity", "int NOT NULL DEFAULT 1 AFTER `imageUrl`"],
        ["allowRepeat", "boolean NOT NULL DEFAULT false AFTER `maxQuantity`"]
      ],
      combo_groups: [
        ["required", "boolean NOT NULL DEFAULT true AFTER `name`"],
        ["active", "boolean NOT NULL DEFAULT true AFTER `sortOrder`"]
      ],
      combo_group_items: [["sizeId", "int NULL AFTER `productId`"]],
      order_items: [
        ["snapshotVersion", "int NOT NULL DEFAULT 1 AFTER `notes`"],
        ["configurationSnapshot", "longtext NULL AFTER `snapshotVersion`"],
        ["pricingBreakdown", "longtext NULL AFTER `configurationSnapshot`"]
      ],
      order_item_selections: [["totalPrice", "decimal(10,2) NOT NULL DEFAULT 0 AFTER `quantity`"]],
      upsells: [
        ["triggerType", "enum('product_selected','size_selected','modifier_selected','category_selected','cart_value','missing_category','checkout') NOT NULL DEFAULT 'checkout' AFTER `sortOrder`"],
        ["triggerSizeId", "int NULL AFTER `triggerType`"],
        ["triggerModifierId", "int NULL AFTER `triggerSizeId`"],
        ["triggerCategoryId", "int NULL AFTER `triggerModifierId`"],
        ["displayType", "enum('inline','modal','cart','checkout') NOT NULL DEFAULT 'checkout' AFTER `triggerCategoryId`"],
        ["priority", "int NOT NULL DEFAULT 0 AFTER `displayType`"],
        ["startsAt", "timestamp NULL AFTER `priority`"],
        ["expiresAt", "timestamp NULL AFTER `startsAt`"],
        ["weekdays", "varchar(32) NULL AFTER `expiresAt`"],
        ["startTime", "varchar(5) NULL AFTER `weekdays`"],
        ["endTime", "varchar(5) NULL AFTER `startTime`"],
        ["maxDisplaysPerCart", "int NOT NULL DEFAULT 1 AFTER `endTime`"],
        ["dismissible", "boolean NOT NULL DEFAULT true AFTER `maxDisplaysPerCart`"]
      ]
    };
    for (const [table, columns] of Object.entries(professionalCatalogColumns)) {
      for (const [column, definition] of columns) {
        if (!await hasColumn(db, table, column)) {
          await db.execute(sql.raw(`ALTER TABLE \`${table}\` ADD \`${column}\` ${definition}`));
        }
      }
    }
    if (!await hasIndex(db, "products", "products_store_sku_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `products_store_sku_uq` ON `products` (`storeId`,`sku`)"));
    }
    if (!await hasIndex(db, "products", "products_editorial_idx")) {
      await db.execute(sql.raw("CREATE INDEX `products_editorial_idx` ON `products` (`storeId`,`editorialStatus`,`active`)"));
    }
    const rewardCatalogColumns = [
      ["category", "varchar(80) NULL AFTER `productId`"],
      ["icon", "varchar(64) NULL AFTER `category`"],
      ["imageUrl", "text NULL AFTER `icon`"],
      ["badgeText", "varchar(64) NULL AFTER `imageUrl`"],
      ["buttonText", "varchar(64) NOT NULL DEFAULT 'Resgatar' AFTER `badgeText`"],
      ["stock", "int NULL AFTER `buttonText`"],
      ["totalRedemptions", "int NOT NULL DEFAULT 0 AFTER `stock`"],
      ["maxRedemptionsPerUser", "int NULL AFTER `totalRedemptions`"],
      ["featured", "boolean NOT NULL DEFAULT false AFTER `active`"],
      ["sortOrder", "int NOT NULL DEFAULT 0 AFTER `featured`"],
      ["startsAt", "timestamp NULL AFTER `sortOrder`"],
      ["expiresAt", "timestamp NULL AFTER `startsAt`"],
      ["archivedAt", "timestamp NULL AFTER `expiresAt`"],
      ["updatedAt", "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `createdAt`"]
    ];
    for (const [column, definition] of rewardCatalogColumns) {
      if (!await hasColumn(db, "reward_catalog", column)) {
        await db.execute(sql.raw(`ALTER TABLE \`reward_catalog\` ADD \`${column}\` ${definition}`));
      }
    }
    if (!await hasIndex(db, "reward_catalog", "reward_catalog_display_idx")) {
      await db.execute(sql.raw("CREATE INDEX `reward_catalog_display_idx` ON `reward_catalog` (`storeId`,`archivedAt`,`sortOrder`)"));
    }
    await db.execute(sql.raw("ALTER TABLE `loyalty_transactions` MODIFY COLUMN `type` enum('earn','redeem','refund','adjustment','manual') NOT NULL"));
    if (!await hasConstraint(db, "tenant_customer_accounts", "tenant_customer_accounts_points_nonnegative_chk")) {
      await db.execute(sql.raw("ALTER TABLE `tenant_customer_accounts` ADD CONSTRAINT `tenant_customer_accounts_points_nonnegative_chk` CHECK (`loyaltyPoints` >= 0)"));
    }
    if (!await hasConstraint(db, "reward_catalog", "reward_catalog_stock_nonnegative_chk")) {
      await db.execute(sql.raw("ALTER TABLE `reward_catalog` ADD CONSTRAINT `reward_catalog_stock_nonnegative_chk` CHECK (`stock` IS NULL OR `stock` >= 0)"));
    }
    if (!await hasConstraint(db, "reward_catalog", "reward_catalog_redemptions_nonnegative_chk")) {
      await db.execute(sql.raw("ALTER TABLE `reward_catalog` ADD CONSTRAINT `reward_catalog_redemptions_nonnegative_chk` CHECK (`totalRedemptions` >= 0)"));
    }
    await db.execute(sql.raw("ALTER TABLE `tenant_memberships` MODIFY `role` enum('owner','admin','manager','site_editor','marketing') NOT NULL DEFAULT 'admin'"));
    await db.execute(sql.raw("INSERT IGNORE INTO `tenants` (`tenantKey`,`legalName`,`displayName`,`status`) SELECT `tenantKey`,COALESCE(MAX(`displayName`),MAX(`name`)),COALESCE(MAX(`displayName`),MAX(`name`)),'active' FROM `stores` GROUP BY `tenantKey`"));
    await db.execute(sql.raw("INSERT IGNORE INTO `tenant_plans` (`code`,`name`,`monthlyPrice`,`entitlements`,`limits`) VALUES ('essential','Essencial',0,'{}','{\"stores\":1,\"users\":10}'),('pro','Pro',0,'{}','{\"stores\":5,\"users\":50}'),('enterprise','Enterprise',0,'{}','{}')"));
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
      await db.execute(sql.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn(db, "coupons", "externalSource")) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `coupons` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"
        )
      );
    }
    if (!await hasIndex(db, "coupons", "coupons_external_uq")) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`)"));
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
  if (_db && shouldRunRuntimeSchemaMigrations()) {
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
async function getCategories(input = true) {
  const db = await getDb();
  if (!db) return [];
  const opts = typeof input === "boolean" ? { activeOnly: input } : input;
  const conditions = [];
  if (opts.activeOnly !== false) conditions.push(eq(categories.active, true));
  if (opts.storeId !== void 0) conditions.push(eq(categories.storeId, opts.storeId));
  return db.select().from(categories).where(conditions.length ? and(...conditions) : void 0).orderBy(categories.sortOrder, categories.name);
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
  if (opts?.storeId !== void 0) conditions.push(eq(products.storeId, opts.storeId));
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
async function getStaffMemberById(id) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(staffMembers).where(eq(staffMembers.id, id)).limit(1);
    return rows[0];
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
async function getDiningTableById(id) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(diningTables).where(eq(diningTables.id, id)).limit(1);
    return rows[0];
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
async function getTableSessionById(id) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1);
    return rows[0];
  });
}
async function getTableSessionItemById(id) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(tableSessionItems).where(eq(tableSessionItems.id, id)).limit(1);
    return rows[0];
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
    const existingProvider = await db.select({ userId: customerAuthProviders.userId }).from(customerAuthProviders).where(and(
      eq(customerAuthProviders.provider, data.provider),
      eq(customerAuthProviders.providerUserId, data.providerUserId)
    )).limit(1);
    if (existingProvider[0] && existingProvider[0].userId !== data.userId) {
      throw new Error("This social account is already linked to another user");
    }
    await db.insert(customerAuthProviders).values({
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
      disconnectedAt: null
    }).onDuplicateKeyUpdate({
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
        disconnectedAt: null
      }
    });
  });
}
async function getCustomerAuthProviders(userId) {
  return withDbRetry((db) => db.select().from(customerAuthProviders).where(and(eq(customerAuthProviders.userId, userId), isNull(customerAuthProviders.disconnectedAt))).orderBy(desc(customerAuthProviders.isPrimary), desc(customerAuthProviders.linkedAt)));
}
async function getCustomerAuthProvider(userId, provider) {
  return withDbRetry(async (db) => {
    const rows = await db.select().from(customerAuthProviders).where(and(
      eq(customerAuthProviders.userId, userId),
      eq(customerAuthProviders.provider, provider),
      isNull(customerAuthProviders.disconnectedAt)
    )).limit(1);
    return rows[0];
  });
}
async function disconnectCustomerAuthProvider(userId, provider) {
  await withDbRetry((db) => db.update(customerAuthProviders).set({
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    disconnectedAt: /* @__PURE__ */ new Date(),
    isPrimary: false
  }).where(and(eq(customerAuthProviders.userId, userId), eq(customerAuthProviders.provider, provider))));
}
async function recordAuthEvent(data) {
  await withDbRetry((db) => db.insert(authEventLogs).values({
    userId: data.userId ?? null,
    provider: data.provider ?? null,
    event: data.event,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
    metadataJson: data.metadata ? JSON.stringify(data.metadata) : null
  }));
}
async function recordUserConsent(data) {
  await withDbRetry((db) => db.insert(userConsents).values({
    userId: data.userId,
    kind: data.kind,
    version: data.version,
    granted: data.granted ?? true,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null
  }));
}
async function markUserLogin(userId, provider) {
  await withDbRetry((db) => db.update(users).set({ loginMethod: provider, lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, userId)));
}
async function anonymizeUserAccount(userId) {
  const anonymized = `deleted_${userId}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await withDbRetry(async (db) => {
    await db.update(customerAuthProviders).set({
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      providerEmail: null,
      providerPhone: null,
      providerUsername: null,
      rawProfileJson: null,
      disconnectedAt: /* @__PURE__ */ new Date(),
      isPrimary: false
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
      status: "inactive"
    }).where(eq(users.id, userId));
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
async function getCouponByCode(code, storeId) {
  const db = await getDb();
  if (!db) return void 0;
  const conditions = [eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)];
  if (storeId !== void 0) conditions.push(eq(coupons.storeId, storeId));
  const result = await db.select().from(coupons).where(and(...conditions)).limit(1);
  return result[0];
}
async function getCouponById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return coupon;
}
async function getAllCoupons(storeId) {
  const db = await getDb();
  if (!db) return [];
  if (storeId !== void 0) return db.select().from(coupons).where(eq(coupons.storeId, storeId)).orderBy(desc(coupons.createdAt));
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
async function incrementCouponUsage(couponId) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(
    and(
      eq(coupons.id, couponId),
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
  return withDbRetry(
    (db) => db.transaction(async (tx) => {
      const result = await tx.insert(orders).values(orderData);
      const resultHeader = Array.isArray(result) ? result[0] : result;
      const orderId = resultHeader.insertId;
      if (!orderId) throw new Error("Failed to get order ID after insert");
      const itemsWithOrderId = items.map((item) => ({ ...item, orderId }));
      await tx.insert(orderItems).values(itemsWithOrderId);
      return orderId;
    })
  );
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
async function getOrdersByUser(userId, storeId) {
  return withDbRetry(async (db) => {
    const effectiveStoreId = await getEffectiveStoreId(db, storeId);
    return db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.storeId, effectiveStoreId))).orderBy(desc(orders.createdAt));
  });
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
    if (data.firstName !== void 0) updateSet.firstName = data.firstName;
    if (data.lastName !== void 0) updateSet.lastName = data.lastName;
    if (data.email !== void 0) updateSet.email = data.email;
    if (data.username !== void 0) updateSet.username = data.username;
    if (data.avatarUrl !== void 0) updateSet.avatarUrl = data.avatarUrl;
    if (data.loginMethod !== void 0) updateSet.loginMethod = data.loginMethod;
    if (data.emailVerified !== void 0) updateSet.emailVerified = data.emailVerified;
    if (data.profileCompleted !== void 0) updateSet.profileCompleted = data.profileCompleted;
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
async function getCouponsByUser(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(coupons).where(and(eq(coupons.userId, userId), eq(coupons.storeId, effectiveStoreId), eq(coupons.active, true)));
}
async function createUserCoupon(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [membership] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, data.userId), eq(orders.storeId, data.storeId))).limit(1);
  if (!membership) throw new Error("Cliente n\xE3o pertence \xE0 loja selecionada");
  await db.insert(coupons).values({
    ...data,
    active: true,
    usedCount: 0
  });
}
async function getEffectiveStoreId(db, storeId) {
  if (storeId && storeId > 0) return storeId;
  return (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id ?? 0;
}
async function getActiveUpsells(storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(upsells).where(and(eq(upsells.storeId, effectiveStoreId), eq(upsells.active, true))).orderBy(upsells.sortOrder);
}
async function getUpsellsForCart(cartProductIds, cartTotal, storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const all = await db.select().from(upsells).where(and(eq(upsells.storeId, effectiveStoreId), eq(upsells.active, true))).orderBy(upsells.sortOrder);
  const filtered = all.filter((u) => {
    if (u.triggerMinTotal && parseFloat(u.triggerMinTotal) > cartTotal) return false;
    if (u.triggerProductId && !cartProductIds.includes(u.triggerProductId)) return false;
    if (cartProductIds.includes(u.suggestedProductId)) return false;
    return true;
  });
  const productIds = Array.from(new Set(filtered.map((u) => u.suggestedProductId)));
  const prods = productIds.length > 0 ? await db.select().from(products).where(and(
    eq(products.storeId, effectiveStoreId),
    sql`${products.id} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`
  )) : [];
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
async function updateUpsell(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(upsells).set(data).where(and(eq(upsells.id, id), eq(upsells.storeId, storeId)));
}
async function deleteUpsell(id, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(upsells).where(and(eq(upsells.id, id), eq(upsells.storeId, storeId)));
}
async function getAllUpsells(storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(upsells).where(eq(upsells.storeId, effectiveStoreId)).orderBy(upsells.sortOrder);
}
async function getActivePromotions(storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const now = /* @__PURE__ */ new Date();
  const all = await db.select().from(promotions).where(and(eq(promotions.storeId, effectiveStoreId), eq(promotions.active, true))).orderBy(desc(promotions.createdAt));
  return all.filter((p) => {
    if (p.endsAt && p.endsAt < now) return false;
    if (p.startsAt && p.startsAt > now) return false;
    return true;
  });
}
async function getAllPromotions(storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(promotions).where(eq(promotions.storeId, effectiveStoreId)).orderBy(desc(promotions.createdAt));
}
async function createPromotion(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(promotions).values(data);
}
async function updatePromotion(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promotions).set(data).where(and(eq(promotions.id, id), eq(promotions.storeId, storeId)));
}
async function deletePromotion(id, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(promotions).where(and(eq(promotions.id, id), eq(promotions.storeId, storeId)));
}
async function getActiveRaffles(storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(raffles).where(and(eq(raffles.storeId, effectiveStoreId), eq(raffles.status, "active"))).orderBy(desc(raffles.createdAt));
}
async function getAllRaffles(storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  return db.select().from(raffles).where(eq(raffles.storeId, effectiveStoreId)).orderBy(desc(raffles.createdAt));
}
async function createRaffle(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(raffles).values(data);
}
async function updateRaffle(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(raffles).set(data).where(and(eq(raffles.id, id), eq(raffles.storeId, storeId)));
}
async function getRaffleEntries(raffleId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const [raffle] = await db.select({ id: raffles.id }).from(raffles).where(and(eq(raffles.id, raffleId), eq(raffles.storeId, storeId))).limit(1);
  if (!raffle) return [];
  return db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));
}
async function enterRaffle(raffleId, userId, userName, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const [raffle] = await db.select({ id: raffles.id }).from(raffles).where(and(eq(raffles.id, raffleId), eq(raffles.storeId, effectiveStoreId), eq(raffles.status, "active"))).limit(1);
  if (!raffle) return false;
  const existing = await db.select().from(raffleEntries).where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.userId, userId))).limit(1);
  if (existing.length > 0) return false;
  await db.insert(raffleEntries).values({ raffleId, userId, userName });
  return true;
}
async function drawRaffleWinner(raffleId, storeId) {
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
    drawDate: /* @__PURE__ */ new Date()
  }).where(eq(raffles.id, raffleId));
  return winner;
}
async function getStoreSetting(key, storeId = 0) {
  return withDbRetry(async (db) => {
    const effectiveStoreId = storeId || (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id || 0;
    const rows = await db.select().from(storeSettings).where(and(eq(storeSettings.storeId, effectiveStoreId), eq(storeSettings.key, key))).limit(1);
    return rows[0]?.value ?? null;
  }).catch(() => null);
}
async function getAllStoreSettings(storeId = 0) {
  return withDbRetry(async (db) => {
    const effectiveStoreId = storeId || (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id || 0;
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.storeId, effectiveStoreId));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }).catch(() => ({}));
}
async function setStoreSetting(key, value, storeId = 0) {
  await withDbRetry(async (db) => {
    const effectiveStoreId = storeId || (await db.select({ id: stores.id }).from(stores).orderBy(desc(stores.isDefault), stores.id).limit(1))[0]?.id || 0;
    await db.insert(storeSettings).values({ storeId: effectiveStoreId, key, value }).onDuplicateKeyUpdate({ set: { value } });
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
async function getClientNotifications(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientNotifications).where(and(
    eq(clientNotifications.userId, userId),
    storeId ? eq(clientNotifications.storeId, storeId) : void 0
  )).orderBy(desc(clientNotifications.createdAt)).limit(50);
}
async function getUnreadNotificationCount(userId, storeId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(clientNotifications).where(and(
    eq(clientNotifications.userId, userId),
    eq(clientNotifications.read, false),
    storeId ? eq(clientNotifications.storeId, storeId) : void 0
  ));
  return result[0]?.count ?? 0;
}
async function markNotificationsRead(userId, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientNotifications).set({ read: true }).where(and(
    eq(clientNotifications.userId, userId),
    storeId ? eq(clientNotifications.storeId, storeId) : void 0
  ));
}
async function createClientNotification(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientNotifications).values(data);
}
async function getTenantScope(storeId) {
  if (!storeId) return { tenantKey: "bonatto", storeId: null };
  const db = await getDb();
  if (!db) return { tenantKey: "bonatto", storeId };
  const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, storeId)).limit(1);
  return { tenantKey: store?.tenantKey ?? "bonatto", storeId };
}
async function getTenantCustomerAccount(userId, storeId) {
  const db = await getDb();
  if (!db) return null;
  const scope = await getTenantScope(storeId);
  let [account] = await db.select().from(tenantCustomerAccounts).where(and(eq(tenantCustomerAccounts.tenantKey, scope.tenantKey), eq(tenantCustomerAccounts.userId, userId))).limit(1);
  if (account) return account;
  const [legacyUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!legacyUser) return null;
  const legacy = scope.tenantKey === "bonatto";
  await db.insert(tenantCustomerAccounts).values({
    tenantKey: scope.tenantKey,
    userId,
    loyaltyPoints: legacy ? legacyUser.loyaltyPoints : 0,
    clubPlan: legacy ? legacyUser.clubPlan : null,
    clubStatus: legacy ? legacyUser.clubStatus : null,
    clubStartDate: legacy ? legacyUser.clubStartDate : null,
    clubNextBillingDate: legacy ? legacyUser.clubNextBillingDate : null,
    clubFreePizzaUsed: legacy ? legacyUser.clubFreePizzaUsed : false,
    clubFreePizzaResetAt: legacy ? legacyUser.clubFreePizzaResetAt : null,
    stripeCustomerId: legacy ? legacyUser.stripeCustomerId : null
  }).onDuplicateKeyUpdate({ set: { userId } });
  [account] = await db.select().from(tenantCustomerAccounts).where(and(eq(tenantCustomerAccounts.tenantKey, scope.tenantKey), eq(tenantCustomerAccounts.userId, userId))).limit(1);
  return account ?? null;
}
async function mirrorBonattoLoyalty(userId, tenantKey, loyaltyPoints) {
  if (tenantKey !== "bonatto") return;
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ loyaltyPoints }).where(eq(users.id, userId));
}
async function getUserLoyaltyPoints(userId, storeId) {
  return (await getTenantCustomerAccount(userId, storeId))?.loyaltyPoints ?? 0;
}
async function addLoyaltyPoints(userId, points, orderId, description, storeId) {
  const db = await getDb();
  if (!db || points === 0) return;
  const account = await getTenantCustomerAccount(userId, storeId);
  if (!account) return;
  const scope = await getTenantScope(storeId);
  await db.update(tenantCustomerAccounts).set({ loyaltyPoints: sql`GREATEST(0, ${tenantCustomerAccounts.loyaltyPoints} + ${points})` }).where(eq(tenantCustomerAccounts.id, account.id));
  const balanceAfter = await getUserLoyaltyPoints(userId, storeId);
  const balanceBefore = Math.max(0, balanceAfter - points);
  await mirrorBonattoLoyalty(userId, scope.tenantKey, balanceAfter);
  await db.insert(loyaltyTransactions).values({
    tenantKey: scope.tenantKey,
    storeId: scope.storeId,
    userId,
    orderId: orderId ?? null,
    type: points > 0 ? "earn" : "manual",
    points,
    description: description ?? `${points > 0 ? "+" : ""}${points} pontos por pedido #${orderId ?? ""}`,
    balanceBefore,
    balanceAfter
  });
}
async function deductLoyaltyPoints(userId, points, orderId, description, storeId) {
  return deductLoyaltyPointsAtomic(userId, points, orderId, description, storeId);
}
async function getLoyaltyHistory(userId, limit = 30, storeId) {
  const db = await getDb();
  if (!db) return [];
  const { tenantKey } = await getTenantScope(storeId);
  return db.select().from(loyaltyTransactions).where(and(eq(loyaltyTransactions.userId, userId), eq(loyaltyTransactions.tenantKey, tenantKey))).orderBy(sql`${loyaltyTransactions.createdAt} DESC`).limit(limit);
}
async function updateUserAvatar(userId, avatarUrl) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
}
async function getUserSpendingHistory(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    month: sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`,
    total: sql`SUM(${orders.total})`,
    count: sql`COUNT(*)`
  }).from(orders).where(and(
    eq(orders.userId, userId),
    eq(orders.status, "delivered"),
    storeId ? eq(orders.storeId, storeId) : void 0
  )).groupBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`).orderBy(sql`DATE_FORMAT(${orders.createdAt}, '%Y-%m')`).limit(12);
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
      ${opts?.storeId ? sql`COALESCE(tca.loyaltyPoints, 0)` : sql`u.loyaltyPoints`} AS loyaltyPoints,
      u.createdAt,
      u.lastSignedIn,
      COUNT(DISTINCT o.id) AS totalOrders,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN CAST(o.total AS DECIMAL(10,2)) ELSE 0 END), 0) AS totalSpent,
      MAX(o.createdAt) AS lastOrderAt,
      COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) AS deliveredOrders,
      GROUP_CONCAT(DISTINCT ct.tag ORDER BY ct.assignedAt DESC SEPARATOR ',') AS tags
    FROM users u
    LEFT JOIN orders o ON o.userId = u.id
    LEFT JOIN customer_tags ct ON ct.userId = u.id ${opts?.storeId ? sql`AND ct.storeId = ${opts.storeId}` : sql``}
    ${opts?.storeId ? sql`LEFT JOIN tenant_customer_accounts tca ON tca.userId = u.id AND tca.tenantKey = (SELECT tenantKey FROM stores WHERE id = ${opts.storeId} LIMIT 1)` : sql``}
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
  const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, ...baseSafeUser } = userRows[0];
  const account = storeId ? await getTenantCustomerAccount(userId, storeId) : null;
  const safeUser = account ? {
    ...baseSafeUser,
    loyaltyPoints: account.loyaltyPoints,
    clubPlan: account.clubPlan,
    clubStatus: account.clubStatus,
    clubStartDate: account.clubStartDate,
    clubNextBillingDate: account.clubNextBillingDate,
    clubFreePizzaUsed: account.clubFreePizzaUsed,
    clubFreePizzaResetAt: account.clubFreePizzaResetAt
  } : baseSafeUser;
  const orderRows = await db.select().from(orders).where(storeId ? and(eq(orders.userId, userId), eq(orders.storeId, storeId)) : eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(20);
  return { user: safeUser, orders: orderRows };
}
async function getCrmCustomersByTag(tag, storeId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.avatarUrl,
      COALESCE(tca.loyaltyPoints, 0) AS loyaltyPoints,
      u.createdAt,
      COUNT(DISTINCT o.id) AS totalOrders,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN CAST(o.total AS DECIMAL(10,2)) ELSE 0 END), 0) AS totalSpent,
      MAX(o.createdAt) AS lastOrderAt,
      GROUP_CONCAT(DISTINCT ct2.tag ORDER BY ct2.assignedAt DESC SEPARATOR ',') AS tags
    FROM users u
    INNER JOIN customer_tags ct ON ct.userId = u.id AND ct.storeId = ${storeId} AND ct.tag = ${tag}
    LEFT JOIN customer_tags ct2 ON ct2.userId = u.id AND ct2.storeId = ${storeId}
    LEFT JOIN orders o ON o.userId = u.id AND o.storeId = ${storeId}
    LEFT JOIN tenant_customer_accounts tca ON tca.userId = u.id AND tca.tenantKey = (SELECT tenantKey FROM stores WHERE id = ${storeId} LIMIT 1)
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY lastOrderAt DESC
  `);
  return rows[0];
}
async function assignTagToCustomer(userId, tag, storeId) {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const existing = await db.execute(sql`
    SELECT id FROM customer_tags WHERE storeId = ${storeId} AND userId = ${userId} AND tag = ${tag} LIMIT 1
  `);
  const rows = existing[0];
  if (rows.length === 0) {
    await db.execute(sql`
      INSERT INTO customer_tags (storeId, userId, tag, assignedAt, updatedAt) VALUES (${storeId}, ${userId}, ${tag}, ${now}, ${now})
    `);
  }
}
async function removeTagFromCustomer(userId, tag, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM customer_tags WHERE storeId = ${storeId} AND userId = ${userId} AND tag = ${tag}`);
}
async function getTagsForCustomer(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT tag, assignedAt FROM customer_tags WHERE storeId = ${storeId} AND userId = ${userId} ORDER BY assignedAt DESC
  `);
  return rows[0];
}
async function getJourneyExecutionsByUser(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT je.*, j.name AS journeyName
    FROM journey_executions je
    LEFT JOIN journeys j ON j.id = je.journeyId
    WHERE je.storeId = ${storeId} AND je.userId = ${userId}
    ORDER BY je.startedAt DESC
    LIMIT 20
  `);
  return rows[0];
}
async function getAbandonedCartsByUser(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT * FROM abandoned_carts WHERE storeId = ${storeId} AND userId = ${userId} ORDER BY createdAt DESC LIMIT 10
  `);
  return rows[0];
}
async function getCrmStats(storeId) {
  const db = await getDb();
  if (!db) return null;
  const rows = storeId ? await db.execute(sql`
      SELECT
        (SELECT COUNT(DISTINCT o.userId) FROM orders o WHERE o.storeId = ${storeId} AND o.userId IS NOT NULL) AS totalCustomers,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.storeId = ${storeId} AND ct.tag = 'novo') AS tagNovo,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.storeId = ${storeId} AND ct.tag = 'recorrente') AS tagRecorrente,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.storeId = ${storeId} AND ct.tag = 'indeciso') AS tagIndeciso,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.storeId = ${storeId} AND ct.tag = 'inativo_15') AS tagInativo15,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.storeId = ${storeId} AND ct.tag = 'inativo_30') AS tagInativo30,
        (SELECT COUNT(*) FROM customer_tags ct WHERE ct.storeId = ${storeId} AND ct.tag = 'inativo_60') AS tagInativo60,
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
  const storeId = await getEffectiveStoreId(db, opts?.storeId);
  const conditions = [eq(notificationTemplates.storeId, storeId)];
  if (opts?.event) conditions.push(eq(notificationTemplates.event, opts.event));
  if (opts?.channel) conditions.push(eq(notificationTemplates.channel, opts.channel));
  return db.select().from(notificationTemplates).where(and(...conditions)).orderBy(notificationTemplates.event, notificationTemplates.channel);
}
async function createNotificationTemplate(data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(notificationTemplates).values(data);
  const rows = result;
  return rows[0].insertId;
}
async function updateNotificationTemplate(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notificationTemplates).set(data).where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.storeId, storeId)));
}
async function deleteNotificationTemplate(id, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(notificationTemplates).where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.storeId, storeId)));
}
async function pickRandomTemplate(event, channel, requestedStoreId) {
  const db = await getDb();
  if (!db) return null;
  const storeId = await getEffectiveStoreId(db, requestedStoreId);
  const rows = await db.execute(sql`
    SELECT title, body FROM notification_templates
    WHERE storeId = ${storeId}
      AND event = ${event}
      AND (channel = ${channel} OR channel = 'both')
      AND isActive = 1
    ORDER BY RAND()
    LIMIT 1
  `);
  const result = rows[0];
  return result[0] ?? null;
}
async function seedNotificationTemplates(requestedStoreId) {
  const db = await getDb();
  if (!db) return;
  const storeId = await getEffectiveStoreId(db, requestedStoreId);
  const existing = await db.select({ id: notificationTemplates.id }).from(notificationTemplates).where(eq(notificationTemplates.storeId, storeId)).limit(1);
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
  await db.insert(notificationTemplates).values(templates.map((template) => ({ ...template, storeId })));
}
async function getAllDeliveryZones(activeOnly = false, storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  if (activeOnly) {
    return db.select().from(deliveryZones).where(and(eq(deliveryZones.storeId, effectiveStoreId), eq(deliveryZones.isActive, true))).orderBy(deliveryZones.neighborhood);
  }
  return db.select().from(deliveryZones).where(eq(deliveryZones.storeId, effectiveStoreId)).orderBy(deliveryZones.neighborhood);
}
async function getDeliveryZoneByNeighborhood(neighborhood, storeId) {
  const db = await getDb();
  if (!db) return null;
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE storeId = ${effectiveStoreId} AND LOWER(neighborhood) = LOWER(${neighborhood}) AND isActive = 1 LIMIT 1`
  );
  const list = rows[0];
  if (!list || list.length === 0) return null;
  const r = list[0];
  return {
    id: Number(r.id),
    storeId: Number(r.storeId),
    neighborhood: String(r.neighborhood),
    city: String(r.city ?? ""),
    deliveryFee: String(r.deliveryFee ?? "0.00"),
    estimatedMinutes: Number(r.estimatedMinutes ?? 45),
    isActive: Boolean(r.isActive)
  };
}
async function searchDeliveryZones(query, storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const like2 = `%${query}%`;
  const rows = await db.execute(
    sql`SELECT * FROM delivery_zones WHERE storeId = ${effectiveStoreId} AND LOWER(neighborhood) LIKE LOWER(${like2}) AND isActive = 1 ORDER BY neighborhood LIMIT 10`
  );
  const list = rows[0];
  return (list ?? []).map((r) => ({
    id: Number(r.id),
    storeId: Number(r.storeId),
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
    storeId: data.storeId,
    neighborhood: data.neighborhood.trim(),
    city: data.city?.trim() ?? "",
    deliveryFee: data.deliveryFee,
    estimatedMinutes: data.estimatedMinutes ?? 45,
    isActive: true
  });
  return result.insertId;
}
async function updateDeliveryZone(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deliveryZones).set(data).where(and(eq(deliveryZones.id, id), eq(deliveryZones.storeId, storeId)));
}
async function deleteDeliveryZone(id, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(deliveryZones).where(and(eq(deliveryZones.id, id), eq(deliveryZones.storeId, storeId)));
}
async function getMenuSlides(activeOnly = true, storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const conditions = [eq(menuSlides.storeId, effectiveStoreId)];
  if (activeOnly) conditions.push(eq(menuSlides.isActive, true));
  const rows = await db.select().from(menuSlides).where(and(...conditions)).orderBy(menuSlides.sortOrder, menuSlides.id);
  return rows;
}
async function createMenuSlide(data) {
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
    isActive: true
  });
  const id = result.insertId;
  const [row] = await db.select().from(menuSlides).where(eq(menuSlides.id, id));
  return row;
}
async function updateMenuSlide(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(menuSlides).set(data).where(and(eq(menuSlides.id, id), eq(menuSlides.storeId, storeId)));
  const [row] = await db.select().from(menuSlides).where(and(eq(menuSlides.id, id), eq(menuSlides.storeId, storeId)));
  return row;
}
async function deleteMenuSlide(id, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(menuSlides).where(and(eq(menuSlides.id, id), eq(menuSlides.storeId, storeId)));
  return { success: true };
}
async function seedMenuSlides(storeId) {
  const db = await getDb();
  if (!db) return { seeded: false, count: 0 };
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const existing = await db.select().from(menuSlides).where(eq(menuSlides.storeId, effectiveStoreId));
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
    await db.insert(menuSlides).values({ ...slide, storeId: effectiveStoreId, isActive: true });
  }
  return { seeded: true, count: slides.length };
}
async function listCustomTags(storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customTags).where(eq(customTags.storeId, storeId)).orderBy(customTags.name);
}
async function createCustomTag(data) {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(customTags).values({
    storeId: data.storeId,
    name: data.name.trim().toLowerCase().replace(/\s+/g, "_"),
    color: data.color,
    description: data.description ?? null,
    createdAt: /* @__PURE__ */ new Date()
  });
  return Number(result[0].insertId);
}
async function updateCustomTag(id, storeId, data) {
  const db = await getDb();
  if (!db) return;
  const updates = {};
  if (data.name) updates.name = data.name.trim().toLowerCase().replace(/\s+/g, "_");
  if (data.color) updates.color = data.color;
  if (data.description !== void 0) updates.description = data.description;
  await db.update(customTags).set(updates).where(and(eq(customTags.id, id), eq(customTags.storeId, storeId)));
}
async function deleteCustomTag(id, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags).where(and(eq(customCustomerTags.tagId, id), eq(customCustomerTags.storeId, storeId)));
  await db.delete(customTags).where(and(eq(customTags.id, id), eq(customTags.storeId, storeId)));
}
async function assignCustomTagToCustomer(userId, tagId, storeId) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(customCustomerTags).where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId))).limit(1);
  if (existing.length === 0) {
    await db.insert(customCustomerTags).values({ storeId, userId, tagId, assignedAt: /* @__PURE__ */ new Date() });
  }
}
async function removeCustomTagFromCustomer(userId, tagId, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customCustomerTags).where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.userId, userId), eq(customCustomerTags.tagId, tagId)));
}
async function getCustomTagsForCustomer(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: customTags.id, storeId: customTags.storeId, name: customTags.name, color: customTags.color, description: customTags.description, createdAt: customTags.createdAt, assignedAt: customCustomerTags.assignedAt }).from(customCustomerTags).innerJoin(customTags, eq(customCustomerTags.tagId, customTags.id)).where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.userId, userId))).orderBy(customCustomerTags.assignedAt);
  return rows;
}
async function getCustomersByCustomTagName(tagName, storeId) {
  const db = await getDb();
  if (!db) return [];
  const tag = await db.select().from(customTags).where(and(eq(customTags.storeId, storeId), eq(customTags.name, tagName))).limit(1);
  if (!tag[0]) return [];
  const rows = await db.select({ userId: customCustomerTags.userId }).from(customCustomerTags).where(and(eq(customCustomerTags.storeId, storeId), eq(customCustomerTags.tagId, tag[0].id)));
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
async function listScheduledNotifications(requestedStoreId) {
  const db = await getDb();
  if (!db) return [];
  const storeId = await getEffectiveStoreId(db, requestedStoreId);
  return db.select().from(scheduledNotifications).where(eq(scheduledNotifications.storeId, storeId)).orderBy(desc(scheduledNotifications.scheduledAt));
}
async function cancelScheduledNotification(id, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledNotifications).set({ status: "cancelled" }).where(and(eq(scheduledNotifications.id, id), eq(scheduledNotifications.storeId, storeId)));
}
async function deleteScheduledNotification(id, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(scheduledNotifications).where(and(eq(scheduledNotifications.id, id), eq(scheduledNotifications.storeId, storeId)));
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
async function getCarouselImages(activeOnly = true, storeId) {
  const db = await getDb();
  if (!db) return [];
  const effectiveStoreId = await getEffectiveStoreId(db, storeId);
  const conditions = [eq(carouselImages.storeId, effectiveStoreId)];
  if (activeOnly) conditions.push(eq(carouselImages.active, true));
  return db.select().from(carouselImages).where(and(...conditions)).orderBy(carouselImages.sortOrder, carouselImages.id);
}
async function createCarouselImage(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(carouselImages).values({
    storeId: data.storeId,
    imageUrl: data.imageUrl,
    title: data.title ?? null,
    sortOrder: data.sortOrder ?? 0,
    active: true
  });
}
async function updateCarouselImage(id, storeId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(carouselImages).set(data).where(and(eq(carouselImages.id, id), eq(carouselImages.storeId, storeId)));
}
async function deleteCarouselImage(id, storeId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(carouselImages).where(and(eq(carouselImages.id, id), eq(carouselImages.storeId, storeId)));
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
async function listClientAlerts(userId, storeId) {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const alerts = await db.select().from(clientAlerts).where(
    and(
      eq(clientAlerts.active, true),
      eq(clientAlerts.storeId, storeId),
      or(isNull(clientAlerts.expiresAt), gt(clientAlerts.expiresAt, now))
    )
  ).orderBy(desc(clientAlerts.createdAt)).limit(20);
  if (alerts.length === 0) return [];
  const reads = await db.select({ alertId: clientAlertReads.alertId }).from(clientAlertReads).where(eq(clientAlertReads.userId, userId));
  const readSet = new Set(reads.map((r) => r.alertId));
  return alerts.map((a) => ({ ...a, read: readSet.has(a.id) }));
}
async function dismissClientAlert(alertId, userId, storeId) {
  const db = await getDb();
  if (!db) return;
  const [alert] = await db.select({ id: clientAlerts.id }).from(clientAlerts).where(and(eq(clientAlerts.id, alertId), eq(clientAlerts.storeId, storeId))).limit(1);
  if (!alert) return;
  try {
    await db.insert(clientAlertReads).values({ alertId, userId });
  } catch {
  }
}
async function countUnreadClientAlerts(userId, storeId) {
  const db = await getDb();
  if (!db) return 0;
  const now = /* @__PURE__ */ new Date();
  const alerts = await db.select({ id: clientAlerts.id }).from(clientAlerts).where(
    and(
      eq(clientAlerts.active, true),
      eq(clientAlerts.storeId, storeId),
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
async function creditLoyaltyForOrderIdempotent(orderId, userId, points, description, storeId) {
  if (points <= 0) return false;
  const db = await getDb();
  if (!db) return false;
  const scope = await getTenantScope(storeId);
  try {
    await db.insert(loyaltyOrderCredits).values({
      tenantKey: scope.tenantKey,
      storeId: scope.storeId,
      orderId,
      userId,
      points
    });
  } catch (err) {
    const msg = err?.message ?? "";
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) return false;
    throw err;
  }
  await addLoyaltyPoints(userId, points, orderId, description ?? `+${points} pontos pelo pedido #${orderId}`, storeId);
  return true;
}
async function deductLoyaltyPointsAtomic(userId, points, orderId, description, storeId) {
  if (points <= 0) return { ok: true, newBalance: await getUserLoyaltyPoints(userId, storeId) };
  const db = await getDb();
  if (!db) return { ok: false, newBalance: 0 };
  const account = await getTenantCustomerAccount(userId, storeId);
  if (!account) return { ok: false, newBalance: 0 };
  const scope = await getTenantScope(storeId);
  const result = await db.update(tenantCustomerAccounts).set({ loyaltyPoints: sql`${tenantCustomerAccounts.loyaltyPoints} - ${points}` }).where(and(eq(tenantCustomerAccounts.id, account.id), gte(tenantCustomerAccounts.loyaltyPoints, points)));
  const affected = result?.rowsAffected ?? result?.[0]?.affectedRows ?? 0;
  if (!affected) return { ok: false, newBalance: await getUserLoyaltyPoints(userId, storeId) };
  const newBalance = await getUserLoyaltyPoints(userId, storeId);
  await mirrorBonattoLoyalty(userId, scope.tenantKey, newBalance);
  await db.insert(loyaltyTransactions).values({
    tenantKey: scope.tenantKey,
    storeId: scope.storeId,
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
  const scope = await getTenantScope(order.storeId);
  const existing = await db.select().from(loyaltyTransactions).where(and(
    eq(loyaltyTransactions.orderId, orderId),
    eq(loyaltyTransactions.tenantKey, scope.tenantKey)
  ));
  if (existing.some((transaction) => transaction.description?.startsWith("refund:"))) return 0;
  await addLoyaltyPoints(
    order.userId,
    pointsUsed,
    orderId,
    `refund: estorno de pontos por cancelamento do pedido #${orderId}`,
    order.storeId
  );
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
    init_runtimeSchema();
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
    storeId: payload.storeId ?? null,
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
      storeId: payload.storeId ?? null,
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
  if (userIds && userIds.length === 0) return { sent: 0, failed: 0 };
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
function hasManusStorageConfig() {
  return Boolean(
    process.env.BUILT_IN_FORGE_API_URL?.trim() && process.env.BUILT_IN_FORGE_API_KEY?.trim()
  );
}
function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}
function resolveStorageProvider() {
  const explicit = (process.env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "local") return "local";
  if (explicit === "vercel_blob" || explicit === "vercel-blob") return "vercel_blob";
  if (explicit === "s3" || explicit === "r2" || explicit === "minio" || explicit === "manus") {
    return explicit;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "vercel_blob";
  if (hasManusStorageConfig()) return "manus";
  if (!isVercelRuntime()) return "local";
  return "manus";
}
async function putLocal(relKey, data, _contentType) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const crypto7 = await import("node:crypto");
  const normalized = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) {
    throw new Error("Invalid local storage path");
  }
  const parsed = path.posix.parse(normalized);
  const key = path.posix.join(
    parsed.dir,
    `${parsed.name}-${crypto7.randomUUID().slice(0, 8)}${parsed.ext}`
  );
  const root = path.resolve(process.cwd(), ".local-uploads");
  const filePath = path.resolve(root, ...key.split("/"));
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid local storage path");
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await writeFile(filePath, body);
  return { key, url: `/uploads/${key}`, provider: "local" };
}
async function getLocal(relKey) {
  const key = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.split("/").includes("..")) {
    throw new Error("Invalid local storage path");
  }
  return { key, url: `/uploads/${key}`, provider: "local" };
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
  const body = typeof data === "string" ? data : Buffer.isBuffer(data) ? data : Buffer.from(data);
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
    case "local":
      return putLocal(relKey, data, contentType);
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
    case "local":
      return getLocal(relKey);
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
async function refreshCustomerTags(storeId) {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const newInactivityTriggers = [];
  const userOrderStats = await db.execute(sql2`
    SELECT
      u.id AS userId,
      o.storeId AS storeId,
      COUNT(o.id) AS totalOrders,
      MAX(o.createdAt) AS lastOrderAt,
      MIN(o.createdAt) AS firstOrderAt,
      CASE
        WHEN COUNT(o.id) > 1
        THEN DATEDIFF(MAX(o.createdAt), MIN(o.createdAt)) / (COUNT(o.id) - 1)
        ELSE NULL
      END AS avgDaysBetween
    FROM users u
    INNER JOIN orders o ON o.userId = u.id AND o.status = 'delivered'
    WHERE u.role = 'user'
      ${storeId ? sql2`AND o.storeId = ${storeId}` : sql2``}
    GROUP BY u.id, o.storeId
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
      const existing = await db.select().from(customerTags).where(and3(eq3(customerTags.storeId, row.storeId), eq3(customerTags.userId, row.userId), eq3(customerTags.tag, tag))).limit(1);
      if (existing.length === 0) {
        await db.insert(customerTags).values({
          storeId: row.storeId,
          userId: row.userId,
          tag,
          assignedAt: now,
          updatedAt: now
        });
      } else {
        await db.update(customerTags).set({ updatedAt: now }).where(and3(eq3(customerTags.storeId, row.storeId), eq3(customerTags.userId, row.userId), eq3(customerTags.tag, tag)));
      }
    }
    const allTags = ["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"];
    const toRemove = allTags.filter((t2) => !tags.includes(t2));
    if (toRemove.length > 0) {
      await db.delete(customerTags).where(
        and3(
          eq3(customerTags.userId, row.userId),
          eq3(customerTags.storeId, row.storeId),
          inArray3(customerTags.tag, toRemove)
        )
      );
    }
    for (const tag of tags) {
      if (tag === "inativo_15" || tag === "inativo_30" || tag === "inativo_60") {
        const triggerName = `tag_${tag}`;
        const wasAlreadyTagged = await db.select().from(customerTags).where(and3(eq3(customerTags.storeId, row.storeId), eq3(customerTags.userId, row.userId), eq3(customerTags.tag, tag))).limit(1);
        if (!wasAlreadyTagged.length) {
          newInactivityTriggers.push({ trigger: triggerName, userId: row.userId, storeId: row.storeId });
        }
      }
    }
    if (row.lastOrderAt) {
      const daysSinceLast2 = Math.floor(
        (now.getTime() - new Date(row.lastOrderAt).getTime()) / (1e3 * 60 * 60 * 24)
      );
      const customJourneys = await db.select().from(journeys).where(and3(
        eq3(journeys.storeId, row.storeId),
        eq3(journeys.trigger, "tag_inativo_custom"),
        eq3(journeys.status, "active")
      ));
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
  for (const { trigger, userId, storeId: triggerStoreId } of newInactivityTriggers) {
    fireJourneyTrigger(trigger, userId, void 0, triggerStoreId).catch(
      (err) => console.error(`[Automation] inactivity trigger ${trigger} failed for user ${userId}:`, err)
    );
  }
}
async function registerAbandonedCart(data) {
  const db = await getDb();
  if (!db) return -1;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1e3);
  const existing = await db.select().from(abandonedCarts).where(and3(
    eq3(abandonedCarts.storeId, data.storeId),
    eq3(abandonedCarts.userId, data.userId),
    eq3(abandonedCarts.status, "pending")
  )).limit(1);
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
    storeId: data.storeId,
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
async function markCartRecovered(userId, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.update(abandonedCarts).set({ status: "recovered", recoveredAt: /* @__PURE__ */ new Date() }).where(and3(eq3(abandonedCarts.storeId, storeId), eq3(abandonedCarts.userId, userId), eq3(abandonedCarts.status, "pending")));
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
    storeId: journey[0].storeId,
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
async function processJourneyExecutions(storeId) {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const pending = await db.select().from(journeyExecutions).where(
    and3(
      eq3(journeyExecutions.status, "running"),
      storeId ? eq3(journeyExecutions.storeId, storeId) : void 0,
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
          eq3(orders.storeId, exec.storeId),
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
          const existingCustom = await db.select().from(customCustomerTags).where(and3(eq3(customCustomerTags.storeId, exec.storeId), eq3(customCustomerTags.userId, exec.userId), eq3(customCustomerTags.tagId, tagIdNum))).limit(1);
          if (!existingCustom.length) {
            await db.insert(customCustomerTags).values({ storeId: exec.storeId, userId: exec.userId, tagId: tagIdNum, assignedAt: /* @__PURE__ */ new Date() });
          }
          log(`Tag personalizada adicionada: id=${tagIdNum}`);
        } else {
          const tag = step.tag;
          const existing = await db.select().from(customerTags).where(and3(eq3(customerTags.storeId, exec.storeId), eq3(customerTags.userId, exec.userId), eq3(customerTags.tag, tag))).limit(1);
          if (!existing.length) {
            await db.insert(customerTags).values({ storeId: exec.storeId, userId: exec.userId, tag, assignedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() });
          }
          log(`Tag do sistema adicionada: ${tag}`);
        }
      }
      currentStepIdx++;
    } else if (step.type === "remove_tag") {
      if (step.tag) {
        const tagIdNum = Number(step.tag);
        if (!isNaN(tagIdNum) && tagIdNum > 0) {
          await db.delete(customCustomerTags).where(and3(eq3(customCustomerTags.storeId, exec.storeId), eq3(customCustomerTags.userId, exec.userId), eq3(customCustomerTags.tagId, tagIdNum)));
          log(`Tag personalizada removida: id=${tagIdNum}`);
        } else {
          await db.delete(customerTags).where(and3(eq3(customerTags.storeId, exec.storeId), eq3(customerTags.userId, exec.userId), eq3(customerTags.tag, step.tag)));
          log(`Tag do sistema removida: ${step.tag}`);
        }
      }
      currentStepIdx++;
    } else if (step.type === "condition") {
      let conditionMet = false;
      if (step.condition === "purchased_since_start") {
        const recentOrder = await db.select().from(orders).where(
          and3(
            eq3(orders.storeId, exec.storeId),
            eq3(orders.userId, exec.userId),
            gte2(orders.createdAt, exec.startedAt),
            inArray3(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"])
          )
        ).limit(1);
        conditionMet = recentOrder.length > 0;
      } else if (step.condition === "has_tag" && step.conditionTag) {
        const tagRow = await db.select().from(customerTags).where(and3(eq3(customerTags.storeId, exec.storeId), eq3(customerTags.userId, exec.userId), eq3(customerTags.tag, step.conditionTag))).limit(1);
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
        storeId: exec.storeId,
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
        storeId: exec.storeId,
        userId: exec.userId,
        title: "\u{1F381} Cupom exclusivo para voc\xEA!",
        message: `Use o c\xF3digo ${code} e ganhe ${discountLabel}${validityLabel}. V\xE1lido no pr\xF3ximo pedido.`,
        type: "promo",
        read: false
      });
      await sendPushToUser(exec.userId, {
        storeId: exec.storeId,
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
        const description = step.loyaltyDescription ?? `Automa\xE7\xE3o: ${points > 0 ? "+" : ""}${points} pontos`;
        await addLoyaltyPoints(exec.userId, points, void 0, description, exec.storeId);
        const newBalance = await getUserLoyaltyPoints(exec.userId, exec.storeId);
        const pointsLabel = points > 0 ? `+${points} pontos adicionados` : `${points} pontos removidos`;
        await db.insert(clientNotifications).values({
          storeId: exec.storeId,
          userId: exec.userId,
          title: points > 0 ? "\u2B50 Pontos adicionados!" : "\u{1F4C9} Pontos removidos",
          message: `${pointsLabel}. Seu saldo atual \xE9 de ${newBalance} pontos. ${description}`,
          type: "system",
          read: false
        });
        await sendPushToUser(exec.userId, {
          storeId: exec.storeId,
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
        storeId: exec.storeId,
        userId: exec.userId,
        title: `${alertIcon} ${alertTitle}`,
        message: alertMsg,
        type: "system",
        read: false
      });
      if (alertMsg) {
        await sendPushToUser(exec.userId, {
          storeId: exec.storeId,
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
            storeId: exec.storeId,
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
        await db.update(journeys).set({ status: "paused", updatedAt: /* @__PURE__ */ new Date() }).where(and3(eq3(journeys.id, step.pauseJourneyId), eq3(journeys.storeId, exec.storeId), eq3(journeys.status, "active")));
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
async function getAllCustomerTagsWithUsers(storeId) {
  const db = await getDb();
  if (!db) return [[], []];
  return db.execute(sql2`
    SELECT ct.userId, ct.tag, ct.assignedAt, u.name, u.email, u.phone
    FROM customer_tags ct
    JOIN users u ON u.id = ct.userId
    WHERE ct.storeId = ${storeId}
    ORDER BY ct.assignedAt DESC
  `);
}
async function listJourneys(storeId) {
  const db = await getDb();
  if (!db) return [];
  const list = await db.select().from(journeys).where(eq3(journeys.storeId, storeId)).orderBy(journeys.createdAt);
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
async function getJourneyById(id, storeId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(journeys).where(and3(eq3(journeys.id, id), storeId ? eq3(journeys.storeId, storeId) : void 0)).limit(1);
  return rows[0] ?? null;
}
async function createJourney(data) {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(journeys).values({
    storeId: data.storeId,
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
async function updateJourney(id, data, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.update(journeys).set({
    ...data,
    steps: data.steps ? JSON.stringify(data.steps) : void 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(and3(eq3(journeys.id, id), storeId ? eq3(journeys.storeId, storeId) : void 0));
}
async function deleteJourney(id, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(journeyExecutions).where(and3(eq3(journeyExecutions.journeyId, id), storeId ? eq3(journeyExecutions.storeId, storeId) : void 0));
  await db.delete(journeys).where(and3(eq3(journeys.id, id), storeId ? eq3(journeys.storeId, storeId) : void 0));
}
async function duplicateJourney(id, storeId) {
  const db = await getDb();
  if (!db) return -1;
  const original = await db.select().from(journeys).where(and3(eq3(journeys.id, id), storeId ? eq3(journeys.storeId, storeId) : void 0)).limit(1);
  if (!original[0]) return -1;
  const result = await db.insert(journeys).values({
    storeId: original[0].storeId,
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
async function listExecutions(journeyId, storeId) {
  const db = await getDb();
  if (!db) return [];
  if (journeyId) {
    return db.select().from(journeyExecutions).where(and3(eq3(journeyExecutions.journeyId, journeyId), storeId ? eq3(journeyExecutions.storeId, storeId) : void 0)).orderBy(journeyExecutions.startedAt);
  }
  return db.select().from(journeyExecutions).where(storeId ? eq3(journeyExecutions.storeId, storeId) : void 0).orderBy(journeyExecutions.startedAt);
}
async function cancelExecution(id, storeId) {
  const db = await getDb();
  if (!db) return;
  await db.update(journeyExecutions).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date() }).where(and3(eq3(journeyExecutions.id, id), storeId ? eq3(journeyExecutions.storeId, storeId) : void 0));
}
async function listAbandonedCarts(status, storeId) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(abandonedCarts).where(and3(eq3(abandonedCarts.status, status), eq3(abandonedCarts.storeId, storeId))).orderBy(abandonedCarts.createdAt);
  }
  return db.select().from(abandonedCarts).where(eq3(abandonedCarts.storeId, storeId)).orderBy(abandonedCarts.createdAt);
}
async function fireJourneyTrigger(trigger, userId, phone, storeId) {
  if (!storeId) return;
  const activeJourneys = await getActiveJourneysForTrigger(trigger, storeId);
  for (const journey of activeJourneys) {
    try {
      await startJourneyExecution(journey.id, userId, phone);
    } catch (err) {
      console.error(`[Automation] fireJourneyTrigger failed for journey ${journey.id}:`, err);
    }
  }
}
async function getActiveJourneysForTrigger(trigger, storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journeys).where(and3(eq3(journeys.trigger, trigger), eq3(journeys.status, "active"), eq3(journeys.storeId, storeId)));
}
async function logAutomationEvent(db, params) {
  if (!db) return;
  await db.insert(automationEvents).values({
    storeId: params.storeId,
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
async function generateRecoveryCoupon(db, storeId, userId, discountPercent, suffix) {
  if (!db) return "VOLTA10";
  const code = `VOLTA${discountPercent}-${suffix.toUpperCase().replace(/\W/g, "").slice(0, 6)}`;
  const existing = await db.select().from(coupons).where(and3(eq3(coupons.storeId, storeId), eq3(coupons.code, code))).limit(1);
  if (existing.length > 0) return code;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1e3);
  await db.insert(coupons).values({
    storeId,
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
    const taggedUsers = await db.select({ storeId: customerTags.storeId, userId: customerTags.userId, assignedAt: customerTags.assignedAt }).from(customerTags).where(eq3(customerTags.tag, segment.tag)).limit(30);
    for (const tagged of taggedUsers) {
      const recentlySent = await db.select({ id: automationEvents.id }).from(automationEvents).where(
        and3(
          eq3(automationEvents.type, segment.type),
          eq3(automationEvents.storeId, tagged.storeId),
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
      const couponCode = await generateRecoveryCoupon(db, tagged.storeId, user.id, segment.discount, suffix);
      const name = user.name ?? "cliente";
      const tagToEvent = {
        inativo_15: "reactivation_15",
        inativo_30: "reactivation_30",
        inativo_60: "reactivation_60"
      };
      const templateEvent = tagToEvent[segment.tag] ?? "reactivation_15";
      const interpolate = (t2) => t2.replace(/\{\{clientName\}\}/g, name).replace(/\{\{coupon\}\}/g, couponCode);
      const waTpl = await pickRandomTemplate(templateEvent, "whatsapp", tagged.storeId);
      const copy = REACTIVATION_COPY[segment.tag];
      const waMsg = waTpl ? interpolate(waTpl.body) : copy ? copy.whatsapp(name, couponCode) : "";
      if (waMsg) {
        await sendWhatsApp(phone, waMsg);
        await logAutomationEvent(db, { storeId: tagged.storeId, type: segment.type, userId: user.id, channel: "whatsapp", step: 1, status: "sent", metadata: { couponCode, tag: segment.tag } });
      }
      const pushTpl = await pickRandomTemplate(templateEvent, "push", tagged.storeId);
      const pushTitle = pushTpl ? interpolate(pushTpl.title) : copy?.push.title ?? "\u{1F355} Sentimos sua falta!";
      const pushBody = pushTpl ? interpolate(pushTpl.body) : copy?.push.body ?? "Temos uma oferta especial para voc\xEA!";
      await sendPushToUser(user.id, { storeId: tagged.storeId, title: pushTitle, body: pushBody, url: "/" });
      await logAutomationEvent(db, { storeId: tagged.storeId, type: segment.type, userId: user.id, channel: "push", step: 1, status: "sent", metadata: { couponCode, tag: segment.tag } });
      await fireJourneyTrigger(segment.tag, user.id, phone, tagged.storeId);
      console.log(`[Reactivation] Enviado para userId=${user.id} (${segment.tag}) cupom=${couponCode}`);
    }
  }
}
async function markConversions(userId, orderId, storeId) {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  await markCartRecovered(userId, storeId);
  await db.update(journeyExecutions).set({ convertedAt: now, conversionOrderId: orderId, status: "completed", completedAt: now }).where(and3(eq3(journeyExecutions.storeId, storeId), eq3(journeyExecutions.userId, userId), eq3(journeyExecutions.status, "running")));
  await db.insert(automationEvents).values({
    storeId,
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
import { TRPCError as TRPCError12 } from "@trpc/server";
import { eq as eq19, gte as gte4, desc as desc7, inArray as inArray11, and as and16, isNotNull as isNotNull2, lte as lte3 } from "drizzle-orm";

// server/routers/club.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { and as and6, eq as eq7, isNotNull } from "drizzle-orm";
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
var platformAdminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !isPlatformAdmin(ctx.user.role)) {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        isPlatformAdmin: true
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
async function getClubConfig(storeId) {
  const stored = await getStoreSetting(CLUB_CONFIG_KEY, storeId);
  if (!stored) return DEFAULT_CLUB_CONFIG;
  try {
    return normalizeConfig(JSON.parse(stored));
  } catch {
    return DEFAULT_CLUB_CONFIG;
  }
}
async function saveClubConfig(config, storeId) {
  const normalized = normalizeConfig(config);
  await setStoreSetting(CLUB_CONFIG_KEY, JSON.stringify(normalized), storeId);
}
async function getClubPlanConfig(planId, storeId) {
  if (planId !== "bonattao" && planId !== "basico") return null;
  const config = await getClubConfig(storeId);
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
async function getPaymentSettingsAdmin(storeId) {
  const settings = await getAllStoreSettings(storeId);
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
async function getPaymentSettingsPublic(storeId) {
  const { config, runtime, availability } = await getPaymentSettingsAdmin(storeId);
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
async function savePaymentSettings(input, storeId) {
  await setStoreSetting(PAYMENT_CONFIG_KEY, JSON.stringify(input.config), storeId);
  await setStoreSetting("pixKey", input.pixKey.trim(), storeId);
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

// server/whiteLabel.ts
init_schema();
import { and as and4, desc as desc2, eq as eq5, or as or3 } from "drizzle-orm";

// shared/whiteLabel.ts
var WHITE_LABEL_ADMIN_TABS = [
  "dashboard",
  "orders",
  "menu",
  "club",
  "inventory",
  "staff",
  "dining",
  "coupons",
  "reports",
  "network",
  "distribution",
  "promotions",
  "raffles",
  "upsells",
  "users",
  "drivers",
  "marketplaces",
  "payments",
  "settings",
  "stores",
  "recovery",
  "platform"
];
var WHITE_LABEL_PAGE_KEYS = [
  "home",
  "menu",
  "checkout",
  "orders",
  "profile",
  "club",
  "tracking",
  "driver",
  "waiter"
];
var allAdminTabs = Object.fromEntries(WHITE_LABEL_ADMIN_TABS.map((tab) => [tab, true]));
var BONATTO_FEATURE_FLAGS = {
  adminTabs: allAdminTabs,
  crm: true,
  automations: true,
  notifications: true,
  deliveryZones: true,
  salesDashboard: true,
  waiterApp: true,
  driverApp: true,
  loyalty: true,
  club: true,
  inventory: true,
  diningRoom: true,
  marketplaces: true,
  auditTrail: true,
  healthPanel: true,
  globalSearch: true
};
var ESSENTIAL_FEATURE_FLAGS = {
  adminTabs: {
    dashboard: true,
    orders: true,
    menu: true,
    users: true,
    settings: true
  },
  crm: false,
  automations: false,
  notifications: true,
  deliveryZones: true,
  salesDashboard: false,
  waiterApp: false,
  driverApp: true,
  loyalty: false,
  club: false,
  inventory: false,
  diningRoom: false,
  marketplaces: false,
  auditTrail: true,
  healthPanel: true,
  globalSearch: false
};
function enforceTenantSafeFeatures(features) {
  return features;
}
var DEFAULT_PROVIDER_CONFIG = {
  auth: { google: true, apple: false, facebook: false, instagram: false },
  maps: { provider: "openstreetmap" },
  push: { provider: "vapid", enabled: true },
  email: { provider: "none", enabled: false },
  payments: { pix: true, card: false, cash: true, provider: "manual" },
  marketplaces: { ifood: false, aiqfome: false, rappi: false, deliveryMuch: false }
};
var DEFAULT_PAGE_CONFIG = {
  home: { enabled: true, title: "Pe\xE7a online", description: "Seu pedido favorito em poucos toques.", heroImage: "" },
  menu: { enabled: true, title: "Card\xE1pio", description: "Escolha seus produtos e monte o pedido.", heroImage: "" },
  checkout: { enabled: true, title: "Finalizar pedido", description: "Confirme entrega e pagamento.", heroImage: "" },
  orders: { enabled: true, title: "Meus pedidos", description: "Acompanhe seus pedidos.", heroImage: "" },
  profile: { enabled: true, title: "Minha conta", description: "Dados, endere\xE7os e prefer\xEAncias.", heroImage: "" },
  club: { enabled: false, title: "Clube", description: "Benef\xEDcios para clientes recorrentes.", heroImage: "" },
  tracking: { enabled: true, title: "Rastrear pedido", description: "Acompanhe cada etapa da entrega.", heroImage: "" },
  driver: { enabled: true, title: "Entregas", description: "Opera\xE7\xE3o dos entregadores.", heroImage: "" },
  waiter: { enabled: false, title: "Sal\xE3o", description: "Atendimento de mesas e comandas.", heroImage: "" }
};
var DEFAULT_CONTACT_CONFIG = {
  supportEmail: "",
  supportPhone: "",
  whatsapp: "",
  instagram: ""
};
function mergeWhiteLabelFeatures(value, bonatto = false) {
  const base = bonatto ? BONATTO_FEATURE_FLAGS : ESSENTIAL_FEATURE_FLAGS;
  return {
    ...base,
    ...value ?? {},
    adminTabs: { ...base.adminTabs, ...value?.adminTabs ?? {} }
  };
}
function mergeWhiteLabelProviders(value) {
  return {
    ...DEFAULT_PROVIDER_CONFIG,
    ...value ?? {},
    auth: { ...DEFAULT_PROVIDER_CONFIG.auth, ...value?.auth ?? {} },
    maps: { ...DEFAULT_PROVIDER_CONFIG.maps, ...value?.maps ?? {} },
    push: { ...DEFAULT_PROVIDER_CONFIG.push, ...value?.push ?? {} },
    email: { ...DEFAULT_PROVIDER_CONFIG.email, ...value?.email ?? {} },
    payments: { ...DEFAULT_PROVIDER_CONFIG.payments, ...value?.payments ?? {} },
    marketplaces: { ...DEFAULT_PROVIDER_CONFIG.marketplaces, ...value?.marketplaces ?? {} }
  };
}
function mergeWhiteLabelPages(value) {
  const pages = { ...DEFAULT_PAGE_CONFIG };
  for (const key of WHITE_LABEL_PAGE_KEYS) {
    pages[key] = { ...DEFAULT_PAGE_CONFIG[key], ...value?.[key] ?? {} };
  }
  return pages;
}

// server/whiteLabel.ts
init_db();
var BONATTO_LOGOS = {
  icon: "/brand/palmito-2-circular.png",
  wordmark: "/brand/palmito-logo-tipografica.png",
  favicon: "/favicon.ico",
  waiter: "/brand/bonatto-logo-driver.jpg"
};
function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function normalizeWhiteLabelDomain(value) {
  if (!value) return null;
  const withoutProtocol = value.trim().toLowerCase().replace(/^https?:\/\//, "");
  const host = withoutProtocol.split("/")[0]?.split(":")[0]?.replace(/^www\./, "") ?? "";
  return host || null;
}
function normalizeWhiteLabelSubdomain(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  return normalized || null;
}
function runtimeFromRows(store, config) {
  const isBonatto = store.tenantKey === "bonatto";
  const fallbackFeatures = isBonatto ? BONATTO_FEATURE_FLAGS : ESSENTIAL_FEATURE_FLAGS;
  const storedFeatures = parseJson(config?.featureFlags, {});
  const storedProviders = parseJson(config?.providerConfig, {});
  const storedPages = parseJson(config?.pageConfig, {});
  const storedContact = parseJson(config?.contactConfig, {});
  return {
    storeId: store.id,
    storeSlug: store.slug,
    tenantKey: store.tenantKey,
    status: config?.status ?? (isBonatto ? store.active ? "active" : "inactive" : "setup_pending"),
    plan: config?.plan ?? (isBonatto ? "enterprise" : "essential"),
    domain: config?.domain ?? null,
    subdomain: config?.subdomain ?? null,
    brand: {
      key: store.tenantKey,
      name: config?.brandName ?? store.displayName ?? store.name,
      shortName: config?.shortName ?? store.displayName ?? store.name,
      tagline: config?.tagline ?? (isBonatto ? "Delivery premium com identidade pr\xF3pria" : "Seu delivery, do seu jeito"),
      adminTitle: config?.adminTitle ?? `Painel ${store.displayName ?? store.name}`,
      deliveryLabel: config?.deliveryLabel ?? `Entrega em ${store.city}`,
      logos: {
        icon: config?.logoUrl ?? (isBonatto ? BONATTO_LOGOS.icon : ""),
        wordmark: config?.wordmarkUrl ?? (isBonatto ? BONATTO_LOGOS.wordmark : ""),
        favicon: config?.faviconUrl ?? (isBonatto ? BONATTO_LOGOS.favicon : ""),
        waiter: config?.waiterLogoUrl ?? config?.logoUrl ?? (isBonatto ? BONATTO_LOGOS.waiter : "")
      },
      colors: {
        primary: config?.primaryColor ?? "#6E0D12",
        primaryDark: config?.primaryDarkColor ?? "#450709",
        accent: config?.accentColor ?? "#e05c5c",
        background: config?.backgroundColor ?? "#fffaf8",
        text: config?.textColor ?? "#211719"
      }
    },
    features: isBonatto ? mergeWhiteLabelFeatures({ ...fallbackFeatures, ...storedFeatures }, true) : enforceTenantSafeFeatures(mergeWhiteLabelFeatures({ ...fallbackFeatures, ...storedFeatures }, false)),
    providers: mergeWhiteLabelProviders({ ...DEFAULT_PROVIDER_CONFIG, ...storedProviders }),
    pages: mergeWhiteLabelPages({ ...DEFAULT_PAGE_CONFIG, ...storedPages }),
    contact: { ...DEFAULT_CONTACT_CONFIG, ...storedContact }
  };
}
async function getTenantRootStore(db, store) {
  const [configuredRoot] = await db.select({ store: stores }).from(stores).innerJoin(storeWhiteLabelConfigs, eq5(storeWhiteLabelConfigs.storeId, stores.id)).where(eq5(stores.tenantKey, store.tenantKey)).orderBy(stores.id).limit(1);
  if (configuredRoot) return configuredRoot.store;
  const [root] = await db.select().from(stores).where(eq5(stores.tenantKey, store.tenantKey)).orderBy(desc2(stores.isDefault), stores.id).limit(1);
  return root ?? store;
}
async function getConfigForStore(db, storeId) {
  const [config] = await db.select().from(storeWhiteLabelConfigs).where(eq5(storeWhiteLabelConfigs.storeId, storeId)).limit(1);
  return config ?? null;
}
async function getWhiteLabelRuntimeByStoreId(storeId) {
  const db = await getDb();
  if (!db) return null;
  const [store] = await db.select().from(stores).where(eq5(stores.id, storeId)).limit(1);
  if (!store) return null;
  const tenantRoot = await getTenantRootStore(db, store);
  return runtimeFromRows(tenantRoot, await getConfigForStore(db, tenantRoot.id));
}
async function resolveWhiteLabelRuntime(input) {
  const db = await getDb();
  if (!db) return null;
  const host = normalizeWhiteLabelDomain(input.host);
  const slug = input.slug?.trim().toLowerCase() || null;
  const subdomain = host?.split(".")[0] ?? null;
  let matchedBy = "default";
  let store;
  let config = null;
  if (slug) {
    [store] = await db.select().from(stores).where(and4(eq5(stores.slug, slug), eq5(stores.active, true))).limit(1);
    if (store) {
      store = await getTenantRootStore(db, store);
      config = await getConfigForStore(db, store.id);
      if (store.tenantKey !== "bonatto" && !config || config && config.status !== "active") {
        store = void 0;
        config = null;
      } else {
        matchedBy = "slug";
      }
    }
  }
  if (!store && host && host !== "localhost" && host !== "127.0.0.1") {
    const [tenantDomain] = await db.select({ store: stores, config: storeWhiteLabelConfigs }).from(tenantDomains).innerJoin(tenants, eq5(tenants.id, tenantDomains.tenantId)).innerJoin(stores, eq5(stores.tenantKey, tenants.tenantKey)).leftJoin(storeWhiteLabelConfigs, eq5(storeWhiteLabelConfigs.storeId, stores.id)).where(and4(
      eq5(tenantDomains.hostname, host),
      eq5(tenantDomains.status, "active"),
      eq5(tenants.status, "active"),
      eq5(stores.active, true)
    )).orderBy(desc2(stores.isDefault), stores.id).limit(1);
    if (tenantDomain) {
      store = tenantDomain.store;
      config = tenantDomain.config;
      matchedBy = "domain";
    }
  }
  if (!store && host && host !== "localhost" && host !== "127.0.0.1") {
    const [row] = await db.select({ store: stores, config: storeWhiteLabelConfigs }).from(storeWhiteLabelConfigs).innerJoin(stores, eq5(storeWhiteLabelConfigs.storeId, stores.id)).where(and4(
      eq5(stores.active, true),
      eq5(storeWhiteLabelConfigs.status, "active"),
      or3(
        eq5(storeWhiteLabelConfigs.domain, host),
        subdomain ? eq5(storeWhiteLabelConfigs.subdomain, subdomain) : eq5(storeWhiteLabelConfigs.subdomain, "")
      )
    )).limit(1);
    if (row) {
      store = row.store;
      config = row.config;
      matchedBy = row.config.domain === host ? "domain" : "subdomain";
    }
  }
  if (!store) {
    [store] = await db.select().from(stores).where(eq5(stores.active, true)).orderBy(desc2(stores.isDefault), stores.id).limit(1);
  }
  if (!store) return null;
  store = await getTenantRootStore(db, store);
  if (!config) config = await getConfigForStore(db, store.id);
  return { matchedBy, runtime: runtimeFromRows(store, config) };
}
async function saveWhiteLabelRuntime(input) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [store] = await db.select().from(stores).where(eq5(stores.id, input.storeId)).limit(1);
  if (!store) throw new Error("Store not found");
  const tenantRoot = await getTenantRootStore(db, store);
  const isBonatto = tenantRoot.tenantKey === "bonatto";
  const domain = normalizeWhiteLabelDomain(input.domain);
  const subdomain = normalizeWhiteLabelSubdomain(input.subdomain);
  const features = isBonatto ? input.features : enforceTenantSafeFeatures(input.features);
  const pages = isBonatto ? input.pages : { ...input.pages, club: { ...input.pages.club, enabled: false } };
  const values = {
    storeId: tenantRoot.id,
    status: input.status,
    plan: input.plan,
    domain,
    subdomain,
    brandName: input.brand.name.trim(),
    shortName: input.brand.shortName.trim(),
    tagline: input.brand.tagline.trim() || null,
    adminTitle: input.brand.adminTitle.trim() || null,
    deliveryLabel: input.brand.deliveryLabel.trim() || null,
    logoUrl: input.brand.logos.icon || null,
    wordmarkUrl: input.brand.logos.wordmark || null,
    faviconUrl: input.brand.logos.favicon || null,
    waiterLogoUrl: input.brand.logos.waiter || null,
    primaryColor: input.brand.colors.primary,
    primaryDarkColor: input.brand.colors.primaryDark,
    accentColor: input.brand.colors.accent,
    backgroundColor: input.brand.colors.background,
    textColor: input.brand.colors.text,
    featureFlags: JSON.stringify(features),
    providerConfig: JSON.stringify(input.providers),
    pageConfig: JSON.stringify(pages),
    contactConfig: JSON.stringify(input.contact)
  };
  await db.insert(storeWhiteLabelConfigs).values(values).onDuplicateKeyUpdate({ set: values });
  return getWhiteLabelRuntimeByStoreId(store.id);
}
async function createDefaultWhiteLabelConfig(store) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const tenantRoot = await getTenantRootStore(db, store);
  if (tenantRoot.id !== store.id) return getWhiteLabelRuntimeByStoreId(store.id);
  const runtime = runtimeFromRows(tenantRoot, null);
  if (tenantRoot.tenantKey !== "bonatto") {
    runtime.status = "setup_pending";
  }
  return saveWhiteLabelRuntime(runtime);
}

// server/routers/club.ts
init_db();

// server/storeUtils.ts
init_schema();
init_db();
import { TRPCError as TRPCError3 } from "@trpc/server";
import { and as and5, eq as eq6, inArray as inArray4 } from "drizzle-orm";
async function resolveStoreId(user, requestedStoreId) {
  if (user.role === "admin") {
    return requestedStoreId;
  }
  if (user.role === "manager") {
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponivel" });
    }
    const directRows = await db.select({ storeId: storeManagers.storeId }).from(storeManagers).where(eq6(storeManagers.userId, user.id));
    const tenantRows = await db.select({ tenantKey: tenantMemberships.tenantKey }).from(tenantMemberships).where(and5(eq6(tenantMemberships.userId, user.id), eq6(tenantMemberships.active, true)));
    const tenantStoreRows = tenantRows.length ? await db.select({ storeId: stores.id }).from(stores).where(and5(inArray4(stores.tenantKey, tenantRows.map((row) => row.tenantKey)), eq6(stores.active, true))) : [];
    const allowedStoreIds = Array.from(/* @__PURE__ */ new Set([
      ...directRows.map((row) => row.storeId),
      ...tenantStoreRows.map((row) => row.storeId)
    ]));
    if (allowedStoreIds.length === 0) {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Gerente nao esta associado a nenhuma loja. Contate o administrador."
      });
    }
    if (requestedStoreId !== void 0) {
      if (!allowedStoreIds.includes(requestedStoreId)) {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Loja fora do seu acesso." });
      }
      return requestedStoreId;
    }
    return allowedStoreIds[0];
  }
  throw new TRPCError3({ code: "FORBIDDEN", message: "Acesso negado" });
}
async function resolveRequiredStoreId(user, requestedStoreId) {
  const storeId = await resolveStoreId(user, requestedStoreId);
  if (!storeId) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "Selecione uma loja para concluir esta a\xE7\xE3o."
    });
  }
  return storeId;
}
async function assertStoreEntityAccess(user, entityStoreId, requestedStoreId) {
  if (user.role === "admin") {
    if (requestedStoreId !== void 0 && entityStoreId !== requestedStoreId) {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Registro fora da loja selecionada." });
    }
    return requestedStoreId;
  }
  const scopedStoreId2 = await resolveStoreId(user, requestedStoreId ?? entityStoreId ?? void 0);
  if (entityStoreId == null || entityStoreId !== scopedStoreId2) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Registro fora da sua loja." });
  }
  return scopedStoreId2;
}

// server/routers/club.ts
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
async function assertClubStore(storeId) {
  const tenant = await getWhiteLabelRuntimeByStoreId(storeId);
  if (!tenant || tenant.status !== "active" || !tenant.features.club) {
    throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "O clube nao esta disponivel nesta loja." });
  }
  return tenant;
}
async function updateClubAccount(userId, storeId, data) {
  const db = await getDb();
  if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
  const account = await getTenantCustomerAccount(userId, storeId);
  if (!account) throw new TRPCError4({ code: "NOT_FOUND", message: "Conta do cliente nao encontrada." });
  await db.update(tenantCustomerAccounts).set(data).where(eq7(tenantCustomerAccounts.id, account.id));
  const scope = await getTenantScope(storeId);
  if (scope.tenantKey === "bonatto") {
    await db.update(users).set(data).where(eq7(users.id, userId));
  }
  return { ...account, ...data };
}
var clubRouter = router({
  getPlans: publicProcedure.input(z2.object({ storeId: z2.number().int().positive() })).query(async ({ input }) => {
    await assertClubStore(input.storeId);
    const config = await getClubConfig(input.storeId);
    return config.plans;
  }),
  getPublicConfig: publicProcedure.input(z2.object({ storeId: z2.number().int().positive() })).query(async ({ input }) => {
    await assertClubStore(input.storeId);
    return getClubConfig(input.storeId);
  }),
  getAdminConfig: staffProcedure.input(z2.object({ storeId: z2.number().optional() })).query(async ({ input, ctx }) => getClubConfig(await resolveRequiredStoreId(ctx.user, input.storeId))),
  saveAdminConfig: staffProcedure.input(clubConfigSchema.extend({ storeId: z2.number().optional() })).mutation(async ({ input, ctx }) => {
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    const ids = ensureClubPlanIds(input);
    if (!ids.includes("bonattao") || !ids.includes("basico")) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Os dois planos base precisam existir." });
    }
    const { storeId: _storeId, ...config } = input;
    await saveClubConfig(config, storeId);
    return { ok: true };
  }),
  getMyPlan: protectedProcedure.input(z2.object({ storeId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertClubStore(input.storeId);
    const account = await getTenantCustomerAccount(ctx.user.id, input.storeId);
    if (!account?.clubPlan || !account.clubStatus) return null;
    const planDetails = await getClubPlanConfig(account.clubPlan, input.storeId);
    return {
      plan: account.clubPlan,
      status: account.clubStatus,
      startDate: account.clubStartDate,
      nextBillingDate: account.clubNextBillingDate,
      freePizzaUsed: account.clubFreePizzaUsed,
      freePizzaResetAt: account.clubFreePizzaResetAt,
      planDetails
    };
  }),
  subscribe: protectedProcedure.input(z2.object({ storeId: z2.number().int().positive(), plan: z2.enum(["bonattao", "basico"]) })).mutation(async ({ input, ctx }) => {
    await assertClubStore(input.storeId);
    const planDetails = await getClubPlanConfig(input.plan, input.storeId);
    if (!planDetails) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Plano de assinatura inv\xE1lido." });
    }
    const paymentSettings = await getPaymentSettingsAdmin(input.storeId);
    if (!paymentSettings.availability.club.enabled) {
      throw new TRPCError4({
        code: "PRECONDITION_FAILED",
        message: "Os pagamentos do clube ainda n\xE3o foram configurados."
      });
    }
    const pixKey = paymentSettings.pixKey.trim();
    if (!pixKey) {
      throw new TRPCError4({
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
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const scope = await getTenantScope(input.storeId);
    const result = await db.insert(clubPayments).values({
      tenantKey: scope.tenantKey,
      storeId: input.storeId,
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
    await updateClubAccount(ctx.user.id, input.storeId, { clubPlan: input.plan, clubStatus: "pending" });
    return {
      paymentId,
      pixCode,
      pixQrCode,
      amount: planDetails.price,
      plan: planDetails
    };
  }),
  checkPayment: protectedProcedure.input(z2.object({ paymentId: z2.number(), storeId: z2.number().int().positive() })).query(async ({ input, ctx }) => {
    await assertClubStore(input.storeId);
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const payment = await db.select().from(clubPayments).where(and6(
      eq7(clubPayments.id, input.paymentId),
      eq7(clubPayments.userId, ctx.user.id),
      eq7(clubPayments.storeId, input.storeId)
    )).limit(1);
    if (!payment[0]) throw new TRPCError4({ code: "NOT_FOUND" });
    return { status: payment[0].status };
  }),
  confirmPayment: staffProcedure.input(z2.object({ paymentId: z2.number(), storeId: z2.number().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const payment = await db.select().from(clubPayments).where(eq7(clubPayments.id, input.paymentId)).limit(1);
    if (!payment[0]) throw new TRPCError4({ code: "NOT_FOUND" });
    await assertStoreEntityAccess(ctx.user, payment[0].storeId, input.storeId);
    const now = /* @__PURE__ */ new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    await db.update(clubPayments).set({ status: "paid", paidAt: now }).where(eq7(clubPayments.id, input.paymentId));
    await updateClubAccount(payment[0].userId, payment[0].storeId, {
      clubPlan: payment[0].plan,
      clubStatus: "active",
      clubStartDate: now,
      clubNextBillingDate: nextBilling,
      clubFreePizzaUsed: false,
      clubFreePizzaResetAt: nextBilling
    });
    const activatedUser = await db.select({ id: users.id, phone: users.phone }).from(users).where(eq7(users.id, payment[0].userId)).limit(1);
    if (activatedUser[0]) {
      fireJourneyTrigger("club_subscriber", activatedUser[0].id, activatedUser[0].phone ?? void 0, payment[0].storeId).catch(
        (error) => console.error("[Club] club_subscriber trigger failed", error)
      );
    }
    return { ok: true };
  }),
  cancelSubscription: protectedProcedure.input(z2.object({ storeId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertClubStore(input.storeId);
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    await updateClubAccount(ctx.user.id, input.storeId, {
      clubStatus: "cancelled",
      clubPlan: null,
      clubNextBillingDate: null
    });
    return { ok: true };
  }),
  useFreePizza: protectedProcedure.input(z2.object({ storeId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertClubStore(input.storeId);
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    let account = await getTenantCustomerAccount(ctx.user.id, input.storeId);
    if (!account) throw new TRPCError4({ code: "NOT_FOUND" });
    if (account.clubStatus !== "active") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Voc\xEA n\xE3o \xE9 membro ativo do clube." });
    }
    const plan = await getClubPlanConfig(account.clubPlan, input.storeId);
    if (!plan?.freePizzaPerMonth) {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Seu plano n\xE3o inclui pizza gr\xE1tis por m\xEAs." });
    }
    const now = /* @__PURE__ */ new Date();
    if (account.clubFreePizzaUsed && account.clubFreePizzaResetAt && now > account.clubFreePizzaResetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await updateClubAccount(ctx.user.id, input.storeId, { clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset });
      account = { ...account, clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset };
    }
    const result = await db.update(tenantCustomerAccounts).set({ clubFreePizzaUsed: true }).where(and6(
      eq7(tenantCustomerAccounts.id, account.id),
      eq7(tenantCustomerAccounts.clubStatus, "active"),
      eq7(tenantCustomerAccounts.clubFreePizzaUsed, false)
    ));
    const mutationResult = result;
    const affectedRows = mutationResult?.rowsAffected ?? mutationResult?.[0]?.affectedRows ?? 0;
    if (!affectedRows) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Voc\xEA j\xE1 usou sua pizza gr\xE1tis neste m\xEAs." });
    }
    const scope = await getTenantScope(input.storeId);
    if (scope.tenantKey === "bonatto") {
      await db.update(users).set({ clubFreePizzaUsed: true }).where(eq7(users.id, ctx.user.id));
    }
    return { ok: true };
  }),
  getMembers: staffProcedure.input(z2.object({ storeId: z2.number().optional() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    const scope = await getTenantScope(storeId);
    const members = await db.select({ account: tenantCustomerAccounts, user: users }).from(tenantCustomerAccounts).innerJoin(users, eq7(tenantCustomerAccounts.userId, users.id)).where(and6(eq7(tenantCustomerAccounts.tenantKey, scope.tenantKey), isNotNull(tenantCustomerAccounts.clubPlan)));
    return members.map(({ user, account }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      clubPlan: account.clubPlan,
      clubStatus: account.clubStatus,
      clubStartDate: account.clubStartDate,
      clubNextBillingDate: account.clubNextBillingDate,
      clubFreePizzaUsed: account.clubFreePizzaUsed
    }));
  }),
  getPendingPayments: staffProcedure.input(z2.object({ storeId: z2.number().optional() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
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
    }).from(clubPayments).leftJoin(users, eq7(clubPayments.userId, users.id)).where(and6(eq7(clubPayments.status, "pending"), eq7(clubPayments.storeId, storeId)));
  }),
  sendPromotion: staffProcedure.input(z2.object({ message: z2.string().min(1).max(1e3), storeId: z2.number().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR" });
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    const scope = await getTenantScope(storeId);
    const members = await db.select({ phone: users.phone, name: users.name }).from(tenantCustomerAccounts).innerJoin(users, eq7(tenantCustomerAccounts.userId, users.id)).where(and6(
      eq7(tenantCustomerAccounts.tenantKey, scope.tenantKey),
      isNotNull(tenantCustomerAccounts.clubPlan),
      eq7(tenantCustomerAccounts.clubStatus, "active")
    ));
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
import { eq as eq8, and as and7, desc as desc3, inArray as inArray5, sql as sql3 } from "drizzle-orm";
import { TRPCError as TRPCError5 } from "@trpc/server";
var colorSchema = z3.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal com 6 d\xEDgitos");
var assetUrlSchema = z3.string().max(2048).refine(
  (value) => value === "" || value.startsWith("/") || /^https:\/\//i.test(value),
  "Use uma URL HTTPS ou um caminho interno"
);
var pageSchema = z3.object({ enabled: z3.boolean(), title: z3.string().max(160), description: z3.string().max(300), heroImage: assetUrlSchema });
var adminTabsSchema = z3.object({
  dashboard: z3.boolean().optional(),
  orders: z3.boolean().optional(),
  menu: z3.boolean().optional(),
  club: z3.boolean().optional(),
  inventory: z3.boolean().optional(),
  staff: z3.boolean().optional(),
  dining: z3.boolean().optional(),
  coupons: z3.boolean().optional(),
  reports: z3.boolean().optional(),
  network: z3.boolean().optional(),
  distribution: z3.boolean().optional(),
  promotions: z3.boolean().optional(),
  raffles: z3.boolean().optional(),
  upsells: z3.boolean().optional(),
  users: z3.boolean().optional(),
  drivers: z3.boolean().optional(),
  marketplaces: z3.boolean().optional(),
  payments: z3.boolean().optional(),
  settings: z3.boolean().optional(),
  stores: z3.boolean().optional(),
  recovery: z3.boolean().optional()
});
var whiteLabelConfigSchema = z3.object({
  storeId: z3.number().int().positive(),
  status: z3.enum(["active", "inactive", "setup_pending"]),
  plan: z3.enum(["essential", "pro", "enterprise", "custom"]),
  domain: z3.string().max(191).nullable(),
  subdomain: z3.string().max(100).nullable(),
  brand: z3.object({
    key: z3.string().max(100),
    name: z3.string().min(2).max(200),
    shortName: z3.string().min(1).max(100),
    tagline: z3.string().max(240),
    adminTitle: z3.string().max(200),
    deliveryLabel: z3.string().max(200),
    logos: z3.object({ icon: assetUrlSchema, wordmark: assetUrlSchema, favicon: assetUrlSchema, waiter: assetUrlSchema }),
    colors: z3.object({ primary: colorSchema, primaryDark: colorSchema, accent: colorSchema, background: colorSchema, text: colorSchema })
  }),
  features: z3.object({
    adminTabs: adminTabsSchema,
    crm: z3.boolean(),
    automations: z3.boolean(),
    notifications: z3.boolean(),
    deliveryZones: z3.boolean(),
    salesDashboard: z3.boolean(),
    waiterApp: z3.boolean(),
    driverApp: z3.boolean(),
    loyalty: z3.boolean(),
    club: z3.boolean(),
    inventory: z3.boolean(),
    diningRoom: z3.boolean(),
    marketplaces: z3.boolean(),
    auditTrail: z3.boolean(),
    healthPanel: z3.boolean(),
    globalSearch: z3.boolean()
  }),
  providers: z3.object({
    auth: z3.object({ google: z3.boolean(), apple: z3.boolean(), facebook: z3.boolean(), instagram: z3.boolean() }),
    maps: z3.object({ provider: z3.enum(["openstreetmap", "google"]) }),
    push: z3.object({ provider: z3.enum(["vapid", "none"]), enabled: z3.boolean() }),
    email: z3.object({ provider: z3.enum(["resend", "smtp", "none"]), enabled: z3.boolean() }),
    payments: z3.object({ pix: z3.boolean(), card: z3.boolean(), cash: z3.boolean(), provider: z3.enum(["manual", "stripe", "asaas"]) }),
    marketplaces: z3.object({ ifood: z3.boolean(), aiqfome: z3.boolean(), rappi: z3.boolean(), deliveryMuch: z3.boolean() })
  }),
  pages: z3.object({
    home: pageSchema,
    menu: pageSchema,
    checkout: pageSchema,
    orders: pageSchema,
    profile: pageSchema,
    club: pageSchema,
    tracking: pageSchema,
    driver: pageSchema,
    waiter: pageSchema
  }),
  contact: z3.object({ supportEmail: z3.string().max(320), supportPhone: z3.string().max(30), whatsapp: z3.string().max(30), instagram: z3.string().max(120) })
});
var storesRouter = router({
  list: publicProcedure.input(z3.object({ host: z3.string().max(255).optional(), slug: z3.string().max(100).optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const resolved = await resolveWhiteLabelRuntime({ host: input?.host, slug: input?.slug });
    if (!resolved) return [];
    const tenantStores = await db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      city: stores.city,
      address: stores.address,
      phone: stores.phone,
      isDefault: stores.isDefault,
      tenantKey: stores.tenantKey
    }).from(stores).where(and7(eq8(stores.active, true), eq8(stores.tenantKey, resolved.runtime.tenantKey))).orderBy(desc3(stores.isDefault), stores.city);
    const counts = tenantStores.length ? await db.select({ storeId: products.storeId, count: sql3`COUNT(*)` }).from(products).where(and7(inArray5(products.storeId, tenantStores.map((store) => store.id)), eq8(products.active, true))).groupBy(products.storeId) : [];
    const countByStore = new Map(counts.map((row) => [row.storeId, Number(row.count)]));
    return tenantStores.map((store) => ({ ...store, productCount: countByStore.get(store.id) ?? 0, hasCatalog: (countByStore.get(store.id) ?? 0) > 0 }));
  }),
  resolveTenant: publicProcedure.input(z3.object({ host: z3.string().max(255).optional(), slug: z3.string().max(100).optional() }).optional()).query(async ({ input }) => {
    const resolved = await resolveWhiteLabelRuntime({ host: input?.host, slug: input?.slug });
    if (!resolved) throw new TRPCError5({ code: "NOT_FOUND", message: "Estabelecimento n\xE3o encontrado" });
    return resolved;
  }),
  getBySlug: publicProcedure.input(z3.object({ slug: z3.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    const [store] = await db.select().from(stores).where(and7(eq8(stores.slug, input.slug), eq8(stores.active, true))).limit(1);
    if (!store) throw new TRPCError5({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada" });
    return store;
  }),
  listAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(stores).orderBy(desc3(stores.isDefault), stores.city);
  }),
  create: adminProcedure.input(z3.object({
    creationType: z3.enum(["brand", "unit"]).default("brand"),
    name: z3.string().min(2).max(200),
    slug: z3.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
    tenantKey: z3.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
    city: z3.string().min(2).max(100),
    address: z3.string().max(500).optional(),
    phone: z3.string().max(20).optional(),
    active: z3.boolean().default(true),
    isDefault: z3.boolean().default(false)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    const tenantKey = input.creationType === "unit" ? input.tenantKey : input.slug;
    if (!tenantKey) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: "Selecione a marca da nova unidade." });
    }
    const tenantStores = await db.select({ id: stores.id }).from(stores).where(eq8(stores.tenantKey, tenantKey)).limit(1);
    if (input.creationType === "unit" && tenantStores.length === 0) {
      throw new TRPCError5({ code: "NOT_FOUND", message: "Marca n\xE3o encontrada." });
    }
    if (input.creationType === "brand" && tenantStores.length > 0) {
      throw new TRPCError5({ code: "CONFLICT", message: "Ja existe uma marca com este identificador." });
    }
    if (input.isDefault) {
      await db.update(stores).set({ isDefault: false }).where(eq8(stores.tenantKey, tenantKey));
    }
    const [result] = await db.insert(stores).values({
      tenantKey,
      name: input.name,
      slug: input.slug,
      city: input.city,
      address: input.address,
      phone: input.phone,
      active: input.active,
      isDefault: input.isDefault
    });
    const id = Number(result.insertId);
    const [createdStore] = await db.select().from(stores).where(eq8(stores.id, id)).limit(1);
    if (createdStore) await createDefaultWhiteLabelConfig(createdStore);
    return { id, ...input, tenantKey };
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
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    if (data.isDefault) {
      const [currentStore] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq8(stores.id, id)).limit(1);
      if (!currentStore) throw new TRPCError5({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada" });
      await db.update(stores).set({ isDefault: false }).where(eq8(stores.tenantKey, currentStore.tenantKey));
    }
    await db.update(stores).set(data).where(eq8(stores.id, id));
    return { success: true };
  }),
  delete: adminProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    const [store] = await db.select().from(stores).where(eq8(stores.id, input.id)).limit(1);
    if (!store) throw new TRPCError5({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada" });
    if (store.isDefault) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: "Defina outra loja padr\xE3o antes de desativar esta unidade." });
    }
    await db.update(stores).set({ active: false }).where(eq8(stores.id, input.id));
    await db.update(staffMembers).set({ active: false }).where(eq8(staffMembers.storeId, input.id));
    await db.update(drivers).set({ active: false }).where(eq8(drivers.storeId, input.id));
    await db.update(diningTables).set({ active: false, status: "free" }).where(eq8(diningTables.storeId, input.id));
    return { success: true };
  }),
  addManager: adminProcedure.input(z3.object({
    storeId: z3.number(),
    userId: z3.number(),
    scope: z3.enum(["store", "tenant"]).default("store")
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    const [user] = await db.select().from(users).where(eq8(users.id, input.userId)).limit(1);
    if (!user) throw new TRPCError5({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado" });
    if (user.role === "user") {
      await db.update(users).set({ role: "manager" }).where(eq8(users.id, input.userId));
    }
    if (input.scope === "tenant") {
      const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq8(stores.id, input.storeId)).limit(1);
      if (!store) throw new TRPCError5({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada" });
      await db.insert(tenantMemberships).values({
        tenantKey: store.tenantKey,
        userId: input.userId,
        role: "admin",
        active: true
      }).onDuplicateKeyUpdate({ set: { role: "admin", active: true } });
    } else {
      await db.insert(storeManagers).values({
        storeId: input.storeId,
        userId: input.userId
      }).onDuplicateKeyUpdate({ set: { storeId: input.storeId } });
    }
    return { success: true };
  }),
  removeManager: adminProcedure.input(z3.object({
    storeId: z3.number(),
    userId: z3.number(),
    scope: z3.enum(["store", "tenant"]).default("store")
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    if (input.scope === "tenant") {
      const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq8(stores.id, input.storeId)).limit(1);
      if (store) {
        await db.delete(tenantMemberships).where(and7(
          eq8(tenantMemberships.tenantKey, store.tenantKey),
          eq8(tenantMemberships.userId, input.userId)
        ));
      }
    } else {
      await db.delete(storeManagers).where(and7(eq8(storeManagers.storeId, input.storeId), eq8(storeManagers.userId, input.userId)));
    }
    const [remainingStore, remainingTenant] = await Promise.all([
      db.select().from(storeManagers).where(eq8(storeManagers.userId, input.userId)).limit(1),
      db.select().from(tenantMemberships).where(and7(eq8(tenantMemberships.userId, input.userId), eq8(tenantMemberships.active, true))).limit(1)
    ]);
    if (remainingStore.length === 0 && remainingTenant.length === 0) {
      await db.update(users).set({ role: "user" }).where(eq8(users.id, input.userId));
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
    }).from(storeManagers).innerJoin(users, eq8(storeManagers.userId, users.id)).where(eq8(storeManagers.storeId, input.storeId));
  }),
  getTenantManagers: adminProcedure.input(z3.object({ storeId: z3.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq8(stores.id, input.storeId)).limit(1);
    if (!store) return [];
    return db.select({
      id: tenantMemberships.id,
      userId: tenantMemberships.userId,
      tenantKey: tenantMemberships.tenantKey,
      membershipRole: tenantMemberships.role,
      createdAt: tenantMemberships.createdAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      userRole: users.role
    }).from(tenantMemberships).innerJoin(users, eq8(tenantMemberships.userId, users.id)).where(and7(eq8(tenantMemberships.tenantKey, store.tenantKey), eq8(tenantMemberships.active, true)));
  }),
  findUserByEmail: adminProcedure.input(z3.object({ email: z3.string().email() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq8(users.email, input.email)).limit(1);
    return user ?? null;
  }),
  whiteLabelConfig: staffProcedure.input(z3.object({ storeId: z3.number().int().positive() })).query(async ({ input, ctx }) => {
    await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
    const config = await getWhiteLabelRuntimeByStoreId(input.storeId);
    if (!config) throw new TRPCError5({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada" });
    return config;
  }),
  saveWhiteLabelConfig: staffProcedure.input(whiteLabelConfigSchema).mutation(async ({ input, ctx }) => {
    await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
    try {
      if (ctx.isOwner) return await saveWhiteLabelRuntime(input);
      const current = await getWhiteLabelRuntimeByStoreId(input.storeId);
      if (!current) throw new TRPCError5({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada" });
      return await saveWhiteLabelRuntime({
        ...input,
        status: current.status,
        plan: current.plan,
        domain: current.domain,
        subdomain: current.subdomain,
        features: current.features,
        providers: current.providers,
        brand: { ...input.brand, key: current.brand.key }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel salvar a configura\xE7\xE3o";
      if (/duplicate/i.test(message)) {
        throw new TRPCError5({ code: "CONFLICT", message: "Dom\xEDnio ou subdom\xEDnio j\xE1 est\xE1 em uso por outra loja." });
      }
      throw error;
    }
  }),
  uploadBrandAsset: staffProcedure.input(z3.object({
    storeId: z3.number().int().positive(),
    kind: z3.enum(["logo", "wordmark", "favicon", "waiter"]),
    base64: z3.string().max(43e5),
    mimeType: z3.enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
  })).mutation(async ({ input, ctx }) => {
    await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
    const [{ storagePutAdapter: storagePut2 }, { compressToWebP: compressToWebP2 }] = await Promise.all([
      Promise.resolve().then(() => (init_storage2(), storage_exports2)),
      Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports))
    ]);
    const rawBuffer = Buffer.from(input.base64, "base64");
    const maxWidth = input.kind === "favicon" ? 512 : 1600;
    const { buffer, mimeType, ext } = await compressToWebP2(rawBuffer, 86, maxWidth);
    const key = `stores/${input.storeId}/brand/${input.kind}-${Date.now()}.${ext}`;
    return storagePut2(key, buffer, mimeType);
  }),
  myStores: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null;
    const db = await getDb();
    if (!db) return [];
    const directRows = await db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      city: stores.city,
      address: stores.address,
      phone: stores.phone
    }).from(storeManagers).innerJoin(stores, eq8(storeManagers.storeId, stores.id)).where(and7(eq8(storeManagers.userId, ctx.user.id), eq8(stores.active, true)));
    const memberships = await db.select({ tenantKey: tenantMemberships.tenantKey }).from(tenantMemberships).where(and7(eq8(tenantMemberships.userId, ctx.user.id), eq8(tenantMemberships.active, true)));
    const tenantRows = memberships.length ? await db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      city: stores.city,
      address: stores.address,
      phone: stores.phone
    }).from(stores).where(and7(inArray5(stores.tenantKey, memberships.map((row) => row.tenantKey)), eq8(stores.active, true))) : [];
    return Array.from(new Map([...directRows, ...tenantRows].map((store) => [store.id, store])).values());
  }),
  myStore: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null;
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone }).from(storeManagers).innerJoin(stores, eq8(storeManagers.storeId, stores.id)).where(eq8(storeManagers.userId, ctx.user.id)).limit(1);
    if (row) return row;
    const [membership] = await db.select({ tenantKey: tenantMemberships.tenantKey }).from(tenantMemberships).where(and7(eq8(tenantMemberships.userId, ctx.user.id), eq8(tenantMemberships.active, true))).limit(1);
    if (!membership) return null;
    const [tenantStore] = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone }).from(stores).where(and7(eq8(stores.tenantKey, membership.tenantKey), eq8(stores.active, true))).orderBy(desc3(stores.isDefault), stores.id).limit(1);
    return tenantStore ?? null;
  })
});

// server/routers/platform.ts
init_schema();
init_db();
import { TRPCError as TRPCError6 } from "@trpc/server";
import { and as and8, asc, desc as desc4, eq as eq10, inArray as inArray6, sql as sql4 } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z as z4 } from "zod";

// server/tenantAudit.ts
init_schema();
init_db();
import { eq as eq9 } from "drizzle-orm";
var SENSITIVE_KEY = /password|secret|token|credential|authorization|cookie|api[-_]?key/i;
function sanitizeAuditValue(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).slice(0, 100).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeAuditValue(item, depth + 1)])
  );
}
async function recordTenantAudit(input) {
  const db = await getDb();
  if (!db) return false;
  let tenantId = input.tenantId;
  if (!tenantId && input.storeId) {
    const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq9(stores.id, input.storeId)).limit(1);
    if (store) {
      const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq9(tenants.tenantKey, store.tenantKey)).limit(1);
      tenantId = tenant?.id;
    }
  }
  if (!tenantId) return false;
  await db.insert(tenantAuditLogs).values({
    tenantId,
    storeId: input.storeId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action.slice(0, 120),
    resourceType: input.resourceType.slice(0, 80),
    resourceId: input.resourceId == null ? null : String(input.resourceId).slice(0, 96),
    requestId: input.requestId?.slice(0, 96) ?? null,
    ipAddress: input.ipAddress?.slice(0, 64) ?? null,
    metadata: input.metadata ? JSON.stringify(sanitizeAuditValue(input.metadata)) : null
  });
  return true;
}

// server/routers/platform.ts
var storeInput = z4.object({ storeId: z4.number().int().positive() });
var groupKind = z4.enum(["single", "multiple", "flavor", "size", "edge"]);
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return db;
}
async function scopedStoreId(user, storeId) {
  return resolveRequiredStoreId(user, storeId);
}
function parseObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
var platformRouter = router({
  tenancy: router({
    plans: platformAdminProcedure.query(async () => {
      const rows = await (await requireDb()).select().from(tenantPlans).orderBy(asc(tenantPlans.monthlyPrice), asc(tenantPlans.id));
      return rows.map((plan) => ({ ...plan, entitlements: parseObject(plan.entitlements), limits: parseObject(plan.limits) }));
    }),
    overview: platformAdminProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso exclusivo da administra\xE7\xE3o da plataforma." });
      const db = await requireDb();
      const tenantRows = await db.select().from(tenants).orderBy(asc(tenants.displayName));
      const domains = await db.select().from(tenantDomains).orderBy(asc(tenantDomains.hostname));
      const planRows = await db.select().from(tenantPlans).orderBy(asc(tenantPlans.monthlyPrice), asc(tenantPlans.id));
      const plans = planRows.map((plan) => ({
        ...plan,
        entitlements: parseObject(plan.entitlements),
        limits: parseObject(plan.limits)
      }));
      const subscriptions = await db.select().from(tenantSubscriptions);
      const storeRows = await db.select({ id: stores.id, tenantKey: stores.tenantKey, name: stores.name, active: stores.active }).from(stores);
      return tenantRows.map((tenant) => ({
        ...tenant,
        domains: domains.filter((domain) => domain.tenantId === tenant.id),
        stores: storeRows.filter((store) => store.tenantKey === tenant.tenantKey),
        subscription: subscriptions.find((subscription) => subscription.tenantId === tenant.id) ?? null,
        plans
      }));
    }),
    saveTenant: platformAdminProcedure.input(z4.object({
      id: z4.number().int().positive().optional(),
      tenantKey: z4.string().trim().min(3).max(100).regex(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/),
      legalName: z4.string().trim().min(2).max(200),
      displayName: z4.string().trim().min(2).max(200),
      document: z4.string().trim().max(32).optional(),
      status: z4.enum(["setup_pending", "active", "suspended", "cancelled"]),
      planId: z4.number().int().positive().optional()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError6({ code: "FORBIDDEN" });
      const db = await requireDb();
      const values = { tenantKey: input.tenantKey, legalName: input.legalName, displayName: input.displayName, document: input.document ?? null, status: input.status };
      let tenantId = input.id;
      if (tenantId) {
        await db.update(tenants).set(values).where(eq10(tenants.id, tenantId));
      } else {
        const [result] = await db.insert(tenants).values({ ...values, ownerUserId: ctx.user.id });
        tenantId = Number(result.insertId);
      }
      if (!tenantId) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel salvar a empresa." });
      if (input.planId) await db.insert(tenantSubscriptions).values({ tenantId, planId: input.planId, status: "trialing" }).onDuplicateKeyUpdate({ set: { planId: input.planId, updatedAt: /* @__PURE__ */ new Date() } });
      await recordTenantAudit({ tenantId, actorUserId: ctx.user.id, action: input.id ? "tenant.updated" : "tenant.created", resourceType: "tenant", resourceId: tenantId, metadata: { status: input.status, planId: input.planId ?? null } });
      return { id: tenantId };
    }),
    addDomain: platformAdminProcedure.input(z4.object({ tenantId: z4.number().int().positive(), hostname: z4.string().trim().min(4).max(255), kind: z4.enum(["platform_subdomain", "custom_domain"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError6({ code: "FORBIDDEN" });
      const hostname = input.hostname.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").replace(/:\d+$/, "");
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) throw new TRPCError6({ code: "BAD_REQUEST", message: "Dom\xEDnio inv\xE1lido." });
      const db = await requireDb();
      const verificationToken = `bonatto-verify-${nanoid(32)}`;
      const [result] = await db.insert(tenantDomains).values({ tenantId: input.tenantId, hostname, kind: input.kind, verificationToken });
      const domainId = Number(result.insertId);
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "domain.created", resourceType: "tenant_domain", resourceId: domainId, metadata: { hostname, kind: input.kind } });
      return { id: domainId, hostname, verificationToken, dns: { type: "TXT", name: `_bonatto-verification.${hostname}`, value: verificationToken } };
    }),
    setDomainStatus: platformAdminProcedure.input(z4.object({ tenantId: z4.number().int().positive(), domainId: z4.number().int().positive(), status: z4.enum(["pending", "verifying", "verified", "active", "failed", "disabled"]), error: z4.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError6({ code: "FORBIDDEN" });
      const db = await requireDb();
      const now = /* @__PURE__ */ new Date();
      await db.update(tenantDomains).set({ status: input.status, verifiedAt: input.status === "verified" || input.status === "active" ? now : void 0, activatedAt: input.status === "active" ? now : void 0, lastError: input.error ?? null }).where(and8(eq10(tenantDomains.id, input.domainId), eq10(tenantDomains.tenantId, input.tenantId)));
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "domain.status_changed", resourceType: "tenant_domain", resourceId: input.domainId, metadata: { status: input.status } });
      return { ok: true };
    }),
    savePlan: platformAdminProcedure.input(z4.object({
      id: z4.number().int().positive().optional(),
      code: z4.string().trim().min(2).max(64).regex(/^[a-z0-9][a-z0-9_-]+$/),
      name: z4.string().trim().min(2).max(120),
      monthlyPrice: z4.number().min(0).max(1e6),
      entitlements: z4.record(z4.string().min(1).max(80), z4.boolean()),
      limits: z4.record(z4.string().min(1).max(80), z4.number().int().min(-1).max(1e8)),
      active: z4.boolean()
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const values = {
        code: input.code,
        name: input.name,
        monthlyPrice: input.monthlyPrice.toFixed(2),
        entitlements: JSON.stringify(input.entitlements),
        limits: JSON.stringify(input.limits),
        active: input.active
      };
      let planId = input.id;
      if (planId) {
        await db.update(tenantPlans).set(values).where(eq10(tenantPlans.id, planId));
      } else {
        const [result] = await db.insert(tenantPlans).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: /* @__PURE__ */ new Date() } });
        planId = Number(result.insertId ?? 0);
        if (!planId) {
          const [existing] = await db.select({ id: tenantPlans.id }).from(tenantPlans).where(eq10(tenantPlans.code, input.code)).limit(1);
          planId = existing?.id;
        }
      }
      if (!planId) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel salvar o plano." });
      return { id: planId, changedBy: ctx.user.id };
    }),
    setSubscription: platformAdminProcedure.input(z4.object({
      tenantId: z4.number().int().positive(),
      planId: z4.number().int().positive(),
      status: z4.enum(["trialing", "active", "past_due", "suspended", "cancelled"]),
      trialDays: z4.number().int().min(0).max(365).default(0),
      graceDays: z4.number().int().min(0).max(90).default(0)
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [planRows, tenantRows] = await Promise.all([
        db.select({ id: tenantPlans.id }).from(tenantPlans).where(eq10(tenantPlans.id, input.planId)).limit(1),
        db.select({ id: tenants.id }).from(tenants).where(eq10(tenants.id, input.tenantId)).limit(1)
      ]);
      if (!planRows[0] || !tenantRows[0]) throw new TRPCError6({ code: "NOT_FOUND", message: "Empresa ou plano n\xE3o encontrado." });
      const now = Date.now();
      const trialEndsAt = input.trialDays ? new Date(now + input.trialDays * 864e5) : null;
      const graceEndsAt = input.graceDays ? new Date(now + input.graceDays * 864e5) : null;
      await db.insert(tenantSubscriptions).values({ tenantId: input.tenantId, planId: input.planId, status: input.status, trialEndsAt, graceEndsAt }).onDuplicateKeyUpdate({ set: { planId: input.planId, status: input.status, trialEndsAt, graceEndsAt, updatedAt: /* @__PURE__ */ new Date() } });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "subscription.updated", resourceType: "tenant_subscription", resourceId: input.tenantId, metadata: { planId: input.planId, status: input.status, trialDays: input.trialDays, graceDays: input.graceDays } });
      return { ok: true };
    }),
    audit: platformAdminProcedure.input(z4.object({ tenantId: z4.number().int().positive(), limit: z4.number().int().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError6({ code: "FORBIDDEN" });
      return (await requireDb()).select().from(tenantAuditLogs).where(eq10(tenantAuditLogs.tenantId, input.tenantId)).orderBy(desc4(tenantAuditLogs.createdAt)).limit(input.limit);
    })
  }),
  commerce: router({
    configuration: publicProcedure.input(z4.object({ storeId: z4.number().int().positive(), productId: z4.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const [product] = await db.select().from(products).where(and8(eq10(products.id, input.productId), eq10(products.storeId, input.storeId), eq10(products.active, true))).limit(1);
      if (!product) throw new TRPCError6({ code: "NOT_FOUND", message: "Produto n\xE3o encontrado nesta loja." });
      const groups = await db.select().from(productOptionGroups).where(and8(eq10(productOptionGroups.storeId, input.storeId), eq10(productOptionGroups.productId, input.productId), eq10(productOptionGroups.active, true))).orderBy(asc(productOptionGroups.sortOrder), asc(productOptionGroups.id));
      const options = groups.length ? await db.select().from(productOptions).where(and8(eq10(productOptions.storeId, input.storeId), inArray6(productOptions.groupId, groups.map((group) => group.id)), eq10(productOptions.active, true))).orderBy(asc(productOptions.sortOrder), asc(productOptions.id)) : [];
      const [combo] = await db.select().from(productCombos).where(and8(eq10(productCombos.storeId, input.storeId), eq10(productCombos.productId, input.productId), eq10(productCombos.active, true))).limit(1);
      const comboGroupRows = combo ? await db.select().from(comboGroups).where(and8(eq10(comboGroups.storeId, input.storeId), eq10(comboGroups.comboId, combo.id))).orderBy(asc(comboGroups.sortOrder)) : [];
      const comboItems = comboGroupRows.length ? await db.select({ item: comboGroupItems, product: products }).from(comboGroupItems).innerJoin(products, eq10(products.id, comboGroupItems.productId)).where(and8(eq10(comboGroupItems.storeId, input.storeId), inArray6(comboGroupItems.groupId, comboGroupRows.map((group) => group.id)), eq10(comboGroupItems.active, true))) : [];
      return {
        product,
        groups: groups.map((group) => ({ ...group, options: options.filter((option) => option.groupId === group.id) })),
        combo: combo ? { ...combo, groups: comboGroupRows.map((group) => ({ ...group, items: comboItems.filter((row) => row.item.groupId === group.id) })) } : null
      };
    }),
    adminConfiguration: staffProcedure.input(z4.object({ storeId: z4.number().int().positive(), productId: z4.number().int().positive() })).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const groups = await db.select().from(productOptionGroups).where(and8(eq10(productOptionGroups.storeId, input.storeId), eq10(productOptionGroups.productId, input.productId))).orderBy(asc(productOptionGroups.sortOrder));
      const options = groups.length ? await db.select().from(productOptions).where(and8(eq10(productOptions.storeId, input.storeId), inArray6(productOptions.groupId, groups.map((group) => group.id)))).orderBy(asc(productOptions.sortOrder)) : [];
      return groups.map((group) => ({ ...group, options: options.filter((option) => option.groupId === group.id) }));
    }),
    saveGroup: staffProcedure.input(z4.object({
      id: z4.number().int().positive().optional(),
      storeId: z4.number().int().positive(),
      productId: z4.number().int().positive(),
      name: z4.string().min(1).max(120),
      kind: groupKind.default("multiple"),
      required: z4.boolean().default(false),
      minSelections: z4.number().int().min(0).default(0),
      maxSelections: z4.number().int().min(1).max(20).default(1),
      sortOrder: z4.number().int().default(0),
      active: z4.boolean().default(true)
    })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      if (input.minSelections > input.maxSelections) throw new TRPCError6({ code: "BAD_REQUEST", message: "O m\xEDnimo n\xE3o pode superar o m\xE1ximo." });
      const db = await requireDb();
      const data = { storeId: input.storeId, productId: input.productId, name: input.name, kind: input.kind, required: input.required, minSelections: input.minSelections, maxSelections: input.maxSelections, sortOrder: input.sortOrder, active: input.active };
      if (input.id) {
        await db.update(productOptionGroups).set(data).where(and8(eq10(productOptionGroups.id, input.id), eq10(productOptionGroups.storeId, input.storeId)));
        return { id: input.id };
      }
      const [result] = await db.insert(productOptionGroups).values(data);
      return { id: Number(result.insertId ?? 0) };
    }),
    saveOption: staffProcedure.input(z4.object({
      id: z4.number().int().positive().optional(),
      storeId: z4.number().int().positive(),
      groupId: z4.number().int().positive(),
      name: z4.string().min(1).max(160),
      description: z4.string().max(500).optional(),
      priceDelta: z4.number().min(0).default(0),
      linkedProductId: z4.number().int().positive().optional(),
      ingredientId: z4.number().int().positive().optional(),
      ingredientQuantity: z4.number().positive().optional(),
      imageUrl: z4.string().max(2e3).optional(),
      sortOrder: z4.number().int().default(0),
      active: z4.boolean().default(true)
    })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [group] = await db.select().from(productOptionGroups).where(and8(eq10(productOptionGroups.id, input.groupId), eq10(productOptionGroups.storeId, input.storeId))).limit(1);
      if (!group) throw new TRPCError6({ code: "NOT_FOUND", message: "Grupo de op\xE7\xF5es n\xE3o encontrado." });
      const data = { storeId: input.storeId, groupId: input.groupId, name: input.name, description: input.description ?? null, priceDelta: input.priceDelta.toFixed(2), linkedProductId: input.linkedProductId ?? null, ingredientId: input.ingredientId ?? null, ingredientQuantity: input.ingredientQuantity?.toFixed(3) ?? null, imageUrl: input.imageUrl ?? null, sortOrder: input.sortOrder, active: input.active };
      if (input.id) {
        await db.update(productOptions).set(data).where(and8(eq10(productOptions.id, input.id), eq10(productOptions.storeId, input.storeId)));
        return { id: input.id };
      }
      const [result] = await db.insert(productOptions).values(data);
      return { id: Number(result.insertId ?? 0) };
    })
  }),
  operations: router({
    board: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const activeOrders = await db.select().from(orders).where(and8(eq10(orders.storeId, input.storeId), inArray6(orders.status, ["pending", "confirmed", "preparing"]))).orderBy(asc(orders.createdAt)).limit(500);
      if (activeOrders.length) {
        await db.insert(kitchenTickets).values(activeOrders.map((order) => ({ storeId: input.storeId, orderId: order.id, status: order.status === "preparing" ? "preparing" : "queued", startedAt: order.preparingAt, promisedAt: order.predictedReadyAt }))).onDuplicateKeyUpdate({ set: { updatedAt: /* @__PURE__ */ new Date() } });
      }
      const tickets = await db.select().from(kitchenTickets).where(and8(eq10(kitchenTickets.storeId, input.storeId), inArray6(kitchenTickets.status, ["queued", "preparing", "ready"]))).orderBy(asc(kitchenTickets.createdAt));
      const orderIds = tickets.map((ticket) => ticket.orderId);
      const ticketOrders = orderIds.length ? await db.select().from(orders).where(inArray6(orders.id, orderIds)) : [];
      const items = orderIds.length ? await db.select().from(orderItems).where(inArray6(orderItems.orderId, orderIds)) : [];
      const now = Date.now();
      return tickets.map((ticket) => {
        const order = ticketOrders.find((row) => row.id === ticket.orderId);
        const elapsedMinutes = Math.max(0, Math.floor((now - new Date(ticket.createdAt).getTime()) / 6e4));
        const promised = ticket.promisedAt ? new Date(ticket.promisedAt).getTime() : new Date(ticket.createdAt).getTime() + 40 * 6e4;
        return { ...ticket, order, items: items.filter((item) => item.orderId === ticket.orderId), elapsedMinutes, delayed: now > promised, slaRemainingMinutes: Math.ceil((promised - now) / 6e4) };
      });
    }),
    transitionTicket: staffProcedure.input(z4.object({ storeId: z4.number().int().positive(), ticketId: z4.number().int().positive(), status: z4.enum(["queued", "preparing", "ready", "completed", "cancelled"]), priority: z4.enum(["normal", "high", "urgent"]).optional() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [ticket] = await db.select().from(kitchenTickets).where(and8(eq10(kitchenTickets.id, input.ticketId), eq10(kitchenTickets.storeId, input.storeId))).limit(1);
      if (!ticket) throw new TRPCError6({ code: "NOT_FOUND", message: "Ticket de cozinha n\xE3o encontrado." });
      const now = /* @__PURE__ */ new Date();
      await db.update(kitchenTickets).set({ status: input.status, priority: input.priority ?? ticket.priority, startedAt: input.status === "preparing" ? ticket.startedAt ?? now : ticket.startedAt, readyAt: input.status === "ready" ? now : ticket.readyAt, completedAt: input.status === "completed" ? now : ticket.completedAt }).where(eq10(kitchenTickets.id, ticket.id));
      if (input.status === "preparing") await db.update(orders).set({ status: "preparing", preparingAt: now }).where(and8(eq10(orders.id, ticket.orderId), eq10(orders.storeId, input.storeId)));
      if (input.status === "ready") await db.update(orders).set({ readyAt: now }).where(and8(eq10(orders.id, ticket.orderId), eq10(orders.storeId, input.storeId)));
      if (input.status === "cancelled") await db.update(orders).set({ status: "cancelled", cancelledAt: now }).where(and8(eq10(orders.id, ticket.orderId), eq10(orders.storeId, input.storeId)));
      return { ok: true };
    }),
    stockRisk: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const rows = await db.select().from(ingredients).where(eq10(ingredients.storeId, input.storeId)).orderBy(asc(ingredients.currentStock));
      return rows.map((ingredient) => {
        const current = Number(ingredient.currentStock);
        const minimum = Number(ingredient.minimumStock);
        return { ...ingredient, currentStockNumber: current, minStockNumber: minimum, critical: current <= minimum, suggestedPurchase: Math.max(0, minimum * 2 - current) };
      });
    })
  }),
  growth: router({
    settings: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [settings] = await db.select().from(growthSettings).where(eq10(growthSettings.storeId, input.storeId)).limit(1);
      return settings ?? { storeId: input.storeId, cashbackPercent: "0", pointsPerReal: "1", referralReferrerPoints: 100, referralReferredPoints: 50, npsEnabled: true, config: null };
    }),
    saveSettings: staffProcedure.input(z4.object({ storeId: z4.number().int().positive(), cashbackPercent: z4.number().min(0).max(30), pointsPerReal: z4.number().min(0).max(100), referralReferrerPoints: z4.number().int().min(0), referralReferredPoints: z4.number().int().min(0), npsEnabled: z4.boolean() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      await db.insert(growthSettings).values({ storeId: input.storeId, cashbackPercent: input.cashbackPercent.toFixed(2), pointsPerReal: input.pointsPerReal.toFixed(3), referralReferrerPoints: input.referralReferrerPoints, referralReferredPoints: input.referralReferredPoints, npsEnabled: input.npsEnabled }).onDuplicateKeyUpdate({ set: { cashbackPercent: input.cashbackPercent.toFixed(2), pointsPerReal: input.pointsPerReal.toFixed(3), referralReferrerPoints: input.referralReferrerPoints, referralReferredPoints: input.referralReferredPoints, npsEnabled: input.npsEnabled, updatedAt: /* @__PURE__ */ new Date() } });
      return { ok: true };
    }),
    rewards: publicProcedure.input(storeInput).query(async ({ input }) => (await requireDb()).select().from(rewardCatalog).where(and8(eq10(rewardCatalog.storeId, input.storeId), eq10(rewardCatalog.active, true))).orderBy(asc(rewardCatalog.pointsCost))),
    createReward: staffProcedure.input(z4.object({ storeId: z4.number().int().positive(), name: z4.string().min(1).max(160), description: z4.string().optional(), rewardType: z4.enum(["discount", "product", "free_delivery", "cashback"]), pointsCost: z4.number().int().min(0), value: z4.number().min(0), productId: z4.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [result] = await db.insert(rewardCatalog).values({ ...input, description: input.description ?? null, productId: input.productId ?? null, value: input.value.toFixed(2) });
      return { id: Number(result.insertId ?? 0) };
    }),
    updateReward: staffProcedure.input(z4.object({
      storeId: z4.number().int().positive(),
      id: z4.number().int().positive(),
      active: z4.boolean().optional(),
      name: z4.string().min(1).max(160).optional(),
      description: z4.string().max(500).nullable().optional(),
      pointsCost: z4.number().int().min(0).optional(),
      value: z4.number().min(0).optional()
    })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const { id, storeId, value, ...changes } = input;
      await (await requireDb()).update(rewardCatalog).set({
        ...changes,
        ...value !== void 0 ? { value: value.toFixed(2) } : {}
      }).where(and8(eq10(rewardCatalog.id, id), eq10(rewardCatalog.storeId, storeId)));
      return { ok: true };
    }),
    submitNps: protectedProcedure.input(z4.object({ storeId: z4.number().int().positive(), orderId: z4.number().int().positive(), score: z4.number().int().min(0).max(10), comment: z4.string().max(2e3).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [order] = await db.select().from(orders).where(and8(eq10(orders.id, input.orderId), eq10(orders.storeId, input.storeId), eq10(orders.userId, ctx.user.id), eq10(orders.status, "delivered"))).limit(1);
      if (!order) throw new TRPCError6({ code: "FORBIDDEN", message: "Pedido entregue n\xE3o encontrado para esta conta." });
      await db.insert(npsResponses).values({ ...input, userId: ctx.user.id, comment: input.comment ?? null }).onDuplicateKeyUpdate({ set: { score: input.score, comment: input.comment ?? null } });
      return { ok: true };
    }),
    myReferral: protectedProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [existing] = await db.select().from(referrals).where(and8(eq10(referrals.storeId, input.storeId), eq10(referrals.referrerUserId, ctx.user.id), eq10(referrals.status, "pending"))).limit(1);
      if (existing) return existing;
      const code = `IND${ctx.user.id}${nanoid(6)}`.toUpperCase();
      const [result] = await db.insert(referrals).values({ storeId: input.storeId, referrerUserId: ctx.user.id, code });
      return { id: Number(result.insertId ?? 0), storeId: input.storeId, referrerUserId: ctx.user.id, code, status: "pending" };
    })
  }),
  integrations: router({
    health: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const connections = await (await requireDb()).select().from(integrationConnections).where(eq10(integrationConnections.storeId, input.storeId)).orderBy(asc(integrationConnections.provider));
      return { connections, healthy: connections.filter((item) => item.status === "connected").length, degraded: connections.filter((item) => item.status === "degraded" || item.status === "error").length, disconnected: connections.filter((item) => item.status === "disconnected").length };
    }),
    saveConnection: staffProcedure.input(z4.object({ storeId: z4.number().int().positive(), provider: z4.string().min(2).max(64), status: z4.enum(["disconnected", "connecting", "connected", "degraded", "error"]), config: z4.record(z4.string(), z4.unknown()).optional(), credentialsRef: z4.string().max(191).optional() })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const now = /* @__PURE__ */ new Date();
      const data = { storeId: input.storeId, provider: input.provider, status: input.status, config: input.config ? JSON.stringify(input.config) : null, credentialsRef: input.credentialsRef ?? null, lastSuccessAt: input.status === "connected" ? now : null, lastFailureAt: input.status === "error" ? now : null };
      await db.insert(integrationConnections).values(data).onDuplicateKeyUpdate({ set: { status: data.status, config: data.config, credentialsRef: data.credentialsRef, lastSuccessAt: data.lastSuccessAt, lastFailureAt: data.lastFailureAt, updatedAt: now } });
      return { ok: true };
    })
  }),
  intelligence: router({
    dashboard: staffProcedure.input(storeInput).query(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [demandResult] = await db.execute(sql4`SELECT DAYOFWEEK(createdAt) weekday, HOUR(createdAt) hour, COUNT(*) orders, ROUND(SUM(total),2) revenue FROM orders WHERE storeId = ${input.storeId} AND status <> 'cancelled' AND createdAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) GROUP BY DAYOFWEEK(createdAt), HOUR(createdAt) ORDER BY orders DESC LIMIT 24`);
      const [productResult] = await db.execute(sql4`SELECT oi.productId, oi.productName, SUM(oi.quantity) quantity, ROUND(SUM(oi.subtotal),2) revenue, SUM(CASE WHEN o.status='cancelled' THEN oi.quantity ELSE 0 END) cancelledQuantity FROM order_items oi INNER JOIN orders o ON o.id=oi.orderId WHERE o.storeId=${input.storeId} AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 90 DAY) GROUP BY oi.productId, oi.productName ORDER BY revenue DESC LIMIT 50`);
      const [summaryResult] = await db.execute(sql4`SELECT COUNT(*) totalOrders, ROUND(COALESCE(SUM(total),0),2) revenue, ROUND(COALESCE(AVG(total),0),2) averageTicket, SUM(status='cancelled') cancelledOrders, ROUND(COALESCE(AVG(TIMESTAMPDIFF(MINUTE, confirmedAt, readyAt)),0),1) averageKitchenMinutes FROM orders WHERE storeId=${input.storeId} AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
      const suggestions = await db.select().from(intelligenceSuggestions).where(and8(eq10(intelligenceSuggestions.storeId, input.storeId), eq10(intelligenceSuggestions.status, "new"))).orderBy(desc4(intelligenceSuggestions.createdAt)).limit(20);
      return {
        demand: demandResult,
        products: productResult,
        summary: summaryResult[0] ?? {},
        suggestions
      };
    }),
    generateSuggestions: staffProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      const db = await requireDb();
      const [peakRows] = await db.execute(sql4`SELECT DAYOFWEEK(createdAt) weekday, HOUR(createdAt) hour, COUNT(*) count FROM orders WHERE storeId=${input.storeId} AND status <> 'cancelled' AND createdAt >= DATE_SUB(NOW(), INTERVAL 60 DAY) GROUP BY DAYOFWEEK(createdAt), HOUR(createdAt) ORDER BY count DESC LIMIT 1`);
      const [riskRows] = await db.execute(sql4`SELECT name, currentStock, minimumStock FROM ingredients WHERE storeId=${input.storeId} AND currentStock <= minimumStock ORDER BY (minimumStock-currentStock) DESC LIMIT 5`);
      const peak = peakRows[0];
      const risks = riskRows;
      const generated = [
        peak ? { kind: "demand", title: "Preparar opera\xE7\xE3o para o pr\xF3ximo pico", description: `O maior pico recente ocorreu no dia ${peak.weekday}, \xE0s ${peak.hour}h, com ${peak.count} ${Number(peak.count) === 1 ? "pedido" : "pedidos"}. Antecipe massa, embalagem e equipe.`, confidence: "82.00", payload: JSON.stringify(peak) } : null,
        risks.length ? { kind: "purchase", title: "Reposi\xE7\xE3o priorit\xE1ria de estoque", description: `${risks.length} ingredientes est\xE3o no n\xEDvel m\xEDnimo ou abaixo. Gere uma compra antes do pr\xF3ximo pico.`, confidence: "95.00", payload: JSON.stringify(risks) } : null
      ].filter(Boolean);
      if (generated.length) {
        const generatedKinds = generated.map((item) => item.kind);
        await db.update(intelligenceSuggestions).set({ status: "dismissed", updatedAt: /* @__PURE__ */ new Date() }).where(and8(eq10(intelligenceSuggestions.storeId, input.storeId), eq10(intelligenceSuggestions.status, "new"), inArray6(intelligenceSuggestions.kind, generatedKinds)));
        await db.insert(intelligenceSuggestions).values(generated.map((item) => ({ ...item, storeId: input.storeId })));
      }
      return { created: generated.length };
    }),
    updateSuggestion: staffProcedure.input(z4.object({ storeId: z4.number().int().positive(), id: z4.number().int().positive(), status: z4.enum(["accepted", "dismissed", "applied"]) })).mutation(async ({ ctx, input }) => {
      await scopedStoreId(ctx.user, input.storeId);
      await (await requireDb()).update(intelligenceSuggestions).set({ status: input.status }).where(and8(eq10(intelligenceSuggestions.id, input.id), eq10(intelligenceSuggestions.storeId, input.storeId)));
      return { ok: true };
    })
  })
});

// server/routers/siteStudio.ts
init_schema();
import { TRPCError as TRPCError7 } from "@trpc/server";
import { and as and9, desc as desc5, eq as eq11, inArray as inArray7, sql as sql5 } from "drizzle-orm";
import { z as z5 } from "zod";

// shared/siteBuilder.ts
var SITE_PAGE_KEYS = ["home", "menu", "club", "landing"];
var SITE_BLOCK_TYPES = ["hero", "quickLinks", "promotions", "categories", "featuredProducts", "coupons", "club", "testimonials", "location", "cta"];
var DEFAULT_SITE_THEME = {
  primary: "#e51b23",
  accent: "#ffca28",
  dark: "#171210",
  surface: "#f8f3ee",
  text: "#211b18",
  headingFont: "brand",
  bodyFont: "brand",
  buttonStyle: "pill",
  contentWidth: "standard"
};
function createSiteBlock(type, id = `${type}-${Date.now()}`) {
  const defaults = {
    hero: { eyebrow: "Pizza n\xE3o. Bonatto!", title: "Sabor que chega at\xE9 voc\xEA", description: "Escolha seus favoritos e pe\xE7a em poucos toques.", buttonLabel: "Ver card\xE1pio", buttonHref: "/cardapio", imageUrl: "" },
    quickLinks: { title: "Encontre r\xE1pido" },
    promotions: { title: "Promo\xE7\xF5es", limit: 6 },
    categories: { title: "Categorias", limit: 8 },
    featuredProducts: { title: "Mais pedidos", limit: 8 },
    coupons: { title: "Cupons para aproveitar", limit: 6 },
    club: { title: "Recompensas do Clube", description: "Seus pontos valem sabor." },
    testimonials: { title: "Quem prova, recomenda", quote: "Experi\xEAncia incr\xEDvel, pedido r\xE1pido e comida deliciosa.", author: "Cliente da casa" },
    location: { title: "Onde estamos", showHours: true, address: "Configure o endere\xE7o da sua loja" },
    cta: { title: "Pronto para pedir?", description: "Monte seu pedido agora.", buttonLabel: "Fazer pedido", buttonHref: "/cardapio" }
  };
  return {
    id,
    type,
    visible: true,
    props: defaults[type],
    style: { background: "transparent", color: "inherit", spacing: "normal", radius: "large" },
    responsive: { desktop: {}, tablet: {}, mobile: {} }
  };
}
var DEFAULT_HOME_DOCUMENT = {
  schemaVersion: 1,
  theme: DEFAULT_SITE_THEME,
  blocks: ["hero", "quickLinks", "promotions", "categories", "featuredProducts", "coupons", "club", "testimonials", "cta"].map((type, index2) => createSiteBlock(type, `${type}-${index2 + 1}`))
};
function parseSiteDocument(value) {
  if (!value || typeof value !== "object") return DEFAULT_HOME_DOCUMENT;
  const candidate = value;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.blocks)) return DEFAULT_HOME_DOCUMENT;
  const blocks = candidate.blocks.filter((block) => Boolean(block && SITE_BLOCK_TYPES.includes(block.type) && typeof block.id === "string")).map((block) => ({
    ...block,
    style: {
      background: block.style?.background ?? "transparent",
      color: block.style?.color ?? "inherit",
      spacing: block.style?.spacing ?? "normal",
      radius: block.style?.radius ?? "large"
    },
    responsive: {
      desktop: block.responsive?.desktop ?? {},
      tablet: block.responsive?.tablet ?? {},
      mobile: block.responsive?.mobile ?? {}
    }
  }));
  const theme = candidate.theme && typeof candidate.theme === "object" ? { ...DEFAULT_SITE_THEME, ...candidate.theme } : DEFAULT_SITE_THEME;
  return { schemaVersion: 1, theme, blocks };
}

// server/routers/siteStudio.ts
init_db();
function parseStoredDocument(content) {
  try {
    return parseSiteDocument(JSON.parse(content));
  } catch {
    return DEFAULT_HOME_DOCUMENT;
  }
}
var pageKeySchema = z5.enum(SITE_PAGE_KEYS);
var styleSchema = z5.object({
  background: z5.string().max(40),
  color: z5.string().max(40),
  spacing: z5.enum(["compact", "normal", "wide"]),
  radius: z5.enum(["none", "medium", "large"])
});
var responsiveSettingSchema = z5.object({
  spacing: z5.enum(["compact", "normal", "wide"]).optional(),
  hidden: z5.boolean().optional()
});
var themeSchema = z5.object({
  primary: z5.string().max(40),
  accent: z5.string().max(40),
  dark: z5.string().max(40),
  surface: z5.string().max(40),
  text: z5.string().max(40),
  headingFont: z5.enum(["brand", "modern", "classic"]),
  bodyFont: z5.enum(["brand", "modern", "friendly"]),
  buttonStyle: z5.enum(["pill", "rounded", "square"]),
  contentWidth: z5.enum(["compact", "standard", "wide"])
});
var documentSchema = z5.object({
  schemaVersion: z5.literal(1),
  theme: themeSchema,
  blocks: z5.array(z5.object({
    id: z5.string().min(1).max(100),
    type: z5.enum(SITE_BLOCK_TYPES),
    visible: z5.boolean(),
    props: z5.record(z5.string(), z5.union([z5.string().max(4e3), z5.number(), z5.boolean()])),
    style: styleSchema,
    responsive: z5.object({ desktop: responsiveSettingSchema.optional(), tablet: responsiveSettingSchema.optional(), mobile: responsiveSettingSchema.optional() }).optional()
  })).max(80)
});
async function requireDb2() {
  const db = await getDb();
  if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return db;
}
async function requireSiteAccess(user, storeId, write = false) {
  const db = await requireDb2();
  const [store] = await db.select({ id: stores.id, tenantKey: stores.tenantKey }).from(stores).where(eq11(stores.id, storeId)).limit(1);
  if (!store) throw new TRPCError7({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
  if (user.role === "admin") return store;
  const [direct, membership] = await Promise.all([
    db.select({ id: storeManagers.id }).from(storeManagers).where(and9(eq11(storeManagers.storeId, storeId), eq11(storeManagers.userId, user.id))).limit(1),
    db.select({ role: tenantMemberships.role }).from(tenantMemberships).where(and9(eq11(tenantMemberships.tenantKey, store.tenantKey), eq11(tenantMemberships.userId, user.id), eq11(tenantMemberships.active, true))).limit(1)
  ]);
  const role = membership[0]?.role;
  const allowed = direct.length > 0 || role === "owner" || role === "admin" || role === "site_editor" || !write && role === "marketing";
  if (!allowed) throw new TRPCError7({ code: "FORBIDDEN", message: "Voc\xEA n\xE3o tem acesso ao Studio desta marca." });
  return store;
}
async function ensurePage(storeId, pageKey, userId) {
  const db = await requireDb2();
  const [existing] = await db.select().from(tenantSitePages).where(and9(eq11(tenantSitePages.storeId, storeId), eq11(tenantSitePages.pageKey, pageKey))).limit(1);
  if (existing) return existing;
  const content = JSON.stringify(DEFAULT_HOME_DOCUMENT);
  const [result] = await db.insert(tenantSitePages).values({ storeId, pageKey, title: pageKey === "home" ? "P\xE1gina inicial" : pageKey, draftContent: content, updatedByUserId: userId });
  const id = Number(result.insertId);
  const [created] = await db.select().from(tenantSitePages).where(eq11(tenantSitePages.id, id)).limit(1);
  if (!created) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar a p\xE1gina." });
  return created;
}
var siteStudioRouter = router({
  mySites: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb2();
    if (ctx.user.role === "admin") return db.select({ id: stores.id, name: stores.name, slug: stores.slug, tenantKey: stores.tenantKey }).from(stores).where(eq11(stores.active, true));
    const [memberships, direct] = await Promise.all([
      db.select({ tenantKey: tenantMemberships.tenantKey, membershipRole: tenantMemberships.role }).from(tenantMemberships).where(and9(eq11(tenantMemberships.userId, ctx.user.id), eq11(tenantMemberships.active, true))),
      db.select({ storeId: storeManagers.storeId }).from(storeManagers).where(eq11(storeManagers.userId, ctx.user.id))
    ]);
    const tenantKeys = memberships.filter((item) => ["owner", "admin", "site_editor", "marketing"].includes(item.membershipRole)).map((item) => item.tenantKey);
    const clauses = [direct.length ? inArray7(stores.id, direct.map((item) => item.storeId)) : void 0, tenantKeys.length ? inArray7(stores.tenantKey, tenantKeys) : void 0].filter(Boolean);
    if (!clauses.length) return [];
    const rows = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, tenantKey: stores.tenantKey }).from(stores).where(clauses.length === 1 ? clauses[0] : sql5`(${clauses[0]} OR ${clauses[1]})`);
    return rows;
  }),
  workspace: protectedProcedure.input(z5.object({ storeId: z5.number().int().positive(), pageKey: pageKeySchema })).query(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId);
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const versions = await (await requireDb2()).select().from(tenantSitePageVersions).where(eq11(tenantSitePageVersions.pageId, page.id)).orderBy(desc5(tenantSitePageVersions.versionNumber)).limit(30);
    return { ...page, draft: parseStoredDocument(page.draftContent), versions };
  }),
  published: publicProcedure.input(z5.object({ storeId: z5.number().int().positive(), pageKey: pageKeySchema })).query(async ({ input }) => {
    const db = await requireDb2();
    const [page] = await db.select().from(tenantSitePages).where(and9(eq11(tenantSitePages.storeId, input.storeId), eq11(tenantSitePages.pageKey, input.pageKey))).limit(1);
    if (!page?.publishedVersionId) return null;
    const [version] = await db.select().from(tenantSitePageVersions).where(and9(eq11(tenantSitePageVersions.id, page.publishedVersionId), eq11(tenantSitePageVersions.pageId, page.id))).limit(1);
    return version ? { pageId: page.id, versionId: version.id, document: parseStoredDocument(version.content) } : null;
  }),
  saveDraft: protectedProcedure.input(z5.object({ storeId: z5.number().int().positive(), pageKey: pageKeySchema, title: z5.string().min(1).max(160), document: documentSchema })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    await (await requireDb2()).update(tenantSitePages).set({ title: input.title, draftContent: JSON.stringify(input.document), updatedByUserId: ctx.user.id, updatedAt: /* @__PURE__ */ new Date() }).where(eq11(tenantSitePages.id, page.id));
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.draft_saved", resourceType: "site_page", resourceId: page.id, metadata: { pageKey: input.pageKey, blockCount: input.document.blocks.length } });
    return { ok: true, updatedAt: /* @__PURE__ */ new Date() };
  }),
  publish: protectedProcedure.input(z5.object({ storeId: z5.number().int().positive(), pageKey: pageKeySchema, note: z5.string().max(240).optional() })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const db = await requireDb2();
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const [maxRow] = await db.select({ value: sql5`COALESCE(MAX(${tenantSitePageVersions.versionNumber}), 0)` }).from(tenantSitePageVersions).where(eq11(tenantSitePageVersions.pageId, page.id));
    const versionNumber = Number(maxRow?.value ?? 0) + 1;
    const [result] = await db.insert(tenantSitePageVersions).values({ pageId: page.id, versionNumber, content: page.draftContent, note: input.note ?? null, createdByUserId: ctx.user.id });
    const versionId = Number(result.insertId);
    await db.update(tenantSitePages).set({ publishedVersionId: versionId, updatedByUserId: ctx.user.id }).where(eq11(tenantSitePages.id, page.id));
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.published", resourceType: "site_page", resourceId: page.id, metadata: { pageKey: input.pageKey, versionId, versionNumber } });
    return { ok: true, versionId, versionNumber };
  }),
  restore: protectedProcedure.input(z5.object({ storeId: z5.number().int().positive(), pageKey: pageKeySchema, versionId: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const db = await requireDb2();
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const [version] = await db.select().from(tenantSitePageVersions).where(and9(eq11(tenantSitePageVersions.id, input.versionId), eq11(tenantSitePageVersions.pageId, page.id))).limit(1);
    if (!version) throw new TRPCError7({ code: "NOT_FOUND", message: "Vers\xE3o n\xE3o encontrada." });
    await db.update(tenantSitePages).set({ draftContent: version.content, updatedByUserId: ctx.user.id }).where(eq11(tenantSitePages.id, page.id));
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.version_restored", resourceType: "site_page", resourceId: page.id, metadata: { pageKey: input.pageKey, versionId: input.versionId } });
    return { ok: true };
  }),
  grantEditor: adminProcedure.input(z5.object({ storeId: z5.number().int().positive(), email: z5.string().email(), role: z5.enum(["site_editor", "marketing"]) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb2();
    const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq11(stores.id, input.storeId)).limit(1);
    const [user] = await db.select({ id: users.id }).from(users).where(eq11(users.email, input.email)).limit(1);
    if (!store || !user) throw new TRPCError7({ code: "NOT_FOUND", message: "Loja ou usu\xE1rio n\xE3o encontrado." });
    await db.insert(tenantMemberships).values({ tenantKey: store.tenantKey, userId: user.id, role: input.role, active: true }).onDuplicateKeyUpdate({ set: { role: input.role, active: true, updatedAt: /* @__PURE__ */ new Date() } });
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.editor_granted", resourceType: "tenant_membership", resourceId: user.id, metadata: { role: input.role, email: input.email } });
    return { ok: true, grantedBy: ctx.user.id };
  })
});

// server/routers/rewards.ts
import { z as z6 } from "zod";

// server/services/rewards.ts
init_schema();
init_db();
import { randomBytes } from "node:crypto";
import { TRPCError as TRPCError8 } from "@trpc/server";
import { and as and10, asc as asc2, desc as desc6, eq as eq12, gt as gt2, inArray as inArray8, isNull as isNull3, or as or4, sql as sql6 } from "drizzle-orm";
function validateRewardRules(input, current) {
  const rewardType = input.rewardType ?? current?.rewardType;
  const productId = input.productId !== void 0 ? input.productId : current?.productId;
  const value = input.value !== void 0 ? input.value : Number(current?.value ?? 0);
  const startsAt = input.startsAt !== void 0 ? input.startsAt : current?.startsAt;
  const expiresAt = input.expiresAt !== void 0 ? input.expiresAt : current?.expiresAt;
  const stock = input.stock !== void 0 ? input.stock : current?.stock;
  if (rewardType === "product" && !productId) {
    throw new TRPCError8({ code: "BAD_REQUEST", message: "Selecione o produto entregue por esta recompensa." });
  }
  if ((rewardType === "discount" || rewardType === "cashback") && Number(value) <= 0) {
    throw new TRPCError8({ code: "BAD_REQUEST", message: "Informe um valor de benef\xEDcio maior que zero." });
  }
  if (startsAt && expiresAt && startsAt >= expiresAt) {
    throw new TRPCError8({ code: "BAD_REQUEST", message: "A expira\xE7\xE3o deve ser posterior \xE0 data de in\xEDcio." });
  }
  if (stock !== null && stock !== void 0 && current && stock < current.totalRedemptions) {
    throw new TRPCError8({ code: "BAD_REQUEST", message: "O estoque n\xE3o pode ser menor que a quantidade j\xE1 resgatada." });
  }
}
function duplicateError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|ER_DUP_ENTRY/i.test(message);
}
function requireDatabase(database) {
  if (!database) {
    throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  }
}
function maskRewardCoupon(code) {
  if (code.length <= 6) return `${code.slice(0, 2)}\u2022\u2022\u2022\u2022`;
  return `${code.slice(0, 4)}\u2022\u2022\u2022\u2022${code.slice(-2)}`;
}
function normalizeRewardCouponCode(code) {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9-]{4,64}$/.test(normalized)) {
    throw new TRPCError8({
      code: "BAD_REQUEST",
      message: "Cada c\xF3digo deve ter de 4 a 64 caracteres e usar apenas letras, n\xFAmeros ou h\xEDfen."
    });
  }
  return normalized;
}
function normalizeRewardCouponBatch(inputCodes) {
  const normalized = inputCodes.map(normalizeRewardCouponCode);
  const seen = /* @__PURE__ */ new Set();
  const duplicates = /* @__PURE__ */ new Set();
  for (const code of normalized) {
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }
  if (duplicates.size > 0) {
    throw new TRPCError8({
      code: "CONFLICT",
      message: `C\xF3digos repetidos no arquivo: ${[...duplicates].slice(0, 5).join(", ")}${duplicates.size > 5 ? "..." : ""}`
    });
  }
  return normalized;
}
function resolveRewardAvailability(input, now = /* @__PURE__ */ new Date()) {
  if (!input.active || input.archivedAt) return "inactive";
  if (input.startsAt && input.startsAt > now) return "upcoming";
  if (input.expiresAt && input.expiresAt <= now) return "expired";
  if (input.stock !== null && input.totalRedemptions >= input.stock) return "sold_out";
  if (input.availableCoupons <= 0) return "sold_out";
  if (input.maxRedemptionsPerUser !== null && (input.userRedemptions ?? 0) >= input.maxRedemptionsPerUser) {
    return "limit_reached";
  }
  if (input.balance !== void 0 && input.balance < input.pointsCost) return "insufficient_points";
  return "available";
}
async function couponStatsByReward(storeId) {
  const db = await getDb();
  requireDatabase(db);
  const [rows, availableRows] = await Promise.all([
    db.select({
      rewardId: rewardCoupons.rewardId,
      status: rewardCoupons.status,
      total: sql6`COUNT(*)`
    }).from(rewardCoupons).where(eq12(rewardCoupons.storeId, storeId)).groupBy(rewardCoupons.rewardId, rewardCoupons.status),
    db.select({ rewardId: rewardCoupons.rewardId, total: sql6`COUNT(*)` }).from(rewardCoupons).where(and10(
      eq12(rewardCoupons.storeId, storeId),
      eq12(rewardCoupons.status, "available"),
      or4(isNull3(rewardCoupons.expiresAt), gt2(rewardCoupons.expiresAt, /* @__PURE__ */ new Date()))
    )).groupBy(rewardCoupons.rewardId)
  ]);
  const stats = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = stats.get(row.rewardId) ?? {};
    current[row.status] = Number(row.total);
    stats.set(row.rewardId, current);
  }
  for (const row of availableRows) {
    const current = stats.get(row.rewardId) ?? {};
    current.available = Number(row.total);
    stats.set(row.rewardId, current);
  }
  return stats;
}
async function listRewards(storeId, userId) {
  const db = await getDb();
  requireDatabase(db);
  const now = /* @__PURE__ */ new Date();
  const [rows, couponStats, balance, userCounts] = await Promise.all([
    db.select().from(rewardCatalog).where(and10(
      eq12(rewardCatalog.storeId, storeId),
      eq12(rewardCatalog.active, true),
      isNull3(rewardCatalog.archivedAt)
    )).orderBy(desc6(rewardCatalog.featured), asc2(rewardCatalog.sortOrder), asc2(rewardCatalog.pointsCost)),
    couponStatsByReward(storeId),
    userId ? getUserLoyaltyPoints(userId, storeId) : Promise.resolve(void 0),
    userId ? db.select({ rewardId: rewardRedemptions.rewardId, total: sql6`COUNT(*)` }).from(rewardRedemptions).where(and10(
      eq12(rewardRedemptions.storeId, storeId),
      eq12(rewardRedemptions.userId, userId),
      eq12(rewardRedemptions.status, "completed")
    )).groupBy(rewardRedemptions.rewardId) : Promise.resolve([])
  ]);
  const userCountMap = new Map(userCounts.map((item) => [item.rewardId, Number(item.total)]));
  return rows.map((reward) => {
    const stats = couponStats.get(reward.id) ?? {};
    const availableCoupons = Number(stats.available ?? 0);
    const userRedemptions = userCountMap.get(reward.id) ?? 0;
    return {
      ...reward,
      availableCoupons,
      userRedemptions,
      balance: balance ?? null,
      availability: resolveRewardAvailability({
        ...reward,
        balance,
        userRedemptions,
        availableCoupons
      }, now)
    };
  });
}
async function getRewardDetail(storeId, rewardId, userId) {
  const rewards = await listRewards(storeId, userId);
  return rewards.find((reward) => reward.id === rewardId) ?? null;
}
async function listRewardsForAdmin(storeId) {
  const db = await getDb();
  requireDatabase(db);
  const [rows, stats] = await Promise.all([
    db.select().from(rewardCatalog).where(eq12(rewardCatalog.storeId, storeId)).orderBy(asc2(rewardCatalog.archivedAt), asc2(rewardCatalog.sortOrder), desc6(rewardCatalog.createdAt)),
    couponStatsByReward(storeId)
  ]);
  return rows.map((reward) => ({
    ...reward,
    couponStats: {
      available: Number(stats.get(reward.id)?.available ?? 0),
      reserved: Number(stats.get(reward.id)?.reserved ?? 0),
      redeemed: Number(stats.get(reward.id)?.redeemed ?? 0),
      used: Number(stats.get(reward.id)?.used ?? 0),
      expired: Number(stats.get(reward.id)?.expired ?? 0),
      cancelled: Number(stats.get(reward.id)?.cancelled ?? 0)
    }
  }));
}
async function createReward(storeId, input) {
  const db = await getDb();
  requireDatabase(db);
  validateRewardRules(input);
  const [result] = await db.insert(rewardCatalog).values({
    storeId,
    name: input.name,
    description: input.description ?? null,
    rewardType: input.rewardType,
    pointsCost: input.pointsCost,
    value: input.value.toFixed(2),
    productId: input.productId ?? null,
    category: input.category ?? null,
    icon: input.icon ?? null,
    imageUrl: input.imageUrl ?? null,
    badgeText: input.badgeText ?? null,
    buttonText: input.buttonText?.trim() || "Resgatar",
    stock: input.stock ?? null,
    maxRedemptionsPerUser: input.maxRedemptionsPerUser ?? null,
    active: input.active ?? true,
    featured: input.featured ?? false,
    sortOrder: input.sortOrder ?? 0,
    startsAt: input.startsAt ?? null,
    expiresAt: input.expiresAt ?? null
  });
  return Number(result.insertId ?? 0);
}
async function updateReward(storeId, rewardId, input) {
  const db = await getDb();
  requireDatabase(db);
  const [current] = await db.select().from(rewardCatalog).where(and10(eq12(rewardCatalog.id, rewardId), eq12(rewardCatalog.storeId, storeId))).limit(1);
  if (!current) throw new TRPCError8({ code: "NOT_FOUND", message: "Recompensa n\xE3o encontrada." });
  validateRewardRules(input, current);
  const { value, buttonText, ...otherChanges } = input;
  const changes = {
    ...otherChanges,
    ...value !== void 0 ? { value: value.toFixed(2) } : {},
    ...buttonText !== void 0 ? { buttonText: buttonText?.trim() || "Resgatar" } : {},
    updatedAt: /* @__PURE__ */ new Date()
  };
  await db.update(rewardCatalog).set(changes).where(eq12(rewardCatalog.id, rewardId));
  return current;
}
async function archiveReward(storeId, rewardId) {
  const db = await getDb();
  requireDatabase(db);
  const [current] = await db.select().from(rewardCatalog).where(and10(eq12(rewardCatalog.id, rewardId), eq12(rewardCatalog.storeId, storeId))).limit(1);
  if (!current) throw new TRPCError8({ code: "NOT_FOUND", message: "Recompensa n\xE3o encontrada." });
  await db.update(rewardCatalog).set({ active: false, archivedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq12(rewardCatalog.id, rewardId));
  return current;
}
async function addRewardCoupons(input) {
  const db = await getDb();
  requireDatabase(db);
  const codes = normalizeRewardCouponBatch(input.codes);
  if (!codes.length) throw new TRPCError8({ code: "BAD_REQUEST", message: "Informe pelo menos um c\xF3digo." });
  if (codes.length > 1e3) throw new TRPCError8({ code: "BAD_REQUEST", message: "Importe no m\xE1ximo 1.000 c\xF3digos por vez." });
  return db.transaction(async (tx) => {
    const [reward] = await tx.select({ id: rewardCatalog.id }).from(rewardCatalog).where(and10(eq12(rewardCatalog.id, input.rewardId), eq12(rewardCatalog.storeId, input.storeId))).limit(1);
    if (!reward) throw new TRPCError8({ code: "NOT_FOUND", message: "Recompensa n\xE3o encontrada." });
    const [existingRewardCodes, existingOrderCoupons] = await Promise.all([
      tx.select({ code: rewardCoupons.code }).from(rewardCoupons).where(and10(eq12(rewardCoupons.storeId, input.storeId), inArray8(rewardCoupons.code, codes))),
      tx.select({ code: coupons.code }).from(coupons).where(and10(eq12(coupons.storeId, input.storeId), inArray8(coupons.code, codes)))
    ]);
    const duplicateCodes = Array.from(/* @__PURE__ */ new Set([
      ...existingRewardCodes.map((item) => item.code),
      ...existingOrderCoupons.map((item) => item.code)
    ]));
    if (duplicateCodes.length) {
      throw new TRPCError8({
        code: "CONFLICT",
        message: `C\xF3digos duplicados: ${duplicateCodes.slice(0, 5).join(", ")}${duplicateCodes.length > 5 ? "..." : ""}`
      });
    }
    await tx.insert(rewardCoupons).values(codes.map((code) => ({
      storeId: input.storeId,
      rewardId: input.rewardId,
      code,
      expiresAt: input.expiresAt ?? null
    })));
    return { inserted: codes.length };
  });
}
async function generateRewardCoupons(input) {
  const prefix = input.prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = /* @__PURE__ */ new Set();
  while (codes.size < input.quantity) {
    const bytes = randomBytes(input.codeLength);
    let suffix = "";
    for (let index2 = 0; index2 < input.codeLength; index2 += 1) {
      suffix += alphabet[bytes[index2] % alphabet.length];
    }
    codes.add(`${prefix}${suffix}`);
  }
  await addRewardCoupons({ ...input, codes: [...codes] });
  return { inserted: codes.size };
}
async function listRewardCoupons(storeId, rewardId) {
  const db = await getDb();
  requireDatabase(db);
  const rows = await db.select({
    id: rewardCoupons.id,
    code: rewardCoupons.code,
    status: rewardCoupons.status,
    assignedUserId: rewardCoupons.assignedUserId,
    userName: users.name,
    userEmail: users.email,
    redemptionId: rewardCoupons.redemptionId,
    reservedAt: rewardCoupons.reservedAt,
    redeemedAt: rewardCoupons.redeemedAt,
    usedAt: rewardCoupons.usedAt,
    expiresAt: rewardCoupons.expiresAt,
    createdAt: rewardCoupons.createdAt
  }).from(rewardCoupons).leftJoin(users, eq12(users.id, rewardCoupons.assignedUserId)).where(and10(eq12(rewardCoupons.storeId, storeId), eq12(rewardCoupons.rewardId, rewardId))).orderBy(desc6(rewardCoupons.createdAt));
  return rows.map((row) => ({ ...row, maskedCode: maskRewardCoupon(row.code), code: void 0 }));
}
async function revealRewardCoupon(storeId, couponId) {
  const db = await getDb();
  requireDatabase(db);
  const [coupon] = await db.select({ id: rewardCoupons.id, code: rewardCoupons.code, rewardId: rewardCoupons.rewardId }).from(rewardCoupons).where(and10(eq12(rewardCoupons.storeId, storeId), eq12(rewardCoupons.id, couponId))).limit(1);
  if (!coupon) throw new TRPCError8({ code: "NOT_FOUND", message: "Cupom n\xE3o encontrado." });
  return coupon;
}
async function redemptionResult(redemptionId, userId) {
  const db = await getDb();
  requireDatabase(db);
  const [row] = await db.select({
    id: rewardRedemptions.id,
    rewardId: rewardRedemptions.rewardId,
    rewardName: rewardCatalog.name,
    rewardDescription: rewardCatalog.description,
    couponId: rewardRedemptions.couponId,
    couponCode: rewardCoupons.code,
    pointsSpent: rewardRedemptions.pointsSpent,
    status: rewardRedemptions.status,
    redeemedAt: rewardRedemptions.redeemedAt,
    expiresAt: rewardRedemptions.expiresAt
  }).from(rewardRedemptions).innerJoin(rewardCatalog, eq12(rewardCatalog.id, rewardRedemptions.rewardId)).leftJoin(rewardCoupons, eq12(rewardCoupons.id, rewardRedemptions.couponId)).where(and10(eq12(rewardRedemptions.id, redemptionId), eq12(rewardRedemptions.userId, userId))).limit(1);
  if (!row) throw new TRPCError8({ code: "NOT_FOUND", message: "Resgate n\xE3o encontrado." });
  return row;
}
async function redeemReward(input) {
  const db = await getDb();
  requireDatabase(db);
  const scope = await getTenantScope(input.storeId);
  await getTenantCustomerAccount(input.userId, input.storeId);
  const [existing] = await db.select({ id: rewardRedemptions.id }).from(rewardRedemptions).where(and10(
    eq12(rewardRedemptions.storeId, input.storeId),
    eq12(rewardRedemptions.userId, input.userId),
    eq12(rewardRedemptions.idempotencyKey, input.idempotencyKey)
  )).limit(1);
  if (existing) return { ...await redemptionResult(existing.id, input.userId), idempotent: true };
  try {
    const redemptionId = await db.transaction(async (tx) => {
      const now = /* @__PURE__ */ new Date();
      const [reward] = await tx.select().from(rewardCatalog).where(and10(eq12(rewardCatalog.id, input.rewardId), eq12(rewardCatalog.storeId, input.storeId))).limit(1).for("update");
      if (!reward || reward.archivedAt || !reward.active) {
        throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Recompensa indispon\xEDvel." });
      }
      if (reward.startsAt && reward.startsAt > now) {
        throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Esta recompensa ainda n\xE3o come\xE7ou." });
      }
      if (reward.expiresAt && reward.expiresAt <= now) {
        throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Esta recompensa expirou." });
      }
      if (reward.stock !== null && reward.totalRedemptions >= reward.stock) {
        throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Recompensa esgotada." });
      }
      const [account] = await tx.select().from(tenantCustomerAccounts).where(and10(eq12(tenantCustomerAccounts.tenantKey, scope.tenantKey), eq12(tenantCustomerAccounts.userId, input.userId))).limit(1).for("update");
      if (!account || account.loyaltyPoints < reward.pointsCost) {
        throw new TRPCError8({
          code: "PRECONDITION_FAILED",
          message: `Saldo insuficiente. S\xE3o necess\xE1rios ${reward.pointsCost} pontos.`
        });
      }
      if (reward.maxRedemptionsPerUser !== null) {
        const [countRow] = await tx.select({ total: sql6`COUNT(*)` }).from(rewardRedemptions).where(and10(
          eq12(rewardRedemptions.storeId, input.storeId),
          eq12(rewardRedemptions.rewardId, reward.id),
          eq12(rewardRedemptions.userId, input.userId),
          eq12(rewardRedemptions.status, "completed")
        ));
        if (Number(countRow?.total ?? 0) >= reward.maxRedemptionsPerUser) {
          throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Limite de resgates atingido." });
        }
      }
      const [coupon] = await tx.select().from(rewardCoupons).where(and10(
        eq12(rewardCoupons.storeId, input.storeId),
        eq12(rewardCoupons.rewardId, reward.id),
        eq12(rewardCoupons.status, "available"),
        or4(isNull3(rewardCoupons.expiresAt), gt2(rewardCoupons.expiresAt, now))
      )).orderBy(asc2(rewardCoupons.id)).limit(1).for("update");
      if (!coupon) {
        throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "N\xE3o h\xE1 cupons dispon\xEDveis para esta recompensa." });
      }
      const balanceBefore = account.loyaltyPoints;
      const balanceAfter = balanceBefore - reward.pointsCost;
      const [insertResult] = await tx.insert(rewardRedemptions).values({
        storeId: input.storeId,
        rewardId: reward.id,
        userId: input.userId,
        pointsSpent: reward.pointsCost,
        status: "pending",
        idempotencyKey: input.idempotencyKey,
        expiresAt: coupon.expiresAt ?? reward.expiresAt ?? null
      });
      const redemptionId2 = Number(insertResult.insertId ?? 0);
      if (!redemptionId2) throw new Error("Falha ao criar o resgate.");
      await tx.update(tenantCustomerAccounts).set({ loyaltyPoints: balanceAfter }).where(eq12(tenantCustomerAccounts.id, account.id));
      if (scope.tenantKey === "bonatto") {
        await tx.update(users).set({ loyaltyPoints: balanceAfter }).where(eq12(users.id, input.userId));
      }
      await tx.insert(loyaltyTransactions).values({
        tenantKey: scope.tenantKey,
        storeId: input.storeId,
        userId: input.userId,
        type: "redeem",
        points: -reward.pointsCost,
        description: `Resgate: ${reward.name}`,
        balanceBefore,
        balanceAfter
      });
      await tx.update(rewardCoupons).set({
        status: "redeemed",
        assignedUserId: input.userId,
        redemptionId: redemptionId2,
        reservedAt: now,
        redeemedAt: now
      }).where(and10(eq12(rewardCoupons.id, coupon.id), eq12(rewardCoupons.status, "available")));
      await tx.update(rewardRedemptions).set({ couponId: coupon.id, status: "completed" }).where(eq12(rewardRedemptions.id, redemptionId2));
      await tx.update(rewardCatalog).set({
        totalRedemptions: sql6`${rewardCatalog.totalRedemptions} + 1`,
        updatedAt: now
      }).where(eq12(rewardCatalog.id, reward.id));
      return redemptionId2;
    });
    return { ...await redemptionResult(redemptionId, input.userId), idempotent: false };
  } catch (error) {
    if (duplicateError(error)) {
      const [duplicate] = await db.select({ id: rewardRedemptions.id }).from(rewardRedemptions).where(and10(
        eq12(rewardRedemptions.storeId, input.storeId),
        eq12(rewardRedemptions.userId, input.userId),
        eq12(rewardRedemptions.idempotencyKey, input.idempotencyKey)
      )).limit(1);
      if (duplicate) return { ...await redemptionResult(duplicate.id, input.userId), idempotent: true };
    }
    throw error;
  }
}
async function listMyRedemptions(storeId, userId) {
  const db = await getDb();
  requireDatabase(db);
  return db.select({
    id: rewardRedemptions.id,
    rewardId: rewardRedemptions.rewardId,
    rewardName: rewardCatalog.name,
    rewardDescription: rewardCatalog.description,
    rewardType: rewardCatalog.rewardType,
    couponCode: rewardCoupons.code,
    couponStatus: rewardCoupons.status,
    pointsSpent: rewardRedemptions.pointsSpent,
    status: rewardRedemptions.status,
    redeemedAt: rewardRedemptions.redeemedAt,
    expiresAt: rewardRedemptions.expiresAt,
    usedAt: rewardCoupons.usedAt
  }).from(rewardRedemptions).innerJoin(rewardCatalog, eq12(rewardCatalog.id, rewardRedemptions.rewardId)).leftJoin(rewardCoupons, eq12(rewardCoupons.id, rewardRedemptions.couponId)).where(and10(eq12(rewardRedemptions.storeId, storeId), eq12(rewardRedemptions.userId, userId))).orderBy(desc6(rewardRedemptions.createdAt));
}
async function getMyRewardsOverview(storeId, userId) {
  const [rewards, redemptions, balance] = await Promise.all([
    listRewards(storeId, userId),
    listMyRedemptions(storeId, userId),
    getUserLoyaltyPoints(userId, storeId)
  ]);
  return { rewards, redemptions, balance };
}
async function rewardCouponContext(storeId, userId, code) {
  const db = await getDb();
  requireDatabase(db);
  const normalized = normalizeRewardCouponCode(code);
  const [row] = await db.select({
    coupon: rewardCoupons,
    redemption: rewardRedemptions,
    reward: rewardCatalog
  }).from(rewardCoupons).innerJoin(rewardRedemptions, eq12(rewardRedemptions.id, rewardCoupons.redemptionId)).innerJoin(rewardCatalog, eq12(rewardCatalog.id, rewardCoupons.rewardId)).where(and10(
    eq12(rewardCoupons.storeId, storeId),
    eq12(rewardCoupons.code, normalized),
    eq12(rewardCoupons.assignedUserId, userId)
  )).limit(1);
  if (!row) throw new TRPCError8({ code: "NOT_FOUND", message: "Cupom de recompensa n\xE3o encontrado." });
  const now = /* @__PURE__ */ new Date();
  if (row.coupon.status !== "redeemed" || row.redemption.status !== "completed") {
    throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Cupom indispon\xEDvel ou j\xE1 utilizado." });
  }
  if (row.coupon.expiresAt && row.coupon.expiresAt <= now || row.redemption.expiresAt && row.redemption.expiresAt <= now) {
    throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Cupom expirado." });
  }
  return row;
}
function calculateRewardBenefit(input) {
  const value = Number(input.value);
  let discount = 0;
  let freeDelivery = false;
  if (input.rewardType === "free_delivery") {
    freeDelivery = true;
  } else if (input.rewardType === "product") {
    if (!input.productId) {
      throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Produto da recompensa n\xE3o configurado." });
    }
    const eligible = input.items.filter((item) => item.productId === input.productId);
    if (!eligible.length) {
      throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Adicione o produto da recompensa ao pedido." });
    }
    const eligibleTotal = eligible.reduce((sum, item) => sum + Number(item.productPrice) * item.quantity, 0);
    discount = Math.min(eligibleTotal, value > 0 ? value : eligibleTotal);
  } else {
    discount = Math.min(input.subtotal, Math.max(0, value));
  }
  return {
    couponId: input.couponId,
    redemptionId: input.redemptionId,
    rewardId: input.rewardId,
    rewardType: input.rewardType,
    discount,
    freeDelivery,
    description: input.rewardName
  };
}
function rewardBenefit(row, subtotal, items) {
  return calculateRewardBenefit({
    couponId: row.coupon.id,
    redemptionId: row.redemption.id,
    rewardId: row.reward.id,
    rewardType: row.reward.rewardType,
    rewardName: row.reward.name,
    value: row.reward.value,
    productId: row.reward.productId,
    subtotal,
    items
  });
}
async function validateRewardCoupon(input) {
  const row = await rewardCouponContext(input.storeId, input.userId, input.code);
  return rewardBenefit(row, input.subtotal, input.items ?? []);
}
async function consumeRewardCoupon(input) {
  const db = await getDb();
  requireDatabase(db);
  const normalized = normalizeRewardCouponCode(input.code);
  return db.transaction(async (tx) => {
    const [coupon] = await tx.select().from(rewardCoupons).where(and10(
      eq12(rewardCoupons.storeId, input.storeId),
      eq12(rewardCoupons.code, normalized),
      eq12(rewardCoupons.assignedUserId, input.userId)
    )).limit(1).for("update");
    if (!coupon || coupon.status !== "redeemed" || !coupon.redemptionId) {
      throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Cupom indispon\xEDvel ou j\xE1 utilizado." });
    }
    const now = /* @__PURE__ */ new Date();
    if (coupon.expiresAt && coupon.expiresAt <= now) {
      throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Cupom expirado." });
    }
    const [redemption] = await tx.select().from(rewardRedemptions).where(and10(eq12(rewardRedemptions.id, coupon.redemptionId), eq12(rewardRedemptions.userId, input.userId))).limit(1).for("update");
    if (!redemption || redemption.status !== "completed") {
      throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Resgate inv\xE1lido." });
    }
    await tx.insert(rewardCouponUsages).values({
      storeId: input.storeId,
      couponId: coupon.id,
      redemptionId: redemption.id,
      userId: input.userId,
      orderId: input.orderId
    });
    await tx.update(rewardCoupons).set({ status: "used", usedAt: now }).where(eq12(rewardCoupons.id, coupon.id));
    return { couponId: coupon.id, redemptionId: redemption.id };
  });
}
async function listRewardRedemptionsForAdmin(storeId, rewardId) {
  const db = await getDb();
  requireDatabase(db);
  const rows = await db.select({
    id: rewardRedemptions.id,
    rewardId: rewardRedemptions.rewardId,
    rewardName: rewardCatalog.name,
    userId: rewardRedemptions.userId,
    userName: users.name,
    userEmail: users.email,
    couponId: rewardRedemptions.couponId,
    couponCode: rewardCoupons.code,
    couponStatus: rewardCoupons.status,
    pointsSpent: rewardRedemptions.pointsSpent,
    status: rewardRedemptions.status,
    redeemedAt: rewardRedemptions.redeemedAt,
    expiresAt: rewardRedemptions.expiresAt,
    cancelledAt: rewardRedemptions.cancelledAt,
    cancellationReason: rewardRedemptions.cancellationReason
  }).from(rewardRedemptions).innerJoin(rewardCatalog, eq12(rewardCatalog.id, rewardRedemptions.rewardId)).innerJoin(users, eq12(users.id, rewardRedemptions.userId)).leftJoin(rewardCoupons, eq12(rewardCoupons.id, rewardRedemptions.couponId)).where(and10(
    eq12(rewardRedemptions.storeId, storeId),
    rewardId ? eq12(rewardRedemptions.rewardId, rewardId) : void 0
  )).orderBy(desc6(rewardRedemptions.createdAt));
  return rows.map((row) => ({ ...row, couponCode: row.couponCode ? maskRewardCoupon(row.couponCode) : null }));
}
async function cancelRewardRedemption(input) {
  const db = await getDb();
  requireDatabase(db);
  const scope = await getTenantScope(input.storeId);
  return db.transaction(async (tx) => {
    const [redemption] = await tx.select().from(rewardRedemptions).where(and10(eq12(rewardRedemptions.id, input.redemptionId), eq12(rewardRedemptions.storeId, input.storeId))).limit(1).for("update");
    if (!redemption) throw new TRPCError8({ code: "NOT_FOUND", message: "Resgate n\xE3o encontrado." });
    if (redemption.status === "cancelled" || redemption.status === "refunded") return { alreadyCancelled: true };
    if (redemption.status !== "completed") {
      throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Este resgate n\xE3o pode ser cancelado." });
    }
    if (redemption.couponId) {
      const [usage] = await tx.select({ id: rewardCouponUsages.id }).from(rewardCouponUsages).where(eq12(rewardCouponUsages.couponId, redemption.couponId)).limit(1);
      if (usage) throw new TRPCError8({ code: "PRECONDITION_FAILED", message: "Cupom j\xE1 utilizado em um pedido." });
    }
    const [account] = await tx.select().from(tenantCustomerAccounts).where(and10(eq12(tenantCustomerAccounts.tenantKey, scope.tenantKey), eq12(tenantCustomerAccounts.userId, redemption.userId))).limit(1).for("update");
    if (!account) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Conta de pontos n\xE3o encontrada." });
    const balanceBefore = account.loyaltyPoints;
    const balanceAfter = balanceBefore + redemption.pointsSpent;
    await tx.update(tenantCustomerAccounts).set({ loyaltyPoints: balanceAfter }).where(eq12(tenantCustomerAccounts.id, account.id));
    if (scope.tenantKey === "bonatto") {
      await tx.update(users).set({ loyaltyPoints: balanceAfter }).where(eq12(users.id, redemption.userId));
    }
    await tx.insert(loyaltyTransactions).values({
      tenantKey: scope.tenantKey,
      storeId: input.storeId,
      userId: redemption.userId,
      type: "refund",
      points: redemption.pointsSpent,
      description: `Estorno do resgate #${redemption.id}`,
      balanceBefore,
      balanceAfter
    });
    await tx.update(rewardRedemptions).set({
      status: "cancelled",
      cancelledAt: /* @__PURE__ */ new Date(),
      cancellationReason: input.reason
    }).where(eq12(rewardRedemptions.id, redemption.id));
    if (redemption.couponId) {
      await tx.update(rewardCoupons).set({ status: "cancelled" }).where(eq12(rewardCoupons.id, redemption.couponId));
    }
    return { alreadyCancelled: false, refundedPoints: redemption.pointsSpent, balanceAfter };
  });
}

// server/routers/rewards.ts
var storeInput2 = z6.object({ storeId: z6.number().int().positive() });
var nullableText = (max) => z6.string().trim().max(max).nullable().optional();
var rewardDataSchema = z6.object({
  name: z6.string().trim().min(2).max(160),
  description: nullableText(1e3),
  rewardType: z6.enum(["discount", "product", "free_delivery", "cashback"]),
  pointsCost: z6.number().int().min(1).max(1e6),
  value: z6.number().min(0).max(1e5),
  productId: z6.number().int().positive().nullable().optional(),
  category: nullableText(80),
  icon: nullableText(64),
  imageUrl: z6.string().trim().max(2e3).refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "Use uma URL http(s) ou um caminho iniciado por /."
  ).nullable().optional(),
  badgeText: nullableText(64),
  buttonText: nullableText(64),
  stock: z6.number().int().min(0).max(1e6).nullable().optional(),
  maxRedemptionsPerUser: z6.number().int().min(1).max(1e4).nullable().optional(),
  active: z6.boolean().optional(),
  featured: z6.boolean().optional(),
  sortOrder: z6.number().int().min(-1e4).max(1e4).optional(),
  startsAt: z6.date().nullable().optional(),
  expiresAt: z6.date().nullable().optional()
});
var rewardsRouter = router({
  list: publicProcedure.input(storeInput2).query(({ input }) => listRewards(input.storeId)),
  detail: publicProcedure.input(storeInput2.extend({ rewardId: z6.number().int().positive() })).query(({ input }) => getRewardDetail(input.storeId, input.rewardId)),
  myOverview: protectedProcedure.input(storeInput2).query(({ ctx, input }) => getMyRewardsOverview(input.storeId, ctx.user.id)),
  myRedemptions: protectedProcedure.input(storeInput2).query(({ ctx, input }) => listMyRedemptions(input.storeId, ctx.user.id)),
  redeem: protectedProcedure.input(storeInput2.extend({
    rewardId: z6.number().int().positive(),
    idempotencyKey: z6.string().trim().min(16).max(96).regex(/^[A-Za-z0-9_-]+$/)
  })).mutation(({ ctx, input }) => redeemReward({ ...input, userId: ctx.user.id })),
  validateCoupon: protectedProcedure.input(storeInput2.extend({
    code: z6.string().trim().min(4).max(64),
    subtotal: z6.number().min(0).max(1e6),
    items: z6.array(z6.object({
      productId: z6.number().int().positive(),
      productPrice: z6.union([z6.string(), z6.number()]),
      quantity: z6.number().int().min(1).max(99)
    })).max(50).optional()
  })).query(({ ctx, input }) => validateRewardCoupon({ ...input, userId: ctx.user.id })),
  admin: router({
    list: staffProcedure.input(storeInput2).query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return listRewardsForAdmin(storeId);
    }),
    create: staffProcedure.input(storeInput2.extend(rewardDataSchema.shape)).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storeId: _storeId, ...data } = input;
      const rewardId = await createReward(storeId, data);
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.created",
        resourceType: "reward",
        resourceId: rewardId,
        metadata: { newData: data }
      });
      return { id: rewardId };
    }),
    update: staffProcedure.input(storeInput2.extend({
      rewardId: z6.number().int().positive(),
      ...rewardDataSchema.partial().shape
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storeId: _storeId, rewardId, ...changes } = input;
      const previous = await updateReward(storeId, rewardId, changes);
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.updated",
        resourceType: "reward",
        resourceId: rewardId,
        metadata: { previousData: previous, newData: changes }
      });
      return { ok: true };
    }),
    archive: staffProcedure.input(storeInput2.extend({ rewardId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const previous = await archiveReward(storeId, input.rewardId);
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.archived",
        resourceType: "reward",
        resourceId: input.rewardId,
        metadata: { previousData: previous }
      });
      return { ok: true };
    }),
    addCoupons: staffProcedure.input(storeInput2.extend({
      rewardId: z6.number().int().positive(),
      codes: z6.array(z6.string().min(4).max(64)).min(1).max(1e3),
      expiresAt: z6.date().nullable().optional()
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await addRewardCoupons({ ...input, storeId });
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.coupons_imported",
        resourceType: "reward",
        resourceId: input.rewardId,
        metadata: { count: result.inserted }
      });
      return result;
    }),
    generateCoupons: staffProcedure.input(storeInput2.extend({
      rewardId: z6.number().int().positive(),
      prefix: z6.string().trim().max(24).default("CLUBE-"),
      quantity: z6.number().int().min(1).max(1e3),
      codeLength: z6.number().int().min(4).max(24),
      expiresAt: z6.date().nullable().optional()
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await generateRewardCoupons({ ...input, storeId });
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.coupons_generated",
        resourceType: "reward",
        resourceId: input.rewardId,
        metadata: { count: result.inserted, prefix: input.prefix, codeLength: input.codeLength }
      });
      return result;
    }),
    coupons: staffProcedure.input(storeInput2.extend({ rewardId: z6.number().int().positive() })).query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return listRewardCoupons(storeId, input.rewardId);
    }),
    revealCoupon: staffProcedure.input(storeInput2.extend({ couponId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const coupon = await revealRewardCoupon(storeId, input.couponId);
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.coupon_revealed",
        resourceType: "reward_coupon",
        resourceId: input.couponId,
        metadata: { rewardId: coupon.rewardId }
      });
      return { code: coupon.code };
    }),
    exportCoupons: staffProcedure.input(storeInput2.extend({ rewardId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const maskedRows = await listRewardCoupons(storeId, input.rewardId);
      const rows = await Promise.all(maskedRows.map(async (row) => ({
        ...row,
        code: (await revealRewardCoupon(storeId, row.id)).code
      })));
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.coupons_exported",
        resourceType: "reward",
        resourceId: input.rewardId,
        metadata: { count: rows.length }
      });
      return rows;
    }),
    redemptions: staffProcedure.input(storeInput2.extend({ rewardId: z6.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return listRewardRedemptionsForAdmin(storeId, input.rewardId);
    }),
    cancelRedemption: staffProcedure.input(storeInput2.extend({
      redemptionId: z6.number().int().positive(),
      reason: z6.string().trim().min(5).max(500)
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await cancelRewardRedemption({ ...input, storeId });
      await recordTenantAudit({
        storeId,
        actorUserId: ctx.user.id,
        action: "reward.redemption_cancelled",
        resourceType: "reward_redemption",
        resourceId: input.redemptionId,
        metadata: { reason: input.reason, ...result }
      });
      return result;
    })
  })
});

// server/routers/catalog.ts
import { z as z7 } from "zod";
import { and as and12, eq as eq14, inArray as inArray10, sql as sql7 } from "drizzle-orm";
import { TRPCError as TRPCError10 } from "@trpc/server";

// server/domains/catalog/pricing.ts
var roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
function parseMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
function matchesTimeWindow(rule, now) {
  const start = parseMinutes(rule.startTime);
  const end = parseMinutes(rule.endTime);
  if (start === null || end === null) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}
function isConfiguredProductAvailable(product, selection) {
  if (!product.active) return false;
  const now = selection.now ?? /* @__PURE__ */ new Date();
  const rules = product.availability.filter((rule) => rule.active);
  if (rules.length === 0) return true;
  return rules.some((rule) => {
    if (rule.channel !== "all" && rule.channel !== selection.channel) return false;
    if (rule.weekday != null && rule.weekday !== now.getDay()) return false;
    if (rule.startsAt && now < rule.startsAt) return false;
    if (rule.expiresAt && now > rule.expiresAt) return false;
    if (rule.pausedUntil && now < rule.pausedUntil) return false;
    if (rule.stockLimit != null && rule.stockLimit <= 0) return false;
    return matchesTimeWindow(rule, now);
  });
}
function activePromotionPrice(price, promotionalPrice, startsAt, endsAt, now) {
  if (promotionalPrice == null) return price;
  if (startsAt && now < startsAt) return price;
  if (endsAt && now > endsAt) return price;
  return promotionalPrice;
}
function calculateConfiguredProductPrice(product, selection) {
  const errors = [];
  const breakdown = [];
  const now = selection.now ?? /* @__PURE__ */ new Date();
  const quantity = Number.isInteger(selection.quantity) ? selection.quantity : 0;
  if (!product.active) errors.push("Produto inativo.");
  if (product.storeId <= 0) errors.push("Produto sem loja v\xE1lida.");
  if (quantity < product.minQuantity || quantity > product.maxQuantity) {
    errors.push(`Quantidade deve ficar entre ${product.minQuantity} e ${product.maxQuantity}.`);
  }
  if (!isConfiguredProductAvailable(product, selection)) errors.push("Produto indispon\xEDvel neste hor\xE1rio ou canal.");
  const safeBasePrice = Math.max(0, product.basePrice);
  if (product.basePrice < 0) errors.push("Pre\xE7o-base inv\xE1lido.");
  if (product.pricingEngine === "legacy_v1") {
    const total = roundMoney(safeBasePrice * Math.max(0, quantity));
    return {
      basePrice: safeBasePrice,
      sizePrice: 0,
      flavorsPrice: 0,
      modifiersPrice: 0,
      comboAdditionalPrice: 0,
      upsellsPrice: 0,
      discounts: 0,
      fees: 0,
      unitTotal: safeBasePrice,
      total,
      breakdown: [{ kind: "base", label: product.name, amount: safeBasePrice }],
      validationErrors: errors
    };
  }
  let selectedSize = selection.sizeId == null ? null : product.sizes.find((size) => size.id === selection.sizeId);
  if (selection.sizeId != null && (!selectedSize || !selectedSize.active)) {
    errors.push("Tamanho inexistente ou inativo.");
    selectedSize = null;
  }
  if (product.sizes.some((size) => size.active) && !selectedSize) errors.push("Escolha um tamanho.");
  const resolvedSizePrice = selectedSize ? activePromotionPrice(selectedSize.price, selectedSize.promotionalPrice, selectedSize.promotionStartsAt, selectedSize.promotionEndsAt, now) : safeBasePrice;
  if (resolvedSizePrice < 0) errors.push("Pre\xE7o do tamanho inv\xE1lido.");
  const basePrice = safeBasePrice;
  const sizePrice = roundMoney(resolvedSizePrice - safeBasePrice);
  breakdown.push({ kind: "base", label: product.name, amount: basePrice });
  if (selectedSize) breakdown.push({ kind: "size", label: selectedSize.name, amount: sizePrice });
  const rawFlavorIds = selection.flavorIds ?? [];
  const uniqueFlavorIds = Array.from(new Set(rawFlavorIds));
  const flavorSettings = product.flavorSettings;
  let flavorsPrice = 0;
  const selectedFlavors = uniqueFlavorIds.map((id) => product.flavors.find((flavor) => flavor.id === id)).filter((flavor) => Boolean(flavor));
  if (flavorSettings?.enabled) {
    if (!flavorSettings.allowRepeatedFlavors && uniqueFlavorIds.length !== rawFlavorIds.length) errors.push("Sabores repetidos n\xE3o s\xE3o permitidos.");
    if (selectedFlavors.length !== uniqueFlavorIds.length || selectedFlavors.some((flavor) => !flavor.active)) errors.push("Um ou mais sabores est\xE3o indispon\xEDveis.");
    const minimum = selectedSize?.minFlavors ?? 1;
    const maximum = selectedSize?.maxFlavors ?? 1;
    if (rawFlavorIds.length < minimum) errors.push(`Escolha pelo menos ${minimum} sabor(es).`);
    if (rawFlavorIds.length > maximum) errors.push(`Escolha no m\xE1ximo ${maximum} sabor(es).`);
    const flavorTotals = selectedFlavors.map((flavor) => selectedSize ? flavor.pricesBySize[selectedSize.id] : void 0);
    if (flavorTotals.some((price) => price == null || price < 0)) errors.push("Um ou mais sabores n\xE3o possuem pre\xE7o para o tamanho escolhido.");
    const validPrices = flavorTotals.filter((price) => typeof price === "number" && price >= 0);
    if (validPrices.length > 0) {
      const highest = Math.max(...validPrices);
      const average = validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length;
      const targetPrice = flavorSettings.pricingRule === "highest_price" ? highest : flavorSettings.pricingRule === "average_price" || flavorSettings.pricingRule === "proportional_price" ? average : flavorSettings.pricingRule === "base_plus_difference" ? resolvedSizePrice + Math.max(0, highest - resolvedSizePrice) : resolvedSizePrice;
      flavorsPrice = roundMoney(Math.max(0, targetPrice - resolvedSizePrice));
      if (flavorsPrice > 0) breakdown.push({ kind: "flavor", label: "Composi\xE7\xE3o de sabores", amount: flavorsPrice });
    }
  } else if (rawFlavorIds.length > 0) {
    errors.push("Este produto n\xE3o aceita m\xFAltiplos sabores.");
  }
  let modifiersPrice = 0;
  const requestedModifiers = selection.modifiers ?? [];
  for (const group of product.modifierGroups.filter((item) => item.active)) {
    const groupSelections = requestedModifiers.filter((item) => item.groupId === group.id);
    const selectedUnits = groupSelections.reduce((sum, item) => sum + item.quantity, 0);
    const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
    if (selectedUnits < minimum) errors.push(`${group.name}: escolha pelo menos ${minimum}.`);
    if (selectedUnits > group.maxSelections) errors.push(`${group.name}: escolha no m\xE1ximo ${group.maxSelections}.`);
    const pricedUnits = [];
    for (const requested of groupSelections) {
      const option = group.options.find((item) => item.id === requested.optionId);
      if (!option || !option.active || requested.quantity < 1) {
        errors.push(`${group.name}: op\xE7\xE3o inv\xE1lida.`);
        continue;
      }
      if ((!group.allowRepeatedOptions || !option.allowRepeat) && requested.quantity > 1) errors.push(`${option.name}: repeti\xE7\xE3o n\xE3o permitida.`);
      const sizeRule = selectedSize ? option.sizeRules?.find((rule) => rule.sizeId === selectedSize.id) : void 0;
      if (sizeRule && !sizeRule.enabled) {
        errors.push(`${option.name}: indispon\xEDvel para ${selectedSize?.name}.`);
        continue;
      }
      const maximum = sizeRule?.maxQuantityOverride ?? option.maxQuantity;
      if (requested.quantity > maximum) errors.push(`${option.name}: quantidade m\xE1xima ${maximum}.`);
      const unitPrice = sizeRule?.priceOverride ?? option.price;
      if (unitPrice < 0) {
        errors.push(`${option.name}: pre\xE7o inv\xE1lido.`);
        continue;
      }
      for (let index2 = 0; index2 < requested.quantity; index2 += 1) pricedUnits.push({ name: option.name, price: unitPrice });
    }
    pricedUnits.sort((left, right) => left.price - right.price);
    const chargeableUnits = pricedUnits.slice(Math.min(group.freeSelections, pricedUnits.length));
    for (const unit of chargeableUnits) {
      modifiersPrice = roundMoney(modifiersPrice + unit.price);
      breakdown.push({ kind: "modifier", label: `${group.name}: ${unit.name}`, amount: unit.price, quantity: 1 });
    }
  }
  if (requestedModifiers.some((item) => !product.modifierGroups.some((group) => group.id === item.groupId && group.active))) {
    errors.push("Foi enviado um grupo de adicionais inexistente.");
  }
  let comboAdditionalPrice = 0;
  const requestedCombos = selection.combos ?? [];
  for (const group of product.comboGroups.filter((item) => item.active)) {
    const groupSelections = requestedCombos.filter((item) => item.groupId === group.id);
    const selectedUnits = groupSelections.reduce((sum, item) => sum + item.quantity, 0);
    const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
    if (selectedUnits < minimum) errors.push(`${group.name}: combo incompleto.`);
    if (selectedUnits > group.maxSelections) errors.push(`${group.name}: limite do combo excedido.`);
    for (const requested of groupSelections) {
      const item = group.items.find((candidate) => candidate.id === requested.itemId);
      if (!item || !item.active || requested.quantity < 1) {
        errors.push(`${group.name}: item de combo inv\xE1lido.`);
        continue;
      }
      comboAdditionalPrice = roundMoney(comboAdditionalPrice + item.price * requested.quantity);
      if (item.price > 0) breakdown.push({ kind: "combo", label: group.name, amount: item.price * requested.quantity, quantity: requested.quantity });
    }
  }
  let upsellsPrice = 0;
  for (const requested of selection.upsells ?? []) {
    const offer = product.upsellOffers.find((item) => item.productId === requested.productId && item.active);
    if (!offer || requested.quantity < 1) {
      errors.push("Upsell inexistente ou inativo.");
      continue;
    }
    upsellsPrice = roundMoney(upsellsPrice + offer.price * requested.quantity);
    breakdown.push({ kind: "upsell", label: offer.name, amount: offer.price * requested.quantity, quantity: requested.quantity });
  }
  const unitTotal = roundMoney(basePrice + sizePrice + flavorsPrice + modifiersPrice + comboAdditionalPrice + upsellsPrice);
  return {
    basePrice,
    sizePrice,
    flavorsPrice,
    modifiersPrice,
    comboAdditionalPrice,
    upsellsPrice,
    discounts: 0,
    fees: 0,
    unitTotal,
    total: roundMoney(unitTotal * Math.max(0, quantity)),
    breakdown,
    validationErrors: Array.from(new Set(errors))
  };
}
function createOrderItemConfigurationSnapshot(product, selection, pricing) {
  const size = selection.sizeId == null ? null : product.sizes.find((item) => item.id === selection.sizeId) ?? null;
  return {
    version: 2,
    productId: product.id,
    productName: product.name,
    size: size ? { id: size.id, name: size.name, price: size.promotionalPrice ?? size.price } : null,
    flavors: (selection.flavorIds ?? []).flatMap((id) => {
      const flavor = product.flavors.find((item) => item.id === id);
      if (!flavor) return [];
      return [{ id: flavor.id, name: flavor.name, price: size ? flavor.pricesBySize[size.id] ?? 0 : 0 }];
    }),
    modifiers: (selection.modifiers ?? []).flatMap((selected) => {
      const group = product.modifierGroups.find((item) => item.id === selected.groupId);
      const option = group?.options.find((item) => item.id === selected.optionId);
      if (!group || !option) return [];
      const rule = size ? option.sizeRules?.find((item) => item.sizeId === size.id) : void 0;
      const unitPrice = rule?.priceOverride ?? option.price;
      return [{ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, quantity: selected.quantity, unitPrice, totalPrice: roundMoney(unitPrice * selected.quantity) }];
    }),
    combos: (selection.combos ?? []).flatMap((selected) => {
      const group = product.comboGroups.find((item2) => item2.id === selected.groupId);
      const item = group?.items.find((candidate) => candidate.id === selected.itemId);
      if (!group || !item) return [];
      return [{ groupId: group.id, groupName: group.name, itemId: item.id, productId: item.productId, quantity: selected.quantity, unitPrice: item.price, totalPrice: roundMoney(item.price * selected.quantity) }];
    }),
    upsells: (selection.upsells ?? []).flatMap((selected) => {
      const offer = product.upsellOffers.find((item) => item.productId === selected.productId);
      if (!offer) return [];
      return [{ productId: offer.productId, name: offer.name, quantity: selected.quantity, unitPrice: offer.price, totalPrice: roundMoney(offer.price * selected.quantity) }];
    }),
    removedIngredients: selection.removedIngredients ?? [],
    pricing
  };
}

// server/domains/catalog/repository.ts
init_schema();
init_db();
import { TRPCError as TRPCError9 } from "@trpc/server";
import { and as and11, asc as asc3, eq as eq13, inArray as inArray9, isNull as isNull4, or as or5 } from "drizzle-orm";
async function getConfiguredCatalogProduct(input) {
  const db = await getDb();
  if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const productConditions = [eq13(products.id, input.productId), eq13(products.storeId, input.storeId)];
  if (!input.includeInactive) productConditions.push(eq13(products.active, true));
  const [product] = await db.select().from(products).where(and11(...productConditions)).limit(1);
  if (!product) throw new TRPCError9({ code: "NOT_FOUND", message: "Produto n\xE3o encontrado nesta loja." });
  const [sizes, groups, flavorSettingsRows, flavors, availability, comboRows, upsellRows] = await Promise.all([
    db.select().from(productSizes).where(and11(eq13(productSizes.storeId, input.storeId), eq13(productSizes.productId, input.productId))).orderBy(asc3(productSizes.sortOrder), asc3(productSizes.id)),
    db.select().from(productOptionGroups).where(and11(eq13(productOptionGroups.storeId, input.storeId), eq13(productOptionGroups.productId, input.productId))).orderBy(asc3(productOptionGroups.sortOrder), asc3(productOptionGroups.id)),
    db.select().from(multiFlavorSettings).where(and11(eq13(multiFlavorSettings.storeId, input.storeId), eq13(multiFlavorSettings.productId, input.productId))).limit(1),
    db.select().from(productFlavors).where(and11(eq13(productFlavors.storeId, input.storeId), eq13(productFlavors.productId, input.productId))).orderBy(asc3(productFlavors.sortOrder), asc3(productFlavors.id)),
    db.select().from(productAvailability).where(and11(eq13(productAvailability.storeId, input.storeId), eq13(productAvailability.productId, input.productId))),
    db.select().from(productCombos).where(and11(eq13(productCombos.storeId, input.storeId), eq13(productCombos.productId, input.productId))).limit(1),
    db.select().from(upsells).where(and11(
      eq13(upsells.storeId, input.storeId),
      or5(eq13(upsells.triggerProductId, input.productId), isNull4(upsells.triggerProductId)),
      input.includeInactive ? void 0 : eq13(upsells.active, true)
    ))
  ]);
  const options = groups.length ? await db.select().from(productOptions).where(and11(eq13(productOptions.storeId, input.storeId), inArray9(productOptions.groupId, groups.map((group) => group.id)))).orderBy(asc3(productOptions.sortOrder), asc3(productOptions.id)) : [];
  const sizeRules = options.length ? await db.select().from(modifierSizeRules).where(and11(eq13(modifierSizeRules.storeId, input.storeId), inArray9(modifierSizeRules.modifierOptionId, options.map((option) => option.id)))) : [];
  const flavorPrices = flavors.length ? await db.select().from(flavorSizePrices).where(and11(eq13(flavorSizePrices.storeId, input.storeId), inArray9(flavorSizePrices.flavorId, flavors.map((flavor) => flavor.id)))) : [];
  const combo = comboRows[0];
  const comboGroupRows = combo ? await db.select().from(comboGroups).where(and11(eq13(comboGroups.storeId, input.storeId), eq13(comboGroups.comboId, combo.id))).orderBy(asc3(comboGroups.sortOrder), asc3(comboGroups.id)) : [];
  const comboItems = comboGroupRows.length ? await db.select().from(comboGroupItems).where(and11(eq13(comboGroupItems.storeId, input.storeId), inArray9(comboGroupItems.groupId, comboGroupRows.map((group) => group.id)))) : [];
  const suggestedProductIds = Array.from(new Set(upsellRows.map((upsell) => upsell.suggestedProductId)));
  const suggestedProducts = suggestedProductIds.length ? await db.select().from(products).where(and11(eq13(products.storeId, input.storeId), inArray9(products.id, suggestedProductIds))) : [];
  return {
    id: product.id,
    storeId: product.storeId,
    name: product.name,
    basePrice: Number(product.price),
    productType: product.productType,
    pricingEngine: product.pricingEngine,
    active: product.active,
    minQuantity: product.minQuantity,
    maxQuantity: product.maxQuantity,
    sizes: sizes.map((size) => ({
      id: size.id,
      name: size.name,
      price: Number(size.price),
      promotionalPrice: size.promotionalPrice == null ? null : Number(size.promotionalPrice),
      promotionStartsAt: size.promotionStartsAt,
      promotionEndsAt: size.promotionEndsAt,
      minFlavors: size.minFlavors,
      maxFlavors: size.maxFlavors,
      maxAddons: size.maxAddons,
      active: size.active
    })),
    modifierGroups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      freeSelections: group.freeSelections,
      allowRepeatedOptions: group.allowRepeatedOptions,
      active: group.active,
      options: options.filter((option) => option.groupId === group.id).map((option) => ({
        id: option.id,
        name: option.name,
        price: Number(option.priceDelta),
        active: option.active,
        maxQuantity: option.maxQuantity,
        allowRepeat: option.allowRepeat,
        sizeRules: sizeRules.filter((rule) => rule.modifierOptionId === option.id).map((rule) => ({
          sizeId: rule.productSizeId,
          enabled: rule.enabled,
          priceOverride: rule.priceOverride == null ? null : Number(rule.priceOverride),
          maxQuantityOverride: rule.maxQuantityOverride
        }))
      }))
    })),
    flavors: flavors.map((flavor) => ({
      id: flavor.id,
      name: flavor.name,
      active: flavor.active,
      pricesBySize: Object.fromEntries(flavorPrices.filter((price) => price.flavorId === flavor.id && price.active).map((price) => [price.productSizeId, Number(price.price)]))
    })),
    flavorSettings: flavorSettingsRows[0] ? {
      enabled: flavorSettingsRows[0].enabled,
      pricingRule: flavorSettingsRows[0].pricingRule,
      allowRepeatedFlavors: flavorSettingsRows[0].allowRepeatedFlavors
    } : null,
    comboGroups: comboGroupRows.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      active: group.active,
      items: comboItems.filter((item) => item.groupId === group.id).map((item) => ({
        id: item.id,
        productId: item.productId,
        sizeId: item.sizeId,
        price: Number(item.priceDelta),
        active: item.active
      }))
    })),
    upsellOffers: upsellRows.flatMap((upsell) => {
      const suggested = suggestedProducts.find((candidate) => candidate.id === upsell.suggestedProductId);
      if (!suggested || !input.includeInactive && !suggested.active) return [];
      const base = Number(suggested.price);
      const discount = Math.min(100, Math.max(0, upsell.discountPercent ?? 0));
      return [{ productId: suggested.id, name: suggested.name, price: Math.round(base * (1 - discount / 100) * 100) / 100, active: upsell.active && suggested.active }];
    }),
    availability: availability.map((rule) => ({
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
      startsAt: rule.startsAt,
      expiresAt: rule.expiresAt,
      channel: rule.channel,
      stockLimit: rule.stockLimit,
      pausedUntil: rule.pausedUntil,
      active: rule.active
    }))
  };
}

// server/routers/catalog.ts
init_db();
init_schema();
var selectionSchema = z7.object({
  quantity: z7.number().int().min(1).max(999),
  sizeId: z7.number().int().positive().optional().nullable(),
  flavorIds: z7.array(z7.number().int().positive()).max(12).optional(),
  modifiers: z7.array(z7.object({
    groupId: z7.number().int().positive(),
    optionId: z7.number().int().positive(),
    quantity: z7.number().int().min(1).max(99)
  })).max(100).optional(),
  combos: z7.array(z7.object({
    groupId: z7.number().int().positive(),
    itemId: z7.number().int().positive(),
    quantity: z7.number().int().min(1).max(99)
  })).max(100).optional(),
  upsells: z7.array(z7.object({
    productId: z7.number().int().positive(),
    quantity: z7.number().int().min(1).max(99)
  })).max(20).optional(),
  removedIngredients: z7.array(z7.string().trim().min(1).max(120)).max(50).optional(),
  channel: z7.enum(["delivery", "pickup", "dine_in", "counter"])
});
var catalogOrderConfigurationSchema = selectionSchema.omit({ quantity: true, channel: true });
var moneySchema = z7.string().regex(/^\d+(\.\d{1,2})?$/, "Informe um valor valido");
var editorProductSchema = z7.object({
  storeId: z7.number().int().positive(),
  productId: z7.number().int().positive().optional(),
  categoryId: z7.number().int().positive(),
  name: z7.string().trim().min(2).max(200),
  shortDescription: z7.string().trim().max(320).optional().nullable(),
  description: z7.string().trim().max(2e3).optional().nullable(),
  price: moneySchema,
  imageUrl: z7.string().trim().max(2048).optional().nullable(),
  sku: z7.string().trim().max(128).optional().nullable(),
  productType: z7.enum(["simple", "sizes", "buildable", "multi_flavor", "combo"]),
  editorialStatus: z7.enum(["draft", "published"]),
  preparationTime: z7.number().int().min(0).max(600).optional().nullable(),
  minQuantity: z7.number().int().min(1).max(999).default(1),
  maxQuantity: z7.number().int().min(1).max(999).default(99),
  couponEligible: z7.boolean().default(true),
  pointsEligible: z7.boolean().default(true),
  featured: z7.boolean().default(false),
  sizes: z7.array(z7.object({
    name: z7.string().trim().min(1).max(120),
    price: moneySchema,
    promotionalPrice: moneySchema.optional().nullable(),
    serves: z7.number().int().min(1).max(50).optional().nullable(),
    minFlavors: z7.number().int().min(1).max(12).optional().nullable(),
    maxFlavors: z7.number().int().min(1).max(12).optional().nullable()
  })).max(20).default([]),
  modifierGroups: z7.array(z7.object({
    name: z7.string().trim().min(1).max(120),
    required: z7.boolean().default(false),
    minSelections: z7.number().int().min(0).max(50).default(0),
    maxSelections: z7.number().int().min(1).max(50).default(1),
    freeSelections: z7.number().int().min(0).max(50).default(0),
    options: z7.array(z7.object({
      name: z7.string().trim().min(1).max(160),
      price: moneySchema,
      maxQuantity: z7.number().int().min(1).max(99).default(1)
    })).min(1).max(100)
  })).max(30).default([]),
  flavorSettings: z7.object({
    enabled: z7.boolean(),
    pricingRule: z7.enum(["highest_price", "average_price", "proportional_price", "size_fixed_price", "base_plus_difference"]),
    allowRepeatedFlavors: z7.boolean().default(false)
  }).optional().nullable(),
  flavors: z7.array(z7.object({
    name: z7.string().trim().min(1).max(160),
    prices: z7.array(moneySchema).max(20)
  })).max(100).default([])
}).superRefine((value, ctx) => {
  if (value.maxQuantity < value.minQuantity) {
    ctx.addIssue({ code: "custom", path: ["maxQuantity"], message: "A quantidade maxima deve ser maior que a minima" });
  }
  if (["sizes", "multi_flavor"].includes(value.productType) && value.sizes.length === 0) {
    ctx.addIssue({ code: "custom", path: ["sizes"], message: "Cadastre pelo menos um tamanho" });
  }
  if (value.productType === "multi_flavor" && value.flavors.length < 2) {
    ctx.addIssue({ code: "custom", path: ["flavors"], message: "Cadastre pelo menos dois sabores" });
  }
  value.modifierGroups.forEach((group, index2) => {
    if (group.maxSelections < group.minSelections) {
      ctx.addIssue({ code: "custom", path: ["modifierGroups", index2, "maxSelections"], message: "O maximo deve ser maior que o minimo" });
    }
  });
});
var catalogRouter = router({
  configuration: publicProcedure.input(z7.object({ storeId: z7.number().int().positive(), productId: z7.number().int().positive() })).query(({ input }) => getConfiguredCatalogProduct(input)),
  calculatePrice: publicProcedure.input(z7.object({
    storeId: z7.number().int().positive(),
    productId: z7.number().int().positive(),
    selection: selectionSchema
  })).mutation(async ({ input }) => {
    const product = await getConfiguredCatalogProduct({ storeId: input.storeId, productId: input.productId });
    return calculateConfiguredProductPrice(product, input.selection);
  }),
  adminConfiguration: staffProcedure.input(z7.object({ storeId: z7.number().int().positive(), productId: z7.number().int().positive() })).query(async ({ ctx, input }) => {
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    return getConfiguredCatalogProduct({ storeId, productId: input.productId, includeInactive: true });
  }),
  adminPreview: staffProcedure.input(z7.object({
    storeId: z7.number().int().positive(),
    productId: z7.number().int().positive(),
    selection: selectionSchema
  })).mutation(async ({ ctx, input }) => {
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    const product = await getConfiguredCatalogProduct({ storeId, productId: input.productId, includeInactive: true });
    const pricing = calculateConfiguredProductPrice(product, input.selection);
    return {
      pricing,
      snapshot: createOrderItemConfigurationSnapshot(product, input.selection, pricing)
    };
  }),
  saveProduct: staffProcedure.input(editorProductSchema).mutation(async ({ ctx, input }) => {
    const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
    const db = await getDb();
    if (!db) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponivel" });
    return db.transaction(async (tx) => {
      const [category] = await tx.select({ id: categories.id }).from(categories).where(and12(eq14(categories.id, input.categoryId), eq14(categories.storeId, storeId), eq14(categories.active, true))).limit(1);
      if (!category) throw new TRPCError10({ code: "BAD_REQUEST", message: "Selecione uma categoria ativa desta loja" });
      let productId = input.productId;
      if (productId) {
        const [existing] = await tx.select({ id: products.id }).from(products).where(and12(eq14(products.id, productId), eq14(products.storeId, storeId))).limit(1);
        if (!existing) throw new TRPCError10({ code: "NOT_FOUND", message: "Produto nao encontrado nesta loja" });
      }
      const productData = {
        storeId,
        categoryId: input.categoryId,
        name: input.name,
        shortDescription: input.shortDescription || null,
        description: input.description || null,
        price: input.price,
        imageUrl: input.imageUrl || null,
        sku: input.sku || null,
        productType: input.productType,
        pricingEngine: input.productType === "simple" ? "legacy_v1" : "configured_v2",
        editorialStatus: input.editorialStatus,
        preparationTime: input.preparationTime ?? null,
        minQuantity: input.minQuantity,
        maxQuantity: input.maxQuantity,
        couponEligible: input.couponEligible,
        pointsEligible: input.pointsEligible,
        featured: input.featured,
        active: input.editorialStatus === "published",
        publishedAt: input.editorialStatus === "published" ? /* @__PURE__ */ new Date() : null
      };
      if (productId) {
        await tx.update(products).set({ ...productData, version: sql7`${products.version} + 1` }).where(and12(eq14(products.id, productId), eq14(products.storeId, storeId)));
      } else {
        const inserted = await tx.insert(products).values(productData).$returningId();
        productId = inserted[0]?.id;
      }
      if (!productId) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Nao foi possivel identificar o produto salvo" });
      const previousGroups = await tx.select({ id: productOptionGroups.id }).from(productOptionGroups).where(and12(eq14(productOptionGroups.storeId, storeId), eq14(productOptionGroups.productId, productId)));
      const previousGroupIds = previousGroups.map((group) => group.id);
      if (previousGroupIds.length) {
        const previousOptions = await tx.select({ id: productOptions.id }).from(productOptions).where(and12(eq14(productOptions.storeId, storeId), inArray10(productOptions.groupId, previousGroupIds)));
        const previousOptionIds = previousOptions.map((option) => option.id);
        if (previousOptionIds.length) await tx.delete(modifierSizeRules).where(and12(eq14(modifierSizeRules.storeId, storeId), inArray10(modifierSizeRules.modifierOptionId, previousOptionIds)));
        await tx.delete(productOptions).where(and12(eq14(productOptions.storeId, storeId), inArray10(productOptions.groupId, previousGroupIds)));
        await tx.delete(productOptionGroups).where(and12(eq14(productOptionGroups.storeId, storeId), eq14(productOptionGroups.productId, productId)));
      }
      const previousFlavors = await tx.select({ id: productFlavors.id }).from(productFlavors).where(and12(eq14(productFlavors.storeId, storeId), eq14(productFlavors.productId, productId)));
      const previousFlavorIds = previousFlavors.map((flavor) => flavor.id);
      if (previousFlavorIds.length) await tx.delete(flavorSizePrices).where(and12(eq14(flavorSizePrices.storeId, storeId), inArray10(flavorSizePrices.flavorId, previousFlavorIds)));
      await tx.delete(productFlavors).where(and12(eq14(productFlavors.storeId, storeId), eq14(productFlavors.productId, productId)));
      await tx.delete(multiFlavorSettings).where(and12(eq14(multiFlavorSettings.storeId, storeId), eq14(multiFlavorSettings.productId, productId)));
      await tx.delete(productSizes).where(and12(eq14(productSizes.storeId, storeId), eq14(productSizes.productId, productId)));
      const sizeIds = [];
      for (const [index2, size] of input.sizes.entries()) {
        const inserted = await tx.insert(productSizes).values({
          storeId,
          productId,
          name: size.name,
          price: size.price,
          promotionalPrice: size.promotionalPrice || null,
          serves: size.serves ?? null,
          minFlavors: size.minFlavors ?? null,
          maxFlavors: size.maxFlavors ?? null,
          sortOrder: index2,
          active: true
        }).$returningId();
        if (inserted[0]?.id) sizeIds.push(inserted[0].id);
      }
      for (const [groupIndex, group] of input.modifierGroups.entries()) {
        const insertedGroup = await tx.insert(productOptionGroups).values({
          storeId,
          productId,
          name: group.name,
          kind: group.maxSelections === 1 ? "single" : "multiple",
          required: group.required,
          minSelections: group.required ? Math.max(1, group.minSelections) : group.minSelections,
          maxSelections: group.maxSelections,
          freeSelections: group.freeSelections,
          sortOrder: groupIndex,
          active: true
        }).$returningId();
        const groupId = insertedGroup[0]?.id;
        if (!groupId) continue;
        await tx.insert(productOptions).values(group.options.map((option, optionIndex) => ({
          storeId,
          groupId,
          name: option.name,
          priceDelta: option.price,
          maxQuantity: option.maxQuantity,
          allowRepeat: option.maxQuantity > 1,
          sortOrder: optionIndex,
          active: true
        })));
      }
      if (input.productType === "multi_flavor" && input.flavorSettings) {
        await tx.insert(multiFlavorSettings).values({ storeId, productId, ...input.flavorSettings, visualDivisions: true });
        for (const [flavorIndex, flavor] of input.flavors.entries()) {
          const insertedFlavor = await tx.insert(productFlavors).values({ storeId, productId, name: flavor.name, sortOrder: flavorIndex, active: true }).$returningId();
          const flavorId = insertedFlavor[0]?.id;
          if (!flavorId) continue;
          const prices = flavor.prices.map((price, sizeIndex) => sizeIds[sizeIndex] ? {
            storeId,
            flavorId,
            productSizeId: sizeIds[sizeIndex],
            price,
            active: true
          } : null).filter((value) => Boolean(value));
          if (prices.length) await tx.insert(flavorSizePrices).values(prices);
        }
      }
      return { id: productId, status: input.editorialStatus };
    });
  })
});

// server/routers.ts
init_push();
import { z as z11 } from "zod";
init_db();
init_timezone();
init_db();

// server/_core/oauth.ts
import crypto3 from "node:crypto";
import {
  createRemoteJWKSet,
  EncryptJWT,
  importPKCS8,
  jwtDecrypt,
  jwtVerify as jwtVerify2,
  SignJWT as SignJWT2
} from "jose";
init_db();

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

// server/_core/oauth.ts
init_env();

// server/_core/oauthCrypto.ts
import crypto2 from "node:crypto";
var TOKEN_FORMAT_VERSION = "v1";
function deriveKey(secret) {
  if (!secret) {
    throw new Error("OAUTH_ENCRYPTION_KEY is required to store social tokens");
  }
  return crypto2.createHash("sha256").update(`bonatto:oauth:${secret}`, "utf8").digest();
}
function encryptOAuthToken(value, secret) {
  if (!value) return null;
  const iv = crypto2.randomBytes(12);
  const cipher = crypto2.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_FORMAT_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}
function decryptOAuthToken(value, secret) {
  if (!value) return null;
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== TOKEN_FORMAT_VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted OAuth token");
  }
  const decipher = crypto2.createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

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

// server/_core/oauth.ts
var OAUTH_CONSENT_VERSION = "2026-08-01";
var GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
var GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
var APPLE_AUTH_ENDPOINT = "https://appleid.apple.com/auth/authorize";
var APPLE_TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
var APPLE_REVOKE_ENDPOINT = "https://appleid.apple.com/auth/revoke";
var APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
var INSTAGRAM_AUTH_ENDPOINT = "https://www.instagram.com/oauth/authorize";
var INSTAGRAM_TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
function getQueryParam(req, key) {
  const queryValue = req.query[key];
  if (typeof queryValue === "string") return queryValue;
  const bodyValue = req.body?.[key];
  return typeof bodyValue === "string" ? bodyValue : void 0;
}
function getProvider2(value) {
  return value === "google" || value === "facebook" || value === "apple" || value === "instagram" ? value : void 0;
}
function getStateSecret() {
  const secret = ENV.cookieSecret || "bonatto-oauth-state-dev-secret";
  return crypto3.createHash("sha256").update(`bonatto:oauth-state:${secret}`).digest();
}
function buildBaseAppUrl(req) {
  return (ENV.publicAppUrl || `${req.protocol}://${req.get("host") ?? ""}`).replace(/\/+$/, "");
}
function buildCallbackUrl(req) {
  return `${buildBaseAppUrl(req)}/api/oauth/callback`;
}
function sanitizeReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
function randomBase64Url(size = 32) {
  return crypto3.randomBytes(size).toString("base64url");
}
function createPkceChallenge(verifier) {
  return crypto3.createHash("sha256").update(verifier).digest("base64url");
}
async function encryptOAuthState(payload) {
  return new EncryptJWT(payload).setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" }).setIssuedAt().setExpirationTime("10m").encrypt(getStateSecret());
}
async function parseOAuthState(state) {
  try {
    const { payload } = await jwtDecrypt(state, getStateSecret(), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"]
    });
    const provider = getProvider2(payload.provider);
    const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
    if (!provider || !redirectUri) throw new Error("Invalid OAuth state");
    return {
      provider,
      redirectUri,
      returnPath: sanitizeReturnPath(typeof payload.returnPath === "string" ? payload.returnPath : "/"),
      mode: payload.mode === "connect" ? "connect" : "login",
      connectUserId: typeof payload.connectUserId === "number" ? payload.connectUserId : void 0,
      codeVerifier: typeof payload.codeVerifier === "string" ? payload.codeVerifier : void 0,
      nonce: typeof payload.nonce === "string" ? payload.nonce : void 0,
      consentVersion: typeof payload.consentVersion === "string" ? payload.consentVersion : void 0
    };
  } catch {
    try {
      const { payload } = await jwtVerify2(state, getStateSecret(), { algorithms: ["HS256"] });
      const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
      if (!redirectUri) throw new Error("Invalid OAuth state");
      return {
        provider: getProvider2(payload.provider) ?? "google",
        redirectUri,
        returnPath: sanitizeReturnPath(typeof payload.returnPath === "string" ? payload.returnPath : "/"),
        mode: "login"
      };
    } catch {
      const decoded = Buffer.from(state, "base64").toString("utf8");
      const [redirectUri = "", returnPath = "/"] = decoded.split("|");
      if (!redirectUri) throw new Error("Invalid OAuth state");
      return { provider: "google", redirectUri, returnPath: sanitizeReturnPath(returnPath), mode: "login" };
    }
  }
}
function isSocialProviderConfigured(provider) {
  const secureRuntime = !ENV.isProduction || ENV.cookieSecret.length >= 32 && ENV.oauthEncryptionKey.length >= 32;
  if (!secureRuntime) return false;
  if (provider === "google") return Boolean(ENV.googleClientId && ENV.googleClientSecret);
  if (provider === "facebook") return Boolean(ENV.facebookAppId && ENV.facebookAppSecret);
  if (provider === "apple") {
    return Boolean(ENV.appleClientId && ENV.appleTeamId && ENV.appleKeyId && ENV.applePrivateKey);
  }
  return Boolean(ENV.instagramAppId && ENV.instagramAppSecret);
}
function getSocialProviderConfiguration() {
  return {
    google: isSocialProviderConfigured("google"),
    facebook: isSocialProviderConfigured("facebook"),
    apple: isSocialProviderConfigured("apple"),
    instagram: isSocialProviderConfigured("instagram")
  };
}
async function buildAuthorizationUrl(provider, state, redirectUri, codeVerifier, nonce) {
  if (provider === "google") {
    const url2 = new URL(GOOGLE_AUTH_ENDPOINT);
    url2.search = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createPkceChallenge(codeVerifier),
      code_challenge_method: "S256",
      prompt: "select_account"
    }).toString();
    return url2;
  }
  if (provider === "facebook") {
    const url2 = new URL(`https://www.facebook.com/${ENV.metaGraphApiVersion}/dialog/oauth`);
    url2.search = new URLSearchParams({
      client_id: ENV.facebookAppId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "public_profile,email",
      state
    }).toString();
    return url2;
  }
  if (provider === "apple") {
    const url2 = new URL(APPLE_AUTH_ENDPOINT);
    url2.search = new URLSearchParams({
      client_id: ENV.appleClientId,
      redirect_uri: redirectUri,
      response_type: "code id_token",
      response_mode: "form_post",
      scope: "name email",
      state,
      nonce
    }).toString();
    return url2;
  }
  const url = new URL(INSTAGRAM_AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: ENV.instagramAppId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic",
    state
  }).toString();
  return url;
}
async function createAppleClientSecret() {
  const privateKey = ENV.applePrivateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(privateKey, "ES256");
  return new SignJWT2({}).setProtectedHeader({ alg: "ES256", kid: ENV.appleKeyId }).setIssuer(ENV.appleTeamId).setSubject(ENV.appleClientId).setAudience("https://appleid.apple.com").setIssuedAt().setExpirationTime("5m").sign(key);
}
async function exchangeCode(provider, code, state) {
  if (provider === "google") {
    const body2 = new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: state.redirectUri
    });
    if (state.codeVerifier) body2.set("code_verifier", state.codeVerifier);
    const response2 = await fetch(GOOGLE_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body2 });
    if (!response2.ok) throw new Error(`Google token exchange failed (${response2.status})`);
    const value2 = await response2.json();
    return { accessToken: value2.access_token, refreshToken: value2.refresh_token, expiresIn: value2.expires_in, idToken: value2.id_token, scope: value2.scope };
  }
  if (provider === "facebook") {
    const url = new URL(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/oauth/access_token`);
    url.search = new URLSearchParams({ client_id: ENV.facebookAppId, client_secret: ENV.facebookAppSecret, redirect_uri: state.redirectUri, code }).toString();
    const response2 = await fetch(url);
    if (!response2.ok) throw new Error(`Facebook token exchange failed (${response2.status})`);
    const value2 = await response2.json();
    return { accessToken: value2.access_token, expiresIn: value2.expires_in, scope: "public_profile,email" };
  }
  if (provider === "apple") {
    const body2 = new URLSearchParams({
      client_id: ENV.appleClientId,
      client_secret: await createAppleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: state.redirectUri
    });
    const response2 = await fetch(APPLE_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body2 });
    if (!response2.ok) throw new Error(`Apple token exchange failed (${response2.status})`);
    const value2 = await response2.json();
    return { accessToken: value2.access_token, refreshToken: value2.refresh_token, expiresIn: value2.expires_in, idToken: value2.id_token, scope: "name email" };
  }
  const body = new URLSearchParams({
    client_id: ENV.instagramAppId,
    client_secret: ENV.instagramAppSecret,
    grant_type: "authorization_code",
    redirect_uri: state.redirectUri,
    code
  });
  const response = await fetch(INSTAGRAM_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Instagram token exchange failed (${response.status})`);
  const value = await response.json();
  return { accessToken: value.access_token, scope: value.permissions?.join(" ") ?? "instagram_business_basic" };
}
async function fetchGoogleProfile(tokens, nonce) {
  if (!tokens.idToken) throw new Error("Google identity token missing");
  await jwtVerify2(tokens.idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.googleClientId,
    ...nonce ? { requiredClaims: ["nonce"] } : {}
  }).then(({ payload }) => {
    if (nonce && payload.nonce !== nonce) throw new Error("Google nonce mismatch");
  });
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  if (!response.ok) throw new Error(`Google userinfo failed (${response.status})`);
  const raw = await response.json();
  return {
    providerUserId: String(raw.sub ?? ""),
    name: typeof raw.name === "string" ? raw.name : void 0,
    firstName: typeof raw.given_name === "string" ? raw.given_name : void 0,
    lastName: typeof raw.family_name === "string" ? raw.family_name : void 0,
    email: typeof raw.email === "string" ? raw.email.toLowerCase() : void 0,
    emailVerified: raw.email_verified === true,
    avatarUrl: typeof raw.picture === "string" ? raw.picture : void 0,
    raw
  };
}
async function fetchFacebookProfile(tokens) {
  const debugUrl = new URL(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/debug_token`);
  debugUrl.search = new URLSearchParams({ input_token: tokens.accessToken, access_token: `${ENV.facebookAppId}|${ENV.facebookAppSecret}` }).toString();
  const debugResponse = await fetch(debugUrl);
  const debug = await debugResponse.json();
  if (!debugResponse.ok || !debug.data?.is_valid || debug.data.app_id !== ENV.facebookAppId) {
    throw new Error("Facebook access token validation failed");
  }
  const profileUrl = new URL(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/me`);
  profileUrl.search = new URLSearchParams({ fields: "id,name,first_name,last_name,email,picture.type(large)", access_token: tokens.accessToken }).toString();
  const response = await fetch(profileUrl);
  if (!response.ok) throw new Error(`Facebook userinfo failed (${response.status})`);
  const raw = await response.json();
  if (String(raw.id ?? "") !== debug.data.user_id) throw new Error("Facebook user id mismatch");
  return {
    providerUserId: String(raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : void 0,
    firstName: typeof raw.first_name === "string" ? raw.first_name : void 0,
    lastName: typeof raw.last_name === "string" ? raw.last_name : void 0,
    email: typeof raw.email === "string" ? raw.email.toLowerCase() : void 0,
    emailVerified: false,
    avatarUrl: typeof raw.picture?.data?.url === "string" ? raw.picture.data.url : void 0,
    raw
  };
}
async function fetchAppleProfile(tokens, nonce, callbackUser) {
  if (!tokens.idToken) throw new Error("Apple identity token missing");
  const { payload } = await jwtVerify2(tokens.idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: ENV.appleClientId
  });
  if (nonce && payload.nonce !== nonce) throw new Error("Apple nonce mismatch");
  let supplied = {};
  if (callbackUser) {
    try {
      supplied = JSON.parse(callbackUser);
    } catch {
      supplied = {};
    }
  }
  const firstName = supplied.name?.firstName;
  const lastName = supplied.name?.lastName;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : supplied.email?.toLowerCase();
  return {
    providerUserId: String(payload.sub ?? ""),
    name: [firstName, lastName].filter(Boolean).join(" ") || void 0,
    firstName,
    lastName,
    email,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    raw: { sub: payload.sub, email, email_verified: payload.email_verified, is_private_email: payload.is_private_email, name: supplied.name }
  };
}
async function fetchInstagramProfile(tokens) {
  const url = new URL("https://graph.instagram.com/me");
  url.search = new URLSearchParams({ fields: "user_id,username,name,account_type,profile_picture_url", access_token: tokens.accessToken }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Instagram userinfo failed (${response.status})`);
  const raw = await response.json();
  const accountType = typeof raw.account_type === "string" ? raw.account_type.toUpperCase() : "";
  if (accountType !== "BUSINESS" && accountType !== "CREATOR") {
    throw new Error("Instagram professional account required");
  }
  return {
    providerUserId: String(raw.user_id ?? raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : void 0,
    username: typeof raw.username === "string" ? raw.username : void 0,
    avatarUrl: typeof raw.profile_picture_url === "string" ? raw.profile_picture_url : void 0,
    accountType,
    emailVerified: false,
    raw
  };
}
async function fetchProfile(provider, tokens, state, req) {
  if (provider === "google") return fetchGoogleProfile(tokens, state.nonce);
  if (provider === "facebook") return fetchFacebookProfile(tokens);
  if (provider === "apple") return fetchAppleProfile(tokens, state.nonce, req ? getQueryParam(req, "user") : void 0);
  return fetchInstagramProfile(tokens);
}
async function resolveUser(req, state, provider, profile) {
  if (!profile.providerUserId) throw new Error("Provider user id missing");
  if (state.mode === "connect") {
    const sessionUser = await sdk.authenticateRequest(req);
    if (!state.connectUserId || sessionUser.id !== state.connectUserId) throw new Error("OAuth connection session mismatch");
    const owner = await getUserByAuthProvider(provider, profile.providerUserId);
    if (owner && owner.id !== sessionUser.id) throw new Error("Social account already linked to another user");
    return { user: sessionUser, isNew: false };
  }
  let user = await getUserByAuthProvider(provider, profile.providerUserId);
  let isNew = false;
  if (!user && profile.email && profile.emailVerified) user = await getUserByEmail(profile.email);
  if (!user) {
    const openId = `${provider}:${profile.providerUserId}`;
    await upsertUser({
      openId,
      name: profile.name ?? profile.username ?? "Cliente Bonatto",
      email: profile.email ?? null,
      loginMethod: provider,
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    user = await getUserByOpenId(openId);
    isNew = true;
  }
  if (!user) throw new Error("Failed to resolve social user");
  return { user, isNew };
}
async function persistSocialAccount(userId, provider, profile, tokens, state, requestContext) {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const existingAccount = await getCustomerAuthProvider(userId, provider);
  await updateUserSocialProfile(userId, {
    name: !user.name && profile.name ? profile.name : void 0,
    firstName: !user.firstName && profile.firstName ? profile.firstName : void 0,
    lastName: !user.lastName && profile.lastName ? profile.lastName : void 0,
    email: !user.email && profile.email && profile.emailVerified ? profile.email : void 0,
    username: !user.username && profile.username ? profile.username : void 0,
    avatarUrl: !user.avatarUrl && profile.avatarUrl ? profile.avatarUrl : void 0,
    loginMethod: state.mode === "login" ? provider : void 0,
    emailVerified: profile.emailVerified || user.emailVerified,
    profileCompleted: Boolean(user.name || profile.name) && Boolean(user.email || profile.email),
    lastSignedIn: /* @__PURE__ */ new Date()
  });
  await linkCustomerAuthProvider({
    userId,
    provider,
    providerUserId: profile.providerUserId,
    providerEmail: profile.email ?? null,
    providerUsername: profile.username ?? null,
    displayName: profile.name ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    accountType: profile.accountType ?? null,
    accessTokenEncrypted: encryptOAuthToken(tokens.accessToken, ENV.oauthEncryptionKey),
    refreshTokenEncrypted: tokens.refreshToken ? encryptOAuthToken(tokens.refreshToken, ENV.oauthEncryptionKey) : existingAccount?.refreshTokenEncrypted ?? null,
    tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1e3) : existingAccount?.tokenExpiresAt ?? null,
    grantedScopes: tokens.scope?.split(/[ ,]+/).filter(Boolean) ?? [],
    rawProfileJson: JSON.stringify(profile.raw),
    isPrimary: state.mode === "login" && (user.loginMethod === provider || !user.loginMethod),
    consentVersion: state.consentVersion ?? OAUTH_CONSENT_VERSION,
    consentedAt: /* @__PURE__ */ new Date(),
    lastSyncedAt: /* @__PURE__ */ new Date()
  });
  if (state.redirectUri) {
    await recordUserConsent({
      userId,
      kind: "social_sync",
      version: state.consentVersion ?? OAUTH_CONSENT_VERSION,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null
    });
  }
}
async function finalizeLogin(req, res, openId, name, returnPath) {
  const sessionToken = await sdk.createSessionToken(openId, { name, expiresInMs: DEFAULT_SESSION_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: DEFAULT_SESSION_MS });
  res.redirect(302, sanitizeReturnPath(returnPath));
}
function callbackError(res, state, error) {
  const message = error instanceof Error ? error.message : "OAuth failed";
  const code = message === "Instagram professional account required" ? "instagram_professional_required" : "oauth_failed";
  const path = state?.mode === "connect" ? "/minha-conta?tab=perfil" : "/login";
  const separator = path.includes("?") ? "&" : "?";
  res.redirect(302, `${path}${separator}oauthError=${encodeURIComponent(code)}`);
}
async function handleOAuthCallback(req, res) {
  const code = getQueryParam(req, "code");
  const stateValue = getQueryParam(req, "state");
  if (!code || !stateValue) return res.status(400).json({ error: "code and state are required" });
  let state;
  try {
    state = await parseOAuthState(stateValue);
    const provider = state.provider;
    if (!provider || state.redirectUri !== buildCallbackUrl(req)) throw new Error("Invalid OAuth redirect target");
    const tokens = await exchangeCode(provider, code, state);
    const profile = await fetchProfile(provider, tokens, state, req);
    const { user, isNew } = await resolveUser(req, state, provider, profile);
    await persistSocialAccount(user.id, provider, profile, tokens, state, {
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null
    });
    await recordAuthEvent({
      userId: user.id,
      provider,
      event: state.mode === "connect" ? "provider_connected" : "login_success",
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null
    });
    if (isNew) fireJourneyTrigger("new_user", user.id, user.phone ?? void 0).catch(console.error);
    if (state.mode === "connect") return res.redirect(302, `${state.returnPath}${state.returnPath.includes("?") ? "&" : "?"}oauthConnected=${provider}`);
    const refreshed = await getUserById(user.id);
    return finalizeLogin(req, res, refreshed?.openId ?? user.openId, refreshed?.name ?? "Cliente Bonatto", state.returnPath);
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    await recordAuthEvent({ provider: state?.provider, event: "login_failure", ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null }).catch(console.error);
    return callbackError(res, state, error);
  }
}
async function syncSocialProvider(userId, provider) {
  if (provider === "apple") throw new Error("Apple profile requires reconnection");
  const account = await getCustomerAuthProvider(userId, provider);
  if (!account?.accessTokenEncrypted) throw new Error("Social connection has no reusable token");
  let accessToken = decryptOAuthToken(account.accessTokenEncrypted, ENV.oauthEncryptionKey);
  const refreshToken = decryptOAuthToken(account.refreshTokenEncrypted, ENV.oauthEncryptionKey) ?? void 0;
  if (!accessToken) throw new Error("Social connection token unavailable");
  let refreshedExpiresIn;
  if (provider === "google" && account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now() + 6e4) {
    if (!refreshToken) throw new Error("Google reconnection required");
    const body = new URLSearchParams({ client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, grant_type: "refresh_token", refresh_token: refreshToken });
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error("Google token refresh failed");
    const refreshed = await response.json();
    accessToken = refreshed.access_token;
    refreshedExpiresIn = refreshed.expires_in;
  } else if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now()) {
    throw new Error("Social provider reconnection required");
  }
  const tokens = { accessToken, refreshToken, expiresIn: refreshedExpiresIn, scope: account.grantedScopes ? JSON.parse(account.grantedScopes).join(" ") : void 0 };
  const profile = await fetchProfile(provider, tokens, { provider, redirectUri: "", returnPath: "/", mode: "connect" });
  await persistSocialAccount(userId, provider, profile, tokens, { provider, redirectUri: "", returnPath: "/", mode: "connect", consentVersion: account.consentVersion ?? OAUTH_CONSENT_VERSION });
  await recordAuthEvent({ userId, provider, event: "profile_synced" });
  return profile;
}
async function revokeSocialProvider(provider, accessTokenEncrypted, refreshTokenEncrypted) {
  const accessToken = decryptOAuthToken(accessTokenEncrypted, ENV.oauthEncryptionKey);
  const refreshToken = decryptOAuthToken(refreshTokenEncrypted, ENV.oauthEncryptionKey);
  if (!accessToken && !refreshToken) return;
  if (provider === "google") {
    const body = new URLSearchParams({ token: refreshToken ?? accessToken ?? "" });
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  } else if (provider === "facebook") {
    await fetch(`https://graph.facebook.com/${ENV.metaGraphApiVersion}/me/permissions?access_token=${encodeURIComponent(accessToken ?? "")}`, { method: "DELETE" });
  } else if (provider === "apple") {
    const body = new URLSearchParams({ client_id: ENV.appleClientId, client_secret: await createAppleClientSecret(), token: refreshToken ?? accessToken ?? "", token_type_hint: refreshToken ? "refresh_token" : "access_token" });
    await fetch(APPLE_REVOKE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  }
}
function registerOAuthRoutes(app) {
  const startHandler = async (req, res, forcedProvider) => {
    const provider = forcedProvider ?? getProvider2(req.params.provider);
    if (!provider || !isSocialProviderConfigured(provider)) return res.status(503).json({ error: "OAuth provider is not configured" });
    const mode = getQueryParam(req, "mode") === "connect" ? "connect" : "login";
    if (provider === "instagram" && mode !== "connect") return res.status(400).json({ error: "Instagram is available only as a professional account connection" });
    try {
      const connectUser = mode === "connect" ? await sdk.authenticateRequest(req) : null;
      const redirectUri = buildCallbackUrl(req);
      const returnPath = sanitizeReturnPath(getQueryParam(req, "returnTo") ?? (mode === "connect" ? "/minha-conta?tab=perfil" : "/"));
      const codeVerifier = randomBase64Url(48);
      const nonce = randomBase64Url(24);
      const state = await encryptOAuthState({ provider, redirectUri, returnPath, mode, connectUserId: connectUser?.id, codeVerifier, nonce, consentVersion: OAUTH_CONSENT_VERSION });
      const url = await buildAuthorizationUrl(provider, state, redirectUri, codeVerifier, nonce);
      return res.redirect(302, url.toString());
    } catch (error) {
      console.error(`[OAuth] ${provider} start failed`, error);
      return res.status(mode === "connect" ? 401 : 500).json({ error: "OAuth start failed" });
    }
  };
  app.get("/api/oauth/google/start", (req, res) => startHandler(req, res, "google"));
  app.get("/api/oauth/:provider/start", (req, res) => startHandler(req, res));
  app.get("/api/oauth/callback", handleOAuthCallback);
  app.post("/api/oauth/callback", handleOAuthCallback);
}

// server/_core/systemRouter.ts
init_notification();
import { z as z8 } from "zod";

// server/dailyReport.ts
init_db();
init_schema();
import { and as and13, gte as gte3, lt as lt2 } from "drizzle-orm";
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
    and13(
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
init_db();
import { sql as sql9 } from "drizzle-orm";
var systemRouter = router({
  socialAuthConfig: publicProcedure.query(() => ({
    providers: getSocialProviderConfiguration(),
    instagramProfessionalOnly: true
  })),
  health: publicProcedure.input(
    z8.object({
      timestamp: z8.number().min(0, "timestamp cannot be negative")
    })
  ).query(async () => {
    const startedAt = Date.now();
    let database = "down";
    try {
      const db = await getDb();
      if (db) {
        await db.execute(sql9`SELECT 1`);
        database = "ok";
      }
    } catch {
      database = "down";
    }
    return {
      ok: database === "ok",
      database,
      latencyMs: Date.now() - startedAt,
      services: {
        push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        email: Boolean(process.env.RESEND_API_KEY),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
        asaas: Boolean(process.env.ASAAS_API_KEY),
        ifood: Boolean(process.env.IFOOD_CLIENT_ID && process.env.IFOOD_CLIENT_SECRET)
      }
    };
  }),
  notifyOwner: adminProcedure.input(
    z8.object({
      title: z8.string().min(1, "title is required"),
      content: z8.string().min(1, "content is required")
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
import { and as and14, eq as eq16, sql as sql10 } from "drizzle-orm";
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
  const result = await db.execute(sql10.raw(query));
  const rows = result[0];
  return rows.length > 0;
}
async function hasIndex2(db, tableName, indexName) {
  const query = `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`;
  const result = await db.execute(sql10.raw(query));
  const rows = result[0];
  return rows.length > 0;
}
async function ensureIfoodSyncSchema(db) {
  if (ensureSchemaPromise) {
    return ensureSchemaPromise;
  }
  ensureSchemaPromise = (async () => {
    if (!await hasColumn2(db, "categories", "externalSource")) {
      await db.execute(sql10.raw("ALTER TABLE `categories` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!await hasIndex2(db, "categories", "categories_external_uq")) {
      await db.execute(sql10.raw("CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn2(db, "products", "externalSource")) {
      await db.execute(
        sql10.raw(
          "ALTER TABLE `products` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128), ADD `externalCode` varchar(128)"
        )
      );
    }
    if (!await hasIndex2(db, "products", "products_external_uq")) {
      await db.execute(sql10.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn2(db, "coupons", "externalSource")) {
      await db.execute(sql10.raw("ALTER TABLE `coupons` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!await hasIndex2(db, "coupons", "coupons_external_uq")) {
      await db.execute(sql10.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
    if (!await hasColumn2(db, "promotions", "externalSource")) {
      await db.execute(sql10.raw("ALTER TABLE `promotions` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!await hasIndex2(db, "promotions", "promotions_external_uq")) {
      await db.execute(sql10.raw("CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`externalSource`,`externalMerchantId`,`externalId`)"));
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
        and14(
          eq16(categories.externalSource, IFOOD_SOURCE),
          eq16(categories.externalMerchantId, merchantId),
          eq16(categories.externalId, remoteCategory.id)
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
        }).where(eq16(categories.id, categoryId));
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
          and14(
            eq16(products.externalSource, IFOOD_SOURCE),
            eq16(products.externalMerchantId, merchantId),
            eq16(products.externalId, remoteItem.id)
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
          }).where(eq16(products.id, existingProduct[0].id));
          productsUpdated += 1;
        } else {
          await db.insert(products).values(productPayload);
          productsImported += 1;
        }
      }
    }
    const existingMerchantCategories = await db.select({ id: categories.id, externalId: categories.externalId }).from(categories).where(and14(eq16(categories.externalSource, IFOOD_SOURCE), eq16(categories.externalMerchantId, merchantId)));
    let categoriesDeactivated = 0;
    for (const localCategory of existingMerchantCategories) {
      if (localCategory.externalId && !seenCategoryIds.has(localCategory.externalId)) {
        await db.update(categories).set({ active: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq16(categories.id, localCategory.id));
        categoriesDeactivated += 1;
      }
    }
    const existingMerchantProducts = await db.select({ id: products.id, externalId: products.externalId }).from(products).where(and14(eq16(products.externalSource, IFOOD_SOURCE), eq16(products.externalMerchantId, merchantId)));
    let productsDeactivated = 0;
    for (const localProduct of existingMerchantProducts) {
      if (localProduct.externalId && !seenProductIds.has(localProduct.externalId)) {
        await db.update(products).set({ active: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq16(products.id, localProduct.id));
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
          and14(
            eq16(promotions.externalSource, IFOOD_SOURCE),
            eq16(promotions.externalMerchantId, merchant.id),
            eq16(promotions.externalId, externalId)
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
          }).where(eq16(promotions.id, existing[0].id));
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
    }).where(eq16(orders.ifoodOrderId, ifoodOrderId));
    console.log(`[iFood] Pedido ${ifoodOrderId} -> ${newStatus}`);
  }
}
async function handleNewOrder(db, ifoodOrderId) {
  const existing = await db.select({ id: orders.id }).from(orders).where(eq16(orders.ifoodOrderId, ifoodOrderId)).limit(1);
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
import { z as z9 } from "zod";
var marketplaceProviderIdSchema = z9.enum([
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
var marketplaceConfigSchema = z9.object({
  enabled: z9.boolean().default(false),
  merchantId: z9.string().trim().max(120).optional().default(""),
  externalStoreId: z9.string().trim().max(120).optional().default(""),
  regionHint: z9.string().trim().max(120).optional().default(""),
  aggregationIds: z9.array(z9.string().trim().min(1).max(120)).max(20).optional().default([]),
  notes: z9.string().trim().max(500).optional().default("")
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
init_runtimeSchema();
import { TRPCError as TRPCError11 } from "@trpc/server";
import { sql as sql11 } from "drizzle-orm";
import crypto4 from "crypto";
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
async function requireDb3() {
  const db = await getDb();
  if (!db) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Database indisponivel." });
  return db;
}
async function getDefaultStoreId(db) {
  const rows = asRows(await db.execute(sql11.raw(`
    SELECT id
    FROM stores
    WHERE active = true
    ORDER BY isDefault DESC, id ASC
    LIMIT 1
  `)));
  return Number(rows[0]?.id ?? 0);
}
async function resolveIntegrationRestaurantId(requestedStoreId) {
  const db = await requireDb3();
  return requestedStoreId ?? await getDefaultStoreId(db);
}
async function ensureIfoodIntegrationSchema() {
  if (!shouldRunRuntimeSchemaMigrations()) return;
  const db = await requireDb3();
  await db.execute(sql11.raw(`
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
  const syncColumn = asRows(await db.execute(sql11`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ifood_integrations'
      AND COLUMN_NAME = 'last_sync_at'
  `));
  if (Number(syncColumn[0]?.count ?? 0) === 0) {
    await db.execute(sql11.raw("ALTER TABLE ifood_integrations ADD COLUMN last_sync_at timestamp NULL AFTER last_connected_at"));
  }
  await db.execute(sql11.raw(`
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
  await db.execute(sql11.raw(`
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
    const db = await requireDb3();
    const rows = asRows(await db.execute(sql11`
      SELECT id, restaurant_id, action, message, payload, created_at
      FROM ifood_logs
      WHERE restaurant_id = ${restaurantId}
      ORDER BY created_at DESC, id DESC
      LIMIT 40
    `));
    return rows.map(mapLog);
  }
  async create(restaurantId, action, message, payload) {
    const db = await requireDb3();
    await db.execute(sql11`
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
    const db = await requireDb3();
    const rows = asRows(await db.execute(sql11`
      SELECT *
      FROM ifood_integrations
      WHERE restaurant_id = ${restaurantId}
      LIMIT 1
    `));
    return mapIntegration(rows[0], restaurantId);
  }
  async connect(restaurantId) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb3();
    await db.execute(sql11`
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
    const db = await requireDb3();
    await db.execute(sql11`
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
    const db = await requireDb3();
    const rows = asRows(await db.execute(sql11`
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
    const db = await requireDb3();
    const displayId = String(1e3 + Math.floor(Math.random() * 8999));
    const externalOrderId = `mock-ifood-${crypto4.randomUUID()}`;
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
    await db.execute(sql11`
      INSERT INTO external_orders
        (restaurant_id, channel, external_order_id, display_id, status, customer_name, total_amount, payload)
      VALUES
        (${restaurantId}, 'ifood', ${externalOrderId}, ${displayId}, 'novo', 'Cliente iFood Teste', '89.80', ${JSON.stringify(payload)})
    `);
    await db.execute(sql11`UPDATE ifood_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE restaurant_id = ${restaurantId} LIMIT 1`);
    const rows = asRows(await db.execute(sql11`SELECT LAST_INSERT_ID() AS id`));
    const order = await this.getById(Number(rows[0]?.id), restaurantId);
    await this.logs.create(restaurantId, "order.generated", `Pedido teste iFood #${displayId} gerado.`, {
      orderId: order.id,
      externalOrderId
    });
    return order;
  }
  async updateStatus(orderId, restaurantId, status) {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb3();
    const current = await this.getById(orderId, restaurantId);
    await db.execute(sql11`
      UPDATE external_orders
      SET status = ${status}
      WHERE id = ${orderId}
        AND restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      LIMIT 1
    `);
    await db.execute(sql11`UPDATE ifood_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE restaurant_id = ${restaurantId} LIMIT 1`);
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
    const db = await requireDb3();
    const rows = asRows(await db.execute(sql11`
      SELECT *
      FROM external_orders
      WHERE id = ${orderId}
        AND restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      LIMIT 1
    `));
    if (!rows[0]) throw new TRPCError11({ code: "NOT_FOUND", message: "Pedido iFood n\xE3o encontrado." });
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
    throw new TRPCError11({
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
init_runtimeSchema();
import { sql as sql12 } from "drizzle-orm";
import { z as z10 } from "zod";
function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
function money(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
async function executeRows(db, query) {
  const result = await db.execute(sql12.raw(query));
  return result[0] ?? [];
}
async function hasColumn3(db, tableName, columnName) {
  const result = await db.execute(sql12`
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
  if (!shouldRunRuntimeSchemaMigrations()) return;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.execute(sql12.raw(`
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
  await db.execute(sql12.raw(`
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
  await db.execute(sql12.raw(`
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
  await db.execute(sql12.raw(`
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
    await db.execute(sql12.raw("ALTER TABLE store_supply_order_items ADD COLUMN distributionProductId int NULL AFTER supplyOrderId"));
    await db.execute(sql12.raw("ALTER TABLE store_supply_order_items ADD KEY supply_items_distribution_product_idx (distributionProductId)"));
  }
  await db.execute(sql12.raw(`
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
  await db.execute(sql12.raw(`
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
  await db.execute(sql12.raw(`
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
  await db.execute(sql12.raw(`
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
  await db.execute(sql12`
    INSERT INTO network_audit_logs (actorUserId, storeId, action, entityType, entityId, metadata)
    VALUES (${input.actorUserId ?? null}, ${input.storeId ?? null}, ${input.action}, ${input.entityType}, ${input.entityId ?? null}, ${JSON.stringify(input.metadata ?? {})})
  `);
}
var supplyOrderItemSchema = z10.object({
  productId: z10.number().int().positive(),
  quantityRequested: z10.string().regex(/^\d+(\.\d{1,3})?$/),
  quantityApproved: z10.string().regex(/^\d+(\.\d{1,3})?$/).optional()
});
var createSupplyOrderSchema = z10.object({
  storeId: z10.number().int().positive(),
  notes: z10.string().max(5e3).optional(),
  submit: z10.boolean().optional(),
  items: z10.array(supplyOrderItemSchema).min(1).max(100)
});
var distributionProductSchema = z10.object({
  name: z10.string().min(1).max(180),
  category: z10.string().max(120).optional(),
  unit: z10.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]),
  availableQuantity: z10.string().regex(/^\d+(\.\d{1,3})?$/),
  minimumQuantity: z10.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  minOrderQuantity: z10.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  maxOrderQuantity: z10.string().regex(/^\d+(\.\d{1,3})?$/).optional(),
  unitCost: z10.string().regex(/^\d+(\.\d{1,4})?$/),
  active: z10.boolean().optional(),
  notes: z10.string().max(5e3).optional()
});
var updateDistributionProductSchema = distributionProductSchema.partial().extend({
  id: z10.number().int().positive()
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
  const result = await db.execute(sql12`
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
  if (input.name !== void 0) fields.push(sql12`name = ${input.name}`);
  if (input.category !== void 0) fields.push(sql12`category = ${input.category || null}`);
  if (input.unit !== void 0) fields.push(sql12`unit = ${input.unit}`);
  if (input.availableQuantity !== void 0) fields.push(sql12`availableQuantity = ${input.availableQuantity}`);
  if (input.minimumQuantity !== void 0) fields.push(sql12`minimumQuantity = ${input.minimumQuantity}`);
  if (input.minOrderQuantity !== void 0) fields.push(sql12`minOrderQuantity = ${input.minOrderQuantity}`);
  if (input.maxOrderQuantity !== void 0) fields.push(sql12`maxOrderQuantity = ${input.maxOrderQuantity || null}`);
  if (input.unitCost !== void 0) fields.push(sql12`unitCost = ${input.unitCost}`);
  if (input.active !== void 0) fields.push(sql12`active = ${input.active}`);
  if (input.notes !== void 0) fields.push(sql12`notes = ${input.notes || null}`);
  if (fields.length === 0) return { ok: true };
  await db.execute(sql12`
    UPDATE distribution_products
    SET ${sql12.join(fields, sql12`, `)}
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
  const result = await db.execute(sql12`
    INSERT INTO store_supply_orders (storeId, requestedByUserId, status, estimatedCost, notes)
    VALUES (${input.storeId}, ${actorUserId}, ${status}, ${estimatedCost.toFixed(2)}, ${input.notes ?? null})
  `);
  const orderId = Number(result[0]?.insertId ?? 0);
  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) continue;
    const approved = item.quantityApproved ?? item.quantityRequested;
    await db.execute(sql12`
      INSERT INTO store_supply_order_items
        (supplyOrderId, distributionProductId, ingredientId, productName, unit, quantityRequested, quantityApproved, unitCost)
      VALUES
        (${orderId}, ${item.productId}, ${item.productId}, ${product.name}, ${product.unit}, ${item.quantityRequested}, ${approved}, ${money(product.unitCost).toFixed(4)})
    `);
  }
  await audit({ actorUserId, storeId: input.storeId, action: "supply_order.create", entityType: "store_supply_order", entityId: orderId, metadata: { status } });
  return { id: orderId };
}
var updateSupplyOrderStatusSchema = z10.object({
  id: z10.number().int().positive(),
  status: z10.enum(["submitted", "in_review", "approved", "picking", "shipped", "received", "rejected", "cancelled"]),
  notes: z10.string().max(5e3).optional()
});
async function updateSupplyOrderStatus(input, actorUserId) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const details = await getSupplyOrderDetails(input.id);
  if (!details) throw new Error("Pedido ao CD nao encontrado");
  if (input.status === "shipped") {
    await db.execute(sql12`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes), shippedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
    `);
  } else if (input.status === "received") {
    await db.execute(sql12`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes), receivedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
    `);
  } else if (["approved", "rejected", "cancelled", "in_review"].includes(input.status)) {
    await db.execute(sql12`
      UPDATE store_supply_orders
      SET status = ${input.status}, reviewedByUserId = ${actorUserId}, notes = COALESCE(${input.notes ?? null}, notes), reviewedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.id}
    `);
  } else {
    await db.execute(sql12`
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
      await db.execute(sql12.raw(`
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
      const existingIngredientResult = await db.execute(sql12`
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
        const inserted = await db.execute(sql12`
          INSERT INTO ingredients (storeId, name, category, unit, currentStock, minimumStock, unitCost, supplier, notes, active)
          VALUES (${storeId}, ${productName}, ${"CD"}, ${unit}, ${"0.000"}, ${"0.000"}, ${unitCost}, ${"Centro de Distribui\xE7\xE3o"}, ${`Criado automaticamente no recebimento do pedido ao CD #${input.id}`}, ${true})
        `);
        ingredientId = Number(inserted[0]?.insertId ?? 0);
      }
      await db.execute(sql12`
        UPDATE ingredients
        SET currentStock = CAST(currentStock AS DECIMAL(12,3)) + ${quantity}, unitCost = ${unitCost}
        WHERE id = ${ingredientId}
      `);
      await db.execute(sql12`
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
var createExpenseSchema = z10.object({
  storeId: z10.number().int().positive().optional(),
  category: z10.string().min(1).max(120),
  description: z10.string().min(1).max(255),
  amount: z10.string().regex(/^\d+(\.\d{1,2})?$/),
  paymentMethod: z10.string().max(80).optional(),
  status: z10.enum(["pending", "paid", "cancelled"]).optional(),
  expenseDate: z10.date(),
  receiptUrl: z10.string().url().optional(),
  notes: z10.string().max(5e3).optional()
});
async function createExpense(input, actorUserId, scopedStoreId2) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId2 ?? input.storeId ?? null;
  const result = await db.execute(sql12`
    INSERT INTO network_expenses
      (storeId, category, description, amount, paymentMethod, status, expenseDate, receiptUrl, createdByUserId, notes)
    VALUES
      (${storeId}, ${input.category}, ${input.description}, ${input.amount}, ${input.paymentMethod ?? null}, ${input.status ?? "paid"}, ${toSqlDate(input.expenseDate).slice(0, 10)}, ${input.receiptUrl ?? null}, ${actorUserId}, ${input.notes ?? null})
  `);
  const id = Number(result[0]?.insertId ?? 0);
  await audit({ actorUserId, storeId, action: "expense.create", entityType: "network_expense", entityId: id, metadata: input });
  return { id };
}
var createFinancialFeeSchema = z10.object({
  storeId: z10.number().int().positive().optional(),
  name: z10.string().min(1).max(160),
  category: z10.string().min(1).max(120),
  calculationType: z10.enum(["fixed", "percentage"]).default("fixed"),
  rate: z10.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  amount: z10.string().regex(/^\d+(\.\d{1,2})?$/),
  periodStart: z10.date(),
  periodEnd: z10.date(),
  notes: z10.string().max(5e3).optional()
});
async function createFinancialFee(input, actorUserId, scopedStoreId2) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId2 ?? input.storeId ?? null;
  const result = await db.execute(sql12`
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
var createMonthlyClosingSchema = z10.object({
  storeId: z10.number().int().positive().optional(),
  year: z10.number().int().min(2020).max(2100),
  month: z10.number().int().min(1).max(12),
  status: z10.enum(["open", "in_review", "closed", "reopened"]).default("in_review"),
  notes: z10.string().max(5e3).optional()
});
async function upsertMonthlyClosing(input, actorUserId, scopedStoreId2) {
  await ensureRestaurantNetworkSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const storeId = scopedStoreId2 ?? input.storeId ?? null;
  const start = new Date(input.year, input.month - 1, 1);
  const end = new Date(input.year, input.month, 0, 23, 59, 59);
  const overview = await getFinancialOverview({ storeId: storeId ?? void 0, startDate: start, endDate: end });
  const totals = overview.totals;
  const closedAt = input.status === "closed" ? "CURRENT_TIMESTAMP" : "NULL";
  await db.execute(sql12.raw(`
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
import { eq as eq17 } from "drizzle-orm";
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
  const [orderRow] = await db.select().from(orders).where(eq17(orders.id, orderId));
  if (!orderRow) return { success: false, error: "Pedido n\xE3o encontrado" };
  const items = await db.select().from(orderItems).where(eq17(orderItems.orderId, orderId));
  const storeRow = orderRow.storeId ? (await db.select().from(stores).where(eq17(stores.id, orderRow.storeId)))[0] : null;
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
      }).where(eq17(orders.id, orderId));
      return {
        success: true,
        chave: data.chave_nfe,
        urlDanfe: data.url_danfe || data.caminho_danfe
      };
    }
    const errorMsg = data.mensagem_sefaz || (Array.isArray(data.erros) ? data.erros.map((e) => e.mensagem).join("; ") : null) || `Status: ${data.status}`;
    await db.update(orders).set({ nfceStatus: "error" }).where(eq17(orders.id, orderId));
    return { success: false, error: errorMsg };
  } catch (err) {
    console.error("[FocusNFe] Erro ao emitir NFC-e:", err);
    return { success: false, error: err.message || "Erro de conex\xE3o com Focus NFe" };
  }
}
async function cancelarNfce(orderId, justificativa) {
  const db = await getDb();
  if (!db) return { success: false, error: "DB indispon\xEDvel" };
  const [orderRow] = await db.select().from(orders).where(eq17(orders.id, orderId));
  if (!orderRow?.nfceKey) return { success: false, error: "NFC-e n\xE3o emitida para este pedido" };
  const storeRow = orderRow.storeId ? (await db.select().from(stores).where(eq17(stores.id, orderRow.storeId)))[0] : null;
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
      await db.update(orders).set({ nfceStatus: "cancelled" }).where(eq17(orders.id, orderId));
      return { success: true };
    }
    return { success: false, error: data.mensagem_sefaz || "Erro ao cancelar NFC-e" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// server/routers.ts
import bcrypt from "bcryptjs";
import crypto5 from "crypto";

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
import { and as and15, eq as eq18, sql as sql13 } from "drizzle-orm";
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
    and15(
      order.storeId ? eq18(orders.storeId, order.storeId) : void 0,
      sql13`${orders.status} IN ('pending', 'confirmed', 'preparing', 'out_for_delivery')`
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
  const rows = await db.execute(sql13`
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
  const existing = await db.select({ id: customerMetrics.id }).from(customerMetrics).where(and15(eq18(customerMetrics.userId, userId), eq18(customerMetrics.storeId, scopeStoreId))).limit(1);
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
    await db.update(customerMetrics).set(payload).where(eq18(customerMetrics.id, existing[0].id));
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
    const existingCreatedLog = await db.select({ id: orderStageLogs.id }).from(orderStageLogs).where(and15(eq18(orderStageLogs.orderId, orderId), eq18(orderStageLogs.stage, "created"))).limit(1);
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
        }).where(eq18(orders.id, orderId));
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
      await db.update(orders).set(patch).where(eq18(orders.id, orderId));
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
var adminProcedure2 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError12({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});
async function assertPaymentMethodEnabled(paymentMethod, storeId) {
  const publicPaymentSettings = await getPaymentSettingsPublic(storeId);
  const orderConfig = publicPaymentSettings.config.orders;
  const tenant = storeId ? await getWhiteLabelRuntimeByStoreId(storeId) : null;
  if (tenant && tenant.status !== "active") {
    throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "Esta loja nao esta disponivel para pagamentos." });
  }
  if (tenant) {
    const tenantPayments = tenant.providers.payments;
    const providerEnabled = paymentMethod === "pix" ? tenantPayments.pix : paymentMethod === "cash" ? tenantPayments.cash : tenantPayments.card;
    if (!providerEnabled) {
      throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "Este metodo de pagamento nao esta habilitado para a loja." });
    }
  }
  if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && !orderConfig.cardEnabled) {
    throw new TRPCError12({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos por cart\xE3o est\xE3o desativados no momento."
    });
  }
  if (paymentMethod === "pix" && !orderConfig.pixEnabled) {
    throw new TRPCError12({
      code: "PRECONDITION_FAILED",
      message: "Pagamentos via PIX est\xE3o desativados no momento."
    });
  }
  if (paymentMethod === "cash" && !orderConfig.cashEnabled) {
    throw new TRPCError12({
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
  return crypto5.createHash("sha256").update(code).digest("hex");
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
    registerEmail: publicProcedure.input(z11.object({
      name: z11.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      email: z11.string().email("E-mail inv\xE1lido"),
      password: z11.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      acceptTerms: z11.literal(true, "Aceite os Termos de Uso e a Pol\xEDtica de Privacidade"),
      consentVersion: z11.string().min(1).max(32).default("2026-08-01")
    })).mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new TRPCError12({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `email_${crypto5.randomBytes(16).toString("hex")}`;
      const name = input.name.trim();
      await createEmailUser({ openId, name, email, passwordHash });
      const user = await getUserByEmail(email);
      if (!user) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar a conta" });
      await linkCustomerAuthProvider({
        userId: user.id,
        provider: "email",
        providerUserId: email,
        providerEmail: email,
        displayName: name,
        isPrimary: true,
        consentVersion: input.consentVersion,
        consentedAt: /* @__PURE__ */ new Date()
      });
      await Promise.all([
        recordUserConsent({ userId: user.id, kind: "terms", version: input.consentVersion, ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
        recordUserConsent({ userId: user.id, kind: "privacy", version: input.consentVersion, ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null }),
        recordAuthEvent({ userId: user.id, provider: "email", event: "login_success", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null })
      ]);
      sendWelcomeEmail(email, name).catch(console.error);
      const sessionToken = await sdk.createSessionToken(openId, { name, expiresInMs: DEFAULT_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    }),
    loginEmail: publicProcedure.input(z11.object({
      email: z11.string().email("E-mail inv\xE1lido"),
      password: z11.string().min(1)
    })).mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const user = await getUserByEmail(email);
      if (!user || !user.passwordHash) {
        await recordAuthEvent({ provider: "email", event: "login_failure", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null });
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        await recordAuthEvent({ userId: user.id, provider: "email", event: "login_failure", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null });
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      }
      await Promise.all([
        markUserLogin(user.id, "email"),
        recordAuthEvent({ userId: user.id, provider: "email", event: "login_success", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null })
      ]);
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: DEFAULT_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    }),
    forgotPassword: publicProcedure.input(z11.object({
      email: z11.string().email("E-mail inv\xE1lido")
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user) return { success: true, emailSent: false };
      const token = crypto5.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
      await saveResetToken(input.email, token, expiresAt);
      const configured = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
      let origin = configured;
      if (!origin) {
        if (process.env.NODE_ENV === "production") {
          console.error("[forgotPassword] PUBLIC_APP_URL n\xE3o configurado em produ\xE7\xE3o.");
          throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Servidor n\xE3o configurado para envio de e-mail." });
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
    resetPassword: publicProcedure.input(z11.object({
      token: z11.string().min(1),
      password: z11.string().min(6, "Senha deve ter pelo menos 6 caracteres")
    })).mutation(async ({ input, ctx }) => {
      const user = await getUserByResetToken(input.token);
      if (!user || !user.resetTokenExpiresAt) {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Token inv\xE1lido ou expirado" });
      }
      if (/* @__PURE__ */ new Date() > user.resetTokenExpiresAt) {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo link." });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      await updateUserPasswordHash(user.openId, passwordHash);
      await clearResetToken(user.openId);
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: DEFAULT_SESSION_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: DEFAULT_SESSION_MS });
      return { success: true };
    }),
    requestPhoneOtp: publicProcedure.input(z11.object({
      phone: z11.string().min(10, "Telefone inv\xE1lido"),
      purpose: z11.enum(["login", "verify_phone"]).optional()
    })).mutation(async ({ input, ctx }) => {
      const phone = normalizePhone(input.phone);
      if (phone.length < 10) {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Telefone inv\xE1lido" });
      }
      const recentRequests = await countRecentOtpRequests(phone, 10);
      if (recentRequests >= 5) {
        throw new TRPCError12({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos." });
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
    verifyPhoneOtp: publicProcedure.input(z11.object({
      phone: z11.string().min(10, "Telefone inv\xE1lido"),
      code: z11.string().length(6, "C\xF3digo inv\xE1lido"),
      purpose: z11.enum(["login", "verify_phone"]).optional(),
      name: z11.string().min(2).optional()
    })).mutation(async ({ input, ctx }) => {
      const phone = normalizePhone(input.phone);
      const otp = await getLatestOtpCode(phone, input.purpose ?? "login");
      if (!otp || otp.consumedAt || new Date(otp.expiresAt).getTime() < Date.now()) {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "C\xF3digo expirado ou inv\xE1lido" });
      }
      if ((otp.attempts ?? 0) >= 5) {
        throw new TRPCError12({ code: "TOO_MANY_REQUESTS", message: "C\xF3digo bloqueado por excesso de tentativas" });
      }
      if (otp.codeHash !== hashOtpCode(input.code)) {
        await incrementOtpAttempts(otp.id);
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "C\xF3digo incorreto" });
      }
      await consumeOtpCode(otp.id);
      let user = await getUserByPhone(phone);
      if (!user) {
        user = await createPhoneUser({
          openId: `phone_${phone}_${crypto5.randomBytes(8).toString("hex")}`,
          name: input.name ?? "Cliente Bonatto",
          phone
        });
      }
      if (!user) {
        throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar usu\xE1rio por telefone" });
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
    }),
    socialAccounts: protectedProcedure.query(async ({ ctx }) => {
      const [accounts, user] = await Promise.all([
        getCustomerAuthProviders(ctx.user.id),
        getUserById(ctx.user.id)
      ]);
      const safeAccounts = accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerEmail: account.providerEmail,
        providerUsername: account.providerUsername,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        accountType: account.accountType,
        isPrimary: account.isPrimary,
        grantedScopes: account.grantedScopes ? JSON.parse(account.grantedScopes) : [],
        connectedAt: account.linkedAt,
        lastSyncedAt: account.lastSyncedAt
      }));
      if (user?.passwordHash && !safeAccounts.some((account) => account.provider === "email")) {
        safeAccounts.unshift({
          id: 0,
          provider: "email",
          providerEmail: user.email,
          providerUsername: null,
          displayName: user.name,
          avatarUrl: null,
          accountType: null,
          isPrimary: user.loginMethod === "email",
          grantedScopes: [],
          connectedAt: user.createdAt,
          lastSyncedAt: user.lastSignedIn
        });
      }
      return safeAccounts;
    }),
    syncSocialAccount: protectedProcedure.input(z11.object({ provider: z11.enum(["google", "facebook", "apple", "instagram"]) })).mutation(async ({ ctx, input }) => {
      try {
        await syncSocialProvider(ctx.user.id, input.provider);
        return { success: true };
      } catch (error) {
        console.error("[auth.syncSocialAccount] failed", error);
        throw new TRPCError12({ code: "BAD_REQUEST", message: "N\xE3o foi poss\xEDvel sincronizar esta conta. Reconecte o provedor e tente novamente." });
      }
    }),
    disconnectSocialAccount: protectedProcedure.input(z11.object({ provider: z11.enum(["google", "facebook", "apple", "instagram"]) })).mutation(async ({ ctx, input }) => {
      const [account, accounts, user] = await Promise.all([
        getCustomerAuthProvider(ctx.user.id, input.provider),
        getCustomerAuthProviders(ctx.user.id),
        getUserById(ctx.user.id)
      ]);
      if (!account) throw new TRPCError12({ code: "NOT_FOUND", message: "Conex\xE3o social n\xE3o encontrada" });
      const alternativeLoginMethods = accounts.filter((item) => item.provider !== input.provider && item.provider !== "instagram").length + (user?.passwordHash ? 1 : 0);
      if (input.provider !== "instagram" && alternativeLoginMethods === 0) {
        throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "Cadastre uma senha ou conecte outro provedor antes de remover seu \xFAnico acesso." });
      }
      await revokeSocialProvider(input.provider, account.accessTokenEncrypted, account.refreshTokenEncrypted).catch((error) => {
        console.warn("[auth.disconnectSocialAccount] remote revoke failed", error);
      });
      await Promise.all([
        disconnectCustomerAuthProvider(ctx.user.id, input.provider),
        recordAuthEvent({ userId: ctx.user.id, provider: input.provider, event: "provider_disconnected", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null })
      ]);
      return { success: true };
    }),
    deleteAccount: protectedProcedure.input(z11.object({ confirmation: z11.literal("EXCLUIR"), password: z11.string().optional() })).mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError12({ code: "NOT_FOUND" });
      if (user.passwordHash) {
        if (!input.password || !await bcrypt.compare(input.password, user.passwordHash)) {
          throw new TRPCError12({ code: "UNAUTHORIZED", message: "Confirme sua senha para excluir a conta." });
        }
      }
      const accounts = await getCustomerAuthProviders(user.id);
      await Promise.all(accounts.filter((account) => account.provider === "google" || account.provider === "facebook" || account.provider === "apple" || account.provider === "instagram").map((account) => revokeSocialProvider(account.provider, account.accessTokenEncrypted, account.refreshTokenEncrypted).catch(console.warn)));
      await recordAuthEvent({ userId: user.id, event: "account_deleted", ipAddress: ctx.req.ip ?? null, userAgent: ctx.req.get("user-agent") ?? null });
      await anonymizeUserAccount(user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // --- CATEGORIES -------------------------------------------------------------
  categories: router({
    list: publicProcedure.input(z11.object({ activeOnly: z11.boolean().optional(), storeId: z11.number().optional() }).optional()).query(({ input }) => getCategories({ activeOnly: input?.activeOnly ?? true, storeId: input?.storeId })),
    listAll: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getCategories({ activeOnly: false, storeId });
    }),
    create: staffProcedure.input(
      z11.object({
        name: z11.string().min(1),
        slug: z11.string().min(1),
        description: z11.string().optional(),
        imageUrl: z11.string().max(2048).optional(),
        icon: z11.string().max(64).optional(),
        sortOrder: z11.number().optional(),
        storeId: z11.number().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return createCategory({ ...input, storeId: storeId ?? 0, active: true });
    }),
    update: staffProcedure.input(
      z11.object({
        id: z11.number(),
        name: z11.string().optional(),
        description: z11.string().optional(),
        imageUrl: z11.string().max(2048).optional(),
        icon: z11.string().max(64).optional(),
        sortOrder: z11.number().optional(),
        active: z11.boolean().optional(),
        storeId: z11.number().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const category = await getCategoryById(input.id);
      if (!category) throw new TRPCError12({ code: "NOT_FOUND", message: "Categoria n\xE3o encontrada." });
      await assertStoreEntityAccess(ctx.user, category.storeId, input.storeId);
      const { id, storeId: _storeId, ...data } = input;
      return updateCategory(id, data);
    }),
    uploadImage: staffProcedure.input(z11.object({
      base64: z11.string().max(43e5),
      mimeType: z11.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z11.string().max(255).optional()
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
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const category = await getCategoryById(input.id);
      if (!category) throw new TRPCError12({ code: "NOT_FOUND", message: "Categoria n\xE3o encontrada." });
      await assertStoreEntityAccess(ctx.user, category.storeId, input.storeId);
      return deleteCategory(input.id);
    })
  }),
  // --- PRODUCTS ---------------------------------------------------------------
  products: router({
    list: publicProcedure.input(z11.object({ categoryId: z11.number().optional(), storeId: z11.number().optional() }).optional()).query(({ input }) => getProducts({ categoryId: input?.categoryId, storeId: input?.storeId, activeOnly: true })),
    listAll: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getProducts({ activeOnly: false, storeId });
    }),
    byId: publicProcedure.input(z11.object({ id: z11.number() })).query(({ input }) => getProductById(input.id)),
    byIds: publicProcedure.input(z11.object({ ids: z11.array(z11.number()).max(100) })).query(({ input }) => getProductsByIds(Array.from(new Set(input.ids)))),
    create: staffProcedure.input(
      z11.object({
        categoryId: z11.number(),
        name: z11.string().min(1).max(200),
        description: z11.string().max(2e3).optional(),
        price: z11.string().regex(/^\d+(\.\d{1,2})?$/, "Pre\xE7o inv\xE1lido"),
        imageUrl: z11.string().max(2048).optional(),
        featured: z11.boolean().optional(),
        sortOrder: z11.number().int().optional(),
        storeId: z11.number().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return createProduct({ ...input, storeId, active: true, featured: input.featured ?? false });
    }),
    update: staffProcedure.input(
      z11.object({
        id: z11.number(),
        categoryId: z11.number().optional(),
        name: z11.string().min(1).max(200).optional(),
        description: z11.string().max(2e3).optional(),
        price: z11.string().regex(/^\d+(\.\d{1,2})?$/, "Pre\xE7o inv\xE1lido").optional(),
        imageUrl: z11.string().max(2048).optional(),
        featured: z11.boolean().optional(),
        active: z11.boolean().optional(),
        sortOrder: z11.number().int().optional(),
        storeId: z11.number().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const product = await getProductById(input.id);
      if (!product) throw new TRPCError12({ code: "NOT_FOUND", message: "Produto nao encontrado." });
      await assertStoreEntityAccess(ctx.user, product.storeId, input.storeId);
      const { id, storeId: _storeId, ...data } = input;
      return updateProduct(id, data);
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const product = await getProductById(input.id);
      if (!product) throw new TRPCError12({ code: "NOT_FOUND", message: "Produto nao encontrado." });
      await assertStoreEntityAccess(ctx.user, product.storeId, input.storeId);
      return deleteProduct(input.id);
    }),
    uploadImage: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      base64: z11.string().max(43e5),
      // keep below Vercel request-size limits
      mimeType: z11.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z11.string().max(255).optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 82, 1200);
      const key = `stores/${storeId}/products/product-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] produto comprimido ${reductionPct}% \u2192 WebP`);
      return { url };
    })
  }),
  // --- COUPONS ----------------------------------------------------------------
  coupons: router({
    validate: publicProcedure.input(z11.object({
      code: z11.string(),
      orderTotal: z11.number(),
      storeId: z11.number().optional(),
      items: z11.array(z11.object({
        productId: z11.number().int().positive(),
        productPrice: z11.union([z11.string(), z11.number()]),
        quantity: z11.number().int().min(1).max(99)
      })).max(50).optional()
    })).mutation(async ({ input, ctx }) => {
      const coupon = await getCouponByCode(input.code, input.storeId);
      if (!coupon && ctx.user && input.storeId) {
        const rewardBenefit2 = await validateRewardCoupon({
          storeId: input.storeId,
          userId: ctx.user.id,
          code: input.code,
          subtotal: input.orderTotal,
          items: input.items
        });
        return {
          valid: true,
          discount: rewardBenefit2.discount,
          coupon: { code: input.code.toUpperCase(), rewardCoupon: true },
          rewardBenefit: rewardBenefit2
        };
      }
      if (!coupon) throw new TRPCError12({ code: "NOT_FOUND", message: "Cupom n\xE3o encontrado" });
      if (!coupon.active) throw new TRPCError12({ code: "BAD_REQUEST", message: "Cupom inativo" });
      if (coupon.expiresAt && /* @__PURE__ */ new Date() > coupon.expiresAt)
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Cupom expirado" });
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Cupom esgotado" });
      const minOrder = parseFloat(coupon.minOrderValue ?? "0");
      if (input.orderTotal < minOrder)
        throw new TRPCError12({
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
    list: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllCoupons(storeId);
    }),
    // Public endpoint: returns only active global coupons (no userId) for display in customer panel
    listActive: protectedProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(
      ({ input }) => getAllCoupons(input?.storeId).then(
        (coupons2) => coupons2.filter((c) => c.active && !c.userId && (!c.expiresAt || /* @__PURE__ */ new Date() < c.expiresAt))
      )
    ),
    listPublic: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(
      ({ input }) => getAllCoupons(input?.storeId).then(
        (coupons2) => coupons2.filter(
          (coupon) => coupon.active && !coupon.userId && (!coupon.expiresAt || /* @__PURE__ */ new Date() < coupon.expiresAt) && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)
        )
      )
    ),
    create: staffProcedure.input(
      z11.object({
        code: z11.string().min(1),
        discountType: z11.enum(["percentage", "fixed"]),
        discountValue: z11.string(),
        minOrderValue: z11.string().optional(),
        maxUses: z11.number().optional(),
        expiresAt: z11.date().optional(),
        storeId: z11.number().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await createCoupon({ ...input, storeId, active: true, usedCount: 0 });
      const discountText = input.discountType === "percentage" ? `${input.discountValue}% de desconto` : `R$ ${parseFloat(input.discountValue).toFixed(2)} de desconto`;
      await createClientAlert({
        type: "coupon",
        title: `\u{1F389} Novo cupom dispon\xEDvel!`,
        message: `Use o cupom **${input.code}** e ganhe ${discountText} no seu pedido.`,
        icon: "\u{1F389}",
        url: "/cardapio",
        storeId,
        expiresAt: input.expiresAt
      });
      return result;
    }),
    update: staffProcedure.input(z11.object({
      id: z11.number(),
      active: z11.boolean().optional(),
      maxUses: z11.number().int().min(0).optional(),
      discountType: z11.enum(["percentage", "fixed"]).optional(),
      discountValue: z11.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inv\xE1lido").optional(),
      minOrderValue: z11.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inv\xE1lido").optional(),
      expiresAt: z11.date().nullable().optional(),
      storeId: z11.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const coupon = await getCouponById(input.id);
      if (!coupon) throw new TRPCError12({ code: "NOT_FOUND", message: "Cupom n\xE3o encontrado." });
      await assertStoreEntityAccess(ctx.user, coupon.storeId, input.storeId);
      const { id, storeId: _storeId, ...data } = input;
      return updateCoupon(id, data);
    }),
    // Public: returns the home popup coupon only if it has been provisioned by an admin.
    // Nenhum side-effect aqui — cupons devem ser criados via seed/admin, não em leitura pública.
    getHomePopupCoupon: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input }) => {
      const POPUP_CODE = "BONATTO10";
      const coupon = await getCouponByCode(POPUP_CODE, input?.storeId);
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
      z11.object({
        storeId: z11.number().int().positive().optional(),
        customerName: z11.string().min(1).max(200),
        customerEmail: z11.string().email().max(320).optional(),
        customerPhone: z11.string().trim().max(30).refine((v) => {
          const digits = v.replace(/\D/g, "");
          return digits.length >= 10 && digits.length <= 15;
        }, { message: "Telefone inv\xE1lido. Informe DDD + n\xFAmero (10 a 15 d\xEDgitos)." }).optional(),
        deliveryAddress: z11.string().min(1).max(500),
        deliveryCity: z11.string().max(100).optional(),
        deliveryCep: z11.string().regex(/^\d{5}-?\d{3}$/, "CEP inv\xE1lido").optional(),
        deliveryNeighborhood: z11.string().max(100).optional(),
        deliveryComplement: z11.string().max(200).optional(),
        paymentMethod: z11.enum(["credit_card", "debit_card", "pix", "cash"]),
        couponCode: z11.string().max(50).optional(),
        pointsToRedeem: z11.number().int().min(0).max(5e3).optional(),
        notes: z11.string().max(1e3).optional(),
        // deliveryFeeOverride foi removido: taxa sempre calculada server-side a partir
        // do CEP/bairro para evitar manipulação do valor pelo cliente.
        items: z11.array(
          z11.object({
            productId: z11.number().int().positive(),
            productName: z11.string().max(200),
            productPrice: z11.string().regex(/^\d+(\.\d{1,2})?$/, "Pre\xE7o inv\xE1lido"),
            quantity: z11.number().int().min(1).max(99),
            notes: z11.string().max(500).optional(),
            configuration: catalogOrderConfigurationSchema.optional()
          })
        ).min(1, "O pedido precisa ter pelo menos 1 item.").max(50, "Pedido excede o n\xFAmero m\xE1ximo de itens.")
      })
    ).mutation(async ({ input, ctx }) => {
      const tenantStore = input.storeId ? await getWhiteLabelRuntimeByStoreId(input.storeId) : null;
      if (input.storeId) {
        if (!tenantStore || tenantStore.status !== "active") {
          throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "Esta loja n\xE3o est\xE1 dispon\xEDvel para pedidos." });
        }
      }
      const clubFeatureEnabled = tenantStore?.features.club ?? true;
      const loyaltyFeatureEnabled = tenantStore?.features.loyalty ?? true;
      if ((input.pointsToRedeem ?? 0) > 0 && !loyaltyFeatureEnabled) {
        throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "O programa de fidelidade nao esta disponivel nesta loja." });
      }
      const dbSettings = await getAllStoreSettings(input.storeId);
      await assertPaymentMethodEnabled(input.paymentMethod, input.storeId);
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
        throw new TRPCError12({
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
          throw new TRPCError12({
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
        if (!product || !product.active || input.storeId !== void 0 && product.storeId !== input.storeId) {
          throw new TRPCError12({ code: "BAD_REQUEST", message: `Produto "${item.productName}" n\xE3o encontrado ou indispon\xEDvel.` });
        }
        if (product.pricingEngine === "configured_v2" || item.configuration) {
          const configuredProduct = await getConfiguredCatalogProduct({ storeId: product.storeId, productId: product.id });
          const selection = {
            ...item.configuration,
            quantity: item.quantity,
            channel: input.deliveryCep ? "delivery" : "pickup"
          };
          const pricing = calculateConfiguredProductPrice(configuredProduct, selection);
          if (pricing.validationErrors.length > 0) {
            throw new TRPCError12({
              code: "BAD_REQUEST",
              message: `${product.name}: ${pricing.validationErrors.join(" ")}`
            });
          }
          const snapshot = createOrderItemConfigurationSnapshot(configuredProduct, selection, pricing);
          resolvedItems.push({
            productId: item.productId,
            productName: product.name,
            productPrice: pricing.unitTotal.toFixed(2),
            quantity: item.quantity,
            notes: item.notes ?? null,
            snapshotVersion: 2,
            configurationSnapshot: JSON.stringify(snapshot),
            pricingBreakdown: JSON.stringify(pricing.breakdown)
          });
        } else {
          resolvedItems.push({
            productId: item.productId,
            productName: product.name,
            productPrice: product.price,
            quantity: item.quantity,
            notes: item.notes ?? null,
            snapshotVersion: 1,
            configurationSnapshot: null,
            pricingBreakdown: null
          });
        }
      }
      const subtotal = resolvedItems.reduce(
        (sum, item) => sum + parseFloat(item.productPrice) * item.quantity,
        0
      );
      let discountAmount = 0;
      let couponToApply;
      let rewardCouponBenefit = null;
      if (input.couponCode) {
        if (input.storeId) {
          try {
            rewardCouponBenefit = await validateRewardCoupon({
              storeId: input.storeId,
              userId: ctx.user.id,
              code: input.couponCode,
              subtotal,
              items: resolvedItems
            });
          } catch (error) {
            if (!(error instanceof TRPCError12) || error.code !== "NOT_FOUND") throw error;
          }
        }
        if (rewardCouponBenefit) {
          discountAmount = rewardCouponBenefit.discount;
        } else {
          couponToApply = await getCouponByCode(input.couponCode, input.storeId);
          if (!couponToApply) {
            throw new TRPCError12({ code: "BAD_REQUEST", message: "Cupom inv\xE1lido ou expirado." });
          }
          if (!couponToApply.active) {
            throw new TRPCError12({ code: "BAD_REQUEST", message: "Cupom inativo." });
          }
          if (couponToApply.expiresAt && /* @__PURE__ */ new Date() > couponToApply.expiresAt) {
            throw new TRPCError12({ code: "BAD_REQUEST", message: "Cupom expirado." });
          }
          if (couponToApply.userId != null && couponToApply.userId !== ctx.user.id) {
            throw new TRPCError12({ code: "FORBIDDEN", message: "Este cupom \xE9 exclusivo de outro usu\xE1rio." });
          }
          const minOrder = parseFloat(couponToApply.minOrderValue ?? "0");
          if (subtotal < minOrder) {
            throw new TRPCError12({
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
      }
      const db = await getDb();
      if (!db) {
        throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      }
      let clubDiscountAmount = 0;
      let clubFreeDelivery = false;
      let clubFreePizzaDiscount = 0;
      let reservedFreePizza = false;
      const userForClub = clubFeatureEnabled ? await getTenantCustomerAccount(ctx.user.id, input.storeId) : null;
      const mirrorLegacyFreePizza = async (used, resetAt) => {
        if (tenantStore?.tenantKey !== "bonatto") return;
        await db.update(users).set({
          clubFreePizzaUsed: used,
          ...resetAt !== void 0 ? { clubFreePizzaResetAt: resetAt } : {}
        }).where(eq19(users.id, ctx.user.id));
      };
      const reserveFreePizzaBenefit = async () => {
        if (!userForClub) return false;
        const result = await db.update(tenantCustomerAccounts).set({ clubFreePizzaUsed: true }).where(and16(
          eq19(tenantCustomerAccounts.id, userForClub.id),
          eq19(tenantCustomerAccounts.clubStatus, "active"),
          eq19(tenantCustomerAccounts.clubFreePizzaUsed, false)
        ));
        const mutationResult = result;
        const affectedRows = mutationResult?.rowsAffected ?? mutationResult?.[0]?.affectedRows ?? 0;
        reservedFreePizza = affectedRows > 0;
        if (reservedFreePizza) await mirrorLegacyFreePizza(true);
        return reservedFreePizza;
      };
      const releaseFreePizzaBenefit = async () => {
        if (!reservedFreePizza) return;
        reservedFreePizza = false;
        if (userForClub) {
          await db.update(tenantCustomerAccounts).set({ clubFreePizzaUsed: false }).where(eq19(tenantCustomerAccounts.id, userForClub.id));
        }
        await mirrorLegacyFreePizza(false);
      };
      if (userForClub && userForClub.clubStatus === "active" && userForClub.clubPlan) {
        const planConfig = await getClubPlanConfig(userForClub.clubPlan, input.storeId);
        if (planConfig) {
          clubFreeDelivery = planConfig.freeDelivery;
          let freePizzaAlreadyUsed = Boolean(userForClub.clubFreePizzaUsed);
          const now2 = /* @__PURE__ */ new Date();
          if (freePizzaAlreadyUsed && userForClub.clubFreePizzaResetAt && now2 > userForClub.clubFreePizzaResetAt) {
            const nextReset = new Date(now2.getFullYear(), now2.getMonth() + 1, 1);
            await db.update(tenantCustomerAccounts).set({ clubFreePizzaUsed: false, clubFreePizzaResetAt: nextReset }).where(and16(eq19(tenantCustomerAccounts.id, userForClub.id), lte3(tenantCustomerAccounts.clubFreePizzaResetAt, now2)));
            await mirrorLegacyFreePizza(false, nextReset);
            freePizzaAlreadyUsed = false;
          }
          if (planConfig.freePizzaPerMonth && !freePizzaAlreadyUsed) {
            const pizzaCategoryIds = getPizzaCategoryIds(await getCategories({ storeId: input.storeId }));
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
          const zone = await getDeliveryZoneByNeighborhood(input.deliveryNeighborhood, input.storeId);
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
      const deliveryFee = clubFreeDelivery || rewardCouponBenefit?.freeDelivery ? 0 : rawDeliveryFee;
      if (input.pointsToRedeem && input.pointsToRedeem >= 50) {
        const userBalance = await getUserLoyaltyPoints(ctx.user.id, input.storeId);
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
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: `Valor m\xEDnimo do pedido \xE9 R$ ${minOrderValue.toFixed(2).replace(".", ",")}. Adicione mais itens ao carrinho.`
        });
      }
      const total = totalBeforeCheck;
      const routedStore = input.storeId ? { storeId: input.storeId, reason: "tenant_domain" } : await pickStoreForDeliveryAddress({
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
        snapshotVersion: item.snapshotVersion,
        configurationSnapshot: item.configurationSnapshot,
        pricingBreakdown: item.pricingBreakdown,
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
            `-${pointsUsed} pontos resgatados no pedido #${orderId}`,
            routedStore.storeId
          );
        } catch (debitErr) {
          try {
            await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            await releaseFreePizzaBenefit();
          } catch (cancelErr) {
            console.error("[orders.create] failed to cancel order after debit error:", cancelErr);
          }
          console.error("[orders.create] debit points failed unexpectedly:", debitErr);
          throw new TRPCError12({
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
          throw new TRPCError12({
            code: "BAD_REQUEST",
            message: `Saldo de pontos insuficiente. Saldo atual: ${debit.newBalance}.`
          });
        }
      }
      if (rewardCouponBenefit && input.couponCode && input.storeId) {
        try {
          await consumeRewardCoupon({
            storeId: input.storeId,
            userId: ctx.user.id,
            code: input.couponCode,
            orderId
          });
        } catch (rewardCouponError) {
          try {
            await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            if (pointsUsed > 0) {
              await addLoyaltyPoints(ctx.user.id, pointsUsed, orderId, `Estorno por falha ao aplicar recompensa no pedido #${orderId}`, routedStore.storeId);
            }
            await releaseFreePizzaBenefit();
          } catch (cleanupError) {
            console.error("[orders.create] cleanup after reward coupon race failed:", cleanupError);
          }
          throw rewardCouponError;
        }
      }
      if (couponToApply) {
        const accepted = await incrementCouponUsage(couponToApply.id);
        if (!accepted) {
          try {
            await updateOrderStatusGuarded(orderId, "cancelled", ["pending"]);
            if (pointsUsed > 0) {
              await addLoyaltyPoints(ctx.user.id, pointsUsed, orderId, `Estorno por falha ao aplicar cupom no pedido #${orderId}`, routedStore.storeId);
            }
            await releaseFreePizzaBenefit();
          } catch (cleanupErr) {
            console.error("[orders.create] cleanup after coupon race failed:", cleanupErr);
          }
          throw new TRPCError12({ code: "BAD_REQUEST", message: "Este cupom atingiu o limite de usos." });
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
    myOrders: protectedProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input, ctx }) => getOrdersByUser(ctx.user.id, input?.storeId)),
    byId: protectedProcedure.input(z11.object({ id: z11.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        if (ctx.user.role !== "manager" || order.storeId == null) {
          throw new TRPCError12({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        await assertStoreEntityAccess(ctx.user, order.storeId);
      }
      const items = await getOrderItems(input.id);
      return { ...order, items };
    }),
    // Admin
    list: staffProcedure.input(
      z11.object({
        status: z11.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).optional(),
        limit: z11.number().int().min(1).max(5e4).optional(),
        offset: z11.number().int().min(0).optional(),
        storeId: z11.number().optional(),
        startDate: z11.date().optional(),
        endDate: z11.date().optional()
      }).optional()
    ).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllOrders({ ...input, storeId });
    }),
    alertFeed: staffProcedure.input(
      z11.object({
        limit: z11.number().int().min(1).max(50).optional(),
        storeId: z11.number().optional()
      }).optional()
    ).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getOrderAlertFeed(storeId, input?.limit ?? 20);
    }),
    updateStatus: staffProcedure.input(
      z11.object({
        id: z11.number(),
        status: z11.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"])
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
        throw new TRPCError12({ code: "BAD_REQUEST", message: `Transi\xE7\xE3o inv\xE1lida para ${input.status}.` });
      }
      const currentOrder = await getOrderById(input.id);
      if (!currentOrder) {
        throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado." });
      }
      await assertStoreEntityAccess(ctx.user, currentOrder.storeId);
      if (input.status === "preparing" && currentOrder.paymentMethod === "pix" && currentOrder.paymentStatus !== "paid") {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: "Marque o PIX como recebido antes de preparar este pedido."
        });
      }
      const guard = await updateOrderStatusGuarded(input.id, input.status, allowedFrom);
      if (!guard.ok) {
        throw new TRPCError12({
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
            if (order.storeId) {
              try {
                await markConversions(order.userId, input.id, order.storeId);
              } catch (e) {
                console.error("markConversions error:", e);
              }
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
                const orderTenant = order.storeId ? await getWhiteLabelRuntimeByStoreId(order.storeId) : null;
                if (orderTenant && !orderTenant.features.loyalty) return;
                const credited = await creditLoyaltyForOrderIdempotent(
                  input.id,
                  order.userId,
                  pointsToAdd,
                  `+${pointsToAdd} pontos pelo pedido #${input.id}`,
                  order.storeId
                );
                if (credited) {
                  await sendPushToUser(order.userId, {
                    storeId: order.storeId,
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
              const tpl = await pickRandomTemplate(eventName, "push", order.storeId ?? void 0);
              const payload = tpl ? { title: interpolate(tpl.title), body: interpolate(tpl.body) } : pushFallbacks[input.status];
              if (payload) {
                await sendPushToUser(order.userId, { storeId: order.storeId, ...payload, url: "/minha-conta", tag: `order-status-${input.id}` });
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
              const tpl = await pickRandomTemplate(eventName, "whatsapp", order.storeId ?? void 0);
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
            fireJourneyTrigger(journeyTrigger, order.userId, order.customerPhone ?? void 0, order.storeId ?? void 0).catch(() => {
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
                  fireJourneyTrigger("first_order_month", order.userId, order.customerPhone ?? void 0, order.storeId ?? void 0).catch(() => {
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
      z11.object({
        id: z11.number(),
        paymentStatus: z11.enum(["pending", "paid", "failed", "refunded"]),
        stripePaymentIntentId: z11.string().optional()
      })
    ).mutation(async ({ input, ctx }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido nao encontrado." });
      await assertStoreEntityAccess(ctx.user, order.storeId);
      return updateOrderPaymentStatus(input.id, input.paymentStatus, input.stripePaymentIntentId);
    }),
    confirmPixReceived: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input, ctx }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado." });
      await assertStoreEntityAccess(ctx.user, order.storeId);
      if (order.paymentMethod !== "pix") {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Este pedido n\xE3o foi feito com PIX." });
      }
      if (order.paymentStatus !== "paid") {
        await updateOrderPaymentStatus(input.id, "paid");
      }
      return { ok: true };
    })
  }),
  // --- MARKETPLACES ----------------------------------------------------------
  marketplaces: router({
    overview: adminProcedure2.query(async () => {
      return getMarketplaceOverview();
    }),
    saveConfig: adminProcedure2.input(
      z11.object({
        providerId: marketplaceProviderIdSchema,
        config: marketplaceConfigSchema.partial()
      })
    ).mutation(async ({ input }) => saveMarketplaceConfig(input.providerId, input.config)),
    testConnection: adminProcedure2.input(z11.object({ providerId: marketplaceProviderIdSchema })).mutation(async ({ input }) => {
      return testMarketplaceConnection(input.providerId);
    }),
    syncCatalog: adminProcedure2.input(z11.object({ providerId: marketplaceProviderIdSchema, merchantId: z11.string().optional() })).mutation(async ({ input }) => {
      return runMarketplaceCatalogSync(input.providerId, input.merchantId);
    }),
    syncPromotions: adminProcedure2.input(
      z11.object({
        providerId: marketplaceProviderIdSchema,
        merchantId: z11.string().optional(),
        aggregationIds: z11.array(z11.string().min(1)).optional()
      })
    ).mutation(async ({ input }) => {
      return runMarketplacePromotionsSync(input.providerId, {
        merchantId: input.merchantId,
        aggregationIds: input.aggregationIds
      });
    }),
    pullOrders: adminProcedure2.input(z11.object({ providerId: marketplaceProviderIdSchema })).mutation(async ({ input }) => {
      return pullMarketplaceOrders(input.providerId);
    })
  }),
  // --- INTEGRATIONS ----------------------------------------------------------
  integrations: router({
    ifood: router({
      status: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().getStatus(restaurantId);
      }),
      connect: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().connect(restaurantId);
      }),
      disconnect: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().disconnect(restaurantId);
      }),
      orders: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().getOrders(restaurantId);
      }),
      generateTestOrder: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().generateTestOrder(restaurantId);
      }),
      logs: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input?.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return listIfoodIntegrationLogs(restaurantId);
      }),
      confirmOrder: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().confirmOrder(input.id, restaurantId);
      }),
      startPreparation: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().startPreparation(input.id, restaurantId);
      }),
      dispatch: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().dispatchOrder(input.id, restaurantId);
      }),
      conclude: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().concludeOrder(input.id, restaurantId);
      }),
      cancel: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
        const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
        const restaurantId = await resolveIntegrationRestaurantId(scopedStoreId2);
        return getIfoodProvider().cancelOrder(input.id, restaurantId);
      })
    })
  }),
  // --- IFOOD ------------------------------------------------------------------
  ifood: router({
    merchants: adminProcedure2.query(async () => {
      return listIfoodMerchants();
    }),
    syncCatalog: adminProcedure2.input(z11.object({ merchantId: z11.string().optional() }).optional()).mutation(async ({ input }) => {
      return syncIfoodCatalog(input?.merchantId);
    }),
    syncPromotions: adminProcedure2.input(
      z11.object({
        merchantId: z11.string().optional(),
        aggregationIds: z11.array(z11.string().min(1)).optional()
      }).optional()
    ).mutation(async ({ input }) => {
      return syncIfoodPromotions({
        merchantId: input?.merchantId,
        aggregationIds: input?.aggregationIds
      });
    }),
    confirmOrder: adminProcedure2.input(z11.object({ ifoodOrderId: z11.string() })).mutation(async ({ input }) => {
      await confirmIfoodOrder(input.ifoodOrderId);
      return { success: true };
    }),
    startPreparation: adminProcedure2.input(z11.object({ ifoodOrderId: z11.string() })).mutation(async ({ input }) => {
      await startPreparationIfoodOrder(input.ifoodOrderId);
      return { success: true };
    }),
    dispatch: adminProcedure2.input(z11.object({ ifoodOrderId: z11.string() })).mutation(async ({ input }) => {
      await dispatchIfoodOrder(input.ifoodOrderId);
      return { success: true };
    }),
    cancelOrder: adminProcedure2.input(z11.object({ ifoodOrderId: z11.string(), reason: z11.string().default("Pedido cancelado pelo restaurante") })).mutation(async ({ input }) => {
      await cancelIfoodOrder(input.ifoodOrderId, input.reason);
      return { success: true };
    })
  }),
  // --- NFC-e (Focus NFe) -------------------------------------------------------
  nfce: router({
    emitir: adminProcedure2.input(z11.object({ orderId: z11.number() })).mutation(async ({ input }) => {
      const result = await emitirNfce(input.orderId);
      if (!result.success) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao emitir NFC-e" });
      return result;
    }),
    cancelar: adminProcedure2.input(z11.object({ orderId: z11.number(), justificativa: z11.string().min(15) })).mutation(async ({ input }) => {
      const result = await cancelarNfce(input.orderId, input.justificativa);
      if (!result.success) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Erro ao cancelar NFC-e" });
      return result;
    })
  }),
  // --- PAYMENTS ---------------------------------------------------------------
  payments: router({
    createIntent: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN", message: "Acesso negado" });
      await assertPaymentMethodEnabled("credit_card", order.storeId ?? void 0);
      const amountInReais = parseFloat(order.total ?? "0");
      if (amountInReais <= 0) throw new TRPCError12({ code: "BAD_REQUEST", message: "Valor do pedido inv\xE1lido" });
      const paymentIntent = await createPaymentIntent(amountInReais, "brl", {
        orderId: String(input.orderId)
      });
      return { clientSecret: paymentIntent.client_secret };
    }),
    createCheckoutSession: protectedProcedure.input(z11.object({
      orderId: z11.number(),
      origin: z11.string().url()
    })).mutation(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN", message: "Acesso negado" });
      await assertPaymentMethodEnabled("credit_card", order.storeId ?? void 0);
      const amountInReais = parseFloat(order.total ?? "0");
      if (amountInReais < 0.5) throw new TRPCError12({ code: "BAD_REQUEST", message: "Valor m\xEDnimo para pagamento online \xE9 R$ 0,50" });
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
    createSetupIntent: protectedProcedure.input(z11.object({ origin: z11.string().url() })).mutation(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError12({ code: "NOT_FOUND" });
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
    deleteCard: protectedProcedure.input(z11.object({ paymentMethodId: z11.string() })).mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.stripeCustomerId) throw new TRPCError12({ code: "BAD_REQUEST", message: "Nenhum cart\xE3o salvo" });
      const cards = await listSavedCards(user.stripeCustomerId);
      const card = cards.find((c) => c.id === input.paymentMethodId);
      if (!card) throw new TRPCError12({ code: "NOT_FOUND", message: "Cart\xE3o n\xE3o encontrado" });
      await detachPaymentMethod(input.paymentMethodId);
      return { success: true };
    }),
    checkoutWithSavedCard: protectedProcedure.input(z11.object({
      orderId: z11.number(),
      paymentMethodId: z11.string(),
      origin: z11.string().url()
    })).mutation(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido nao encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
      const paymentSettings = await assertPaymentMethodEnabled("credit_card", order.storeId ?? void 0);
      if (!paymentSettings.config.orders.savedCardsEnabled) {
        throw new TRPCError12({
          code: "PRECONDITION_FAILED",
          message: "O uso de cart\xF5es salvos est\xE1 desativado no momento."
        });
      }
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError12({ code: "NOT_FOUND" });
      const stripeCustomerId = await getOrCreateStripeCustomer({
        userId: ctx.user.id,
        stripeCustomerId: user.stripeCustomerId,
        email: user.email,
        name: user.name
      });
      const amountInReais = parseFloat(order.total ?? "0");
      if (amountInReais < 0.5) throw new TRPCError12({ code: "BAD_REQUEST", message: "Valor m\xEDnimo \xE9 R$ 0,50" });
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
    createManualPixCode: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ input, ctx }) => {
      const paymentOrder = await getOrderById(input.orderId);
      if (!paymentOrder) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido nao encontrado" });
      if (paymentOrder.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
      const paymentSettings = await assertPaymentMethodEnabled("pix", paymentOrder.storeId ?? void 0);
      if (paymentSettings.config.orders.pixMode !== "manual_key") {
        throw new TRPCError12({
          code: "PRECONDITION_FAILED",
          message: "O PIX manual n\xE3o est\xE1 ativo para pedidos."
        });
      }
      const adminPaymentSettings = await getPaymentSettingsAdmin(paymentOrder.storeId ?? void 0);
      const pixKey = adminPaymentSettings.pixKey.trim();
      if (!pixKey) {
        throw new TRPCError12({
          code: "PRECONDITION_FAILED",
          message: "Configure a chave PIX na aba de pagamentos do admin."
        });
      }
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
      const amount = parseFloat(order.total ?? "0");
      if (amount <= 0) throw new TRPCError12({ code: "BAD_REQUEST", message: "Valor do pedido inv\xE1lido" });
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
    createPix: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ input, ctx }) => {
      const paymentOrder = await getOrderById(input.orderId);
      if (!paymentOrder) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido nao encontrado" });
      if (paymentOrder.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
      const paymentSettings = await assertPaymentMethodEnabled("pix", paymentOrder.storeId ?? void 0);
      if (paymentSettings.config.orders.pixMode !== "dynamic_asaas") {
        throw new TRPCError12({
          code: "PRECONDITION_FAILED",
          message: "O PIX autom\xE1tico via Asaas n\xE3o est\xE1 ativo para pedidos."
        });
      }
      if (!process.env.ASAAS_API_KEY) {
        throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "Integra\xE7\xE3o Asaas n\xE3o configurada. Configure ASAAS_API_KEY nas vari\xE1veis de ambiente." });
      }
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
      if (order.paymentStatus === "paid") throw new TRPCError12({ code: "BAD_REQUEST", message: "Pedido j\xE1 pago" });
      if (order.asaasPaymentId) {
        const status = await getChargeStatus(order.asaasPaymentId);
        if (status === "RECEIVED" || status === "CONFIRMED") {
          await updateOrderPaymentStatus(input.orderId, "paid", void 0, void 0, order.asaasPaymentId);
          return { alreadyPaid: true, status, chargeId: order.asaasPaymentId, qrCodeImage: "", pixCopiaECola: "", expirationDate: "", value: 0 };
        }
      }
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError12({ code: "NOT_FOUND" });
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
    checkPixStatus: protectedProcedure.input(z11.object({ orderId: z11.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
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
    update: protectedProcedure.input(z11.object({
      name: z11.string().optional(),
      phone: z11.string().optional(),
      savedAddress: z11.string().optional(),
      savedCep: z11.string().optional(),
      savedCity: z11.string().optional()
    })).mutation(({ input, ctx }) => updateUserProfile(ctx.user.id, input)),
    myCoupons: protectedProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input, ctx }) => getCouponsByUser(ctx.user.id, input?.storeId))
  }),
  // --- UP-SELLS ---------------------------------------------------------------
  upsells: router({
    forCart: publicProcedure.input(z11.object({ productIds: z11.array(z11.number()), cartTotal: z11.number(), storeId: z11.number().optional() })).query(({ input }) => getUpsellsForCart(input.productIds, input.cartTotal, input.storeId)),
    all: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => getAllUpsells(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      suggestedProductId: z11.number(),
      triggerProductId: z11.number().optional(),
      triggerMinTotal: z11.string().optional(),
      type: z11.enum(["upsell", "downsell"]).default("upsell"),
      title: z11.string().min(1),
      description: z11.string().optional(),
      discountPercent: z11.number().default(0),
      active: z11.boolean().default(true),
      sortOrder: z11.number().default(0)
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return createUpsell({ ...input, storeId });
    }),
    update: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional(), data: z11.object({
      title: z11.string().optional(),
      description: z11.string().optional(),
      discountPercent: z11.number().optional(),
      active: z11.boolean().optional(),
      sortOrder: z11.number().optional()
    }) })).mutation(async ({ input, ctx }) => updateUpsell(input.id, await resolveRequiredStoreId(ctx.user, input.storeId), input.data)),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => deleteUpsell(input.id, await resolveRequiredStoreId(ctx.user, input.storeId)))
  }),
  // --- PROMOTIONS ---------------------------------------------------------------
  promotions: router({
    // Only logged-in customers can see promotions that requiresLogin=true
    active: protectedProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getActivePromotions(input?.storeId)),
    // Public promotions (requiresLogin=false) visible to everyone
    publicActive: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getActivePromotions(input?.storeId).then((promos) => promos.filter((p) => !p.requiresLogin))),
    // A promotion can be public while its coupon remains protected by login.
    homeActive: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getActivePromotions(input?.storeId).then((promos) => promos.map((promotion) => ({
      ...promotion,
      couponCode: promotion.requiresLogin ? null : promotion.couponCode
    })))),
    all: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => getAllPromotions(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      title: z11.string().min(1),
      description: z11.string().optional(),
      imageUrl: z11.string().optional(),
      couponCode: z11.string().optional(),
      active: z11.boolean().default(true),
      requiresLogin: z11.boolean().default(true),
      startsAt: z11.date().optional(),
      endsAt: z11.date().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await createPromotion({ ...input, storeId });
      await createClientAlert({
        type: "promotion",
        title: `\u{1F37D}\uFE0F Nova promo\xE7\xE3o: ${input.title}`,
        message: input.description ?? "Confira a nova promo\xE7\xE3o dispon\xEDvel no card\xE1pio!",
        icon: "\u{1F37D}\uFE0F",
        url: "/minha-conta",
        storeId,
        expiresAt: input.endsAt
      });
      return result;
    }),
    update: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional(), data: z11.object({
      title: z11.string().optional(),
      description: z11.string().optional(),
      imageUrl: z11.string().optional(),
      couponCode: z11.string().optional(),
      active: z11.boolean().optional(),
      requiresLogin: z11.boolean().optional(),
      endsAt: z11.date().optional()
    }) })).mutation(async ({ input, ctx }) => updatePromotion(input.id, await resolveRequiredStoreId(ctx.user, input.storeId), input.data)),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => deletePromotion(input.id, await resolveRequiredStoreId(ctx.user, input.storeId)))
  }),
  // --- RAFFLES ---------------------------------------------------------------
  raffles: router({
    active: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getActiveRaffles(input?.storeId)),
    all: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => getAllRaffles(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    entries: staffProcedure.input(z11.object({ raffleId: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => getRaffleEntries(input.raffleId, await resolveRequiredStoreId(ctx.user, input.storeId))),
    enter: protectedProcedure.input(z11.object({ raffleId: z11.number(), storeId: z11.number().optional() })).mutation(({ input, ctx }) => enterRaffle(input.raffleId, ctx.user.id, ctx.user.name ?? "Cliente", input.storeId)),
    draw: staffProcedure.input(z11.object({ raffleId: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => drawRaffleWinner(input.raffleId, await resolveRequiredStoreId(ctx.user, input.storeId))),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      title: z11.string().min(1),
      description: z11.string().optional(),
      prize: z11.string().min(1),
      imageUrl: z11.string().optional(),
      endsAt: z11.date().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const result = await createRaffle({ ...input, storeId, status: "active" });
      await createClientAlert({
        type: "raffle",
        title: `\u{1F31F} Novo sorteio: ${input.title}`,
        message: `Pr\xEAmio: ${input.prize}. ${input.description ?? "Participe agora e concorra!"}`,
        icon: "\u{1F31F}",
        url: "/minha-conta",
        storeId,
        expiresAt: input.endsAt
      });
      return result;
    }),
    update: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional(), data: z11.object({
      title: z11.string().optional(),
      description: z11.string().optional(),
      prize: z11.string().optional(),
      status: z11.enum(["active", "closed", "drawn"]).optional(),
      endsAt: z11.date().optional()
    }) })).mutation(async ({ input, ctx }) => updateRaffle(input.id, await resolveRequiredStoreId(ctx.user, input.storeId), input.data))
  }),
  inventory: router({
    list: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      activeOnly: z11.boolean().optional(),
      lowStockOnly: z11.boolean().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getIngredients({ storeId, activeOnly: input?.activeOnly ?? true, lowStockOnly: input?.lowStockOnly ?? false });
    }),
    lowStock: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getIngredients({ storeId, activeOnly: true, lowStockOnly: true });
    }),
    movements: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      ingredientId: z11.number().optional(),
      orderId: z11.number().optional(),
      limit: z11.number().min(1).max(500).optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getInventoryMovements({
        storeId,
        ingredientId: input?.ingredientId,
        orderId: input?.orderId,
        limit: input?.limit
      });
    }),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      name: z11.string().min(1).max(160),
      category: z11.string().max(120).optional(),
      unit: z11.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]),
      currentStock: z11.string().regex(/^-?\d+(\.\d{1,3})?$/),
      minimumStock: z11.string().regex(/^-?\d+(\.\d{1,3})?$/),
      unitCost: z11.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
      supplier: z11.string().max(160).optional(),
      notes: z11.string().max(5e3).optional(),
      active: z11.boolean().optional()
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
    update: staffProcedure.input(z11.object({
      id: z11.number(),
      name: z11.string().min(1).max(160).optional(),
      category: z11.string().max(120).optional(),
      unit: z11.enum(["g", "kg", "ml", "l", "unit", "pack", "slice", "portion"]).optional(),
      currentStock: z11.string().regex(/^-?\d+(\.\d{1,3})?$/).optional(),
      minimumStock: z11.string().regex(/^-?\d+(\.\d{1,3})?$/).optional(),
      unitCost: z11.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
      supplier: z11.string().max(160).optional(),
      notes: z11.string().max(5e3).optional(),
      active: z11.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateIngredient(id, data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input }) => {
      await deleteIngredient(input.id);
      return { ok: true };
    }),
    adjust: staffProcedure.input(z11.object({
      ingredientId: z11.number(),
      quantityDelta: z11.string().regex(/^-?\d+(\.\d{1,3})?$/),
      movementType: z11.enum(["entry", "manual_adjustment", "waste", "reversal"]),
      reason: z11.string().max(255).optional()
    })).mutation(async ({ input, ctx }) => {
      return adjustIngredientStock({
        ingredientId: input.ingredientId,
        quantityDelta: input.quantityDelta,
        movementType: input.movementType,
        reason: input.reason ?? null,
        performedByUserId: ctx.user.id
      });
    }),
    recipe: staffProcedure.input(z11.object({ productId: z11.number() })).query(({ input }) => getProductRecipe(input.productId)),
    setRecipe: staffProcedure.input(z11.object({
      productId: z11.number(),
      items: z11.array(z11.object({
        ingredientId: z11.number(),
        quantity: z11.string().regex(/^\d+(\.\d{1,3})?$/),
        wastePercent: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional()
      }))
    })).mutation(({ input }) => setProductRecipe(input.productId, input.items)),
    syncOrderConsumption: staffProcedure.input(z11.object({ orderId: z11.number(), mode: z11.enum(["consume", "reverse"]) })).mutation(async ({ input }) => {
      return input.mode === "consume" ? consumeInventoryForOrder(input.orderId) : reverseInventoryForOrder(input.orderId);
    })
  }),
  staffMembers: router({
    list: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      role: z11.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).optional(),
      activeOnly: z11.boolean().optional()
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
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      userId: z11.number().optional(),
      name: z11.string().min(2).max(200),
      phone: z11.string().optional(),
      email: z11.string().email().optional(),
      role: z11.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]),
      active: z11.boolean().optional()
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
    update: staffProcedure.input(z11.object({
      id: z11.number(),
      name: z11.string().min(2).max(200).optional(),
      phone: z11.string().optional(),
      email: z11.string().email().optional(),
      role: z11.enum(["waiter", "cashier", "attendant", "kitchen", "driver", "manager", "admin"]).optional(),
      active: z11.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const member = await getStaffMemberById(id);
      if (!member) throw new TRPCError12({ code: "NOT_FOUND", message: "Membro nao encontrado." });
      await assertStoreEntityAccess(ctx.user, member.storeId);
      await updateStaffMember(id, data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input, ctx }) => {
      const member = await getStaffMemberById(input.id);
      if (!member) throw new TRPCError12({ code: "NOT_FOUND", message: "Membro nao encontrado." });
      await assertStoreEntityAccess(ctx.user, member.storeId);
      await deleteStaffMember(input.id);
      return { ok: true };
    }),
    regenerateAccessToken: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input, ctx }) => {
      const member = await getStaffMemberById(input.id);
      if (!member) throw new TRPCError12({ code: "NOT_FOUND", message: "Membro nao encontrado." });
      await assertStoreEntityAccess(ctx.user, member.storeId);
      const accessToken = await regenerateStaffAccessToken(input.id);
      return { accessToken };
    })
  }),
  diningRoom: router({
    tables: staffProcedure.input(z11.object({ storeId: z11.number().optional(), activeOnly: z11.boolean().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getDiningTables({ storeId, activeOnly: input?.activeOnly ?? true });
    }),
    createTable: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      name: z11.string().min(1).max(80),
      capacity: z11.number().int().min(1).max(50).optional(),
      active: z11.boolean().optional()
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
    updateTable: staffProcedure.input(z11.object({
      id: z11.number(),
      name: z11.string().min(1).max(80).optional(),
      status: z11.enum(["free", "occupied", "reserved", "awaiting_closure"]).optional(),
      capacity: z11.number().int().min(1).max(50).optional(),
      active: z11.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const table = await getDiningTableById(id);
      if (!table) throw new TRPCError12({ code: "NOT_FOUND", message: "Mesa nao encontrada." });
      await assertStoreEntityAccess(ctx.user, table.storeId);
      await updateDiningTable(id, data);
      return { ok: true };
    }),
    deleteTable: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input, ctx }) => {
      const table = await getDiningTableById(input.id);
      if (!table) throw new TRPCError12({ code: "NOT_FOUND", message: "Mesa nao encontrada." });
      await assertStoreEntityAccess(ctx.user, table.storeId);
      await deleteDiningTable(input.id);
      return { ok: true };
    }),
    sessions: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      status: z11.enum(["open", "awaiting_closure", "closed", "cancelled"]).optional(),
      waiterStaffId: z11.number().optional()
    }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getTableSessions({ storeId, status: input?.status, waiterStaffId: input?.waiterStaffId });
    }),
    openSession: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      tableId: z11.number(),
      waiterStaffId: z11.number().optional(),
      customerName: z11.string().max(200).optional(),
      guestCount: z11.number().int().min(1).max(50).optional(),
      notes: z11.string().max(5e3).optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const table = await getDiningTableById(input.tableId);
      if (!table) throw new TRPCError12({ code: "NOT_FOUND", message: "Mesa nao encontrada." });
      await assertStoreEntityAccess(ctx.user, table.storeId, storeId);
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
    updateSession: staffProcedure.input(z11.object({
      id: z11.number(),
      waiterStaffId: z11.number().optional(),
      customerName: z11.string().max(200).optional(),
      guestCount: z11.number().int().min(1).max(50).optional(),
      notes: z11.string().max(5e3).optional(),
      status: z11.enum(["open", "awaiting_closure", "closed", "cancelled"]).optional(),
      subtotal: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      discountAmount: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      total: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const session = await getTableSessionById(id);
      if (!session) throw new TRPCError12({ code: "NOT_FOUND", message: "Comanda nao encontrada." });
      await assertStoreEntityAccess(ctx.user, session.storeId);
      await updateTableSession(id, data);
      return { ok: true };
    }),
    closeSession: staffProcedure.input(z11.object({
      id: z11.number(),
      subtotal: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      discountAmount: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      tipAmount: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      total: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      status: z11.enum(["awaiting_closure", "closed", "cancelled"]).optional(),
      closedByStaffId: z11.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const session = await getTableSessionById(input.id);
      if (!session) throw new TRPCError12({ code: "NOT_FOUND", message: "Comanda nao encontrada." });
      await assertStoreEntityAccess(ctx.user, session.storeId);
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
    attachOrder: staffProcedure.input(z11.object({ tableSessionId: z11.number(), orderId: z11.number() })).mutation(async ({ input, ctx }) => {
      const session = await getTableSessionById(input.tableSessionId);
      const order = await getOrderById(input.orderId);
      if (!session || !order) throw new TRPCError12({ code: "NOT_FOUND", message: "Comanda ou pedido nao encontrado." });
      await assertStoreEntityAccess(ctx.user, session.storeId);
      await assertStoreEntityAccess(ctx.user, order.storeId);
      if (session.storeId !== order.storeId) throw new TRPCError12({ code: "BAD_REQUEST", message: "Comanda e pedido pertencem a lojas diferentes." });
      await attachOrderToTableSessionAndSync(input.tableSessionId, input.orderId);
      return { ok: true };
    }),
    addItem: staffProcedure.input(z11.object({
      tableSessionId: z11.number(),
      productId: z11.number(),
      quantity: z11.number().int().min(1).max(100),
      notes: z11.string().max(500).optional(),
      addedByStaffId: z11.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const session = await getTableSessionById(input.tableSessionId);
      const product = await getProductById(input.productId);
      if (!session || !product) throw new TRPCError12({ code: "NOT_FOUND", message: "Comanda ou produto nao encontrado." });
      await assertStoreEntityAccess(ctx.user, session.storeId);
      if (product.storeId != null && product.storeId !== session.storeId) {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Produto fora da loja da comanda." });
      }
      const itemId = await addTableSessionItem({
        tableSessionId: input.tableSessionId,
        productId: input.productId,
        quantity: input.quantity,
        notes: input.notes ?? null,
        addedByStaffId: input.addedByStaffId ?? null
      });
      return { ok: true, itemId };
    }),
    removeItem: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input, ctx }) => {
      const item = await getTableSessionItemById(input.id);
      const session = item ? await getTableSessionById(item.tableSessionId) : void 0;
      if (!item || !session) throw new TRPCError12({ code: "NOT_FOUND", message: "Item nao encontrado." });
      await assertStoreEntityAccess(ctx.user, session.storeId);
      await removeTableSessionItem(input.id);
      return { ok: true };
    }),
    updateItemStatus: staffProcedure.input(z11.object({
      id: z11.number(),
      status: z11.enum(["pending", "preparing", "ready", "served", "cancelled"])
    })).mutation(async ({ input, ctx }) => {
      const item = await getTableSessionItemById(input.id);
      const session = item ? await getTableSessionById(item.tableSessionId) : void 0;
      if (!item || !session) throw new TRPCError12({ code: "NOT_FOUND", message: "Item nao encontrado." });
      await assertStoreEntityAccess(ctx.user, session.storeId);
      await updateTableSessionItemStatus(input.id, input.status);
      return { ok: true };
    })
  }),
  customerMetrics: router({
    list: staffProcedure.input(z11.object({ storeId: z11.number().optional(), limit: z11.number().min(1).max(500).optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getCustomerMetricsReport({ storeId: storeId ?? 0, limit: input?.limit });
    })
  }),
  // --- ADMIN USERS ---------------------------------------------------------------
  adminUsers: router({
    list: staffProcedure.input(z11.object({
      page: z11.number().int().min(1).optional(),
      pageSize: z11.number().int().min(1).max(100).optional(),
      search: z11.string().max(160).optional(),
      role: z11.enum(["user", "admin", "manager"]).optional(),
      status: z11.enum(["active", "inactive", "suspended", "setup_pending"]).optional(),
      clubStatus: z11.enum(["active", "pending", "cancelled", "none"]).optional(),
      loginMethod: z11.enum(["email", "phone", "google", "apple", "facebook", "instagram", "manus"]).optional(),
      hasOrders: z11.enum(["with_orders", "without_orders"]).optional(),
      storeId: z11.number().optional()
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
    sendCoupon: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      userId: z11.number(),
      code: z11.string().min(1),
      discountType: z11.enum(["percentage", "fixed"]),
      discountValue: z11.string(),
      minOrderValue: z11.string().optional(),
      maxUses: z11.number().optional(),
      expiresAt: z11.date().optional()
    })).mutation(async ({ input, ctx }) => createUserCoupon({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) }))
  }),
  reports: router({
    sales: staffProcedure.input(z11.object({ startDate: z11.date(), endDate: z11.date(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getSalesReport(input.startDate, input.endDate, storeId);
    }),
    topProducts: staffProcedure.input(
      z11.object({
        limit: z11.number().optional(),
        storeId: z11.number().optional(),
        startDate: z11.date().optional(),
        endDate: z11.date().optional()
      }).optional()
    ).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getTopProducts(input?.limit, storeId, {
        startDate: input?.startDate,
        endDate: input?.endDate
      });
    }),
    topCategories: staffProcedure.input(z11.object({ startDate: z11.date(), endDate: z11.date(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getTopCategories(input.startDate, input.endDate, storeId);
    }),
    ordersByPeriod: staffProcedure.input(z11.object({ startDate: z11.date(), endDate: z11.date(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getOrdersByPeriod(input.startDate, input.endDate, storeId);
    }),
    dailyRevenue: staffProcedure.input(z11.object({ days: z11.number().optional(), storeId: z11.number().optional(), timezoneOffset: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getDailyRevenue(input?.days, storeId, input?.timezoneOffset);
    }),
    // Resumo de hoje calculado no servidor com suporte a timezone do cliente
    todaySummary: staffProcedure.input(z11.object({ timezoneOffset: z11.number().optional(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
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
    list: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllDrivers(false, storeId);
    }),
    create: staffProcedure.input(z11.object({ name: z11.string(), phone: z11.string().optional(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const token = crypto5.randomBytes(32).toString("hex");
      const id = await createDriver({ name: input.name, phone: input.phone ?? null, accessToken: token, active: true, storeId: storeId ?? null });
      return { id, accessToken: token };
    }),
    update: staffProcedure.input(z11.object({ id: z11.number(), name: z11.string().optional(), phone: z11.string().optional(), active: z11.boolean().optional() })).mutation(async ({ input, ctx }) => {
      const driver = await getDriverById(input.id);
      if (!driver) throw new TRPCError12({ code: "NOT_FOUND", message: "Motoboy nao encontrado." });
      await assertStoreEntityAccess(ctx.user, driver.storeId);
      return updateDriver(input.id, { name: input.name, phone: input.phone, active: input.active });
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input, ctx }) => {
      const driver = await getDriverById(input.id);
      if (!driver) throw new TRPCError12({ code: "NOT_FOUND", message: "Motoboy nao encontrado." });
      await assertStoreEntityAccess(ctx.user, driver.storeId);
      return deleteDriver(input.id);
    }),
    assignToOrder: staffProcedure.input(z11.object({ orderId: z11.number(), driverId: z11.number().nullable() })).mutation(async ({ input, ctx }) => {
      const prevOrder = await getOrderById(input.orderId);
      if (!prevOrder) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido nao encontrado." });
      await assertStoreEntityAccess(ctx.user, prevOrder.storeId);
      if (input.driverId) {
        const nextDriver = await getDriverById(input.driverId);
        if (!nextDriver) throw new TRPCError12({ code: "NOT_FOUND", message: "Motoboy nao encontrado." });
        await assertStoreEntityAccess(ctx.user, nextDriver.storeId);
        if (prevOrder.storeId !== nextDriver.storeId) {
          throw new TRPCError12({ code: "BAD_REQUEST", message: "Pedido e motoboy pertencem a lojas diferentes." });
        }
      }
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
    allLocations: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllActiveDriverLocations(storeId);
    }),
    updateLocation: publicProcedure.input(z11.object({ token: z11.string(), lat: z11.string(), lng: z11.string(), orderId: z11.number().optional() })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      await upsertDriverLocation(driver.id, input.lat, input.lng, input.orderId);
      return { ok: true };
    }),
    myActiveOrder: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      const loc = await getDriverLocation(driver.id);
      return { driver: { id: driver.id, name: driver.name }, activeOrderId: loc?.orderId ?? null };
    }),
    locationByOrder: protectedProcedure.input(z11.object({ orderId: z11.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      const isStaff = ctx.user.role === "admin" || ctx.user.role === "manager";
      if (order.userId !== ctx.user.id && !isStaff) {
        throw new TRPCError12({ code: "FORBIDDEN", message: "Acesso negado" });
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
    todayStats: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverTodayStats(driver.id);
    }),
    // Detalhes do pedido ativo (endereço, itens, cliente) — mantido por compatibilidade
    activeOrderDetails: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverActiveOrderDetails(driver.id);
    }),
    // Lista de TODOS os pedidos atribuídos ao motoboy (out_for_delivery)
    assignedOrders: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverAssignedOrders(driver.id);
    }),
    // Histórico de entregas do dia
    todayDeliveries: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      return getDriverTodayDeliveries(driver.id);
    }),
    // Confirmar entrega: status → delivered + push para cliente
    confirmDelivery: publicProcedure.input(z11.object({ token: z11.string(), orderId: z11.number() })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      const result = await driverConfirmDelivery(driver.id, input.orderId);
      if (!result.success) throw new TRPCError12({ code: "BAD_REQUEST", message: result.error ?? "Erro ao confirmar entrega" });
      if (result.customerId) {
        const deliveredOrder = await getOrderById(input.orderId);
        await sendPushToUser(result.customerId, {
          storeId: deliveredOrder?.storeId,
          title: "Pedido entregue! \u{1F355}",
          body: `Seu pedido #${input.orderId} chegou. Que tal avaliar a entrega?`,
          url: `/meus-pedidos?avaliar=${input.orderId}`,
          tag: `delivery-confirmed-${input.orderId}`
        });
        await createClientNotification({
          storeId: deliveredOrder?.storeId,
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
    savePushSubscription: publicProcedure.input(z11.object({
      token: z11.string(),
      endpoint: z11.string(),
      p256dh: z11.string(),
      auth: z11.string(),
      userAgent: z11.string().optional()
    })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      await saveDriverPushSubscription(driver.id, input.endpoint, input.p256dh, input.auth, input.userAgent);
      return { ok: true };
    }),
    // Remover push subscription do motoboy
    removePushSubscription: publicProcedure.input(z11.object({ token: z11.string(), endpoint: z11.string() })).mutation(async ({ input }) => {
      const driver = await getDriverByToken(input.token);
      if (!driver) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token inv\xE1lido" });
      await removeDriverPushSubscription(driver.id, input.endpoint);
      return { ok: true };
    })
  }),
  waiters: router({
    me: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      return waiter;
    }),
    tables: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      return getDiningTables({ storeId: waiter.storeId ?? void 0, activeOnly: true });
    }),
    sessions: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      const sessions = await getTableSessions({ storeId: waiter.storeId ?? void 0 });
      return sessions.filter(
        (session) => (session.status === "open" || session.status === "awaiting_closure") && (session.waiterStaffId == null || session.waiterStaffId === waiter.id)
      );
    }),
    menu: publicProcedure.input(z11.object({ token: z11.string() })).query(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      return getProducts({ storeId: waiter.storeId ?? void 0, activeOnly: true });
    }),
    openSession: publicProcedure.input(z11.object({
      token: z11.string(),
      tableId: z11.number(),
      customerName: z11.string().max(200).optional(),
      guestCount: z11.number().int().min(1).max(50).optional(),
      notes: z11.string().max(5e3).optional()
    })).mutation(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      const table = await getDiningTableById(input.tableId);
      if (!table || table.storeId == null || table.storeId !== waiter.storeId) {
        throw new TRPCError12({ code: "FORBIDDEN", message: "Mesa fora da loja do garcom." });
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
    addItem: publicProcedure.input(z11.object({
      token: z11.string(),
      tableSessionId: z11.number(),
      productId: z11.number(),
      quantity: z11.number().int().min(1).max(100),
      notes: z11.string().max(500).optional()
    })).mutation(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      const session = await getTableSessionById(input.tableSessionId);
      const product = await getProductById(input.productId);
      if (!session || session.storeId == null || session.storeId !== waiter.storeId) {
        throw new TRPCError12({ code: "FORBIDDEN", message: "Comanda fora da loja do garcom." });
      }
      if (!product || product.storeId != null && product.storeId !== waiter.storeId) {
        throw new TRPCError12({ code: "FORBIDDEN", message: "Produto fora da loja do garcom." });
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
    closeSession: publicProcedure.input(z11.object({
      token: z11.string(),
      id: z11.number(),
      discountAmount: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      tipAmount: z11.string().regex(/^\d+(\.\d{1,2})?$/).optional()
    })).mutation(async ({ input }) => {
      const waiter = await getStaffMemberByAccessToken(input.token);
      if (!waiter || waiter.role !== "waiter") {
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "Token invalido" });
      }
      const session = await getTableSessionById(input.id);
      if (!session || session.storeId == null || session.storeId !== waiter.storeId) {
        throw new TRPCError12({ code: "FORBIDDEN", message: "Comanda fora da loja do garcom." });
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
    getPublic: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getPaymentSettingsPublic(input?.storeId)),
    getAdmin: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => getPaymentSettingsAdmin(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    save: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      config: paymentConfigSchema,
      pixKey: z11.string().max(120)
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storeId: _requestedStoreId, ...settings } = input;
      await savePaymentSettings(settings, storeId);
      return getPaymentSettingsAdmin(storeId);
    })
  }),
  // --- STORE SETTINGS ---------------------------------------------------------
  storeSettings: router({
    // Qualquer um pode ler (para validar horário/CEP no frontend)
    get: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input }) => {
      const settings = await getAllStoreSettings(input?.storeId);
      const { pixKey: _pk, whatsappNumber: _wn, ...publicSettings } = settings;
      return publicSettings;
    }),
    // Staff endpoint with all settings including sensitive fields
    getAdmin: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAllStoreSettings(storeId);
    }),
    // Staff pode salvar configurações da loja
    save: staffProcedure.input(z11.object({
      storeHours: z11.record(z11.string(), z11.union([
        z11.null(),
        z11.object({ open: z11.string(), close: z11.string() })
      ])),
      deliveryCepPrefixes: z11.array(z11.string()),
      pixKey: z11.string().optional(),
      whatsappNumber: z11.string().optional(),
      deliveryFee: z11.string().optional(),
      minOrderValue: z11.string().optional(),
      storeId: z11.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      await setStoreSetting("storeHours", JSON.stringify(input.storeHours), storeId);
      await setStoreSetting("deliveryCepPrefixes", JSON.stringify(input.deliveryCepPrefixes), storeId);
      if (input.pixKey !== void 0) await setStoreSetting("pixKey", input.pixKey, storeId);
      if (input.whatsappNumber !== void 0) await setStoreSetting("whatsappNumber", input.whatsappNumber, storeId);
      if (input.deliveryFee !== void 0) await setStoreSetting("deliveryFee", input.deliveryFee, storeId);
      if (input.minOrderValue !== void 0) await setStoreSetting("minOrderValue", input.minOrderValue, storeId);
      return { success: true };
    }),
    savePizzaFlavorConfig: staffProcedure.input(z11.object({
      enabled: z11.boolean(),
      pricingMode: z11.enum(["highest"]).default("highest"),
      maxFlavorsBySize: z11.object({
        small: z11.number().int().min(1).max(4),
        medium: z11.number().int().min(1).max(4),
        large: z11.number().int().min(1).max(4),
        family: z11.number().int().min(1).max(4)
      }),
      storeId: z11.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const { storeId: _storeId, ...config } = input;
      await setStoreSetting("pizzaFlavorConfig", JSON.stringify(config), storeId);
      return { success: true };
    }),
    saveMenuLayout: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      layout: z11.enum(["editorial", "compact", "visual"])
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      await setStoreSetting("menuLayout", input.layout, storeId);
      return { success: true };
    }),
    saveHomeLayoutConfig: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      greetingSubtitle: z11.string().min(1).max(100),
      orderTitle: z11.string().min(1).max(80),
      orderDescription: z11.string().min(1).max(180),
      orderButtonLabel: z11.string().min(1).max(40),
      quickActionsTitle: z11.string().min(1).max(60),
      offersLabel: z11.string().min(1).max(24),
      couponsLabel: z11.string().min(1).max(24),
      clubLabel: z11.string().min(1).max(24),
      menuLabel: z11.string().min(1).max(24)
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const { storeId: _storeId, ...config } = input;
      await setStoreSetting("homeLayoutConfig", JSON.stringify(config), storeId);
      return { success: true };
    })
  }),
  // --- DELIVERY RATINGS -----------------------------------------------------------
  ratings: router({
    // Cliente avalia a entrega após receber o pedido
    submit: protectedProcedure.input(z11.object({
      orderId: z11.number(),
      rating: z11.number().min(1).max(5),
      comment: z11.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN", message: "Pedido n\xE3o pertence a voc\xEA" });
      if (order.status !== "delivered") throw new TRPCError12({ code: "BAD_REQUEST", message: "Pedido ainda n\xE3o foi entregue" });
      if (!order.driverId) throw new TRPCError12({ code: "BAD_REQUEST", message: "Pedido sem motoboy atribu\xEDdo" });
      const existing = await getRatingByOrder(input.orderId);
      if (existing) throw new TRPCError12({ code: "CONFLICT", message: "Pedido j\xE1 foi avaliado" });
      await submitDeliveryRating({
        orderId: input.orderId,
        driverId: order.driverId,
        userId: ctx.user.id,
        rating: input.rating,
        comment: input.comment ?? null
      });
      const userPhone = ctx.user.phone ?? void 0;
      fireJourneyTrigger("rating_submitted", ctx.user.id, userPhone, order.storeId ?? void 0).catch(() => {
      });
      if (input.rating <= 3) {
        fireJourneyTrigger("rating_negative", ctx.user.id, userPhone, order.storeId ?? void 0).catch(() => {
        });
      }
      return { success: true };
    }),
    // Verificar se um pedido já foi avaliado
    getByOrder: protectedProcedure.input(z11.object({ orderId: z11.number() })).query(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order || order.userId !== ctx.user.id) return null;
      return getRatingByOrder(input.orderId);
    }),
    // Perfil público do motoboy com avaliações e histórico
    driverProfile: publicProcedure.input(z11.object({ driverId: z11.number() })).query(async ({ input }) => {
      const driver = await getDriverById(input.driverId);
      if (!driver) throw new TRPCError12({ code: "NOT_FOUND", message: "Motoboy n\xE3o encontrado" });
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
    driverRatings: adminProcedure2.input(z11.object({ driverId: z11.number() })).query(({ input }) => getDriverRatings(input.driverId))
  }),
  // --- ADDRESSES --------------------------------------------------------------
  addresses: router({
    list: protectedProcedure.query(({ ctx }) => getUserAddresses(ctx.user.id)),
    create: protectedProcedure.input(z11.object({
      label: z11.string().min(1).max(50),
      address: z11.string().min(1),
      cep: z11.string().optional(),
      city: z11.string().optional(),
      isDefault: z11.boolean().optional()
    })).mutation(({ ctx, input }) => createUserAddress({ ...input, userId: ctx.user.id, isDefault: input.isDefault ?? false })),
    update: protectedProcedure.input(z11.object({
      id: z11.number(),
      label: z11.string().min(1).max(50).optional(),
      address: z11.string().min(1).optional(),
      cep: z11.string().optional(),
      city: z11.string().optional(),
      isDefault: z11.boolean().optional()
    })).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateUserAddress(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z11.object({ id: z11.number() })).mutation(({ ctx, input }) => deleteUserAddress(input.id, ctx.user.id))
  }),
  // --- FAVORITES --------------------------------------------------------------
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => getUserFavorites(ctx.user.id)),
    toggle: protectedProcedure.input(z11.object({ productId: z11.number() })).mutation(({ ctx, input }) => toggleFavorite(ctx.user.id, input.productId))
  }),
  // --- NOTIFICATIONS ----------------------------------------------------------
  notifications: router({
    list: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getClientNotifications(ctx.user.id, input?.storeId)),
    unreadCount: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getUnreadNotificationCount(ctx.user.id, input?.storeId)),
    markRead: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive().optional() }).optional()).mutation(({ ctx, input }) => markNotificationsRead(ctx.user.id, input?.storeId)),
    send: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      userId: z11.number(),
      title: z11.string(),
      message: z11.string(),
      type: z11.enum(["order", "promo", "system"]).optional()
    })).mutation(async ({ input, ctx }) => createClientNotification({
      ...input,
      storeId: await resolveRequiredStoreId(ctx.user, input.storeId),
      type: input.type ?? "system"
    })),
    // --- Agendamento de notificações ---
    scheduleList: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => listScheduledNotifications(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    scheduleCreate: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      title: z11.string().min(1).max(200),
      message: z11.string().min(1),
      channel: z11.enum(["push", "whatsapp", "both"]).default("push"),
      targetAudience: z11.enum(["all", "active", "inactive", "club"]).default("all"),
      scheduledAt: z11.date(),
      recurrence: z11.enum(["once", "daily", "weekly"]).default("once"),
      neighborhoodFilter: z11.array(z11.string()).optional().nullable()
    })).mutation(async ({ ctx, input }) => createScheduledNotification({
      storeId: await resolveRequiredStoreId(ctx.user, input.storeId),
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
    scheduleCancel: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => cancelScheduledNotification(input.id, await resolveRequiredStoreId(ctx.user, input.storeId))),
    scheduleDelete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => deleteScheduledNotification(input.id, await resolveRequiredStoreId(ctx.user, input.storeId)))
  }),
  // --- LOYALTY ----------------------------------------------------------------
  loyalty: router({
    points: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getUserLoyaltyPoints(ctx.user.id, input?.storeId)),
    spendingHistory: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getUserSpendingHistory(ctx.user.id, input?.storeId)),
    history: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getLoyaltyHistory(ctx.user.id, 30, input?.storeId)),
    // Preview do desconto de pontos (sem debitar — o débito acontece no createOrder)
    preview: protectedProcedure.input(z11.object({ points: z11.number().int().min(50).max(5e3), storeId: z11.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const POINTS_TO_BRL = 0.1;
      const balance = await getUserLoyaltyPoints(ctx.user.id, input.storeId);
      const pts = Math.min(input.points, balance);
      if (pts < 50) throw new TRPCError12({ code: "BAD_REQUEST", message: "Pontos insuficientes para resgate." });
      const discount = parseFloat((pts * POINTS_TO_BRL).toFixed(2));
      return { discount, pointsUsed: pts, balance };
    }),
    // Admin: adicionar pontos manualmente
    adminAdd: staffProcedure.input(z11.object({ userId: z11.number(), points: z11.number().int().min(1), description: z11.string().optional(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      await addLoyaltyPoints(input.userId, input.points, void 0, input.description ?? `+${input.points} pontos (manual)`, storeId);
      return { ok: true };
    })
  }),
  // --- AVATAR -----------------------------------------------------------------------------
  avatar: router({
    upload: protectedProcedure.input(z11.object({
      base64: z11.string().max(4e6),
      // ~3MB base64 limit for avatars
      mimeType: z11.enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
    })).mutation(async ({ ctx, input }) => {
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const key = `avatars/user-${ctx.user.id}-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, input.mimeType);
      await updateUserAvatar(ctx.user.id, url);
      return { url };
    }),
    update: protectedProcedure.input(z11.object({ avatarUrl: z11.string().url() })).mutation(({ ctx, input }) => updateUserAvatar(ctx.user.id, input.avatarUrl))
  }),
  // --- CHAT (mensagens do pedido) ---
  chat: router({
    messages: protectedProcedure.input(z11.object({ orderId: z11.number() })).query(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError12({ code: "FORBIDDEN" });
      }
      const msgs = await getOrderMessages(input.orderId);
      return { messages: msgs, aiPaused: order.aiPaused ?? false };
    }),
    send: protectedProcedure.input(z11.object({ orderId: z11.number(), message: z11.string().min(1).max(1e3), senderRole: z11.enum(["customer", "admin"]).optional() })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError12({ code: "FORBIDDEN" });
      }
      const senderRole = input.senderRole ?? (ctx.user.role === "admin" ? "admin" : "customer");
      if (senderRole === "admin" && ctx.user.role !== "admin") {
        throw new TRPCError12({ code: "FORBIDDEN" });
      }
      const msg = await sendOrderMessage({ orderId: input.orderId, userId: ctx.user.id, senderRole, message: input.message });
      const pushPreview = input.message.length > 100 ? input.message.slice(0, 97) + "..." : input.message;
      if (senderRole === "customer") {
        await sendPushToAdmins({
          storeId: order.storeId,
          title: "Nova mensagem de cliente",
          body: `Pedido #${input.orderId} - ${order.customerName}: ${pushPreview}`,
          url: `/admin?tab=messages&order=${input.orderId}`,
          tag: `admin-chat-${input.orderId}`
        });
      }
      if (senderRole === "admin" && order.userId) {
        await sendPushToUser(order.userId, {
          storeId: order.storeId,
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
    markRead: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const order = await getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
      }
      const readerRole = ctx.user.role === "admin" ? "admin" : "customer";
      await markMessagesRead(input.orderId, readerRole);
      return { ok: true };
    }),
    unreadCount: protectedProcedure.input(z11.object({ orderId: z11.number() })).query(async ({ ctx, input }) => {
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
    aiReply: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError12({ code: "FORBIDDEN" });
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
      if (order.userId) await sendPushToUser(order.userId, {
        storeId: order.storeId,
        title: "Resposta da Bonatto Pizza",
        body: reply.length > 100 ? reply.slice(0, 97) + "..." : reply,
        url: `/rastrear/${input.orderId}`,
        tag: `customer-chat-ai-${input.orderId}`
      });
      return { reply };
    }),
    // Solicitar atendente humano — pausa a IA e notifica o admin
    requestHuman: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError12({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id) throw new TRPCError12({ code: "FORBIDDEN" });
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
    resumeAI: protectedProcedure.input(z11.object({ orderId: z11.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError12({ code: "FORBIDDEN" });
      await setOrderAiPaused(input.orderId, false);
      return { ok: true };
    }),
    ordersWithMessages: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getOrdersWithMessages(storeId);
    })
  }),
  // ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
  push: router({
    subscribe: protectedProcedure.input(z11.object({
      endpoint: z11.string().url(),
      p256dh: z11.string(),
      auth: z11.string(),
      userAgent: z11.string().max(512).optional()
    })).mutation(async ({ ctx, input }) => {
      const safeUserAgent = input.userAgent?.substring(0, 512);
      await savePushSubscription(ctx.user.id, input.endpoint, input.p256dh, input.auth, safeUserAgent);
      return { ok: true };
    }),
    unsubscribe: protectedProcedure.input(z11.object({ endpoint: z11.string() })).mutation(async ({ ctx, input }) => {
      await removePushSubscription(ctx.user.id, input.endpoint);
      return { ok: true };
    }),
    vapidPublicKey: publicProcedure.query(() => {
      return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
    })
  }),
  // ─── MARKETING AUTOMATION ──────────────────────────────────────────────────
  automations: router({
    listJourneys: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const list = await listJourneys(await resolveRequiredStoreId(ctx.user, input.storeId));
      return list.map((j) => ({ ...j, steps: JSON.parse(j.steps) }));
    }),
    getJourney: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const j = await getJourneyById(input.id, storeId);
      if (!j) throw new TRPCError12({ code: "NOT_FOUND" });
      return { ...j, steps: JSON.parse(j.steps) };
    }),
    createJourney: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      name: z11.string().min(1),
      description: z11.string().optional(),
      trigger: z11.enum(["checkout_abandoned", "tag_inativo_15", "tag_inativo_30", "tag_inativo_60", "tag_inativo_custom", "first_order", "new_user", "club_subscriber", "manual", "order_delivered", "order_cancelled", "birthday", "loyalty_milestone", "rating_submitted", "rating_negative", "club_expiring", "first_order_month"]),
      steps: z11.array(z11.object({
        id: z11.string(),
        type: z11.enum(["wait", "send_whatsapp", "send_push", "condition", "add_tag", "remove_tag", "webhook", "send_coupon", "update_loyalty", "send_alert", "split_ab", "pause_journey", "notify_admin"]),
        label: z11.string(),
        delayMinutes: z11.number().optional(),
        message: z11.string().optional(),
        title: z11.string().optional(),
        condition: z11.enum(["purchased_since_start", "has_tag", "has_min_orders", "has_min_points"]).optional(),
        conditionTag: z11.string().optional(),
        conditionValue: z11.number().optional(),
        onTrue: z11.enum(["continue", "stop"]).optional(),
        onFalse: z11.enum(["continue", "stop"]).optional(),
        tag: z11.string().optional(),
        couponDiscountType: z11.enum(["percentage", "fixed"]).optional(),
        couponDiscountValue: z11.number().optional(),
        couponExpiryDays: z11.number().optional(),
        loyaltyPoints: z11.number().optional(),
        loyaltyDescription: z11.string().optional(),
        alertTitle: z11.string().optional(),
        alertMessage: z11.string().optional(),
        alertIcon: z11.string().optional(),
        alertUrl: z11.string().optional(),
        messageA: z11.string().optional(),
        messageB: z11.string().optional(),
        titleA: z11.string().optional(),
        titleB: z11.string().optional(),
        splitChannel: z11.enum(["whatsapp", "push"]).optional(),
        webhookUrl: z11.string().optional(),
        secret: z11.string().optional(),
        pauseJourneyId: z11.number().optional(),
        adminTaskTitle: z11.string().optional(),
        adminTaskMessage: z11.string().optional(),
        adminTaskPriority: z11.enum(["low", "normal", "high"]).optional()
      })),
      daysInactive: z11.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const id = await createJourney({ ...input, storeId });
      return { id };
    }),
    updateJourney: staffProcedure.input(z11.object({
      id: z11.number(),
      storeId: z11.number().optional(),
      name: z11.string().optional(),
      description: z11.string().optional(),
      trigger: z11.enum(["checkout_abandoned", "tag_inativo_15", "tag_inativo_30", "tag_inativo_60", "tag_inativo_custom", "first_order", "new_user", "club_subscriber", "manual", "order_delivered", "order_cancelled", "birthday", "loyalty_milestone", "rating_submitted", "rating_negative", "club_expiring", "first_order_month"]).optional(),
      status: z11.enum(["active", "paused", "draft"]).optional(),
      steps: z11.array(z11.object({
        id: z11.string(),
        type: z11.enum(["wait", "send_whatsapp", "send_push", "condition", "add_tag", "remove_tag", "webhook", "send_coupon", "update_loyalty", "send_alert", "split_ab", "pause_journey", "notify_admin"]),
        label: z11.string(),
        delayMinutes: z11.number().optional(),
        message: z11.string().optional(),
        title: z11.string().optional(),
        condition: z11.enum(["purchased_since_start", "has_tag", "has_min_orders", "has_min_points"]).optional(),
        conditionTag: z11.string().optional(),
        conditionValue: z11.number().optional(),
        onTrue: z11.enum(["continue", "stop"]).optional(),
        onFalse: z11.enum(["continue", "stop"]).optional(),
        tag: z11.string().optional(),
        couponDiscountType: z11.enum(["percentage", "fixed"]).optional(),
        couponDiscountValue: z11.number().optional(),
        couponExpiryDays: z11.number().optional(),
        loyaltyPoints: z11.number().optional(),
        loyaltyDescription: z11.string().optional(),
        alertTitle: z11.string().optional(),
        alertMessage: z11.string().optional(),
        alertIcon: z11.string().optional(),
        alertUrl: z11.string().optional(),
        messageA: z11.string().optional(),
        messageB: z11.string().optional(),
        titleA: z11.string().optional(),
        titleB: z11.string().optional(),
        splitChannel: z11.enum(["whatsapp", "push"]).optional(),
        webhookUrl: z11.string().optional(),
        secret: z11.string().optional()
      })).optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, storeId: requestedStoreId, ...data } = input;
      const storeId = await resolveRequiredStoreId(ctx.user, requestedStoreId);
      await updateJourney(id, data, storeId);
      return { ok: true };
    }),
    deleteJourney: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await deleteJourney(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    duplicateJourney: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const newId = await duplicateJourney(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      if (newId === -1) throw new TRPCError12({ code: "NOT_FOUND", message: "Jornada n\xE3o encontrada" });
      return { id: newId };
    }),
    toggleJourney: staffProcedure.input(z11.object({ id: z11.number(), status: z11.enum(["active", "paused", "draft"]), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await updateJourney(input.id, { status: input.status }, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    listExecutions: staffProcedure.input(z11.object({ journeyId: z11.number().optional(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      return listExecutions(input.journeyId, storeId);
    }),
    cancelExecution: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await cancelExecution(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    triggerJourney: staffProcedure.input(z11.object({ journeyId: z11.number(), userIds: z11.array(z11.number()), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError12({ code: "NOT_FOUND" });
      let started = 0;
      for (const uid of input.userIds) {
        const r = await startJourneyExecution(input.journeyId, uid);
        if (r > 0) started++;
      }
      return { started };
    }),
    listCustomerTags: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const result = await getAllCustomerTagsWithUsers(await resolveRequiredStoreId(ctx.user, input.storeId));
      return result[0];
    }),
    refreshTags: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await refreshCustomerTags(await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    listAbandonedCarts: staffProcedure.input(z11.object({ status: z11.enum(["pending", "recovered", "expired"]).optional(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => listAbandonedCarts(input.status, await resolveRequiredStoreId(ctx.user, input.storeId))),
    registerAbandonedCart: protectedProcedure.input(z11.object({
      storeId: z11.number().int().positive(),
      customerName: z11.string(),
      customerPhone: z11.string().optional(),
      items: z11.array(z11.object({
        productId: z11.number(),
        productName: z11.string(),
        quantity: z11.number().int().min(1).max(99),
        productPrice: z11.string()
      })),
      total: z11.string()
    })).mutation(async ({ ctx, input }) => {
      const tenant = await getWhiteLabelRuntimeByStoreId(input.storeId);
      if (!tenant?.features.automations) throw new TRPCError12({ code: "PRECONDITION_FAILED", message: "Automacoes indisponiveis nesta loja." });
      const id = await registerAbandonedCart({ userId: ctx.user.id, ...input });
      return { id };
    }),
    generateWebhookToken: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (!await getJourneyById(input.id, storeId)) throw new TRPCError12({ code: "NOT_FOUND" });
      const token = crypto5.randomBytes(32).toString("hex");
      await updateJourney(input.id, { webhookToken: token }, storeId);
      return { token };
    }),
    getWebhookToken: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const j = await getJourneyById(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      if (!j) throw new TRPCError12({ code: "NOT_FOUND" });
      return { token: j.webhookToken };
    }),
    processExecutions: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      await processJourneyExecutions(storeId);
      return { ok: true };
    }),
    getExecutionLogs: staffProcedure.input(z11.object({ executionId: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const execs = await listExecutions(void 0, await resolveRequiredStoreId(ctx.user, input.storeId));
      const exec = execs.find((e) => e.id === input.executionId);
      if (!exec) throw new TRPCError12({ code: "NOT_FOUND" });
      return {
        ...exec,
        logs: exec.logs ? JSON.parse(exec.logs) : []
      };
    }),
    testTrigger: staffProcedure.input(z11.object({
      journeyId: z11.number(),
      storeId: z11.number().optional(),
      trigger: z11.enum(["checkout_abandoned", "tag_inativo_15", "tag_inativo_30", "tag_inativo_60", "tag_inativo_custom", "first_order", "new_user", "club_subscriber", "manual", "order_delivered", "order_cancelled", "birthday", "loyalty_milestone", "rating_submitted", "rating_negative", "club_expiring", "first_order_month"]),
      userId: z11.number().optional(),
      phone: z11.string().optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError12({ code: "NOT_FOUND" });
      const targetUserId = input.userId ?? ctx.user.id;
      await startJourneyExecution(input.journeyId, targetUserId, input.phone);
      return { ok: true, message: `Gatilho disparado para jornada #${input.journeyId} com usu\xE1rio #${targetUserId}` };
    }),
    // ── Painel A/B: estatísticas de grupos A e B por jornada ─────────────────
    getAbStats: staffProcedure.input(z11.object({ journeyId: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { groupA: 0, groupB: 0, conversionA: 0, conversionB: 0, revenueA: 0, revenueB: 0 };
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const execs = await db.select().from(journeyExecutions).where(and16(eq19(journeyExecutions.journeyId, input.journeyId), eq19(journeyExecutions.storeId, storeId)));
      const groupA = execs.filter((e) => e.abGroup === "A");
      const groupB = execs.filter((e) => e.abGroup === "B");
      const convA = groupA.filter((e) => e.convertedAt !== null).length;
      const convB = groupB.filter((e) => e.convertedAt !== null).length;
      const convOrderIdsA = groupA.map((e) => e.conversionOrderId).filter(Boolean);
      const convOrderIdsB = groupB.map((e) => e.conversionOrderId).filter(Boolean);
      let revenueA = 0;
      let revenueB = 0;
      if (convOrderIdsA.length > 0) {
        const ordersA = await db.select({ total: orders.total }).from(orders).where(inArray11(orders.id, convOrderIdsA));
        revenueA = ordersA.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      }
      if (convOrderIdsB.length > 0) {
        const ordersB = await db.select({ total: orders.total }).from(orders).where(inArray11(orders.id, convOrderIdsB));
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
    health: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (!db) return {
        status: "critical",
        running: 0,
        overdue: 0,
        failedLast7Days: 0,
        completedLast7Days: 0,
        channels: { push: false, whatsapp: false, email: false },
        lastExecutionAt: null
      };
      const since = new Date(Date.now() - 7 * 864e5);
      const [runningRows, recentRows, latestRows] = await Promise.all([
        db.select({ id: journeyExecutions.id, nextStepAt: journeyExecutions.nextStepAt }).from(journeyExecutions).where(and16(eq19(journeyExecutions.storeId, storeId), eq19(journeyExecutions.status, "running"))).limit(1e4),
        db.select({ status: journeyExecutions.status }).from(journeyExecutions).where(and16(eq19(journeyExecutions.storeId, storeId), gte4(journeyExecutions.startedAt, since))).limit(2e4),
        db.select({ startedAt: journeyExecutions.startedAt }).from(journeyExecutions).where(eq19(journeyExecutions.storeId, storeId)).orderBy(desc7(journeyExecutions.startedAt)).limit(1)
      ]);
      const now = Date.now();
      const overdue = runningRows.filter((item) => item.nextStepAt && item.nextStepAt.getTime() < now - 5 * 6e4).length;
      const failedLast7Days = recentRows.filter((item) => item.status === "failed").length;
      const completedLast7Days = recentRows.filter((item) => item.status === "completed").length;
      const channels = {
        push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        whatsapp: (process.env.WHATSAPP_PROVIDER ?? "none") !== "none",
        email: Boolean(process.env.RESEND_API_KEY)
      };
      const status = overdue > 20 || failedLast7Days > 50 ? "critical" : overdue > 0 || failedLast7Days > 0 || !channels.push ? "attention" : "healthy";
      return { status, running: runningRows.length, overdue, failedLast7Days, completedLast7Days, channels, lastExecutionAt: latestRows[0]?.startedAt ?? null };
    }),
    getGlobalMetrics: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { totalExecutions: 0, completedExecutions: 0, conversions: 0, conversionRate: 0, attributedRevenue: 0, activeJourneys: 0, topJourneys: [] };
      const storeId = await resolveRequiredStoreId(ctx.user, input?.storeId);
      const now = /* @__PURE__ */ new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let allExecs = await db.select().from(journeyExecutions).where(and16(eq19(journeyExecutions.storeId, storeId), gte4(journeyExecutions.startedAt, monthStart)));
      const completed = allExecs.filter((e) => e.status === "completed").length;
      const conversions = allExecs.filter((e) => e.convertedAt !== null).length;
      const convOrderIds = allExecs.map((e) => e.conversionOrderId).filter(Boolean);
      let attributedRevenue = 0;
      if (convOrderIds.length > 0) {
        const convOrders = await db.select({ total: orders.total }).from(orders).where(inArray11(orders.id, convOrderIds));
        attributedRevenue = convOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      }
      const activeJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys).where(and16(eq19(journeys.storeId, storeId), eq19(journeys.status, "active")));
      const execsByJourney = allExecs.reduce((acc, e) => {
        acc[e.journeyId] = (acc[e.journeyId] ?? 0) + 1;
        return acc;
      }, {});
      const allJourneysList = await db.select({ id: journeys.id, name: journeys.name }).from(journeys).where(eq19(journeys.storeId, storeId));
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
    getCustomerJourneyHistory: staffProcedure.input(z11.object({ userId: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const execs = await db.select().from(journeyExecutions).where(and16(eq19(journeyExecutions.storeId, storeId), eq19(journeyExecutions.userId, input.userId))).orderBy(desc7(journeyExecutions.startedAt)).limit(50);
      const journeyIds = Array.from(new Set(execs.map((e) => e.journeyId)));
      const journeyList = journeyIds.length > 0 ? await db.select({ id: journeys.id, name: journeys.name, trigger: journeys.trigger }).from(journeys).where(inArray11(journeys.id, journeyIds)) : [];
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
    listCustomers: staffProcedure.input(z11.object({
      search: z11.string().optional(),
      tag: z11.string().optional(),
      limit: z11.number().optional(),
      offset: z11.number().optional(),
      storeId: z11.number().optional()
    })).query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (input.tag) {
        const customers2 = await getCrmCustomersByTag(input.tag, storeId);
        return { customers: customers2, total: customers2.length };
      }
      const [customers, total] = await Promise.all([
        getCrmCustomers({ search: input.search, limit: input.limit, offset: input.offset, storeId }),
        countCrmCustomers(input.search, storeId)
      ]);
      return { customers, total };
    }),
    getCustomerDetail: staffProcedure.input(z11.object({ userId: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const detail = await getCrmCustomerDetail(input.userId, storeId);
      if (!detail) throw new TRPCError12({ code: "NOT_FOUND" });
      const [tags, executions, carts] = await Promise.all([
        getTagsForCustomer(input.userId, storeId),
        getJourneyExecutionsByUser(input.userId, storeId),
        getAbandonedCartsByUser(input.userId, storeId)
      ]);
      return { ...detail, tags, executions, carts };
    }),
    assignTag: staffProcedure.input(z11.object({ userId: z11.number(), tag: z11.string(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await assignTagToCustomer(input.userId, input.tag, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    removeTag: staffProcedure.input(z11.object({ userId: z11.number(), tag: z11.string(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await removeTagFromCustomer(input.userId, input.tag, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    getStats: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input?.storeId);
      return getCrmStats(storeId);
    }),
    // ── Tags Personalizadas ──────────────────────────────────────────────
    listCustomTags: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).query(async ({ input, ctx }) => listCustomTags(await resolveRequiredStoreId(ctx.user, input.storeId))),
    createCustomTag: staffProcedure.input(z11.object({ name: z11.string().min(1).max(100), color: z11.string().default("#6b7280"), description: z11.string().optional(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const id = await createCustomTag({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) });
      return { id };
    }),
    updateCustomTag: staffProcedure.input(z11.object({ id: z11.number(), name: z11.string().optional(), color: z11.string().optional(), description: z11.string().optional(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const { id, storeId: requestedStoreId, ...data } = input;
      await updateCustomTag(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
      return { ok: true };
    }),
    deleteCustomTag: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await deleteCustomTag(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    assignCustomTag: staffProcedure.input(z11.object({ userId: z11.number(), tagId: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await assignCustomTagToCustomer(input.userId, input.tagId, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    removeCustomTag: staffProcedure.input(z11.object({ userId: z11.number(), tagId: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await removeCustomTagFromCustomer(input.userId, input.tagId, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    getCustomTagsForCustomer: staffProcedure.input(z11.object({ userId: z11.number(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      return getCustomTagsForCustomer(input.userId, await resolveRequiredStoreId(ctx.user, input.storeId));
    }),
    getCustomersByCustomTag: staffProcedure.input(z11.object({ tagName: z11.string(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      return getCustomersByCustomTagName(input.tagName, await resolveRequiredStoreId(ctx.user, input.storeId));
    }),
    triggerJourneyForTag: staffProcedure.input(z11.object({ journeyId: z11.number(), tag: z11.string(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError12({ code: "NOT_FOUND" });
      const customers = await getCrmCustomersByTag(input.tag, storeId);
      let started = 0;
      for (const c of customers) {
        const r = await startJourneyExecution(input.journeyId, c.id, c.phone ?? void 0);
        if (r > 0) started++;
      }
      return { started, total: customers.length };
    }),
    triggerJourneyForCustomer: staffProcedure.input(z11.object({ journeyId: z11.number(), userId: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      if (!await getJourneyById(input.journeyId, storeId)) throw new TRPCError12({ code: "NOT_FOUND" });
      const db = await Promise.resolve().then(() => (init_db(), db_exports));
      const detail = await db.getCrmCustomerDetail(input.userId, storeId);
      if (!detail) throw new TRPCError12({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado" });
      const r = await startJourneyExecution(input.journeyId, input.userId, detail.user.phone ?? void 0);
      return { started: r > 0 ? 1 : 0 };
    })
  }),
  // ── Templates de Notificação ──────────────────────────────────────────────
  notificationTemplates: router({
    list: staffProcedure.input(z11.object({ storeId: z11.number().optional(), event: z11.string().optional(), channel: z11.string().optional() }).optional()).query(async ({ ctx, input }) => listNotificationTemplates({
      ...input,
      storeId: await resolveRequiredStoreId(ctx.user, input?.storeId)
    })),
    seed: staffProcedure.input(z11.object({ storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
      await seedNotificationTemplates(await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      event: z11.enum(["order_confirmed", "order_preparing", "order_out_for_delivery", "order_delivered", "order_cancelled", "cart_abandoned_step1", "cart_abandoned_step2", "cart_abandoned_step3", "reactivation_15", "reactivation_30", "reactivation_60", "custom"]),
      channel: z11.enum(["push", "whatsapp", "both"]).default("both"),
      title: z11.string().min(1).max(200),
      body: z11.string().min(1),
      redirectUrl: z11.string().max(500).optional(),
      isActive: z11.boolean().default(true)
    })).mutation(async ({ ctx, input }) => {
      const id = await createNotificationTemplate({
        ...input,
        storeId: await resolveRequiredStoreId(ctx.user, input.storeId)
      });
      return { id };
    }),
    update: staffProcedure.input(z11.object({
      id: z11.number(),
      storeId: z11.number().optional(),
      title: z11.string().min(1).max(200).optional(),
      body: z11.string().min(1).optional(),
      isActive: z11.boolean().optional(),
      channel: z11.enum(["push", "whatsapp", "both"]).optional(),
      redirectUrl: z11.string().max(500).optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      const { id, storeId: requestedStoreId, ...data } = input;
      await updateNotificationTemplate(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ ctx, input }) => {
      await deleteNotificationTemplate(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    }),
    // Disparo de notificação personalizada em massa
    sendCustom: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      title: z11.string().min(1).max(200),
      body: z11.string().min(1),
      redirectUrl: z11.string().optional(),
      // ex: "/cardapio", "/promocoes", URL completa
      tag: z11.enum(["novo", "recorrente", "indeciso", "inativo_15", "inativo_30", "inativo_60"]).optional()
      // se tag for undefined, envia para todos
    })).mutation(async ({ ctx, input }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const database = await getDb();
      if (!database) {
        throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel" });
      }
      const storeCustomers = await database.selectDistinct({ userId: orders.userId }).from(orders).where(and16(eq19(orders.storeId, storeId), isNotNull2(orders.userId)));
      let userIds = storeCustomers.map((row) => row.userId).filter((userId) => userId !== null);
      if (input.tag) {
        const { customerTags: customerTags2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
        const rows = await database.select({ userId: customerTags2.userId }).from(customerTags2).where(and16(eq19(customerTags2.storeId, storeId), eq19(customerTags2.tag, input.tag)));
        const taggedUserIds = new Set(rows.map((row) => row.userId));
        userIds = userIds.filter((userId) => taggedUserIds.has(userId));
      }
      if (userIds.length === 0) {
        return { sent: 0, failed: 0, skipped: true };
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
    search: publicProcedure.input(z11.object({ query: z11.string().min(1), storeId: z11.number().optional() })).query(async ({ input }) => {
      return searchDeliveryZones(input.query, input.storeId);
    }),
    getByNeighborhood: publicProcedure.input(z11.object({ neighborhood: z11.string(), storeId: z11.number().optional() })).query(async ({ input }) => {
      return getDeliveryZoneByNeighborhood(input.neighborhood, input.storeId);
    }),
    // Staff: CRUD completo
    list: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => getAllDeliveryZones(false, await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      neighborhood: z11.string().min(1).max(200),
      city: z11.string().max(200).optional(),
      deliveryFee: z11.string(),
      estimatedMinutes: z11.number().int().min(1).optional()
    })).mutation(async ({ input, ctx }) => {
      const id = await createDeliveryZone({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) });
      return { id };
    }),
    update: staffProcedure.input(z11.object({
      id: z11.number(),
      storeId: z11.number().optional(),
      neighborhood: z11.string().min(1).max(200).optional(),
      city: z11.string().max(200).optional(),
      deliveryFee: z11.string().optional(),
      estimatedMinutes: z11.number().int().min(1).optional(),
      isActive: z11.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, storeId: requestedStoreId, ...data } = input;
      await updateDeliveryZone(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
      return { ok: true };
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await deleteDeliveryZone(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    })
  }),
  // --- LOJAS (MULTI-TENANT) --------------------------------------------------
  stores: storesRouter,
  platform: platformRouter,
  siteStudio: siteStudioRouter,
  rewards: rewardsRouter,
  catalog: catalogRouter,
  restaurantNetwork: router({
    distributionProducts: staffProcedure.input(z11.object({ activeOnly: z11.boolean().optional() }).optional()).query(({ input }) => listDistributionProducts({ activeOnly: input?.activeOnly ?? true })),
    createDistributionProduct: adminProcedure2.input(distributionProductSchema).mutation(({ ctx, input }) => createDistributionProduct(input, ctx.user.id)),
    updateDistributionProduct: adminProcedure2.input(updateDistributionProductSchema).mutation(({ ctx, input }) => updateDistributionProduct(input, ctx.user.id)),
    overview: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      startDate: z11.date(),
      endDate: z11.date()
    })).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getFinancialOverview({ storeId, startDate: input.startDate, endDate: input.endDate });
    }),
    supplyOrders: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      status: z11.string().optional()
    }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return listSupplyOrders({ storeId, status: input?.status });
    }),
    supplyOrderDetails: staffProcedure.input(z11.object({ id: z11.number() })).query(async ({ input }) => getSupplyOrderDetails(input.id)),
    createSupplyOrder: staffProcedure.input(createSupplyOrderSchema).mutation(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      if (!storeId) throw new TRPCError12({ code: "BAD_REQUEST", message: "Selecione uma loja para criar o pedido ao centro de distribui\xE7\xE3o." });
      return createSupplyOrder({ ...input, storeId }, ctx.user.id);
    }),
    updateSupplyOrderStatus: staffProcedure.input(updateSupplyOrderStatusSchema).mutation(async ({ ctx, input }) => updateSupplyOrderStatus(input, ctx.user.id)),
    createExpense: staffProcedure.input(createExpenseSchema).mutation(async ({ ctx, input }) => {
      const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
      return createExpense(input, ctx.user.id, scopedStoreId2);
    }),
    createFinancialFee: staffProcedure.input(createFinancialFeeSchema).mutation(async ({ ctx, input }) => {
      const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
      return createFinancialFee(input, ctx.user.id, scopedStoreId2);
    }),
    upsertMonthlyClosing: staffProcedure.input(createMonthlyClosingSchema).mutation(async ({ ctx, input }) => {
      const scopedStoreId2 = await resolveStoreId(ctx.user, input.storeId);
      return upsertMonthlyClosing(input, ctx.user.id, scopedStoreId2);
    }),
    monthlyClosings: staffProcedure.input(z11.object({ storeId: z11.number().optional(), year: z11.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return listMonthlyClosings({ storeId, year: input?.year });
    }),
    auditLogs: staffProcedure.input(z11.object({ storeId: z11.number().optional(), limit: z11.number().min(1).max(250).optional() }).optional()).query(async ({ ctx, input }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return listAuditLogs({ storeId, limit: input?.limit });
    })
  }),
  // --- CLUBE DO BONATTO -------------------------------------------------------
  club: clubRouter,
  // --- MENU SLIDES -----------------------------------------------------------
  analytics: router({
    salesOverview: staffProcedure.input(z11.object({
      startDate: z11.date(),
      endDate: z11.date(),
      storeId: z11.number().optional()
    })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getSalesOverview(input.startDate, input.endDate, storeId);
    }),
    salesTimeSeries: staffProcedure.input(z11.object({
      startDate: z11.date(),
      endDate: z11.date(),
      storeId: z11.number().optional(),
      timezoneOffset: z11.number().optional()
    })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getSalesTimeSeries(input.startDate, input.endDate, storeId, input.timezoneOffset);
    }),
    recentOrders: staffProcedure.input(z11.object({ limit: z11.number().int().min(1).max(50).optional(), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      return getRecentOrdersFeed(input.limit ?? 20, storeId);
    }),
    globalSearch: staffProcedure.input(z11.object({ query: z11.string().trim().min(2).max(80), storeId: z11.number().optional() })).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input.storeId);
      const db = await getDb();
      if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR" });
      const { sql: sql14 } = await import("drizzle-orm");
      const likeQuery = `%${input.query}%`;
      const storeClause = storeId ? sql14`AND o.storeId = ${storeId}` : sql14``;
      const messageStoreClause = storeId ? sql14`AND ord.storeId = ${storeId}` : sql14``;
      const tableStoreClause = storeId ? sql14`AND dt.storeId = ${storeId}` : sql14``;
      const [ordersResult, customersResult, tablesResult, conversationsResult] = await Promise.all([
        db.execute(sql14`
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
        db.execute(sql14`
            SELECT u.id, u.name, u.email, u.phone, MAX(o.createdAt) AS lastOrderAt
            FROM users u
            LEFT JOIN orders o ON o.userId = u.id
            WHERE u.role = 'user'
              AND (
                u.name LIKE ${likeQuery}
                OR u.email LIKE ${likeQuery}
                OR u.phone LIKE ${likeQuery}
              )
              ${storeId ? sql14`AND EXISTS (SELECT 1 FROM orders ox WHERE ox.userId = u.id AND ox.storeId = ${storeId})` : sql14``}
            GROUP BY u.id, u.name, u.email, u.phone
            ORDER BY lastOrderAt DESC
            LIMIT 8
          `),
        db.execute(sql14`
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
        db.execute(sql14`
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
    dashboardSnapshot: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => {
      const storeId = await resolveStoreId(ctx.user, input?.storeId);
      return getAdminDashboardSnapshot(storeId);
    })
  }),
  menuSlides: router({
    uploadImage: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      base64: z11.string().max(43e5),
      // keep below Vercel request-size limits
      mimeType: z11.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z11.string().max(255).optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 85, 1920);
      const key = `stores/${storeId}/banners/slide-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] banner comprimido ${reductionPct}% \u2192 WebP`);
      return { url };
    }),
    list: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getMenuSlides(true, input?.storeId)),
    listAll: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => getMenuSlides(false, await resolveRequiredStoreId(ctx.user, input?.storeId))),
    seed: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).mutation(async ({ input, ctx }) => seedMenuSlides(await resolveRequiredStoreId(ctx.user, input?.storeId))),
    create: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      title: z11.string().min(1).max(200),
      subtitle: z11.string().max(300).optional().nullable(),
      imageUrl: z11.string().max(2e3).optional().nullable(),
      videoUrl: z11.string().max(2e3).optional().nullable(),
      badgeText: z11.string().max(80).optional().nullable(),
      ctaText: z11.string().max(80).optional().nullable(),
      ctaLink: z11.string().max(500).optional().nullable(),
      sortOrder: z11.number().int().optional()
    })).mutation(async ({ input, ctx }) => createMenuSlide({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) })),
    update: staffProcedure.input(z11.object({
      id: z11.number(),
      storeId: z11.number().optional(),
      title: z11.string().min(1).max(200).optional(),
      subtitle: z11.string().max(300).optional().nullable(),
      imageUrl: z11.string().max(2e3).optional().nullable(),
      videoUrl: z11.string().max(2e3).optional().nullable(),
      badgeText: z11.string().max(80).optional().nullable(),
      ctaText: z11.string().max(80).optional().nullable(),
      ctaLink: z11.string().max(500).optional().nullable(),
      sortOrder: z11.number().int().optional(),
      isActive: z11.boolean().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, storeId: requestedStoreId, ...data } = input;
      return updateMenuSlide(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await deleteMenuSlide(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    })
  }),
  // --- CARROSSEL HERO --------------------------------------------------------
  carousel: router({
    list: publicProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(({ input }) => getCarouselImages(true, input?.storeId)),
    listAll: staffProcedure.input(z11.object({ storeId: z11.number().optional() }).optional()).query(async ({ input, ctx }) => getCarouselImages(false, await resolveRequiredStoreId(ctx.user, input?.storeId))),
    uploadImage: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      base64: z11.string().max(43e5),
      // keep below Vercel request-size limits
      mimeType: z11.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      fileName: z11.string().max(255).optional()
    })).mutation(async ({ input, ctx }) => {
      const storeId = await resolveRequiredStoreId(ctx.user, input.storeId);
      const { storagePutAdapter: storagePut2 } = await Promise.resolve().then(() => (init_storage2(), storage_exports2));
      const { compressToWebP: compressToWebP2 } = await Promise.resolve().then(() => (init_imageUtils(), imageUtils_exports));
      const rawBuffer = Buffer.from(input.base64, "base64");
      const { buffer, mimeType, ext, reductionPct } = await compressToWebP2(rawBuffer, 85, 1920);
      const key = `stores/${storeId}/carousel/hero-${Date.now()}.${ext}`;
      const { url } = await storagePut2(key, buffer, mimeType);
      console.log(`[upload] carrossel comprimido ${reductionPct}% \u2192 WebP`);
      return { url };
    }),
    create: staffProcedure.input(z11.object({ storeId: z11.number().optional(), imageUrl: z11.string().min(1), title: z11.string().optional().nullable(), sortOrder: z11.number().optional() })).mutation(async ({ input, ctx }) => createCarouselImage({ ...input, storeId: await resolveRequiredStoreId(ctx.user, input.storeId) })),
    update: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional(), imageUrl: z11.string().optional(), title: z11.string().optional().nullable(), sortOrder: z11.number().optional(), active: z11.boolean().optional() })).mutation(async ({ input, ctx }) => {
      const { id, storeId: requestedStoreId, ...data } = input;
      return updateCarouselImage(id, await resolveRequiredStoreId(ctx.user, requestedStoreId), data);
    }),
    delete: staffProcedure.input(z11.object({ id: z11.number(), storeId: z11.number().optional() })).mutation(async ({ input, ctx }) => {
      await deleteCarouselImage(input.id, await resolveRequiredStoreId(ctx.user, input.storeId));
      return { ok: true };
    })
  }),
  // ─── RECOVERY DASHBOARD ─────────────────────────────────────────────────────────────
  recovery: router({
    /** KPIs gerais de recuperação de receita */
    stats: adminProcedure2.input(z11.object({
      period: z11.enum(["7d", "30d", "90d"]).default("30d")
    })).query(async ({ input }) => {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { sql: sql14 } = await import("drizzle-orm");
      const db = await getDb2();
      if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR" });
      const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
      const [cartStats] = await db.execute(sql14`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            ROUND(SUM(CASE WHEN status = 'recovered' THEN CAST(total AS DECIMAL(10,2)) ELSE 0 END), 2) AS recoveredRevenue
          FROM abandoned_carts
          WHERE createdAt >= ${since}
        `);
      const [reactivationStats] = await db.execute(sql14`
          SELECT
            COUNT(DISTINCT userId) AS totalInactive,
            SUM(CASE WHEN type = 'reactivation_15d' THEN 1 ELSE 0 END) AS sent15d,
            SUM(CASE WHEN type = 'reactivation_30d' THEN 1 ELSE 0 END) AS sent30d,
            SUM(CASE WHEN type = 'reactivation_60d' THEN 1 ELSE 0 END) AS sent60d
          FROM automation_events
          WHERE createdAt >= ${since} AND type LIKE 'reactivation_%' AND channel = 'whatsapp'
        `);
      const [conversionStats] = await db.execute(sql14`
          SELECT
            COUNT(*) AS totalConversions,
            ROUND(SUM(o.total), 2) AS conversionRevenue
          FROM automation_events ae
          JOIN orders o ON o.id = ae.orderId
          WHERE ae.createdAt >= ${since} AND ae.type = 'conversion'
        `);
      const [stepStats] = await db.execute(sql14`
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
    abandonedCarts: adminProcedure2.input(z11.object({
      status: z11.enum(["pending", "recovered", "expired"]).optional(),
      limit: z11.number().min(1).max(100).default(50)
    })).query(async ({ input }) => {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb2();
      if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR" });
      const { abandonedCarts: acTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const conditions = [];
      if (input.status) conditions.push(eqFn(acTable.status, input.status));
      const rows = await db.select().from(acTable).where(conditions.length > 0 ? andFn(...conditions) : void 0).orderBy(acTable.createdAt).limit(input.limit);
      return rows.map((r) => ({ ...r, items: JSON.parse(r.items) }));
    }),
    /** Lista de eventos de automação para auditoria */
    events: adminProcedure2.input(z11.object({
      type: z11.string().optional(),
      limit: z11.number().min(1).max(200).default(100)
    })).query(async ({ input }) => {
      const { getDb: getDb3 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb3();
      if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR" });
      const { automationEvents: aeTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const conditions = [];
      if (input.type) conditions.push(eqFn(aeTable.type, input.type));
      return db.select().from(aeTable).where(conditions.length > 0 ? andFn(...conditions) : void 0).orderBy(aeTable.createdAt).limit(input.limit);
    }),
    /** Disparo manual de reativação */
    triggerReactivation: adminProcedure2.mutation(async () => {
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
    dismiss: protectedProcedure.input(z11.object({ cartId: z11.number() })).mutation(async ({ ctx, input }) => {
      const { getDb: getDb4 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb4();
      if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR" });
      const { abandonedCarts: acTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      await db.update(acTable).set({ status: "expired" }).where(andFn(eqFn(acTable.id, input.cartId), eqFn(acTable.userId, ctx.user.id)));
      return { ok: true };
    }),
    /** Busca um carrinho pelo ID para restaurar no checkout */
    getById: protectedProcedure.input(z11.object({ cartId: z11.number() })).query(async ({ ctx, input }) => {
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
    list: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive() })).query(({ ctx, input }) => listClientAlerts(ctx.user.id, input.storeId)),
    // Conta alertas não lidos (para badge no nav)
    unreadCount: protectedProcedure.input(z11.object({ storeId: z11.number().int().positive() })).query(({ ctx, input }) => countUnreadClientAlerts(ctx.user.id, input.storeId)),
    // Marca alerta como lido
    dismiss: protectedProcedure.input(z11.object({ alertId: z11.number(), storeId: z11.number().int().positive() })).mutation(({ input, ctx }) => dismissClientAlert(input.alertId, ctx.user.id, input.storeId)),
    // Admin: criar alerta manual (novidades do clube, comunicados etc.)
    createManual: staffProcedure.input(z11.object({
      storeId: z11.number().optional(),
      type: z11.enum(["promotion", "raffle", "coupon", "club", "custom"]),
      title: z11.string().min(1),
      message: z11.string().min(1),
      icon: z11.string().optional(),
      url: z11.string().optional(),
      expiresAt: z11.date().optional()
    })).mutation(async ({ input, ctx }) => createClientAlert({
      ...input,
      storeId: await resolveRequiredStoreId(ctx.user, input.storeId)
    }))
  })
});

// server/_core/bootstrapRoute.ts
import { z as z12 } from "zod";

// server/bootstrapAccess.ts
init_schema();
init_db();
import bcrypt2 from "bcryptjs";
import crypto6 from "crypto";
import { eq as eq20 } from "drizzle-orm";
function buildDefaultPassword() {
  return `Bonatto@${crypto6.randomBytes(6).toString("hex")}!`;
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
  const existingAdmin = await db.select().from(users).where(eq20(users.email, adminEmail)).limit(1);
  const passwordHash = await bcrypt2.hash(adminPassword, 12);
  if (existingAdmin[0]) {
    await db.update(users).set({
      name: adminName,
      passwordHash,
      loginMethod: "email",
      role: "admin",
      emailVerified: true,
      lastSignedIn: /* @__PURE__ */ new Date()
    }).where(eq20(users.id, existingAdmin[0].id));
  } else {
    await db.insert(users).values({
      openId: `email_${crypto6.randomBytes(16).toString("hex")}`,
      name: adminName,
      email: adminEmail,
      passwordHash,
      loginMethod: "email",
      role: "admin",
      emailVerified: true,
      lastSignedIn: /* @__PURE__ */ new Date()
    });
  }
  const driverToken = crypto6.randomBytes(32).toString("hex");
  const existingDriver = await db.select().from(drivers).where(eq20(drivers.name, driverName)).limit(1);
  if (existingDriver[0]) {
    await db.update(drivers).set({
      name: driverName,
      phone: driverPhone,
      active: true,
      accessToken: driverToken
    }).where(eq20(drivers.id, existingDriver[0].id));
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
var bootstrapSchema = z12.object({
  adminEmail: z12.string().email().optional(),
  adminName: z12.string().min(2).max(120).optional(),
  adminPassword: z12.string().min(8).max(120).optional(),
  driverName: z12.string().min(2).max(120).optional(),
  driverPhone: z12.string().max(30).nullable().optional()
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
    "asaas.createPix",
    "auth.syncSocialAccount",
    "auth.disconnectSocialAccount",
    "auth.deleteAccount"
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
