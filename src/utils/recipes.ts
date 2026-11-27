import type { Dish, RecipeBody, RecipeDetail } from '@/services/recipes.service'
import { parseAmount } from '@/utils/supplies'

export type RecipeStatus = 'all' | 'none' | 'incomplete' | 'over'

export function dishKey(d: Pick<Dish, 'product_id' | 'presentation_id'>): string {
  return `${d.product_id}-${d.presentation_id}`
}

export function dishTitle(d: Pick<Dish, 'name' | 'presentation_name'>): string {
  return d.presentation_name ? `${d.name} · ${d.presentation_name}` : d.name
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function filterDishes(list: Dish[], f: { q: string; categoryId: number | ''; status: RecipeStatus }): Dish[] {
  const q = normalize(f.q)
  return list.filter((d) => {
    if (q && !normalize(dishTitle(d)).includes(q)) return false
    if (f.categoryId !== '' && d.category_id !== f.categoryId) return false
    if (f.status === 'none') return !d.has_recipe
    if (f.status === 'incomplete') return d.incomplete
    if (f.status === 'over') return !!d.costing?.over_target
    return true
  })
}

export function dishCategories(list: Dish[]): { id: number; name: string }[] {
  const seen = new Map<number, string>()
  for (const d of list) if (d.category_id && d.category_name) seen.set(d.category_id, d.category_name)
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

const UNIT_LABELS: Record<string, string> = { KGM: 'kg', GRM: 'g', LTR: 'L', MLT: 'ml', NIU: 'und' }

export function unitLabel(code: string): string {
  return UNIT_LABELS[code] ?? code
}

/** Unidades en las que se puede escribir la cantidad de un insumo, según su unidad base. */
export function unitOptions(base: string): string[] {
  const pairs: Record<string, string> = { KGM: 'GRM', GRM: 'KGM', LTR: 'MLT', MLT: 'LTR' }
  return pairs[base] ? [base, pairs[base]] : [base]
}

/** La unidad que se propone al agregar un insumo: en cocina se pesa en gramos y mililitros. */
export function defaultUnit(base: string): string {
  if (base === 'KGM') return 'GRM'
  if (base === 'LTR') return 'MLT'
  return base
}

export type RecipeLineForm = { supply_id: number; name: string; base_unit: string; unit: string; quantity: string; waste: string }
export type RecipeForm = { yield: string; target: string; lines: RecipeLineForm[] }

/** Una pestaña del editor: el plato, una presentación, o la receta común de las presentaciones (id 0). */
export type RecipeTab = { presentationId: number; label: string; dish: Dish | null; own: boolean }

export function recipeTabs(detail: RecipeDetail): RecipeTab[] {
  const [first] = detail.data
  if (!first) return []
  if (first.presentation_id === 0) return [{ presentationId: 0, label: first.name, dish: first, own: first.has_recipe }]
  const base = detail.base_recipe
  return [
    { presentationId: 0, label: 'Todas las presentaciones', dish: base, own: !!base },
    ...detail.data.map((d) => ({
      presentationId: d.presentation_id,
      label: d.presentation_name ?? '',
      dish: d,
      own: d.has_recipe && !d.inherited,
    })),
  ]
}

export function dishToForm(d: Dish | null): RecipeForm {
  const target = d?.recipe_target_food_cost_pct
  return {
    yield: d?.yield_qty ? String(d.yield_qty) : '1',
    target: target ? String(target) : '',
    lines: (d?.lines ?? []).map((l) => ({
      supply_id: l.supply_id,
      name: l.name,
      base_unit: l.base_unit,
      unit: l.unit || l.base_unit,
      quantity: String(l.quantity),
      waste: l.waste_pct ? String(l.waste_pct) : '',
    })),
  }
}

/** Cuerpo para guardar, o el mensaje de lo que falta. */
export function buildRecipeBody(form: RecipeForm, presentationId: number): RecipeBody | string {
  const yieldQty = parseAmount(form.yield)
  if (!yieldQty) return 'Indica cuántas porciones rinde'
  let target: number | null = null
  if (form.target.trim()) {
    target = parseAmount(form.target)
    if (!target || target >= 100) return 'El food cost objetivo debe estar entre 0 y 100'
  }
  if (form.lines.length === 0) return 'Agrega al menos un ingrediente'
  const lines: RecipeBody['lines'] = []
  for (const l of form.lines) {
    const quantity = parseAmount(l.quantity)
    if (!quantity) return `Indica la cantidad de «${l.name}»`
    const waste = parseAmount(l.waste)
    if (waste === null || waste >= 100) return `La merma de «${l.name}» debe estar entre 0 y 99`
    lines.push({ supply_id: l.supply_id, quantity, unit: l.unit === l.base_unit ? '' : l.unit, waste_pct: waste })
  }
  return { presentation_id: presentationId, yield_qty: yieldQty, target_food_cost_pct: target, lines }
}

/** Food cost que tendría el plato con otro precio publicado. */
export function foodCostAt(price: number, portionCost: number, netFactor: number): number | null {
  const net = price * netFactor
  return net > 0 ? Math.round((portionCost / net) * 10000) / 100 : null
}

/** Dónde se aplicará el nuevo precio (se muestra antes de confirmar). */
export function priceScope(d: Pick<Dish, 'branch_price' | 'presentation_id'>, branchName: string): string {
  if (d.presentation_id > 0) return 'Precio de la presentación: se aplica en todas las sucursales.'
  if (d.branch_price) return `Solo se cambia el precio propio de ${branchName || 'esta sucursal'}.`
  return 'Precio general: afecta a todas las sucursales que no tengan precio propio.'
}

export function formatPct(n: number): string {
  return `${Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 })} %`
}

export function formatPrice(n: number): string {
  return `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
