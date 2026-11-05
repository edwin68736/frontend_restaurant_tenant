import type {
  CashSession,
  CashSessionReport,
  ExpenseDetailRow,
  IncomeDetailRow,
  SessionDocKind,
  SessionDocumentRow,
  SessionDocumentsReport,
  SessionProductSoldRow,
} from '@/services/cashbank.service'
import { normalizeTextForTicketPrint } from '@/utils/normalizeTextForTicketPrint'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'

/**
 * Detalle de caja en formato ticket térmico (58/80 mm). Toda la maqueta se resuelve aquí como líneas
 * de texto monoespaciado ya cortadas al ancho de la impresora, para que la MISMA salida sirva a la
 * impresora ESC/POS (nativa) y al PDF/vista de impresión del navegador.
 */

export type TicketLine = {
  text: string
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  /** Doble alto/ancho (solo títulos cortos). */
  big?: boolean
}

/**
 * Secciones OPCIONALES del ticket. El encabezado, el resumen/cuadre de caja física y las ventas por
 * método de pago son la base y siempre se imprimen.
 */
export type CashDetailSections = {
  /** Notas de venta, boletas y facturas vigentes con sus subtotales. */
  documents: boolean
  /** Ventas anuladas. */
  cancelled: boolean
  /** Ingresos y egresos de caja. */
  movements: boolean
  /** Productos vendidos. */
  products: boolean
}

export const CASH_DETAIL_SECTION_OPTIONS: { key: keyof CashDetailSections; label: string; hint: string }[] = [
  { key: 'documents', label: 'Comprobantes', hint: 'Notas de venta, boletas y facturas con sus subtotales' },
  { key: 'cancelled', label: 'Ventas anuladas', hint: 'Comprobantes anulados con su motivo' },
  { key: 'movements', label: 'Movimientos de caja', hint: 'Ingresos y egresos de la sesión' },
  { key: 'products', label: 'Productos vendidos', hint: 'Cantidades e importes, sin anulados' },
]

/** Selección inicial del modal: todo marcado. */
export function allCashDetailSections(): CashDetailSections {
  return { documents: true, cancelled: true, movements: true, products: true }
}

/** Completa una selección parcial/ausente: lo no indicado se incluye. */
export function resolveCashDetailSections(s?: Partial<CashDetailSections> | null): CashDetailSections {
  const all = allCashDetailSections()
  return {
    documents: s?.documents ?? all.documents,
    cancelled: s?.cancelled ?? all.cancelled,
    movements: s?.movements ?? all.movements,
    products: s?.products ?? all.products,
  }
}

export type CashSessionDetailData = {
  company: { name: string; ruc: string }
  /** Fila de la sesión (historial o recién cerrada): cierre, esperado, diferencia, quién cerró. */
  session: CashSession | null
  report: CashSessionReport
  documents: SessionDocumentsReport
  products: SessionProductSoldRow[]
  /** Momento de impresión (inyectable para pruebas). */
  printedAt?: Date
  /** Secciones opcionales a incluir; por defecto todas. */
  sections?: Partial<CashDetailSections>
}

const LIMA = 'America/Lima'

function limaParts(d: Date): { y: string; mo: string; da: string; h: string; mi: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LIMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const h = get('hour') === '24' ? '00' : get('hour')
  return { y: get('year'), mo: get('month'), da: get('day'), h, mi: get('minute') }
}

export function ticketDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  const p = limaParts(d)
  return `${p.da}/${p.mo}/${p.y} ${p.h}:${p.mi}`
}

export function ticketTime(value: string | Date | null | undefined): string {
  if (!value) return '--:--'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '--:--'
  const p = limaParts(d)
  return `${p.h}:${p.mi}`
}

export function ticketMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return `S/${(Number.isFinite(v) ? v : 0).toFixed(2)}`
}

/** Hora (HH:MM) o, si la sesión abarca varios días, «dd/mm HH:MM» para no confundir el orden. */
function ticketStamp(value: string | Date | null | undefined, withDate: boolean): string {
  if (!withDate) return ticketTime(value)
  const full = ticketDateTime(value)
  return full === '-' ? '--/-- --:--' : `${full.slice(0, 5)} ${full.slice(11)}`
}

function clean(s: string | null | undefined): string {
  return normalizeTextForTicketPrint(String(s ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Corta un texto en líneas de hasta `width` caracteres (palabras largas se parten). */
export function wrapTicketText(raw: string, width: number): string[] {
  const text = clean(raw)
  if (!text) return ['']
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= width) {
      line = next
      continue
    }
    if (line) out.push(line)
    if (w.length > width) {
      let i = 0
      for (; i + width < w.length; i += width) out.push(w.slice(i, i + width))
      line = w.slice(i)
    } else {
      line = w
    }
  }
  if (line) out.push(line)
  return out
}

/** `izquierda ........ derecha` en `cols` columnas; si no cabe, la izquierda se corta con "..". */
export function ticketPair(left: string, right: string, cols: number): string[] {
  const r = clean(right)
  const l = clean(left)
  const room = cols - r.length - 1
  if (l.length <= room) return [l + ' '.repeat(cols - l.length - r.length) + r]
  const lines = wrapTicketText(l, Math.max(8, room))
  const first = lines[0]
  const rest = lines.slice(1)
  return [first + ' '.repeat(Math.max(1, cols - first.length - r.length)) + r, ...rest.map((x) => `  ${x}`)]
}

function qtyText(q: number): string {
  const n = Number(q)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function methodLabel(code: string): string {
  if (code === 'mixto') return 'Mixto'
  return clean(paymentMethodDisplayLabel(code))
}

function isCashCode(code: string | undefined | null): boolean {
  const c = String(code ?? '').trim().toLowerCase()
  return c === '' || c === 'cash' || c === 'efectivo'
}

const KIND_TITLE: Record<SessionDocKind, string> = {
  nota_venta: 'NOTAS DE VENTA',
  boleta: 'BOLETAS',
  factura: 'FACTURAS',
}
const KIND_ORDER: SessionDocKind[] = ['nota_venta', 'boleta', 'factura']

/** Productos vendidos: mayor importe primero (luego mayor cantidad y nombre). */
export function sortProductsSold(rows: SessionProductSoldRow[]): SessionProductSoldRow[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.total) - Number(a.total) ||
      Number(b.quantity) - Number(a.quantity) ||
      String(a.description).localeCompare(String(b.description), 'es'),
  )
}

/** Suma por método (ventas) manteniendo efectivo primero y el resto por importe. */
export function salesByMethodRows(report: CashSessionReport): { method: string; total: number }[] {
  const acc = new Map<string, number>()
  for (const m of report.totals_by_method?.sales ?? []) {
    const k = String(m.method || 'efectivo').toLowerCase()
    acc.set(k, (acc.get(k) ?? 0) + Number(m.total))
  }
  return [...acc.entries()]
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => Number(isCashCode(b.method)) - Number(isCashCode(a.method)) || b.total - a.total)
}

function movementTypeLabel(r: { type: string }, income: boolean): string {
  const t = String(r.type || '').toLowerCase()
  if (income) return 'Ingreso'
  if (t === 'gasto') return 'Gasto'
  if (t === 'compra' || t === 'pago_proveedor') return 'Compra'
  return 'Egreso'
}

function movementMotive(r: IncomeDetailRow | ExpenseDetailRow): string {
  const cat = String(r.category ?? '').trim()
  const ref = String(r.reference ?? '').trim()
  const doc = String(r.doc_number ?? '').trim()
  return [cat, ref || doc]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .join(' - ')
}

export function buildCashSessionDetailLines(data: CashSessionDetailData, cols: number): TicketLine[] {
  const { report, documents, products } = data
  const inc = resolveCashDetailSections(data.sections)
  const s = report.session
  const row = data.session
  const isOpen = (row?.status ?? s.status) === 'open'
  // Una caja que se dejó abierta varios días mezcla fechas: se antepone dd/mm a cada hora.
  const endRef = s.closed_at ?? (data.printedAt ?? new Date()).toISOString()
  const multiDay = ticketDateTime(s.opened_at).slice(0, 10) !== ticketDateTime(endRef).slice(0, 10)
  const stamp = (v: string) => ticketStamp(v, multiDay)
  const out: TicketLine[] = []
  const sep = (ch = '-') => out.push({ text: ch.repeat(cols) })
  const blank = () => out.push({ text: '' })
  const center = (text: string, bold = false, big = false) =>
    wrapTicketText(text, big ? Math.max(8, Math.floor(cols / 2)) : cols).forEach((t) =>
      out.push({ text: t, align: 'center', bold, big }),
    )
  const pair = (l: string, r: string, bold = false) =>
    ticketPair(l, r, cols).forEach((t) => out.push({ text: t, bold }))
  const text = (t: string, indent = 0) =>
    wrapTicketText(t, cols - indent).forEach((x) => out.push({ text: ' '.repeat(indent) + x }))
  // Número + hora a la izquierda; si no cabe junto al importe, la hora pasa a la línea siguiente.
  const docHead = (number: string, when: string, amount: string, detail: string) => {
    const left = `${number} ${when}`
    if (left.length + amount.length + 1 <= cols) {
      pair(left, amount)
      if (detail) text(detail, 2)
    } else {
      pair(number, amount)
      text(`${when}${detail ? ` ${detail}` : ''}`, 2)
    }
  }
  const section = (title: string) => {
    sep('=')
    center(title, true)
    sep('=')
  }

  // 1. Encabezado
  center(data.company.name || 'Empresa', true)
  if (data.company.ruc) center(`RUC: ${data.company.ruc}`)
  blank()
  center('DETALLE DE CAJA', true, true)
  if (isOpen) {
    center('*** REPORTE PARCIAL ***', true)
    center(`Caja abierta, a la fecha ${ticketDateTime(data.printedAt ?? new Date())}`)
  } else {
    center('CAJA CERRADA')
  }
  sep()
  if (s.branch_name) text(`Sucursal: ${s.branch_name}`)
  const caja = [row?.register_code, row?.register_name].filter(Boolean).join(' - ')
  if (caja) text(`Caja: ${caja}`)
  text(`Sesion N: ${s.id}`)
  text(`Abrio: ${row?.opened_by_name || s.opened_by_user_name || '-'}`)
  text(`Apertura: ${ticketDateTime(s.opened_at)}`)
  if (!isOpen) {
    text(`Cerro: ${row?.closed_by_name || '-'}`)
    text(`Cierre: ${ticketDateTime(s.closed_at)}`)
  }
  pair('Monto inicial:', ticketMoney(s.opening_balance), true)

  // 2. Resumen
  const cash = report.cash_physical
  const manualIncome = cash?.manual_income ?? []
  const expenses = cash?.expenses ?? report.expense_detail ?? []
  const salesTotal = Number(report.totals?.total_sales ?? 0)
  const cashSales = Number(cash?.sales_total ?? 0)
  const manualCashIncome = manualIncome.filter((r) => isCashCode(r.payment_method)).reduce((a, r) => a + Number(r.amount), 0)
  const cashExpense = expenses.filter((r) => isCashCode(r.payment_method)).reduce((a, r) => a + Number(r.amount), 0)
  const expected = Number(cash?.physical_balance ?? report.totals?.final_balance ?? 0)

  section('RESUMEN')
  pair('Ventas cobradas:', ticketMoney(salesTotal), true)
  pair(`Vigentes: ${documents.active_count} doc.`, ticketMoney(documents.active_total))
  pair(`Anulados: ${documents.cancelled_count} doc.`, ticketMoney(documents.cancelled_total))
  sep()
  text('CAJA FISICA (efectivo)')
  pair('Monto inicial', ticketMoney(s.opening_balance))
  pair('+ Ventas en efectivo', ticketMoney(cashSales))
  pair('+ Ingresos de caja', ticketMoney(manualCashIncome))
  pair('- Egresos de caja', ticketMoney(cashExpense))
  pair('= Saldo esperado', ticketMoney(expected), true)
  if (!isOpen) {
    const closing = row?.closing_balance ?? s.closing_balance
    if (closing != null) {
      pair('Saldo de cierre', ticketMoney(closing), true)
      const diff = row?.difference ?? Number(closing) - expected
      const d = Number(diff)
      pair('Diferencia', `${d > 0 ? '+' : ''}${ticketMoney(d)}`, true)
      if (Math.abs(d) < 0.005) text('Cuadre exacto')
      else if (d > 0) text('Sobrante')
      else text('Faltante')
    }
  }

  // 3. Totales por método
  section('VENTAS POR METODO DE PAGO')
  const methods = salesByMethodRows(report)
  if (methods.length === 0) text('Sin ventas cobradas')
  for (const m of methods) {
    pair(`${methodLabel(m.method)}${isCashCode(m.method) ? ' (caja fisica)' : ''}`, ticketMoney(m.total))
  }
  if (methods.length > 0) {
    sep()
    pair('TOTAL', ticketMoney(methods.reduce((a, m) => a + m.total, 0)), true)
  }

  // 4. Comprobantes por tipo
  const byKind = new Map<SessionDocKind, SessionDocumentRow[]>()
  for (const d of documents.documents ?? []) {
    if (d.cancelled) continue
    const list = byKind.get(d.kind) ?? []
    list.push(d)
    byKind.set(d.kind, list)
  }
  if (inc.documents) section('COMPROBANTES')
  if (inc.documents && byKind.size === 0) text('Sin comprobantes vigentes')
  for (const kind of inc.documents ? KIND_ORDER : []) {
    const list = byKind.get(kind)
    if (!list?.length) continue
    center(`${KIND_TITLE[kind]} (${list.length})`, true)
    for (const d of list) {
      const who = clean(d.contact_name) || 'Clientes varios'
      docHead(d.doc_number, stamp(d.created_at), ticketMoney(d.total), `${who} - ${methodLabel(d.payment_method || 'efectivo')}`)
    }
    sep()
    const sub = documents.by_kind?.find((k) => k.kind === kind)
    pair(`Subtotal ${KIND_TITLE[kind].toLowerCase()}`, ticketMoney(sub?.total ?? list.reduce((a, d) => a + Number(d.total), 0)), true)
    blank()
  }

  // Anulados
  const cancelled = (documents.documents ?? []).filter((d) => d.cancelled)
  if (inc.cancelled) section('VENTAS ANULADAS')
  if (inc.cancelled && cancelled.length === 0) text('Sin ventas anuladas')
  for (const kind of inc.cancelled ? KIND_ORDER : []) {
    const list = cancelled.filter((d) => d.kind === kind)
    if (!list.length) continue
    center(`${KIND_TITLE[kind]} (${list.length})`, true)
    for (const d of list) {
      docHead(d.doc_number, stamp(d.created_at), ticketMoney(d.total), d.cancel_reason ? `Motivo: ${d.cancel_reason}` : '')
    }
    const sub = documents.by_kind?.find((k) => k.kind === kind)
    pair(`Subtotal ${KIND_TITLE[kind].toLowerCase()}`, ticketMoney(sub?.cancelled_total ?? list.reduce((a, d) => a + Number(d.total), 0)))
  }
  if (inc.cancelled && cancelled.length > 0) {
    sep()
    pair('TOTAL ANULADO', ticketMoney(documents.cancelled_total), true)
  }

  // 5. Movimientos de caja
  const movs: { date: string; income: boolean; r: IncomeDetailRow | ExpenseDetailRow }[] = [
    ...manualIncome.map((r) => ({ date: r.date, income: true, r })),
    ...expenses.map((r) => ({ date: r.date, income: false, r })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  if (inc.movements) {
    section('MOVIMIENTOS DE CAJA')
    if (movs.length === 0) text('Sin ingresos ni egresos')
  }
  for (const m of inc.movements ? movs : []) {
    pair(
      `${stamp(m.date)} ${movementTypeLabel(m.r, m.income)}`,
      `${m.income ? '+' : '-'}${ticketMoney(Number(m.r.amount))}`,
    )
    const motive = movementMotive(m.r)
    const method = isCashCode(m.r.payment_method) ? '' : ` [${methodLabel(m.r.payment_method)}]`
    if (motive || method) text(`${motive}${method}`.trim(), 2)
  }
  if (inc.movements && movs.length > 0) {
    sep()
    pair('Ingresos en efectivo', ticketMoney(manualCashIncome))
    pair('Egresos en efectivo', ticketMoney(cashExpense))
  }

  // 6. Productos vendidos
  const sorted = sortProductsSold(inc.products ? products : [])
  if (inc.products) section('PRODUCTOS VENDIDOS')
  if (inc.products && sorted.length === 0) text('Sin productos vendidos')
  else if (inc.products) {
    text('Ordenado por importe (sin anulados)')
    sep()
    for (const p of sorted) {
      pair(`${qtyText(p.quantity)} x ${clean(p.description)}`, ticketMoney(p.total))
    }
    sep()
    pair(`Productos distintos: ${sorted.length}`, ticketMoney(sorted.reduce((a, p) => a + Number(p.total), 0)), true)
  }

  sep('=')
  center(`Impreso: ${ticketDateTime(data.printedAt ?? new Date())}`)
  if (isOpen) center('Reporte parcial: la caja sigue abierta')
  center('Tukichef - Sistema POS')
  return out
}
