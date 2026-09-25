export const STORE_ACCESS_ROLES = ["admin", "manager", "cashier", "kitchen", "marketing", "finance", "viewer"] as const;
export type StoreAccessRole = (typeof STORE_ACCESS_ROLES)[number];

export const STORE_PERMISSIONS = [
  "dashboard:view",
  "orders:view", "orders:update", "orders:cancel", "orders:assign_driver",
  "catalog:view", "catalog:edit",
  "inventory:view", "inventory:edit",
  "staff:view", "staff:manage",
  "dining:view", "dining:edit",
  "marketing:view", "marketing:edit",
  "customers:view", "customers:edit",
  "reports:view", "reports:export",
  "delivery:view", "delivery:manage",
  "payments:view", "payments:manage",
  "settings:view", "settings:edit",
  "stores:manage",
  "network:view", "network:manage",
  "integrations:view", "integrations:manage",
  "notifications:view", "notifications:manage",
] as const;

export type StorePermission = (typeof STORE_PERMISSIONS)[number];

const ALL = [...STORE_PERMISSIONS] as StorePermission[];

export const ROLE_PERMISSIONS: Record<StoreAccessRole, readonly StorePermission[]> = {
  admin: ALL,
  manager: ALL.filter((permission) => permission !== "stores:manage"),
  cashier: [
    "dashboard:view",
    "orders:view", "orders:update",
    "customers:view",
    "dining:view", "dining:edit",
    "payments:view",
  ],
  kitchen: [
    "dashboard:view",
    "orders:view", "orders:update",
    "catalog:view",
    "inventory:view",
  ],
  marketing: [
    "dashboard:view",
    "catalog:view",
    "marketing:view", "marketing:edit",
    "customers:view",
    "reports:view", "reports:export",
    "notifications:view", "notifications:manage",
  ],
  finance: [
    "dashboard:view",
    "orders:view",
    "customers:view",
    "reports:view", "reports:export",
    "payments:view", "payments:manage",
    "network:view",
  ],
  viewer: [
    "dashboard:view",
    "orders:view",
    "catalog:view",
    "customers:view",
    "reports:view",
    "delivery:view",
  ],
};

export function permissionsForRole(role: StoreAccessRole): StorePermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(role: StoreAccessRole, permission: StorePermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
