import { useMemo, useState } from 'react'
import { X, Receipt, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { PortalModal } from '@/components/ui/PortalModal'
import type { Comanda, SessionDetail } from '@/services/restaurant.service'
import { comandaLineTaxTotals, pendingComandas } from '@/utils/posOrderHelpers'
import type { TaxConfig } from '@/utils/taxCalc'
import { formatSoles } from '@/utils/format'
import { sumMoney } from '@/utils/money'

type Props = {
  open: boolean
  onClose: () => void
  session: SessionDetail | null
  taxRate: number
  taxConfig: Partial<TaxConfig>
  onConfirmSelection: (comandaIds: number[]) => void
}

/** Comandas agrupadas: las de un mismo combo (combo_parent_key) se eligen todas juntas. */
function groupComandas(list: Comanda[]): { key: string; items: Comanda[] }[] {
  const groups: { key: string; items: Comanda[] }[] = []
  const byKey = new Map<string, { key: string; items: Comanda[] }>()
  for (const c of list) {
    const key = c.combo_parent_key ? `combo:${c.combo_parent_key}` : `single:${c.id}`
    const existing = byKey.get(key)
    if (existing) {
      existing.items.push(c)
    } else {
      const group = { key, items: [c] }
      byKey.set(key, group)
      groups.push(group)
    }
  }
  return groups
}

export function SplitBillModal({ open, onClose, session, taxRate, taxConfig, onConfirmSelection }: Props) {
  // Sin efecto de reseteo: el padre desmonta este componente al cerrar (open=false → no se
  // renderiza), así que cada apertura es un mount nuevo y `selected` nace vacío solo.
  const [selected, setSelected] = useState<Set<number>>(() => new Set())

  const pending = useMemo(() => pendingComandas(session), [session])
  const groups = useMemo(() => groupComandas(pending), [pending])

  if (!open) return null

  const isGroupSelected = (items: Comanda[]) => items.every((c) => selected.has(c.id))
  const toggleGroup = (items: Comanda[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = items.every((c) => next.has(c.id))
      for (const c of items) {
        if (allSelected) next.delete(c.id)
        else next.add(c.id)
      }
      return next
    })
  }

  const selectedTotal = sumMoney(
    ...pending.filter((c) => selected.has(c.id)).map((c) => comandaLineTaxTotals(c, taxRate, taxConfig).total),
  )
  const selectedCount = selected.size

  return (
    <PortalModal open={open} onClose={onClose} className="max-w-lg" stacked>
      <div className="bg-white rounded-2xl shadow-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
          <div>
            <h3 className="font-bold text-stone-900 flex items-center gap-2">
              <Receipt size={18} /> Dividir cuenta
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Marca lo que va en este pago. El resto queda pendiente en la mesa.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {groups.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">No hay platos pendientes de cobro en esta mesa.</p>
          ) : (
            <ul className="space-y-1.5">
              {groups.map((g) => {
                const isCombo = g.items.length > 1 || Boolean(g.items[0]?.combo_parent_key)
                const groupTotal = sumMoney(...g.items.map((c) => comandaLineTaxTotals(c, taxRate, taxConfig).total))
                const active = isGroupSelected(g.items)
                return (
                  <li key={g.key}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.items)}
                      className={clsx(
                        'w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                        active ? 'border-rest-500 bg-rest-50' : 'border-stone-200 bg-white hover:bg-stone-50',
                      )}
                    >
                      <span
                        className={clsx(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                          active ? 'border-rest-600 bg-rest-600 text-white' : 'border-stone-300 bg-white',
                        )}
                      >
                        {active && <Check size={13} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        {isCombo && (
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">
                            Combo — se cobra completo
                          </span>
                        )}
                        {g.items.map((c) => (
                          <span key={c.id} className="block text-sm text-stone-800">
                            {c.quantity}x {c.product_name}
                          </span>
                        ))}
                      </span>
                      <span className="text-sm font-semibold text-stone-900 tabular-nums shrink-0">
                        {formatSoles(groupTotal)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-stone-200 shrink-0 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Seleccionado ({selectedCount})</span>
            <span className="font-bold text-stone-900 text-base">{formatSoles(selectedTotal)}</span>
          </div>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => onConfirmSelection([...selected])}
            className="w-full py-2.5 rounded-xl bg-rest-600 text-white text-sm font-semibold hover:bg-rest-700 disabled:opacity-50"
          >
            Cobrar seleccionado
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
