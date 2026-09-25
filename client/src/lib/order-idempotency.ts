type StoredOrderKey = {
  key: string;
  fingerprint: string;
  createdAt: number;
};

const MAX_AGE_MS = 60 * 60 * 1000;

function storageKey(storeId: number) {
  return `bonatto_order_idempotency_v1_${storeId}`;
}

function makeKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getCheckoutIdempotencyKey(storeId: number, fingerprint: string) {
  const key = storageKey(storeId);
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredOrderKey;
      const fresh = Date.now() - parsed.createdAt <= MAX_AGE_MS;
      if (fresh && parsed.fingerprint === fingerprint && parsed.key) return parsed.key;
    }
  } catch {
    // If storage is unavailable/corrupted, generate a fresh key.
  }

  const value: StoredOrderKey = { key: makeKey(), fingerprint, createdAt: Date.now() };
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort only.
  }
  return value.key;
}

export function clearCheckoutIdempotencyKey(storeId: number) {
  try {
    sessionStorage.removeItem(storageKey(storeId));
  } catch {
    // Best effort only.
  }
}
