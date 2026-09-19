import { z } from "zod";
import { adminProcedure, publicProcedure, staffProcedure, router } from "../_core/trpc.ts";
import { getDb } from "../db.ts";
import { stores, storeManagers, tenantMemberships, users, staffMembers, drivers, diningTables, products } from "../../drizzle/schema.ts";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { assertStoreEntityAccess } from "../storeUtils.ts";
import {
  createDefaultWhiteLabelConfig,
  getWhiteLabelRuntimeByStoreId,
  resolveWhiteLabelRuntime,
  saveWhiteLabelRuntime,
} from "../whiteLabel.ts";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal com 6 dígitos");
const assetUrlSchema = z.string().max(2048).refine(
  (value) => value === "" || value.startsWith("/") || /^https:\/\//i.test(value),
  "Use uma URL HTTPS ou um caminho interno",
);
const pageSchema = z.object({ enabled: z.boolean(), title: z.string().max(160), description: z.string().max(300), heroImage: assetUrlSchema });
const adminTabsSchema = z.object({
  dashboard: z.boolean().optional(), orders: z.boolean().optional(), menu: z.boolean().optional(), club: z.boolean().optional(),
  inventory: z.boolean().optional(), staff: z.boolean().optional(), dining: z.boolean().optional(),
  coupons: z.boolean().optional(), reports: z.boolean().optional(), network: z.boolean().optional(), distribution: z.boolean().optional(), promotions: z.boolean().optional(),
  raffles: z.boolean().optional(), upsells: z.boolean().optional(), users: z.boolean().optional(),
  drivers: z.boolean().optional(), marketplaces: z.boolean().optional(), payments: z.boolean().optional(), settings: z.boolean().optional(),
  stores: z.boolean().optional(), recovery: z.boolean().optional(),
});
const whiteLabelConfigSchema = z.object({
  storeId: z.number().int().positive(),
  status: z.enum(["active", "inactive", "setup_pending"]),
  plan: z.enum(["essential", "pro", "enterprise", "custom"]),
  domain: z.string().max(191).nullable(),
  subdomain: z.string().max(100).nullable(),
  brand: z.object({
    key: z.string().max(100),
    name: z.string().min(2).max(200),
    shortName: z.string().min(1).max(100),
    tagline: z.string().max(240),
    adminTitle: z.string().max(200),
    deliveryLabel: z.string().max(200),
    logos: z.object({ icon: assetUrlSchema, wordmark: assetUrlSchema, favicon: assetUrlSchema, waiter: assetUrlSchema }),
    colors: z.object({ primary: colorSchema, primaryDark: colorSchema, accent: colorSchema, background: colorSchema, text: colorSchema }),
  }),
  features: z.object({
    adminTabs: adminTabsSchema,
    crm: z.boolean(), automations: z.boolean(), notifications: z.boolean(), deliveryZones: z.boolean(),
    salesDashboard: z.boolean(), waiterApp: z.boolean(), driverApp: z.boolean(), loyalty: z.boolean(),
    club: z.boolean(), inventory: z.boolean(), diningRoom: z.boolean(), marketplaces: z.boolean(),
    auditTrail: z.boolean(), healthPanel: z.boolean(), globalSearch: z.boolean(),
  }),
  providers: z.object({
    auth: z.object({ google: z.boolean(), apple: z.boolean(), facebook: z.boolean(), instagram: z.boolean() }),
    maps: z.object({ provider: z.enum(["openstreetmap", "google"]) }),
    push: z.object({ provider: z.enum(["vapid", "none"]), enabled: z.boolean() }),
    email: z.object({ provider: z.enum(["resend", "smtp", "none"]), enabled: z.boolean() }),
    payments: z.object({ pix: z.boolean(), card: z.boolean(), cash: z.boolean(), provider: z.enum(["manual", "stripe", "asaas"]) }),
    marketplaces: z.object({ ifood: z.boolean(), aiqfome: z.boolean(), rappi: z.boolean(), deliveryMuch: z.boolean() }),
  }),
  pages: z.object({
    home: pageSchema, menu: pageSchema, checkout: pageSchema, orders: pageSchema, profile: pageSchema,
    club: pageSchema, tracking: pageSchema, driver: pageSchema, waiter: pageSchema,
  }),
  contact: z.object({ supportEmail: z.string().max(320), supportPhone: z.string().max(30), whatsapp: z.string().max(30), instagram: z.string().max(120) }),
});

export const storesRouter = router({
  list: publicProcedure
    .input(z.object({ host: z.string().max(255).optional(), slug: z.string().max(100).optional() }).optional())
    .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const resolved = await resolveWhiteLabelRuntime({ host: input?.host, slug: input?.slug });
    if (!resolved) return [];
    const tenantStores = await db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        city: stores.city,
        address: stores.address,
        phone: stores.phone,
        isDefault: stores.isDefault,
        tenantKey: stores.tenantKey,
      })
      .from(stores)
      .where(and(eq(stores.active, true), eq(stores.tenantKey, resolved.runtime.tenantKey)))
      .orderBy(desc(stores.isDefault), stores.city);
    const counts = tenantStores.length ? await db
      .select({ storeId: products.storeId, count: sql<number>`COUNT(*)` })
      .from(products)
      .where(and(inArray(products.storeId, tenantStores.map((store) => store.id)), eq(products.active, true)))
      .groupBy(products.storeId) : [];
    const countByStore = new Map(counts.map((row) => [row.storeId, Number(row.count)]));
    return tenantStores.map((store) => ({ ...store, productCount: countByStore.get(store.id) ?? 0, hasCatalog: (countByStore.get(store.id) ?? 0) > 0 }));
  }),

  resolveTenant: publicProcedure
    .input(z.object({ host: z.string().max(255).optional(), slug: z.string().max(100).optional() }).optional())
    .query(async ({ input }) => {
      const resolved = await resolveWhiteLabelRuntime({ host: input?.host, slug: input?.slug });
      if (!resolved) throw new TRPCError({ code: "NOT_FOUND", message: "Estabelecimento não encontrado" });
      return resolved;
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
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
      return store;
    }),

  listAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(stores).orderBy(desc(stores.isDefault), stores.city);
  }),

  create: adminProcedure
    .input(z.object({
      creationType: z.enum(["brand", "unit"]).default("brand"),
      name: z.string().min(2).max(200),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
      tenantKey: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
      city: z.string().min(2).max(100),
      address: z.string().max(500).optional(),
      phone: z.string().max(20).optional(),
      active: z.boolean().default(true),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantKey = input.creationType === "unit" ? input.tenantKey : input.slug;
      if (!tenantKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a marca da nova unidade." });
      }
      const tenantStores = await db.select({ id: stores.id }).from(stores).where(eq(stores.tenantKey, tenantKey)).limit(1);
      if (input.creationType === "unit" && tenantStores.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Marca não encontrada." });
      }
      if (input.creationType === "brand" && tenantStores.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Ja existe uma marca com este identificador." });
      }
      if (input.isDefault) {
        await db.update(stores).set({ isDefault: false }).where(eq(stores.tenantKey, tenantKey));
      }
      const [result] = await db.insert(stores).values({
        tenantKey,
        name: input.name,
        slug: input.slug,
        city: input.city,
        address: input.address,
        phone: input.phone,
        active: input.active,
        isDefault: input.isDefault,
      });
      const id = Number((result as unknown as { insertId: number }).insertId);
      const [createdStore] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
      if (createdStore) await createDefaultWhiteLabelConfig(createdStore);
      return { id, ...input, tenantKey };
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
        const [currentStore] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, id)).limit(1);
        if (!currentStore) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
        await db.update(stores).set({ isDefault: false }).where(eq(stores.tenantKey, currentStore.tenantKey));
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
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
      if (store.isDefault) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Defina outra loja padrão antes de desativar esta unidade." });
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
      scope: z.enum(["store", "tenant"]).default("store"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });

      if (user.role === "user") {
        await db.update(users).set({ role: "manager" }).where(eq(users.id, input.userId));
      }

      if (input.scope === "tenant") {
        const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
        if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
        await db.insert(tenantMemberships).values({
          tenantKey: store.tenantKey,
          userId: input.userId,
          role: "admin",
          active: true,
        }).onDuplicateKeyUpdate({ set: { role: "admin", active: true } });
      } else {
        await db.insert(storeManagers).values({
          storeId: input.storeId,
          userId: input.userId,
        }).onDuplicateKeyUpdate({ set: { storeId: input.storeId } });
      }
      return { success: true };
    }),

  removeManager: adminProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
      scope: z.enum(["store", "tenant"]).default("store"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.scope === "tenant") {
        const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
        if (store) {
          await db.delete(tenantMemberships).where(and(
            eq(tenantMemberships.tenantKey, store.tenantKey),
            eq(tenantMemberships.userId, input.userId),
          ));
        }
      } else {
        await db.delete(storeManagers).where(and(eq(storeManagers.storeId, input.storeId), eq(storeManagers.userId, input.userId)));
      }
      const [remainingStore, remainingTenant] = await Promise.all([
        db.select().from(storeManagers).where(eq(storeManagers.userId, input.userId)).limit(1),
        db.select().from(tenantMemberships).where(and(eq(tenantMemberships.userId, input.userId), eq(tenantMemberships.active, true))).limit(1),
      ]);
      if (remainingStore.length === 0 && remainingTenant.length === 0) {
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

  getTenantManagers: adminProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
      if (!store) return [];
      return db
        .select({
          id: tenantMemberships.id,
          userId: tenantMemberships.userId,
          tenantKey: tenantMemberships.tenantKey,
          membershipRole: tenantMemberships.role,
          createdAt: tenantMemberships.createdAt,
          userName: users.name,
          userEmail: users.email,
          userPhone: users.phone,
          userRole: users.role,
        })
        .from(tenantMemberships)
        .innerJoin(users, eq(tenantMemberships.userId, users.id))
        .where(and(eq(tenantMemberships.tenantKey, store.tenantKey), eq(tenantMemberships.active, true)));
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

  whiteLabelConfig: staffProcedure
    .input(z.object({ storeId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
      const config = await getWhiteLabelRuntimeByStoreId(input.storeId);
      if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
      return config;
    }),

  saveWhiteLabelConfig: staffProcedure
    .input(whiteLabelConfigSchema)
    .mutation(async ({ input, ctx }) => {
      await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
      try {
        if (ctx.isOwner) return await saveWhiteLabelRuntime(input);

        const current = await getWhiteLabelRuntimeByStoreId(input.storeId);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada" });
        return await saveWhiteLabelRuntime({
          ...input,
          status: current.status,
          plan: current.plan,
          domain: current.domain,
          subdomain: current.subdomain,
          features: current.features,
          providers: current.providers,
          brand: { ...input.brand, key: current.brand.key },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível salvar a configuração";
        if (/duplicate/i.test(message)) {
          throw new TRPCError({ code: "CONFLICT", message: "Domínio ou subdomínio já está em uso por outra loja." });
        }
        throw error;
      }
    }),

  uploadBrandAsset: staffProcedure
    .input(z.object({
      storeId: z.number().int().positive(),
      kind: z.enum(["logo", "wordmark", "favicon", "waiter"]),
      base64: z.string().max(4_300_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertStoreEntityAccess(ctx.user, input.storeId, input.storeId);
      const [{ storagePutAdapter: storagePut }, { compressToWebP }] = await Promise.all([
        import("../adapters/storage.ts"),
        import("../imageUtils.ts"),
      ]);
      const rawBuffer = Buffer.from(input.base64, "base64");
      const maxWidth = input.kind === "favicon" ? 512 : 1600;
      const { buffer, mimeType, ext } = await compressToWebP(rawBuffer, 86, maxWidth);
      const key = `stores/${input.storeId}/brand/${input.kind}-${Date.now()}.${ext}`;
      return storagePut(key, buffer, mimeType);
    }),

  myStores: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null;
    const db = await getDb();
    if (!db) return [];
    const directRows = await db
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
      .where(and(eq(storeManagers.userId, ctx.user.id), eq(stores.active, true)));
    const memberships = await db
      .select({ tenantKey: tenantMemberships.tenantKey })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.userId, ctx.user.id), eq(tenantMemberships.active, true)));
    const tenantRows = memberships.length
      ? await db
          .select({
            id: stores.id,
            name: stores.name,
            slug: stores.slug,
            city: stores.city,
            address: stores.address,
            phone: stores.phone,
          })
          .from(stores)
          .where(and(inArray(stores.tenantKey, memberships.map((row) => row.tenantKey)), eq(stores.active, true)))
      : [];
    return Array.from(new Map([...directRows, ...tenantRows].map((store) => [store.id, store])).values());
  }),

  myStore: staffProcedure.query(async ({ ctx }) => {
    if (ctx.isOwner) return null;
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone })
      .from(storeManagers)
      .innerJoin(stores, eq(storeManagers.storeId, stores.id))
      .where(eq(storeManagers.userId, ctx.user.id))
      .limit(1);
    if (row) return row;
    const [membership] = await db.select({ tenantKey: tenantMemberships.tenantKey }).from(tenantMemberships)
      .where(and(eq(tenantMemberships.userId, ctx.user.id), eq(tenantMemberships.active, true))).limit(1);
    if (!membership) return null;
    const [tenantStore] = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, address: stores.address, phone: stores.phone })
      .from(stores).where(and(eq(stores.tenantKey, membership.tenantKey), eq(stores.active, true)))
      .orderBy(desc(stores.isDefault), stores.id).limit(1);
    return tenantStore ?? null;
  }),
});
