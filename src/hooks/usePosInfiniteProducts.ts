import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { productsService, type Product } from '@/services/products.service'
import { isAbortError } from '@/lib/isAbortError'
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch'

export const POS_PRODUCTS_PAGE_SIZE = 48

type Options = {
  activeBranchId: number
  categoryFilter: number | null
  preparationAreaFilter: string | null
  /** Reinicia la lista al cambiar (ej. id de sesión en mesa). */
  scopeKey?: string | number
  /** Si false, no solicita productos. */
  enabled?: boolean
  onError?: (err: unknown) => void
}

export function usePosInfiniteProducts({
  activeBranchId,
  categoryFilter,
  preparationAreaFilter,
  scopeKey = '',
  enabled = true,
  onError,
}: Options) {
  const [products, setProducts] = useState<Product[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const search = useDebouncedSearch()
  const requestIdRef = useRef(0)
  const listEpochRef = useRef(0)
  const prevListKeyRef = useRef<string | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const canFetch = enabled && activeBranchId > 0
  const filterKey = `${activeBranchId}|${categoryFilter ?? ''}|${preparationAreaFilter ?? ''}|${scopeKey}`
  const listKey = `${filterKey}|${search.debouncedValue}|${refreshNonce}`
  const query = search.effectiveQuery

  const hasMore = products.length < totalProducts

  /** Reinicia lista cuando cambian sucursal, filtros o búsqueda (antes del fetch). */
  useLayoutEffect(() => {
    if (prevListKeyRef.current === listKey) return
    prevListKeyRef.current = listKey
    listEpochRef.current += 1
    setPage(1)
    setProducts([])
    setTotalProducts(0)
  }, [listKey])

  useEffect(() => {
    if (!canFetch) {
      setLoading(false)
      setLoadingMore(false)
      return
    }

    if (query === null) {
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const epoch = listEpochRef.current
    const reqId = ++requestIdRef.current
    const isFirstPage = page === 1

    if (isFirstPage) setLoading(true)
    else setLoadingMore(true)

    const controller = new AbortController()

    void productsService
      .list(
        query,
        true,
        page,
        POS_PRODUCTS_PAGE_SIZE,
        categoryFilter ?? undefined,
        preparationAreaFilter ?? undefined,
        activeBranchId,
        { signal: controller.signal },
      )
      .then(({ data, total }) => {
        if (reqId !== requestIdRef.current || epoch !== listEpochRef.current) return
        setTotalProducts(total)
        setProducts((prev) => {
          if (page === 1) return data
          const seen = new Set(prev.map((p) => p.id))
          const extra = data.filter((p) => !seen.has(p.id))
          return [...prev, ...extra]
        })
      })
      .catch((e: unknown) => {
        if (isAbortError(e) || controller.signal.aborted || reqId !== requestIdRef.current) return
        if (page === 1) {
          setProducts([])
          setTotalProducts(0)
        }
        onErrorRef.current?.(e)
      })
      .finally(() => {
        if (reqId !== requestIdRef.current) return
        setLoading(false)
        setLoadingMore(false)
      })

    return () => controller.abort()
  }, [canFetch, activeBranchId, categoryFilter, preparationAreaFilter, page, query, listKey])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !canFetch || query === null) return
    setPage((p) => p + 1)
  }, [loading, loadingMore, hasMore, canFetch, query])

  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
  }, [])

  const isSearching = loading || search.isDebouncing

  return {
    products,
    totalProducts,
    hasMore,
    loading,
    loadingMore,
    isSearching,
    loadMore,
    refresh,
    search,
  }
}
