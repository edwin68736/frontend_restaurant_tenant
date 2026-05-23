import type { Product } from '@/services/products.service'
import type { SessionDetail } from '@/services/restaurant.service'

export type PosCartItem = { product: Product; quantity: number }

/** Reconstruye carrito desde comandas activas del pedido (no entregadas ni anuladas). */
export function sessionDetailToCart(detail: SessionDetail, catalog: Product[]): PosCartItem[] {
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const acc = new Map<number, PosCartItem>()

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
        acc.set(pid, { product, quantity: c.quantity })
      }
    }
  }
  return Array.from(acc.values())
}

export function cartToOrderItems(cart: PosCartItem[]) {
  return cart.map((x) => ({
    product_id: x.product.id,
    product_code: x.product.code || '',
    product_name: x.product.name,
    quantity: x.quantity,
    unit_price: x.product.sale_price,
    notes: '',
  }))
}
