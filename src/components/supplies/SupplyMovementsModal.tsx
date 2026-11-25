import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { suppliesService, type Supply, type SupplyMovement } from '@/services/supplies.service'
import { apiError, formatQty } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SupplyModalShell } from './SupplyModalShell'

const PAGE_SIZE = 50

const TYPE_LABEL: Record<string, string> = { in: 'Entrada', out: 'Salida', adjustment: 'Ajuste', transfer: 'Traslado' }

type Props = { supply: Supply; branchId: number; onClose: () => void }

export function SupplyMovementsModal({ supply, branchId, onClose }: Props) {
  const [rows, setRows] = useState<SupplyMovement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    suppliesService
      .movements(supply.id, page, branchId)
      .then((r) => {
        if (cancelled) return
        setRows(r.data)
        setTotal(r.total)
      })
      .catch((e) => toast.error(apiError(e, 'No se pudo cargar el kardex')))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supply.id, page, branchId])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <SupplyModalShell
      wide
      title="Movimientos"
      subtitle={`${supply.name} · ${supply.unit}`}
      onClose={onClose}
      footer={
        pages > 1 ? (
          <>
            <button type="button" className={SUPPLY_BTN_GHOST} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <span className="self-center text-xs text-stone-500">{page} / {pages}</span>
            <button type="button" className={SUPPLY_BTN_GHOST} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <p className="py-4 text-center text-sm text-stone-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-500">Todavía no tiene movimientos.</p>
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
                {m.unit_cost != null && m.unit_cost > 0 && <p className="text-xs text-stone-500">S/ {m.unit_cost.toFixed(2)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SupplyModalShell>
  )
}
