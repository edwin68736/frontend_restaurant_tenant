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
  tenantCanEmitFactura,
  type SeriesRow,
} from '@/services/company.service'
import { filterRestaurantCheckoutSeries } from '@/utils/restaurantCheckoutSeries'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'

type CacheEntry = {
  series: SeriesRow[]
  sunatEnabled: boolean
  canFactura: boolean
  ready: boolean
  loadError: boolean
  /** Hay series de venta en otras sucursales, no en la activa. */
  seriesOnOtherBranches: boolean
}

type BranchCheckoutSeriesContextValue = {
  checkoutSeries: SeriesRow[]
  seriesMetaReady: boolean
  hasCheckoutSeries: boolean
  /** Facturación electrónica SUNAT habilitada en el tenant (panel central). */
  sunatEnabled: boolean
  /** ¿El régimen del tenant permite Factura (01)? (Nuevo RUS = false). */
  canFactura: boolean
  seriesLoadError: boolean
  seriesOnOtherBranches: boolean
  /** Fuerza recarga de la sucursal activa (p. ej. tras crear serie en Ajustes). */
  refreshCheckoutSeries: () => Promise<void>
  /** Invalida caché de una sucursal; si es la activa, recarga. */
  invalidateCheckoutSeries: (branchId?: number) => void
}

const BranchCheckoutSeriesContext = createContext<BranchCheckoutSeriesContextValue | undefined>(
  undefined,
)

const emptyEntry = (): CacheEntry => ({
  series: [],
  sunatEnabled: true,
  canFactura: true,
  ready: false,
  loadError: false,
  seriesOnOtherBranches: false,
})

export function BranchCheckoutSeriesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { activeBranchId, resetEpoch } = useBranch()
  const cacheRef = useRef<Map<number, CacheEntry>>(new Map())
  const inflightRef = useRef<Map<number, Promise<void>>>(new Map())
  const sunatRef = useRef<{ enabled: boolean; canFactura: boolean } | null>(null)
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
          if (!sunatRef.current) {
            const sunat = await companyService.getSunat().catch(() => null)
            // Si falla la consulta, no asumir SUNAT deshabilitado (evita ocultar F/B válidas).
            sunatRef.current = {
              enabled: sunat == null ? true : Boolean(sunat.sunat_enabled),
              canFactura: tenantCanEmitFactura(sunat),
            }
          }
          const enabled = sunatRef.current.enabled
          const canFactura = sunatRef.current.canFactura

          const raw = await companyService.listSeries({
            branch_id: branchId,
            category: 'venta',
          })

          let seriesOnOtherBranches = false
          if ((raw ?? []).length === 0) {
            const all = await companyService.listSeries({ category: 'venta' }).catch(() => [])
            seriesOnOtherBranches = (all ?? []).some((s) => s.branch_id !== branchId)
          }

          const ordered = sortSeriesNotaVentaFirst(
            filterRestaurantCheckoutSeries(raw ?? [], { sunatEnabled: enabled, canFactura }),
          )
          cacheRef.current.set(branchId, {
            series: ordered,
            sunatEnabled: enabled,
            canFactura,
            ready: true,
            loadError: false,
            seriesOnOtherBranches,
          })
        } catch {
          cacheRef.current.set(branchId, {
            ...emptyEntry(),
            ready: true,
            loadError: true,
          })
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
      sunatRef.current = null
      bump()
      return
    }
    if (!activeBranchId) return
    void loadForBranch(activeBranchId, true)
  }, [isAuthenticated, activeBranchId, resetEpoch, loadForBranch])

  const invalidateCheckoutSeries = useCallback(
    (branchId?: number) => {
      const id = branchId ?? activeBranchId
      if (!id) return
      cacheRef.current.delete(id)
      sunatRef.current = null
      bump()
      if (id === activeBranchId) {
        void loadForBranch(id, true)
      }
    },
    [activeBranchId, loadForBranch, bump],
  )

  const refreshCheckoutSeries = useCallback(async () => {
    if (!activeBranchId) return
    sunatRef.current = null
    await loadForBranch(activeBranchId, true)
  }, [activeBranchId, loadForBranch])

  const entry = activeBranchId ? cacheRef.current.get(activeBranchId) : undefined
  const checkoutSeries = entry?.series ?? []
  const seriesMetaReady = !activeBranchId || Boolean(entry?.ready)
  const sunatEnabled = entry?.sunatEnabled ?? true
  const canFactura = entry?.canFactura ?? true

  const value = useMemo(
    () => ({
      checkoutSeries,
      seriesMetaReady,
      hasCheckoutSeries: checkoutSeries.length > 0,
      sunatEnabled,
      canFactura,
      seriesLoadError: entry?.loadError ?? false,
      seriesOnOtherBranches: entry?.seriesOnOtherBranches ?? false,
      refreshCheckoutSeries,
      invalidateCheckoutSeries,
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version dispara lectura de cacheRef
    [
      checkoutSeries,
      seriesMetaReady,
      sunatEnabled,
      canFactura,
      entry?.loadError,
      entry?.seriesOnOtherBranches,
      refreshCheckoutSeries,
      invalidateCheckoutSeries,
      version,
    ],
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
