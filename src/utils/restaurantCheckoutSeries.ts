import type { SeriesRow } from '@/services/company.service'

/** SUNAT: nota de venta, factura, boleta — únicos tipos en checkout restaurante. */
const RESTAURANT_CHECKOUT_SUNAT = new Set(['00', '01', '03'])

/** Código SUNAT efectivo (infiere 00 desde doc_type si falta en BD). */
export function effectiveSunatCode(series: Pick<SeriesRow, 'sunat_code' | 'doc_type'>): string {
  const code = String(series.sunat_code ?? '').trim()
  if (code) return code
  const d = String(series.doc_type ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '')
  if ((d.includes('nota') && d.includes('venta') && !d.includes('credito')) || d === 'notadeventa') return '00'
  if (d.includes('factura') && !d.includes('credito')) return '01'
  if (d.includes('boleta')) return '03'
  return ''
}

export function isNotaVentaSeries(series: Pick<SeriesRow, 'sunat_code' | 'doc_type'>): boolean {
  return effectiveSunatCode(series) === '00'
}

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
  const filtered = filterRestaurantCheckoutSeries(list, opts)
  if (filtered.length > 0) return true
  const sunatEnabled = opts?.sunatEnabled !== false
  if (!sunatEnabled) return false
  return list.some((s) => s.active !== false && isNotaVentaSeries(s))
}

export const BILLING_NOT_ENABLED_MESSAGE =
  'La facturación electrónica no está habilitada para este tenant. Solo puede emitir notas de venta.'
