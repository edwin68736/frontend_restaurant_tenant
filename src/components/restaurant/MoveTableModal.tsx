import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { restaurantService, type Floor, type RestaurantTable } from '@/services/restaurant.service'
import { PortalModal } from '@/components/ui/PortalModal'
import { TableWithChairsVisual } from '@/components/restaurant/TableWithChairsVisual'
import { tableStatusStyles } from '@/utils/tableStatusStyles'
import { sortRestaurantTables } from '@/utils/sortRestaurantTables'

type Props = {
  open: boolean
  onClose: () => void
  sessionId: number
  currentTableId: number | null
  onMoved: (table: RestaurantTable) => void
}

/** Sesión open es la fuente de verdad: si hay session_id, la mesa está ocupada (igual que SalasPage). */
function tableEffectiveStatus(t: RestaurantTable): string {
  if (t.session_id) return 'ocupada'
  if (t.status === 'ocupada') return 'libre'
  return t.status
}

export function MoveTableModal({ open, onClose, sessionId, currentTableId, onMoved }: Props) {
  const [floors, setFloors] = useState<Floor[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [floorId, setFloorId] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [movingId, setMovingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setFloorId('')
    setLoading(true)
    Promise.all([restaurantService.listFloors(), restaurantService.listTables()])
      .then(([f, t]) => {
        setFloors(f)
        setTables(t)
      })
      .catch(() => toast.error('No se pudieron cargar las mesas'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const freeTables = sortRestaurantTables(
    tables.filter(
      (t) =>
        t.id !== currentTableId &&
        tableEffectiveStatus(t) === 'libre' &&
        (floorId === '' || t.floor_id === floorId),
    ),
    floors,
  )

  const handleMove = async (table: RestaurantTable) => {
    setMovingId(table.id)
    try {
      await restaurantService.moveSessionTable(sessionId, table.id)
      toast.success(`Mesa cambiada a ${table.name}`)
      onMoved(table)
      onClose()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo cambiar de mesa')
    } finally {
      setMovingId(null)
    }
  }

  return (
    <PortalModal open={open} onClose={onClose} className="max-w-2xl" stacked>
      <div className="bg-white rounded-2xl shadow-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
          <div>
            <h3 className="font-bold text-stone-900">Cambiar de mesa</h3>
            <p className="text-xs text-stone-500 mt-0.5">Elige la mesa libre a la que se cambia el cliente.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100">
            <X size={20} />
          </button>
        </div>

        {floors.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-1 shrink-0">
            <button
              type="button"
              onClick={() => setFloorId('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                floorId === '' ? 'bg-rest-600 text-white border-rest-600' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Todos
            </button>
            {floors.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFloorId(f.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  floorId === f.id ? 'bg-rest-600 text-white border-rest-600' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : freeTables.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">No hay mesas libres disponibles.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {freeTables.map((t) => {
                const st = tableStatusStyles('libre')
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={movingId !== null}
                    onClick={() => handleMove(t)}
                    className={`relative flex flex-col items-center rounded-xl border-2 p-2.5 transition-all disabled:opacity-50 disabled:cursor-wait ${st.card}`}
                  >
                    <TableWithChairsVisual name={t.name} capacity={t.capacity} status="libre" size="sm" />
                    <p className="text-xs font-semibold text-stone-900 truncate mt-1 max-w-full">{t.name}</p>
                    {t.floor_name && <p className="text-[10px] text-stone-500 truncate max-w-full">{t.floor_name}</p>}
                    {movingId === t.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl text-[11px] font-semibold text-rest-700">
                        Moviendo…
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PortalModal>
  )
}
