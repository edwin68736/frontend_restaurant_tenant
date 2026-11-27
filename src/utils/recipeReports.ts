import type { Dish } from '@/services/recipes.service'
import type { StockRow } from '@/services/recipeReports.service'
import { formatSoles } from '@/utils/format'
import { formatCost, formatQty } from '@/utils/supplies'

/** Lo que no se conoce se muestra como «—», nunca como cero. */
export const money = (v: unknown) => (typeof v === 'number' ? formatSoles(v) : '—')
export const unitCost = (v: unknown) => (typeof v === 'number' ? formatCost(v) : '—')
export const qty = (v: unknown) => (typeof v === 'number' ? formatQty(v) : '—')
export const pct = (v: unknown) => (typeof v === 'number' ? `${v.toLocaleString('es-PE', { maximumFractionDigits: 1 })} %` : '—')

/** Un costo en cero con cantidades sin costo no es S/ 0.00: se desconoce. */
export const knownCost = (cost: number | undefined, withoutCost: number) => (withoutCost > 0 && !cost ? undefined : cost)

export function stockStatus(r: Pick<StockRow, 'negative' | 'low'>): string {
  if (r.negative) return 'Negativo'
  return r.low ? 'Bajo mínimo' : 'OK'
}

/** Suma solo lo que se conoce; para la fila TOTAL del Excel. */
export function sumOf<T>(rows: T[], pick: (r: T) => number | undefined): number {
  return Math.round(rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0) * 100) / 100
}

export function matches(text: string, search: unknown): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return norm(text).includes(norm(String(search ?? '').trim()))
}

export type DishCostRow = {
  key: string
  name: string
  category: string
  portion_cost?: number
  price: number
  net_price?: number
  food_cost_pct?: number
  margin?: number
  available?: number
  status: string
}

function dishStatus(d: Dish): string {
  if (!d.has_recipe && !d.is_combo) return 'Sin receta'
  if (d.incomplete) return 'Incompleta'
  if (d.costing?.over_target) return 'Sobre el objetivo'
  return 'OK'
}

/** Platos de la carta como filas de reporte. Sin precio publicado no hay food cost ni margen. */
export function dishCostRows(dishes: Dish[]): DishCostRow[] {
  return dishes.map((d) => {
    const c = d.costing
    const priced = c && !c.current_price_missing
    return {
      key: `${d.product_id}-${d.presentation_id}`,
      name: d.presentation_name ? `${d.name} - ${d.presentation_name}` : d.name,
      category: d.category_name ?? '',
      portion_cost: c?.portion_cost,
      price: d.price,
      net_price: priced ? c.net_price : undefined,
      food_cost_pct: priced ? c.food_cost_pct : undefined,
      margin: priced ? c.margin : undefined,
      available: d.available ?? undefined,
      status: dishStatus(d),
    }
  })
}

export type DishCostOrder = 'cost' | 'food_cost' | 'available'

/** Primero lo más costoso, lo de mayor food cost o lo que menos alcanza; lo desconocido al final. */
export function sortDishCosts(rows: DishCostRow[], order: DishCostOrder): DishCostRow[] {
  const value = (r: DishCostRow) => (order === 'cost' ? r.portion_cost : order === 'food_cost' ? r.food_cost_pct : r.available)
  const sign = order === 'available' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === y) return a.name.localeCompare(b.name, 'es')
    if (x === undefined) return 1
    if (y === undefined) return -1
    return (x - y) * sign
  })
}
