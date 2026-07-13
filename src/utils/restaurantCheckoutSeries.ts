import type { SeriesRow } from '@/services/company.service'

/** SUNAT: nota de venta, factura, boleta — únicos tipos en checkout restaurante. */
const RESTAURANT_CHECKOUT_SUNAT = new Set(['00', '01', '03'])

/** Código SUNAT efectivo (infiere desde doc_type si falta o es inconsistente en BD). */
export function effectiveSunatCode(series: Pick<SeriesRow, 'sunat_code' | 'doc_type'>): string {
  const raw = String(series.sunat_code ?? '').trim()
  const d = String(series.doc_type ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '')

  const inferred =
    (d.includes('nota') && d.includes('venta') && !d.includes('credito')) || d === 'notadeventa'
      ? '00'
      : d === 'boleta'
        ? '03'
        : d === 'factura'
          ? '01'
          : d.includes('factura') && !d.includes('credito')
            ? '01'
            : d.includes('boleta')
              ? '03'
              : ''

  if (raw === '00' || inferred === '00') return '00'
  if (inferred) return inferred
  return raw
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
  /** ¿El régimen del tenant permite Factura (01)? (Nuevo RUS = false). */
  canFactura?: boolean
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
  const canFactura = opts?.canFactura !== false
  return list.filter((s) => {
    if (s.active === false) return false
    const cat = String(s.category ?? 'venta').toLowerCase()
    if (cat && cat !== 'venta') return false
    const code = effectiveSunatCode(s)
    if (!sunatEnabled) return code === '00'
    if (code === '01' && !canFactura) return false // p. ej. Nuevo RUS: sin facturas
    if (!code || !RESTAURANT_CHECKOUT_SUNAT.has(code)) return false
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
