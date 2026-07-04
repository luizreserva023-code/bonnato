import { BRAND_ASSETS } from "@/lib/brand";
import type { AdminTabId } from "@/shared/admin/admin-tabs";

export type TenantFeatureFlags = {
  adminTabs: Partial<Record<AdminTabId, boolean>>;
  crm: boolean;
  automations: boolean;
  notifications: boolean;
  deliveryZones: boolean;
  salesDashboard: boolean;
  waiterApp: boolean;
  driverApp: boolean;
  auditTrail: boolean;
  healthPanel: boolean;
  globalSearch: boolean;
};

export type TenantBrandConfig = {
  key: string;
  name: string;
  shortName: string;
  tagline: string;
  adminTitle: string;
  deliveryLabel: string;
  logos: {
    icon: string;
    wordmark: string;
    waiter: string;
  };
  colors: {
    primary: string;
    primaryDark: string;
    accent: string;
  };
};

export type TenantProviderConfig = {
  auth: {
    google: boolean;
    apple: boolean;
    facebook: boolean;
    instagram: boolean;
  };
  maps: {
    provider: "google" | "openstreetmap";
    requiresKey: boolean;
  };
  push: {
    provider: "manus" | "vapid";
    requiresPublicKey: boolean;
  };
  email: {
    provider: "smtp" | "resend" | "none";
    enabled: boolean;
  };
};

export type TenantRuntimeConfig = {
  brand: TenantBrandConfig;
  features: TenantFeatureFlags;
  providers: TenantProviderConfig;
};

const BONATTO_FEATURES: TenantFeatureFlags = {
  adminTabs: {
    dashboard: true,
    orders: true,
    menu: true,
    inventory: true,
    staff: true,
    dining: true,
    coupons: true,
    reports: true,
    promotions: true,
    raffles: true,
    upsells: true,
    users: true,
    drivers: true,
    settings: true,
    stores: true,
    recovery: true,
  },
  crm: true,
  automations: true,
  notifications: true,
  deliveryZones: true,
  salesDashboard: true,
  waiterApp: true,
  driverApp: true,
  auditTrail: true,
  healthPanel: true,
  globalSearch: true,
};

const BONATTO_BRAND: TenantBrandConfig = {
  key: "bonatto",
  name: "Bonatto Pizza",
  shortName: "Bonatto",
  tagline: "Delivery premium com identidade propria",
  adminTitle: "Painel Bonatto",
  deliveryLabel: "Entrega em Mateus Leme",
  logos: {
    icon: BRAND_ASSETS.palmito,
    wordmark: BRAND_ASSETS.palmitoWordmark,
    waiter: BRAND_ASSETS.driverLogo,
  },
  colors: {
    primary: "#6E0D12",
    primaryDark: "#450709",
    accent: "#e05c5c",
  },
};

const BONATTO_PROVIDERS: TenantProviderConfig = {
  auth: {
    google: true,
    apple: true,
    facebook: true,
    instagram: true,
  },
  maps: {
    provider: "openstreetmap",
    requiresKey: false,
  },
  push: {
    provider: "vapid",
    requiresPublicKey: true,
  },
  email: {
    provider: "smtp",
    enabled: true,
  },
};

export const DEFAULT_TENANT_CONFIG: TenantRuntimeConfig = {
  brand: BONATTO_BRAND,
  features: BONATTO_FEATURES,
  providers: BONATTO_PROVIDERS,
};

const TENANT_CONFIGS: Record<string, TenantRuntimeConfig> = {
  bonatto: DEFAULT_TENANT_CONFIG,
};

export function normalizeTenantKey(value?: string | null) {
  if (!value) return DEFAULT_TENANT_CONFIG.brand.key;
  return value.trim().toLowerCase();
}

export function resolveTenantConfig(tenantKey?: string | null): TenantRuntimeConfig {
  return TENANT_CONFIGS[normalizeTenantKey(tenantKey)] ?? DEFAULT_TENANT_CONFIG;
}
