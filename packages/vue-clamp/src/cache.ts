export const exactResultCacheEntryLimit = 64;

type KeyPart = number | string;

export function tupleCacheKey(parts: readonly KeyPart[]): string {
  return JSON.stringify(parts);
}

export function touchCacheEntry<K, V>(cache: Map<K, V>, key: K): V | undefined {
  if (!cache.has(key)) {
    return undefined;
  }

  const value = cache.get(key) as V;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function rememberCacheEntry<K, V>(
  cache: Map<K, V>,
  key: K | undefined,
  value: V,
  entryLimit: number,
): void {
  if (key === undefined) {
    return;
  }

  cache.delete(key);
  cache.set(key, value);
  if (cache.size <= entryLimit) {
    return;
  }

  const oldest = cache.keys().next();
  if (!oldest.done) {
    cache.delete(oldest.value);
  }
}
