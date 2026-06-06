/**
 * Router de Lojas (Unidades) — Multi-tenant
 * - stores.list: público — lista lojas ativas para seleção de cidade
 * - stores.getBySlug: público — detalhes de uma loja pelo slug
 * - stores.create: admin — criar nova unidade
 * - stores.update: admin — editar unidade
 * - stores.delete: admin — desativar unidade
 * - stores.addManager: admin — promover usuário a gerente de uma loja
 * - stores.removeManager: admin — remover gerente de uma loja
 * - stores.getManagers: admin — listar gerentes de uma loja
 * - stores.myStore: manager — retorna a loja do gerente logado
 */

import { z } from "zod";
import { adminProcedure, publicProcedure, staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stores, storeManagers, users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const storesRouter = router({
  // Lista lojas ativas (público — para seleção de cidade na Home)
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        city: stores.city,
        address: stores.address,
        phone: stores.phone,
        isDefault: stores.isDefault,
      })
      .from(stores)
      .where(eq(stores.active, true))
      .orderBy(desc(stores.isDefault), stores.city);
    return rows;
  }),

  // Detalhes de uma loja pelo slug (público)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [store] = await db
        .select()
        .from(stores)
        .where(and(eq(stores.slug, input.slug), eq(stores.active, true)))
        .limit(1);
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
      return store;
    }),

  // Lista todas as lojas para o admin (incluindo inativas)
  listAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(stores)
      .orderBy(desc(stores.isDefault), stores.city);
    return rows;
  }),

  // Criar nova loja
  create: adminProcedure
    .input(z.object({
      name: z.string().min(2).max(200),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
      city: z.string().min(2).max(100),
      address: z.string().max(500).optional(),
      phone: z.string().max(20).optional(),
      active: z.boolean().default(true),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Se isDefault, remover default das outras
      if (input.isDefault) {
        await db.update(stores).set({ isDefault: false });
      }
      const [result] = await db.insert(stores).values({
        name: input.name,
        slug: input.slug,
        city: input.city,
        address: input.address,
        phone: input.phone,
        active: input.active,
        isDefault: input.isDefault,
      });
      return { id: (result as any).insertId, ...input };
    }),

  // Editar loja
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).max(200).optional(),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
      city: z.string().min(2).max(100).optional(),
      address: z.string().max(500).optional(),
      phone: z.string().max(20).optional(),
      active: z.boolean().optional(),
      isDefault: z.boolean().optional(),
      // Dados fiscais para NFC-e
      cnpj: z.string().max(18).optional().nullable(),
      inscricaoEstadual: z.string().max(30).optional().nullable(),
      regimeTributario: z.number().int().min(1).max(3).optional().nullable(),
      csc: z.string().max(100).optional().nullable(),
      cscId: z.string().max(20).optional().nullable(),
      focusNfeToken: z.string().max(200).optional().nullable(),
      nfceEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      if (data.isDefault) {
        await db.update(stores).set({ isDefault: false });
      }
      await db.update(stores).set(data).where(eq(stores.id, id));
      return { success: true };
    }),

  // Desativar loja (soft delete)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(stores).set({ active: false }).where(eq(stores.id, input.id));
      return { success: true };
    }),

  // Adicionar gerente a uma loja
  addManager: adminProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verificar se usuário existe
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });

      // Promover para manager se ainda não for admin
      if (user.role === "user") {
        await db.update(users).set({ role: "manager" }).where(eq(users.id, input.userId));
      }

      // Inserir associação (ignorar se já existir)
      try {
        await db.insert(storeManagers).values({
          storeId: input.storeId,
          userId: input.userId,
        });
      } catch {
        // unique constraint — já é gerente desta loja
      }
      return { success: true };
    }),

  // Remover gerente de uma loja
  removeManager: adminProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(storeManagers).where(
        and(eq(storeManagers.storeId, input.storeId), eq(storeManagers.userId, input.userId))
      );
      // Verificar se ainda gerencia outras lojas; se não, rebaixar para user
      const remaining = await db
        .select()
        .from(storeManagers)
        .where(eq(storeManagers.userId, input.userId))
        .limit(1);
      if (remaining.length === 0) {
        await db.update(users).set({ role: "user" }).where(eq(users.id, input.userId));
      }
      return { success: true };
    }),

  // Listar gerentes de uma loja
  getManagers: adminProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: storeManagers.id,
          userId: storeManagers.userId,
          storeId: storeManagers.storeId,
          createdAt: storeManagers.createdAt,
          userName: users.name,
          userEmail: users.email,
          userPhone: users.phone,
          userRole: users.role,
        })
        .from(storeManagers)
        .innerJoin(users, eq(storeManagers.userId, users.id))
        .where(eq(storeManagers.storeId, input.storeId));
      return rows;
    }),

  // Buscar usuário por email (para adicionar como gerente)
  findUserByEmail: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      return user ?? null;
    }),

  // Retorna a loja do gerente logado (para managers)
  myStore: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null; // admin vê tudo, não tem "minha loja"
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        city: stores.city,
        address: stores.address,
        phone: stores.phone,
      })
      .from(storeManagers)
      .innerJoin(stores, eq(storeManagers.storeId, stores.id))
      .where(eq(storeManagers.userId, ctx.user.id))
      .limit(1);
    return row ?? null;
  }),
});
