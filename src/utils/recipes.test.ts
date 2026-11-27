import { describe, expect, it } from 'vitest'
import type { Dish, RecipeDetail } from '@/services/recipes.service'
import { buildRecipeBody, defaultUnit, dishCategories, dishToForm, filterDishes, foodCostAt, priceScope, recipeTabs, unitOptions } from './recipes'
import { canAccessFeature } from './restaurantPermissions'

const dish = (over: Partial<Dish>): Dish => ({
  product_id: 1, presentation_id: 0, name: 'Hamburguesa', price: 15, branch_price: false, is_combo: false, has_recipe: false, incomplete: false, ...over,
})

describe('recetas: lista', () => {
  const list = [
    dish({ name: 'Ají de gallina', category_id: 2, category_name: 'Fondos' }),
    dish({ product_id: 2, name: 'Pizza', presentation_name: 'Familiar', has_recipe: true, incomplete: true }),
    dish({ product_id: 3, name: 'Lomo', has_recipe: true, category_id: 2, category_name: 'Fondos', costing: { over_target: true } as Dish['costing'] }),
  ]

  it('filtra por texto sin tildes, categoría y estado', () => {
    const names = (q: string, categoryId: number | '', status: 'all' | 'none' | 'incomplete' | 'over') =>
      filterDishes(list, { q, categoryId, status }).map((d) => d.name)
    expect(names('aji', '', 'all')).toEqual(['Ají de gallina'])
    expect(names('familiar', '', 'all')).toEqual(['Pizza'])
    expect(names('', 2, 'all')).toEqual(['Ají de gallina', 'Lomo'])
    expect(names('', '', 'none')).toEqual(['Ají de gallina'])
    expect(names('', '', 'incomplete')).toEqual(['Pizza'])
    expect(names('', '', 'over')).toEqual(['Lomo'])
    expect(dishCategories(list)).toEqual([{ id: 2, name: 'Fondos' }])
  })
})

describe('recetas: editor', () => {
  const base = dish({ presentation_id: 0, has_recipe: true, yield_qty: 1, lines: [] })

  it('ofrece g y ml para insumos en kg y litros', () => {
    expect(unitOptions('KGM')).toEqual(['KGM', 'GRM'])
    expect(unitOptions('NIU')).toEqual(['NIU'])
    expect(defaultUnit('KGM')).toBe('GRM')
    expect(defaultUnit('LTR')).toBe('MLT')
    expect(defaultUnit('NIU')).toBe('NIU')
  })

  it('arma las pestañas de un plato simple y de uno con presentaciones', () => {
    const simple = recipeTabs({ data: [base], base_recipe: null, can_view_cost: true })
    expect(simple).toHaveLength(1)
    expect(simple[0]).toMatchObject({ presentationId: 0, own: true })
    const detail: RecipeDetail = {
      data: [
        dish({ presentation_id: 7, presentation_name: 'Personal', has_recipe: true, inherited: true }),
        dish({ presentation_id: 8, presentation_name: 'Familiar', has_recipe: true }),
      ],
      base_recipe: null,
      can_view_cost: true,
    }
    expect(recipeTabs(detail).map((t) => [t.presentationId, t.own])).toEqual([[0, false], [7, false], [8, true]])
  })

  it('convierte lo guardado en formulario y lo devuelve igual', () => {
    const saved = dish({
      has_recipe: true, yield_qty: 5, recipe_target_food_cost_pct: 25,
      lines: [
        { supply_id: 3, name: 'Carne', base_unit: 'KGM', quantity: 150, unit: 'GRM', waste_pct: 20, qty_gross: 0.1875, stock: 2 },
        { supply_id: 4, name: 'Pan', base_unit: 'NIU', quantity: 1, unit: '', waste_pct: 0, qty_gross: 1, stock: 30 },
      ],
    })
    const form = dishToForm(saved)
    expect(form.lines[1].unit).toBe('NIU')
    expect(buildRecipeBody(form, 0)).toEqual({
      presentation_id: 0, yield_qty: 5, target_food_cost_pct: 25,
      lines: [
        { supply_id: 3, quantity: 150, unit: 'GRM', waste_pct: 20 },
        { supply_id: 4, quantity: 1, unit: '', waste_pct: 0 },
      ],
    })
  })

  it('exige rendimiento, líneas, cantidades y rangos válidos', () => {
    const line = { supply_id: 3, name: 'Carne', base_unit: 'KGM', unit: 'GRM', quantity: '150', waste: '' }
    const form = { yield: '1', target: '', lines: [line] }
    expect(buildRecipeBody({ ...form, yield: '0' }, 0)).toMatch(/porciones/)
    expect(buildRecipeBody({ ...form, lines: [] }, 0)).toMatch(/ingrediente/)
    expect(buildRecipeBody({ ...form, target: '100' }, 0)).toMatch(/food cost/)
    expect(buildRecipeBody({ ...form, lines: [{ ...line, quantity: '' }] }, 0)).toMatch(/cantidad/)
    expect(buildRecipeBody({ ...form, lines: [{ ...line, waste: '100' }] }, 0)).toMatch(/merma/)
    expect(buildRecipeBody({ ...form, lines: [{ ...line, quantity: '0,5' }] }, 9)).toMatchObject({ presentation_id: 9, lines: [{ quantity: 0.5 }] })
  })

  it('muestra el food cost de otro precio y dónde se aplica', () => {
    expect(foodCostAt(16.4, 4.15, 1 / 1.18)).toBe(29.86)
    expect(foodCostAt(0, 4.15, 1)).toBeNull()
    expect(priceScope(dish({}), 'Centro')).toMatch(/todas las sucursales/)
    expect(priceScope(dish({ branch_price: true }), 'Centro')).toMatch(/Centro/)
    expect(priceScope(dish({ presentation_id: 4 }), 'Centro')).toMatch(/presentación/)
  })
})

describe('recetas: acceso', () => {
  it('lo ven quien puede ver o gestionar recetas', () => {
    expect(canAccessFeature(['rc.v'], 'recetas')).toBe(true)
    expect(canAccessFeature(['rc.m'], 'recetas')).toBe(true)
    expect(canAccessFeature(['k.v', 'sp.v'], 'recetas')).toBe(false)
  })
})
