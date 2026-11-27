import { useEffect, useMemo, useState } from 'react'
import { recipesService, type SupplyCheck } from '@/services/recipes.service'
import { cartToOrderItems, type PosCartLine } from '@/utils/posCart'

const DELAY_MS = 400

/**
 * Insumos que no alcanzan para el carrito (más lo ya pedido en la mesa). Solo con el descuento encendido; espera un momento tras
 * cada cambio. Es un aviso: si falla, no muestra nada y no bloquea.
 */
export function useSupplyCheck(active: boolean, cart: PosCartLine[], sessionId: number | null | undefined, branchId?: number) {
  const [loaded, setLoaded] = useState<{ scope: string; data: SupplyCheck } | null>(null)

  // Solo lo que afecta al consumo: así escribir una nota o cambiar un precio no vuelve a consultar.
  const key = useMemo(() => {
    if (!active) return ''
    try {
      const items = cartToOrderItems(cart).flatMap((i) =>
        'product_id' in i && i.product_id
          ? [{ product_id: i.product_id, quantity: i.quantity, modifiers_json: i.modifiers_json, combo_json: 'combo_json' in i ? i.combo_json : undefined }]
          : [],
      )
      return items.length > 0 ? JSON.stringify(items) : ''
    } catch {
      return ''
    }
  }, [active, cart])
  const scope = `${branchId ?? 0}-${sessionId || 0}`

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      recipesService
        .check({ session_id: sessionId || 0, items: JSON.parse(key) }, branchId)
        .then((data) => {
          if (!cancelled) setLoaded({ scope, data })
        })
        .catch(() => {
          if (!cancelled) setLoaded(null)
        })
    }, DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [key, scope, sessionId, branchId])

  // Carrito vacío, u otro pedido: no se arrastra el aviso anterior.
  return key && loaded?.scope === scope ? loaded.data : null
}
