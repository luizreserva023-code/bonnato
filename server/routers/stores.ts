import { z } from "zod";
import { adminProcedure, publicProcedure, staffProcedure, router } from "../_core/trpc.ts";
import { getDb } from "../db.ts";
import { stores, storeManagers, users, staffMembers, drivers, diningTables } from "../../drizzle/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const storesRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
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
  }),

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
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja nao encontrada" });
      return store;
    }),

  listAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(stores).orderBy(desc(stores.isDefault), stores.city);
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(2).max(200),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
      city: z.string().min(2).max(100),
      address: z.string().max(500).optional(),
      phone: z.string().max(20).optional(),
      active: z.boolean().default(true),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [store] = await db.select().from(stores).where(eq(stores.id, input.id)).limit(1);
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja nao encontrada" });
      if (store.isDefault) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Defina outra loja padrao antes de desativar esta unidade." });
      }
      await db.update(stores).set({ active: false }).where(eq(stores.id, input.id));
      await db.update(staffMembers).set({ active: false }).where(eq(staffMembers.storeId, input.id));
      await db.update(drivers).set({ active: false }).where(eq(drivers.storeId, input.id));
      await db.update(diningTables).set({ active: false, status: "free" }).where(eq(diningTables.storeId, input.id));
      return { success: true };
    }),

  addManager: adminProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario nao encontrado" });

      if (user.role === "user") {
        await db.update(users).set({ role: "manager" }).where(eq(users.id, input.userId));
      }

      try {
        await db.insert(storeManagers).values({
          storeId: input.storeId,
          userId: input.userId,
        });
      } catch {
        // ignore duplicate
      }
      return { success: true };
    }),

  removeManager: adminProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(storeManagers).where(and(eq(storeManagers.storeId, input.storeId), eq(storeManagers.userId, input.userId)));
      const remaining = await db.select().from(storeManagers).where(eq(storeManagers.userId, input.userId)).limit(1);
      if (remaining.length === 0) {
        await db.update(users).set({ role: "user" }).where(eq(users.id, input.userId));
      }
      return { success: true };
    }),

  getManagers: adminProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
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
    }),

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

  myStore: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null;
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
