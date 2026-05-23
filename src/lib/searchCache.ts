import { SEARCH_CACHE_TTL_MS } from './searchDefaults'

type CacheEntry<T> = { data: T; expiresAt: number }

const store = new Map<string, CacheEntry<unknown>>()

export function getSearchCache<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.data as T
}

export function setSearchCache<T>(key: string, data: T, ttlMs = SEARCH_CACHE_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function buildSearchCacheKey(scope: string, query: string, depsKey: string): string {
  return `${scope}::${query}::${depsKey}`
}

export function clearSearchCacheScope(scope: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${scope}::`)) store.delete(key)
  }
}
