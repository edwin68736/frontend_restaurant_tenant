import { describe, expect, it } from 'vitest'
import type { Supply } from '@/services/supplies.service'
import { buildSupplyInput, emptySupplyForm, formatCost, isLowStock, parseAmount, supplyToForm } from './supplies'
import { canAccessFeature } from './restaurantPermissions'

const supply: Supply = {
  id: 1, code: 'I1', name: 'Arroz', description: '', unit: 'KGM', unit_id: 5, min_stock: 2, active: true,
  has_expiry_date: false, stock_total: 10, stock_by_branch: [], unit_cost: 3.5,
}

describe('insumos: acceso', () => {
  it('requiere permiso de insumos', () => {
    expect(canAccessFeature(['sp.v'], 'insumos')).toBe(true)
    expect(canAccessFeature(['sp.m'], 'insumos')).toBe(true)
    expect(canAccessFeature(['g.p', 's.m'], 'insumos')).toBe(false)
    expect(canAccessFeature([], 'insumos')).toBe(false)
  })
})

describe('insumos: cuerpo de la petición', () => {
  it('sin permiso de costos no envía el costo', () => {
    const form = { ...supplyToForm(supply), unit_cost: '99' }
    const body = buildSupplyInput(form, { canViewCost: false, original: supply })
    expect(body).not.toHaveProperty('unit_cost')
  })

  it('al editar solo envía la unidad si cambió', () => {
    const same = buildSupplyInput(supplyToForm(supply), { canViewCost: true, original: supply })
    expect(same).not.toHaveProperty('unit_id')
    expect(same).toMatchObject({ unit_cost: 3.5, min_stock: 2 })
    const changed = buildSupplyInput({ ...supplyToForm(supply), unit_id: 7 }, { canViewCost: true, original: supply })
    expect(changed).toMatchObject({ unit_id: 7 })
  })

  it('al crear exige nombre y unidad y no manda código vacío', () => {
    expect(typeof buildSupplyInput(emptySupplyForm(5), { canViewCost: true })).toBe('string')
    expect(typeof buildSupplyInput({ ...emptySupplyForm(''), name: 'x' }, { canViewCost: true })).toBe('string')
    const body = buildSupplyInput({ ...emptySupplyForm(5), name: ' Sal ' }, { canViewCost: true })
    expect(body).toMatchObject({ name: 'Sal', unit_id: 5 })
    expect(body).not.toHaveProperty('code')
  })

  it('acepta coma decimal y rechaza negativos', () => {
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })

  it('muestra costos pequeños sin truncarlos', () => {
    expect(formatCost(0.0035)).toBe('S/ 0.0035')
    expect(formatCost(3)).toBe('S/ 3.00')
  })

  it('stock bajo solo con mínimo definido', () => {
    expect(isLowStock({ stock_total: 2, min_stock: 2 })).toBe(true)
    expect(isLowStock({ stock_total: 0, min_stock: 0 })).toBe(false)
  })
})
