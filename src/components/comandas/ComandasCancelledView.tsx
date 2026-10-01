import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Ban } from 'lucide-react'
import { restaurantService, type CancelledComanda } from '@/services/restaurant.service'
import { formatSoles } from '@/utils/format'
import { formatModifierLines, parseStoredModifiers } from '@/utils/productModifiers'

const PER_PAGE = 50

function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function originLabel(c: CancelledComanda): string {
  if (c.table_name) return c.floor_name ? `${c.table_name} · ${c.floor_name}` : c.table_name
  if (c.order_type === 'delivery') return 'Delivery'
  if (c.order_type === 'llevar') return 'Para llevar'
  return c.order_code || 'Venta rápida'
}

/** Historial de comandas anuladas (por ítem o junto con su pedido), con motivo y quién las anuló. */
export function ComandasCancelledView() {
  const [from, setFrom] = useState(todayISO)
  const [to, setTo] = useState(todayISO)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CancelledComanda[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    restaurantService
      .listCancelledComandas({ from, to, q: q.trim() || undefined, page, per_page: PER_PAGE })
      .then((r) => {
        setRows(r.data)
        setTotal(r.total)
      })
      .catch(() => toast.error('No se pudo cargar el historial de anuladas'))
      .finally(() => setLoading(false))
  }, [from, to, q, page])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const lostAmount = rows.reduce((a, c) => a + Number(c.quantity) * Number(c.unit_price), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-3">
        <label className="text-xs text-stone-500">
          Desde
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            className="mt-0.5 block min-h-[40px] rounded-lg border border-stone-200 px-2 text-sm text-stone-800"
          />
        </label>
        <label className="text-xs text-stone-500">
          Hasta
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            className="mt-0.5 block min-h-[40px] rounded-lg border border-stone-200 px-2 text-sm text-stone-800"
          />
        </label>
        <label className="flex-1 min-w-[10rem] text-xs text-stone-500">
          Buscar
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Producto o motivo…"
            className="mt-0.5 block w-full min-h-[40px] rounded-lg border border-stone-200 px-3 text-sm text-stone-800"
          />
        </label>
        <p className="text-xs text-stone-500 ml-auto tabular-nums">
          {total} anulada{total === 1 ? '' : 's'}
          {rows.length > 0 && <> · en esta página {formatSoles(lostAmount)}</>}
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="px-3 py-2">Anulada</th>
              <th className="px-3 py-2">Origen</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-center">Cant.</th>
              <th className="px-3 py-2 text-right">Importe</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Anulada por</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-stone-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-stone-400">
                  <Ban className="mx-auto mb-1" size={22} />
                  No hay comandas anuladas en este rango.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((c) => {
                const mods = formatModifierLines(parseStoredModifiers(c.modifiers_json))
                return (
                  <tr key={c.id} className="border-b border-stone-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {fmtDateTime(c.cancelled_at)}
                      <div className="text-[11px] text-stone-400">Pedido: {fmtDateTime(c.created_at)}</div>
                    </td>
                    <td className="px-3 py-2">
                      {originLabel(c)}
                      <div className="text-[11px] text-stone-400">Pedido #{c.order_number}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-stone-800">{c.product_name}</div>
                      {mods.map((l) => (
                        <div key={l} className="text-xs text-stone-500 pl-2">
                          {l}
                        </div>
                      ))}
                      {c.notes?.trim() ? <div className="text-xs text-amber-700 italic">Obs: {c.notes.trim()}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{c.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatSoles(Number(c.quantity) * Number(c.unit_price))}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{c.cancel_reason?.trim() || '—'}</td>
                    <td className="px-3 py-2 text-stone-700">{c.cancelled_by_name || '—'}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="tabular-nums text-stone-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
