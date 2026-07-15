import { writeXlsx, type CellValue } from 'hucre'
import type { CashSessionReport } from '@/services/cashbank.service'
import { salePaymentMethodLabelEs } from '@/utils/paymentMethodLabels'

/**
 * Exporta el reporte de sesión de caja a Excel, con una hoja por sección igual que el PDF.
 * Se usa writeXlsx directo (y no exportTableToExcel) porque ese helper es de una sola hoja
 * y aquí el reporte tiene resumen, ingresos, egresos, métodos y anuladas.
 *
 * Los importes van como número, no como texto: así se pueden sumar en Excel, que es la
 * razón de pedir Excel en vez del PDF.
 */
function money(n: unknown): CellValue {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function sectionTitle(rows: CellValue[][], title: string) {
  rows.push([title])
}

function buildSummarySheet(report: CashSessionReport): CellValue[][] {
  const s = report.session
  const t = report.totals
  const rows: CellValue[][] = []

  sectionTitle(rows, 'RESUMEN DE SESIÓN DE CAJA')
  rows.push([])
  rows.push(['Sesión', s.id ?? ''])
  rows.push(['Abierta por', s.opened_by_user_name ?? ''])
  rows.push(['Sucursal', s.branch_name ?? ''])
  rows.push(['Apertura', s.opened_at ?? ''])
  rows.push(['Cierre', s.closed_at ?? ''])
  rows.push(['Estado', s.status ?? ''])
  rows.push([])

  sectionTitle(rows, 'TOTALES')
  rows.push(['Concepto', 'Monto'])
  rows.push(['Saldo inicial', money(s.opening_balance)])
  rows.push(['Total ingresos', money(t.total_income)])
  rows.push(['Total egresos', money(t.total_expense)])
  rows.push(['Total ventas', money(t.total_sales)])
  rows.push(['Total compras', money(t.total_purchases)])
  rows.push(['Saldo final', money(t.final_balance)])
  rows.push([])

  const cash = report.cash_physical
  if (cash) {
    sectionTitle(rows, 'EFECTIVO EN CAJA')
    rows.push(['Concepto', 'Monto'])
    rows.push(['Saldo de apertura', money(cash.opening_balance)])
    rows.push(['Ventas en efectivo', money(cash.sales_total)])
    rows.push(['Ingresos', money(cash.total_income)])
    rows.push(['Egresos', money(cash.total_expense)])
    rows.push(['Saldo físico', money(cash.physical_balance)])
    if (s.closing_balance != null) {
      rows.push(['Saldo de cierre declarado', money(s.closing_balance)])
      rows.push(['Diferencia', money(Number(s.closing_balance) - Number(cash.physical_balance))])
    }
    rows.push([])
  }

  const electronic = report.electronic
  if (electronic) {
    sectionTitle(rows, 'VENTAS ELECTRÓNICAS')
    rows.push(['Concepto', 'Monto'])
    rows.push(['Total', money(electronic.total_sales)])
  }
  return rows
}

function buildMovementsSheet(
  title: string,
  detail: { date: string; type: string; doc_number: string; reference: string; amount: number; payment_method: string }[],
): CellValue[][] {
  const rows: CellValue[][] = [
    [title],
    [],
    ['Fecha', 'Tipo', 'Documento', 'Referencia', 'Método de pago', 'Monto'],
  ]
  for (const r of detail) {
    rows.push([
      r.date ?? '',
      r.type ?? '',
      r.doc_number ?? '',
      r.reference ?? '',
      salePaymentMethodLabelEs(r.payment_method ?? ''),
      money(r.amount),
    ])
  }
  if (detail.length === 0) rows.push(['Sin movimientos'])
  return rows
}

function buildMethodsSheet(report: CashSessionReport): CellValue[][] {
  const rows: CellValue[][] = [['TOTALES POR MÉTODO DE PAGO'], []]
  const blocks: [string, { method: string; total: number }[]][] = [
    ['Ventas', report.totals_by_method?.sales ?? []],
    ['Compras', report.totals_by_method?.purchases ?? []],
    ['Movimientos', report.totals_by_method?.movements ?? []],
  ]
  for (const [label, list] of blocks) {
    rows.push([label])
    rows.push(['Método', 'Total'])
    if (list.length === 0) rows.push(['Sin registros'])
    for (const m of list) rows.push([salePaymentMethodLabelEs(m.method ?? ''), money(m.total)])
    rows.push([])
  }
  return rows
}

export async function downloadCajaSessionReportExcel(
  report: CashSessionReport,
  opts?: { companyName?: string },
): Promise<void> {
  const sheets: { name: string; rows: CellValue[][] }[] = []

  const summary = buildSummarySheet(report)
  if (opts?.companyName?.trim()) summary.unshift([opts.companyName.trim()], [])
  sheets.push({ name: 'Resumen', rows: summary })

  sheets.push({ name: 'Ingresos', rows: buildMovementsSheet('INGRESOS', report.income_detail ?? []) })
  sheets.push({ name: 'Egresos', rows: buildMovementsSheet('EGRESOS', report.expense_detail ?? []) })
  sheets.push({ name: 'Por método', rows: buildMethodsSheet(report) })

  const cancelled = report.cancelled_sales_detail ?? []
  if (cancelled.length > 0) {
    const rows: CellValue[][] = [['VENTAS ANULADAS'], [], ['Documento', 'Motivo', 'Monto']]
    for (const c of cancelled) {
      rows.push([
        String((c as { document_number?: string }).document_number ?? ''),
        String((c as { reason?: string }).reason ?? ''),
        money((c as { total?: number }).total),
      ])
    }
    sheets.push({ name: 'Anuladas', rows })
  }

  const bytes = await writeXlsx({ sheets })
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reporte-caja-sesion-${report.session?.id ?? ''}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
