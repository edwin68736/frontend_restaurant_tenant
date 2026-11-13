import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ReceiptPaperPreview } from '@/components/ReceiptPaperPreview'
import type { PrintData } from '@/types/printData'

afterEach(cleanup)

const data = (sunat_code: string, company: Record<string, unknown>) =>
  ({
    doc_type: sunat_code === '00' ? 'NOTA DE VENTA' : 'BOLETA',
    sunat_code,
    series: 'X001',
    number: 'X001-1',
    issue_date: '13/11/2026',
    currency: 'PEN',
    qr_data: '',
    client: { doc_type: '0', doc_number: '99999999', business_name: 'Clientes Varios' },
    company: { ruc: '10726187938', business_name: 'DEMO S.A.C.', trade_name: 'SUPER DEMO', ...company },
    branch: { name: 'Principal' },
    items: [{ code: 'A', description: 'Arroz', unit: 'NIU', quantity: 1, unit_price: 11.8, discount: 0, subtotal: 10, tax_amount: 1.8, total: 11.8 }],
    subtotal: 10,
    tax_amount: 1.8,
    total: 11.8,
    totals_by_affectation: { '10': { code: '10', description: 'Gravado', subtotal: 10, tax_amount: 1.8, total: 11.8 } },
    payments: [],
  }) as unknown as PrintData

describe('vista previa del comprobante: ajustes de nota de venta', () => {
  it('con los ajustes apagados, la nota de venta no muestra razón social ni desglose del IGV', () => {
    const { container } = render(
      <ReceiptPaperPreview
        format="ticket"
        printData={data('00', { show_business_name_on_sale_note: false, show_igv_breakdown_on_sale_note: false })}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('SUPER DEMO')
    expect(text).not.toContain('DEMO S.A.C.')
    expect(text).not.toContain('Op. Gravadas')
    expect(text).not.toMatch(/\bIGV\b/)
    expect(text).toContain('TOTAL A PAGAR')
  })

  it('con los ajustes por defecto la nota de venta se ve como siempre', () => {
    const { container } = render(<ReceiptPaperPreview format="ticket" printData={data('00', {})} />)
    const text = container.textContent ?? ''
    expect(text).toContain('DEMO S.A.C.')
    expect(text).toContain('Op. Gravadas')
  })

  it('una boleta no se ve afectada por los ajustes de nota de venta', () => {
    const { container } = render(
      <ReceiptPaperPreview
        format="ticket"
        printData={data('03', { show_business_name_on_sale_note: false, show_igv_breakdown_on_sale_note: false })}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('DEMO S.A.C.')
    expect(text).toContain('Op. Gravadas')
  })
})
