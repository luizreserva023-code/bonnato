import { and, desc, eq, or } from "drizzle-orm";
import { storeWhiteLabelConfigs, stores, tenantDomains, tenants, type Store, type StoreWhiteLabelConfig } from "../drizzle/schema.ts";
import {
  BONATTO_FEATURE_FLAGS,
  DEFAULT_CONTACT_CONFIG,
  DEFAULT_PAGE_CONFIG,
  DEFAULT_PROVIDER_CONFIG,
  ESSENTIAL_FEATURE_FLAGS,
  enforceTenantSafeFeatures,
  mergeWhiteLabelFeatures,
  mergeWhiteLabelPages,
  mergeWhiteLabelProviders,
  type WhiteLabelContactConfig,
  type WhiteLabelFeatureFlags,
  type WhiteLabelPageConfig,
  type WhiteLabelProviderConfig,
  type WhiteLabelRuntimeConfig,
} from "../shared/whiteLabel.ts";
import { getDb } from "./db.ts";

const BONATTO_LOGOS = {
  icon: "/brand/palmito-2-circular.png",
  wordmark: "/brand/palmito-logo-tipografica.png",
  favicon: "/favicon.ico",
  waiter: "/brand/bonatto-logo-driver.jpg",
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeWhiteLabelDomain(value?: string | null) {
  if (!value) return null;
  const withoutProtocol = value.trim().toLowerCase().replace(/^https?:\/\//, "");
  const host = withoutProtocol.split("/")[0]?.split(":")[0]?.replace(/^www\./, "") ?? "";
  return host || null;
}

export function normalizeWhiteLabelSubdomain(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  return normalized || null;
}

function runtimeFromRows(store: Store, config?: StoreWhiteLabelConfig | null): WhiteLabelRuntimeConfig {
  const isBonatto = store.tenantKey === "bonatto";
  const fallbackFeatures = isBonatto ? BONATTO_FEATURE_FLAGS : ESSENTIAL_FEATURE_FLAGS;
  const storedFeatures = parseJson<Partial<WhiteLabelFeatureFlags>>(config?.featureFlags, {});
  const storedProviders = parseJson<Partial<WhiteLabelProviderConfig>>(config?.providerConfig, {});
  const storedPages = parseJson<Partial<WhiteLabelPageConfig>>(config?.pageConfig, {});
  const storedContact = parseJson<Partial<WhiteLabelContactConfig>>(config?.contactConfig, {});

  return {
    storeId: store.id,
    storeSlug: store.slug,
    tenantKey: store.tenantKey,
    status: config?.status ?? (isBonatto ? (store.active ? "active" : "inactive") : "setup_pending"),
    plan: config?.plan ?? (isBonatto ? "enterprise" : "essential"),
    domain: config?.domain ?? null,
    subdomain: config?.subdomain ?? null,
    brand: {
      key: store.tenantKey,
      name: config?.brandName ?? store.displayName ?? store.name,
      shortName: config?.shortName ?? store.displayName ?? store.name,
      tagline: config?.tagline ?? (isBonatto ? "Delivery premium com identidade própria" : "Seu delivery, do seu jeito"),
      adminTitle: config?.adminTitle ?? `Painel ${store.displayName ?? store.name}`,
      deliveryLabel: config?.deliveryLabel ?? `Entrega em ${store.city}`,
      logos: {
        icon: config?.logoUrl ?? (isBonatto ? BONATTO_LOGOS.icon : ""),
        wordmark: config?.wordmarkUrl ?? (isBonatto ? BONATTO_LOGOS.wordmark : ""),
        favicon: config?.faviconUrl ?? (isBonatto ? BONATTO_LOGOS.favicon : ""),
        waiter: config?.waiterLogoUrl ?? config?.logoUrl ?? (isBonatto ? BONATTO_LOGOS.waiter : ""),
      },
      colors: {
        primary: config?.primaryColor ?? "#6E0D12",
        primaryDark: config?.primaryDarkColor ?? "#450709",
        accent: config?.accentColor ?? "#e05c5c",
        background: config?.backgroundColor ?? "#fffaf8",
        text: config?.textColor ?? "#211719",
      },
    },
    features: isBonatto
      ? mergeWhiteLabelFeatures({ ...fallbackFeatures, ...storedFeatures }, true)
      : enforceTenantSafeFeatures(mergeWhiteLabelFeatures({ ...fallbackFeatures, ...storedFeatures }, false)),
    providers: mergeWhiteLabelProviders({ ...DEFAULT_PROVIDER_CONFIG, ...storedProviders }),
    pages: mergeWhiteLabelPages({ ...DEFAULT_PAGE_CONFIG, ...storedPages }),
    contact: { ...DEFAULT_CONTACT_CONFIG, ...storedContact },
  };
}

type WhiteLabelDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function getTenantRootStore(db: WhiteLabelDb, store: Store) {
  const [configuredRoot] = await db
    .select({ store: stores })
    .from(stores)
    .innerJoin(storeWhiteLabelConfigs, eq(storeWhiteLabelConfigs.storeId, stores.id))
    .where(eq(stores.tenantKey, store.tenantKey))
    .orderBy(stores.id)
    .limit(1);
  if (configuredRoot) return configuredRoot.store;

  const [root] = await db
    .select()
    .from(stores)
    .where(eq(stores.tenantKey, store.tenantKey))
    .orderBy(desc(stores.isDefault), stores.id)
    .limit(1);
  return root ?? store;
}

async function getConfigForStore(db: WhiteLabelDb, storeId: number) {
  const [config] = await db
    .select()
    .from(storeWhiteLabelConfigs)
    .where(eq(storeWhiteLabelConfigs.storeId, storeId))
    .limit(1);
  return config ?? null;
}

export async function getWhiteLabelRuntimeByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return null;
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return null;
  const tenantRoot = await getTenantRootStore(db, store);
  return runtimeFromRows(tenantRoot, await getConfigForStore(db, tenantRoot.id));
}

export async function resolveWhiteLabelRuntime(input: { host?: string | null; slug?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const host = normalizeWhiteLabelDomain(input.host);
  const slug = input.slug?.trim().toLowerCase() || null;
  const subdomain = host?.split(".")[0] ?? null;

  let matchedBy: "slug" | "domain" | "subdomain" | "default" = "default";
  let store: Store | undefined;
  let config: StoreWhiteLabelConfig | null = null;

  if (slug) {
    [store] = await db.select().from(stores).where(and(eq(stores.slug, slug), eq(stores.active, true))).limit(1);
    if (store) {
      store = await getTenantRootStore(db, store);
      config = await getConfigForStore(db, store.id);
      if ((store.tenantKey !== "bonatto" && !config) || (config && config.status !== "active")) {
        store = undefined;
        config = null;
      } else {
        matchedBy = "slug";
      }
    }
  }

  if (!store && host && host !== "localhost" && host !== "127.0.0.1") {
    const [tenantDomain] = await db
      .select({ store: stores, config: storeWhiteLabelConfigs })
      .from(tenantDomains)
      .innerJoin(tenants, eq(tenants.id, tenantDomains.tenantId))
      .innerJoin(stores, eq(stores.tenantKey, tenants.tenantKey))
      .leftJoin(storeWhiteLabelConfigs, eq(storeWhiteLabelConfigs.storeId, stores.id))
      .where(and(
        eq(tenantDomains.hostname, host),
        eq(tenantDomains.status, "active"),
        eq(tenants.status, "active"),
        eq(stores.active, true),
      ))
      .orderBy(desc(stores.isDefault), stores.id)
      .limit(1);
    if (tenantDomain) {
      store = tenantDomain.store;
      config = tenantDomain.config;
      matchedBy = "domain";
    }
  }

  if (!store && host && host !== "localhost" && host !== "127.0.0.1") {
    const [row] = await db
      .select({ store: stores, config: storeWhiteLabelConfigs })
      .from(storeWhiteLabelConfigs)
      .innerJoin(stores, eq(storeWhiteLabelConfigs.storeId, stores.id))
      .where(and(
        eq(stores.active, true),
        eq(storeWhiteLabelConfigs.status, "active"),
        or(
          eq(storeWhiteLabelConfigs.domain, host),
          subdomain ? eq(storeWhiteLabelConfigs.subdomain, subdomain) : eq(storeWhiteLabelConfigs.subdomain, ""),
        ),
      ))
      .limit(1);
    if (row) {
      store = row.store;
      config = row.config;
      matchedBy = row.config.domain === host ? "domain" : "subdomain";
    }
  }

  if (!store) {
    [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.active, true))
      .orderBy(desc(stores.isDefault), stores.id)
      .limit(1);
  }
  if (!store) return null;
  store = await getTenantRootStore(db, store);
  if (!config) config = await getConfigForStore(db, store.id);

  return { matchedBy, runtime: runtimeFromRows(store, config) };
}

export type SaveWhiteLabelInput = Omit<WhiteLabelRuntimeConfig, "storeSlug" | "tenantKey">;

export async function saveWhiteLabelRuntime(input: SaveWhiteLabelInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [store] = await db.select().from(stores).where(eq(stores.id, input.storeId)).limit(1);
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
    contactConfig: JSON.stringify(input.contact),
  } as const;

  await db.insert(storeWhiteLabelConfigs).values(values).onDuplicateKeyUpdate({ set: values });
  return getWhiteLabelRuntimeByStoreId(store.id);
}

export async function createDefaultWhiteLabelConfig(store: Store) {
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
