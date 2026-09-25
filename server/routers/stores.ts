import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  diningTables,
  drivers,
  products,
  staffMembers,
  stores,
  storeTrackingSettings,
  userStoreAccess,
  users,
} from "../../drizzle/schema.ts";
import { adminProcedure, protectedProcedure, publicProcedure, staffProcedure, router } from "../_core/trpc.ts";
import { getAccessContext } from "../accessControl.ts";
import { getDb } from "../db.ts";
import { assertStoreEntityAccess } from "../storeUtils.ts";
import { withLocalTtlCache } from "../services/localTtlCache.ts";

const accessRoleSchema = z.enum(["admin", "manager", "cashier", "kitchen", "marketing", "finance", "viewer"]);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

export const storesRouter = router({
  list: publicProcedure.query(() => withLocalTtlCache(
    "public:stores:list",
    30_000,
    async () => {
      const db = await requireDb();
      const activeStores = await db
        .select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone, isDefault: stores.isDefault })
        .from(stores)
        .where(eq(stores.active, true))
        .orderBy(desc(stores.isDefault), stores.city);
      if (!activeStores.length) return [];
      const counts = await db
        .select({ storeId: products.storeId, count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(inArray(products.storeId, activeStores.map((store) => store.id)), eq(products.active, true)))
        .groupBy(products.storeId);
      const countByStore = new Map(counts.map((row) => [row.storeId, Number(row.count)]));
      return activeStores.map((store) => ({
        ...store,
        productCount: countByStore.get(store.id) ?? 0,
        hasCatalog: (countByStore.get(store.id) ?? 0) > 0,
      }));
    },
  )),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(2).max(100) }))
    .query(({ input }) => withLocalTtlCache(
      `public:stores:slug:${input.slug}`,
      30_000,
      async () => {
        const db = await requireDb();
        const [store] = await db.select().from(stores)
          .where(and(eq(stores.slug, input.slug), eq(stores.active, true))).limit(1);
        if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
        return store;
      },
    )),

  tracking: publicProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(({ input }) => withLocalTtlCache(
      `public:stores:tracking:${input.storeId}`,
      60_000,
      async () => {
        const db = await requireDb();
        const [settings] = await db
          .select({
            metaPixelEnabled: storeTrackingSettings.metaPixelEnabled,
            metaPixelId: storeTrackingSettings.metaPixelId,
            googleAnalyticsEnabled: storeTrackingSettings.googleAnalyticsEnabled,
            googleAnalyticsId: storeTrackingSettings.googleAnalyticsId,
            googleAdsEnabled: storeTrackingSettings.googleAdsEnabled,
            googleAdsId: storeTrackingSettings.googleAdsId,
            tiktokPixelEnabled: storeTrackingSettings.tiktokPixelEnabled,
            tiktokPixelId: storeTrackingSettings.tiktokPixelId,
          })
          .from(storeTrackingSettings)
          .where(eq(storeTrackingSettings.storeId, input.storeId))
          .limit(1);

        return settings ?? {
          metaPixelEnabled: false, metaPixelId: null,
          googleAnalyticsEnabled: false, googleAnalyticsId: null,
          googleAdsEnabled: false, googleAdsId: null,
          tiktokPixelEnabled: false, tiktokPixelId: null,
        };
      },
    )),

  updateTracking: adminProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      metaPixelEnabled: z.boolean().optional(),
      metaPixelId: z.string().trim().max(64).nullable().optional(),
      googleAnalyticsEnabled: z.boolean().optional(),
      googleAnalyticsId: z.string().trim().max(64).nullable().optional(),
      googleAdsEnabled: z.boolean().optional(),
      googleAdsId: z.string().trim().max(64).nullable().optional(),
      tiktokPixelEnabled: z.boolean().optional(),
      tiktokPixelId: z.string().trim().max(64).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { storeId, ...settings } = input;
      const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.id, storeId)).limit(1);
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });

      await db.insert(storeTrackingSettings)
        .values({ storeId, ...settings })
        .onConflictDoUpdate({
          target: storeTrackingSettings.storeId,
          set: { ...settings, updatedAt: new Date() },
        });
      return { success: true };
    }),

  listAll: adminProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(stores).orderBy(desc(stores.isDefault), stores.city);
  }),
  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(2).max(200).optional(),
      displayName: z.string().min(2).max(200).nullable().optional(),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
      city: z.string().min(2).max(100).optional(),
      address: z.string().max(500).nullable().optional(),
      phone: z.string().max(20).nullable().optional(),
      email: z.string().email().nullable().optional(),
      active: z.boolean().optional(),
      isDefault: z.boolean().optional(),
      cnpj: z.string().max(18).nullable().optional(),
      inscricaoEstadual: z.string().max(30).nullable().optional(),
      regimeTributario: z.number().int().min(1).max(3).nullable().optional(),
      csc: z.string().max(100).nullable().optional(),
      cscId: z.string().max(20).nullable().optional(),
      focusNfeToken: z.string().max(200).nullable().optional(),
      nfceEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...data } = input;
      const [existing] = await db.select({ id: stores.id }).from(stores).where(eq(stores.id, id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
      if (data.isDefault) await db.update(stores).set({ isDefault: false });
      await db.update(stores).set({ ...data, updatedAt: new Date() }).where(eq(stores.id, id));
      return { success: true };
    }),
  findUserByEmail: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
        .from(users).where(eq(users.email, input.email)).limit(1);
      return user ?? null;
    }),

  grantAccess: adminProcedure
    .input(z.object({ storeId: z.number().int().positive(), userId: z.number().int().positive(), role: accessRoleSchema }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const [[store], [user]] = await Promise.all([
        db.select({ id: stores.id }).from(stores).where(eq(stores.id, input.storeId)).limit(1),
        db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1),
      ]);
      if (!store || !user) throw new TRPCError({ code: "NOT_FOUND", message: "Loja ou usuário não encontrado." });
      await db.insert(userStoreAccess)
        .values({ storeId: input.storeId, userId: input.userId, role: input.role, active: true })
        .onConflictDoUpdate({
          target: [userStoreAccess.userId, userStoreAccess.storeId],
          set: { role: input.role, active: true, updatedAt: new Date() },
        });
      if (input.role === "manager" && user.role === "user") {
        await db.update(users).set({ role: "manager" }).where(eq(users.id, input.userId));
      }
      return { success: true };
    }),
  removeAccess: adminProcedure
    .input(z.object({ storeId: z.number().int().positive(), userId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(userStoreAccess).where(and(eq(userStoreAccess.storeId, input.storeId), eq(userStoreAccess.userId, input.userId)));
      return { success: true };
    }),

  getAccess: adminProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      return db.select({
        id: userStoreAccess.id, userId: userStoreAccess.userId, storeId: userStoreAccess.storeId,
        accessRole: userStoreAccess.role, active: userStoreAccess.active, createdAt: userStoreAccess.createdAt,
        userName: users.name, userEmail: users.email, userPhone: users.phone, userRole: users.role,
      }).from(userStoreAccess)
        .innerJoin(users, eq(userStoreAccess.userId, users.id))
        .where(and(eq(userStoreAccess.storeId, input.storeId), eq(userStoreAccess.active, true)));
    }),
  myAccessContext: protectedProcedure.query(async ({ ctx }) => getAccessContext(ctx.user)),

  myStores: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    if (ctx.user.role === "admin") {
      return db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone })
        .from(stores).where(eq(stores.active, true)).orderBy(desc(stores.isDefault), stores.city);
    }
    return db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone })
      .from(userStoreAccess).innerJoin(stores, eq(userStoreAccess.storeId, stores.id))
      .where(and(eq(userStoreAccess.userId, ctx.user.id), eq(userStoreAccess.active, true), eq(stores.active, true)))
      .orderBy(desc(stores.isDefault), stores.city);
  }),

  myStore: staffProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    if (ctx.user.role === "admin") {
      const [store] = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone })
        .from(stores).where(eq(stores.active, true)).orderBy(desc(stores.isDefault), stores.id).limit(1);
      return store ?? null;
    }
    const [store] = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone })
      .from(userStoreAccess).innerJoin(stores, eq(userStoreAccess.storeId, stores.id))
      .where(and(eq(userStoreAccess.userId, ctx.user.id), eq(userStoreAccess.active, true), eq(stores.active, true)))
      .orderBy(desc(stores.isDefault), stores.id).limit(1);
    return store ?? null;
  }),
  assertAccess: staffProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
      return { success: true };
    }),

  deactivateOperationalResources: adminProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.transaction(async (tx) => {
        await tx.update(staffMembers).set({ active: false }).where(eq(staffMembers.storeId, input.storeId));
        await tx.update(drivers).set({ active: false }).where(eq(drivers.storeId, input.storeId));
        await tx.update(diningTables).set({ active: false, status: "free" }).where(eq(diningTables.storeId, input.storeId));
      });
      return { success: true };
    }),
});