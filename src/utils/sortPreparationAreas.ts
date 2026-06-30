import type { PreparationArea } from '@/services/products.service'

/** Orden por sort_order, luego nombre. */
export function sortPreparationAreas<T extends Pick<PreparationArea, 'sort_order' | 'name'>>(areas: T[]): T[] {
  return [...areas].sort((a, b) => {
    const ao = a.sort_order ?? 0
    const bo = b.sort_order ?? 0
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}
