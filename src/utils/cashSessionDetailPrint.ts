import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import { cashbankService, type CashSession } from '@/services/cashbank.service'
import { companyService } from '@/services/company.service'
import {
  getConfiguredPrinter,
  isNativePrintAvailable,
  printRawEscPos,
} from '@/services/printers.service'
import { downloadJsPdf } from '@/utils/downloadBlob'
import { normalizeTextForTicketPrint } from '@/utils/normalizeTextForTicketPrint'
import {
  buildCashSessionDetailLines,
  type CashDetailSections,
  type CashSessionDetailData,
  type TicketLine,
} from '@/utils/cashSessionDetailTicket'
import { printTicketPdfDocument, ticketLayoutWidthMm } from '@/utils/receiptPrintTicket'
import {
  configuredTicketPaperMm,
  escposColumnsForPaper,
  type TicketPaperWidthMm,
} from '@/utils/receiptTicketPaper'

/** Reúne todo lo que el detalle necesita (reporte, comprobantes, productos, empresa y fila de sesión). */
export async function loadCashSessionDetailData(
  sessionId: number,
  sessionRow?: CashSession | null,
  sections?: Partial<CashDetailSections>,
): Promise<CashSessionDetailData> {
  // Los comprobantes se piden siempre: el resumen (vigentes/anulados) los usa aunque no se listen.
  // Los productos solo si la sección está marcada.
  const wantProducts = sections?.products !== false
  const [report, documents, products, company, row] = await Promise.all([
    cashbankService.getSessionReport(sessionId),
    cashbankService.getSessionDocumentsReport(sessionId),
    wantProducts ? cashbankService.getSessionProductsReport(sessionId) : Promise.resolve([]),
    companyService.getConfig().catch(() => null),
    sessionRow ? Promise.resolve(sessionRow) : cashbankService.getSession(sessionId).catch(() => null),
  ])
  // closeSession/getSession no traen el nombre de quien cerró: el listado sí.
  let sessionData = row ?? null
  if (sessionData && sessionData.status === 'closed' && !sessionData.closed_by_name) {
    const listed = await cashbankService.listSessions(report.session.branch_id).catch(() => [] as CashSession[])
    const match = listed.find((s) => s.id === sessionId)
    if (match) sessionData = { ...sessionData, ...match }
  }
  return {
    company: {
      name: company?.trade_name?.trim() || company?.business_name?.trim() || '',
      ruc: company?.ruc?.trim() || '',
    },
    session: sessionData,
    report,
    documents,
    products: products ?? [],
    sections,
  }
}

/* ───────────── ESC/POS ───────────── */

function escposBytes(lines: TicketLine[], cols: number): Uint8Array {
  const out: number[] = [0x1b, 0x40]
  const enc = new TextEncoder()
  let align: 'left' | 'center' | 'right' = 'left'
  let bold = false
  let big = false
  for (const l of lines) {
    const a = l.align ?? 'left'
    if (a !== align) {
      out.push(0x1b, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2)
      align = a
    }
    if (Boolean(l.bold) !== bold) {
      out.push(0x1b, 0x45, l.bold ? 1 : 0)
      bold = Boolean(l.bold)
    }
    if (Boolean(l.big) !== big) {
      out.push(0x1d, 0x21, l.big ? 0x11 : 0x00)
      big = Boolean(l.big)
    }
    const text = normalizeTextForTicketPrint(l.text).slice(0, l.big ? Math.floor(cols / 2) : cols)
    out.push(...Array.from(enc.encode(`${text}\n`)))
  }
  out.push(0x1b, 0x45, 0x00, 0x1d, 0x21, 0x00, 0x1b, 0x61, 0x00)
  out.push(...Array.from(enc.encode('\n\n\n')))
  out.push(0x1d, 0x56, 0x41, 0x10)
  return new Uint8Array(out)
}

/* ───────────── PDF (una sola hoja larga, tipografía monoespaciada) ───────────── */

export function buildCashSessionDetailPdf(lines: TicketLine[], paperMm: TicketPaperWidthMm): jsPDF {
  const cols = escposColumnsForPaper(paperMm)
  const pageW = ticketLayoutWidthMm(paperMm)
  const margin = paperMm === 58 ? 1.5 : 3
  const usable = pageW - margin * 2
  const charW = usable / cols
  const fontPt = charW / 0.6 / 0.3528
  const lineH = fontPt * 0.3528 * 1.18
  const height = Math.max(40, margin * 2 + lines.length * lineH + 6)
  const doc = new jsPDF({ unit: 'mm', format: [pageW, height] })
  doc.setFont('courier', 'normal')
  doc.setTextColor(0, 0, 0)
  let y = margin + lineH * 0.8
  for (const l of lines) {
    const bigScale = l.big ? 2 : 1
    doc.setFont('courier', l.bold ? 'bold' : 'normal')
    doc.setFontSize(fontPt * bigScale)
    const text = normalizeTextForTicketPrint(l.text)
    const w = text.length * charW * bigScale
    const x =
      l.align === 'center' ? margin + (usable - w) / 2 : l.align === 'right' ? margin + usable - w : margin
    if (l.big) y += lineH * 0.5
    doc.text(text, Math.max(margin, x), y)
    y += lineH * (l.big ? 1.5 : 1)
  }
  return doc
}

/* ───────────── Acciones ───────────── */

function filename(data: CashSessionDetailData): string {
  return `detalle-caja-${data.report.session.id}.pdf`
}

/**
 * Imprime el detalle de caja: impresora térmica configurada en «Impresoras y ajustes» (documentos)
 * cuando hay impresión nativa; si no, vista de impresión del navegador con la hoja del ancho configurado.
 */
export async function printCashSessionDetail(
  sessionId: number,
  opts?: { sessionRow?: CashSession | null; quiet?: boolean; sections?: Partial<CashDetailSections> },
): Promise<boolean> {
  const toastId = opts?.quiet ? undefined : toast.loading('Preparando detalle de caja…')
  try {
    const data = await loadCashSessionDetailData(sessionId, opts?.sessionRow, opts?.sections)
    const cfg = isNativePrintAvailable() ? getConfiguredPrinter('documentos') : null
    if (cfg) {
      const cols = escposColumnsForPaper(cfg.paperWidthMm)
      await printRawEscPos({
        ...cfg,
        data: escposBytes(buildCashSessionDetailLines(data, cols), cols),
        docName: 'Tukichef - Detalle de caja',
      })
    } else {
      const paper = configuredTicketPaperMm()
      const lines = buildCashSessionDetailLines(data, escposColumnsForPaper(paper))
      await printTicketPdfDocument(buildCashSessionDetailPdf(lines, paper), paper)
    }
    if (toastId !== undefined) toast.success('Detalle de caja enviado a imprimir', { id: toastId })
    return true
  } catch (e) {
    console.error('[caja] imprimir detalle', e)
    const msg = e instanceof Error && e.message ? e.message : 'No se pudo imprimir el detalle de caja'
    if (toastId !== undefined) toast.error(msg, { id: toastId })
    else toast.error(msg)
    return false
  }
}

/** Descarga el mismo detalle como PDF de ticket (ancho de rollo configurado). */
export async function downloadCashSessionDetailPdf(
  sessionId: number,
  opts?: { sessionRow?: CashSession | null; sections?: Partial<CashDetailSections> },
): Promise<void> {
  const data = await loadCashSessionDetailData(sessionId, opts?.sessionRow, opts?.sections)
  const paper = configuredTicketPaperMm()
  const lines = buildCashSessionDetailLines(data, escposColumnsForPaper(paper))
  await downloadJsPdf(buildCashSessionDetailPdf(lines, paper), filename(data))
}
