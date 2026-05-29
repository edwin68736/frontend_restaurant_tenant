import type { SeriesRow } from '@/services/company.service'

/** SUNAT: nota de venta, factura, boleta — únicos tipos en checkout restaurante. */
const RESTAURANT_CHECKOUT_SUNAT = new Set(['00', '01', '03'])

export function isElectronicBillingSunatCode(code?: string | null): boolean {
  const c = String(code ?? '').trim()
  return c === '01' || c === '03'
}

export type RestaurantCheckoutSeriesFilterOpts = {
  /** Si false, solo series SUNAT 00 (nota de venta). */
  sunatEnabled?: boolean
}

/**
 * Series visibles en POS / Mesa / checkout restaurante.
 * Excluye NC, ND, guías y categorías distintas de venta.
 */
export function filterRestaurantCheckoutSeries(
  list: SeriesRow[],
  opts?: RestaurantCheckoutSeriesFilterOpts,
): SeriesRow[] {
  const sunatEnabled = opts?.sunatEnabled !== false
  return list.filter((s) => {
    if (s.active === false) return false
    const cat = String(s.category ?? 'venta').toLowerCase()
    if (cat && cat !== 'venta') return false
    const code = String(s.sunat_code ?? '').trim()
    if (!sunatEnabled && code && code !== '00') return false
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

export function hasRestaurantCheckoutSeries(
  list: SeriesRow[],
  opts?: RestaurantCheckoutSeriesFilterOpts,
): boolean {
  return filterRestaurantCheckoutSeries(list, opts).length > 0
}

export const BILLING_NOT_ENABLED_MESSAGE =
  'La facturación electrónica no está habilitada para este tenant. Solo puede emitir notas de venta.'
