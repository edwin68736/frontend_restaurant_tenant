import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { recipesService, type RecipeSettings } from '@/services/recipes.service'
import { apiError, parseAmount } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from '@/components/supplies/SupplyModalShell'

type Props = { canManage: boolean; onClose: () => void; onSaved: () => void }

export function RecipeSettingsModal({ canManage, onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<RecipeSettings | null>(null)
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    recipesService
      .settings()
      .then((s) => {
        setSettings(s)
        setTarget(String(s.target_food_cost_pct))
      })
      .catch((e) => toast.error(apiError(e, 'No se pudo cargar la configuración')))
  }, [])

  const set = (patch: Partial<RecipeSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))
  const pct = parseAmount(target)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!settings) return
    if (!pct || pct >= 100) {
      toast.error('El food cost objetivo debe estar entre 0 y 100')
      return
    }
    setSaving(true)
    try {
      await recipesService.saveSettings({ ...settings, target_food_cost_pct: pct })
      toast.success('Configuración guardada')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SupplyModalShell
      title="Precio sugerido"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SUPPLY_BTN_GHOST} onClick={onClose}>Cerrar</button>
          {canManage && (
            <button type="submit" form="recipe-settings-form" className={SUPPLY_BTN_PRIMARY} disabled={saving || !settings}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </>
      }
    >
      {!settings ? (
        <p className="py-6 text-center text-sm text-stone-500">Cargando…</p>
      ) : (
        <form id="recipe-settings-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={SUPPLY_LABEL}>Food cost objetivo (%)</span>
            <input className={SUPPLY_INPUT} inputMode="decimal" value={target} disabled={!canManage} onChange={(e) => setTarget(e.target.value)} />
            <span className="mt-1 block text-[11px] text-stone-500">
              Cuánto del precio sin IGV puede irse en ingredientes.
              {pct != null && pct > 0 && pct < 100 && <> Equivale a un margen deseado de {Math.round((100 - pct) * 100) / 100} %.</>}
            </span>
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Redondeo del precio</span>
            <select className={SUPPLY_INPUT} value={settings.price_rounding} disabled={!canManage} onChange={(e) => set({ price_rounding: e.target.value as RecipeSettings['price_rounding'] })}>
              <option value="none">Sin redondeo</option>
              <option value="0.10">A S/ 0.10</option>
              <option value="0.50">A S/ 0.50</option>
              <option value="1.00">A S/ 1.00</option>
              <option value="x.90">Terminado en .90</option>
            </select>
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Dirección</span>
            <select className={SUPPLY_INPUT} value={settings.rounding_direction} disabled={!canManage} onChange={(e) => set({ rounding_direction: e.target.value as RecipeSettings['rounding_direction'] })}>
              <option value="up">Hacia arriba</option>
              <option value="nearest">Al más cercano</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={SUPPLY_LABEL}>Costo de los insumos</span>
            <select className={SUPPLY_INPUT} value={settings.recipe_cost_basis} disabled={!canManage} onChange={(e) => set({ recipe_cost_basis: e.target.value as RecipeSettings['recipe_cost_basis'] })}>
              <option value="avg">Promedio de la sucursal</option>
              <option value="last">Último costo de compra</option>
            </select>
          </label>
        </form>
      )}
    </SupplyModalShell>
  )
}
