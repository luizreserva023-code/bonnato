import { eq } from "drizzle-orm";

import { stores, tenantAuditLogs, tenants } from "../drizzle/schema.ts";
import { getDb } from "./db.ts";

const SENSITIVE_KEY = /password|secret|token|credential|authorization|cookie|api[-_]?key/i;

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeAuditValue(item, depth + 1)]),
  );
}

export type TenantAuditInput = {
  tenantId?: number;
  storeId?: number;
  actorUserId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordTenantAudit(input: TenantAuditInput) {
  const db = await getDb();
  if (!db) return false;

  let tenantId = input.tenantId;
  if (!tenantId && input.storeId) {
    const [store] = await db
      .select({ tenantKey: stores.tenantKey })
      .from(stores)
      .where(eq(stores.id, input.storeId))
      .limit(1);
    if (store) {
      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.tenantKey, store.tenantKey))
        .limit(1);
      tenantId = tenant?.id;
    }
  }

  // Legacy Bonatto stores may predate the tenants table. Auditing must not make
  // an otherwise valid operational action fail while those rows are migrated.
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
    metadata: input.metadata ? JSON.stringify(sanitizeAuditValue(input.metadata)) : null,
  });
  return true;
}
