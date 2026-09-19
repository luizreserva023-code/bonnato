import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { storeManagers, stores, tenantMemberships } from "../drizzle/schema.ts";
import { getDb } from "./db.ts";

/**
 * Resolve o storeId para uma procedure multi-loja.
 * - admin pode operar em tudo ou filtrar por uma loja especifica
 * - manager fica preso a loja associada
 */
export async function resolveStoreId(
  user: { id: number; role: string },
  requestedStoreId?: number,
): Promise<number | undefined> {
  if (user.role === "admin") {
    return requestedStoreId;
  }

  if (user.role === "manager") {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponivel" });
    }

    const directRows = await db
      .select({ storeId: storeManagers.storeId })
      .from(storeManagers)
      .where(eq(storeManagers.userId, user.id));

    const tenantRows = await db
      .select({ tenantKey: tenantMemberships.tenantKey })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.userId, user.id), eq(tenantMemberships.active, true)));

    const tenantStoreRows = tenantRows.length
      ? await db
          .select({ storeId: stores.id })
          .from(stores)
          .where(and(inArray(stores.tenantKey, tenantRows.map((row) => row.tenantKey)), eq(stores.active, true)))
      : [];

    const allowedStoreIds = Array.from(new Set([
      ...directRows.map((row) => row.storeId),
      ...tenantStoreRows.map((row) => row.storeId),
    ]));

    if (allowedStoreIds.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Gerente nao esta associado a nenhuma loja. Contate o administrador.",
      });
    }

    if (requestedStoreId !== undefined) {
      if (!allowedStoreIds.includes(requestedStoreId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Loja fora do seu acesso." });
      }
      return requestedStoreId;
    }

    return allowedStoreIds[0];
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
}

export async function resolveRequiredStoreId(
  user: { id: number; role: string },
  requestedStoreId?: number,
): Promise<number> {
  const storeId = await resolveStoreId(user, requestedStoreId);
  if (!storeId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione uma loja para concluir esta ação.",
    });
  }
  return storeId;
}

export async function assertStoreEntityAccess(
  user: { id: number; role: string },
  entityStoreId: number | null | undefined,
  requestedStoreId?: number,
): Promise<number | undefined> {
  if (user.role === "admin") {
    if (requestedStoreId !== undefined && entityStoreId !== requestedStoreId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Registro fora da loja selecionada." });
    }
    return requestedStoreId;
  }

  // Sem filtro explícito, valida a própria loja do registro contra todas as
  // unidades autorizadas para o gerente.
  const scopedStoreId = await resolveStoreId(user, requestedStoreId ?? entityStoreId ?? undefined);

  if (entityStoreId == null || entityStoreId !== scopedStoreId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Registro fora da sua loja." });
  }

  return scopedStoreId;
}
