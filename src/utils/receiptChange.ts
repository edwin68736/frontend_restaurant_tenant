import type { PrintData } from '@/types/printData'
import { roundDisplay } from '@/utils/money'

/** Vuelto/cambio cuando el cliente pagó de más (efectivo u otro método con monto > total). */
export function receiptChangeAmount(data: Pick<PrintData, 'total' | 'payments' | 'change_amount'>): number {
  const explicit = Number(data.change_amount)
  if (Number.isFinite(explicit) && explicit > 0.009) return roundDisplay(explicit)
  const total = Number(data.total) || 0
  const paid = (data.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  return Math.max(0, roundDisplay(paid - total))
}
