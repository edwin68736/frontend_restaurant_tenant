/** Precisión interna alineada con backend pkg/money (SUNAT / BD). */
export const SUNAT_DECIMALS = 6
export const DISPLAY_DECIMALS = 2

/** Tolerancia al comparar pagos ingresados (2 decimales) vs total. */
export const PAYMENT_TOLERANCE = 0.01

export function roundSunat(n: number): number {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 1e6) / 1e6
}

export function roundDisplay(n: number): number {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

export function paidCoversTotal(paid: number, expected: number): boolean {
  return roundDisplay(paid) + PAYMENT_TOLERANCE >= roundDisplay(expected)
}
