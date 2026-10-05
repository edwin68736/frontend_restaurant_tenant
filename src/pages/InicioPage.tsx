import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  MapPin,
  Printer,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { MiTurnoBlock } from '@/components/inicio/MiTurnoBlock'
import { ResumenHoyBlock, showsResumenHoy } from '@/components/inicio/ResumenHoyBlock'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { NAV_GROUPS, flattenNavItems } from '@/config/restaurantNav'
import { getConfiguredPrinter, isNativePrintAvailable } from '@/services/printers.service'
import { canAccessAppSettings, EMPLOYEE_TYPE_LABELS } from '@/utils/restaurantPermissions'

type RoleGroup = 'admin' | 'cashier' | 'waiter' | 'cook' | 'driver' | 'other'

function roleGroupOf(employeeType: string, isAdmin: boolean): RoleGroup {
  const et = employeeType.toLowerCase()
  if (isAdmin || et === 'admin' || et === 'supervisor') return 'admin'
  if (et === 'cashier' || et === 'cajero' || et === 'vendedor') return 'cashier'
  if (et === 'waiter' || et === 'mozo') return 'waiter'
  if (et === 'cook' || et === 'cocinero') return 'cook'
  if (et === 'driver') return 'driver'
  return 'other'
}

/** Orden de los accesos por rol: los primeros son las tareas del día y salen destacados. */
const ORDER: Record<RoleGroup, string[]> = {
  admin: ['/dashboard', '/pos', '/salas', '/comandas', '/ventas', '/caja', '/reportes', '/productos', '/clientes', '/repartidores', '/mesas'],
  cashier: ['/pos', '/caja', '/ventas', '/salas', '/comandas', '/clientes'],
  waiter: ['/salas', '/comandas', '/pos'],
  cook: ['/comandas'],
  driver: ['/repartidores', '/comandas'],
  other: ['/pos', '/salas', '/comandas', '/ventas', '/caja', '/dashboard', '/reportes', '/productos', '/clientes', '/repartidores', '/mesas'],
}

const DESCRIPTION: Record<string, string> = {
  '/pos': 'Cobrar y registrar ventas',
  '/salas': 'Mesas y pedidos en sala',
  '/comandas': 'Pedidos para cocina y barra',
  '/dashboard': 'Métricas de la sucursal',
  '/ventas': 'Comprobantes y ventas del día',
  '/caja': 'Abrir y cerrar turno, movimientos',
  '/reportes': 'Reportes de ventas y operación',
  '/productos': 'Carta, precios y stock',
  '/clientes': 'Directorio de clientes',
  '/repartidores': 'Pedidos para delivery',
  '/mesas': 'Configurar salas y mesas',
  '/ajustes': 'Impresoras y configuración',
}

const ACCENT: Record<string, string> = {
  '/pos': 'from-green-500 to-emerald-600',
  '/salas': 'from-teal-500 to-cyan-600',
  '/comandas': 'from-orange-500 to-amber-600',
  '/dashboard': 'from-indigo-500 to-violet-600',
  '/ventas': 'from-sky-500 to-blue-600',
  '/caja': 'from-teal-500 to-emerald-600',
  '/reportes': 'from-fuchsia-500 to-purple-600',
  '/productos': 'from-rose-500 to-pink-600',
  '/clientes': 'from-blue-500 to-indigo-600',
  '/repartidores': 'from-violet-500 to-purple-600',
  '/mesas': 'from-stone-500 to-stone-700',
  '/ajustes': 'from-stone-500 to-stone-700',
}

type Card = { to: string; label: string; description: string; icon: LucideIcon; accent: string }

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

export default function InicioPage() {
  const { user, employeeType, restaurantPermissions, canAccess, hasPerm } = useAuth()
  const { activeBranch } = useBranch()
  const { session, loading: cashLoading, canOperateCash, setOpenModal } = useCashSession()
  const { hub } = useSubscriptionStatus()

  const isAdmin = hasPerm('s.m')
  const group = roleGroupOf(employeeType, isAdmin)
  const roleLabel = EMPLOYEE_TYPE_LABELS[employeeType.toLowerCase()] ?? (isAdmin ? 'Administrador' : 'Usuario')

  const cards = useMemo<Card[]>(() => {
    const byPath = new Map(flattenNavItems(NAV_GROUPS).map((i) => [i.to, i]))
    const out: Card[] = []
    for (const to of ORDER[group]) {
      const item = byPath.get(to)
      if (!item || !canAccess(item.feature)) continue
      out.push({
        to,
        label: to === '/salas' ? 'Mesas' : item.label,
        description: DESCRIPTION[to] ?? '',
        icon: item.icon,
        accent: ACCENT[to] ?? 'from-stone-500 to-stone-700',
      })
    }
    if (canAccessAppSettings(restaurantPermissions, employeeType)) {
      out.push({ to: '/ajustes', label: 'Ajustes', description: DESCRIPTION['/ajustes'], icon: Settings, accent: ACCENT['/ajustes'] })
    }
    return out
  }, [group, canAccess, restaurantPermissions, employeeType])

  const featured = cards.slice(0, 3)
  const more = cards.slice(3)

  // Avisos accionables (solo los que aplican a este usuario).
  const alerts: { key: string; tone: 'warn' | 'danger'; icon: LucideIcon; text: string; action?: { label: string; onClick?: () => void; to?: string } }[] = []
  if (canOperateCash && !cashLoading && !session) {
    alerts.push({
      key: 'cash',
      tone: 'warn',
      icon: Wallet,
      text: 'No tienes una caja abierta. Ábrela para poder cobrar.',
      action: { label: 'Abrir caja', onClick: () => setOpenModal(true) },
    })
  }
  if (isNativePrintAvailable() && !getConfiguredPrinter('documentos') && canAccessAppSettings(restaurantPermissions, employeeType)) {
    alerts.push({
      key: 'printer',
      tone: 'warn',
      icon: Printer,
      text: 'La impresora de comprobantes no está configurada en este equipo.',
      action: { label: 'Configurar', to: '/ajustes' },
    })
  }
  const banner = hub?.status_banner
  if (isAdmin && banner && (banner.variant === 'warning' || banner.variant === 'danger') && banner.message) {
    alerts.push({
      key: 'plan',
      tone: banner.variant === 'danger' ? 'danger' : 'warn',
      icon: CreditCard,
      text: banner.message,
      action: { label: 'Ver suscripción', to: '/suscripcion' },
    })
  }

  const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  const openedAt = session?.opened_at
    ? new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <PageShell title="Inicio" fill={false}>
      <div className="space-y-4 pb-6 w-full">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <p className="text-xs sm:text-sm text-stone-500 capitalize flex items-center gap-1.5">
            <CalendarDays size={14} className="shrink-0" />
            {today}
          </p>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {greeting()}
            {firstName(user?.name) ? `, ${firstName(user?.name)}` : ''}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full bg-rest-50 text-rest-700 border border-rest-100 px-2.5 py-1 font-medium">{roleLabel}</span>
            {activeBranch ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-700 px-2.5 py-1">
                <MapPin size={13} className="shrink-0" />
                {activeBranch.name}
              </span>
            ) : null}
            {canOperateCash && !cashLoading ? (
              session ? (
                <Link
                  to="/caja"
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 font-medium hover:bg-teal-100"
                >
                  <Wallet size={13} className="shrink-0" />
                  Caja abierta{openedAt ? ` desde las ${openedAt}` : ''}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-1 font-medium">
                  <Wallet size={13} className="shrink-0" />
                  Sin caja abierta
                </span>
              )
            ) : null}
          </div>
        </section>

        {alerts.length > 0 ? (
          <section className="space-y-2" aria-label="Avisos">
            {alerts.map((a) => {
              const Icon = a.icon
              return (
                <div
                  key={a.key}
                  className={clsx(
                    'flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3 text-sm',
                    a.tone === 'danger'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}
                >
                  <AlertTriangle size={16} className="shrink-0" aria-hidden />
                  <Icon size={16} className="shrink-0 opacity-70" aria-hidden />
                  <p className="min-w-0 flex-1">{a.text}</p>
                  {a.action?.to ? (
                    <Link to={a.action.to} className="shrink-0 rounded-lg bg-white/80 border border-current/20 px-3 py-1.5 text-xs font-semibold hover:bg-white">
                      {a.action.label}
                    </Link>
                  ) : a.action ? (
                    <button type="button" onClick={a.action.onClick} className="shrink-0 rounded-lg bg-white/80 border border-current/20 px-3 py-1.5 text-xs font-semibold hover:bg-white">
                      {a.action.label}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </section>
        ) : null}

        <MiTurnoBlock role={group} />

        {showsResumenHoy(group) ? <ResumenHoyBlock role={group} /> : null}

        {featured.length > 0 ? (
          <section aria-label="Accesos principales">
            {/* Columnas según cuántas hay: con 3 en 2 columnas la última quedaba sola y con hueco. */}
            <div
              className={clsx(
                'grid grid-cols-1 gap-3',
                featured.length >= 3 ? 'sm:grid-cols-3' : featured.length === 2 ? 'sm:grid-cols-2' : '',
              )}
            >
              {featured.map((c) => {
                const Icon = c.icon
                return (
                  <Link
                    key={c.to}
                    to={c.to}
                    className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all touch-manipulation min-h-[5.5rem]"
                  >
                    <span className={clsx('flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white', c.accent)}>
                      <Icon size={26} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base sm:text-lg font-bold text-stone-900">{c.label}</span>
                      <span className="block text-xs sm:text-sm text-stone-500 leading-snug">{c.description}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {more.length > 0 ? (
          <section aria-label="Más accesos">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Más accesos</h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2.5">
              {more.map((c) => {
                const Icon = c.icon
                return (
                  <Link
                    key={c.to}
                    to={c.to}
                    className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-3 hover:bg-stone-50 hover:border-stone-300 transition-colors touch-manipulation"
                  >
                    <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white', c.accent)}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-stone-800 truncate">{c.label}</span>
                      <span className="block text-[11px] text-stone-500 leading-tight line-clamp-2">{c.description}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  )
}
