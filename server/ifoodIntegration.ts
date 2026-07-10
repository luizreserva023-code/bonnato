import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import crypto from "crypto";

import { getDb } from "./db.ts";
import { shouldRunRuntimeSchemaMigrations } from "./runtimeSchema.ts";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type IfoodIntegrationStatus = "disconnected" | "connecting" | "connected" | "error";
export type IfoodMode = "mock" | "production";
export type IfoodExternalOrderStatus =
  | "novo"
  | "confirmado"
  | "em_preparo"
  | "saiu_para_entrega"
  | "concluido"
  | "cancelado";

export interface IfoodProvider {
  getStatus(restaurantId: number): Promise<IfoodIntegrationSummary>;
  connect(restaurantId: number): Promise<IfoodIntegrationSummary>;
  disconnect(restaurantId: number): Promise<IfoodIntegrationSummary>;
  getOrders(restaurantId: number): Promise<IfoodExternalOrder[]>;
  generateTestOrder(restaurantId: number): Promise<IfoodExternalOrder>;
  confirmOrder(orderId: number, restaurantId: number): Promise<IfoodExternalOrder>;
  startPreparation(orderId: number, restaurantId: number): Promise<IfoodExternalOrder>;
  dispatchOrder(orderId: number, restaurantId: number): Promise<IfoodExternalOrder>;
  concludeOrder(orderId: number, restaurantId: number): Promise<IfoodExternalOrder>;
  cancelOrder(orderId: number, restaurantId: number): Promise<IfoodExternalOrder>;
}

export type IfoodIntegrationSummary = {
  id: number | null;
  restaurantId: number;
  merchantId: string | null;
  merchantName: string | null;
  status: IfoodIntegrationStatus;
  mode: IfoodMode;
  lastConnectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type IfoodExternalOrder = {
  id: number;
  restaurantId: number;
  channel: "ifood";
  externalOrderId: string;
  displayId: string;
  status: IfoodExternalOrderStatus;
  customerName: string;
  totalAmount: number;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type IfoodLogEntry = {
  id: number;
  restaurantId: number;
  action: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

function asRows<T>(result: unknown): T[] {
  return ((result as [T[]])[0] ?? []) as T[];
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapIntegration(row: Record<string, unknown> | undefined, restaurantId: number): IfoodIntegrationSummary {
  if (!row) {
    return {
      id: null,
      restaurantId,
      merchantId: null,
      merchantName: null,
      status: "disconnected",
      mode: "mock",
      lastConnectedAt: null,
      lastSyncAt: null,
      lastError: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurant_id),
    merchantId: row.merchant_id ? String(row.merchant_id) : null,
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    status: String(row.status ?? "disconnected") as IfoodIntegrationStatus,
    mode: String(row.mode ?? "mock") as IfoodMode,
    lastConnectedAt: toIso(row.last_connected_at),
    lastSyncAt: toIso(row.last_sync_at),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapOrder(row: Record<string, unknown>): IfoodExternalOrder {
  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurant_id),
    channel: "ifood",
    externalOrderId: String(row.external_order_id),
    displayId: String(row.display_id),
    status: String(row.status) as IfoodExternalOrderStatus,
    customerName: String(row.customer_name),
    totalAmount: Number(row.total_amount ?? 0),
    payload: parseJsonObject(row.payload),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapLog(row: Record<string, unknown>): IfoodLogEntry {
  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurant_id),
    action: String(row.action),
    message: String(row.message),
    payload: row.payload ? parseJsonObject(row.payload) : null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database indisponivel." });
  return db;
}

async function getDefaultStoreId(db: Db): Promise<number> {
  const rows = asRows<{ id: number }>(await db.execute(sql.raw(`
    SELECT id
    FROM stores
    WHERE active = true
    ORDER BY isDefault DESC, id ASC
    LIMIT 1
  `)));
  return Number(rows[0]?.id ?? 0);
}

export async function resolveIntegrationRestaurantId(requestedStoreId?: number): Promise<number> {
  const db = await requireDb();
  return requestedStoreId ?? (await getDefaultStoreId(db));
}

export async function ensureIfoodIntegrationSchema() {
  if (!shouldRunRuntimeSchemaMigrations()) return;
  const db = await requireDb();

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ifood_integrations (
      id int NOT NULL AUTO_INCREMENT,
      restaurant_id int NOT NULL,
      merchant_id varchar(120),
      merchant_name varchar(220),
      status enum('disconnected','connecting','connected','error') NOT NULL DEFAULT 'disconnected',
      mode enum('mock','production') NOT NULL DEFAULT 'mock',
      last_connected_at timestamp NULL,
      last_sync_at timestamp NULL,
      last_error text,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY ifood_integrations_restaurant_uq (restaurant_id),
      KEY ifood_integrations_status_idx (status)
    )
  `));

  const syncColumn = asRows<{ count: number }>(await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ifood_integrations'
      AND COLUMN_NAME = 'last_sync_at'
  `));
  if (Number(syncColumn[0]?.count ?? 0) === 0) {
    await db.execute(sql.raw("ALTER TABLE ifood_integrations ADD COLUMN last_sync_at timestamp NULL AFTER last_connected_at"));
  }

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS external_orders (
      id int NOT NULL AUTO_INCREMENT,
      restaurant_id int NOT NULL,
      channel varchar(40) NOT NULL,
      external_order_id varchar(120) NOT NULL,
      display_id varchar(40) NOT NULL,
      status enum('novo','confirmado','em_preparo','saiu_para_entrega','concluido','cancelado') NOT NULL DEFAULT 'novo',
      customer_name varchar(220) NOT NULL,
      total_amount decimal(10,2) NOT NULL DEFAULT '0.00',
      payload json,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY external_orders_channel_external_uq (channel, external_order_id),
      KEY external_orders_restaurant_idx (restaurant_id),
      KEY external_orders_status_idx (status),
      KEY external_orders_created_idx (created_at)
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ifood_logs (
      id int NOT NULL AUTO_INCREMENT,
      restaurant_id int NOT NULL,
      action varchar(120) NOT NULL,
      message text NOT NULL,
      payload json,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ifood_logs_restaurant_idx (restaurant_id),
      KEY ifood_logs_created_idx (created_at)
    )
  `));
}

export class IfoodLogService {
  async list(restaurantId: number): Promise<IfoodLogEntry[]> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows<Record<string, unknown>>(await db.execute(sql`
      SELECT id, restaurant_id, action, message, payload, created_at
      FROM ifood_logs
      WHERE restaurant_id = ${restaurantId}
      ORDER BY created_at DESC, id DESC
      LIMIT 40
    `));
    return rows.map(mapLog);
  }

  async create(restaurantId: number, action: string, message: string, payload?: Record<string, unknown>) {
    const db = await requireDb();
    await db.execute(sql`
      INSERT INTO ifood_logs (restaurant_id, action, message, payload)
      VALUES (${restaurantId}, ${action}, ${message}, ${JSON.stringify(payload ?? {})})
    `);
  }
}

export class IfoodIntegrationService {
  constructor(private readonly logs = new IfoodLogService()) {}

  async getStatus(restaurantId: number): Promise<IfoodIntegrationSummary> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows<Record<string, unknown>>(await db.execute(sql`
      SELECT *
      FROM ifood_integrations
      WHERE restaurant_id = ${restaurantId}
      LIMIT 1
    `));
    return mapIntegration(rows[0], restaurantId);
  }

  async connect(restaurantId: number): Promise<IfoodIntegrationSummary> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    await db.execute(sql`
      INSERT INTO ifood_integrations
        (restaurant_id, merchant_id, merchant_name, status, mode, last_connected_at, last_sync_at, last_error)
      VALUES
        (${restaurantId}, 'mock-merchant-001', 'Restaurante iFood Simulado', 'connected', 'mock', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
      ON DUPLICATE KEY UPDATE
        merchant_id = VALUES(merchant_id),
        merchant_name = VALUES(merchant_name),
        status = VALUES(status),
        mode = VALUES(mode),
        last_connected_at = CURRENT_TIMESTAMP,
        last_sync_at = CURRENT_TIMESTAMP,
        last_error = NULL
    `);
    await this.logs.create(restaurantId, "integration.connected", "Integração iFood conectada em modo simulado.", {
      merchantId: "mock-merchant-001",
      mode: "mock",
    });
    return this.getStatus(restaurantId);
  }

  async disconnect(restaurantId: number): Promise<IfoodIntegrationSummary> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    await db.execute(sql`
      INSERT INTO ifood_integrations (restaurant_id, status, mode)
      VALUES (${restaurantId}, 'disconnected', 'mock')
      ON DUPLICATE KEY UPDATE status = 'disconnected'
    `);
    await this.logs.create(restaurantId, "integration.disconnected", "Integração iFood desconectada.", {});
    return this.getStatus(restaurantId);
  }
}

export class IfoodOrderService {
  constructor(private readonly logs = new IfoodLogService()) {}

  async list(restaurantId: number): Promise<IfoodExternalOrder[]> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows<Record<string, unknown>>(await db.execute(sql`
      SELECT *
      FROM external_orders
      WHERE restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `));
    return rows.map(mapOrder);
  }

  async createMockOrder(restaurantId: number): Promise<IfoodExternalOrder> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const displayId = String(1000 + Math.floor(Math.random() * 8999));
    const externalOrderId = `mock-ifood-${crypto.randomUUID()}`;
    const payload = {
      id: externalOrderId,
      displayId,
      merchant: { id: "mock-merchant-001", name: "Restaurante iFood Simulado" },
      customer: {
        name: "Cliente iFood Teste",
        phone: "(37) 99999-0101",
      },
      items: [
        {
          id: "item-001",
          name: "Pizza Grande Bonatto",
          quantity: 1,
          unitPrice: 69.9,
          options: ["Metade Calabresa", "Metade Marguerita", "Borda catupiry"],
          observations: "Caprichar no molho.",
        },
        {
          id: "item-002",
          name: "Refrigerante 2L",
          quantity: 1,
          unitPrice: 12.9,
          options: [],
        },
      ],
      delivery: {
        address: "Rua Simulada, 123 - Centro, Mateus Leme - MG",
        complement: "Casa",
        mode: "delivery",
      },
      payment: {
        method: "Pago pelo iFood",
        prepaid: true,
      },
      total: {
        items: 82.8,
        deliveryFee: 7,
        benefits: 0,
        orderAmount: 89.8,
      },
      notes: "Pedido de teste gerado pelo modo simulado Bonatto.",
      createdAt: new Date().toISOString(),
    };

    await db.execute(sql`
      INSERT INTO external_orders
        (restaurant_id, channel, external_order_id, display_id, status, customer_name, total_amount, payload)
      VALUES
        (${restaurantId}, 'ifood', ${externalOrderId}, ${displayId}, 'novo', 'Cliente iFood Teste', '89.80', ${JSON.stringify(payload)})
    `);
    await db.execute(sql`UPDATE ifood_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE restaurant_id = ${restaurantId} LIMIT 1`);
    const rows = asRows<{ id: number }>(await db.execute(sql`SELECT LAST_INSERT_ID() AS id`));
    const order = await this.getById(Number(rows[0]?.id), restaurantId);
    await this.logs.create(restaurantId, "order.generated", `Pedido teste iFood #${displayId} gerado.`, {
      orderId: order.id,
      externalOrderId,
    });
    return order;
  }

  async updateStatus(orderId: number, restaurantId: number, status: IfoodExternalOrderStatus): Promise<IfoodExternalOrder> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const current = await this.getById(orderId, restaurantId);
    await db.execute(sql`
      UPDATE external_orders
      SET status = ${status}
      WHERE id = ${orderId}
        AND restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      LIMIT 1
    `);
    await db.execute(sql`UPDATE ifood_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE restaurant_id = ${restaurantId} LIMIT 1`);
    const order = await this.getById(orderId, restaurantId);
    await this.logs.create(restaurantId, `order.${status}`, this.statusLogMessage(order, current.status, status), {
      orderId,
      displayId: order.displayId,
      from: current.status,
      to: status,
    });
    return order;
  }

  async getById(orderId: number, restaurantId: number): Promise<IfoodExternalOrder> {
    await ensureIfoodIntegrationSchema();
    const db = await requireDb();
    const rows = asRows<Record<string, unknown>>(await db.execute(sql`
      SELECT *
      FROM external_orders
      WHERE id = ${orderId}
        AND restaurant_id = ${restaurantId}
        AND channel = 'ifood'
      LIMIT 1
    `));
    if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido iFood não encontrado." });
    return mapOrder(rows[0]);
  }

  private statusLogMessage(order: IfoodExternalOrder, _from: IfoodExternalOrderStatus, to: IfoodExternalOrderStatus) {
    const labels: Record<IfoodExternalOrderStatus, string> = {
      novo: "Pedido teste gerado",
      confirmado: "Pedido confirmado",
      em_preparo: "Preparo iniciado",
      saiu_para_entrega: "Pedido despachado",
      concluido: "Pedido concluído",
      cancelado: "Pedido cancelado",
    };
    return `${labels[to]} no iFood simulado #${order.displayId}.`;
  }
}

export class IfoodMockService implements IfoodProvider {
  private readonly integration = new IfoodIntegrationService();
  private readonly orders = new IfoodOrderService();

  getStatus(restaurantId: number) {
    return this.integration.getStatus(restaurantId);
  }

  connect(restaurantId: number) {
    return this.integration.connect(restaurantId);
  }

  disconnect(restaurantId: number) {
    return this.integration.disconnect(restaurantId);
  }

  getOrders(restaurantId: number) {
    return this.orders.list(restaurantId);
  }

  generateTestOrder(restaurantId: number) {
    return this.orders.createMockOrder(restaurantId);
  }

  confirmOrder(orderId: number, restaurantId: number) {
    return this.orders.updateStatus(orderId, restaurantId, "confirmado");
  }

  startPreparation(orderId: number, restaurantId: number) {
    return this.orders.updateStatus(orderId, restaurantId, "em_preparo");
  }

  dispatchOrder(orderId: number, restaurantId: number) {
    return this.orders.updateStatus(orderId, restaurantId, "saiu_para_entrega");
  }

  concludeOrder(orderId: number, restaurantId: number) {
    return this.orders.updateStatus(orderId, restaurantId, "concluido");
  }

  cancelOrder(orderId: number, restaurantId: number) {
    return this.orders.updateStatus(orderId, restaurantId, "cancelado");
  }
}

export class ProductionIfoodProvider implements IfoodProvider {
  private notReady(): never {
    // Futuramente implementar OAuth oficial do iFood.
    // Futuramente usar clientId/clientSecret somente no backend.
    // Futuramente listar merchants autorizados pelo token do restaurante.
    // Futuramente receber pedidos por webhook ou polling oficial.
    // Futuramente mapear merchantId para restaurantId de forma persistente.
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Integração iFood em produção ainda não está habilitada. Use IFOOD_MODE=mock.",
    });
  }

  getStatus(): Promise<IfoodIntegrationSummary> { return this.notReady(); }
  connect(): Promise<IfoodIntegrationSummary> { return this.notReady(); }
  disconnect(): Promise<IfoodIntegrationSummary> { return this.notReady(); }
  getOrders(): Promise<IfoodExternalOrder[]> { return this.notReady(); }
  generateTestOrder(): Promise<IfoodExternalOrder> { return this.notReady(); }
  confirmOrder(): Promise<IfoodExternalOrder> { return this.notReady(); }
  startPreparation(): Promise<IfoodExternalOrder> { return this.notReady(); }
  dispatchOrder(): Promise<IfoodExternalOrder> { return this.notReady(); }
  concludeOrder(): Promise<IfoodExternalOrder> { return this.notReady(); }
  cancelOrder(): Promise<IfoodExternalOrder> { return this.notReady(); }
}

export function getIfoodProvider(): IfoodProvider {
  return process.env.IFOOD_MODE === "production" ? new ProductionIfoodProvider() : new IfoodMockService();
}

export async function listIfoodIntegrationLogs(restaurantId: number) {
  return new IfoodLogService().list(restaurantId);
}
