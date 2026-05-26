import { roundDisplay, roundSunat } from '@/utils/money'

export type CheckoutDiscountMode = 'percent' | 'amount'

/** @deprecated Use roundDisplay from @/utils/money */
export function roundMoney(n: number): number {
  return roundDisplay(n)
}

/** Monto de descuento en soles (6 decimales) a partir del total bruto. */
export function calcCheckoutDiscountAmount(
  rawTotal: number,
  mode: CheckoutDiscountMode,
  value: number,
): number {
  const base = roundSunat(Math.max(0, Number(rawTotal) || 0))
  if (base <= 0) return 0
  const rawValue = Math.max(0, Number(value) || 0)
  if (mode === 'percent') {
    const pct = Math.min(100, rawValue)
    return roundSunat(base * (pct / 100))
  }
  return roundSunat(Math.min(base, rawValue))
}

export function calcPayableTotal(
  rawTotal: number,
  mode: CheckoutDiscountMode,
  value: number,
): number {
  const discount = calcCheckoutDiscountAmount(rawTotal, mode, value)
  return roundSunat(Math.max(0, roundSunat(rawTotal) - discount))
}
