import { jsPDF } from 'jspdf'
import { sumAffectationByGroup } from '@/constants/igvAffectation'
import type { PrintData } from '@/types/printData'
import { downloadBlob } from '@/utils/downloadBlob'
import {
  receiptItemDisplayDescription,
  receiptItemDisplayTotal,
  receiptItemDisplayUnitPrice,
} from '@/utils/receiptBonificacion'
import { getTipoComprobanteLabel, isElectronicSunatCode } from '@/constants/sunat'
import { formatMoney } from '@/utils/format'
import { getCreditNoteReference } from '@/utils/receiptCreditNoteRef'
import { ticketDetailLayout4Col } from '@/utils/receiptTicketLayout'
import { renderA4ReceiptPdf } from '@/utils/receiptPdfA4'
import { normalizeTextForTicketPrint } from '@/utils/normalizeTextForTicketPrint'
import { getPrintIssuerAddress } from '@/utils/printIssuer'
import { trimCompanyAdditionalNotes } from '@/utils/receiptCompanyNotes'
import { paymentWalletVisible, renderPaymentWalletBlock } from '@/utils/receiptPaymentWallet'
import { renderTicketPaymentAndSunatQrRow } from '@/utils/receiptTicketFooter'
import {
  fitReceiptLogoMm,
  resolveReceiptLogoForPdf,
} from '@/utils/receiptLogoPdf'
import { hasReceiptDiscount, receiptTotalDiscount } from '@/utils/receiptDiscount'
import {
  normalizeTicketPaperWidth,
  ticketMarginMm,
  ticketPageWidthMm,
  type TicketPaperWidthMm,
} from '@/utils/receiptTicketPaper'

const FONT_SIZE = 10
const FONT_SIZE_COMMERCIAL = 12
const FONT_SIZE_SM = 8
const FONT_SIZE_TITLE = 12
const MARGIN = 15
const TICKET_PAGE_HEIGHT = 520
const A4_WIDTH = 210
/** Espacio extra arriba del ticket PDF (correo / descarga / vista previa). */
const TICKET_TOP_PADDING_MM = 5

export type ReceiptPdfOptions = {
  /** Ancho de rollo (58 o 80 mm). Por defecto 80. */
  paperWidthMm?: TicketPaperWidthMm
}

function docClientLabel(docType: string): string {
  const t = String(docType ?? '').trim()
  if (t === '6') return 'RUC'
  if (t === '1') return 'DNI'
  if (t === '0') return 'Doc.'
  return t || 'Doc.'
}

function emitAffectTotals(
  doc: jsPDF,
  data: PrintData,
  yRef: { y: number },
  margin: number,
  pageW: number,
  lineH: number,
  emitRow: (label: string, amount: string, bold?: boolean) => void,
) {
  const aff = data.totals_by_affectation || {}
  const bonif = aff['15']
  const gravadoAll = sumAffectationByGroup(aff, 'gravado')
  const gravado =
    bonif && gravadoAll
      ? {
          ...gravadoAll,
          subtotal: Math.max(0, (gravadoAll.subtotal ?? 0) - (bonif.subtotal ?? 0)),
        }
      : gravadoAll
  const exonerado = sumAffectationByGroup(aff, 'exonerado')
  const inafecto = sumAffectationByGroup(aff, 'inafecto')
  const exportacion = sumAffectationByGroup(aff, 'exportacion')
  // Nuevo RUS: la boleta no discrimina valor de venta / IGV en el impreso (solo total).
  const hideBreakdown = data.company?.show_igv_breakdown === false
  if (!hideBreakdown) {
    if (gravado && gravado.subtotal > 0.000001) {
      emitRow('Op. Gravadas:', formatMoney(gravado.subtotal, data.currency))
    }
    if (exonerado && exonerado.subtotal > 0.000001) {
      emitRow('Op. Exoneradas:', formatMoney(exonerado.subtotal, data.currency))
    }
    if (inafecto && inafecto.subtotal > 0.000001) {
      emitRow('Op. Inafectas:', formatMoney(inafecto.subtotal, data.currency))
    }
    if (exportacion && exportacion.subtotal > 0.000001) {
      emitRow('Op. Exportación:', formatMoney(exportacion.subtotal, data.currency))
    }
    if (bonif && bonif.subtotal > 0.000001) {
      emitRow('Bonif. (ref.):', formatMoney(bonif.subtotal, data.currency))
    }
    if (hasReceiptDiscount(data)) {
      emitRow('Descuento:', `- ${formatMoney(receiptTotalDiscount(data), data.currency)}`)
    }
    if (data.tax_amount > 0.000001) {
      emitRow('IGV:', formatMoney(data.tax_amount, data.currency))
    }
  }
  emitRow('TOTAL A PAGAR:', formatMoney(data.total, data.currency), true)
  void doc
  void margin
  void pageW
  void lineH
  void yRef
}

export async function generateReceiptPdf(
  data: PrintData,
  format: 'a4' | 'ticket' = 'a4',
  options?: ReceiptPdfOptions,
): Promise<jsPDF> {
  const isTicket = format === 'ticket'
  const paperMm = normalizeTicketPaperWidth(options?.paperWidthMm)
  const pageW = isTicket ? ticketPageWidthMm(paperMm) : A4_WIDTH
  const margin = isTicket ? ticketMarginMm(paperMm) : MARGIN
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isTicket ? [pageW, TICKET_PAGE_HEIGHT] : 'a4',
  })

  let y = margin + (isTicket ? TICKET_TOP_PADDING_MM : 0)
  const lineH = 5
  const innerW = pageW - 2 * margin
  const showQr = isElectronicSunatCode(data.sunat_code) && Boolean(data.qr_data)

  const ticketText = (text: string) => (isTicket ? normalizeTextForTicketPrint(text) : text)

  const addWrapped = (
    text: string,
    size = FONT_SIZE_SM,
    align: 'left' | 'center' | 'right' = 'left',
    bold = false,
  ) => {
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(ticketText(text), innerW) as string[]
    for (const line of lines) {
      if (align === 'center') doc.text(line, pageW / 2, y, { align: 'center' })
      else if (align === 'right') doc.text(line, pageW - margin, y, { align: 'right', maxWidth: innerW })
      else doc.text(line, margin, y)
      y += isTicket ? 4.2 : lineH
    }
  }

  const addLabeledField = (label: string, value: string, size = FONT_SIZE_SM) => {
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    const labelText = ticketText(label.endsWith(' ') ? label : `${label} `)
    const valueText = ticketText(String(value ?? '').trim() || '—')
    const labelW = doc.getTextWidth(labelText)
    const firstLineMaxW = Math.max(10, innerW - labelW)
    const valueLines = doc.splitTextToSize(valueText, firstLineMaxW) as string[]
    const step = isTicket ? 4.2 : lineH
    if (valueLines.length === 0) {
      doc.text(labelText, margin, y)
      y += step
      return
    }
    doc.text(labelText, margin, y)
    doc.text(valueLines[0], margin + labelW, y)
    y += step
    for (let i = 1; i < valueLines.length; i++) {
      doc.text(valueLines[i], margin, y)
      y += step
    }
  }

  const addCompanyContactLines = () => {
    const align = isTicket ? 'center' : 'left'
    if (data.company.phone) addWrapped(`Telf: ${data.company.phone}`, FONT_SIZE_SM, align)
    if (data.company.email) addWrapped(`Email: ${data.company.email}`, FONT_SIZE_SM, align)
    if (isTicket) {
      const extra = trimCompanyAdditionalNotes(data.company.additional_notes)
      if (extra) {
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(FONT_SIZE_SM)
        const lines = doc.splitTextToSize(ticketText(extra), innerW) as string[]
        for (const line of lines) {
          doc.text(line, margin, y)
          y += 4.2
        }
      }
    }
    if (data.company.website) addWrapped(`Web: ${data.company.website}`, FONT_SIZE_SM, align)
  }

  const addBankAccounts = () => {
    const banks = data.bank_accounts ?? []
    if (banks.length === 0) return
    addWrapped('INFORMACIÓN BANCARIA', FONT_SIZE_SM)
    for (const b of banks) {
      const label = [b.bank_name, b.name].filter(Boolean).join(' - ')
      if (label) addWrapped(label)
      if (b.account_number) addWrapped(`Cta: ${b.account_number} (${b.currency || data.currency})`)
    }
  }

  const addFooter = () => {
    y += isTicket ? 12 : 8
    if (data.seller_name && !isTicket) addWrapped(`Vendedor: ${data.seller_name}`, FONT_SIZE_SM, 'left')
    addWrapped('Tukichef - Sistema POS', FONT_SIZE_SM, 'center')
    if (showQr && !isTicket) {
      addWrapped('Representación impresa del comprobante electrónico', FONT_SIZE_SM, 'center')
      addWrapped('Consulte en sunat.gob.pe', FONT_SIZE_SM, 'center')
    }
  }

  if (isTicket) {
    const ticketLineH = 4.2
    /** Mismo tono legible que cabecera/fecha (Helvetica 8pt); Courier pequeño se ve opaco al imprimir. */
    const ticketDetailFontPt = FONT_SIZE_SM
    const lay = ticketDetailLayout4Col({ pageW, margin })
    const descHeader = pageW <= 62 ? 'Desc.' : 'Descripción'

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    const setTicketDetailFont = (bold = false) => {
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(ticketDetailFontPt)
    }

    if (data.company.logo_url) {
      const logoAsset = await resolveReceiptLogoForPdf(data.company.logo_url)
      if (logoAsset) {
        const maxLogoW = Math.min(32, innerW)
        const maxLogoH = 14
        const size = fitReceiptLogoMm(logoAsset.naturalW, logoAsset.naturalH, maxLogoW, maxLogoH)
        doc.addImage(
          logoAsset.dataUrl,
          logoAsset.format,
          (pageW - size.w) / 2,
          y,
          size.w,
          size.h,
        )
        y += size.h + 3
      }
    }

    const tradeName = String(data.company.trade_name ?? '').trim()
    const businessName = String(data.company.business_name ?? '').trim()
    const showBusinessName =
      Boolean(businessName) &&
      businessName.localeCompare(tradeName, undefined, { sensitivity: 'accent' }) !== 0
    if (tradeName) {
      addWrapped(tradeName, FONT_SIZE_COMMERCIAL, 'center', true)
      if (showBusinessName) addWrapped(businessName, FONT_SIZE, 'center')
    } else if (businessName) {
      addWrapped(businessName, FONT_SIZE_TITLE, 'center')
    }
    addWrapped(`RUC: ${data.company.ruc}`, FONT_SIZE_SM, 'center')
    const issuerAddress = getPrintIssuerAddress(data)
    if (issuerAddress) addWrapped(issuerAddress, FONT_SIZE_SM, 'center')
    addCompanyContactLines()
    y += 2

    addWrapped(getTipoComprobanteLabel(data.sunat_code, data.doc_type), FONT_SIZE, 'center')
    addWrapped(data.number, FONT_SIZE_TITLE, 'center')
    y += 2

    addWrapped(`Fecha Emisión: ${data.issue_date}`)
    if (data.issue_time) addWrapped(`Hora Emisión: ${data.issue_time}`)
    if (data.client) {
      addLabeledField('Cliente:', data.client.business_name)
      addLabeledField(`${docClientLabel(data.client.doc_type)}:`, data.client.doc_number)
      if (data.client.address) addLabeledField('Dirección:', data.client.address)
    }
    const creditNoteRef = getCreditNoteReference(data)
    if (creditNoteRef) {
      addLabeledField('Tipo Doc. Ref.:', creditNoteRef.docTypeLabel)
      addLabeledField('Documento Ref.:', creditNoteRef.docNumber)
      if (creditNoteRef.reason) addLabeledField('Motivo de emisión:', creditNoteRef.reason)
    }
    y += 2

    const dash = () => {
      setTicketDetailFont(false)
      const d = (doc.splitTextToSize('-'.repeat(200), lay.innerW)[0] as string) ?? '-'
      doc.text(d, margin, y)
      y += ticketLineH
    }

    const emitAmountRow = (label: string, amount: string, bold = false) => {
      setTicketDetailFont(bold)
      const line = normalizeTextForTicketPrint(`${label} ${amount}`.trim())
      doc.text(line, pageW - margin, y, { align: 'right', maxWidth: innerW })
      y += ticketLineH
    }

    dash()
    setTicketDetailFont(true)
    doc.text('Cant.', lay.xCant, y, { maxWidth: lay.wCant })
    doc.text(descHeader, lay.xDesc, y, { maxWidth: lay.wDescFirst })
    doc.text('P.U.', lay.xEndPUnit, y, { align: 'right', maxWidth: lay.wMoney })
    doc.text('Importe', lay.xEndImporte, y, { align: 'right', maxWidth: lay.wMoney })
    y += ticketLineH
    dash()

    for (const it of data.items) {
      const desc = ticketText(receiptItemDisplayDescription(it))
      const pu = receiptItemDisplayUnitPrice(it, (n) => formatMoney(n, data.currency))
      const imp = receiptItemDisplayTotal(it, (n) => formatMoney(n, data.currency))
      const descLines = doc.splitTextToSize(desc, lay.wDescFirst) as string[]

      setTicketDetailFont(false)
      doc.text(String(it.quantity), lay.xCant, y, { maxWidth: lay.wCant })
      doc.text(descLines[0] ?? '—', lay.xDesc, y, { maxWidth: lay.wDescFirst })
      doc.text(pu, lay.xEndPUnit, y, { align: 'right', maxWidth: lay.wMoney })
      doc.text(imp, lay.xEndImporte, y, { align: 'right', maxWidth: lay.wMoney })
      y += ticketLineH
      for (let i = 1; i < descLines.length; i++) {
        setTicketDetailFont(false)
        doc.text(descLines[i], lay.xDesc, y, { maxWidth: lay.wDescCont })
        y += ticketLineH
      }
      y += 0.5
    }

    dash()
    emitAffectTotals(doc, data, { y }, margin, pageW, lineH, emitAmountRow)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    y += ticketLineH

    if (data.legend_text) {
      addWrapped(`Son: ${data.legend_text}`, FONT_SIZE_SM, 'left')
      y += 2
    }

    y = await renderTicketPaymentAndSunatQrRow(doc, data, {
      showSunatQr: showQr,
      y,
      pageW,
      margin,
      innerW,
      lineH: ticketLineH,
      normalize: ticketText,
    })

    addBankAccounts()

    if (paymentWalletVisible(data, 'ticket')) {
      y = await renderPaymentWalletBlock(doc, data, 'ticket', y, pageW, margin)
    }

    if (data.seller_name) {
      addWrapped(`Vendedor: ${data.seller_name}`, FONT_SIZE_SM, 'left')
    }

    addFooter()
    return doc
  }

  await renderA4ReceiptPdf(doc, data, margin)
  return doc
}

export async function printDataToPdfBlob(
  data: PrintData,
  format: 'a4' | 'ticket' = 'a4',
  options?: ReceiptPdfOptions,
): Promise<Blob> {
  const doc = await generateReceiptPdf(data, format, options)
  return doc.output('blob')
}

export function receiptPdfFileName(data: PrintData, format: 'a4' | 'ticket'): string {
  const safe = `${data.series}-${data.number}`.replace(/[^\w.-]+/g, '_')
  return `comprobante-${safe}-${format}.pdf`
}

export async function downloadReceiptPdf(
  data: PrintData,
  format: 'a4' | 'ticket' = 'a4',
  options?: ReceiptPdfOptions,
): Promise<void> {
  const blob = await printDataToPdfBlob(data, format, options)
  await downloadBlob(blob, receiptPdfFileName(data, format))
}

export async function openReceiptPdfInNewTab(
  data: PrintData,
  format: 'a4' | 'ticket' = 'a4',
  options?: ReceiptPdfOptions,
): Promise<void> {
  const blob = await printDataToPdfBlob(data, format, options)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
