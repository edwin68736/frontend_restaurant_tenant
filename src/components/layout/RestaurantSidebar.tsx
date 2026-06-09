import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Settings, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantDisplay } from '@/hooks/useTenantDisplay'
import { NAV_GROUPS, type NavGroup, type NavItem } from '@/config/restaurantNav'
import { canAccessAppSettings } from '@/utils/restaurantPermissions'
import { BRAND_LOGO } from '@/config/branding'
import BrandWordmark from './BrandWordmark'
import { isTauriDesktop } from '@/lib/platform/detect'
import SubscriptionSidebarCard from './SubscriptionSidebarCard'
import SidebarTutorialsLink from './SidebarTutorialsLink'

const STORAGE_KEY = 'restaurant_sidebar_collapsed'

type Props = {
  onClose: () => void
  /** Desktop: sidebar en el flujo del layout (no fixed). */
  embedded?: boolean
  collapsed?: boolean
}

function pathActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

function navEntryClasses(isActive: boolean, mini: boolean) {
  if (mini) {
    return clsx(
      'flex items-center gap-2.5 rounded-xl font-medium transition-colors min-w-0 touch-manipulation justify-center px-2 py-2.5',
      isActive ? 'bg-white text-rest-700 shadow-sm' : 'text-white/90 hover:bg-white/15 hover:text-white',
    )
  }
  return clsx(
    'flex items-center gap-2.5 rounded-xl font-medium transition-colors min-w-0 touch-manipulation px-3 py-2.5 text-sm',
    isActive ? 'bg-rest-600 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
  )
}

function NavEntry({
  item,
  collapsed,
  onClose,
  mini,
}: {
  item: NavItem
  collapsed: boolean
  onClose: () => void
  mini?: boolean
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      title={item.label}
      className={({ isActive }) => navEntryClasses(isActive, !!mini)}
    >
      <Icon size={collapsed ? 20 : 18} strokeWidth={2} className="shrink-0" />
      {!collapsed ? <span className="truncate min-w-0">{item.label}</span> : null}
    </NavLink>
  )
}

function NavGroupSection({
  group,
  collapsed,
  onClose,
  pathname,
  mini,
}: {
  group: NavGroup
  collapsed: boolean
  onClose: () => void
  pathname: string
  mini?: boolean
}) {
  const hasActive = group.items.some((item) => pathActive(pathname, item.to))

  if (collapsed) {
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavEntry key={item.to} item={item} collapsed mini={mini} onClose={onClose} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <p
        className={clsx(
          'mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider',
          hasActive ? 'text-rest-700' : 'text-stone-400',
        )}
      >
        {group.label}
      </p>
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavEntry key={item.to} item={item} collapsed={false} mini={false} onClose={onClose} />
        ))}
      </div>
    </div>
  )
}

export default function RestaurantSidebar({
  onClose,
  embedded = false,
  collapsed = false,
}: Props) {
  const { canAccess, restaurantPermissions, employeeType } = useAuth()
  const { pathname } = useLocation()
  const { title: tenantTitle, ruc: tenantRuc } = useTenantDisplay()

  const isDesktop = embedded
  const isCollapsed = isDesktop && collapsed
  const isMini = isDesktop && isCollapsed

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((item) => canAccess(item.feature)),
      })).filter((g) => g.items.length > 0),
    [canAccess],
  )

  const sidebarGroups = useMemo(
    () => visibleGroups.filter((g) => g.id !== 'operations'),
    [visibleGroups],
  )

  const showSettings = canAccessAppSettings(restaurantPermissions, employeeType)
  const showPlanInSidebar = !embedded && !isTauriDesktop()

  const sidebarClass = clsx(
    'flex h-full min-h-0 flex-col shadow-lg',
    isDesktop ? 'rounded-2xl border' : 'border-r border-stone-200 bg-white w-full h-full',
    isMini ? 'bg-rest-600 border-rest-700/40' : isDesktop ? 'bg-white border-stone-200' : 'bg-white',
  )

  return (
    <aside className={sidebarClass} aria-label="Menú lateral">
      <div
        className={clsx(
          'relative shrink-0 flex w-full items-center justify-center min-h-[3.25rem]',
          isMini ? 'border-b border-white/15 px-2 py-3' : 'border-b border-stone-100 px-3 py-3',
        )}
      >
        <div className="flex items-center justify-center">
          {isCollapsed ? (
            <img
              src={BRAND_LOGO}
              alt="Tukichef"
              className="h-8 w-8 object-contain rounded-lg bg-white/95 p-0.5"
              decoding="async"
            />
          ) : (
            <BrandWordmark size="sm" className="shrink-0" />
          )}
        </div>
        {!isDesktop ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-500 hover:bg-stone-100 touch-manipulation z-10"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      {!isCollapsed && (tenantTitle || tenantRuc) ? (
        <div className="shrink-0 border-b border-stone-100 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">{tenantTitle}</p>
          {tenantRuc ? (
            <p className="mt-0.5 text-xs text-stone-500 font-mono tabular-nums">RUC {tenantRuc}</p>
          ) : null}
        </div>
      ) : null}

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 py-3 space-y-4">
        {showPlanInSidebar ? <SubscriptionSidebarCard onNavigate={onClose} /> : null}

        <SidebarTutorialsLink
          collapsed={isCollapsed}
          mini={isMini}
          onNavigate={onClose}
        />

        {sidebarGroups.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            collapsed={isCollapsed}
            mini={isMini}
            onClose={onClose}
            pathname={pathname}
          />
        ))}
      </nav>

      {showSettings ? (
        <div
          className={clsx(
            'shrink-0 px-2 py-3',
            isMini ? 'border-t border-white/15' : 'border-t border-stone-100',
            !isDesktop && 'pb-1',
          )}
        >
          {!isCollapsed ? (
            <p
              className={clsx(
                'mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider',
                isMini ? 'text-white/60' : 'text-stone-400',
              )}
            >
              Equipo
            </p>
          ) : null}
          <NavLink
            to="/ajustes"
            onClick={onClose}
            title="Impresoras y ajustes"
            className={({ isActive }) => navEntryClasses(isActive, isMini)}
          >
            <Settings size={isCollapsed ? 20 : 18} strokeWidth={2} className="shrink-0" />
            {!isCollapsed ? (
              <span>{isDesktop ? 'Impresoras y ajustes' : 'Configuración'}</span>
            ) : null}
          </NavLink>
        </div>
      ) : null}
    </aside>
  )
}

export function readRestaurantSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === null) return true
  return stored === '1'
}

export function writeRestaurantSidebarCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
}
