import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink, Truck, ShoppingBag, LayoutGrid, Trash2, ChefHat } from 'lucide-react'
import { VoidOrderPinModal } from '@/components/restaurant/VoidOrderPinModal'
import { restaurantService } from '@/services/restaurant.service'
import { useBranch } from '@/contexts/BranchContext'
import {
  ORDER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  type RestaurantOrderSummary,
} from '@/types/restaurantOrder'
import {
  orderStatusBadgeClasses,
  orderTypeCardAccentClasses,
  orderTypeChipClasses,
  orderTypeTabClasses,
} from '@/utils/restaurantUiColors'

type OrderTab = 'all' | 'dine_in' | 'delivery' | 'takeaway'

const TAB_CONFIG: { id: OrderTab; label: string; short: string; icon: typeof ChefHat }[] = [
  { id: 'all', label: 'Todos', short: 'Todos', icon: ChefHat },
  { id: 'dine_in', label: 'Mesas', short: 'Mesas', icon: LayoutGrid },
  { id: 'delivery', label: 'Delivery', short: 'Deliv.', icon: Truck },
  { id: 'takeaway', label: 'Para llevar', short: 'Llevar', icon: ShoppingBag },
]

function elapsedLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}m`
}

export function ComandasOrdersView() {
  const navigate = useNavigate()
  const { resetEpoch } = useBranch()
  const [tab, setTab] = useState<OrderTab>('all')
  const [orders, setOrders] = useState<RestaurantOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [voidOrder, setVoidOrder] = useState<RestaurantOrderSummary | null>(null)

  const load = () => {
    setLoading(true)
    restaurantService
      .listOpenOrders(tab)
      .then(setOrders)
      .catch(() => toast.error('Error al cargar pedidos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, resetEpoch])

  const openInPos = (order: RestaurantOrderSummary) => {
    navigate(`/pos?session=${order.id}`)
  }

  const requestVoidOrder = async (order: RestaurantOrderSummary) => {
    try {
      const ok = await restaurantService.ensureDeletionPinConfigured()
      if (!ok) {
        toast.error('Configure el PIN de operaciones en Ajustes → Restaurante')
        return
      }
      setVoidOrder(order)
    } catch {
      toast.error('No se pudo verificar el PIN de seguridad')
    }
  }

  const voidOrderWithPin = async (reason: string, pin: string) => {
    if (!voidOrder) return
    try {
      await restaurantService.cancelSession(voidOrder.id, reason.trim(), pin.trim())
      toast.success('Pedido anulado y eliminado')
      setVoidOrder(null)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al anular')
      throw e
    }
  }

  const markOnTheWay = async (order: RestaurantOrderSummary) => {
    try {
      await restaurantService.updateOrderStatus(order.id, 'on_the_way')
      toast.success('Marcado en camino')
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const markDelivered = async (order: RestaurantOrderSummary) => {
    try {
      await restaurantService.updateOrderStatus(order.id, 'delivered')
      toast.success('Marcado entregado')
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  return (
    <>
      <div className="-mx-1 px-1 pb-2 sm:pb-3">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
          {TAB_CONFIG.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`${orderTypeTabClasses(t.id, active)} snap-start touch-manipulation`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 sm:py-16">
          <div className="w-9 h-9 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center py-12 sm:py-16 text-stone-400 text-sm px-4">
          No hay pedidos abiertos en esta categoría.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4 pb-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className={`bg-white rounded-xl sm:rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow ${orderTypeCardAccentClasses(o.order_type)}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-stone-800 truncate text-sm sm:text-base">
                    {o.order_code || `#${o.id}`}
                  </p>
                  <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5">{elapsedLabel(o.opened_at)}</p>
                  <span className={`inline-block mt-1 ${orderTypeChipClasses(o.order_type)}`}>
                    {ORDER_TYPE_LABELS[o.order_type] ?? o.order_type}
                  </span>
                </div>
                <span className={`shrink-0 text-[10px] sm:text-xs ${orderStatusBadgeClasses(o.order_status)}`}>
                  {ORDER_STATUS_LABELS[o.order_status] ?? o.order_status}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-stone-600 space-y-0.5 mb-3">
                {o.table_name ? <p className="truncate">Mesa: {o.table_name}</p> : null}
                {(o.customer_name || o.contact_name) && (
                  <p className="truncate">Cliente: {o.customer_name || o.contact_name}</p>
                )}
                {o.order_type === 'delivery' && o.delivery_address ? (
                  <p className="text-[10px] sm:text-xs text-stone-500 line-clamp-2">{o.delivery_address}</p>
                ) : null}
                {o.driver_name ? <p className="text-[10px] sm:text-xs truncate">Repartidor: {o.driver_name}</p> : null}
                <p className="font-semibold text-stone-900 pt-0.5">S/ {Number(o.total_amount).toFixed(2)}</p>
                <p className="text-[10px] sm:text-xs text-stone-400">
                  {o.item_count} ítems · {o.active_comandas} en cocina
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => openInPos(o)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg bg-rest-600 text-white text-xs font-medium hover:bg-rest-700 touch-manipulation flex-1 sm:flex-none min-w-[7rem]"
                >
                  <ExternalLink size={14} /> Abrir en POS
                </button>
                {o.order_type === 'delivery' && o.order_status === 'ready' ? (
                  <button
                    type="button"
                    onClick={() => void markOnTheWay(o)}
                    className="px-2.5 py-2 sm:py-1.5 rounded-lg border border-stone-200 text-xs hover:bg-stone-50 touch-manipulation"
                  >
                    En camino
                  </button>
                ) : null}
                {o.order_type === 'delivery' && o.order_status === 'on_the_way' ? (
                  <button
                    type="button"
                    onClick={() => void markDelivered(o)}
                    className="px-2.5 py-2 sm:py-1.5 rounded-lg border border-stone-200 text-xs hover:bg-stone-50 touch-manipulation"
                  >
                    Entregado
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void requestVoidOrder(o)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 touch-manipulation"
                  title="Anular pedido (requiere PIN)"
                >
                  <Trash2 size={14} /> Anular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <VoidOrderPinModal
        open={!!voidOrder}
        title="Anular pedido"
        orderLabel={voidOrder?.order_code}
        description="Solo pedidos sin venta generada. Se eliminan comandas, ítems y el pedido."
        onClose={() => setVoidOrder(null)}
        onConfirm={voidOrderWithPin}
      />
    </>
  )
}
