import type { Product } from '@/services/products.service'
import type { Comanda, SessionDetail } from '@/services/restaurant.service'
import { cartToOrderItems as cartLinesToOrderItems, type PosCartLine } from '@/utils/posCart'

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
  return (comandas ?? []).filter((c) => !(c as Comanda & { cancelled_at?: string | null }).cancelled_at)
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

      const existing = acc.get(pid)
      if (existing) {
        existing.quantity += c.quantity
      } else {
        acc.set(pid, { kind: 'catalog', product, quantity: c.quantity, notes: c.notes ?? '' })
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
