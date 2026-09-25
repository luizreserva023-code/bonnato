import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Client, Pool, type PoolConfig } from "pg";

const CHANNEL = "bonatto_order_events";
const emitter = new EventEmitter();
emitter.setMaxListeners(500);

const instanceId = randomUUID();
let pool: Pool | null = null;
let listener: Client | null = null;
let bridgeStarted = false;
let reconnectTimer: NodeJS.Timeout | null = null;

export type OrderRealtimeEvent = {
  eventId: string;
  origin: string;
  type: "created" | "status_changed" | "updated";
  orderId: number;
  storeId: number | null;
  userId: number | null;
  status?: string | null;
  previousStatus?: string | null;
  occurredAt: string;
};
function dbConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();
  const sslMode = (process.env.DATABASE_SSL_MODE ?? "").trim().toLowerCase();
  const host = process.env.DATABASE_HOST?.trim();

  const useSsl = Boolean(
    (connectionString && !/localhost|127\.0\.0\.1/i.test(connectionString))
    || (host && !/^(localhost|127\.0\.0\.1)$/i.test(host))
    || sslMode === "require"
    || sslMode === "required",
  );

  if (connectionString) {
    return {
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    host,
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || "bonatto",
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}
function getPool() {
  if (!pool) {
    pool = new Pool({
      ...dbConfig(),
      max: 2,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (error) => {
      console.error("[Realtime] PostgreSQL pool error", error);
    });
  }
  return pool;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startOrderEventBridge();
  }, 2_000);
  reconnectTimer.unref?.();
}
export async function startOrderEventBridge() {
  if (bridgeStarted && listener) return;
  bridgeStarted = true;

  try {
    listener?.removeAllListeners();
    await listener?.end().catch(() => undefined);
    listener = new Client(dbConfig());
    await listener.connect();
    await listener.query(`LISTEN ${CHANNEL}`);

    listener.on("notification", (message) => {
      if (!message.payload) return;
      try {
        const event = JSON.parse(message.payload) as OrderRealtimeEvent;
        if (event.origin === instanceId) return;
        emitter.emit("order", event);
      } catch (error) {
        console.error("[Realtime] Invalid order event payload", error);
      }
    });

    listener.on("error", (error) => {
      console.error("[Realtime] LISTEN connection error", error);
      listener = null;
      bridgeStarted = false;
      scheduleReconnect();
    });
  } catch (error) {
    console.error("[Realtime] Failed to start PostgreSQL order bridge", error);
    listener = null;
    bridgeStarted = false;
    scheduleReconnect();
  }
}
export async function publishOrderRealtimeEvent(
  input: Omit<OrderRealtimeEvent, "eventId" | "origin" | "occurredAt">,
) {
  const event: OrderRealtimeEvent = {
    ...input,
    eventId: randomUUID(),
    origin: instanceId,
    occurredAt: new Date().toISOString(),
  };

  // Immediate delivery for subscribers connected to this instance.
  emitter.emit("order", event);

  try {
    await getPool().query("SELECT pg_notify($1, $2)", [
      CHANNEL,
      JSON.stringify(event),
    ]);
  } catch (error) {
    // Realtime delivery must never fail an order transaction.
    console.error("[Realtime] Failed to publish PostgreSQL notification", error);
  }
}

export function subscribeToOrderEvents(listenerFn: (event: OrderRealtimeEvent) => void) {
  emitter.on("order", listenerFn);
  void startOrderEventBridge();
  return () => emitter.off("order", listenerFn);
}
