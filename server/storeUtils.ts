import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { stores, userStoreAccess } from "../drizzle/schema.ts";
import { getDb } from "./db.ts";

type StoreScopedUser = { id: number; role: string };

async function getAllowedStoreIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  }

  const rows = await db
    .select({ storeId: userStoreAccess.storeId })
    .from(userStoreAccess)
    .innerJoin(stores, eq(stores.id, userStoreAccess.storeId))
    .where(and(
      eq(userStoreAccess.userId, userId),
      eq(userStoreAccess.active, true),
      eq(stores.active, true),
    ));

  return Array.from(new Set(rows.map((row) => row.storeId)));
}

export async function resolveStoreId(
  user: StoreScopedUser,
  requestedStoreId?: number,
): Promise<number | undefined> {
  if (user.role === "admin") {
    if (requestedStoreId === undefined) return undefined;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, requestedStoreId), eq(stores.active, true)))
      .limit(1);
    if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
    return requestedStoreId;
  }

  const allowedStoreIds = await getAllowedStoreIds(user.id);
  if (allowedStoreIds.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem acesso a nenhuma unidade." });
  }

  if (requestedStoreId !== undefined) {
    if (!allowedStoreIds.includes(requestedStoreId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Loja fora do seu acesso." });
    }
    return requestedStoreId;
  }

  return allowedStoreIds[0];
}

export async function resolveRequiredStoreId(
  user: StoreScopedUser,
  requestedStoreId?: number,
): Promise<number> {
  const storeId = await resolveStoreId(user, requestedStoreId);
  if (!storeId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma loja para concluir esta ação." });
  }
  return storeId;
}

export async function assertStoreEntityAccess(
  user: StoreScopedUser,
  entityStoreId: number | null | undefined,
  requestedStoreId?: number,
): Promise<number> {
  if (entityStoreId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Registro sem unidade associada." });
  }

  const scopedStoreId = await resolveStoreId(user, requestedStoreId ?? entityStoreId);
  if (scopedStoreId !== entityStoreId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Registro fora da loja selecionada." });
  }

  return entityStoreId;
}
