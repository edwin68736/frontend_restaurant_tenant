/**
 * Recargo al consumo (DL 25988, hoteles y restaurantes).
 *
 * - % sobre el VALOR DE VENTA SIN IGV (ya con el descuento global aplicado).
 * - Tope legal: 13 %. No lleva IGV. Se suma al total a pagar.
 * - Es de los trabajadores por ley (no es ingreso del negocio).
 *
 * El servidor es la fuente de verdad: esta función replica su cálculo solo para mostrar el
 * total y validar los pagos antes de enviar `apply_service_charge`.
 */
import { roundSunat } from '@/utils/money'

export const MAX_SERVICE_CHARGE_RATE = 13

/** ¿El % es válido para aplicar recargo? (0 < rate ≤ 13) */
export function isValidServiceChargeRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0 && rate <= MAX_SERVICE_CHARGE_RATE
}

/**
 * Recargo = round2(base × rate / 100). Devuelve 0 si el % está fuera de (0, 13] o la base ≤ 0.
 * `base` = subtotal sin IGV tras el descuento global.
 */
export function serviceChargeAmount(base: number, rate: number): number {
  const b = Number(base)
  const r = Number(rate)
  if (!Number.isFinite(b) || b <= 0) return 0
  if (!isValidServiceChargeRate(r)) return 0
  // Mismo redondeo a 2 decimales que el servidor (round2); roundSunat limpia la deriva flotante previa.
  return Math.round(roundSunat(b * (r / 100)) * 100) / 100
}
