import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { storeSitePages, storeSitePageVersions, stores, userStoreAccess } from "../../drizzle/schema.ts";
import { DEFAULT_HOME_DOCUMENT, SITE_BLOCK_TYPES, SITE_PAGE_KEYS, parseSiteDocument } from "../../shared/siteBuilder.ts";
import { getDb } from "../db.ts";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.ts";

function parseStoredDocument(content: string) {
  try { return parseSiteDocument(JSON.parse(content)); } catch { return DEFAULT_HOME_DOCUMENT; }
}

const pageKeySchema = z.enum(SITE_PAGE_KEYS);
const styleSchema = z.object({
  background: z.string().max(40), color: z.string().max(40),
  spacing: z.enum(["compact", "normal", "wide"]), radius: z.enum(["none", "medium", "large"]),
});
const responsiveSettingSchema = z.object({ spacing: z.enum(["compact", "normal", "wide"]).optional(), hidden: z.boolean().optional() });
const themeSchema = z.object({
  primary: z.string().max(40), accent: z.string().max(40), dark: z.string().max(40),
  surface: z.string().max(40), text: z.string().max(40), headingFont: z.enum(["brand", "modern", "classic"]),
  bodyFont: z.enum(["brand", "modern", "friendly"]), buttonStyle: z.enum(["pill", "rounded", "square"]),
  contentWidth: z.enum(["compact", "standard", "wide"]),
});const documentSchema = z.object({
  schemaVersion: z.literal(1),
  theme: themeSchema,
  blocks: z.array(z.object({
    id: z.string().min(1).max(100), type: z.enum(SITE_BLOCK_TYPES), visible: z.boolean(),
    props: z.record(z.string(), z.union([z.string().max(4000), z.number(), z.boolean()])), style: styleSchema,
    responsive: z.object({ desktop: responsiveSettingSchema.optional(), tablet: responsiveSettingSchema.optional(), mobile: responsiveSettingSchema.optional() }).optional(),
  })).max(80),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

async function requireSiteAccess(user: { id: number; role: string }, storeId: number, write = false) {
  const db = await requireDb();
  const [store] = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.id, storeId), eq(stores.active, true))).limit(1);
  if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
  if (user.role === "admin") return store;
  const [access] = await db.select({ role: userStoreAccess.role }).from(userStoreAccess)
    .where(and(eq(userStoreAccess.storeId, storeId), eq(userStoreAccess.userId, user.id), eq(userStoreAccess.active, true))).limit(1);
  const canRead = access && ["admin", "manager", "marketing", "viewer"].includes(access.role);
  const canWrite = access && ["admin", "manager", "marketing"].includes(access.role);
  if (!(write ? canWrite : canRead)) throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem acesso ao Studio desta unidade." });
  return store;
}
async function ensurePage(storeId: number, pageKey: z.infer<typeof pageKeySchema>, userId: number) {
  const db = await requireDb();
  const [existing] = await db.select().from(storeSitePages)
    .where(and(eq(storeSitePages.storeId, storeId), eq(storeSitePages.pageKey, pageKey))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(storeSitePages).values({
    storeId, pageKey, title: pageKey === "home" ? "Página inicial" : pageKey,
    draftContent: JSON.stringify(DEFAULT_HOME_DOCUMENT), updatedByUserId: userId,
  }).returning();
  if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a página." });
  return created;
}

export const siteStudioRouter = router({
  mySites: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    if (ctx.user.role === "admin") {
      return db.select({ id: stores.id, name: stores.name, slug: stores.slug }).from(stores).where(eq(stores.active, true));
    }
    return db.select({ id: stores.id, name: stores.name, slug: stores.slug })
      .from(userStoreAccess).innerJoin(stores, eq(userStoreAccess.storeId, stores.id))
      .where(and(eq(userStoreAccess.userId, ctx.user.id), eq(userStoreAccess.active, true), eq(stores.active, true)));
  }),
  workspace: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema })).query(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId);
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const versions = await (await requireDb()).select().from(storeSitePageVersions)
      .where(eq(storeSitePageVersions.pageId, page.id)).orderBy(desc(storeSitePageVersions.versionNumber)).limit(30);
    return { ...page, draft: parseStoredDocument(page.draftContent), versions };
  }),

  published: publicProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema })).query(async ({ input }) => {
    const db = await requireDb();
    const [page] = await db.select().from(storeSitePages)
      .where(and(eq(storeSitePages.storeId, input.storeId), eq(storeSitePages.pageKey, input.pageKey))).limit(1);
    if (!page?.publishedVersionId) return null;
    const [version] = await db.select().from(storeSitePageVersions)
      .where(and(eq(storeSitePageVersions.id, page.publishedVersionId), eq(storeSitePageVersions.pageId, page.id))).limit(1);
    return version ? { pageId: page.id, versionId: version.id, document: parseStoredDocument(version.content) } : null;
  }),

  saveDraft: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema, title: z.string().min(1).max(160), document: documentSchema })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    await (await requireDb()).update(storeSitePages).set({ title: input.title, draftContent: JSON.stringify(input.document), updatedByUserId: ctx.user.id, updatedAt: new Date() }).where(eq(storeSitePages.id, page.id));
    return { ok: true, updatedAt: new Date() };
  }),
  publish: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema, note: z.string().max(240).optional() })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const db = await requireDb();
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const [maxRow] = await db.select({ value: sql<number>`COALESCE(MAX(${storeSitePageVersions.versionNumber}), 0)` })
      .from(storeSitePageVersions).where(eq(storeSitePageVersions.pageId, page.id));
    const versionNumber = Number(maxRow?.value ?? 0) + 1;
    const [version] = await db.insert(storeSitePageVersions).values({
      pageId: page.id, versionNumber, content: page.draftContent, note: input.note ?? null, createdByUserId: ctx.user.id,
    }).returning({ id: storeSitePageVersions.id });
    if (!version) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao publicar." });
    await db.update(storeSitePages).set({ publishedVersionId: version.id, updatedByUserId: ctx.user.id, updatedAt: new Date() }).where(eq(storeSitePages.id, page.id));
    return { ok: true, versionId: version.id, versionNumber };
  }),

  restore: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema, versionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const db = await requireDb();
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const [version] = await db.select().from(storeSitePageVersions)
      .where(and(eq(storeSitePageVersions.id, input.versionId), eq(storeSitePageVersions.pageId, page.id))).limit(1);
    if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "Versão não encontrada." });
    await db.update(storeSitePages).set({ draftContent: version.content, updatedByUserId: ctx.user.id, updatedAt: new Date() }).where(eq(storeSitePages.id, page.id));
    return { ok: true };
  }),
});