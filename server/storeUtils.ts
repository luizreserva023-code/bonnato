/**
 * Utilitários para resolução de storeId em procedures multi-tenant.
 *
 * - Admin pode passar um storeId explícito (filtrar por loja) ou undefined (ver tudo).
 * - Manager sempre vê apenas a loja que gerencia (storeId resolvido do banco).
 */

import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { storeManagers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Resolve o storeId para uma procedure de staff (admin ou manager).
 *
 * @param user - Usuário autenticado (ctx.user)
 * @param requestedStoreId - storeId passado pelo frontend (apenas válido para admin)
 * @returns storeId a ser usado como filtro, ou undefined (admin sem filtro = ver tudo)
 */
export async function resolveStoreId(
  user: { id: number; role: string },
  requestedStoreId?: number
): Promise<number | undefined> {
  if (user.role === "admin") {
    // Admin pode ver tudo (undefined) ou filtrar por uma loja específica
    return requestedStoreId;
  }

  if (user.role === "manager") {
    // Manager sempre vê apenas a sua loja
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

    const [row] = await db
      .select({ storeId: storeManagers.storeId })
      .from(storeManagers)
      .where(eq(storeManagers.userId, user.id))
      .limit(1);

    if (!row) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Gerente não está associado a nenhuma loja. Contate o administrador.",
      });
    }

    return row.storeId;
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
}
