import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ComandasViewModeToggle, type ComandasViewMode } from '@/components/comandas/ComandasViewModeToggle'
import { ComandasItemsView } from '@/components/comandas/ComandasItemsView'
import { ComandasKitchenBoardView } from '@/components/comandas/ComandasKitchenBoardView'
import { restaurantService, type KitchenComanda } from '@/services/restaurant.service'
import { useBranch } from '@/contexts/BranchContext'

const VIEW_STORAGE_KEY = 'tukichef-comandas-view'

function readStoredView(): ComandasViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    if (v === 'orders' || v === 'items') return v
  } catch {
    /* ignore */
  }
  return 'items'
}

/** Comandas: vista por ítem (defecto) o por pedido agrupado. */
export default function ComandasPage() {
  const { resetEpoch } = useBranch()
  const [viewMode, setViewMode] = useState<ComandasViewMode>(readStoredView)
  const [comandas, setComandas] = useState<KitchenComanda[]>([])
  const [loading, setLoading] = useState(true)

  const loadKitchen = useCallback(() => {
    setLoading(true)
    restaurantService
      .getKitchen()
      .then(setComandas)
      .catch(() => toast.error('Error al cargar comandas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadKitchen()
  }, [loadKitchen, resetEpoch])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
    } catch {
      /* ignore */
    }
  }, [viewMode])

  const kitchenProps = { comandas, loading, onReload: loadKitchen }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <div className="mb-2 sm:mb-3 shrink-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden sm:block min-w-0">
            <h2 className="text-lg font-bold text-stone-800">Comandas</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              {viewMode === 'items'
                ? 'Cada línea enviada a cocina. Cambia el estado por ítem.'
                : 'Pedidos agrupados por mesa, delivery o llevar. Filtra mesas y cambia estados.'}
            </p>
          </div>
          <ComandasViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {viewMode === 'items' ? (
          <ComandasItemsView {...kitchenProps} />
        ) : (
          <ComandasKitchenBoardView {...kitchenProps} />
        )}
      </div>
    </div>
  )
}
