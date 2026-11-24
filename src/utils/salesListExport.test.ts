import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Sale } from '@/services/sales.service'

// Se captura lo que se escribiría en el Excel sin generar el archivo.
const written: { rows: unknown[][] }[] = []
vi.mock('hucre', () => ({
  writeXlsx: async (wb: { sheets: { rows: unknown[][] }[] }) => {
    written.push(wb.sheets[0])
    return new Uint8Array()
  },
}))
vi.mock('@/utils/downloadXlsx', () => ({ downloadXlsxBytes: async () => undefined }))

import { exportSalesListExcel, salesActiveTotal, salesConvertedTotal } from '@/utils/salesListExport'

const sale = (over: Partial<Sale>): Sale =>
  ({
    id: 1, doc_type: 'BOLETA', series: 'B001', number: '1', issue_date: '2026-11-10T12:00:00', contact_name: 'Cliente',
    subtotal: 0, tax_amount: 0, total: 0, currency: 'PEN', status: 'paid', billing_status: 'accepted', branch_id: 1, created_at: '',
    ...over,
  }) as Sale

describe('listado de ventas: comprobantes convertidos desde nota de venta', () => {
  beforeEach(() => {
    written.length = 0
  })

  const sales = [
    sale({ id: 1, number: '1', total: 100 }),
    sale({ id: 2, number: '2', total: 118, is_converted: true, converted_from_number: 'NV001-00000206' }),
    sale({ id: 3, number: '3', total: 40, is_converted: true, status: 'cancelled' }), // anulada: no cuenta
  ]

  it('suma aparte solo los convertidos vigentes', () => {
    expect(salesActiveTotal(sales)).toBe(218)
    expect(salesConvertedTotal(sales)).toBe(118)
  })

  it('el Excel trae la columna Convertido, la nota de origen y la fila «De los cuales convertidos»', async () => {
    await exportSalesListExcel('Facturas y boletas', sales, 'x.xlsx', { includeBilling: true })
    const rows = written[0].rows
    const header = rows[0] as string[]
    expect(header).toContain('Convertido')
    expect(header).toContain('Nota de venta origen')
    const iConv = header.indexOf('Convertido')
    const iFrom = header.indexOf('Nota de venta origen')
    expect(rows[1][iConv]).toBe('No')
    expect(rows[2][iConv]).toBe('Sí')
    expect(rows[2][iFrom]).toBe('NV001-00000206')
    const iTotal = header.indexOf('Total (S/)')
    const total = rows.find((r) => r[0] === 'TOTAL') as (string | number)[]
    const conv = rows.find((r) => String(r[0]).startsWith('De los cuales convertidos')) as (string | number)[]
    expect(total[iTotal]).toBe(218)
    expect(conv[iTotal]).toBe(118)
  })
})
