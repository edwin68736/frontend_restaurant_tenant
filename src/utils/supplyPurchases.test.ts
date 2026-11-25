import { describe, expect, it } from 'vitest'
import { buildPurchaseBody, emptyPurchaseForm, lineBaseCost, purchaseTotal, type PurchaseLineForm } from './supplyPurchases'
import { canAccessFeature } from './restaurantPermissions'

const line: PurchaseLineForm = {
  supply_id: 1, name: 'Arroz', base_unit: 'KGM', sale_unit_id: 9, units: [{ id: 9, name: 'Saco 50', factor: 50 }], quantity: '2', total: '354',
}

const form = () => ({ ...emptyPurchaseForm('2026-11-25'), supplier_id: 3, series: ' f001 ', number: '12', lines: [line] })

describe('compras de insumos', () => {
  it('calcula el total y el costo por unidad base con la unidad elegida', () => {
    expect(purchaseTotal([line, { ...line, total: '0,50' }])).toBe(354.5)
    expect(lineBaseCost(line)).toBeCloseTo(3.54)
    expect(lineBaseCost({ ...line, sale_unit_id: 0 })).toBe(177)
    expect(lineBaseCost({ ...line, quantity: '' })).toBeNull()
  })

  it('envía el importe de la línea, no el costo unitario', () => {
    const body = buildPurchaseBody(form())
    expect(body).toMatchObject({ series: 'F001', lines: [{ supply_id: 1, sale_unit_id: 9, quantity: 2, line_total: 354 }] })
  })

  it('en unidad base no manda unidad de compra y solo a crédito manda vencimiento', () => {
    const base = buildPurchaseBody({ ...form(), due_date: '2026-12-01', lines: [{ ...line, sale_unit_id: 0 }] })
    expect(base).toMatchObject({ due_date: undefined, lines: [{ sale_unit_id: undefined }] })
    expect(buildPurchaseBody({ ...form(), payment_method: 'credit', due_date: '2026-12-01' })).toMatchObject({ due_date: '2026-12-01' })
  })

  it('exige proveedor, comprobante, líneas, cantidad e importe', () => {
    for (const bad of [
      { ...form(), supplier_id: 0 },
      { ...form(), series: '' },
      { ...form(), lines: [] },
      { ...form(), lines: [{ ...line, quantity: '0' }] },
      { ...form(), lines: [{ ...line, total: 'abc' }] },
    ]) {
      expect(typeof buildPurchaseBody(bad)).toBe('string')
    }
  })

  it('el menú de compras pide su permiso', () => {
    expect(canAccessFeature(['sp.p'], 'compras_insumos')).toBe(true)
    expect(canAccessFeature(['sp.v', 'sp.m'], 'compras_insumos')).toBe(false)
  })
})
