import type { Product } from '@/services/products.service'
import type { Comanda, SessionDetail } from '@/services/restaurant.service'
import type { PrecuentaPrintItem } from '@/services/printers.service'
import { loadComandaPrintLayoutSettings } from '@/services/printers/comandaPrintLayout'
import {
  buildCatalogConfigureKey,
  cartLineLabel,
  cartLineTaxTotals,
  cartLineTotal,
  cartLineUnitPrice,
  cartToOrderItems as cartLinesToOrderItems,
  createCatalogCartLine,
  type PosCartLine,
} from '@/utils/posCart'
import { formatModifierLines, parseStoredModifiers, storedToCartModifiers } from '@/utils/productModifiers'
import { calcItem } from '@/utils/taxCalc'
import type { TaxConfig } from '@/utils/taxCalc'
import { isBonificacionGravada } from '@/constants/igvAffectation'
import type { LineTaxTotals } from '@/utils/checkoutDiscount'
import { sumMoney } from '@/utils/money'

/** Total de línea de comanda (misma lógica tributaria que el backend al facturar). */
export function comandaLineTotal(
  c: Pick<Comanda, 'unit_price' | 'quantity' | 'igv_affectation_type' | 'price_includes_igv'>,
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): number {
  return comandaLineTaxTotals(c, taxRate, taxConfig).total
}

export function comandaLineTaxTotals(
  c: Pick<Comanda, 'unit_price' | 'quantity' | 'igv_affectation_type' | 'price_includes_igv'>,
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): LineTaxTotals {
  const t = calcItem(
    Number(c.unit_price) || 0,
    c.quantity,
    0,
    c.igv_affectation_type ?? '10',
    c.price_includes_igv ?? true,
    taxRate,
    taxConfig,
  )
  // Bonificación gravada ('15'): es gratuita → no cobra nada en el checkout (base, IGV y total en 0).
  return isBonificacionGravada(c.igv_affectation_type ?? '') ? { subtotal: 0, taxAmount: 0, total: 0 } : t
}

/** Snapshot del combo dueño guardado en cada comanda-componente (combo_json). */
type ComboComandaPayload = {
  combo_price?: number
  combo_quantity?: number
  igv_affectation_type?: string
  price_includes_igv?: boolean
}

function parseComboComandaPayload(json: string | undefined): ComboComandaPayload | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as ComboComandaPayload) : null
  } catch {
    return null
  }
}

/**
 * Igual que comandaLineTaxTotals, pero consciente de combos: las N comandas-componente de un
 * mismo combo (combo_parent_key) valen 0 cada una por su cuenta — el precio real vive en el
 * combo_json (precio fijo del combo), y solo debe contarse UNA vez por grupo, no sumando ceros
 * ni multiplicando el precio por cada componente.
 */
export function groupedComandaLineTaxTotals(
  comandas: Comanda[],
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): LineTaxTotals[] {
  const out: LineTaxTotals[] = []
  const seenCombo = new Set<string>()
  for (const c of comandas) {
    if (c.combo_parent_key) {
      if (seenCombo.has(c.combo_parent_key)) continue
      seenCombo.add(c.combo_parent_key)
      const payload = parseComboComandaPayload(c.combo_json)
      if (payload && payload.combo_price != null) {
        const affType = payload.igv_affectation_type || '10'
        const priceIncludes = payload.price_includes_igv ?? true
        const qty = payload.combo_quantity ?? 1
        const t = calcItem(Number(payload.combo_price) || 0, qty, 0, affType, priceIncludes, taxRate, taxConfig)
        out.push(isBonificacionGravada(affType) ? { subtotal: 0, taxAmount: 0, total: 0 } : t)
        continue
      }
      // Sin combo_json parseable (dato viejo/corrupto): cae al cálculo normal de esta línea.
    }
    out.push(comandaLineTaxTotals(c, taxRate, taxConfig))
  }
  return out
}

export function groupedComandaLineTotal(
  comandas: Comanda[],
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): number {
  return sumMoney(...groupedComandaLineTaxTotals(comandas, taxRate, taxConfig).map((l) => l.total))
}

/** Líneas tributarias del cobro: carrito pendiente + comandas ya en sesión (combos agrupados). */
export function collectCheckoutLineTaxTotals(
  cart: PosCartLine[],
  session: SessionDetail | null | undefined,
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): LineTaxTotals[] {
  const lines: LineTaxTotals[] = cart.map((line) => cartLineTaxTotals(line, taxRate, taxConfig))
  for (const ord of session?.orders ?? []) {
    // billed_at: ya se cobró en un cobro parcial anterior — no vuelve a sumar al pendiente.
    const pending = (ord.comandas ?? []).filter((c) => !c.cancelled_at && !c.billed_at)
    lines.push(...groupedComandaLineTaxTotals(pending, taxRate, taxConfig))
  }
  return lines
}

/** Comandas activas, no anuladas y aún no cobradas (para dividir cuenta / total pendiente). */
export function pendingComandas(detail: SessionDetail | null): Comanda[] {
  if (!detail?.orders?.length) return []
  const out: Comanda[] = []
  for (const ord of detail.orders) {
    for (const c of ord.comandas ?? []) {
      if (c.cancelled_at || c.billed_at) continue
      out.push(c)
    }
  }
  return out
}

/** @deprecated Use PosCartLine from @/utils/posCart */
export type PosCartItem = PosCartLine

export type KitchenRound = {
  orderId: number
  orderNumber: number
  comandas: Comanda[]
  printedAt?: string | null
  createdAt?: string
  /** true si todas las líneas activas están entregadas */
  allDelivered: boolean
}

function activeComandas(comandas: Comanda[]): Comanda[] {
  return (comandas ?? []).filter((c) => !c.cancelled_at)
}

/** Comandas activas aún anulables (no entregadas). */
export function countCancellableComandas(detail: SessionDetail | null, orderId?: number): number {
  const orders = getActiveSessionOrders(detail)
  let count = 0
  for (const ord of orders) {
    if (orderId != null && orderId > 0 && ord.id !== orderId) continue
    count += (ord.comandas ?? []).filter((c) => c.status !== 'entregada' && !c.billed_at).length
  }
  return count
}

/** Pedidos de sesión con solo comandas activas (no anuladas). */
export function getActiveSessionOrders(detail: SessionDetail | null) {
  if (!detail?.orders?.length) return []
  return detail.orders
    .map((ord) => ({
      ...ord,
      comandas: activeComandas(ord.comandas ?? []),
    }))
    .filter((ord) => ord.comandas.length > 0)
}

/** Historial completo de rondas/comandas (para reimpresión exacta por order_id). */
export function getOrderRoundHistory(detail: SessionDetail | null): KitchenRound[] {
  if (!detail?.orders?.length) return []
  return detail.orders.map((ord) => {
    const lines = activeComandas(ord.comandas ?? [])
    const allDelivered = lines.length > 0 && lines.every((c) => c.status === 'entregada')
    return {
      orderId: ord.id,
      orderNumber: ord.order_number,
      comandas: lines,
      printedAt: (ord as { printed_at?: string | null }).printed_at ?? null,
      createdAt: (ord as { created_at?: string }).created_at,
      allDelivered,
    }
  })
}

/** Rondas con ítems aún en cocina (no entregados). */
export function getActiveKitchenRounds(detail: SessionDetail | null): KitchenRound[] {
  return getOrderRoundHistory(detail).filter((r) => {
    const pending = r.comandas.filter((c) => c.status !== 'entregada')
    return pending.length > 0
  }).map((r) => ({
    ...r,
    comandas: r.comandas.filter((c) => c.status !== 'entregada'),
  }))
}

/** @deprecated Use getActiveKitchenRounds */
export type SentKitchenOrder = KitchenRound
/** @deprecated Use getActiveKitchenRounds */
export const getSentKitchenOrders = getActiveKitchenRounds

/** Forma devuelta a printComandaAuto: qué texto imprimir y con qué etiqueta cada línea — para
 *  llevar/delivery NO es una mesa, y el campo "waiter" ahí transporta datos del CLIENTE, no del
 *  mozo, así que ninguno de los dos puede quedar con las etiquetas fijas "MESA"/"MOZO". */
type ComandaPrintLabels = {
  tableName: string | null
  tableLabel?: string
  waiterName: string | null
  waiterLabel?: string
}

/** Etiquetas para ticket de comanda en POS (para llevar / delivery). */
export function posComandaPrintLabels(detail: SessionDetail | null, orderCode: string): ComandaPrintLabels {
  const code = detail?.order_code ?? orderCode
  if (!detail) return { tableName: code || 'POS', waiterName: null }
  if (detail.order_type === 'delivery') {
    const extra = [
      detail.customer_name,
      detail.customer_phone,
      detail.delivery_address,
      detail.delivery_reference,
      detail.driver_name,
    ]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' - ')
    // Sin etiqueta ("Delivery P-..." ya se explica solo, no es una mesa) y "CLIENTE" en vez de
    // "MOZO" porque `extra` son datos del cliente/repartidor, no del mozo.
    return { tableName: `Delivery ${code}`, tableLabel: '', waiterName: extra || null, waiterLabel: 'CLIENTE' }
  }
  if (detail.order_type === 'takeaway') {
    const extra = [detail.customer_name, detail.customer_phone, detail.notes]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' - ')
    return { tableName: `Para llevar ${code}`, tableLabel: '', waiterName: extra || null, waiterLabel: 'CLIENTE' }
  }
  // Ojo: en delivery/takeaway el campo waiterName transporta los datos del cliente, no el
  // mozo, así que el ajuste no aplica ahí (ocultarlo borraría la dirección de la comanda).
  const showWaiter = loadComandaPrintLayoutSettings().showWaiter
  return {
    tableName: code || null,
    waiterName: showWaiter ? (detail.waiter_name ?? null) : null,
  }
}

/** Etiquetas de ticket según tipo de sesión (mesa, llevar, delivery, POS). */
export function sessionComandaPrintLabels(detail: SessionDetail | null, orderCode: string): ComandaPrintLabels {
  if (!detail) return { tableName: orderCode || 'POS', waiterName: null }
  // Por order_type, no por "table_name truthy": un pedido para llevar/delivery con un
  // table_name residual (dato viejo, migración, etc.) no debe imprimirse como si fuera una
  // mesa — antes bastaba con que table_name no estuviera vacío para tomar esta rama.
  if (detail.order_type !== 'delivery' && detail.order_type !== 'takeaway' && detail.table_name) {
    // El «ambiente» es el piso/sala y viaja pegado al nombre de la mesa; el ajuste local
    // de comandas decide si se imprime.
    const layout = loadComandaPrintLayoutSettings()
    const showFloor = layout.showTableFloor && Boolean(detail.floor_name)
    const table = showFloor ? `${detail.table_name} (${detail.floor_name})` : detail.table_name
    return {
      tableName: table,
      waiterName: layout.showWaiter ? (detail.waiter_name ?? null) : null,
    }
  }
  return posComandaPrintLabels(detail, orderCode)
}

/**
 * @deprecated No usar en POS: el carrito es solo para ítems nuevos. Ver getSentKitchenOrders.
 * Reconstruye carrito desde comandas activas (útil solo si se requiere edición explícita).
 */
export function sessionDetailToCart(detail: SessionDetail, catalog: Product[]): PosCartLine[] {
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const acc = new Map<number, PosCartLine>()

  for (const ord of detail.orders ?? []) {
    for (const c of ord.comandas ?? []) {
      if ((c as { cancelled_at?: string }).cancelled_at) continue
      if (c.status === 'entregada') continue
      const pid = (c as { product_id?: number }).product_id
      if (!pid) continue
      const product =
        byId.get(pid) ??
        ({
          id: pid,
          code: c.product_code ?? '',
          name: c.product_name,
          sale_price: c.unit_price,
          unit: 'NIU',
          is_restaurant: true,
          active: true,
        } as Product)

      const modifiers = storedToCartModifiers(parseStoredModifiers(c.modifiers_json))
      const base = Number(product.sale_price) || Number(c.unit_price) || 0
      const line = createCatalogCartLine(product, {
        quantity: c.quantity,
        notes: c.notes ?? '',
        modifiers,
        base_price: base,
      })
      line.unit_price = Number(c.unit_price) || line.unit_price
      line.configureKey = buildCatalogConfigureKey(line.modifiers, line.notes ?? '', line.unit_price)

      const key = line.configureKey
      const existingKey = [...acc.entries()].find(([, v]) => v.kind === 'catalog' && v.configureKey === key)?.[0]
      if (existingKey != null) {
        const existing = acc.get(existingKey)!
        if (existing.kind === 'catalog') existing.quantity += c.quantity
      } else {
        acc.set(pid + acc.size, line)
      }
    }
  }
  return Array.from(acc.values())
}

/** Cantidad total ya persistida en el pedido (no incluye carrito nuevo). */
export function sumSessionComandaQty(detail: SessionDetail | null): number {
  if (!detail?.orders?.length) return 0
  return detail.orders.reduce((sum, ord) => {
    const lines = activeComandas(ord.comandas ?? [])
    return sum + lines.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
  }, 0)
}

export function cartToOrderItems(cart: PosCartLine[]) {
  return cartLinesToOrderItems(cart)
}

/** Fecha legible para ticket de precuenta (misma convención que comprobantes). */
export function formatPrecuentaIssueDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('es-PE')
  return d.toLocaleDateString('es-PE')
}

export function comandaToPrecuentaPrintItem(
  c: Comanda,
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): PrecuentaPrintItem {
  return {
    productName: c.product_name,
    quantity: c.quantity,
    unitPrice: c.unit_price,
    lineTotal: comandaLineTotal(c, taxRate, taxConfig),
    modifierLines: formatModifierLines(parseStoredModifiers(c.modifiers_json)),
    notes: c.notes,
  }
}

export function cartLineToPrecuentaPrintItem(
  line: PosCartLine,
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): PrecuentaPrintItem {
  return {
    productName: cartLineLabel(line),
    quantity: line.quantity,
    unitPrice: cartLineUnitPrice(line),
    lineTotal: cartLineTotal(line, taxRate, taxConfig),
    modifierLines: line.kind === 'catalog' ? formatModifierLines(line.modifiers) : [],
    notes: line.notes,
  }
}

export function precuentaApiLineToPrintItem(l: {
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  notes?: string
  modifiers_json?: string
}): PrecuentaPrintItem {
  return {
    productName: l.product_name,
    quantity: l.quantity,
    unitPrice: l.unit_price,
    lineTotal: l.line_total,
    modifierLines: formatModifierLines(parseStoredModifiers(l.modifiers_json)),
    notes: l.notes,
  }
}
