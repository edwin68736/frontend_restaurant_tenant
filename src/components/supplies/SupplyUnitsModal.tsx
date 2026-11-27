import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { suppliesService, type MeasureUnit, type Supply, type SupplyUnit } from '@/services/supplies.service'
import { apiError, formatQty, parseAmount } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from './SupplyModalShell'

type Props = { supply: Supply; units: MeasureUnit[]; canManage: boolean; onClose: () => void }

type UnitForm = { id: number | null; name: string; unit_id: number | ''; factor: string; allow_fraction: boolean }

const emptyForm: UnitForm = { id: null, name: '', unit_id: '', factor: '', allow_fraction: false }

/** Unidades de COMPRA de un insumo (saco, caja…): cuántas unidades base trae cada una. No llevan precio. */
export function SupplyUnitsModal({ supply, units, canManage, onClose }: Props) {
  const [rows, setRows] = useState<SupplyUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<UnitForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<UnitForm>) => setForm((f) => ({ ...f, ...patch }))

  const load = useCallback(() => {
    suppliesService
      .listUnits(supply.id)
      .then((list) => setRows(list.filter((u) => u.active)))
      .catch((e) => toast.error(apiError(e, 'No se pudieron cargar las unidades')))
      .finally(() => setLoading(false))
  }, [supply.id])

  useEffect(load, [load])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const factor = parseAmount(form.factor)
    if (!form.name.trim()) return void toast.error('Escribe el nombre (ej. Saco 50 kg)')
    if (form.unit_id === '') return void toast.error('Elige la unidad de medida')
    if (!factor) return void toast.error('Indica cuántas unidades base contiene')
    const body = {
      name: form.name.trim(),
      unit_id: form.unit_id,
      conversion_factor: factor,
      is_base: false,
      allow_fraction: form.allow_fraction,
      sort_order: 0,
      active: true,
    }
    setSaving(true)
    try {
      if (form.id) await suppliesService.updateUnit(supply.id, form.id, body)
      else await suppliesService.createUnit(supply.id, body)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo guardar la unidad'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (u: SupplyUnit) => {
    if (!window.confirm(`¿Quitar la unidad «${u.name}»?`)) return
    try {
      await suppliesService.deleteUnit(supply.id, u.id)
      if (form.id === u.id) setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo quitar la unidad'))
    }
  }

  return (
    <SupplyModalShell title="Unidades de compra" subtitle={`${supply.name} · unidad base ${supply.unit}`} onClose={onClose}>
      {loading ? (
        <p className="py-4 text-center text-sm text-stone-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-stone-500">Sin unidades de compra. Se compra en {supply.unit}.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-800">{u.name}</p>
                <p className="text-xs text-stone-500">
                  1 = {formatQty(u.conversion_factor)} {supply.unit}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${u.name}`}
                    className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                    onClick={() => setForm({ id: u.id, name: u.name, unit_id: u.unit_id ?? '', factor: String(u.conversion_factor), allow_fraction: u.allow_fraction })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button type="button" aria-label={`Quitar ${u.name}`} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" onClick={() => remove(u)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-100 pt-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={SUPPLY_LABEL}>{form.id ? 'Editar unidad' : 'Nueva unidad'}</span>
            <input className={SUPPLY_INPUT} value={form.name} placeholder="Saco 50 kg" maxLength={100} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Unidad de medida</span>
            <select className={SUPPLY_INPUT} value={form.unit_id} onChange={(e) => set({ unit_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Elegir…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
              ))}
            </select>
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Contiene ({supply.unit})</span>
            <input className={SUPPLY_INPUT} inputMode="decimal" value={form.factor} placeholder="50" onChange={(e) => set({ factor: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-rest-600" checked={form.allow_fraction} onChange={(e) => set({ allow_fraction: e.target.checked })} />
            Permite comprar fracciones (1.5)
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            {form.id && (
              <button type="button" className={SUPPLY_BTN_GHOST} onClick={() => setForm(emptyForm)}>Cancelar</button>
            )}
            <button type="submit" className={SUPPLY_BTN_PRIMARY} disabled={saving}>
              {form.id ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      )}
    </SupplyModalShell>
  )
}
