export const BONATTO_ADMIN_TABS = [
  "dashboard", "orders", "menu", "club", "inventory", "staff", "dining", "coupons",
  "reviews", "reports", "network", "distribution", "promotions", "raffles", "upsells", "users",
  "drivers", "whatsapp", "marketplaces", "payments", "settings", "stores", "recovery", "growth",
] as const;

export const BONATTO_PAGE_KEYS = ["home", "menu", "checkout", "orders", "profile", "club", "tracking", "driver", "waiter"] as const;

export type BonattoAdminTab = (typeof BONATTO_ADMIN_TABS)[number];
export type BonattoPageKey = (typeof BONATTO_PAGE_KEYS)[number];

export type BonattoFeatureFlags = {
  adminTabs: Partial<Record<BonattoAdminTab, boolean>>;
  crm: boolean; automations: boolean; notifications: boolean; deliveryZones: boolean;
  salesDashboard: boolean; waiterApp: boolean; driverApp: boolean; loyalty: boolean;
  club: boolean; inventory: boolean; diningRoom: boolean; marketplaces: boolean;
  auditTrail: boolean; healthPanel: boolean; globalSearch: boolean;
};

export type BonattoProviderConfig = {
  auth: { google: boolean; apple: boolean; facebook: boolean; instagram: boolean };
  maps: { provider: "openstreetmap" | "google" };
  push: { provider: "vapid" | "none"; enabled: boolean };
  email: { provider: "resend" | "smtp" | "none"; enabled: boolean };
  payments: { pix: boolean; card: boolean; cash: boolean; provider: "manual" | "stripe" | "asaas" };
  marketplaces: { ifood: boolean; aiqfome: boolean; rappi: boolean; deliveryMuch: boolean };
};
export type BonattoPageConfig = Record<BonattoPageKey, { enabled: boolean; title: string; description: string; heroImage: string }>;
export type BonattoContactConfig = { supportEmail: string; supportPhone: string; whatsapp: string; instagram: string };

export type BonattoRuntimeConfig = {
  brand: {
    key: "bonatto"; name: string; shortName: string; tagline: string; adminTitle: string; deliveryLabel: string;
    logos: { icon: string; wordmark: string; favicon: string; waiter: string };
    colors: { primary: string; primaryDark: string; accent: string; background: string; text: string };
  };
  features: BonattoFeatureFlags;
  providers: BonattoProviderConfig;
  pages: BonattoPageConfig;
  contact: BonattoContactConfig;
};

const allAdminTabs = Object.fromEntries(BONATTO_ADMIN_TABS.map((tab) => [tab, true])) as Record<BonattoAdminTab, boolean>;

export const BONATTO_FEATURE_FLAGS: BonattoFeatureFlags = {
  adminTabs: allAdminTabs, crm: true, automations: true, notifications: true, deliveryZones: true,
  salesDashboard: true, waiterApp: true, driverApp: true, loyalty: true, club: true, inventory: true,
  diningRoom: true, marketplaces: true, auditTrail: true, healthPanel: true, globalSearch: true,
};
export const BONATTO_PROVIDER_CONFIG: BonattoProviderConfig = {
  auth: { google: true, apple: false, facebook: false, instagram: false },
  maps: { provider: "openstreetmap" },
  push: { provider: "vapid", enabled: true },
  email: { provider: "none", enabled: false },
  payments: { pix: true, card: true, cash: true, provider: "manual" },
  marketplaces: { ifood: true, aiqfome: false, rappi: false, deliveryMuch: false },
};

export const BONATTO_PAGE_CONFIG: BonattoPageConfig = {
  home: { enabled: true, title: "Peça online", description: "Seu pedido favorito em poucos toques.", heroImage: "" },
  menu: { enabled: true, title: "Cardápio", description: "Escolha seus produtos e monte o pedido.", heroImage: "" },
  checkout: { enabled: true, title: "Finalizar pedido", description: "Confirme entrega e pagamento.", heroImage: "" },
  orders: { enabled: true, title: "Meus pedidos", description: "Acompanhe seus pedidos.", heroImage: "" },
  profile: { enabled: true, title: "Minha conta", description: "Dados, endereços e preferências.", heroImage: "" },
  club: { enabled: true, title: "Clube", description: "Benefícios para clientes recorrentes.", heroImage: "" },
  tracking: { enabled: true, title: "Rastrear pedido", description: "Acompanhe cada etapa da entrega.", heroImage: "" },
  driver: { enabled: true, title: "Entregas", description: "Operação dos entregadores.", heroImage: "" },
  waiter: { enabled: true, title: "Salão", description: "Atendimento de mesas e comandas.", heroImage: "" },
};

export const BONATTO_CONTACT_CONFIG: BonattoContactConfig = { supportEmail: "", supportPhone: "", whatsapp: "", instagram: "" };