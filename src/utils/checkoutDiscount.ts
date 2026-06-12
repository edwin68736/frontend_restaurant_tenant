import { roundDisplay, roundSunat } from '@/utils/money'

export type CheckoutDiscountMode = 'percent' | 'amount'

export type LineTaxTotals = {
  subtotal: number
  taxAmount: number
  total: number
}

/** @deprecated Use roundDisplay from @/utils/money */
export function roundMoney(n: number): number {
  return roundDisplay(n)
}

/** Monto de descuento en soles sobre la base imponible (subtotal). */
export function calcCheckoutDiscountAmount(
  rawSubtotal: number,
  mode: CheckoutDiscountMode,
  value: number,
): number {
  const base = roundSunat(Math.max(0, Number(rawSubtotal) || 0))
  if (base <= 0) return 0
  const rawValue = Math.max(0, Number(value) || 0)
  if (mode === 'percent') {
    const pct = Math.min(100, rawValue)
    return roundSunat(base * (pct / 100))
  }
  return roundSunat(Math.min(base, rawValue))
}

/** Reparte descuento global proporcionalmente entre líneas (p. ej. subtotales). */
export function distributeCheckoutDiscountToLines(
  lineBases: number[],
  discountAmount: number,
): number[] {
  const n = lineBases.length
  if (n === 0) return []
  const baseSum = roundSunat(lineBases.reduce((a, t) => a + Math.max(0, t), 0))
  const disc = roundSunat(Math.max(0, Math.min(Number(discountAmount) || 0, baseSum)))
  if (disc <= 0 || baseSum <= 0) return new Array(n).fill(0)

  const result = new Array<number>(n).fill(0)
  let remaining = disc
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      result[i] = roundSunat(remaining)
    } else {
      const share = roundSunat(disc * (Math.max(0, lineBases[i]) / baseSum))
      result[i] = share
      remaining = roundSunat(remaining - share)
    }
  }
  return result
}

/** Aplica descuento sobre subtotales y recalcula IGV/total por línea (alineado con backend restaurante). */
export function applyCheckoutDiscountToLines(
  lines: LineTaxTotals[],
  mode: CheckoutDiscountMode,
  value: number,
): {
  discountAmount: number
  lines: LineTaxTotals[]
  subtotal: number
  taxAmount: number
  payableTotal: number
} {
  if (lines.length === 0) {
    return { discountAmount: 0, lines: [], subtotal: 0, taxAmount: 0, payableTotal: 0 }
  }
  const rawSubtotal = roundSunat(lines.reduce((a, l) => a + l.subtotal, 0))
  const discountAmount = calcCheckoutDiscountAmount(rawSubtotal, mode, value)
  const lineDiscounts = distributeCheckoutDiscountToLines(
    lines.map((l) => l.subtotal),
    discountAmount,
  )
  const discountedLines = lines.map((line, i) => {
    const d = lineDiscounts[i] ?? 0
    const newSub = roundSunat(Math.max(0, line.subtotal - d))
    const effRate = line.subtotal > 0 ? line.taxAmount / line.subtotal : 0
    const newTax = roundSunat(newSub * effRate)
    const newTotal = roundSunat(newSub + newTax)
    return { subtotal: newSub, taxAmount: newTax, total: newTotal }
  })
  return {
    discountAmount,
    lines: discountedLines,
    subtotal: roundSunat(discountedLines.reduce((a, l) => a + l.subtotal, 0)),
    taxAmount: roundSunat(discountedLines.reduce((a, l) => a + l.taxAmount, 0)),
    payableTotal: roundSunat(discountedLines.reduce((a, l) => a + l.total, 0)),
  }
}

/** Payload de descuento para POST /sessions/:id/bill (alineado con backend). */
export type RestaurantBillDiscountPayload = {
  discount_mode?: CheckoutDiscountMode
  discount_value?: number
  discount_amount?: number
}

/** Calcula descuento y totales de cobro justo antes de facturar (evita estado desincronizado). */
export function buildRestaurantBillDiscount(
  lines: LineTaxTotals[],
  mode: CheckoutDiscountMode,
  value: number,
  allowDiscount: boolean,
): RestaurantBillDiscountPayload & {
  discountAmount: number
  payableTotal: number
  taxAmount: number
  billingSubtotal: number
} {
  const billingSubtotal = roundSunat(lines.reduce((acc, line) => acc + line.subtotal, 0))
  if (!allowDiscount || value <= 0 || lines.length === 0) {
    const taxAmount = roundSunat(lines.reduce((acc, line) => acc + line.taxAmount, 0))
    const payableTotal = roundSunat(lines.reduce((acc, line) => acc + line.total, 0))
    return {
      discountAmount: 0,
      payableTotal,
      taxAmount,
      billingSubtotal,
    }
  }
  const billing = applyCheckoutDiscountToLines(lines, mode, value)
  const discountAmount = roundSunat(billing.discountAmount)
  return {
    discount_mode: mode,
    discount_value: value,
    discount_amount: discountAmount > 0 ? discountAmount : undefined,
    discountAmount,
    payableTotal: billing.payableTotal,
    taxAmount: billing.taxAmount,
    billingSubtotal,
  }
}

/** @deprecated Usar applyCheckoutDiscountToLines para totales con IGV correcto. */
export function calcPayableTotal(
  rawSubtotal: number,
  mode: CheckoutDiscountMode,
  value: number,
): number {
  const discount = calcCheckoutDiscountAmount(rawSubtotal, mode, value)
  return roundSunat(Math.max(0, roundSunat(rawSubtotal) - discount))
}
