/**
 * Época de sucursal: cada cambio de sucursal abre una época nueva.
 *
 * - `currentEpochSignal()` es el AbortSignal de la época vigente; el interceptor de axios lo adjunta
 *   a las peticiones de lectura. Al cambiar de sucursal se aborta (`bumpBranchEpoch`).
 * - `currentEpoch()` permite al interceptor descartar respuestas que llegan de otra época.
 * - `activeBranchIdForCache()` es la sucursal activa para claves de caché (la fija BranchProvider).
 * - `isBranchSwitching()` indica que hay un cambio en curso (el 409 SESSION_UPDATED que provoque el
 *   propio cambio de token NO debe tratarse como "sesión vencida").
 */
let epoch = 0
let controller = new AbortController()
let activeBranchId = 0
let switching = 0

export function currentEpoch(): number {
  return epoch
}

export function currentEpochSignal(): AbortSignal {
  return controller.signal
}

/** Aborta las peticiones en vuelo de la época anterior y abre una nueva. */
export function bumpBranchEpoch(): number {
  const old = controller
  epoch += 1
  controller = new AbortController()
  old.abort()
  return epoch
}

export function setActiveBranchIdForCache(id: number): void {
  activeBranchId = id > 0 ? id : 0
}

export function activeBranchIdForCache(): number {
  return activeBranchId
}

export function beginBranchSwitch(): void {
  switching += 1
}

export function endBranchSwitch(): void {
  switching = Math.max(0, switching - 1)
}

export function isBranchSwitching(): boolean {
  return switching > 0
}

/** Solo para tests. */
export function __resetEpochForTests(): void {
  epoch = 0
  controller = new AbortController()
  activeBranchId = 0
  switching = 0
}
