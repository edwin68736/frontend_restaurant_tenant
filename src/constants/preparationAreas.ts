/** Áreas de preparación conocidas en productos (valores guardados en BD). */
export const PREPARATION_AREAS = [
  { value: '', label: 'Sin área (usa impresora por defecto)' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'bar', label: 'Bar' },
  { value: 'barra', label: 'Barra' },
  { value: 'postres', label: 'Postres' },
  { value: 'otro', label: 'Otro' },
] as const

export const PREPARATION_AREAS_WITH_VALUE = PREPARATION_AREAS.filter((a) => a.value !== '')

export function preparationAreaLabel(value: string): string {
  const key = value.trim().toLowerCase()
  const found = PREPARATION_AREAS.find((a) => a.value === key)
  return found?.label ?? value
}

/** Clave normalizada para mapa de impresoras por área. Vacío = sin área. */
export function normalizePreparationAreaKey(area?: string | null): string {
  return (area ?? '').trim().toLowerCase()
}
