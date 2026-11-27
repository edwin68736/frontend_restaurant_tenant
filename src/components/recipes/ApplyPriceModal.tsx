import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { recipesService, type Dish } from '@/services/recipes.service'
import { apiError, parseAmount } from '@/utils/supplies'
import { dishTitle, foodCostAt, formatPct, formatPrice, priceScope } from '@/utils/recipes'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from '@/components/supplies/SupplyModalShell'

type Props = {
  dish: Dish
  branchId?: number
  branchName: string
  onClose: () => void
  /** El precio cambió (por esta confirmación o por otra persona): hay que recargar. */
  onDone: () => void
}

/** El precio de venta nunca cambia solo: se confirma aquí, viendo el actual, el nuevo y dónde se aplica. */
export function ApplyPriceModal({ dish, branchId, branchName, onClose, onDone }: Props) {
  const costing = dish.costing!
  const [value, setValue] = useState(() => costing.suggested_price.toFixed(2))
  const [saving, setSaving] = useState(false)
  const price = parseAmount(value)
  const foodCost = price ? foodCostAt(price, costing.portion_cost, costing.net_factor) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!price) {
      toast.error('Escribe el nuevo precio')
      return
    }
    setSaving(true)
    try {
      await recipesService.applyPrice(
        dish.product_id,
        { presentation_id: dish.presentation_id, current_price: dish.price, new_price: price },
        branchId,
      )
      toast.success('Precio actualizado')
      onDone()
    } catch (err) {
      toast.error(apiError(err, 'No se pudo cambiar el precio'))
      if ((err as { response?: { status?: number } })?.response?.status === 409) onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SupplyModalShell
      title="Aplicar precio"
      subtitle={dishTitle(dish)}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SUPPLY_BTN_GHOST} onClick={onClose}>Cancelar</button>
          <button type="submit" form="apply-price-form" className={SUPPLY_BTN_PRIMARY} disabled={saving || !price}>
            {saving ? 'Cambiando…' : 'Cambiar precio'}
          </button>
        </>
      }
    >
      <form id="apply-price-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-stone-700">Precio actual: <strong>{formatPrice(dish.price)}</strong></p>
        <label className="block">
          <span className={SUPPLY_LABEL}>Nuevo precio de venta (S/)</span>
          <input className={SUPPLY_INPUT} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          <span className="mt-1 block text-[11px] text-stone-500">
            Sugerido: {formatPrice(costing.suggested_price)}
            {foodCost != null && <> · con este precio el food cost sería {formatPct(foodCost)} (objetivo {formatPct(costing.target_food_cost_pct)})</>}
          </span>
        </label>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{priceScope(dish, branchName)}</p>
      </form>
    </SupplyModalShell>
  )
}
