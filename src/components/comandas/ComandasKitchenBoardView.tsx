import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChefHat, LayoutGrid, ShoppingBag, Truck, Check, Play, Package } from 'lucide-react'
import { restaurantService, type KitchenComanda } from '@/services/restaurant.service'
import type { ComandasKitchenProps } from '@/components/comandas/comandasKitchenProps'
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from '@/types/restaurantOrder'
import {
  orderStatusBadgeClasses,
  orderTypeChipClasses,
  orderTypeTabClasses,
} from '@/utils/restaurantUiColors'
import {
  type ComandaStatus,
  COMANDA_STATUS_LABEL,
  getNextComandaStatus,
  groupKitchenComandas,
  kitchenSessionSubtitle,
  kitchenSessionTitle,
  tableFilterOptions,
  type KitchenSessionGroup,
} from '@/utils/comandasKitchen'

type OrderTab = 'all' | 'dine_in' | 'delivery' | 'takeaway'

const TAB_CONFIG: { id: OrderTab; label: string; short: string; icon: typeof ChefHat }[] = [
  { id: 'all', label: 'Todos', short: 'Todos', icon: ChefHat },
  { id: 'dine_in', label: 'Mesas', short: 'Mesas', icon: LayoutGrid },
  { id: 'delivery', label: 'Delivery', short: 'Deliv.', icon: Truck },
  { id: 'takeaway', label: 'Para llevar', short: 'Llevar', icon: ShoppingBag },
]

const STATUS_TABS: { id: ComandaStatus; label: string; short: string }[] = [
  { id: 'pendiente', label: 'Pendiente', short: 'Pend.' },
  { id: 'preparacion', label: 'En preparación', short: 'Prep.' },
  { id: 'lista', label: 'Listo', short: 'Listo' },
  { id: 'entregada', label: 'Entregado', short: 'Entr.' },
]

function elapsedLabel(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}m`
}

export function ComandasKitchenBoardView({ comandas, loading, onReload }: ComandasKitchenProps) {
  const [tab, setTab] = useState<OrderTab>('all')
  const [statusFilter, setStatusFilter] = useState<ComandaStatus>('pendiente')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const statusCounts = useMemo(() => {
    const acc = { pendiente: 0, preparacion: 0, lista: 0, entregada: 0 }
    for (const c of comandas) {
      const st = (c.status as ComandaStatus) || 'pendiente'
      if (st in acc) acc[st] += 1
    }
    return acc
  }, [comandas])

  const preparationAreas = useMemo(() => {
    const set = new Set<string>()
    for (const c of comandas) {
      const a = (c.preparation_area || '').trim().toLowerCase()
      if (a) set.add(a)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [comandas])

  const filteredComandas = useMemo(() => {
    return comandas.filter((c) => {
      if ((c.status as ComandaStatus) !== statusFilter) return false
      if (tab !== 'all' && c.order_type !== tab) return false
      if (areaFilter !== 'all') {
        const area = (c.preparation_area || 'cocina').trim().toLowerCase()
        if (area !== areaFilter) return false
      }
      if (tableFilter !== 'all') {
        const key = c.table_id != null ? `t-${c.table_id}` : (c.table_name ?? '')
        if (key !== tableFilter) return false
      }
      return true
    })
  }, [comandas, statusFilter, tab, areaFilter, tableFilter])

  const sessionGroups = useMemo(() => groupKitchenComandas(filteredComandas), [filteredComandas])

  const tableOptions = useMemo(() => {
    const allGroups = groupKitchenComandas(
      comandas.filter((c) => {
        if ((c.status as ComandaStatus) !== statusFilter) return false
        if (tab !== 'all' && tab !== 'dine_in') return false
        if (c.order_type !== 'dine_in') return false
        return true
      }),
    )
    return tableFilterOptions(allGroups)
  }, [comandas, statusFilter, tab])

  useEffect(() => {
    if (tableFilter !== 'all' && !tableOptions.some((t) => t.id === tableFilter)) {
      setTableFilter('all')
    }
  }, [tableFilter, tableOptions])

  const updateStatus = async (id: number, status: ComandaStatus) => {
    setUpdatingId(id)
    try {
      await restaurantService.updateComandaStatus(id, status)
      toast.success('Estado actualizado')
      onReload()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setUpdatingId(null)
    }
  }

  const markRoundReady = async (items: KitchenComanda[]) => {
    const pending = items.filter((i) => i.status === 'pendiente' || i.status === 'preparacion')
    if (pending.length === 0) return
    setUpdatingId(-1)
    try {
      await Promise.all(
        pending.map((i) => restaurantService.updateComandaStatus(i.id, 'lista')),
      )
      toast.success('Ronda marcada como lista')
      onReload()
    } catch {
      toast.error('No se pudo actualizar la ronda')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <div className="-mx-1 px-1 pb-2 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x">
          {STATUS_TABS.map((st) => {
            const active = statusFilter === st.id
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`snap-start shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border touch-manipulation whitespace-nowrap ${
                  active
                    ? 'bg-rest-600 text-white border-rest-600'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span className="sm:hidden">{st.short}</span>
                <span className="hidden sm:inline">{st.label}</span>
                <span className="ml-1 opacity-90">({statusCounts[st.id]})</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x">
          {TAB_CONFIG.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id)
                  if (t.id !== 'dine_in' && t.id !== 'all') setTableFilter('all')
                }}
                className={`${orderTypeTabClasses(t.id, active)} snap-start touch-manipulation`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {(tab === 'all' || tab === 'dine_in') && tableOptions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x">
            <button
              type="button"
              onClick={() => setTableFilter('all')}
              className={`snap-start shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border touch-manipulation ${
                tableFilter === 'all'
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-700 border-stone-200'
              }`}
            >
              Todas las mesas
            </button>
            {tableOptions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTableFilter(t.id)}
                className={`snap-start shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border touch-manipulation whitespace-nowrap ${
                  tableFilter === t.id
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-700 border-stone-200'
                }`}
              >
                {t.label}
                <span className="ml-1 opacity-80">({t.count})</span>
              </button>
            ))}
          </div>
        )}

        {preparationAreas.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x">
            <button
              type="button"
              onClick={() => setAreaFilter('all')}
              className={`snap-start shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border touch-manipulation ${
                areaFilter === 'all'
                  ? 'bg-violet-700 text-white border-violet-700'
                  : 'bg-white text-stone-700 border-stone-200'
              }`}
            >
              Todas las áreas
            </button>
            {preparationAreas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAreaFilter(a)}
                className={`snap-start shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border touch-manipulation capitalize ${
                  areaFilter === a
                    ? 'bg-violet-700 text-white border-violet-700'
                    : 'bg-white text-stone-700 border-stone-200'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-9 h-9 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessionGroups.length === 0 ? (
        <p className="text-center py-12 text-stone-400 text-sm px-4">
          No hay ítems en «{COMANDA_STATUS_LABEL[statusFilter]}» para los filtros seleccionados.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 pb-6">
          {sessionGroups.map((group) => (
            <SessionKitchenCard
              key={group.sessionId}
              group={group}
              statusFilter={statusFilter}
              updatingId={updatingId}
              onUpdateStatus={updateStatus}
              onMarkRoundReady={markRoundReady}
            />
          ))}
        </div>
      )}
    </>
  )
}

function SessionKitchenCard({
  group,
  statusFilter,
  updatingId,
  onUpdateStatus,
  onMarkRoundReady,
}: {
  group: KitchenSessionGroup
  statusFilter: ComandaStatus
  updatingId: number | null
  onUpdateStatus: (id: number, status: ComandaStatus) => void
  onMarkRoundReady: (items: KitchenComanda[]) => void
}) {
  const subtitle = kitchenSessionSubtitle(group)
  const elapsed = elapsedLabel(group.meta.openedAt)

  return (
    <article
      className={`bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col ${
        group.meta.orderType === 'delivery'
          ? 'border-l-4 border-l-violet-500'
          : group.meta.orderType === 'takeaway'
            ? 'border-l-4 border-l-amber-500'
            : 'border-l-4 border-l-rest-500'
      }`}
    >
      <header className="px-3 py-2.5 border-b border-stone-100 bg-stone-50/80 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-stone-900 text-sm leading-tight truncate">
              {kitchenSessionTitle(group)}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-stone-600 mt-0.5 line-clamp-2 leading-snug">{subtitle}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={orderTypeChipClasses(group.meta.orderType)}>
              {ORDER_TYPE_LABELS[group.meta.orderType] ?? group.meta.orderType}
            </span>
            {group.meta.orderStatus && (
              <span className={`text-[10px] ${orderStatusBadgeClasses(group.meta.orderStatus)}`}>
                {ORDER_STATUS_LABELS[group.meta.orderStatus] ?? group.meta.orderStatus}
              </span>
            )}
          </div>
        </div>
        {elapsed && <p className="text-[10px] text-stone-400">Abierto hace {elapsed}</p>}
      </header>

      <div className="p-2 space-y-2 flex-1 min-h-0">
        {group.rounds.map((round) => {
          const visibleItems = round.items.filter((i) => i.status === statusFilter)
          if (visibleItems.length === 0) return null
          const canMarkRound =
            statusFilter !== 'entregada' &&
            visibleItems.some((i) => i.status === 'pendiente' || i.status === 'preparacion')

          return (
            <div key={round.orderId} className="rounded-xl border border-stone-200/90 bg-stone-50/40 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border-b border-stone-100">
                <span className="text-xs font-semibold text-stone-800">Comanda #{round.orderNumber}</span>
                {canMarkRound && (
                  <button
                    type="button"
                    disabled={updatingId !== null}
                    onClick={() => void onMarkRoundReady(round.items)}
                    className="text-[10px] font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    Marcar ronda lista
                  </button>
                )}
              </div>
              <ul className="divide-y divide-stone-100">
                {visibleItems.map((item) => (
                  <KitchenItemRow
                    key={item.id}
                    item={item}
                    busy={updatingId === item.id}
                    onAdvance={() => {
                      const next = getNextComandaStatus(item.status)
                      if (next) void onUpdateStatus(item.id, next)
                    }}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function KitchenItemRow({
  item,
  busy,
  onAdvance,
}: {
  item: KitchenComanda
  busy: boolean
  onAdvance: () => void
}) {
  const st = (item.status as ComandaStatus) || 'pendiente'
  const next = getNextComandaStatus(item.status)
  const area = (item.preparation_area || '').trim()

  return (
    <li className="px-2.5 py-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-stone-900 text-sm leading-tight">
          <span className="text-rest-600 tabular-nums">{item.quantity}×</span> {item.product_name}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {area && (
            <span className="text-[10px] font-medium text-violet-800 bg-violet-50 px-1.5 py-0.5 rounded capitalize">
              {area}
            </span>
          )}
          <span className="text-[10px] text-stone-500">{COMANDA_STATUS_LABEL[st]}</span>
        </div>
        {item.notes && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 mt-1">
            {item.notes}
          </p>
        )}
      </div>
      {next && (
        <button
          type="button"
          disabled={busy}
          onClick={onAdvance}
          className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-rest-600 text-white text-xs font-semibold hover:bg-rest-700 disabled:opacity-50 touch-manipulation min-h-[2.5rem] sm:min-h-0"
        >
          {st === 'pendiente' && <Play size={14} />}
          {st === 'preparacion' && <Package size={14} />}
          {st === 'lista' && <Check size={14} />}
          {st === 'pendiente' ? 'Preparar' : st === 'preparacion' ? 'Listo' : 'Entregar'}
        </button>
      )}
    </li>
  )
}
