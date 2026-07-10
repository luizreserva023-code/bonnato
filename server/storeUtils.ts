import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { storeManagers } from "../drizzle/schema.ts";
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

    const [row] = await db
      .select({ storeId: storeManagers.storeId })
      .from(storeManagers)
      .where(eq(storeManagers.userId, user.id))
      .limit(1);

    if (!row) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Gerente nao esta associado a nenhuma loja. Contate o administrador.",
      });
    }

    return row.storeId;
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
}

export async function assertStoreEntityAccess(
  user: { id: number; role: string },
  entityStoreId: number | null | undefined,
  requestedStoreId?: number,
): Promise<number | undefined> {
  const scopedStoreId = await resolveStoreId(user, requestedStoreId);

  if (user.role === "admin") {
    if (requestedStoreId !== undefined && entityStoreId !== requestedStoreId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Registro fora da loja selecionada." });
    }
    return scopedStoreId;
  }

  if (entityStoreId == null || entityStoreId !== scopedStoreId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Registro fora da sua loja." });
  }

  return scopedStoreId;
}
