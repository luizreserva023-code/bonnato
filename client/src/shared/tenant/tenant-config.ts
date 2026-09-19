import { BRAND_ASSETS } from "@/lib/brand";
import {
  BONATTO_FEATURE_FLAGS,
  DEFAULT_CONTACT_CONFIG,
  DEFAULT_PAGE_CONFIG,
  DEFAULT_PROVIDER_CONFIG,
  type WhiteLabelFeatureFlags,
  type WhiteLabelProviderConfig,
  type WhiteLabelRuntimeConfig,
} from "@shared/whiteLabel";

export type TenantFeatureFlags = WhiteLabelFeatureFlags;
export type TenantBrandConfig = WhiteLabelRuntimeConfig["brand"];
export type TenantProviderConfig = WhiteLabelProviderConfig;
export type TenantRuntimeConfig = WhiteLabelRuntimeConfig;

export const BONATTO_HEADER_COLOR = "#DA1923";

export function resolveTenantHeaderColor(config: TenantRuntimeConfig) {
  const tenantKeys = [config.tenantKey, config.storeSlug, config.brand.key]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return tenantKeys.includes("bonatto") ? BONATTO_HEADER_COLOR : config.brand.colors.primary;
}

export const DEFAULT_TENANT_CONFIG: TenantRuntimeConfig = {
  storeId: 0,
  storeSlug: "bonatto",
  tenantKey: "bonatto",
  status: "active",
  plan: "enterprise",
  domain: null,
  subdomain: null,
  brand: {
    key: "bonatto",
    name: "Bonatto Pizza",
    shortName: "Bonatto",
    tagline: "Delivery premium com identidade própria",
    adminTitle: "Painel Bonatto",
    deliveryLabel: "Entrega em Mateus Leme",
    logos: {
      icon: BRAND_ASSETS.palmito,
      wordmark: BRAND_ASSETS.palmitoWordmark,
      favicon: "/favicon.ico",
      waiter: BRAND_ASSETS.driverLogo,
    },
    colors: {
      primary: "#6E0D12",
      primaryDark: "#450709",
      accent: "#e05c5c",
      background: "#fffaf8",
      text: "#211719",
    },
  },
  features: BONATTO_FEATURE_FLAGS,
  providers: DEFAULT_PROVIDER_CONFIG,
  pages: DEFAULT_PAGE_CONFIG,
  contact: DEFAULT_CONTACT_CONFIG,
};

export function normalizeTenantKey(value?: string | null) {
  return value?.trim().toLowerCase() || DEFAULT_TENANT_CONFIG.brand.key;
}

export function resolveTenantConfig() {
  return DEFAULT_TENANT_CONFIG;
}
