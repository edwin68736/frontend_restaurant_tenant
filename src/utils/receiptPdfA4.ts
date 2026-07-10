import type { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { PrintData } from '@/types/printData'
import { getPrintIssuerAddress } from '@/utils/printIssuer'
import { getTipoComprobanteLabel, isElectronicSunatCode } from '@/constants/sunat'
import { getCreditNoteReference } from '@/utils/receiptCreditNoteRef'
import { paymentWalletVisible, renderPaymentWalletBlock } from '@/utils/receiptPaymentWallet'
import { formatMoney } from '@/utils/format'
import { salePaymentMethodLabelEs } from '@/utils/paymentMethodLabels'
import { fitReceiptLogoMm, resolveReceiptLogoForPdf } from '@/utils/receiptLogoPdf'
import { sumAffectationByGroup } from '@/constants/igvAffectation'
import {
  receiptItemDisplayDescription,
  receiptItemDisplayTotal,
  receiptItemDisplayUnitPrice,
} from '@/utils/receiptBonificacion'
import { hasReceiptDiscount, receiptTotalDiscount } from '@/utils/receiptDiscount'

const A4_WIDTH = 210
const A4_HEIGHT = 297
const MARGIN = 8
const BOTTOM_MARGIN = 10
const LINE_H = 4.5
const FONT = 9
const FONT_SM = 7.5
const FONT_LG = 11
const GRAY_FILL: [number, number, number] = [225, 225, 225]
const GREEN_WEB: [number, number, number] = [34, 130, 70]
/** Máximo del logo en columna izquierda (mm); se respeta proporción. */
const LOGO_MAX_MM = 30

function fitLogoMm(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  return fitReceiptLogoMm(naturalW, naturalH, Math.min(maxW, LOGO_MAX_MM), maxH)
}

type A4Col = { header: string; w: number; align: 'left' | 'center' | 'right' }

function paymentLabel(method: string): string {
  return salePaymentMethodLabelEs(method)
}

function a4ClientDocLabel(docType: string): string {
  const t = String(docType ?? '').trim()
  if (t === '6') return 'RUC'
  if (t === '1') return 'DNI'
  if (t === '0') return 'Doc.trib.no.dom.sin.ruc'
  if (t === '4') return 'Carnet de extranjería'
  if (t === '7') return 'Pasaporte'
  return 'Documento'
}

function setDash(doc: jsPDF, on: boolean) {
  if (on && typeof (doc as jsPDF & { setLineDashPattern?: (a: number[], b: number) => void }).setLineDashPattern === 'function') {
    doc.setLineDashPattern([1.2, 1.2], 0)
  } else if (typeof (doc as jsPDF & { setLineDashPattern?: (a: number[], b: number) => void }).setLineDashPattern === 'function') {
    doc.setLineDashPattern([], 0)
  }
}

function drawDashedRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(90, 90, 90)
  doc.setLineWidth(0.25)
  setDash(doc, true)
  doc.rect(x, y, w, h)
  setDash(doc, false)
}

function fillGrayRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...GRAY_FILL)
  doc.rect(x, y, w, h, 'F')
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)
}

function fieldRow(doc: jsPDF, y: number, label: string, value: string, x: number, labelW = 48) {
  doc.setFontSize(FONT_SM)
  doc.setFont('helvetica', 'bold')
  doc.text(label, x, y)
  doc.setFont('helvetica', 'normal')
  const val = value?.trim() || '—'
  const valueX = x + labelW
  const valueMaxW = A4_WIDTH - MARGIN - valueX
  const valueLines = doc.splitTextToSize(val, valueMaxW) as string[]
  const lineCount = Math.max(1, valueLines.length)
  for (let i = 0; i < valueLines.length; i++) {
    doc.text(valueLines[i], valueX, y + i * LINE_H)
  }
  return y + lineCount * LINE_H
}

export async function renderA4ReceiptPdf(doc: jsPDF, data: PrintData, startY = MARGIN): Promise<number> {
  let y = startY
  const contentW = A4_WIDTH - 2 * MARGIN
  const col1W = contentW * 0.25
  const col2W = contentW * 0.5
  const col3W = contentW * 0.25
  const col1X = MARGIN
  const col2X = MARGIN + col1W
  const col3X = MARGIN + col1W + col2W
  const headerTopY = y
  const showQr = isElectronicSunatCode(data.sunat_code) && Boolean(data.qr_data)

  const tradeName = String(data.company.trade_name ?? '').trim()
  const businessName = String(data.company.business_name ?? '').trim()
  const centerLines: { text: string; size: number; bold: boolean }[] = []
  if (tradeName) {
    centerLines.push({ text: tradeName.toUpperCase(), size: FONT_LG + 2, bold: true })
    if (businessName) centerLines.push({ text: businessName.toUpperCase(), size: FONT_SM, bold: false })
  } else if (businessName) {
    centerLines.push({ text: businessName.toUpperCase(), size: FONT_LG, bold: true })
  }
  centerLines.push({ text: `RUC ${data.company.ruc}`, size: FONT_SM, bold: false })
  const issuerAddress = getPrintIssuerAddress(data)
  if (issuerAddress) centerLines.push({ text: issuerAddress.toUpperCase(), size: FONT_SM, bold: false })
  if (data.company.phone) centerLines.push({ text: `Central telefónica: ${data.company.phone}`, size: FONT_SM, bold: false })
  if (data.company.email) centerLines.push({ text: `Email: ${data.company.email}`, size: FONT_SM, bold: false })

  const docLabel = getTipoComprobanteLabel(data.sunat_code, data.doc_type).toUpperCase()
  const boxPad = 3

  let cy = headerTopY + 3
  const centerX = col2X + col2W / 2
  for (const line of centerLines) {
    doc.setFontSize(line.size)
    doc.setFont('helvetica', line.bold ? 'bold' : 'normal')
    const wrapped = doc.splitTextToSize(line.text, col2W - 8) as string[]
    for (const wl of wrapped) {
      doc.text(wl, centerX, cy, { align: 'center' })
      cy += LINE_H
    }
  }

  const boxX = col3X + 2
  const boxY = headerTopY + 3
  const boxW = col3W - 4
  const labelFontSize = docLabel.length > 20 ? FONT_SM : FONT_LG
  doc.setFontSize(labelFontSize)
  doc.setFont('helvetica', 'bold')
  const labelLines = doc.splitTextToSize(docLabel, boxW - 6) as string[]
  const labelLineH = labelFontSize >= FONT_LG ? LINE_H + 0.35 : LINE_H + 0.25
  const labelTextH = labelLines.length * labelLineH
  const labelPadV = 1.2
  const labelBlockH = labelTextH + labelPadV * 2
  const rucBlockH = LINE_H + 1
  const numberBlockH = LINE_H + 1
  const gap = 1.2
  const boxH = boxPad + rucBlockH + gap + labelBlockH + gap + numberBlockH + boxPad

  drawDashedRect(doc, boxX, boxY, boxW, boxH)

  doc.setFontSize(FONT_SM)
  doc.setFont('helvetica', 'bold')
  doc.text(`RUC: ${data.company.ruc}`, boxX + boxW / 2, boxY + boxPad + LINE_H * 0.82, { align: 'center' })

  const labelY = boxY + boxPad + rucBlockH + gap
  fillGrayRect(doc, boxX + 1, labelY, boxW - 2, labelBlockH)
  doc.setFontSize(labelFontSize)
  doc.setFont('helvetica', 'bold')
  const labelTextStartY = labelY + labelPadV + (labelBlockH - labelTextH) / 2 + labelLineH * 0.82
  let ly = labelTextStartY
  for (const line of labelLines) {
    doc.text(line, boxX + boxW / 2, ly, { align: 'center', maxWidth: boxW - 4 })
    ly += labelLineH
  }

  doc.setFontSize(FONT_LG)
  doc.setFont('helvetica', 'bold')
  const numberY = labelY + labelBlockH + gap + LINE_H * 0.88
  doc.text(data.number, boxX + boxW / 2, numberY, { align: 'center' })

  const headerBottom = Math.max(cy, boxY + boxH)

  if (data.company.logo_url) {
    const logoAsset = await resolveReceiptLogoForPdf(data.company.logo_url)
    if (logoAsset) {
      const maxLogoH = Math.max(20, headerBottom - headerTopY - 4)
      const size = fitLogoMm(logoAsset.naturalW, logoAsset.naturalH, col1W - 6, maxLogoH)
      const logoX = col1X + (col1W - size.w) / 2
      const logoY = headerTopY + (headerBottom - headerTopY - size.h) / 2
      doc.addImage(logoAsset.dataUrl, logoAsset.format, logoX, logoY, size.w, size.h)
    }
  }

  y = headerBottom + 3

  y = fieldRow(doc, y, 'FECHA DE EMISIÓN:', data.issue_date, MARGIN + 2)
  y = fieldRow(doc, y, 'FECHA DE VENCIMIENTO:', '', MARGIN + 2)
  if (data.client) {
    y = fieldRow(doc, y, 'CLIENTE:', data.client.business_name, MARGIN + 2)
    y = fieldRow(
      doc,
      y,
      `${a4ClientDocLabel(data.client.doc_type)}:`,
      data.client.doc_number,
      MARGIN + 2,
      52,
    )
    if (data.client.address) {
      y = fieldRow(doc, y, 'DIRECCIÓN:', data.client.address, MARGIN + 2)
    }
  }
  const creditNoteRef = getCreditNoteReference(data)
  if (creditNoteRef) {
    y = fieldRow(doc, y, 'TIPO DOC. REF.:', creditNoteRef.docTypeLabel, MARGIN + 2)
    y = fieldRow(doc, y, 'DOCUMENTO REF.:', creditNoteRef.docNumber, MARGIN + 2)
    if (creditNoteRef.reason) {
      y = fieldRow(doc, y, 'MOTIVO DE EMISIÓN:', creditNoteRef.reason, MARGIN + 2)
    }
  }
  y += 2

  const tableX = MARGIN
  const tableW = contentW
  const cols: A4Col[] = [
    { header: 'CANT.', w: 12, align: 'center' },
    { header: 'UNIDAD', w: 14, align: 'center' },
    { header: 'CÓDIGO', w: 18, align: 'center' },
    { header: 'DESCRIPCIÓN', w: 82, align: 'left' },
    { header: 'P.UNIT', w: 20, align: 'right' },
    { header: 'DTO.', w: 16, align: 'right' },
    { header: 'TOTAL', w: 24, align: 'right' },
  ]

  const colXs: number[] = []
  let cx = tableX
  for (const c of cols) {
    colXs.push(cx)
    cx += c.w
  }
  const headerRowH = LINE_H + 3
  const headerTop = y
  fillGrayRect(doc, tableX, headerTop, tableW, headerRowH)
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  for (let i = 1; i < cols.length; i++) {
    doc.line(colXs[i], headerTop, colXs[i], headerTop + headerRowH)
  }
  doc.setFontSize(FONT_SM)
  doc.setFont('helvetica', 'bold')
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]
    const tx = c.align === 'right' ? colXs[i] + c.w - 1 : c.align === 'center' ? colXs[i] + c.w / 2 : colXs[i] + 1
    doc.text(c.header, tx, headerTop + LINE_H, { align: c.align === 'left' ? 'left' : c.align })
  }
  y += headerRowH

  const rowHeights: number[] = []
  const rowCells: string[][] = []

  for (const it of data.items) {
    const descLines = doc.splitTextToSize(receiptItemDisplayDescription(it), cols[3].w - 2) as string[]
    const rh = Math.max(LINE_H + 2, descLines.length * LINE_H + 2)
    rowHeights.push(rh)
    rowCells.push([
      String(it.quantity),
      (it.unit || 'NIU').slice(0, 6),
      (it.code || '').slice(0, 10),
      descLines.join('\n'),
      receiptItemDisplayUnitPrice(it, (n) => formatMoney(n, data.currency)),
      formatMoney(it.discount ?? 0, data.currency),
      receiptItemDisplayTotal(it, (n) => formatMoney(n, data.currency)),
    ])
  }

  for (let r = 0; r < rowCells.length; r++) {
    const rh = rowHeights[r]
    const cells = rowCells[r]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT_SM)

    const descParts = cells[3].split('\n')
    const hasContent = cells.some((c, idx) => idx < 7 && String(c).trim() !== '')
    if (hasContent) {
      doc.text(cells[0], colXs[0] + cols[0].w / 2, y + LINE_H, { align: 'center' })
      doc.text(cells[1], colXs[1] + cols[1].w / 2, y + LINE_H, { align: 'center' })
      doc.text(cells[2], colXs[2] + 1, y + LINE_H)
      let dy = y + LINE_H
      for (const dl of descParts) {
        if (dl.trim()) {
          doc.text(dl, colXs[3] + 1, dy, { maxWidth: cols[3].w - 2 })
          dy += LINE_H
        }
      }
      doc.text(cells[4], colXs[4] + cols[4].w - 1, y + LINE_H, { align: 'right' })
      doc.text(cells[5], colXs[5] + cols[5].w - 1, y + LINE_H, { align: 'right' })
      doc.text(cells[6], colXs[6] + cols[6].w - 1, y + LINE_H, { align: 'right' })
    }
    y += rh
  }

  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.line(tableX, y, tableX + tableW, y)

  y += 4

  const totalsX = A4_WIDTH - MARGIN
  doc.setFontSize(FONT_SM)
  const aff = data.totals_by_affectation || {}
  const bonif = aff['15']
  const gravadoAll = sumAffectationByGroup(aff, 'gravado')
  const gravado =
    bonif && gravadoAll
      ? { ...gravadoAll, subtotal: Math.max(0, (gravadoAll.subtotal ?? 0) - (bonif.subtotal ?? 0)) }
      : gravadoAll
  const exonerado = sumAffectationByGroup(aff, 'exonerado')
  const inafecto = sumAffectationByGroup(aff, 'inafecto')
  const exportacion = sumAffectationByGroup(aff, 'exportacion')
  if (gravado?.subtotal) {
    doc.setFont('helvetica', 'bold')
    doc.text('OP. GRAVADAS:', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(formatMoney(gravado.subtotal, data.currency), totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  if (exonerado?.subtotal) {
    doc.setFont('helvetica', 'bold')
    doc.text('OP. EXONERADAS:', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(formatMoney(exonerado.subtotal, data.currency), totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  if (inafecto?.subtotal) {
    doc.setFont('helvetica', 'bold')
    doc.text('OP. INAFECTAS:', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(formatMoney(inafecto.subtotal, data.currency), totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  if (exportacion?.subtotal) {
    doc.setFont('helvetica', 'bold')
    doc.text('OP. EXPORTACIÓN:', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(formatMoney(exportacion.subtotal, data.currency), totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  if (bonif?.subtotal) {
    doc.setFont('helvetica', 'bold')
    doc.text('BONIF. (REF.):', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(formatMoney(bonif.subtotal, data.currency), totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  if (hasReceiptDiscount(data)) {
    doc.setFont('helvetica', 'bold')
    doc.text('DESCUENTO:', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(`- ${formatMoney(receiptTotalDiscount(data), data.currency)}`, totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  if (data.tax_amount > 0.000001) {
    doc.setFont('helvetica', 'bold')
    doc.text('IGV:', totalsX - 42, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(formatMoney(data.tax_amount, data.currency), totalsX, y, { align: 'right' })
    y += LINE_H + 1
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT)
  doc.text('TOTAL A PAGAR:', totalsX - 42, y, { align: 'right' })
  doc.text(formatMoney(data.total, data.currency), totalsX, y, { align: 'right' })
  y += LINE_H + 4

  if (data.legend_text) {
    doc.setFontSize(FONT_SM)
    doc.setFont('helvetica', 'normal')
    const leg = doc.splitTextToSize(`SON: ${data.legend_text.toUpperCase()}`, contentW * 0.55) as string[]
    for (const ln of leg) {
      doc.text(ln, MARGIN + 2, y)
      y += LINE_H
    }
    y += 2
  }

  const payMethods = data.payments?.length
    ? data.payments.map((p) => paymentLabel(p.method)).join(', ')
    : data.payment_condition || 'Contado'
  doc.setFontSize(FONT_SM)
  doc.setFont('helvetica', 'bold')
  doc.text('MÉTODO DE PAGO:', MARGIN + 2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(payMethods, MARGIN + 32, y)
  y += LINE_H + 4

  const banks = data.bank_accounts ?? []
  if (banks.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_SM)
    doc.text('CUENTAS BANCARIAS:', MARGIN + 2, y)
    y += LINE_H + 2
    doc.setFont('helvetica', 'normal')
    for (const b of banks) {
      const title = [b.bank_name, b.name].filter(Boolean).join(' — ')
      if (title) {
        doc.text(title, MARGIN + 2, y)
        y += LINE_H
      }
      if (b.account_number) {
        doc.text(`Cuenta: ${b.account_number} (${b.currency || data.currency})`, MARGIN + 2, y)
        y += LINE_H
      }
    }
    y += 2
  }

  if (data.seller_name) {
    doc.setFontSize(FONT_SM)
    doc.setFont('helvetica', 'bold')
    doc.text('Vendedor:', MARGIN + 2, y)
    doc.setFont('helvetica', 'normal')
    doc.text(data.seller_name, MARGIN + 22, y)
    y += LINE_H + 4
  }

  if (paymentWalletVisible(data, 'a4')) {
    y = await renderPaymentWalletBlock(doc, data, 'a4', y, A4_WIDTH, MARGIN)
    y += 2
  }

  if (showQr && data.qr_data) {
    try {
      const qrDataUrl = await QRCode.toDataURL(data.qr_data, { width: 120, margin: 1 })
      const qrSize = 32
      doc.addImage(qrDataUrl, 'PNG', (A4_WIDTH - qrSize) / 2, y, qrSize, qrSize)
      y += qrSize + 4
      if (data.sunat_hash) {
        doc.setFontSize(6)
        const hashLines = doc.splitTextToSize(data.sunat_hash, contentW - 20) as string[]
        for (const hl of hashLines) {
          doc.text(hl, A4_WIDTH / 2, y, { align: 'center' })
          y += 2.8
        }
      }
      doc.setFontSize(FONT_SM)
      doc.text('Representación impresa del comprobante electrónico', A4_WIDTH / 2, y, { align: 'center' })
      y += LINE_H
      doc.text('Consulte en sunat.gob.pe', A4_WIDTH / 2, y, { align: 'center' })
      y += LINE_H + 4
    } catch {
      /* ignore */
    }
  }

  const footerBlockH = LINE_H * 4 + 6
  let footerY = A4_HEIGHT - BOTTOM_MARGIN - footerBlockH
  if (y + 2 > footerY) footerY = y + 4

  doc.setFontSize(FONT)
  doc.setFont('helvetica', 'normal')
  doc.text('GRACIAS POR SU PREFERENCIA', A4_WIDTH / 2, footerY, { align: 'center' })
  footerY += LINE_H + 1
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT_LG)
  doc.text('Tukichef!', A4_WIDTH / 2, footerY, { align: 'center' })
  footerY += LINE_H + 1
  const web = data.company.website?.trim() || 'www.tukifac.pe'
  const webLabel = web.startsWith('http') ? web : `www.${web.replace(/^www\./i, '')}`
  doc.setFontSize(FONT_SM)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GREEN_WEB)
  doc.text(`Comprobante emitido a través de ${webLabel}`, A4_WIDTH / 2, footerY, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  footerY += LINE_H + 1
  doc.setFontSize(6)
  doc.text('Sistema POS · Tukichef', A4_WIDTH / 2, footerY, { align: 'center' })

  return footerY
}
