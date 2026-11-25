import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { suppliesService, type MeasureUnit, type Supply } from '@/services/supplies.service'
import { apiError, buildSupplyInput, emptySupplyForm, supplyToForm, type SupplyForm } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from './SupplyModalShell'

type Props = {
  supply: Supply | null
  units: MeasureUnit[]
  canViewCost: boolean
  onClose: () => void
  onSaved: () => void
}

export function SupplyFormModal({ supply, units, canViewCost, onClose, onSaved }: Props) {
  const defaultUnit = units.find((u) => u.code === 'KGM')?.id ?? units.find((u) => u.code === 'NIU')?.id ?? units[0]?.id ?? ''
  const [form, setForm] = useState<SupplyForm>(() => (supply ? supplyToForm(supply) : emptySupplyForm(defaultUnit)))
  const [unitLocked, setUnitLocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<SupplyForm>) => setForm((f) => ({ ...f, ...patch }))

  // La unidad base da significado al stock registrado: con movimientos no se cambia.
  useEffect(() => {
    if (!supply) return
    let cancelled = false
    suppliesService
      .movements(supply.id, 1)
      .then((r) => {
        if (!cancelled) setUnitLocked(r.total > 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [supply])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = buildSupplyInput(form, { canViewCost, original: supply })
    if (typeof body === 'string') {
      toast.error(body)
      return
    }
    setSaving(true)
    try {
      if (supply) await suppliesService.update(supply.id, body)
      else await suppliesService.create(body)
      toast.success(supply ? 'Insumo actualizado' : 'Insumo creado')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo guardar el insumo'))
    } finally {
      setSaving(false)
    }
  }

  const baseUnit = units.find((u) => u.id === form.unit_id)

  return (
    <SupplyModalShell
      title={supply ? 'Editar insumo' : 'Nuevo insumo'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SUPPLY_BTN_GHOST} onClick={onClose}>Cancelar</button>
          <button type="submit" form="supply-form" className={SUPPLY_BTN_PRIMARY} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="supply-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={SUPPLY_LABEL}>Nombre</span>
          <input className={SUPPLY_INPUT} value={form.name} maxLength={200} autoFocus onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          <span className={SUPPLY_LABEL}>Código (opcional)</span>
          <input className={SUPPLY_INPUT} value={form.code} maxLength={50} placeholder="Automático" onChange={(e) => set({ code: e.target.value })} />
        </label>
        <label>
          <span className={SUPPLY_LABEL}>Unidad base</span>
          <select
            className={SUPPLY_INPUT}
            value={form.unit_id}
            disabled={unitLocked}
            onChange={(e) => set({ unit_id: e.target.value ? Number(e.target.value) : '' })}
          >
            <option value="">Elegir…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
            ))}
          </select>
          {unitLocked && <span className="mt-1 block text-[11px] text-stone-500">No se cambia: ya tiene movimientos.</span>}
        </label>
        <label>
          <span className={SUPPLY_LABEL}>Stock mínimo{baseUnit ? ` (${baseUnit.code})` : ''}</span>
          <input className={SUPPLY_INPUT} inputMode="decimal" value={form.min_stock} placeholder="0" onChange={(e) => set({ min_stock: e.target.value })} />
        </label>
        {canViewCost && (
          <label>
            <span className={SUPPLY_LABEL}>Costo de 1 {baseUnit ? baseUnit.code : 'unidad base'} (S/)</span>
            <input className={SUPPLY_INPUT} inputMode="decimal" value={form.unit_cost} placeholder="0.00" onChange={(e) => set({ unit_cost: e.target.value })} />
            <span className="mt-1 block text-[11px] text-stone-500">Es el último costo: no cambia el promedio y la siguiente compra lo reemplaza.</span>
          </label>
        )}
        <label>
          <span className={SUPPLY_LABEL}>Vence (opcional)</span>
          <input type="date" className={SUPPLY_INPUT} value={form.expiry_date} onChange={(e) => set({ expiry_date: e.target.value })} />
        </label>
        <label className="sm:col-span-2">
          <span className={SUPPLY_LABEL}>Descripción (opcional)</span>
          <textarea className={SUPPLY_INPUT} rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-rest-600" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
          Activo
        </label>
      </form>
    </SupplyModalShell>
  )
}
