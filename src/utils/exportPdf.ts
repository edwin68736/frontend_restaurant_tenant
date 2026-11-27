import { jsPDF } from 'jspdf'
import { downloadJsPdf } from '@/utils/downloadBlob'

const FONT_SIZE = 9
const FONT_SIZE_HEADER = 10
const MARGIN = 14
const ROW_HEIGHT = 6
const LINE_HEIGHT = 4
const A4_WIDTH = 210
const A4_HEIGHT = 297

export interface ExportColumn<T = Record<string, unknown>> {
  key: keyof T | string
  label: string
  width?: number
  /** El texto largo baja de línea; sin esto se corta a la primera. */
  wrap?: boolean
  format?: (val: unknown, row: T) => string | number
}

export async function exportTableToPdf<T extends object>(
  title: string,
  columns: ExportColumn<T>[],
  data: T[],
  filename?: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = A4_HEIGHT
  const pageHeight = A4_WIDTH
  let y = MARGIN

  doc.setFontSize(14)
  doc.text(title, MARGIN, y)
  y += 10

  if (data.length === 0) {
    doc.setFontSize(FONT_SIZE)
    doc.text('Sin datos para mostrar.', MARGIN, y)
    await downloadJsPdf(doc, filename ?? `${title.replace(/\s+/g, '-')}.pdf`)
    return
  }

  const totalWidth = pageWidth - 2 * MARGIN
  const colWidths = columns.map((c) => c.width ?? totalWidth / columns.length)
  doc.setFontSize(FONT_SIZE_HEADER)
  doc.setFont(undefined as unknown as string, 'bold')
  let x = MARGIN
  columns.forEach((col, i) => {
    doc.text(col.label, x, y)
    x += colWidths[i]
  })
  y += ROW_HEIGHT
  doc.setFont(undefined as unknown as string, 'normal')
  doc.setFontSize(FONT_SIZE)

  data.forEach((row) => {
    const cells: string[][] = columns.map((col, i) => {
      const raw = row[col.key as keyof T]
      const text = col.format ? String(col.format(raw, row)) : String(raw ?? '')
      const lines: string[] = doc.splitTextToSize(text, colWidths[i] - 2)
      return col.wrap ? lines : lines.slice(0, 1)
    })
    const extra = (Math.max(1, ...cells.map((c) => c.length)) - 1) * LINE_HEIGHT
    if (y + extra > pageHeight - MARGIN - ROW_HEIGHT) {
      doc.addPage('a4', 'landscape')
      y = MARGIN
      x = MARGIN
      doc.setFont(undefined as unknown as string, 'bold')
      doc.setFontSize(FONT_SIZE_HEADER)
      columns.forEach((col, i) => {
        doc.text(col.label, x, y)
        x += colWidths[i]
      })
      y += ROW_HEIGHT
      doc.setFont(undefined as unknown as string, 'normal')
      doc.setFontSize(FONT_SIZE)
    }
    x = MARGIN
    cells.forEach((lines, i) => {
      lines.forEach((line, n) => doc.text(line, x, y + n * LINE_HEIGHT))
      x += colWidths[i]
    })
    y += ROW_HEIGHT + extra
  })

  await downloadJsPdf(doc, filename ?? `${title.replace(/\s+/g, '-')}.pdf`)
}
