import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Package, Play, Trash2 } from 'lucide-react'
import { restaurantService, type KitchenComanda } from '@/services/restaurant.service'
import type { ComandasKitchenProps } from '@/components/comandas/comandasKitchenProps'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'
import {
  type ComandaStatus,
  COMANDA_STATUS_LABEL,
  getNextComandaStatus,
} from '@/utils/comandasKitchen'
import { formatModifierLines, parseStoredModifiers } from '@/utils/productModifiers'

const STATUS_OPTIONS: {
  value: ComandaStatus
  label: string
  bg: string
  text: string
  activeBg: string
  activeText: string
}[] = [
  {
    value: 'pendiente',
    label: 'Pendiente',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    activeBg: 'bg-amber-600',
    activeText: 'text-white',
  },
  {
    value: 'preparacion',
    label: 'En preparación',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    activeBg: 'bg-blue-600',
    activeText: 'text-white',
  },
  {
    value: 'lista',
    label: 'Listo',
    bg: 'bg-green-50',
    text: 'text-green-800',
    activeBg: 'bg-green-600',
    activeText: 'text-white',
  },
  {
    value: 'entregada',
    label: 'Entregado',
    bg: 'bg-stone-100',
    text: 'text-stone-700',
    activeBg: 'bg-stone-700',
    activeText: 'text-white',
  },
]

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-900 border-amber-200',
    preparacion: 'bg-blue-100 text-blue-900 border-blue-200',
    lista: 'bg-green-100 text-green-900 border-green-200',
    entregada: 'bg-stone-100 text-stone-700 border-stone-200',
  }
  return map[status] ?? 'bg-stone-100 text-stone-700 border-stone-200'
}

export function ComandasItemsView({ comandas, loading, onReload }: ComandasKitchenProps) {
  const [filter, setFilter] = useState<ComandaStatus>('pendiente')
  const [anullModal, setAnullModal] = useState<KitchenComanda | null>(null)
  const [anullPin, setAnullPin] = useState('')
  const [anullReason, setAnullReason] = useState('')

  const filtered = comandas.filter((c) => (c.status as ComandaStatus) === filter)
  const counts = comandas.reduce(
    (acc, c) => {
      const k = (c.status as ComandaStatus) || 'pendiente'
      if (k in acc) acc[k] += 1
      return acc
    },
    { pendiente: 0, preparacion: 0, lista: 0, entregada: 0 } as Record<ComandaStatus, number>,
  )

  const advanceStatus = async (item: KitchenComanda) => {
    const next = getNextComandaStatus(item.status)
    if (!next) return
    try {
      await restaurantService.updateComandaStatus(item.id, next)
      toast.success('Estado actualizado')
      onReload()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const handleAnull = async () => {
    if (!anullModal) return
    if (!anullReason.trim()) {
      toast.error('Indica el motivo')
      return
    }
    if (!anullPin.trim()) {
      toast.error('Ingresa el PIN de seguridad')
      return
    }
    try {
      await restaurantService.cancelComanda(anullModal.id, anullReason, anullPin)
      toast.success('Comanda anulada')
      setAnullModal(null)
      setAnullPin('')
      setAnullReason('')
      onReload()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  return (
    <>
      <div className="-mx-1 px-1 pb-2 sm:pb-3">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = filter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`snap-start shrink-0 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap touch-manipulation ${
                  isActive
                    ? `${opt.activeBg} ${opt.activeText} border-transparent`
                    : `${opt.bg} ${opt.text} border-stone-200`
                }`}
              >
                {opt.label}
                <span className="ml-1 opacity-90">({counts[opt.value]})</span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 sm:py-16">
          <div className="w-9 h-9 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 sm:py-16 text-stone-400 text-sm px-4">
          No hay ítems en estado «{COMANDA_STATUS_LABEL[filter]}».
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4 pb-4">
          {filtered.map((c) => (
            <article
              key={c.id}
              className="bg-white rounded-xl sm:rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-sm flex flex-col gap-2 sm:gap-3 min-h-0"
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg leading-tight line-clamp-2">
                    {c.product_name}
                  </h3>
                  <p className="text-sm text-stone-600 mt-0.5">
                    Cant. <span className="font-semibold tabular-nums">{c.quantity}</span>
                  </p>
                  <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5 line-clamp-2">
                    {c.order_code
                      ? `${c.order_code}${c.order_number ? ` · Comanda #${c.order_number}` : ''}`
                      : c.session_id
                        ? `Pedido #${c.session_id}`
                        : ''}
                    {c.table_name ? ` · ${c.table_name}` : ''}
                    {c.order_type === 'delivery' && c.delivery_address
                      ? ` · ${c.delivery_address}`
                      : ''}
                  </p>
                  {(c.preparation_area || '').trim() && (
                    <span className="inline-block mt-1 text-[10px] font-medium text-violet-800 bg-violet-50 px-1.5 py-0.5 rounded capitalize">
                      {(c.preparation_area || '').trim()}
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-lg border ${statusBadgeClass(c.status)}`}
                >
                  {COMANDA_STATUS_LABEL[(c.status as ComandaStatus) || 'pendiente']}
                </span>
              </div>

              {(() => {
                const modLines = formatModifierLines(parseStoredModifiers(c.modifiers_json))
                if (modLines.length === 0) return null
                return (
                  <ul className="text-xs text-stone-700 bg-stone-50 border border-stone-100 rounded-lg px-2 py-1.5 space-y-0.5">
                    {modLines.map((line) => (
                      <li key={line} className="pl-2 border-l-2 border-rest-400">
                        {line}
                      </li>
                    ))}
                  </ul>
                )
              })()}

              {c.notes ? (
                <p className="text-xs sm:text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                  {c.notes}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-auto pt-1">
                {(() => {
                  const st = (c.status as ComandaStatus) || 'pendiente'
                  const next = getNextComandaStatus(c.status)
                  if (!next) return null
                  return (
                    <button
                      type="button"
                      onClick={() => void advanceStatus(c)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-rest-600 text-white text-xs font-semibold hover:bg-rest-700 touch-manipulation min-h-[2.5rem] sm:min-h-0"
                    >
                      {st === 'pendiente' && <Play size={14} />}
                      {st === 'preparacion' && <Package size={14} />}
                      {st === 'lista' && <Check size={14} />}
                      {st === 'pendiente' ? 'Preparar' : st === 'preparacion' ? 'Listo' : 'Entregar'}
                    </button>
                  )
                })()}
                <button
                  type="button"
                  onClick={() => setAnullModal(c)}
                  className="inline-flex items-center justify-center gap-1.5 px-2 py-2 sm:p-1.5 rounded-lg text-red-600 border border-red-100 hover:bg-red-50 touch-manipulation text-xs font-medium min-h-[2.5rem] sm:min-h-0 sm:ml-auto"
                  title="Anular comanda"
                >
                  <Trash2 size={16} />
                  Anular
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {anullModal ? (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4`}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full max-w-sm space-y-3">
            <h3 className="font-bold text-stone-900">Anular comanda</h3>
            <p className="text-sm text-stone-600">{anullModal.product_name}</p>
            <textarea
              value={anullReason}
              onChange={(e) => setAnullReason(e.target.value)}
              placeholder="Motivo"
              className="w-full border border-stone-200 rounded-xl p-2.5 text-sm"
              rows={2}
            />
            <input
              type="password"
              value={anullPin}
              onChange={(e) => setAnullPin(e.target.value)}
              placeholder="PIN de operaciones"
              className="w-full border border-stone-200 rounded-xl p-2.5 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAnullModal(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm touch-manipulation"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleAnull()}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium touch-manipulation"
              >
                Anular
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
