import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  companyService,
  sortSeriesNotaVentaFirst,
  type SeriesRow,
} from '@/services/company.service'
import {
  filterRestaurantCheckoutSeries,
  hasRestaurantCheckoutSeries,
} from '@/utils/restaurantCheckoutSeries'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'

type CacheEntry = {
  series: SeriesRow[]
  sunatEnabled: boolean
  ready: boolean
}

type BranchCheckoutSeriesContextValue = {
  checkoutSeries: SeriesRow[]
  seriesMetaReady: boolean
  hasCheckoutSeries: boolean
  /** Facturación electrónica SUNAT habilitada en el tenant (panel central). */
  sunatEnabled: boolean
  /** Fuerza recarga de la sucursal activa (p. ej. tras crear serie en Ajustes). */
  refreshCheckoutSeries: () => Promise<void>
  /** Invalida caché de una sucursal; si es la activa, recarga. */
  invalidateCheckoutSeries: (branchId?: number) => void
}

const BranchCheckoutSeriesContext = createContext<BranchCheckoutSeriesContextValue | undefined>(
  undefined,
)

export function BranchCheckoutSeriesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { activeBranchId, resetEpoch } = useBranch()
  const cacheRef = useRef<Map<number, CacheEntry>>(new Map())
  const inflightRef = useRef<Map<number, Promise<void>>>(new Map())
  const [version, setVersion] = useState(0)

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const loadForBranch = useCallback(
    async (branchId: number, force = false) => {
      if (!branchId) return
      const cached = cacheRef.current.get(branchId)
      if (!force && cached?.ready) return

      const existing = inflightRef.current.get(branchId)
      if (existing && !force) {
        await existing
        return
      }

      const task = (async () => {
        try {
          const [raw, sunat] = await Promise.all([
            companyService.listSeries({
              branch_id: branchId,
              category: 'venta',
            }),
            companyService.getSunat().catch(() => ({ sunat_enabled: false } as const)),
          ])
          const enabled = Boolean(sunat.sunat_enabled)
          const ordered = sortSeriesNotaVentaFirst(
            filterRestaurantCheckoutSeries(raw ?? [], { sunatEnabled: enabled }),
          )
          cacheRef.current.set(branchId, { series: ordered, sunatEnabled: enabled, ready: true })
        } catch {
          cacheRef.current.set(branchId, { series: [], sunatEnabled: false, ready: true })
        } finally {
          inflightRef.current.delete(branchId)
          bump()
        }
      })()

      inflightRef.current.set(branchId, task)
      await task
    },
    [bump],
  )

  useEffect(() => {
    if (!isAuthenticated) {
      cacheRef.current.clear()
      inflightRef.current.clear()
      bump()
      return
    }
    if (!activeBranchId) return
    void loadForBranch(activeBranchId)
  }, [isAuthenticated, activeBranchId, resetEpoch, loadForBranch, bump])

  const invalidateCheckoutSeries = useCallback(
    (branchId?: number) => {
      const id = branchId ?? activeBranchId
      if (!id) return
      cacheRef.current.delete(id)
      bump()
      if (id === activeBranchId) {
        void loadForBranch(id, true)
      }
    },
    [activeBranchId, loadForBranch, bump],
  )

  const refreshCheckoutSeries = useCallback(async () => {
    if (!activeBranchId) return
    await loadForBranch(activeBranchId, true)
  }, [activeBranchId, loadForBranch])

  const entry = activeBranchId ? cacheRef.current.get(activeBranchId) : undefined
  const checkoutSeries = entry?.series ?? []
  const seriesMetaReady = !activeBranchId || Boolean(entry?.ready)
  const sunatEnabled = entry?.sunatEnabled ?? false

  const value = useMemo(
    () => ({
      checkoutSeries,
      seriesMetaReady,
      hasCheckoutSeries: hasRestaurantCheckoutSeries(checkoutSeries),
      sunatEnabled,
      refreshCheckoutSeries,
      invalidateCheckoutSeries,
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version dispara lectura de cacheRef
    [checkoutSeries, seriesMetaReady, sunatEnabled, refreshCheckoutSeries, invalidateCheckoutSeries, version],
  )

  return (
    <BranchCheckoutSeriesContext.Provider value={value}>{children}</BranchCheckoutSeriesContext.Provider>
  )
}

export function useBranchCheckoutSeries() {
  const ctx = useContext(BranchCheckoutSeriesContext)
  if (!ctx) {
    throw new Error('useBranchCheckoutSeries requiere BranchCheckoutSeriesProvider')
  }
  return ctx
}
