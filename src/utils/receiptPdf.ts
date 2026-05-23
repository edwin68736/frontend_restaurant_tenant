import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { PrintData } from '@/types/printData'

const FONT_SIZE = 10
const FONT_SIZE_SM = 8
const FONT_SIZE_TITLE = 12
const MARGIN = 15
const TICKET_WIDTH = 80
const A4_WIDTH = 210

function formatMoney(n: number, currency = 'PEN'): string {
  const sym = currency === 'USD' ? '$' : 'S/'
  return `${sym} ${n.toFixed(2)}`
}

function getMedioPagoLabel(method: string): string {
  const map: Record<string, string> = {
    '001': 'Depósito', '002': 'Giro', '003': 'Transferencia', '005': 'Tarjeta débito',
    '006': 'Tarjeta crédito', '008': 'Efectivo', '009': 'Efectivo', '999': 'Otros',
    efectivo: 'Efectivo', tarjeta: 'Tarjeta', 'yape': 'Yape', plin: 'Plin',
  }
  return map[method] || method
}

export async function generateReceiptPdf(
  data: PrintData,
  format: 'a4' | 'ticket' = 'a4'
): Promise<jsPDF> {
  const isTicket = format === 'ticket'
  const pageW = isTicket ? TICKET_WIDTH : A4_WIDTH
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isTicket ? [TICKET_WIDTH, 297] : 'a4',
  })

  let y = MARGIN
  const lineH = 5

  const addLine = (text: string, opts?: { size?: number; align?: 'left' | 'center' | 'right' }) => {
    const size = opts?.size ?? FONT_SIZE
    doc.setFontSize(size)
    const align = opts?.align ?? 'left'
    if (align === 'center') doc.text(text, pageW / 2, y, { align: 'center' })
    else if (align === 'right') doc.text(text, pageW - MARGIN, y, { align: 'right' })
    else doc.text(text, MARGIN, y)
    y += lineH
  }

  const addSpace = (h = 3) => { y += h }

  addLine(data.company.business_name, { size: FONT_SIZE_TITLE, align: 'center' })
  if (data.company.trade_name) addLine(data.company.trade_name, { align: 'center' })
  addLine(`RUC: ${data.company.ruc}`, { align: 'center' })
  if (data.company.address) addLine(data.company.address, { size: FONT_SIZE_SM, align: 'center' })
  addSpace(2)

  addLine(data.number, { size: FONT_SIZE_TITLE, align: 'center' })
  addLine(`Fecha: ${data.issue_date}`, { align: 'center' })
  addSpace(2)

  if (data.client) {
    addLine(`${data.client.doc_type === '6' ? 'RUC' : 'DNI'}: ${data.client.doc_number}`)
    addLine(data.client.business_name)
    if (data.client.address) addLine(data.client.address, { size: FONT_SIZE_SM })
  }
  addSpace(2)

  addLine('DETALLE', { size: FONT_SIZE_SM })
  addLine('-'.repeat(isTicket ? 18 : 45))
  for (const it of data.items) {
    const desc = it.description.length > (isTicket ? 25 : 50) ? it.description.slice(0, isTicket ? 25 : 50) + '...' : it.description
    addLine(`${it.quantity} ${it.unit} x ${formatMoney(it.unit_price)}`)
    addLine(`  ${desc}`)
    addLine(`  ${formatMoney(it.total)}`, { align: 'right' })
    addSpace(1)
  }
  addLine('-'.repeat(isTicket ? 18 : 45))
  addLine(`Subtotal: ${formatMoney(data.subtotal)}`, { align: 'right' })
  addLine(`IGV: ${formatMoney(data.tax_amount)}`, { align: 'right' })
  addLine(`TOTAL: ${formatMoney(data.total)}`, { size: FONT_SIZE_TITLE, align: 'right' })
  if (data.legend_text) addLine(data.legend_text, { size: FONT_SIZE_SM })
  addSpace(2)

  if (data.payments.length > 0) {
    addLine('PAGOS:', { size: FONT_SIZE_SM })
    for (const p of data.payments) {
      addLine(`${getMedioPagoLabel(p.method)}: ${formatMoney(p.amount)}`)
    }
    addSpace(2)
  }

  if (data.qr_data) {
    try {
      const qrDataUrl = await QRCode.toDataURL(data.qr_data, { width: 40, margin: 1 })
      const qrSize = isTicket ? 25 : 35
      doc.addImage(qrDataUrl, 'PNG', (pageW - qrSize) / 2, y, qrSize, qrSize)
      y += qrSize + 5
    } catch { /* ignore */ }
  }

  addLine('Representación impresa del comprobante electrónico', { size: FONT_SIZE_SM, align: 'center' })
  addLine('Consulte en sunat.gob.pe', { size: FONT_SIZE_SM, align: 'center' })

  return doc
}

export async function downloadReceiptPdf(data: PrintData, format: 'a4' | 'ticket' = 'a4'): Promise<void> {
  const doc = await generateReceiptPdf(data, format)
  doc.save(`comprobante-${data.series}-${data.number}.pdf`)
}

export async function openReceiptPdfInNewTab(data: PrintData, format: 'a4' | 'ticket' = 'a4'): Promise<void> {
  const doc = await generateReceiptPdf(data, format)
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
