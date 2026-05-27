import type { SeriesRow } from '@/services/company.service'

/** SUNAT: nota de venta, factura, boleta — únicos tipos en checkout restaurante. */
const RESTAURANT_CHECKOUT_SUNAT = new Set(['00', '01', '03'])

/**
 * Series visibles en POS / Mesa / checkout restaurante.
 * Excluye NC, ND, guías y categorías distintas de venta.
 */
export function filterRestaurantCheckoutSeries(list: SeriesRow[]): SeriesRow[] {
  return list.filter((s) => {
    if (s.active === false) return false
    const cat = String(s.category ?? 'venta').toLowerCase()
    if (cat && cat !== 'venta') return false
    const code = String(s.sunat_code ?? '').trim()
    if (code && !RESTAURANT_CHECKOUT_SUNAT.has(code)) return false
    const d = String(s.doc_type ?? '').toLowerCase()
    if (d.includes('credito') || d.includes('crédito') || d.includes('debito') || d.includes('débito')) {
      return false
    }
    if (d.includes('guia') || d.includes('guía') || d.includes('retencion') || d.includes('percepcion')) {
      return false
    }
    return true
  })
}

export function hasRestaurantCheckoutSeries(list: SeriesRow[]): boolean {
  return filterRestaurantCheckoutSeries(list).length > 0
}
