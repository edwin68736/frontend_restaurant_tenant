import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { PrintData } from '@/types/printData'
import { receiptServiceCharge } from '@/utils/receiptServiceCharge'
import { buildPrecuentaEscPos } from '@/services/printers.service'
import { ReceiptPaperPreview } from '@/components/ReceiptPaperPreview'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,AA') } }))

const base = {
  doc_type: 'NOTA DE VENTA',
  sunat_code: '00',
  series: 'N001',
  number: '1',
  issue_date: '2026-11-12',
  currency: 'PEN',
  qr_data: '',
  client: null,
  company: { ruc: '20123456789', business_name: 'Demo SAC' },
  branch: { name: 'Principal' },
  items: [{ quantity: 1, description: 'Lomo', unit_price: 100, total: 118, subtotal: 100, tax_amount: 18 }],
  subtotal: 100,
  tax_amount: 18,
  total: 128,
  payments: [],
  service_charge_amount: 10,
  service_charge_rate: 10,
} as unknown as PrintData

afterEach(cleanup)

describe('recargo al consumo en impresos', () => {
  it('receiptServiceCharge devuelve null si no hay recargo', () => {
    expect(receiptServiceCharge({})).toBeNull()
    expect(receiptServiceCharge({ service_charge_amount: 0 })).toBeNull()
  })
  it('receiptServiceCharge arma la etiqueta con el %', () => {
    expect(receiptServiceCharge({ service_charge_amount: 10, service_charge_rate: 10 })).toEqual({
      amount: 10,
      rate: 10,
      label: 'Recargo al consumo (10 %)',
    })
  })
  it('la vista previa muestra la fila entre IGV y total', () => {
    render(<ReceiptPaperPreview printData={base} format="ticket" />)
    const row = screen.getByText('Recargo al consumo (10 %)')
    expect(row).toBeTruthy()
    const text = document.body.textContent ?? ''
    expect(text.indexOf('IGV')).toBeLessThan(text.indexOf('Recargo al consumo'))
    expect(text.indexOf('Recargo al consumo')).toBeLessThan(text.indexOf('TOTAL A PAGAR'))
  })
  it('la vista previa no muestra la fila sin recargo', () => {
    render(<ReceiptPaperPreview printData={{ ...base, service_charge_amount: undefined, service_charge_rate: undefined }} format="ticket" />)
    expect(screen.queryByText(/Recargo al consumo/)).toBeNull()
  })
  it('la precuenta ESC/POS imprime recargo y total con recargo', () => {
    const bytes = buildPrecuentaEscPos({
      items: [{ productName: 'Lomo', quantity: 1, unitPrice: 118 }],
      total: 118,
      serviceCharge: { rate: 10, amount: 10 },
      paperWidthMm: 80,
    })
    const txt = new TextDecoder('latin1').decode(bytes)
    expect(txt).toContain('Recargo al consumo (10%)')
    expect(txt).toContain('TOTAL CON RECARGO:')
    expect(txt).toContain('S/128.00')
  })
})
