import { storeAuditLogs } from "../drizzle/schema.ts";
import { getDb } from "./db.ts";
import { getRequestContext } from "./_core/requestContext.ts";

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

export type StoreAuditInput = {
  storeId: number;
  actorUserId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordStoreAudit(input: StoreAuditInput) {
  const db = await getDb();
  if (!db) return false;
  const requestContext = getRequestContext();

  await db.insert(storeAuditLogs).values({
    storeId: input.storeId,
    actorUserId: input.actorUserId ?? null,
    action: input.action.slice(0, 120),
    resourceType: input.resourceType.slice(0, 80),
    resourceId: input.resourceId == null ? null : String(input.resourceId).slice(0, 96),
    requestId: (input.requestId ?? requestContext?.requestId)?.slice(0, 96) ?? null,
    ipAddress: (input.ipAddress ?? requestContext?.ipAddress)?.slice(0, 64) ?? null,
    metadata: input.metadata ? JSON.stringify(sanitizeAuditValue(input.metadata)) : null,
  });

  return true;
}
