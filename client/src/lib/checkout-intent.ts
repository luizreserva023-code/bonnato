const PENDING_COUPON_KEY = "bonatto_pending_coupon";

export function savePendingCoupon(code: string) {
  const normalized = code.trim().toUpperCase();
  if (normalized) sessionStorage.setItem(PENDING_COUPON_KEY, normalized);
}

export function getPendingCoupon() {
  return sessionStorage.getItem(PENDING_COUPON_KEY)?.trim().toUpperCase() ?? "";
}

export function clearPendingCoupon() {
  sessionStorage.removeItem(PENDING_COUPON_KEY);
}

export function productOrderHref(productId?: number | null, productName?: string | null) {
  if (productId) return `/cardapio?product=${productId}`;
  const name = productName?.trim();
  return name ? `/cardapio?search=${encodeURIComponent(name)}` : "/cardapio";
}
