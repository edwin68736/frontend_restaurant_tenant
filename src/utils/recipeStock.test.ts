import { describe, expect, it } from 'vitest'
import type { Availability, DishStock } from '@/services/recipes.service'
import { cardPortions, presentationPortions, shortageText } from '@/utils/recipeStock'

const dish = (over: Partial<DishStock>): DishStock => ({
  product_id: 1,
  presentation_id: 0,
  portions: 5,
  all_presentations: true,
  ...over,
})

const on = (dishes: DishStock[]): Availability => ({ active: true, stock_policy: 'allow', dishes })

describe('porciones por receta', () => {
  it('con el descuento apagado o sin datos, el plato muestra su stock de siempre', () => {
    expect(cardPortions(null, 1)).toBeUndefined()
    expect(cardPortions({ active: false, stock_policy: 'allow', dishes: [] }, 1)).toBeUndefined()
    expect(cardPortions(on([dish({ product_id: 2 })]), 1)).toBeUndefined()
    expect(presentationPortions(null, 1, 0)).toBeUndefined()
  })

  it('un plato con receta muestra para cuántas alcanza, también si es cero', () => {
    expect(cardPortions(on([dish({ portions: 13 })]), 1)).toBe(13)
    expect(cardPortions(on([dish({ portions: 0 })]), 1)).toBe(0)
    expect(cardPortions(on([dish({ portions: null })]), 1)).toBeNull()
  })

  it('con presentaciones: la tarjeta solo cambia si todas van por receta; cada una muestra lo suyo', () => {
    const all = on([dish({ presentation_id: 7, portions: 3 }), dish({ presentation_id: 8, portions: 10 })])
    expect(cardPortions(all, 1)).toBe(10)
    expect(presentationPortions(all, 1, 7)).toBe(3)

    const partial = on([dish({ presentation_id: 7, portions: 3, all_presentations: false })])
    expect(cardPortions(partial, 1)).toBeUndefined()
    expect(presentationPortions(partial, 1, 7)).toBe(3)
    expect(presentationPortions(partial, 1, 8)).toBeUndefined()
  })

  it('el aviso dice cuánto falta en la unidad del insumo', () => {
    expect(shortageText({ supply_id: 1, name: 'Carne', unit: 'KGM', required: 2.4, available: 2, dishes: [] })).toMatch(
      /^Carne: se necesitan 2\.4 .+, hay 2 .+$/,
    )
  })
})
