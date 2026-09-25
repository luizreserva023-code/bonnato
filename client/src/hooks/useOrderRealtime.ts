import { useEffect, useRef, useState } from "react";

export type OrderRealtimePayload = {
  eventId: string;
  type: "created" | "status_changed" | "updated";
  orderId: number;
  storeId: number | null;
  status?: string | null;
  previousStatus?: string | null;
  occurredAt: string;
};

type Options = {
  enabled?: boolean;
  storeId?: number;
  orderId?: number;
  onEvent?: (event: OrderRealtimePayload) => void;
  onFallback?: () => void;
  fallbackIntervalMs?: number;
};

export function useOrderRealtime({
  enabled = true,
  storeId,
  orderId,
  onEvent,
  onFallback,
  fallbackIntervalMs = 5_000,
}: Options) {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);
  const fallbackRef = useRef(onFallback);
  callbackRef.current = onEvent;
  fallbackRef.current = onFallback;
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setConnected(false);
      return;
    }

    const params = new URLSearchParams();
    if (storeId) params.set("storeId", String(storeId));
    if (orderId) params.set("orderId", String(orderId));

    const source = new EventSource(`/api/realtime/orders?${params.toString()}`);

    const handleReady = () => setConnected(true);
    const handleOrder = (raw: MessageEvent<string>) => {
      setConnected(true);
      try {
        const event = JSON.parse(raw.data) as OrderRealtimePayload;
        callbackRef.current?.(event);
      } catch {
        // Ignore malformed payloads; EventSource will continue receiving events.
      }
    };

    source.addEventListener("ready", handleReady);
    source.addEventListener("order", handleOrder as EventListener);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    return () => {
      source.removeEventListener("ready", handleReady);
      source.removeEventListener("order", handleOrder as EventListener);
      source.close();
      setConnected(false);
    };
  }, [enabled, storeId, orderId]);

  useEffect(() => {
    if (!enabled || connected || !fallbackRef.current) return;
    const timer = window.setInterval(() => fallbackRef.current?.(), fallbackIntervalMs);
    return () => window.clearInterval(timer);
  }, [connected, enabled, fallbackIntervalMs]);

  return { connected };
}
