import { SEARCH_CACHE_TTL_MS } from './searchDefaults'
import { activeBranchIdForCache } from './branch/epoch'
import { registerCache } from './cacheRegistry'

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

/**
 * La sucursal activa va SIEMPRE en la clave: un resultado cacheado en la sucursal A nunca se sirve en B.
 * Formato: `scope::b<branchId>::query::deps` (el prefijo `scope::` se conserva para clearSearchCacheScope).
 */
export function buildSearchCacheKey(scope: string, query: string, depsKey: string): string {
  return `${scope}::b${activeBranchIdForCache()}::${query}::${depsKey}`
}

export function clearSearchCacheScope(scope: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${scope}::`)) store.delete(key)
  }
}

export function clearAllSearchCache(): void {
  store.clear()
}

registerCache('searchCache', 'branch', clearAllSearchCache)
