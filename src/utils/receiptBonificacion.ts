/**
 * Operaciones gratuitas gravadas (11–16).
 *
 * El XML enviado a SUNAT utiliza la estructura UBL requerida
 * para operaciones no onerosas.
 *
 * Sin embargo, para la representación impresa se replica el
 * comportamiento del sistema legacy mostrando el precio
 * referencial del producto como Precio Unitario y un Importe
 * de línea igual a 0.00.
 *
 * Este comportamiento es únicamente visual y no modifica la
 * información enviada a SUNAT.
 */

import { isGravadoOperacionNoOnerosa } from '@/constants/igvAffectation'
import type { PrintItem } from '@/types/printData'
import { parseStoredModifiers } from '@/utils/productModifiers'

export function receiptItemIsOperacionGratuita(it: Pick<PrintItem, 'igv_affectation_type'>): boolean {
  return isGravadoOperacionNoOnerosa(it.igv_affectation_type ?? '')
}

export function receiptItemIsBonificacion(it: Pick<PrintItem, 'igv_affectation_type'>): boolean {
  return receiptItemIsOperacionGratuita(it)
}

/** Descripción de la línea; si lleva extras/modificadores los lista entre paréntesis para que el
 *  cliente vea por qué cambia el precio. La presentación ya viene en `description`. */
export function receiptItemDisplayDescription(it: PrintItem): string {
  const base = (it.description || '').trim() || '—'
  const extras = parseStoredModifiers(it.modifiers_json)
    .filter((m) => m.type !== 'variant' && m.option_name)
    .map((m) => m.option_name)
  return extras.length > 0 ? `${base} (+ ${extras.join(', + ')})` : base
}

export function receiptItemDisplayTotal(it: PrintItem, formatAmount: (n: number) => string): string {
  return formatAmount(it.total ?? 0)
}

export function receiptItemDisplayUnitPrice(it: PrintItem, formatAmount: (n: number) => string): string {
  return formatAmount(it.unit_price ?? 0)
}
