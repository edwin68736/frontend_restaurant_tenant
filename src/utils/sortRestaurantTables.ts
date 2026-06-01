import type { Floor, RestaurantTable } from '@/services/restaurant.service'

/** Quita prefijo M/m habitual (M2, m1100) y devuelve número si el nombre es solo dígitos. */
export function parseTableNameNumber(name: string): number | null {
  const trimmed = (name || '').trim()
  const withoutPrefix = trimmed.replace(/^[mM]\s*/u, '').trim()
  if (!/^\d+$/u.test(withoutPrefix)) return null
  const n = Number.parseInt(withoutPrefix, 10)
  return Number.isFinite(n) ? n : null
}

function floorSortOrder(floors: Floor[], floorId: number): number {
  const f = floors.find((x) => x.id === floorId)
  if (f) return f.sort_order ?? 0
  return floorId
}

/** Orden: piso (sort_order) → nombre numérico → id (nombres solo texto). */
export function compareRestaurantTables(
  a: RestaurantTable,
  b: RestaurantTable,
  floors: Floor[],
): number {
  const floorDiff = floorSortOrder(floors, a.floor_id) - floorSortOrder(floors, b.floor_id)
  if (floorDiff !== 0) return floorDiff

  const na = parseTableNameNumber(a.name)
  const nb = parseTableNameNumber(b.name)

  if (na !== null && nb !== null) {
    const numDiff = na - nb
    return numDiff !== 0 ? numDiff : a.id - b.id
  }
  if (na !== null && nb === null) return -1
  if (na === null && nb !== null) return 1

  return a.id - b.id
}

export function sortRestaurantTables(tables: RestaurantTable[], floors: Floor[]): RestaurantTable[] {
  if (tables.length <= 1) return tables
  return [...tables].sort((a, b) => compareRestaurantTables(a, b, floors))
}
