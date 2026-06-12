import { isNativePrintAvailable } from '@/services/printers.service'

export type RestaurantFeature =
  | 'productos'
  | 'modificadores'
  | 'mesas'
  | 'pos'
  | 'salas'
  | 'mesa'
  | 'comandas'
  | 'cerrar_mesa'
  | 'ventas'
  | 'caja'
  | 'reportes'
  | 'dashboard'
  | 'clientes'
  | 'repartidores'

/** Mapeo feature UI → permiso corto backend. */
const FEATURE_PERM: Record<RestaurantFeature, string> = {
  productos: 'g.p',
  modificadores: 'g.p',
  mesas: 'g.p',
  pos: 'p.u',
  salas: 't.v',
  mesa: 't.o',
  comandas: 'k.v',
  cerrar_mesa: 'o.ch',
  ventas: 'o.ch',
  caja: 'c.v',
  reportes: 'o.ch',
  dashboard: 'o.ch',
  clientes: 'o.ch',
  repartidores: 'd.v',
}

export function featureAllowed(permissions: string[] | null | undefined, feature: RestaurantFeature): boolean {
  if (!permissions || permissions.length === 0) return false
  if (feature === 'ventas' || feature === 'reportes' || feature === 'dashboard') {
    return (
      permissions.includes('o.ch') ||
      permissions.includes('c.v') ||
      permissions.includes('s.m')
    )
  }
  const need = FEATURE_PERM[feature]
  return permissions.includes(need)
}

export function hasPermission(permissions: string[] | null | undefined, perm: string): boolean {
  return !!permissions?.includes(perm)
}

/** Configuración de impresoras locales (comandas, precuenta, documentos) en app nativa. */
export function canConfigureDevicePrinters(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  if (!isNativePrintAvailable()) return false
  if (hasPermission(permissions, 's.m')) return true
  const et = String(employeeType ?? '').toLowerCase()
  if (['waiter', 'mozo', 'cashier', 'cook', 'driver', 'admin', 'supervisor'].includes(et)) {
    return true
  }
  return (
    hasPermission(permissions, 't.o') ||
    hasPermission(permissions, 't.v') ||
    hasPermission(permissions, 'o.c') ||
    hasPermission(permissions, PERM_ORDERS_CHARGE) ||
    hasPermission(permissions, 'k.v') ||
    hasPermission(permissions, 'p.u')
  )
}

/** Pantalla Ajustes: administración del restaurante y/o impresoras del equipo. */
export function canAccessAppSettings(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  return hasPermission(permissions, 's.m') || canConfigureDevicePrinters(permissions, employeeType)
}

/** Permiso corto backend: cobrar / generar venta (restaurantperm.OrdersCharge). */
export const PERM_ORDERS_CHARGE = 'o.ch'

/** Anular comandas o ítems (restaurantperm.OrdersCancel; requiere PIN en API). */
export const PERM_ORDERS_CANCEL = 'o.cx'

const CANCEL_ORDER_EMPLOYEE_TYPES = new Set(['admin', 'supervisor', 'cashier', 'cajero', 'vendedor'])

/** Puede anular comandas o pedidos (cajero, admin, supervisor o quien tenga o.cx / s.m). */
export function canCancelComanda(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  const et = String(employeeType ?? '').toLowerCase()
  if (CANCEL_ORDER_EMPLOYEE_TYPES.has(et)) return true
  return (
    hasPermission(permissions, PERM_ORDERS_CANCEL) ||
    hasPermission(permissions, 's.m')
  )
}

/** Alias semántico: anular pedido completo usa los mismos permisos que anular comanda. */
export function canCancelOrder(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  return canCancelComanda(permissions, employeeType)
}

/** Descuento en cobro: mismo criterio que generar venta (no usa roles del panel tenant). */
export function canApplyCheckoutDiscount(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  const et = String(employeeType ?? '').toLowerCase()
  if (et === 'admin' || et === 'supervisor') return true
  return hasPermission(permissions, PERM_ORDERS_CHARGE)
}

/** Cuentas y métodos de pago del restaurante (crear/editar/eliminar). */
export function canManageCashSettings(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  if (hasPermission(permissions, 's.m')) return true
  const et = String(employeeType ?? '').toLowerCase()
  return et === 'admin' || et === 'supervisor'
}

/** Ver saldos de cuentas bancarias/billeteras en Caja → Cuentas y métodos. */
export function canViewBankAccountBalances(employeeType?: string | null): boolean {
  return String(employeeType ?? '').toLowerCase() === 'admin'
}

/** Ver configuración global de caja (cajero: solo lectura). */
export function canViewCashSettings(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  return canManageCashSettings(permissions, employeeType) || hasPermission(permissions, 'c.v')
}

/** Sección Reportes del panel restaurante (admin, supervisor, cajero con c.v u o.ch). */
export function canViewRestaurantReports(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  if (hasPermission(permissions, 's.m')) return true
  const et = String(employeeType ?? '').toLowerCase()
  if (et === 'admin' || et === 'supervisor') return true
  return hasPermission(permissions, 'o.ch') || hasPermission(permissions, 'c.v')
}

/** Historial y reportes de todas las sesiones de la sucursal. */
export function canViewAllCashSessions(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): boolean {
  return canManageCashSettings(permissions, employeeType)
}

/** Ruta inicial tras login según rol restaurante y permisos efectivos. */
export function defaultRouteForPermissions(
  permissions: string[] | null | undefined,
  employeeType?: string | null,
): string {
  const et = String(employeeType ?? '').toLowerCase()
  const isAdminLike =
    hasPermission(permissions, 's.m') || et === 'admin' || et === 'supervisor'

  if (isAdminLike && featureAllowed(permissions, 'dashboard')) {
    return '/dashboard'
  }

  // Orden por rol operativo típico (primer vista accesible gana).
  const orderByRole: Record<string, RestaurantFeature[]> = {
    cook: ['comandas'],
    cocinero: ['comandas'],
    waiter: ['salas', 'mesa', 'comandas', 'pos'],
    mozo: ['salas', 'mesa', 'comandas', 'pos'],
    cashier: ['pos', 'ventas', 'caja', 'salas', 'comandas'],
    cajero: ['pos', 'ventas', 'caja', 'salas', 'comandas'],
    vendedor: ['pos', 'ventas', 'caja', 'salas', 'comandas'],
    driver: ['repartidores', 'comandas'],
  }

  const roleFeatures = orderByRole[et]
  if (roleFeatures) {
    for (const feature of roleFeatures) {
      if (featureAllowed(permissions, feature)) {
        return featureToRoute(feature)
      }
    }
  }

  const fallback: { feature: RestaurantFeature; route: string }[] = [
    { feature: 'pos', route: '/pos' },
    { feature: 'salas', route: '/salas' },
    { feature: 'comandas', route: '/comandas' },
    { feature: 'dashboard', route: '/dashboard' },
    { feature: 'ventas', route: '/ventas' },
    { feature: 'caja', route: '/caja' },
    { feature: 'reportes', route: '/reportes' },
    { feature: 'productos', route: '/productos' },
    { feature: 'clientes', route: '/clientes' },
    { feature: 'repartidores', route: '/repartidores' },
    { feature: 'mesas', route: '/mesas' },
  ]
  for (const { feature, route } of fallback) {
    if (featureAllowed(permissions, feature)) return route
  }
  return '/comandas'
}

function featureToRoute(feature: RestaurantFeature): string {
  const map: Record<RestaurantFeature, string> = {
    productos: '/productos',
    modificadores: '/modificadores',
    mesas: '/mesas',
    pos: '/pos',
    salas: '/salas',
    mesa: '/salas',
    comandas: '/comandas',
    cerrar_mesa: '/salas',
    ventas: '/ventas',
    caja: '/caja',
    reportes: '/reportes',
    dashboard: '/dashboard',
    clientes: '/clientes',
    repartidores: '/repartidores',
  }
  return map[feature] ?? '/comandas'
}

export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
  waiter: 'Mozo',
  cook: 'Cocinero',
  driver: 'Repartidor',
}
