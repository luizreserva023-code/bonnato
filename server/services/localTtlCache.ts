type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function withLocalTtlCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T> | T,
): Promise<T> {
  const now = Date.now();
  const current = cache.get(key) as CacheEntry<T> | undefined;

  if (current?.value !== undefined && current.expiresAt > now) {
    return current.value;
  }

  if (current?.pending) {
    return current.pending;
  }

  const pending = Promise.resolve(loader())
    .then((value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, ttlMs),
      });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, {
    pending,
    expiresAt: now + Math.max(0, ttlMs),
  });

  return pending;
}

export function invalidateLocalTtlCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
