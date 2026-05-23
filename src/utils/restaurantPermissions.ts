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
  clientes: 'o.ch',
  repartidores: 'd.v',
}

export function featureAllowed(permissions: string[] | null | undefined, feature: RestaurantFeature): boolean {
  if (!permissions || permissions.length === 0) return false
  const need = FEATURE_PERM[feature]
  return permissions.includes(need)
}

export function hasPermission(permissions: string[] | null | undefined, perm: string): boolean {
  return !!permissions?.includes(perm)
}

export function defaultRouteForPermissions(permissions: string[] | null | undefined): string {
  const order: { feature: RestaurantFeature; route: string }[] = [
    { feature: 'pos', route: '/pos' },
    { feature: 'salas', route: '/salas' },
    { feature: 'comandas', route: '/comandas' },
    { feature: 'ventas', route: '/ventas' },
    { feature: 'caja', route: '/caja' },
    { feature: 'clientes', route: '/clientes' },
  ]
  for (const { feature, route } of order) {
    if (featureAllowed(permissions, feature)) return route
  }
  return '/comandas'
}

export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
  waiter: 'Mozo',
  cook: 'Cocinero',
  driver: 'Repartidor',
}
