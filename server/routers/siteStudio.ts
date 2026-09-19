import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { stores, storeManagers, tenantMemberships, tenantSitePages, tenantSitePageVersions, users } from "../../drizzle/schema.ts";
import { DEFAULT_HOME_DOCUMENT, SITE_BLOCK_TYPES, SITE_PAGE_KEYS, parseSiteDocument } from "../../shared/siteBuilder.ts";
import { getDb } from "../db.ts";
import { recordTenantAudit } from "../tenantAudit.ts";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc.ts";

function parseStoredDocument(content: string) {
  try {
    return parseSiteDocument(JSON.parse(content));
  } catch {
    return DEFAULT_HOME_DOCUMENT;
  }
}

const pageKeySchema = z.enum(SITE_PAGE_KEYS);
const styleSchema = z.object({
  background: z.string().max(40), color: z.string().max(40),
  spacing: z.enum(["compact", "normal", "wide"]), radius: z.enum(["none", "medium", "large"]),
});
const responsiveSettingSchema = z.object({
  spacing: z.enum(["compact", "normal", "wide"]).optional(),
  hidden: z.boolean().optional(),
});
const themeSchema = z.object({
  primary: z.string().max(40), accent: z.string().max(40), dark: z.string().max(40),
  surface: z.string().max(40), text: z.string().max(40),
  headingFont: z.enum(["brand", "modern", "classic"]),
  bodyFont: z.enum(["brand", "modern", "friendly"]),
  buttonStyle: z.enum(["pill", "rounded", "square"]),
  contentWidth: z.enum(["compact", "standard", "wide"]),
});
const documentSchema = z.object({
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
  const [store] = await db.select({ id: stores.id, tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
  if (user.role === "admin") return store;

  const [direct, membership] = await Promise.all([
    db.select({ id: storeManagers.id }).from(storeManagers).where(and(eq(storeManagers.storeId, storeId), eq(storeManagers.userId, user.id))).limit(1),
    db.select({ role: tenantMemberships.role }).from(tenantMemberships).where(and(eq(tenantMemberships.tenantKey, store.tenantKey), eq(tenantMemberships.userId, user.id), eq(tenantMemberships.active, true))).limit(1),
  ]);
  const role = membership[0]?.role;
  const allowed = direct.length > 0 || role === "owner" || role === "admin" || role === "site_editor" || (!write && role === "marketing");
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem acesso ao Studio desta marca." });
  return store;
}

async function ensurePage(storeId: number, pageKey: z.infer<typeof pageKeySchema>, userId: number) {
  const db = await requireDb();
  const [existing] = await db.select().from(tenantSitePages).where(and(eq(tenantSitePages.storeId, storeId), eq(tenantSitePages.pageKey, pageKey))).limit(1);
  if (existing) return existing;
  const content = JSON.stringify(DEFAULT_HOME_DOCUMENT);
  const [result] = await db.insert(tenantSitePages).values({ storeId, pageKey, title: pageKey === "home" ? "Página inicial" : pageKey, draftContent: content, updatedByUserId: userId });
  const id = Number((result as { insertId?: number }).insertId);
  const [created] = await db.select().from(tenantSitePages).where(eq(tenantSitePages.id, id)).limit(1);
  if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a página." });
  return created;
}

export const siteStudioRouter = router({
  mySites: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    if (ctx.user.role === "admin") return db.select({ id: stores.id, name: stores.name, slug: stores.slug, tenantKey: stores.tenantKey }).from(stores).where(eq(stores.active, true));
    const [memberships, direct] = await Promise.all([
      db.select({ tenantKey: tenantMemberships.tenantKey, membershipRole: tenantMemberships.role }).from(tenantMemberships).where(and(eq(tenantMemberships.userId, ctx.user.id), eq(tenantMemberships.active, true))),
      db.select({ storeId: storeManagers.storeId }).from(storeManagers).where(eq(storeManagers.userId, ctx.user.id)),
    ]);
    const tenantKeys = memberships.filter((item) => ["owner", "admin", "site_editor", "marketing"].includes(item.membershipRole)).map((item) => item.tenantKey);
    const clauses = [direct.length ? inArray(stores.id, direct.map((item) => item.storeId)) : undefined, tenantKeys.length ? inArray(stores.tenantKey, tenantKeys) : undefined].filter(Boolean);
    if (!clauses.length) return [];
    const rows = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, tenantKey: stores.tenantKey }).from(stores).where(clauses.length === 1 ? clauses[0] : sql`(${clauses[0]} OR ${clauses[1]})`);
    return rows;
  }),

  workspace: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema })).query(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId);
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const versions = await (await requireDb()).select().from(tenantSitePageVersions).where(eq(tenantSitePageVersions.pageId, page.id)).orderBy(desc(tenantSitePageVersions.versionNumber)).limit(30);
    return { ...page, draft: parseStoredDocument(page.draftContent), versions };
  }),

  published: publicProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema })).query(async ({ input }) => {
    const db = await requireDb();
    const [page] = await db.select().from(tenantSitePages).where(and(eq(tenantSitePages.storeId, input.storeId), eq(tenantSitePages.pageKey, input.pageKey))).limit(1);
    if (!page?.publishedVersionId) return null;
    const [version] = await db.select().from(tenantSitePageVersions).where(and(eq(tenantSitePageVersions.id, page.publishedVersionId), eq(tenantSitePageVersions.pageId, page.id))).limit(1);
    return version ? { pageId: page.id, versionId: version.id, document: parseStoredDocument(version.content) } : null;
  }),

  saveDraft: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema, title: z.string().min(1).max(160), document: documentSchema })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    await (await requireDb()).update(tenantSitePages).set({ title: input.title, draftContent: JSON.stringify(input.document), updatedByUserId: ctx.user.id, updatedAt: new Date() }).where(eq(tenantSitePages.id, page.id));
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.draft_saved", resourceType: "site_page", resourceId: page.id, metadata: { pageKey: input.pageKey, blockCount: input.document.blocks.length } });
    return { ok: true, updatedAt: new Date() };
  }),

  publish: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema, note: z.string().max(240).optional() })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const db = await requireDb();
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const [maxRow] = await db.select({ value: sql<number>`COALESCE(MAX(${tenantSitePageVersions.versionNumber}), 0)` }).from(tenantSitePageVersions).where(eq(tenantSitePageVersions.pageId, page.id));
    const versionNumber = Number(maxRow?.value ?? 0) + 1;
    const [result] = await db.insert(tenantSitePageVersions).values({ pageId: page.id, versionNumber, content: page.draftContent, note: input.note ?? null, createdByUserId: ctx.user.id });
    const versionId = Number((result as { insertId?: number }).insertId);
    await db.update(tenantSitePages).set({ publishedVersionId: versionId, updatedByUserId: ctx.user.id }).where(eq(tenantSitePages.id, page.id));
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.published", resourceType: "site_page", resourceId: page.id, metadata: { pageKey: input.pageKey, versionId, versionNumber } });
    return { ok: true, versionId, versionNumber };
  }),

  restore: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), pageKey: pageKeySchema, versionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireSiteAccess(ctx.user, input.storeId, true);
    const db = await requireDb();
    const page = await ensurePage(input.storeId, input.pageKey, ctx.user.id);
    const [version] = await db.select().from(tenantSitePageVersions).where(and(eq(tenantSitePageVersions.id, input.versionId), eq(tenantSitePageVersions.pageId, page.id))).limit(1);
    if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "Versão não encontrada." });
    await db.update(tenantSitePages).set({ draftContent: version.content, updatedByUserId: ctx.user.id }).where(eq(tenantSitePages.id, page.id));
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.version_restored", resourceType: "site_page", resourceId: page.id, metadata: { pageKey: input.pageKey, versionId: input.versionId } });
    return { ok: true };
  }),

  grantEditor: adminProcedure.input(z.object({ storeId: z.number().int().positive(), email: z.string().email(), role: z.enum(["site_editor", "marketing"]) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [store] = await db.select({ tenantKey: stores.tenantKey }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (!store || !user) throw new TRPCError({ code: "NOT_FOUND", message: "Loja ou usuário não encontrado." });
    await db.insert(tenantMemberships).values({ tenantKey: store.tenantKey, userId: user.id, role: input.role, active: true }).onDuplicateKeyUpdate({ set: { role: input.role, active: true, updatedAt: new Date() } });
    await recordTenantAudit({ storeId: input.storeId, actorUserId: ctx.user.id, action: "site.editor_granted", resourceType: "tenant_membership", resourceId: user.id, metadata: { role: input.role, email: input.email } });
    return { ok: true, grantedBy: ctx.user.id };
  }),
});
