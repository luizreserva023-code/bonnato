export type BonattoAnalyticsEventType =
  | "STORE_VIEW"
  | "MENU_VIEW"
  | "CATEGORY_VIEW"
  | "PRODUCT_VIEW"
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "CART_VIEW"
  | "CHECKOUT_STARTED"
  | "CHECKOUT_STEP_COMPLETED";

export type BonattoAnalyticsEventDetail = {
  eventType: BonattoAnalyticsEventType;
  productId?: number;
  categoryId?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export const BONATTO_ANALYTICS_EVENT = "bonatto:analytics-event";

export function emitAnalyticsEvent(detail: BonattoAnalyticsEventDetail) {
  try {
    window.dispatchEvent(new CustomEvent<BonattoAnalyticsEventDetail>(BONATTO_ANALYTICS_EVENT, { detail }));
  } catch {
    // Analytics is best effort only.
  }
}

export function createAnalyticsEventId(prefix = "evt") {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

export function getDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width <= 767) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}
