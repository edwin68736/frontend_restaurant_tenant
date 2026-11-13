import { describe, expect, it } from 'vitest'
import { hideBusinessNameOnSaleNote, receiptBreakdownVisibility } from '@/utils/saleNoteDisplay'
import type { PrintData } from '@/types/printData'

const doc = (sunat_code: string, company: Partial<PrintData['company']>) =>
  ({ sunat_code, company: { ruc: '1', business_name: 'ACME SAC', trade_name: 'Acme', ...company } }) as Pick<PrintData, 'sunat_code' | 'company'>

describe('ajustes de nota de venta al imprimir', () => {
  it('oculta el desglose solo en nota de venta (00) cuando el ajuste está apagado', () => {
    const off = { show_igv_breakdown_on_sale_note: false }
    expect(receiptBreakdownVisibility(doc('00', off))).toEqual({ hide: true, bySaleNoteOnly: true })
    expect(receiptBreakdownVisibility(doc('03', off)).hide).toBe(false) // boleta no se afecta
    expect(receiptBreakdownVisibility(doc('01', off)).hide).toBe(false) // factura tampoco
    expect(receiptBreakdownVisibility(doc('00', {})).hide).toBe(false) // por defecto se muestra
  })

  it('el régimen (Nuevo RUS) oculta el desglose en cualquier comprobante y no se confunde con el ajuste', () => {
    expect(receiptBreakdownVisibility(doc('03', { show_igv_breakdown: false }))).toEqual({ hide: true, bySaleNoteOnly: false })
    expect(receiptBreakdownVisibility(doc('00', { show_igv_breakdown: false, show_igv_breakdown_on_sale_note: false })).bySaleNoteOnly).toBe(false)
  })

  it('oculta la razón social solo en nota de venta y solo si hay nombre comercial con qué reemplazarla', () => {
    const off = { show_business_name_on_sale_note: false }
    expect(hideBusinessNameOnSaleNote(doc('00', off), 'Acme')).toBe(true)
    expect(hideBusinessNameOnSaleNote(doc('00', off), '')).toBe(false) // sin nombre comercial se sigue mostrando
    expect(hideBusinessNameOnSaleNote(doc('01', off), 'Acme')).toBe(false)
    expect(hideBusinessNameOnSaleNote(doc('00', {}), 'Acme')).toBe(false)
  })
})
