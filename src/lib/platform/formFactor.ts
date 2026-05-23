import type { DeviceFormFactor } from './types'

/**
 * Umbral en CSS px (screen.width/height) para distinguir teléfono vs tablet.
 * - Teléfono: lado corto < 600px y no cumple regla "grande tipo tablet".
 * - Tablet / phablet grande / fold desplegado: lado corto ≥ 600 o (corto ≥ 520 y largo ≥ 900).
 */
const PHONE_MAX_SHORT_EDGE = 599
const LARGE_PHONE_MIN_SHORT = 520
const LARGE_PHONE_MIN_LONG = 900

export function measureScreenEdges(): { shortEdge: number; longEdge: number } {
  if (typeof window === 'undefined') {
    return { shortEdge: 0, longEdge: 0 }
  }
  const w = window.screen.width
  const h = window.screen.height
  return {
    shortEdge: Math.min(w, h),
    longEdge: Math.max(w, h),
  }
}

export function getDeviceFormFactor(edges = measureScreenEdges()): DeviceFormFactor {
  const { shortEdge, longEdge } = edges
  if (shortEdge <= PHONE_MAX_SHORT_EDGE) {
    if (shortEdge >= LARGE_PHONE_MIN_SHORT && longEdge >= LARGE_PHONE_MIN_LONG) {
      return 'tablet'
    }
    return 'phone'
  }
  return 'tablet'
}

export function allowsLandscapeOrientation(edges = measureScreenEdges()): boolean {
  return getDeviceFormFactor(edges) === 'tablet'
}
