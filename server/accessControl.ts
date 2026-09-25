import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { stores, userStoreAccess } from "../drizzle/schema.ts";
import { getDb } from "./db.ts";
import {
  permissionsForRole,
  roleHasPermission,
  type StoreAccessRole,
  type StorePermission,
} from "../shared/permissions.ts";

type AccessRow = {
  storeId: number;
  role: StoreAccessRole;
  storeName: string;
  storeSlug: string;
  storeCity: string;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

export async function listActiveStaffAccess(userId: number): Promise<AccessRow[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      storeId: userStoreAccess.storeId,
      role: userStoreAccess.role,
      storeName: stores.name,
      storeSlug: stores.slug,
      storeCity: stores.city,
    })
    .from(userStoreAccess)
    .innerJoin(stores, eq(stores.id, userStoreAccess.storeId))
    .where(and(
      eq(userStoreAccess.userId, userId),
      eq(userStoreAccess.active, true),
      eq(stores.active, true),
    ));
  return rows as AccessRow[];
}

export async function hasActiveStaffAccess(userId: number) {
  return (await listActiveStaffAccess(userId)).length > 0;
}

export async function getAccessContext(user: { id: number; role: string }) {
  if (user.role === "admin") {
    return {
      isPlatformAdmin: true,
      isStaff: true,
      stores: [] as Array<AccessRow & { permissions: StorePermission[] }>,
      globalPermissions: permissionsForRole("admin"),
    };
  }

  const access = await listActiveStaffAccess(user.id);
  const normalized = access.map((row) => ({
    ...row,
    permissions: permissionsForRole(row.role),
  }));
  return {
    isPlatformAdmin: false,
    isStaff: user.role === "manager" || normalized.length > 0,
    stores: normalized,
    globalPermissions: user.role === "manager" ? permissionsForRole("manager") : [],
  };
}

export async function assertStorePermission(
  user: { id: number; role: string },
  permission: StorePermission,
  requestedStoreId?: number,
): Promise<{ storeId?: number; role: StoreAccessRole }> {
  if (user.role === "admin") return { storeId: requestedStoreId, role: "admin" };
  if (user.role === "manager") return { storeId: requestedStoreId, role: "manager" };

  const access = await listActiveStaffAccess(user.id);
  if (!access.length) throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui acesso administrativo." });

  const candidates = requestedStoreId
    ? access.filter((row) => row.storeId === requestedStoreId)
    : access;
  const allowed = candidates.find((row) => roleHasPermission(row.role, permission));
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão para esta ação." });
  }
  return { storeId: requestedStoreId ?? allowed.storeId, role: allowed.role };
}

function starts(path: string, values: string[]) {
  return values.some((value) => path === value || path.startsWith(`${value}.`));
}

export function permissionForStaffProcedure(
  path: string,
  type: "query" | "mutation" | "subscription",
): StorePermission | null {
  const mutation = type === "mutation";
  const lower = path.toLowerCase();

  if (starts(path, ["analytics"])) return "reports:view";
  if (starts(path, ["crm"])) return mutation ? "customers:edit" : "customers:view";

  if (starts(path, ["orders"])) {
    if (/assign.*driver|driver.*assign/i.test(path)) return "orders:assign_driver";
    if (/cancel/i.test(path)) return "orders:cancel";
    return mutation ? "orders:update" : "orders:view";
  }

  if (starts(path, ["products", "categories", "catalog", "menuSlides", "carousel", "siteStudio"])) {
    return mutation ? "catalog:edit" : "catalog:view";
  }

  if (starts(path, ["coupons", "promotions", "raffles", "upsells", "recovery", "automation", "automations"])) {
    return mutation ? "marketing:edit" : "marketing:view";
  }

  if (starts(path, ["notificationTemplates", "notifications", "clientAlerts"])) {
    return mutation ? "notifications:manage" : "notifications:view";
  }

  if (starts(path, ["delivery", "drivers"])) {
    return mutation ? "delivery:manage" : "delivery:view";
  }

  if (starts(path, ["payments", "stripe", "asaas"])) {
    return mutation ? "payments:manage" : "payments:view";
  }

  if (starts(path, ["restaurantNetwork"])) {
    return mutation ? "network:manage" : "network:view";
  }

  if (starts(path, ["marketplaces", "ifood"])) {
    return mutation ? "integrations:manage" : "integrations:view";
  }

  if (starts(path, ["settings"])) {
    return mutation ? "settings:edit" : "settings:view";
  }

  if (starts(path, ["operations"])) {
    if (lower.includes("staff") || lower.includes("team")) return mutation ? "staff:manage" : "staff:view";
    if (lower.includes("dining") || lower.includes("table") || lower.includes("session")) return mutation ? "dining:edit" : "dining:view";
    return mutation ? "inventory:edit" : "inventory:view";
  }

  // Unknown administrative route: deny specialized roles by default.
  return null;
}

export async function authorizeStaffProcedure(input: {
  user: { id: number; role: string };
  path: string;
  type: "query" | "mutation" | "subscription";
  rawInput: unknown;
}) {
  if (input.user.role === "admin" || input.user.role === "manager") return;

  const permission = permissionForStaffProcedure(input.path, input.type);
  if (!permission) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão para este recurso." });
  }

  const raw = input.rawInput && typeof input.rawInput === "object"
    ? input.rawInput as Record<string, unknown>
    : {};
  const candidate = Number(raw.storeId);
  const storeId = Number.isFinite(candidate) && candidate > 0 ? candidate : undefined;
  await assertStorePermission(input.user, permission, storeId);
}
