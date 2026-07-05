export const ADMIN_TABS = [
  "dashboard",
  "orders",
  "menu",
  "inventory",
  "staff",
  "dining",
  "coupons",
  "reports",
  "promotions",
  "raffles",
  "upsells",
  "users",
  "drivers",
  "marketplaces",
  "settings",
  "stores",
  "recovery",
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number];

const MANAGER_BLOCKED_TABS = new Set<AdminTabId>(["stores"]);

export function isKnownAdminTab(value: string | null | undefined): value is AdminTabId {
  return Boolean(value && ADMIN_TABS.includes(value as AdminTabId));
}

export function canAccessAdminTab(tab: AdminTabId, isAdmin: boolean) {
  return isAdmin || !MANAGER_BLOCKED_TABS.has(tab);
}

export function resolveAdminTab(rawTab: string | null | undefined, isAdmin: boolean, fallback: AdminTabId = "dashboard"): AdminTabId {
  if (!isKnownAdminTab(rawTab)) return fallback;
  return canAccessAdminTab(rawTab, isAdmin) ? rawTab : fallback;
}
