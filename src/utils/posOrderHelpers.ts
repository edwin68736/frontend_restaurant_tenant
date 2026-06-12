import type { Product } from '@/services/products.service'
import type { Comanda, SessionDetail } from '@/services/restaurant.service'
import type { PrecuentaPrintItem } from '@/services/printers.service'
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
import type { LineTaxTotals } from '@/utils/checkoutDiscount'

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
  return calcItem(
    Number(c.unit_price) || 0,
    c.quantity,
    0,
    c.igv_affectation_type ?? '10',
    c.price_includes_igv ?? true,
    taxRate,
    taxConfig,
  )
}

/** Líneas tributarias del cobro: carrito pendiente + comandas ya en sesión. */
export function collectCheckoutLineTaxTotals(
  cart: PosCartLine[],
  session: SessionDetail | null | undefined,
  taxRate: number,
  taxConfig?: Partial<TaxConfig>,
): LineTaxTotals[] {
  const lines: LineTaxTotals[] = cart.map((line) => cartLineTaxTotals(line, taxRate, taxConfig))
  for (const ord of session?.orders ?? []) {
    for (const c of ord.comandas ?? []) {
      if (c.cancelled_at) continue
      lines.push(comandaLineTaxTotals(c, taxRate, taxConfig))
    }
  }
  return lines
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

/** Etiquetas para ticket de comanda en POS (para llevar / delivery). */
export function posComandaPrintLabels(
  detail: SessionDetail | null,
  orderCode: string,
): { tableName: string | null; waiterName: string | null } {
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
      .join(' · ')
    return { tableName: `Delivery ${code}`, waiterName: extra || null }
  }
  if (detail.order_type === 'takeaway') {
    const extra = [detail.customer_name, detail.customer_phone, detail.notes]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' · ')
    return { tableName: `Para llevar ${code}`, waiterName: extra || null }
  }
  return { tableName: code || null, waiterName: detail.waiter_name ?? null }
}

/** Etiquetas de ticket según tipo de sesión (mesa, llevar, delivery, POS). */
export function sessionComandaPrintLabels(
  detail: SessionDetail | null,
  orderCode: string,
): { tableName: string | null; waiterName: string | null } {
  if (!detail) return { tableName: orderCode || 'POS', waiterName: null }
  if (detail.table_name) {
    const table = detail.floor_name ? `${detail.table_name} (${detail.floor_name})` : detail.table_name
    return { tableName: table, waiterName: detail.waiter_name ?? null }
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
