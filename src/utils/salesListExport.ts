import type { Sale } from '@/services/sales.service'
import { formatSaleDocumentNumber } from '@/services/sales.service'
import { BILLING_STATUS_LABELS } from '@/constants/billingStatus'
import { formatDisplayDate } from '@/utils/datesPeru'
import { exportTableToExcel, type ExportColumn as ExcelExportColumn } from '@/utils/exportExcel'
import { exportTableToPdf, type ExportColumn as PdfExportColumn } from '@/utils/exportPdf'

export type SalesExportRow = {
  fecha: string
  comprobante: string
  cliente: string
  total: number
  estado?: string
  estadoSunat?: string
}

function toExportRows(sales: Sale[], opts?: { includeBilling?: boolean }): SalesExportRow[] {
  return sales.map((s) => ({
    fecha: formatDisplayDate(s.issue_date),
    comprobante: `${s.doc_type} ${formatSaleDocumentNumber(s)}`.trim(),
    cliente: s.contact_name ?? '—',
    total: Number(s.total) || 0,
    estado: s.status === 'cancelled' ? 'Anulada' : 'Activa',
    estadoSunat: opts?.includeBilling
      ? BILLING_STATUS_LABELS[s.billing_status] ?? s.billing_status
      : undefined,
  }))
}

function excelColumns(includeBilling: boolean): ExcelExportColumn<SalesExportRow>[] {
  const base: ExcelExportColumn<SalesExportRow>[] = [
    { key: 'fecha', label: 'Fecha' },
    { key: 'comprobante', label: 'Comprobante' },
    { key: 'cliente', label: 'Cliente' },
    {
      key: 'total',
      label: 'Total (S/)',
      excelNumber: true,
      format: (v: unknown) => Number(v).toFixed(2),
    },
    { key: 'estado', label: 'Estado' },
  ]
  if (includeBilling) base.push({ key: 'estadoSunat', label: 'Estado SUNAT' })
  return base
}

function pdfColumns(includeBilling: boolean): PdfExportColumn<SalesExportRow>[] {
  const base = excelColumns(includeBilling)
  return base.map((c, i) => ({
    ...c,
    width: [28, 45, 50, 25, 22, 28][i] ?? 30,
  }))
}

export async function exportSalesListExcel(
  title: string,
  sales: Sale[],
  filename: string,
  opts?: { includeBilling?: boolean },
): Promise<void> {
  await exportTableToExcel(title, excelColumns(!!opts?.includeBilling), toExportRows(sales, opts), filename)
}

export function exportSalesListPdf(
  title: string,
  sales: Sale[],
  filename: string,
  opts?: { includeBilling?: boolean },
): void {
  exportTableToPdf(title, pdfColumns(!!opts?.includeBilling), toExportRows(sales, opts), filename)
}
