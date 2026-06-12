import type { PaymentMethodRecord } from '@/services/cashbank.service'
import { normalizePaymentMethodCodeForLookup } from '@/utils/paymentMethodCheckout'

/** Etiqueta en español para códigos de método de pago guardados en ventas / tenant_sale_payments. */
const PAYMENT_METHOD_ES: Record<string, string> = {
  cash: 'Efectivo',
  efectivo: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  debito: 'Tarjeta débito',
  credito: 'Crédito',
  credit: 'Crédito',
}

export function salePaymentMethodLabelEs(code: string | undefined | null): string {
  const k = String(code ?? '')
    .trim()
    .toLowerCase()
  if (!k) return '—'
  if (PAYMENT_METHOD_ES[k]) return PAYMENT_METHOD_ES[k]
  if (k.length <= 32) return k.charAt(0).toUpperCase() + k.slice(1)
  return k
}

/** Etiqueta para UI de caja: respeta métodos configurados y unifica cash/efectivo. */
export function paymentMethodDisplayLabel(
  code: string | undefined | null,
  configured?: PaymentMethodRecord[],
): string {
  const norm = normalizePaymentMethodCodeForLookup(code || 'cash')
  if (configured?.length) {
    const found = configured.find((m) => normalizePaymentMethodCodeForLookup(m.code) === norm)
    if (found?.name) return found.name
  }
  return salePaymentMethodLabelEs(code || 'cash')
}
