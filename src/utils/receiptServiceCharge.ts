import type { PrintData } from '@/types/printData'

/**
 * Recargo al consumo (DL 25988) de un comprobante: `print_data.service_charge_amount/rate`
 * (el servidor los omite si es 0). `print_data.total` YA incluye el recargo; `subtotal` e IGV no.
 * Devuelve null si el comprobante no lleva recargo.
 */
export function receiptServiceCharge(
  data: Pick<PrintData, 'service_charge_amount' | 'service_charge_rate'>,
): { amount: number; rate: number; label: string } | null {
  const amount = Number(data.service_charge_amount) || 0
  if (amount <= 0.000001) return null
  const rate = Number(data.service_charge_rate) || 0
  return { amount, rate, label: rate > 0 ? `Recargo al consumo (${rate} %)` : 'Recargo al consumo' }
}
