import { downloadXlsxBytes } from '@/utils/downloadXlsx'
import { writeXlsx, type CellValue } from 'hucre'

export interface ExportColumn<T = Record<string, unknown>> {
  key: keyof T | string
  label: string
  format?: (val: unknown, row: T) => string | number
  excelNumber?: boolean
}

export async function exportTableToExcel<T extends object>(
  sheetName: string,
  columns: ExportColumn<T>[],
  data: T[],
  filename?: string,
  /** Fila final TOTAL: suma por clave de columna (solo las columnas indicadas). */
  totals?: Record<string, number>,
): Promise<void> {
  const headers: CellValue[] = columns.map((c) => c.label)
  const body: CellValue[][] = data.map((row) =>
    columns.map((col) => {
      const raw = row[col.key as keyof T]
      if (col.excelNumber) {
        const n = Number(raw)
        return Number.isFinite(n) ? n : ''
      }
      if (col.format) return col.format(raw, row) as CellValue
      return raw != null ? String(raw) : ''
    }),
  )
  const rows: CellValue[][] = [headers, ...body]
  if (totals) {
    rows.push(
      columns.map((col, i) => {
        const v = totals[String(col.key)]
        if (v !== undefined) return Math.round(v * 100) / 100
        return i === 0 ? 'TOTAL' : ''
      }),
    )
  }
  const bytes = await writeXlsx({
    sheets: [{ name: sheetName.slice(0, 31), rows }],
  })
  await downloadXlsxBytes(bytes, filename ?? `${sheetName.replace(/\s+/g, '-')}.xlsx`)
}
