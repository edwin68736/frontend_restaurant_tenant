import { clsx } from 'clsx'
import type { Dish } from '@/services/recipes.service'
import { formatCost } from '@/utils/supplies'
import { formatPct, formatPrice } from '@/utils/recipes'

/** Números de un plato ya calculados por el servidor. */
export function CostSummary({ dish }: { dish: Dish }) {
  const c = dish.costing
  // Un combo visto sin permiso de costos no trae nada que mostrar: sin esto queda un recuadro vacío.
  if (dish.available == null && !dish.incomplete && !c) return null
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
      {dish.available != null && (
        <p className="text-stone-700">
          Alcanza para <strong className={clsx(dish.available === 0 && 'text-red-600')}>{dish.available}</strong>{' '}
          {dish.available === 1 ? 'porción' : 'porciones'}
          {dish.limiting && <span className="text-stone-500"> · limita {dish.limiting}</span>}
        </p>
      )}
      {dish.incomplete && (
        <p className="mt-1 text-amber-800">
          Incompleta, sin food cost ni precio sugerido. Falta: {(dish.missing ?? []).join(', ')}
        </p>
      )}
      {c && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          <Item label="Costo por porción" value={formatCost(c.portion_cost)} />
          <Item label="Precio" value={c.current_price_missing ? '—' : formatPrice(dish.price)} />
          <Item label="Sin IGV" value={c.current_price_missing ? '—' : formatPrice(c.net_price)} />
          <Item label="Food cost" value={c.current_price_missing ? '—' : formatPct(c.food_cost_pct)} warn={c.over_target} />
          <Item label="Margen" value={c.current_price_missing ? '—' : `${formatPrice(c.margin)} (${formatPct(c.margin_pct)})`} />
          <Item label={`Sugerido (obj. ${formatPct(c.target_food_cost_pct)})`} value={`${formatPrice(c.suggested_price)} · ${formatPct(c.suggested_food_cost_pct)}`} />
        </dl>
      )}
    </div>
  )
}

function Item({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-stone-500">{label}</dt>
      <dd className={clsx('font-semibold', warn ? 'text-red-600' : 'text-stone-800')}>{value}</dd>
    </div>
  )
}
