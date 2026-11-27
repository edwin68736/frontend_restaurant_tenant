import { describe, expect, it } from 'vitest'
import type { Dish } from '@/services/recipes.service'
import { dishCostRows, knownCost, matches, money, pct, sortDishCosts, stockStatus, sumOf, unitCost } from './recipeReports'

const costing = {
  portion_cost: 4,
  net_price: 12.71,
  net_factor: 0.847,
  food_cost_pct: 31.5,
  margin: 8.71,
  margin_pct: 68.5,
  suggested_price: 16,
  suggested_food_cost_pct: 29,
  target_food_cost_pct: 30,
  over_target: true,
}

const dish = (over: Partial<Dish>): Dish => ({
  product_id: 1,
  presentation_id: 0,
  name: 'Plato',
  price: 15,
  branch_price: false,
  is_combo: false,
  has_recipe: true,
  incomplete: false,
  ...over,
})

describe('reportes de insumos y platos', () => {
  it('lo desconocido no se muestra como cero', () => {
    for (const f of [money, unitCost, pct]) expect(f(undefined)).toBe('—')
    expect(pct(0)).toBe('0 %')
  })

  it('un costo en cero con cantidades sin costo se desconoce', () => {
    expect(knownCost(0, 0.1)).toBeUndefined()
    expect(knownCost(undefined, 1)).toBeUndefined()
    expect(knownCost(4.5, 1)).toBe(4.5)
    expect(knownCost(0, 0)).toBe(0)
  })

  it('la suma ignora lo desconocido', () => {
    expect(sumOf([{ v: 1.115 }, { v: undefined }, { v: 2 }], (r) => r.v)).toBe(3.12)
  })

  it('busca sin tildes ni mayúsculas', () => {
    expect(matches('Limón - kilo', 'limon')).toBe(true)
    expect(matches('Pan', 'carne')).toBe(false)
  })

  it('el negativo manda sobre el bajo mínimo', () => {
    expect(stockStatus({ negative: true, low: true })).toBe('Negativo')
    expect(stockStatus({ negative: false, low: true })).toBe('Bajo mínimo')
    expect(stockStatus({ negative: false, low: false })).toBe('OK')
  })

  it('sin precio publicado no hay food cost ni margen, pero sí costo', () => {
    const [row] = dishCostRows([dish({ costing: { ...costing, current_price_missing: true } })])
    expect(row).toMatchObject({ portion_cost: 4, food_cost_pct: undefined, margin: undefined })
  })

  it('estados de la carta', () => {
    const rows = dishCostRows([
      dish({ has_recipe: false }),
      dish({ incomplete: true }),
      dish({ costing }),
      dish({ presentation_name: 'Grande', costing: { ...costing, over_target: false } }),
    ])
    expect(rows.map((r) => r.status)).toEqual(['Sin receta', 'Incompleta', 'Sobre el objetivo', 'OK'])
    expect(rows[3].name).toBe('Plato - Grande')
  })

  it('ordena y deja lo desconocido al final', () => {
    const rows = dishCostRows([
      dish({ product_id: 1, name: 'A', costing: { ...costing, portion_cost: 2 }, available: 9 }),
      dish({ product_id: 2, name: 'B', has_recipe: false }),
      dish({ product_id: 3, name: 'C', costing: { ...costing, portion_cost: 7 }, available: 0 }),
    ])
    expect(sortDishCosts(rows, 'cost').map((r) => r.name)).toEqual(['C', 'A', 'B'])
    expect(sortDishCosts(rows, 'available').map((r) => r.name)).toEqual(['C', 'A', 'B'])
  })
})
