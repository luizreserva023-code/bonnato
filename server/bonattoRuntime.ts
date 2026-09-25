import { and, eq } from "drizzle-orm";
import { stores } from "../drizzle/schema.ts";
import { BONATTO_FEATURE_FLAGS, BONATTO_PROVIDER_CONFIG } from "../shared/bonattoConfig.ts";
import { getDb } from "./db.ts";

export async function getBonattoRuntimeByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return null;

  const [store] = await db
    .select({ id: stores.id, slug: stores.slug, active: stores.active })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.active, true)))
    .limit(1);

  if (!store) return null;

  return {
    storeId: store.id,
    storeSlug: store.slug,
    status: "active" as const,
    features: BONATTO_FEATURE_FLAGS,
    providers: BONATTO_PROVIDER_CONFIG,
  };
}
