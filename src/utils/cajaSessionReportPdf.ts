import { jsPDF } from 'jspdf'
import type { CashSessionReport } from '@/services/cashbank.service'
import { downloadJsPdf } from '@/utils/downloadBlob'

const PAGE_W = 210
const MARGIN = 12
const INNER_W = PAGE_W - MARGIN * 2
const PAGE_BOTTOM = 272
const FOOTER_Y = 287

const C_HEADER = [30, 41, 59] as const
const C_HEADER_TEXT = [255, 255, 255] as const
const C_MUTED = [100, 116, 139] as const
const C_TEXT = [15, 23, 42] as const
const C_BORDER = [226, 232, 240] as const
const C_ROW_ALT = [248, 250, 252] as const
const C_ACCENT = [22, 101, 52] as const

function money(n: number): string {
  return `S/ ${Number(n).toFixed(2)}`
}

function paymentMethodLabel(code: string): string {
  const c = (code || '').toLowerCase()
  const map: Record<string, string> = {
    cash: 'Efectivo',
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    yape: 'Yape',
    plin: 'Plin',
    transferencia: 'Transferencia',
  }
  return map[c] || code || '—'
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch {
    return d
  }
}

/** Misma convención que el backend al fusionar notas de cierre */
export const SESSION_NOTES_CLOSING_MARKER = '\n\n[Notas de cierre]\n'

export function parseSessionNotesBlock(raw?: string | null): { opening: string; closing: string } {
  const t = (raw ?? '').trim()
  if (!t) return { opening: '', closing: '' }
  const i = t.indexOf(SESSION_NOTES_CLOSING_MARKER)
  if (i === -1) return { opening: t, closing: '' }
  return {
    opening: t.slice(0, i).trim(),
    closing: t.slice(i + SESSION_NOTES_CLOSING_MARKER.length).trim(),
  }
}

function ensureSpace(doc: jsPDF, y: { v: number }, h: number) {
  if (y.v + h > PAGE_BOTTOM) {
    doc.addPage()
    y.v = MARGIN
  }
}

function drawFooterOnAllPages(doc: jsPDF) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(...C_BORDER)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C_MUTED)
    doc.text(`Tukichef · Página ${i} de ${n}`, PAGE_W / 2, FOOTER_Y, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }
}

function drawSectionTitle(doc: jsPDF, y: { v: number }, title: string) {
  ensureSpace(doc, y, 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...C_TEXT)
  doc.text(title, MARGIN, y.v)
  y.v += 2
  doc.setDrawColor(...C_ACCENT)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y.v, MARGIN + 42, y.v)
  doc.setDrawColor(...C_BORDER)
  y.v += 5
}

/** Tabla con bordes; última columna alineada a la derecha (montos). */
function drawDataTable(
  doc: jsPDF,
  y: { v: number },
  headers: string[],
  rows: string[][],
  colWidths: number[]
) {
  const x0 = MARGIN
  const totalW = colWidths.reduce((a, b) => a + b, 0)
  const headerH = 7
  const rowH = 6.2

  ensureSpace(doc, y, headerH + 2)
  doc.setFillColor(241, 245, 249)
  doc.rect(x0, y.v - 4.5, totalW, headerH, 'F')
  doc.setDrawColor(...C_BORDER)
  doc.setLineWidth(0.2)
  doc.rect(x0, y.v - 4.5, totalW, headerH)

  let x = x0
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(51, 65, 85)
  headers.forEach((h, i) => {
    doc.text(h, x + 1.8, y.v + 0.5)
    if (i < headers.length - 1) {
      doc.line(x + colWidths[i], y.v - 4.5, x + colWidths[i], y.v + headerH - 4.5)
    }
    x += colWidths[i]
  })
  y.v += headerH

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (let r = 0; r < rows.length; r++) {
    ensureSpace(doc, y, rowH + 1)
    if (r % 2 === 1) {
      doc.setFillColor(...C_ROW_ALT)
      doc.rect(x0, y.v - 4.2, totalW, rowH, 'F')
    }
    x = x0
    rows[r].forEach((cell, i) => {
      const w = colWidths[i] - 3
      const isLast = i === headers.length - 1
      doc.setTextColor(...C_TEXT)
      const lines = doc.splitTextToSize(String(cell ?? ''), w)
      const line = lines.length > 1 ? `${lines[0]}…` : lines[0] || '—'
      if (isLast) {
        doc.text(line, x + colWidths[i] - 1.5, y.v, { align: 'right', maxWidth: w })
      } else {
        doc.text(line, x + 1.5, y.v)
      }
      if (i < headers.length - 1) {
        doc.setDrawColor(236, 240, 245)
        doc.line(x + colWidths[i], y.v - 4.2, x + colWidths[i], y.v + rowH - 4.2)
      }
      x += colWidths[i]
    })
    doc.setDrawColor(...C_BORDER)
    doc.line(x0, y.v + rowH - 4.2, x0 + totalW, y.v + rowH - 4.2)
    y.v += rowH
  }
  y.v += 4
}

function drawKeyValueGrid(doc: jsPDF, y: { v: number }, pairs: { k: string; v: string }[]) {
  const colW = INNER_W / 2 - 2
  const lineH = 5.5
  for (let i = 0; i < pairs.length; i += 2) {
    ensureSpace(doc, y, lineH + 1)
    const left = pairs[i]
    const right = pairs[i + 1]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C_MUTED)
    doc.text(left.k, MARGIN, y.v)
    if (right) doc.text(right.k, MARGIN + INNER_W / 2 + 2, y.v)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C_TEXT)
    doc.setFontSize(8.5)
    const vLines = doc.splitTextToSize(left.v, colW)
    doc.text(vLines[0] ?? '—', MARGIN, y.v + 4)
    if (right) {
      const v2 = doc.splitTextToSize(right.v, colW)
      doc.text(v2[0] ?? '—', MARGIN + INNER_W / 2 + 2, y.v + 4)
    }
    y.v += lineH + 5
  }
}

function drawSummaryBoxes(
  doc: jsPDF,
  y: { v: number },
  items: { label: string; value: string; tone?: 'default' | 'green' | 'red' | 'strong' }[]
) {
  const gap = 3
  const n = items.length
  const boxW = (INNER_W - gap * (n - 1)) / n
  const boxH = 20
  ensureSpace(doc, y, boxH + 4)
  let bx = MARGIN
  for (const it of items) {
    doc.setDrawColor(...C_BORDER)
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(bx, y.v, boxW, boxH, 1.2, 1.2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C_MUTED)
    doc.text(it.label, bx + 2.5, y.v + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(it.tone === 'strong' ? 11 : 10)
    if (it.tone === 'green') doc.setTextColor(21, 128, 61)
    else if (it.tone === 'red') doc.setTextColor(185, 28, 28)
    else if (it.tone === 'strong') doc.setTextColor(...C_TEXT)
    else doc.setTextColor(...C_TEXT)
    doc.text(it.value, bx + 2.5, y.v + 15)
    doc.setTextColor(0, 0, 0)
    bx += boxW + gap
  }
  y.v += boxH + 6
}

export function generateCajaSessionReportPdf(report: CashSessionReport, opts?: { companyName?: string }): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const y = { v: MARGIN }

  // Cabecera ancho completo
  doc.setFillColor(...C_HEADER)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  doc.setTextColor(...C_HEADER_TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('REPORTE DE CAJA', MARGIN, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const sub = opts?.companyName?.trim() || 'Resumen de sesión'
  doc.text(sub, MARGIN, 21)
  doc.setFontSize(8)
  doc.setTextColor(203, 213, 225)
  doc.text(`Generado: ${new Date().toLocaleString()}`, MARGIN, 27)
  doc.setTextColor(0, 0, 0)
  y.v = 36

  const s = report.session

  drawSectionTitle(doc, y, 'Datos de la sesión')
  drawKeyValueGrid(doc, y, [
    { k: 'Sucursal', v: s.branch_name || '—' },
    { k: 'Nº sesión', v: String(s.id) },
    { k: 'Responsable apertura', v: s.opened_by_user_name || '—' },
    { k: 'Estado', v: s.status === 'open' ? 'Abierta' : 'Cerrada' },
    { k: 'Apertura', v: fmtDate(s.opened_at) },
    { k: 'Cierre', v: s.closed_at ? fmtDate(s.closed_at) : '—' },
  ])

  const { opening, closing } = parseSessionNotesBlock(s.notes)
  if (opening || closing) {
    drawSectionTitle(doc, y, 'Notas')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...C_TEXT)
    if (opening) {
      ensureSpace(doc, y, 12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...C_MUTED)
      doc.text('Apertura', MARGIN, y.v)
      y.v += 4
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C_TEXT)
      const lines = doc.splitTextToSize(opening, INNER_W)
      for (const ln of lines) {
        ensureSpace(doc, y, 5)
        doc.text(ln, MARGIN, y.v)
        y.v += 4.5
      }
      y.v += 2
    }
    if (closing) {
      ensureSpace(doc, y, 12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...C_MUTED)
      doc.text('Cierre', MARGIN, y.v)
      y.v += 4
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C_TEXT)
      const lines2 = doc.splitTextToSize(closing, INNER_W)
      for (const ln of lines2) {
        ensureSpace(doc, y, 5)
        doc.text(ln, MARGIN, y.v)
        y.v += 4.5
      }
      y.v += 2
    }
  }

  const cash = report.cash_physical
  const electronic = report.electronic

  drawSectionTitle(doc, y, 'Resumen financiero')
  drawSummaryBoxes(doc, y, [
    { label: 'Saldo físico en caja', value: money(cash?.physical_balance ?? report.totals.final_balance), tone: 'strong' },
    { label: 'Ingresos efectivo (caja)', value: money(cash?.total_income ?? report.totals.total_income), tone: 'green' },
    { label: 'Egresos de caja', value: money(cash?.total_expense ?? report.totals.total_expense), tone: 'red' },
    { label: 'Ventas electrónicas', value: money(electronic?.total_sales ?? 0) },
    { label: 'Total ventas sesión', value: money(report.totals.total_sales) },
  ])

  ensureSpace(doc, y, 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C_MUTED)
  doc.text(`Saldo inicial de caja: ${money(cash?.opening_balance ?? s.opening_balance)}`, MARGIN, y.v)
  y.v += 8

  drawSectionTitle(doc, y, 'Totales por método — caja física')
  const cashMethodRows: string[][] = []
  for (const x of report.totals_by_method.sales ?? []) {
    const m = (x.method || '').toLowerCase()
    if (m === 'cash' || m === 'efectivo') {
      cashMethodRows.push(['Ventas efectivo', paymentMethodLabel(x.method), money(x.total)])
    }
  }
  for (const x of report.totals_by_method.movements ?? []) {
    cashMethodRows.push(['Mov. manual', paymentMethodLabel(x.method), money(x.total)])
  }
  if (cashMethodRows.length === 0) {
    ensureSpace(doc, y, 6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C_MUTED)
    doc.text('Sin movimientos de caja física por método.', MARGIN, y.v)
    y.v += 8
  } else {
    drawDataTable(doc, y, ['Origen', 'Método', 'Monto'], cashMethodRows, [42, 118, 26])
  }

  drawSectionTitle(doc, y, 'Totales por método — medios electrónicos')
  const electronicMethodRows: string[][] = (electronic?.sales_by_method ?? []).map((x) => [
    'Ventas',
    paymentMethodLabel(x.method),
    money(x.total),
  ])
  if (electronicMethodRows.length === 0) {
    ensureSpace(doc, y, 6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C_MUTED)
    doc.text('Sin ventas por medios electrónicos en esta sesión.', MARGIN, y.v)
    y.v += 8
  } else {
    drawDataTable(doc, y, ['Origen', 'Método', 'Monto'], electronicMethodRows, [42, 118, 26])
  }

  if ((report.totals_by_method.purchases ?? []).length > 0) {
    drawSectionTitle(doc, y, 'Compras por método')
    const purchaseRows = (report.totals_by_method.purchases ?? []).map((x) => [
      'Compras',
      paymentMethodLabel(x.method),
      money(x.total),
    ])
    drawDataTable(doc, y, ['Origen', 'Método', 'Monto'], purchaseRows, [42, 118, 26])
  }

  const incomeCols = [38, 28, 58, 28, 26] as const
  const incomeHeaders = ['Fecha / hora', 'Documento', 'Referencia', 'Método', 'Monto']
  const mapIncomeRows = (rows: CashSessionReport['income_detail']) =>
    (rows ?? []).map((r) => [
      fmtDate(r.date),
      r.doc_number || '—',
      r.reference || '—',
      paymentMethodLabel(r.payment_method),
      money(r.amount),
    ])

  drawSectionTitle(doc, y, 'Ventas en efectivo (caja física)')
  const cashSalesRows = mapIncomeRows(cash?.cash_sales ?? [])
  if (cashSalesRows.length === 0) {
    ensureSpace(doc, y, 6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C_MUTED)
    doc.text('Sin ventas en efectivo en esta sesión.', MARGIN, y.v)
    y.v += 8
  } else {
    drawDataTable(doc, y, [...incomeHeaders], cashSalesRows, [...incomeCols])
  }

  drawSectionTitle(doc, y, 'Ventas por medios electrónicos')
  const electronicSalesRows = mapIncomeRows(electronic?.sales ?? [])
  if (electronicSalesRows.length === 0) {
    ensureSpace(doc, y, 6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C_MUTED)
    doc.text('Sin ventas por Yape, Plin, tarjeta u otros medios.', MARGIN, y.v)
    y.v += 8
  } else {
    drawDataTable(doc, y, [...incomeHeaders], electronicSalesRows, [...incomeCols])
  }

  const manualIncome = cash?.manual_income ?? []
  if (manualIncome.length > 0) {
    drawSectionTitle(doc, y, 'Ingresos manuales (caja)')
    drawDataTable(doc, y, [...incomeHeaders], mapIncomeRows(manualIncome), [...incomeCols])
  }

  const expenseCols = [34, 22, 26, 58, 22, 24] as const
  const expenseHeaders = ['Fecha / hora', 'Tipo', 'Documento', 'Referencia', 'Método', 'Monto']
  const expenseSource = cash?.expenses ?? report.expense_detail ?? []

  drawSectionTitle(doc, y, 'Gastos y egresos (caja física)')
  const expenseRows = expenseSource.map((r) => [
    fmtDate(r.date),
    r.type,
    r.doc_number || '—',
    r.reference || '—',
    paymentMethodLabel(r.payment_method),
    money(r.amount),
  ])
  if (expenseRows.length === 0) {
    ensureSpace(doc, y, 6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C_MUTED)
    doc.text('Sin egresos en esta sesión.', MARGIN, y.v)
    y.v += 8
  } else {
    drawDataTable(doc, y, [...expenseHeaders], expenseRows, [...expenseCols])
  }

  drawSectionTitle(doc, y, 'Ventas anuladas')
  ensureSpace(doc, y, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...C_MUTED)
  doc.text(
    'Reversiones en caja por anulación de notas de venta (trazabilidad; no elimina el historial).',
    MARGIN,
    y.v,
  )
  y.v += 5

  const voidCols = [32, 36, 24, 24, 70] as const
  const voidHeaders = ['Fecha / hora', 'Comprobante', 'Método', 'Monto', 'Motivo']
  const voidRows = (report.cancelled_sales_detail ?? []).map((r) => [
    fmtDate(r.date),
    r.doc_number || '—',
    paymentMethodLabel(r.payment_method),
    money(r.amount),
    r.reason || '—',
  ])
  if (voidRows.length === 0) {
    ensureSpace(doc, y, 6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C_MUTED)
    doc.text('Sin ventas anuladas en esta sesión.', MARGIN, y.v)
    y.v += 8
  } else {
    drawDataTable(doc, y, [...voidHeaders], voidRows, [...voidCols])
  }

  drawFooterOnAllPages(doc)
  return doc
}

/** Caracteres no válidos en nombres de archivo (Windows / navegadores). */
function sanitizeFilenamePart(raw: string, maxLen = 48): string {
  const s = raw
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, maxLen)
  return s || 'caja'
}

/** Nombre único: reporte-caja_{sucursal}_{YYYY-MM-DD}_{HH-mm-ss}.pdf */
export function buildReportCajaPdfFilename(report: CashSessionReport): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const da = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const se = String(now.getSeconds()).padStart(2, '0')
  const fecha = `${y}-${mo}-${da}`
  const hora = `${h}-${mi}-${se}`
  const nombreCaja = sanitizeFilenamePart(report.session.branch_name || `Sesion-${report.session.id}`)
  return `reporte-caja_${nombreCaja}_${fecha}_${hora}.pdf`
}

export async function downloadCajaSessionReportPdf(report: CashSessionReport, opts?: { companyName?: string }): Promise<void> {
  const doc = generateCajaSessionReportPdf(report, opts)
  await downloadJsPdf(doc, buildReportCajaPdfFilename(report))
}
