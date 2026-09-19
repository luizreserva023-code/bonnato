export const WHITE_LABEL_ADMIN_TABS = [
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
  "platform",
] as const;

export const WHITE_LABEL_PAGE_KEYS = [
  "home",
  "menu",
  "checkout",
  "orders",
  "profile",
  "club",
  "tracking",
  "driver",
  "waiter",
] as const;

export type WhiteLabelAdminTab = (typeof WHITE_LABEL_ADMIN_TABS)[number];
export type WhiteLabelPageKey = (typeof WHITE_LABEL_PAGE_KEYS)[number];

export type WhiteLabelFeatureFlags = {
  adminTabs: Partial<Record<WhiteLabelAdminTab, boolean>>;
  crm: boolean;
  automations: boolean;
  notifications: boolean;
  deliveryZones: boolean;
  salesDashboard: boolean;
  waiterApp: boolean;
  driverApp: boolean;
  loyalty: boolean;
  club: boolean;
  inventory: boolean;
  diningRoom: boolean;
  marketplaces: boolean;
  auditTrail: boolean;
  healthPanel: boolean;
  globalSearch: boolean;
};

export type WhiteLabelProviderConfig = {
  auth: {
    google: boolean;
    apple: boolean;
    facebook: boolean;
    instagram: boolean;
  };
  maps: { provider: "openstreetmap" | "google" };
  push: { provider: "vapid" | "none"; enabled: boolean };
  email: { provider: "resend" | "smtp" | "none"; enabled: boolean };
  payments: { pix: boolean; card: boolean; cash: boolean; provider: "manual" | "stripe" | "asaas" };
  marketplaces: { ifood: boolean; aiqfome: boolean; rappi: boolean; deliveryMuch: boolean };
};

export type WhiteLabelPageConfig = Record<WhiteLabelPageKey, {
  enabled: boolean;
  title: string;
  description: string;
  heroImage: string;
}>;

export type WhiteLabelContactConfig = {
  supportEmail: string;
  supportPhone: string;
  whatsapp: string;
  instagram: string;
};

export type WhiteLabelRuntimeConfig = {
  storeId: number;
  storeSlug: string;
  tenantKey: string;
  status: "active" | "inactive" | "setup_pending";
  plan: "essential" | "pro" | "enterprise" | "custom";
  domain: string | null;
  subdomain: string | null;
  brand: {
    key: string;
    name: string;
    shortName: string;
    tagline: string;
    adminTitle: string;
    deliveryLabel: string;
    logos: { icon: string; wordmark: string; favicon: string; waiter: string };
    colors: { primary: string; primaryDark: string; accent: string; background: string; text: string };
  };
  features: WhiteLabelFeatureFlags;
  providers: WhiteLabelProviderConfig;
  pages: WhiteLabelPageConfig;
  contact: WhiteLabelContactConfig;
};

const allAdminTabs = Object.fromEntries(WHITE_LABEL_ADMIN_TABS.map((tab) => [tab, true])) as Record<WhiteLabelAdminTab, boolean>;

export const BONATTO_FEATURE_FLAGS: WhiteLabelFeatureFlags = {
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
  globalSearch: true,
};

export const ESSENTIAL_FEATURE_FLAGS: WhiteLabelFeatureFlags = {
  adminTabs: {
    dashboard: true,
    orders: true,
    menu: true,
    users: true,
    settings: true,
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
  globalSearch: false,
};

export const TENANT_LEGACY_FEATURES = [] as const;

export function enforceTenantSafeFeatures(features: WhiteLabelFeatureFlags): WhiteLabelFeatureFlags {
  return features;
}

export const DEFAULT_PROVIDER_CONFIG: WhiteLabelProviderConfig = {
  auth: { google: true, apple: false, facebook: false, instagram: false },
  maps: { provider: "openstreetmap" },
  push: { provider: "vapid", enabled: true },
  email: { provider: "none", enabled: false },
  payments: { pix: true, card: false, cash: true, provider: "manual" },
  marketplaces: { ifood: false, aiqfome: false, rappi: false, deliveryMuch: false },
};

export const DEFAULT_PAGE_CONFIG: WhiteLabelPageConfig = {
  home: { enabled: true, title: "Peça online", description: "Seu pedido favorito em poucos toques.", heroImage: "" },
  menu: { enabled: true, title: "Cardápio", description: "Escolha seus produtos e monte o pedido.", heroImage: "" },
  checkout: { enabled: true, title: "Finalizar pedido", description: "Confirme entrega e pagamento.", heroImage: "" },
  orders: { enabled: true, title: "Meus pedidos", description: "Acompanhe seus pedidos.", heroImage: "" },
  profile: { enabled: true, title: "Minha conta", description: "Dados, endereços e preferências.", heroImage: "" },
  club: { enabled: false, title: "Clube", description: "Benefícios para clientes recorrentes.", heroImage: "" },
  tracking: { enabled: true, title: "Rastrear pedido", description: "Acompanhe cada etapa da entrega.", heroImage: "" },
  driver: { enabled: true, title: "Entregas", description: "Operação dos entregadores.", heroImage: "" },
  waiter: { enabled: false, title: "Salão", description: "Atendimento de mesas e comandas.", heroImage: "" },
};

export const DEFAULT_CONTACT_CONFIG: WhiteLabelContactConfig = {
  supportEmail: "",
  supportPhone: "",
  whatsapp: "",
  instagram: "",
};

export function mergeWhiteLabelFeatures(value?: Partial<WhiteLabelFeatureFlags> | null, bonatto = false): WhiteLabelFeatureFlags {
  const base = bonatto ? BONATTO_FEATURE_FLAGS : ESSENTIAL_FEATURE_FLAGS;
  return {
    ...base,
    ...(value ?? {}),
    adminTabs: { ...base.adminTabs, ...(value?.adminTabs ?? {}) },
  };
}

export function mergeWhiteLabelProviders(value?: Partial<WhiteLabelProviderConfig> | null): WhiteLabelProviderConfig {
  return {
    ...DEFAULT_PROVIDER_CONFIG,
    ...(value ?? {}),
    auth: { ...DEFAULT_PROVIDER_CONFIG.auth, ...(value?.auth ?? {}) },
    maps: { ...DEFAULT_PROVIDER_CONFIG.maps, ...(value?.maps ?? {}) },
    push: { ...DEFAULT_PROVIDER_CONFIG.push, ...(value?.push ?? {}) },
    email: { ...DEFAULT_PROVIDER_CONFIG.email, ...(value?.email ?? {}) },
    payments: { ...DEFAULT_PROVIDER_CONFIG.payments, ...(value?.payments ?? {}) },
    marketplaces: { ...DEFAULT_PROVIDER_CONFIG.marketplaces, ...(value?.marketplaces ?? {}) },
  };
}

export function mergeWhiteLabelPages(value?: Partial<WhiteLabelPageConfig> | null): WhiteLabelPageConfig {
  const pages = { ...DEFAULT_PAGE_CONFIG };
  for (const key of WHITE_LABEL_PAGE_KEYS) {
    pages[key] = { ...DEFAULT_PAGE_CONFIG[key], ...(value?.[key] ?? {}) };
  }
  return pages;
}
