import type { PrintData } from '@/types/printData'

export type PrinterPaperWidth = 58 | 80
export type PrinterKind = 'comandas' | 'precuenta' | 'documentos'

/** Impresora instalada en Windows (RAW) o impresora térmica en red (TCP, típ. puerto 9100). */
export type PrinterConnectionMode = 'windows' | 'network'

export type PrinterConfig = {
  connection: PrinterConnectionMode
  printerName: string
  tcpHost: string
  tcpPort: number
  paperWidthMm: PrinterPaperWidth
  autoPrint: boolean
}

export type StoredPrinterSettings = {
  comandas: PrinterConfig
  precuenta: PrinterConfig
  documentos: PrinterConfig
}

export const PRINTER_SETTINGS_STORAGE_KEY = 'tukichef_kitchen_printer_settings_v2'
const PRINTER_SETTINGS_STORAGE_KEY_V1 = 'tukichef_kitchen_printer_settings_v1'
const LEGACY_PRINTER_KEY_V2 = 'bendey_kitchen_printer_settings_v2'
const LEGACY_PRINTER_KEY_V1 = 'bendey_kitchen_printer_settings_v1'

const DEFAULT_TCP_PORT = 9100

function clampPort(n: unknown): number {
  const p = Math.floor(Number(n))
  if (!Number.isFinite(p) || p < 1) return DEFAULT_TCP_PORT
  if (p > 65535) return 65535
  return p
}

function normalizeSlot(raw: Partial<PrinterConfig> | undefined): PrinterConfig {
  const conn = raw?.connection === 'network' ? 'network' : 'windows'
  return {
    connection: conn,
    printerName: String(raw?.printerName ?? '').trim(),
    tcpHost: String(raw?.tcpHost ?? '').trim(),
    tcpPort: clampPort(raw?.tcpPort ?? DEFAULT_TCP_PORT),
    paperWidthMm: raw?.paperWidthMm === 58 ? 58 : 80,
    autoPrint: raw?.autoPrint !== false,
  }
}

export function emptyPrinterSettings(): StoredPrinterSettings {
  const slot = (): PrinterConfig => ({
    connection: 'windows',
    printerName: '',
    tcpHost: '',
    tcpPort: DEFAULT_TCP_PORT,
    paperWidthMm: 80,
    autoPrint: true,
  })
  return {
    comandas: slot(),
    precuenta: slot(),
    documentos: slot(),
  }
}

export function loadStoredPrinterSettings(): StoredPrinterSettings {
  if (typeof window === 'undefined') return emptyPrinterSettings()
  try {
    let raw =
      localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY) ??
      localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY_V1) ??
      localStorage.getItem(LEGACY_PRINTER_KEY_V2) ??
      localStorage.getItem(LEGACY_PRINTER_KEY_V1)
    if (!raw) return emptyPrinterSettings()
    const parsed = JSON.parse(raw) as Partial<StoredPrinterSettings>
    return {
      comandas: normalizeSlot(parsed.comandas),
      precuenta: normalizeSlot(parsed.precuenta),
      documentos: normalizeSlot(parsed.documentos),
    }
  } catch {
    return emptyPrinterSettings()
  }
}

export function saveStoredPrinterSettings(v: StoredPrinterSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PRINTER_SETTINGS_STORAGE_KEY, JSON.stringify(v))
  } catch {
  }
}

/** Configuración lista para imprimir (null = falta completar datos según el modo). */
export function getConfiguredPrinter(kind: PrinterKind): PrinterConfig | null {
  const cfg = loadStoredPrinterSettings()[kind]
  if (cfg.connection === 'network') {
    if (!cfg.tcpHost?.trim()) return null
    return {
      connection: 'network',
      printerName: '',
      tcpHost: cfg.tcpHost.trim(),
      tcpPort: clampPort(cfg.tcpPort),
      paperWidthMm: cfg.paperWidthMm === 58 ? 58 : 80,
      autoPrint: Boolean(cfg.autoPrint),
    }
  }
  if (!cfg.printerName?.trim()) return null
  return {
    connection: 'windows',
    printerName: cfg.printerName.trim(),
    tcpHost: '',
    tcpPort: DEFAULT_TCP_PORT,
    paperWidthMm: cfg.paperWidthMm === 58 ? 58 : 80,
    autoPrint: Boolean(cfg.autoPrint),
  }
}

export function isAutoPrintEnabled(kind: PrinterKind): boolean {
  const cfg = loadStoredPrinterSettings()[kind]
  return Boolean(cfg.autoPrint)
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__)
}

export function isWindowsDesktop(): boolean {
  if (!isTauri()) return false
  return true
}

export async function listInstalledPrinters(): Promise<string[]> {
  if (!isTauri()) return []
  const { invoke } = await import('@tauri-apps/api/core')
  const printers = await invoke<string[]>('list_printers')
  return Array.isArray(printers) ? printers : []
}

export async function testPrint(input: {
  kind: PrinterKind
  connection: PrinterConnectionMode
  printerName?: string
  tcpHost?: string
  tcpPort?: number
  paperWidthMm: PrinterPaperWidth
}): Promise<string> {
  if (!isTauri()) return 'No disponible en navegador'
  const { invoke } = await import('@tauri-apps/api/core')
  const out = await invoke<string>('printers_test_print', {
    input: {
      mode: input.connection,
      printer_name: input.printerName ?? '',
      tcp_host: input.tcpHost ?? '',
      tcp_port: clampPort(input.tcpPort ?? DEFAULT_TCP_PORT),
      paper_width_mm: input.paperWidthMm,
      kind: input.kind,
    },
  })
  return typeof out === 'string' ? out : 'OK'
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export async function printRawEscPos(input: {
  connection: PrinterConnectionMode
  printerName?: string
  tcpHost?: string
  tcpPort?: number
  data: Uint8Array
  docName?: string
}): Promise<string> {
  if (!isTauri()) return 'No disponible en navegador'
  const { invoke } = await import('@tauri-apps/api/core')
  const dataBase64 = uint8ToBase64(input.data)
  const port = clampPort(input.tcpPort ?? DEFAULT_TCP_PORT)
  console.log('[printRawEscPos] invoke printers_print_raw', {
    connection: input.connection,
    printerName: input.printerName,
    tcpHost: input.tcpHost,
    tcpPort: port,
    bytes: input.data.length,
    docName: input.docName ?? null,
  })
  try {
    const out = await invoke<string>('printers_print_raw', {
      input: {
        mode: input.connection,
        printer_name: input.printerName ?? '',
        tcp_host: input.tcpHost ?? '',
        tcp_port: port,
        data_base64: dataBase64,
        doc_name: input.docName ?? null,
      },
    })
    console.log('[printRawEscPos] result', out)
    return typeof out === 'string' ? out : 'OK'
  } catch (e) {
    console.error('[printRawEscPos] error', e)
    throw e
  }
}

function columnsForWidth(width: PrinterPaperWidth): number {
  return width === 58 ? 32 : 42
}

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function wrapText(s: string, width: number): string[] {
  const clean = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return ['']
  const words = clean.split(' ')
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= width) {
      line = next
      continue
    }
    if (line) out.push(line)
    if (w.length > width) {
      for (let i = 0; i < w.length; i += width) out.push(w.slice(i, i + width))
      line = ''
    } else {
      line = w
    }
  }
  if (line) out.push(line)
  return out
}

function escposInit(): number[] {
  return [0x1b, 0x40]
}

function escposCutPartial(): number[] {
  return [0x1d, 0x56, 0x41, 0x10]
}

function escposAlign(align: 'left' | 'center' | 'right'): number[] {
  const n = align === 'left' ? 0 : align === 'center' ? 1 : 2
  return [0x1b, 0x61, n]
}

function escposBold(on: boolean): number[] {
  return [0x1b, 0x45, on ? 1 : 0]
}

function escposSize(widthMul: number, heightMul: number): number[] {
  const w = Math.min(8, Math.max(1, Math.floor(widthMul)))
  const h = Math.min(8, Math.max(1, Math.floor(heightMul)))
  const n = ((w - 1) << 4) | (h - 1)
  return [0x1d, 0x21, n]
}

function escposQr(data: string, opts?: { moduleSize?: number; ecc?: 'L' | 'M' | 'Q' | 'H' }): number[] {
  const moduleSize = Math.min(16, Math.max(1, Math.floor(opts?.moduleSize ?? 8)))
  const ecc = opts?.ecc ?? 'M'
  const eccByte = ecc === 'L' ? 0x30 : ecc === 'M' ? 0x31 : ecc === 'Q' ? 0x32 : 0x33
  const bytes = textBytes(data)
  const storeLen = bytes.length + 3
  const pL = storeLen & 0xff
  const pH = (storeLen >> 8) & 0xff
  const out: number[] = []
  out.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
  out.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize)
  out.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, eccByte)
  out.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30)
  out.push(...Array.from(bytes))
  out.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
  return out
}

export function buildComandaEscPos(input: {
  tableName?: string | null
  orderNumber?: number | null
  waiterName?: string | null
  items: { productName: string; quantity: number; notes?: string | null }[]
  paperWidthMm: PrinterPaperWidth
}): Uint8Array {
  const cols = columnsForWidth(input.paperWidthMm)
  const bigCols = Math.max(12, Math.floor(cols / 2))

  const out: number[] = []
  out.push(...escposInit())

  out.push(...escposAlign('center'))
  out.push(...escposBold(true))
  out.push(...escposSize(2, 2))
  out.push(...Array.from(textBytes(`COMANDA\n`)))
  out.push(...escposBold(false))
  out.push(...escposSize(1, 1))

  out.push(...escposAlign('left'))
  out.push(...Array.from(textBytes(`${'-'.repeat(cols)}\n`)))

  out.push(...escposBold(true))
  out.push(...escposSize(2, 2))
  if (input.tableName) out.push(...Array.from(textBytes(`${wrapText(`MESA: ${input.tableName}`, bigCols).join('\n')}\n`)))
  if (input.orderNumber != null) out.push(...Array.from(textBytes(`PEDIDO: #${input.orderNumber}\n`)))
  if (input.waiterName) out.push(...Array.from(textBytes(`${wrapText(`MOZO: ${input.waiterName}`, bigCols).join('\n')}\n`)))
  out.push(...escposBold(false))
  out.push(...escposSize(1, 1))
  out.push(...Array.from(textBytes(`${'-'.repeat(cols)}\n`)))

  for (const it of input.items) {
    const qty = String(it.quantity ?? 0).replace(/\.0+$/, '')
    const head = `${qty}x `
    const wrapped = wrapText(String(it.productName ?? '').trim(), Math.max(6, bigCols - head.length))

    out.push(...escposBold(true))
    out.push(...escposSize(2, 2))
    out.push(...Array.from(textBytes(`${head}${wrapped[0] ?? ''}\n`)))
    for (const w of wrapped.slice(1)) out.push(...Array.from(textBytes(`${' '.repeat(head.length)}${w}\n`)))
    out.push(...escposBold(false))
    out.push(...escposSize(1, 1))

    const note = String(it.notes ?? '').trim()
    if (note) {
      for (const w of wrapText(note, cols - 4)) out.push(...Array.from(textBytes(`  * ${w}\n`)))
    }
    out.push(...Array.from(textBytes(`\n`)))
  }

  out.push(...Array.from(textBytes(`${'-'.repeat(cols)}\n\n\n`)))
  out.push(...escposCutPartial())
  return new Uint8Array(out)
}

export function buildPrecuentaEscPos(input: {
  tableName?: string | null
  items: { productName: string; quantity: number; unitPrice: number }[]
  total: number
  paperWidthMm: PrinterPaperWidth
}): Uint8Array {
  const cols = columnsForWidth(input.paperWidthMm)
  const out: number[] = []
  out.push(...escposInit())
  out.push(...escposAlign('center'))
  out.push(...escposBold(true))
  out.push(...escposSize(2, 2))
  out.push(...Array.from(textBytes(`PRECUENTA\n`)))
  out.push(...escposBold(false))
  out.push(...escposSize(1, 1))

  out.push(...escposAlign('left'))
  if (input.tableName) out.push(...Array.from(textBytes(`${wrapText(`Mesa: ${input.tableName}`, cols).join('\n')}\n`)))
  out.push(...Array.from(textBytes(`${'-'.repeat(cols)}\n`)))

  for (const it of input.items) {
    const qty = String(it.quantity ?? 0).replace(/\.0+$/, '')
    const subtotal = (Number(it.quantity) * Number(it.unitPrice)).toFixed(2)
    const right = `S/ ${subtotal}`
    const leftCols = cols - right.length - 1
    const descWrapped = wrapText(String(it.productName ?? '').trim(), Math.max(8, leftCols - (qty.length + 2)))
    const firstLeft = `${qty}x ${descWrapped[0] ?? ''}`.padEnd(leftCols)
    out.push(...Array.from(textBytes(`${firstLeft} ${right}\n`)))
    for (const w of descWrapped.slice(1)) out.push(...Array.from(textBytes(`   ${w}\n`)))
  }

  out.push(...Array.from(textBytes(`${'-'.repeat(cols)}\n`)))
  out.push(...escposBold(true))
  out.push(...escposSize(2, 2))
  const totalStr = `S/ ${Number(input.total).toFixed(2)}`
  const bigCols = Math.max(12, Math.floor(cols / 2))
  const totalLine = `TOTAL ${totalStr}`
  for (const l of wrapText(totalLine, bigCols)) out.push(...Array.from(textBytes(`${l}\n`)))
  out.push(...escposBold(false))
  out.push(...escposSize(1, 1))
  out.push(...Array.from(textBytes(`\n\n`)))
  out.push(...escposCutPartial())
  return new Uint8Array(out)
}

export function buildSaleDocumentEscPos(printData: PrintData, paperWidthMm: PrinterPaperWidth): Uint8Array {
  const cols = columnsForWidth(paperWidthMm)
  const lines: string[] = []
  const docType = String(printData.doc_type ?? '').toLowerCase()
  const title =
    docType === 'boleta' ? 'BOLETA DE VENTA' : docType === 'factura' ? 'FACTURA' : 'NOTA DE VENTA'

  const currency = String(printData.currency ?? 'PEN').toUpperCase()
  const moneySymbol = currency === 'USD' ? '$' : 'S/'
  const money = (n: number) => `${moneySymbol} ${Number(n ?? 0).toFixed(2)}`

  const companyName = printData.company?.business_name || 'Empresa'
  const companyLines = wrapText(companyName, cols)
  const ruc = printData.company?.ruc || ''
  const addr = printData.branch?.address || printData.company?.address || ''
  const branchName = printData.branch?.name || ''

  for (const x of companyLines.slice(1)) lines.push(x)
  if (ruc) lines.push(`RUC ${ruc}`)
  if (addr) wrapText(addr, cols).forEach((x) => lines.push(x))
  if (branchName) wrapText(branchName, cols).forEach((x) => lines.push(x))

  lines.push('-'.repeat(cols))
  lines.push(title)
  lines.push(`NRO: ${printData.number}`)
  lines.push(`FECHA: ${printData.issue_date}`)
  if (printData.sunat_code) lines.push(`COD SUNAT: ${printData.sunat_code}`)
  lines.push('-'.repeat(cols))

  if (printData.client) {
    const cliente = printData.client.business_name || 'Cliente'
    const doc = printData.client.doc_number || ''
    const docTypeLabel = String(printData.client.doc_type ?? '').trim()
    wrapText(`CLIENTE: ${cliente}`, cols).forEach((x) => lines.push(x))
    if (doc) lines.push(`DOC (${docTypeLabel || '-' }): ${doc}`)
    if (printData.client.address) wrapText(`DIR: ${printData.client.address}`, cols).forEach((x) => lines.push(x))
    lines.push('-'.repeat(cols))
  }

  lines.push('DETALLE')
  lines.push('-'.repeat(cols))

  for (const it of printData.items ?? []) {
    const qty = String(it.quantity ?? 0).replace(/\.0+$/, '')
    const pu = money(it.unit_price ?? 0)
    const lineTotal = money(it.total ?? 0)
    wrapText(String(it.description ?? '').trim(), cols).forEach((x) => lines.push(x))
    lines.push(`${qty} x ${pu}`.padEnd(cols - lineTotal.length - 1) + ` ${lineTotal}`)
    if (it.discount && Number(it.discount) > 0) {
      const disc = money(it.discount)
      lines.push(`DSCTO`.padEnd(cols - disc.length - 1) + ` ${disc}`)
    }
  }

  lines.push('-'.repeat(cols))

  const totals = printData.totals_by_affectation ?? {}
  const gravado = totals['10']?.subtotal ?? 0
  const exonerado = totals['20']?.subtotal ?? 0
  const inafecto = totals['30']?.subtotal ?? 0
  const exportacion = totals['40']?.subtotal ?? 0

  if (gravado > 0) lines.push(`OP GRAVADA`.padEnd(cols - money(gravado).length - 1) + ` ${money(gravado)}`)
  if (exonerado > 0) lines.push(`OP EXONERADA`.padEnd(cols - money(exonerado).length - 1) + ` ${money(exonerado)}`)
  if (inafecto > 0) lines.push(`OP INAFECTA`.padEnd(cols - money(inafecto).length - 1) + ` ${money(inafecto)}`)
  if (exportacion > 0) lines.push(`OP EXPORTACION`.padEnd(cols - money(exportacion).length - 1) + ` ${money(exportacion)}`)

  lines.push(`IGV`.padEnd(cols - money(printData.tax_amount ?? 0).length - 1) + ` ${money(printData.tax_amount ?? 0)}`)
  lines.push(`TOTAL`.padEnd(cols - money(printData.total ?? 0).length - 1) + ` ${money(printData.total ?? 0)}`)

  if (Array.isArray(printData.payments) && printData.payments.length > 0) {
    lines.push('-'.repeat(cols))
    lines.push('PAGOS')
    for (const p of printData.payments) {
      const amount = money(p.amount ?? 0)
      const label = String(p.method ?? '').toUpperCase() || 'PAGO'
      lines.push(label.padEnd(cols - amount.length - 1) + ` ${amount}`)
    }
  }

  if (printData.legend_text) {
    lines.push('-'.repeat(cols))
    wrapText(printData.legend_text, cols).forEach((x) => lines.push(x))
  }

  if (printData.sunat_hash) {
    lines.push('-'.repeat(cols))
    wrapText(`HASH: ${printData.sunat_hash}`, cols).forEach((x) => lines.push(x))
  }

  lines.push('')
  const shouldQr = docType === 'boleta' || docType === 'factura'
  const out: number[] = []
  out.push(...escposInit())
  out.push(...escposAlign('center'))
  out.push(...escposBold(true))
  out.push(...Array.from(textBytes(`${companyLines[0] ?? companyName}\n`)))
  out.push(...escposBold(false))
  for (const l of lines) out.push(...Array.from(textBytes(`${l}\n`)))
  if (shouldQr && printData.qr_data) {
    out.push(...escposAlign('center'))
    out.push(...Array.from(textBytes(`\n`)))
    out.push(...escposQr(printData.qr_data, {
      moduleSize: paperWidthMm === 58 ? 6 : 8,
      ecc: 'M',
    }))
    out.push(...Array.from(textBytes(`\n`)))
  }
  out.push(...escposAlign('left'))
  out.push(...Array.from(textBytes(`\n\n`)))
  out.push(...escposCutPartial())
  return new Uint8Array(out)
}

export async function printComandaAuto(input: {
  tableName?: string | null
  orderNumber?: number | null
  waiterName?: string | null
  items: { productName: string; quantity: number; notes?: string | null }[]
}): Promise<string> {
  const cfg = getConfiguredPrinter('comandas')
  if (!cfg) return 'Impresora de comandas no configurada'
  const data = buildComandaEscPos({ ...input, paperWidthMm: cfg.paperWidthMm })
  return printRawEscPos({
    connection: cfg.connection,
    printerName: cfg.printerName,
    tcpHost: cfg.tcpHost,
    tcpPort: cfg.tcpPort,
    data,
    docName: 'Tukichef - Comanda',
  })
}

export async function printPrecuentaAuto(input: {
  tableName?: string | null
  items: { productName: string; quantity: number; unitPrice: number }[]
  total: number
}): Promise<string> {
  const cfg = getConfiguredPrinter('precuenta')
  if (!cfg) return 'Impresora de precuenta no configurada'
  const data = buildPrecuentaEscPos({ ...input, paperWidthMm: cfg.paperWidthMm })
  return printRawEscPos({
    connection: cfg.connection,
    printerName: cfg.printerName,
    tcpHost: cfg.tcpHost,
    tcpPort: cfg.tcpPort,
    data,
    docName: 'Tukichef - Precuenta',
  })
}

export async function printDocumentAuto(printData: PrintData): Promise<string> {
  const cfg = getConfiguredPrinter('documentos')
  if (!cfg) return 'Impresora de documentos no configurada'
  const data = buildSaleDocumentEscPos(printData, cfg.paperWidthMm)
  return printRawEscPos({
    connection: cfg.connection,
    printerName: cfg.printerName,
    tcpHost: cfg.tcpHost,
    tcpPort: cfg.tcpPort,
    data,
    docName: 'Tukichef - Documento',
  })
}
