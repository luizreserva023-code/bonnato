/**
 * iFood Integration Module
 * Docs:
 * - Events polling: https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/polling-overview
 * - Merchant: https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/introducao/
 * - Catalog: https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/endpoints/
 * - Promotion: https://developer.ifood.com.br/pt-BR/docs/guides/modules/promotion/general/
 */

import { and, eq, sql } from "drizzle-orm";
import { categories, orderItems, orders, products, promotions } from "../drizzle/schema";
import { getDb } from "./db";

const IFOOD_BASE_URL = "https://merchant-api.ifood.com.br";
const IFOOD_SOURCE = "ifood";

interface IfoodTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface IfoodEvent {
  id: string;
  code: string;
  correlationId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface IfoodOrderItem {
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
  subItems?: Array<{ name: string; quantity: number; price: number }>;
}

interface IfoodOrder {
  id: string;
  reference: string;
  shortReference: string;
  createdAt: string;
  type: string;
  merchant: { id: string; name: string };
  customer: { id: string; name: string; phone: string; taxPayerIdentificationNumber?: string };
  items: IfoodOrderItem[];
  subTotal: number;
  totalFee: number;
  totalPrice: number;
  deliveryFee: number;
  deliveryAddress?: {
    streetName: string;
    streetNumber: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string;
  };
  payments: Array<{ name: string; code: string; value: number; prepaid: boolean }>;
}

type IfoodMerchant = {
  id: string;
  name?: string;
  status?: string;
  city?: string;
};

type IfoodCatalogItem = {
  id: string;
  status?: string;
  name?: string;
  description?: string;
  imagePath?: string;
  externalCode?: string;
  price?: number | { value?: number };
  contextModifiers?: Array<{
    catalogContext?: string;
    status?: string;
    price?: { value?: number };
  }>;
  products?: Array<{
    id?: string;
    name?: string;
    description?: string;
    imagePath?: string;
    externalCode?: string;
  }>;
  product?: {
    id?: string;
    name?: string;
    description?: string;
    imagePath?: string;
    externalCode?: string;
  };
};

type IfoodCatalogCategory = {
  id: string;
  name: string;
  status?: string;
  template?: string;
  items?: IfoodCatalogItem[];
};

type IfoodPromotionItem = {
  status?: string;
  ean?: string;
  sku?: string;
  itemId?: string;
  promotionName?: string;
  promotionType?: string;
  discountValue?: number;
  initialDate?: string;
  finalDate?: string;
  productName?: string;
  itemName?: string;
  title?: string;
};

type SyncCatalogResult = {
  merchants: Array<{
    merchantId: string;
    merchantName: string;
    categoriesImported: number;
    categoriesUpdated: number;
    productsImported: number;
    productsUpdated: number;
    productsDeactivated: number;
    categoriesDeactivated: number;
  }>;
};

type SyncPromotionsResult = {
  merchants: Array<{
    merchantId: string;
    merchantName: string;
    aggregationIds: string[];
    promotionsImported: number;
    promotionsUpdated: number;
  }>;
  couponsImported: number;
  note: string;
};

const IFOOD_STATUS_MAP: Record<
  string,
  "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled"
> = {
  PLACED: "pending",
  CFM: "confirmed",
  PRP: "preparing",
  RTP: "preparing",
  COL: "out_for_delivery",
  CAN: "cancelled",
  CNC: "cancelled",
  TRB: "preparing",
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let ensureSchemaPromise: Promise<void> | null = null;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function normalizeText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizePrice(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
  }
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return normalizePrice((value as { value?: unknown }).value);
  }
  return "0.00";
}

function buildImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^https?:\/\//i.test(value)) return value.trim();
  return null;
}

function isAvailableStatus(status?: string | null): boolean {
  if (!status) return true;
  return status.toUpperCase() === "AVAILABLE" || status.toUpperCase() === "ACTIVE";
}

function pickDefaultContextModifier(item: IfoodCatalogItem) {
  return item.contextModifiers?.find((modifier) => modifier.catalogContext === "DEFAULT") ?? item.contextModifiers?.[0];
}

function resolveCatalogItemName(item: IfoodCatalogItem): string {
  return normalizeText(item.products?.[0]?.name, normalizeText(item.product?.name, normalizeText(item.name, "Item iFood")));
}

function resolveCatalogItemDescription(item: IfoodCatalogItem): string {
  return normalizeText(
    item.products?.[0]?.description,
    normalizeText(item.product?.description, normalizeText(item.description, "Sincronizado do iFood"))
  );
}

function resolveCatalogItemImage(item: IfoodCatalogItem): string | null {
  return (
    buildImageUrl(item.products?.[0]?.imagePath) ??
    buildImageUrl(item.product?.imagePath) ??
    buildImageUrl(item.imagePath)
  );
}

function resolveCatalogItemPrice(item: IfoodCatalogItem): string {
  const modifier = pickDefaultContextModifier(item);
  return normalizePrice(modifier?.price ?? item.price);
}

function resolvePromotionTitle(item: IfoodPromotionItem, aggregationId: string): string {
  return normalizeText(
    item.promotionName,
    normalizeText(item.title, normalizeText(item.productName, normalizeText(item.itemName, `Promocao iFood ${aggregationId}`)))
  );
}

function resolvePromotionDescription(item: IfoodPromotionItem): string {
  const details: string[] = [];
  if (item.promotionType) details.push(`Tipo: ${item.promotionType}`);
  if (typeof item.discountValue === "number") details.push(`Desconto: ${item.discountValue}`);
  if (item.productName || item.itemName) details.push(`Item: ${item.productName ?? item.itemName}`);
  return details.join(" | ") || "Promocao sincronizada do iFood";
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getConfiguredAggregationIds(): string[] {
  return (process.env.IFOOD_PROMOTION_AGGREGATION_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function hasColumn(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const query = `SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`;
  const result = await db.execute(sql.raw(query));
  const rows = (result as unknown as [Array<unknown>])[0];
  return rows.length > 0;
}

async function hasIndex(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tableName: string,
  indexName: string
): Promise<boolean> {
  const query = `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`;
  const result = await db.execute(sql.raw(query));
  const rows = (result as unknown as [Array<unknown>])[0];
  return rows.length > 0;
}

async function ensureIfoodSyncSchema(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<void> {
  if (ensureSchemaPromise) {
    return ensureSchemaPromise;
  }

  ensureSchemaPromise = (async () => {
    if (!(await hasColumn(db, "categories", "externalSource"))) {
      await db.execute(sql.raw("ALTER TABLE `categories` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!(await hasIndex(db, "categories", "categories_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }

    if (!(await hasColumn(db, "products", "externalSource"))) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `products` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128), ADD `externalCode` varchar(128)"
        )
      );
    }
    if (!(await hasIndex(db, "products", "products_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `products_external_uq` ON `products` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }

    if (!(await hasColumn(db, "coupons", "externalSource"))) {
      await db.execute(sql.raw("ALTER TABLE `coupons` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!(await hasIndex(db, "coupons", "coupons_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }

    if (!(await hasColumn(db, "promotions", "externalSource"))) {
      await db.execute(sql.raw("ALTER TABLE `promotions` ADD `externalSource` varchar(32), ADD `externalMerchantId` varchar(128), ADD `externalId` varchar(128)"));
    }
    if (!(await hasIndex(db, "promotions", "promotions_external_uq"))) {
      await db.execute(sql.raw("CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`externalSource`,`externalMerchantId`,`externalId`)"));
    }
  })().catch((error) => {
    ensureSchemaPromise = null;
    throw error;
  });

  return ensureSchemaPromise;
}

async function getToken(): Promise<string> {
  const clientId = process.env.IFOOD_CLIENT_ID;
  const clientSecret = process.env.IFOOD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET nao configurados");
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grantType: "client_credentials",
      clientId,
      clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iFood auth failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as IfoodTokenResponse;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function ifoodGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iFood GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function ifoodPost<T>(path: string, body: unknown): Promise<T | void> {
  const token = await getToken();
  const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iFood POST ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : undefined;
}

async function resolveMerchantSelection(selectedMerchantId?: string): Promise<IfoodMerchant[]> {
  const merchants = await listIfoodMerchants();
  if (selectedMerchantId) {
    return merchants.filter((merchant) => merchant.id === selectedMerchantId);
  }

  const envMerchantIds = (process.env.IFOOD_MERCHANT_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (envMerchantIds.length > 0) {
    return merchants.filter((merchant) => envMerchantIds.includes(merchant.id));
  }

  return merchants;
}

export async function listIfoodMerchants(): Promise<IfoodMerchant[]> {
  const response = await ifoodGet<IfoodMerchant[] | { merchants?: IfoodMerchant[] }>("/merchant/v1.0/merchants");
  const merchants = Array.isArray(response) ? response : response.merchants ?? [];
  return merchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name ?? `Merchant ${merchant.id.slice(0, 8)}`,
    status: merchant.status ?? "UNKNOWN",
    city: merchant.city,
  }));
}

export async function syncIfoodCatalog(selectedMerchantId?: string): Promise<SyncCatalogResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureIfoodSyncSchema(db);

  const merchants = await resolveMerchantSelection(selectedMerchantId);
  if (merchants.length === 0) {
    throw new Error("Nenhum merchant iFood disponivel para sincronizacao");
  }

  const result: SyncCatalogResult = { merchants: [] };

  for (const merchant of merchants) {
    const merchantId = merchant.id;
    const categoriesResponse = await ifoodGet<IfoodCatalogCategory[]>(
      `/catalog/v2.0/merchants/${merchantId}/categories?include_items=true`
    );

    let categoriesImported = 0;
    let categoriesUpdated = 0;
    let productsImported = 0;
    let productsUpdated = 0;

    const seenCategoryIds = new Set<string>();
    const seenProductIds = new Set<string>();

    for (let index = 0; index < categoriesResponse.length; index += 1) {
      const remoteCategory = categoriesResponse[index];
      if (!remoteCategory?.id) continue;
      seenCategoryIds.add(remoteCategory.id);

      const existingCategory = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.externalSource, IFOOD_SOURCE),
            eq(categories.externalMerchantId, merchantId),
            eq(categories.externalId, remoteCategory.id)
          )
        )
        .limit(1);

      const categoryPayload = {
        name: normalizeText(remoteCategory.name, `Categoria ${index + 1}`),
        description: `Sincronizado do iFood (${merchant.name ?? merchantId})`,
        slug: `ifood-${slugify(remoteCategory.name ?? `categoria-${index + 1}`)}-${remoteCategory.id.slice(0, 8)}`,
        sortOrder: index,
        active: isAvailableStatus(remoteCategory.status),
        externalSource: IFOOD_SOURCE,
        externalMerchantId: merchantId,
        externalId: remoteCategory.id,
      } as const;

      let categoryId: number;
      if (existingCategory[0]) {
        categoryId = existingCategory[0].id;
        await db
          .update(categories)
          .set({
            name: categoryPayload.name,
            description: categoryPayload.description,
            active: categoryPayload.active,
            sortOrder: categoryPayload.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(categories.id, categoryId));
        categoriesUpdated += 1;
      } else {
        const inserted = await db.insert(categories).values(categoryPayload).$returningId();
        categoryId = inserted[0].id;
        categoriesImported += 1;
      }

      const remoteItems = remoteCategory.items ?? [];
      for (let itemIndex = 0; itemIndex < remoteItems.length; itemIndex += 1) {
        const remoteItem = remoteItems[itemIndex];
        if (!remoteItem?.id) continue;
        seenProductIds.add(remoteItem.id);

        const existingProduct = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.externalSource, IFOOD_SOURCE),
              eq(products.externalMerchantId, merchantId),
              eq(products.externalId, remoteItem.id)
            )
          )
          .limit(1);

        const productPayload = {
          categoryId,
          name: resolveCatalogItemName(remoteItem),
          description: resolveCatalogItemDescription(remoteItem),
          price: resolveCatalogItemPrice(remoteItem),
          imageUrl: resolveCatalogItemImage(remoteItem),
          active: isAvailableStatus(pickDefaultContextModifier(remoteItem)?.status ?? remoteItem.status),
          featured: false,
          sortOrder: itemIndex,
          externalSource: IFOOD_SOURCE,
          externalMerchantId: merchantId,
          externalId: remoteItem.id,
          externalCode: remoteItem.externalCode ?? remoteItem.product?.externalCode ?? remoteItem.products?.[0]?.externalCode ?? null,
        } as const;

        if (existingProduct[0]) {
          await db
            .update(products)
            .set({
              categoryId: productPayload.categoryId,
              name: productPayload.name,
              description: productPayload.description,
              price: productPayload.price,
              imageUrl: productPayload.imageUrl,
              active: productPayload.active,
              sortOrder: productPayload.sortOrder,
              externalCode: productPayload.externalCode,
              updatedAt: new Date(),
            })
            .where(eq(products.id, existingProduct[0].id));
          productsUpdated += 1;
        } else {
          await db.insert(products).values(productPayload);
          productsImported += 1;
        }
      }
    }

    const existingMerchantCategories = await db
      .select({ id: categories.id, externalId: categories.externalId })
      .from(categories)
      .where(and(eq(categories.externalSource, IFOOD_SOURCE), eq(categories.externalMerchantId, merchantId)));

    let categoriesDeactivated = 0;
    for (const localCategory of existingMerchantCategories) {
      if (localCategory.externalId && !seenCategoryIds.has(localCategory.externalId)) {
        await db.update(categories).set({ active: false, updatedAt: new Date() }).where(eq(categories.id, localCategory.id));
        categoriesDeactivated += 1;
      }
    }

    const existingMerchantProducts = await db
      .select({ id: products.id, externalId: products.externalId })
      .from(products)
      .where(and(eq(products.externalSource, IFOOD_SOURCE), eq(products.externalMerchantId, merchantId)));

    let productsDeactivated = 0;
    for (const localProduct of existingMerchantProducts) {
      if (localProduct.externalId && !seenProductIds.has(localProduct.externalId)) {
        await db.update(products).set({ active: false, updatedAt: new Date() }).where(eq(products.id, localProduct.id));
        productsDeactivated += 1;
      }
    }

    result.merchants.push({
      merchantId,
      merchantName: merchant.name ?? merchantId,
      categoriesImported,
      categoriesUpdated,
      productsImported,
      productsUpdated,
      productsDeactivated,
      categoriesDeactivated,
    });
  }

  return result;
}

export async function syncIfoodPromotions(input?: {
  merchantId?: string;
  aggregationIds?: string[];
}): Promise<SyncPromotionsResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureIfoodSyncSchema(db);

  const merchants = await resolveMerchantSelection(input?.merchantId);
  if (merchants.length === 0) {
    throw new Error("Nenhum merchant iFood disponivel para sincronizacao");
  }

  const aggregationIds = (input?.aggregationIds?.length ? input.aggregationIds : getConfiguredAggregationIds())
    .map((value) => value.trim())
    .filter(Boolean);

  if (aggregationIds.length === 0) {
    throw new Error(
      "Informe aggregationIds ou configure IFOOD_PROMOTION_AGGREGATION_IDS. A API oficial do iFood consulta promocoes por aggregationId."
    );
  }

  const result: SyncPromotionsResult = {
    merchants: [],
    couponsImported: 0,
    note:
      "O iFood nao expõe uma API publica para listar cupons do jeito que o app usa hoje. Este sync importa promocoes consultaveis por aggregationId e nao cria cupons artificiais.",
  };

  for (const merchant of merchants) {
    let promotionsImported = 0;
    let promotionsUpdated = 0;

    for (const aggregationId of aggregationIds) {
      const response = await ifoodGet<{ items?: IfoodPromotionItem[] } | IfoodPromotionItem[]>(
        `/promotion/v1.0/merchants/${merchant.id}/promotions/${aggregationId}/items?offset=0&limit=200`
      );
      const items = Array.isArray(response) ? response : response.items ?? [];

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const externalId = `${aggregationId}:${item.itemId ?? item.ean ?? item.sku ?? index}`;

        const existing = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.externalSource, IFOOD_SOURCE),
              eq(promotions.externalMerchantId, merchant.id),
              eq(promotions.externalId, externalId)
            )
          )
          .limit(1);

        const startsAt = parseDate(item.initialDate);
        const endsAt = parseDate(item.finalDate);
        const payload = {
          title: resolvePromotionTitle(item, aggregationId),
          description: resolvePromotionDescription(item),
          imageUrl: null,
          couponCode: null,
          active: isAvailableStatus(item.status),
          requiresLogin: false,
          startsAt,
          endsAt,
          externalSource: IFOOD_SOURCE,
          externalMerchantId: merchant.id,
          externalId,
        } as const;

        if (existing[0]) {
          await db
            .update(promotions)
            .set({
              title: payload.title,
              description: payload.description,
              imageUrl: payload.imageUrl,
              couponCode: payload.couponCode,
              active: payload.active,
              requiresLogin: payload.requiresLogin,
              startsAt: payload.startsAt,
              endsAt: payload.endsAt,
              updatedAt: new Date(),
            })
            .where(eq(promotions.id, existing[0].id));
          promotionsUpdated += 1;
        } else {
          await db.insert(promotions).values(payload);
          promotionsImported += 1;
        }
      }
    }

    result.merchants.push({
      merchantId: merchant.id,
      merchantName: merchant.name ?? merchant.id,
      aggregationIds,
      promotionsImported,
      promotionsUpdated,
    });
  }

  return result;
}

export async function pollIfoodEventsOnce(): Promise<void> {
  let events: IfoodEvent[];
  try {
    events = await ifoodGet<IfoodEvent[]>("/events/v1.0/events:polling");
  } catch (err) {
    console.error("[iFood] Polling error:", err);
    return;
  }

  if (!events || events.length === 0) return;

  console.log(`[iFood] ${events.length} evento(s) recebido(s)`);

  const db = await getDb();
  if (!db) return;
  const processedIds: string[] = [];

  for (const event of events) {
    try {
      await processEvent(db, event);
      processedIds.push(event.id);
    } catch (err) {
      console.error(`[iFood] Erro ao processar evento ${event.id}:`, err);
      processedIds.push(event.id);
    }
  }

  if (processedIds.length > 0) {
    try {
      await ifoodPost("/events/v1.0/events/acknowledgment", processedIds.map((id) => ({ id })));
    } catch (err) {
      console.error("[iFood] Erro ao enviar ACK:", err);
    }
  }
}

async function processEvent(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, event: IfoodEvent): Promise<void> {
  const { code, correlationId: ifoodOrderId } = event;

  if (code === "PLACED") {
    await handleNewOrder(db, ifoodOrderId);
  } else if (IFOOD_STATUS_MAP[code]) {
    const newStatus = IFOOD_STATUS_MAP[code];
    await db
      .update(orders)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.ifoodOrderId as Parameters<typeof eq>[0], ifoodOrderId));
    console.log(`[iFood] Pedido ${ifoodOrderId} -> ${newStatus}`);
  }
}

async function handleNewOrder(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ifoodOrderId: string): Promise<void> {
  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.ifoodOrderId, ifoodOrderId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[iFood] Pedido ${ifoodOrderId} ja existe, ignorando`);
    return;
  }

  const order = await ifoodGet<IfoodOrder>(`/order/v1.0/orders/${ifoodOrderId}`);
  const addr = order.deliveryAddress;
  const deliveryAddress = addr
    ? `${addr.streetName}, ${addr.streetNumber}${addr.complement ? ` - ${addr.complement}` : ""}, ${addr.neighborhood}, ${addr.city}/${addr.state} - CEP ${addr.postalCode}`
    : null;

  const itemsData = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    totalPrice: item.totalPrice,
    notes: item.subItems?.map((subItem) => `${subItem.quantity}x ${subItem.name}`).join(", ") ?? null,
  }));

  const payment = order.payments[0];
  const paymentMethod = payment
    ? payment.prepaid
      ? "online"
      : payment.code === "PIX"
        ? "pix"
        : payment.code === "CASH"
          ? "cash"
          : "card"
    : "online";

  const [newOrder] = await db
    .insert(orders)
    .values({
      status: "pending",
      paymentMethod: paymentMethod as "credit_card" | "debit_card" | "pix" | "cash",
      paymentStatus: payment?.prepaid ? "paid" : "pending",
      subtotal: String(order.subTotal),
      deliveryFee: String(order.deliveryFee),
      discountAmount: "0",
      total: String(order.totalPrice),
      deliveryAddress: deliveryAddress ?? "",
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      notes: `[iFood] Pedido #${order.shortReference}`,
      ifoodOrderId: order.id,
      source: "ifood" as const,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(),
    })
    .$returningId();

  if (newOrder?.id && itemsData.length > 0) {
    await db.insert(orderItems).values(
      itemsData.map((item) => ({
        orderId: newOrder.id,
        productId: 0,
        productName: item.name,
        productPrice: String(item.price),
        quantity: item.quantity,
        subtotal: String(item.totalPrice),
        notes: item.notes,
      }))
    );
  }

  console.log(`[iFood] Novo pedido criado: #${order.shortReference} (${order.customer.name}) - R$ ${order.totalPrice}`);
}

export function startIfoodPolling(): void {
  const clientId = process.env.IFOOD_CLIENT_ID;
  const clientSecret = process.env.IFOOD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("[iFood] Integracao desabilitada (IFOOD_CLIENT_ID/SECRET nao configurados)");
    return;
  }

  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  pollingInterval = setInterval(async () => {
    await pollIfoodEventsOnce();
  }, 30_000);

  void pollIfoodEventsOnce();
  console.log("[iFood] Polling iniciado (intervalo: 30s)");
}

export function stopIfoodPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[iFood] Polling parado");
  }
}

export async function confirmIfoodOrder(ifoodOrderId: string): Promise<void> {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/confirm`, {});
}

export async function startPreparationIfoodOrder(ifoodOrderId: string): Promise<void> {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/startPreparation`, {});
}

export async function readyToPickupIfoodOrder(ifoodOrderId: string): Promise<void> {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/readyToPickup`, {});
}

export async function dispatchIfoodOrder(ifoodOrderId: string): Promise<void> {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/dispatch`, {});
}

export async function cancelIfoodOrder(ifoodOrderId: string, reason: string): Promise<void> {
  await ifoodPost(`/order/v1.0/orders/${ifoodOrderId}/cancel`, {
    cancellationCode: "501",
    description: reason,
  });
}
