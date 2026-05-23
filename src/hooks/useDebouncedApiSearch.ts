import { useCallback, useEffect, useRef, useState } from 'react'
import { buildSearchCacheKey, clearSearchCacheScope, getSearchCache, setSearchCache } from '@/lib/searchCache'
import { SEARCH_MIN_REQUEST_INTERVAL_MS } from '@/lib/searchDefaults'
import { isAbortError } from '@/lib/isAbortError'
import { useDebouncedSearch, type UseDebouncedSearchOptions } from './useDebouncedSearch'

export type UseDebouncedApiSearchOptions<T> = UseDebouncedSearchOptions & {
  /** Identificador único para caché (ej. "products-list", "pos-products"). */
  cacheScope: string
  /** Fetch con AbortSignal; solo la última petición debe aplicar onSuccess. */
  fetcher: (query: string, signal: AbortSignal) => Promise<T>
  onSuccess: (data: T) => void
  onError?: (err: unknown) => void
  /** Dependencias adicionales que disparan nueva carga (paginación, filtros, tab). */
  deps?: readonly unknown[]
  /** Si false, no ejecuta fetch. */
  enabled?: boolean
}

let lastGlobalRequestAt = 0

/**
 * Búsqueda con debounce, longitud mínima, caché TTL, cancelación AbortController
 * y rate-limit ligero en frontend.
 */
export function useDebouncedApiSearch<T>(options: UseDebouncedApiSearchOptions<T>) {
  const {
    cacheScope,
    fetcher,
    onSuccess,
    onError,
    deps = [],
    enabled = true,
    ...debounceOpts
  } = options

  const search = useDebouncedSearch(debounceOpts)
  const [loading, setLoading] = useState(enabled)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const requestIdRef = useRef(0)

  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const fetcherRef = useRef(fetcher)
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError
  fetcherRef.current = fetcher

  const depsKey = JSON.stringify([...deps, refreshNonce])

  const runFetch = useCallback(
    async (query: string, reqId: number, signal: AbortSignal) => {
      const cacheKey = buildSearchCacheKey(cacheScope, query, depsKey)
      const cached = getSearchCache<T>(cacheKey)
      if (cached !== undefined) {
        if (reqId === requestIdRef.current) {
          onSuccessRef.current(cached)
          setLoading(false)
        }
        return
      }

      const now = Date.now()
      const wait = SEARCH_MIN_REQUEST_INTERVAL_MS - (now - lastGlobalRequestAt)
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait))
        if (signal.aborted || reqId !== requestIdRef.current) return
      }
      lastGlobalRequestAt = Date.now()

      try {
        const data = await fetcherRef.current(query, signal)
        if (signal.aborted || reqId !== requestIdRef.current) return
        setSearchCache(cacheKey, data)
        onSuccessRef.current(data)
      } catch (err) {
        if (isAbortError(err) || signal.aborted || reqId !== requestIdRef.current) return
        onErrorRef.current?.(err)
      } finally {
        if (reqId === requestIdRef.current) setLoading(false)
      }
    },
    [cacheScope, depsKey],
  )

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const { effectiveQuery } = search
    if (effectiveQuery === null) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const reqId = ++requestIdRef.current
    setLoading(true)
    void runFetch(effectiveQuery, reqId, controller.signal)

    return () => {
      controller.abort()
    }
  }, [enabled, search.effectiveQuery, search.debouncedValue, depsKey, runFetch])

  const refresh = useCallback(() => {
    clearSearchCacheScope(cacheScope)
    setRefreshNonce((n) => n + 1)
  }, [cacheScope])

  const isSearching = loading || search.isDebouncing

  return {
    inputValue: search.inputValue,
    setInputValue: search.setInputValue,
    debouncedValue: search.debouncedValue,
    effectiveQuery: search.effectiveQuery,
    isDebouncing: search.isDebouncing,
    meetsMinLength: search.meetsMinLength,
    loading,
    isSearching,
    refresh,
  }
}
