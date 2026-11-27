import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { suppliesService, type Supply, type SupplyMovement } from '@/services/supplies.service'
import { supplyPurchasesService, type SupplyHistoryRow } from '@/services/supplyPurchases.service'
import { apiError, formatCost, formatQty, parseAmount } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from './SupplyModalShell'

const PAGE_SIZE = 50

const TYPE_LABEL: Record<string, string> = { in: 'Entrada', out: 'Salida', adjustment: 'Ajuste', transfer: 'Traslado' }

type Props = {
  supply: Supply
  branchId: number
  canManage: boolean
  canViewCost: boolean
  onClose: () => void
  onChanged: () => void
}

export function SupplyMovementsModal({ supply, branchId, canManage, canViewCost, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<'movements' | 'purchases'>('movements')
  const [rows, setRows] = useState<SupplyMovement[]>([])
  const [history, setHistory] = useState<SupplyHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const request =
      tab === 'movements'
        ? suppliesService.movements(supply.id, page, branchId).then((r) => {
            if (cancelled) return
            setRows(r.data)
            setTotal(r.total)
          })
        : supplyPurchasesService.history(supply.id, branchId).then((list) => {
            if (!cancelled) setHistory(list)
          })
    request
      .catch((e) => toast.error(apiError(e, 'No se pudo cargar')))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supply.id, page, branchId, tab, version])

  const loadInitial = async (e: FormEvent) => {
    e.preventDefault()
    const qty = parseAmount(quantity)
    const unitCost = parseAmount(cost)
    if (!qty) return void toast.error('Indica cuánto hay')
    if (unitCost === null) return void toast.error('El costo no es válido')
    setSaving(true)
    try {
      await supplyPurchasesService.initialStock(supply.id, qty, unitCost)
      toast.success('Carga inicial registrada')
      setVersion((v) => v + 1)
      onChanged()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo registrar la carga inicial'))
    } finally {
      setSaving(false)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // La carga inicial solo existe mientras el insumo no tenga ningún movimiento en la sucursal.
  const canLoadInitial = canManage && branchId > 0 && !loading && tab === 'movements' && total === 0

  return (
    <SupplyModalShell
      wide
      title="Movimientos"
      subtitle={`${supply.name} · ${supply.unit}`}
      onClose={onClose}
      footer={
        tab === 'movements' && pages > 1 ? (
          <>
            <button type="button" className={SUPPLY_BTN_GHOST} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <span className="self-center text-xs text-stone-500">{page} / {pages}</span>
            <button type="button" className={SUPPLY_BTN_GHOST} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
          </>
        ) : undefined
      }
    >
      <div className="mb-2 flex gap-1">
        {(['movements', 'purchases'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-rest-600 text-white' : 'bg-stone-100 text-stone-600')}
          >
            {t === 'movements' ? 'Kardex' : 'Compras'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-stone-500">Cargando…</p>
      ) : tab === 'purchases' ? (
        history.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">Todavía no se ha comprado.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {history.map((h, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{h.supplier || 'Sin proveedor'}</p>
                  <p className="text-xs text-stone-500">{h.issue_date} · {h.document}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-stone-800">{formatQty(h.quantity)} {h.unit}</p>
                  {h.line_total != null && <p className="text-xs text-stone-500">{formatCost(h.line_total)}</p>}
                  {h.status === 'cancelled' && <p className="text-xs text-red-600">Anulada</p>}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-sm text-stone-500">Todavía no tiene movimientos.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800">{TYPE_LABEL[m.type] ?? m.type}</p>
                <p className="truncate text-xs text-stone-500">
                  {new Date(m.created_at).toLocaleString('es-PE')}
                  {m.reference ? ` · ${m.reference}` : ''}
                </p>
                {m.notes && <p className="text-xs text-stone-500">{m.notes}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-stone-800">{formatQty(m.quantity)}</p>
                <p className="text-xs text-stone-500">saldo {formatQty(m.balance)}</p>
                {m.cost_unknown && <p className="text-xs text-amber-700">sin costo</p>}
                {m.unit_cost != null && m.unit_cost > 0 && <p className="text-xs text-stone-500">{formatCost(m.unit_cost)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canLoadInitial && (
        <form onSubmit={loadInitial} className="mt-2 space-y-3 rounded-xl border border-stone-200 p-3">
          <p className="text-sm font-semibold text-stone-800">Carga inicial</p>
          <p className="text-xs text-stone-500">Cuánto tienes hoy en esta sucursal. Se hace una sola vez.</p>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={SUPPLY_LABEL}>Cantidad ({supply.unit})</span>
              <input className={SUPPLY_INPUT} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
            {canViewCost && (
              <label>
                <span className={SUPPLY_LABEL}>Costo de 1 {supply.unit}, sin IGV</span>
                <input className={SUPPLY_INPUT} inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
              </label>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" className={SUPPLY_BTN_PRIMARY} disabled={saving}>Registrar carga inicial</button>
          </div>
        </form>
      )}
    </SupplyModalShell>
  )
}
