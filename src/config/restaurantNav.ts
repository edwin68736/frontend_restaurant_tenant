import type { LucideIcon } from 'lucide-react'
import {
  UtensilsCrossed,
  LayoutGrid,
  Receipt,
  Layers,
  ChefHat,
  FileText,
  Users,
  Wallet,
  Bike,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react'

export type NavFeature =
  | 'productos'
  | 'modificadores'
  | 'mesas'
  | 'pos'
  | 'salas'
  | 'mesa'
  | 'comandas'
  | 'ventas'
  | 'caja'
  | 'reportes'
  | 'dashboard'
  | 'clientes'
  | 'repartidores'

export type NavItem = {
  to: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  feature: NavFeature
  /** Destacar en operación diaria (POS, cocina, mesas) */
  emphasis?: boolean
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operaciones',
    items: [
      { to: '/pos', label: 'POS', icon: Receipt, feature: 'pos', emphasis: true },
      { to: '/salas', label: 'Mesas', icon: LayoutGrid, feature: 'salas', emphasis: true },
      { to: '/comandas', label: 'Comandas', icon: ChefHat, feature: 'comandas', emphasis: true },
    ],
  },
  {
    id: 'management',
    label: 'Gestión',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
      { to: '/productos', label: 'Productos', icon: UtensilsCrossed, feature: 'productos' },
      { to: '/mesas', label: 'Configurar mesas', icon: Layers, feature: 'mesas' },
      { to: '/clientes', label: 'Clientes', icon: Users, feature: 'clientes' },
      { to: '/repartidores', label: 'Repartidores', icon: Bike, feature: 'repartidores' },
      { to: '/ventas', label: 'Ventas', icon: FileText, feature: 'ventas' },
      { to: '/caja', label: 'Caja', icon: Wallet, feature: 'caja' },
      { to: '/reportes', label: 'Reportes', icon: BarChart3, feature: 'reportes' },
    ],
  },
]

export function flattenNavItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items)
}
