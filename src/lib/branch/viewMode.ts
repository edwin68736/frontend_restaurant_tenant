/**
 * Modo de vista de sucursal: "una sucursal" (operativo) o "todas las sucursales" (SOLO CONSULTA).
 *
 * - El modo "todas" existe solo para quien tiene `branches.view_all` (el backend lo informa como
 *   `can_view_all`). El POS por PIN nunca lo tiene. El backend ignora la cabecera sin el permiso, pero la UI
 *   tampoco debe ofrecer ni conservar el modo: `reconcileViewMode(false)` lo baja a "una sucursal".
 * - En modo "todas" el interceptor de axios agrega `X-Branch-Mode: all` SOLO a lecturas y rechaza en el cliente
 *   cualquier escritura (`BRANCH_READ_ONLY`): las escrituras salen sin la cabecera y el servidor las
 *   ejecutaría en la sucursal activa, que es justo lo que este modo debe impedir.
 * - Se persiste por empresa (localStorage) y se borra al cerrar sesión (`clearAllCaches`).
 */
import { readTenantScoped, removeTenantScoped, writeTenantScoped } from '@/lib/tenantStorage'
import { registerCache } from '@/lib/cacheRegistry'

export type BranchViewMode = 'single' | 'all'

export const BRANCH_MODE_HEADER = 'X-Branch-Mode'
export const BRANCH_MODE_ALL = 'all'
export const BRANCH_READ_ONLY_CODE = 'BRANCH_READ_ONLY'
/** Evento (window) emitido cuando una escritura fue rechazada por el modo consulta (cliente o servidor). */
export const BRANCH_READ_ONLY_EVENT = 'tukichef-branch-read-only'
export const READ_ONLY_MESSAGE =
  'Modo consulta: todas las sucursales. Seleccione una sucursal para realizar esta acción.'

const MODE_KEY = 'branch_view_mode'
export const CAN_VIEW_ALL_KEY = 'can_view_all'

let mode: BranchViewMode = 'single'
let hydrated = false

function readCanViewAllFlag(): boolean {
  try {
    return localStorage.getItem(CAN_VIEW_ALL_KEY) === 'true'
  } catch {
    return false
  }
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  try {
    mode = readTenantScoped(MODE_KEY) === BRANCH_MODE_ALL && readCanViewAllFlag() ? 'all' : 'single'
  } catch {
    mode = 'single'
  }
}

export function getBranchViewMode(): BranchViewMode {
  hydrate()
  return mode
}

/** true en modo "todas las sucursales": solo consulta. Funciona fuera de React (interceptor, servicios). */
export function isReadOnlyMode(): boolean {
  return getBranchViewMode() === 'all'
}

/** Fija el modo y lo persiste (por empresa). Devuelve true si cambió. */
export function setBranchViewMode(next: BranchViewMode): boolean {
  hydrate()
  if (next === mode) return false
  mode = next
  try {
    if (next === 'all') writeTenantScoped(MODE_KEY, BRANCH_MODE_ALL)
    else removeTenantScoped(MODE_KEY)
  } catch {
    /* sin almacenamiento: el modo vive solo en memoria */
  }
  return true
}

/**
 * Si el usuario NO puede ver todas, el modo "todas" no es válido (sesión nueva, permiso retirado, PIN):
 * se baja a "una sucursal". Devuelve true si hubo que bajarlo.
 */
export function reconcileViewMode(canViewAll: boolean): boolean {
  if (!canViewAll && getBranchViewMode() === 'all') {
    setBranchViewMode('single')
    return true
  }
  return false
}

/** Solo para tests. */
export function __resetViewModeForTests(): void {
  mode = 'single'
  hydrated = false
}

// Cerrar sesión / sesión vencida: el modo no sobrevive entre usuarios.
registerCache('branch-view-mode', 'session', () => {
  mode = 'single'
  hydrated = true
  try {
    removeTenantScoped(MODE_KEY)
  } catch {
    /* noop */
  }
})
