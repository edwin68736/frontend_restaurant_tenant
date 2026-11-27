import type { Availability, Shortage } from '@/services/recipes.service'
import { unitLabel } from '@/utils/recipes'
import { formatQty } from '@/utils/supplies'

/**
 * Porciones de un plato cuando el descuento de insumos está encendido.
 * - `undefined`: el plato no descuenta por receta; se muestra su stock como siempre.
 * - `null`: descuenta por receta pero no se sabe para cuántas alcanza.
 */
export type Portions = number | null | undefined

/** Para la tarjeta del plato. Con presentaciones solo si TODAS descuentan por receta (se muestra la que más alcanza). */
export function cardPortions(availability: Availability | null, productId: number): Portions {
  if (!availability?.active) return undefined
  const entries = availability.dishes.filter((d) => d.product_id === productId)
  if (entries.length === 0 || entries.some((d) => !d.all_presentations)) return undefined
  const known = entries.flatMap((d) => (d.portions == null ? [] : [d.portions]))
  return known.length > 0 ? Math.max(...known) : null
}

/** Para cada presentación: las que no tienen receta siguen con su stock. */
export function presentationPortions(availability: Availability | null, productId: number, presentationId: number): Portions {
  if (!availability?.active) return undefined
  const entry = availability.dishes.find((d) => d.product_id === productId && d.presentation_id === presentationId)
  return entry ? entry.portions : undefined
}

export function shortageText(s: Shortage): string {
  const unit = unitLabel(s.unit)
  return `${s.name}: se necesitan ${formatQty(s.required)} ${unit}, hay ${formatQty(s.available)} ${unit}`
}
