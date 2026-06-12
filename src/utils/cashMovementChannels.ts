import { normalizePaymentMethodCodeForLookup } from '@/utils/paymentMethodCheckout'

/** true si el método representa dinero físico en caja (efectivo / cash). */
export function isCashPaymentMethod(code: string | undefined | null): boolean {
  return normalizePaymentMethodCodeForLookup(code || 'cash') === 'cash'
}

export function formatSoles(amount: number): string {
  return `S/ ${Number(amount || 0).toFixed(2)}`
}
