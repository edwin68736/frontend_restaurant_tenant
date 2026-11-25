import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import type { Supply } from '@/services/supplies.service'
import { supplyPurchasesService, type SupplyEntryKind } from '@/services/supplyPurchases.service'
import { idempotencyKeyFor, releaseIdempotencyKey } from '@/utils/idempotencyKey'
import { apiError, parseAmount } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from './SupplyModalShell'

const KINDS: { id: SupplyEntryKind; label: string; help: string }[] = [
  { id: 'ingreso', label: 'Ingreso', help: 'Suma stock sin comprobante (compra al paso, devolución).' },
  { id: 'merma', label: 'Merma', help: 'Resta lo que se perdió al preparar o por el paso del tiempo.' },
  { id: 'desperdicio', label: 'Desperdicio', help: 'Resta lo que se botó: vencido o malogrado.' },
]

type Props = { supply: Supply; canViewCost: boolean; onClose: () => void; onSaved: () => void }

export function SupplyEntryModal({ supply, canViewCost, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<SupplyEntryKind>('ingreso')
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const scope = `supply-entry:${supply.id}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const qty = parseAmount(quantity)
    const total = parseAmount(cost)
    if (!qty) return void toast.error('Indica la cantidad')
    if (total === null) return void toast.error('El importe no es válido')
    const body = { supply_id: supply.id, kind, quantity: qty, total_cost: kind === 'ingreso' && canViewCost ? total : 0, notes: notes.trim() }
    setSaving(true)
    try {
      await supplyPurchasesService.entry(body, idempotencyKeyFor(scope, body))
      releaseIdempotencyKey(scope)
      toast.success('Movimiento registrado')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo registrar. Si la red falló, vuelve a pulsar: no se duplicará.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SupplyModalShell
      title="Ingreso o merma"
      subtitle={`${supply.name} · ${supply.unit}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SUPPLY_BTN_GHOST} onClick={onClose}>Cancelar</button>
          <button type="submit" form="supply-entry" className={SUPPLY_BTN_PRIMARY} disabled={saving}>
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </>
      }
    >
      <form id="supply-entry" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={clsx('rounded-xl border px-2 py-2 text-sm font-medium', kind === k.id ? 'border-rest-600 bg-rest-50 text-rest-800' : 'border-stone-200 text-stone-600')}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500">{KINDS.find((k) => k.id === kind)?.help}</p>
        <label className="block">
          <span className={SUPPLY_LABEL}>Cantidad ({supply.unit})</span>
          <input className={SUPPLY_INPUT} inputMode="decimal" autoFocus value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        {kind === 'ingreso' && canViewCost && (
          <label className="block">
            <span className={SUPPLY_LABEL}>Cuánto pagaste en total, sin IGV (S/, opcional)</span>
            <input className={SUPPLY_INPUT} inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className={SUPPLY_LABEL}>Motivo o nota (opcional)</span>
          <input className={SUPPLY_INPUT} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </form>
    </SupplyModalShell>
  )
}
