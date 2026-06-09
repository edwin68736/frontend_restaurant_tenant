import { useMemo } from 'react'
import { clsx } from 'clsx'
import { Menu, PanelLeft, PanelLeftClose } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NAV_GROUPS } from '@/config/restaurantNav'
import { canAccessAppSettings } from '@/utils/restaurantPermissions'
import TopNavigation from './TopNavigation'
import UserDropdown from './UserDropdown'
import CashSessionBadge from './CashSessionBadge'
import SubscriptionHeaderBadge from './SubscriptionHeaderBadge'
import { useTenantDisplay } from '@/hooks/useTenantDisplay'

type Props = {
  onMenuClick: () => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

const SIDEBAR_TOGGLE_CLASS =
  'inline-flex items-center justify-center text-rest-600 hover:bg-rest-50 hover:text-rest-700 transition-colors shrink-0 touch-manipulation'

export default function RestaurantHeader({ onMenuClick, sidebarCollapsed, onToggleSidebar }: Props) {
  const { canAccess, restaurantPermissions, employeeType } = useAuth()
  const { title: tenantTitle, ruc: tenantRuc } = useTenantDisplay()
  /** Móvil/tablet (<lg): sin sidebar fijo. Desktop: solo con sidebar mini. */
  const showTenantOnDesktop = sidebarCollapsed

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((item) => canAccess(item.feature)),
      })).filter((g) => g.items.length > 0),
    [canAccess],
  )

  const hasSidebarNav =
    visibleGroups.some((g) => g.id !== 'operations' && g.items.length > 0) ||
    canAccessAppSettings(restaurantPermissions, employeeType)

  const operations = visibleGroups.find((g) => g.id === 'operations')?.items ?? []

  return (
    <header className="relative flex shrink-0 items-center min-h-[3.25rem] lg:min-h-[3rem] xl:min-h-[3.25rem] w-full rounded-2xl bg-white pl-0 pr-2 sm:pr-3 lg:pr-2 xl:pr-3">
      <div className="flex shrink-0 items-stretch self-stretch">
        {hasSidebarNav ? (
          <button
            type="button"
            onClick={onMenuClick}
            className={`lg:hidden min-h-[3.25rem] min-w-[44px] px-2.5 rounded-l-2xl ${SIDEBAR_TOGGLE_CLASS}`}
            aria-label="Abrir menú lateral"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
        ) : null}

        {hasSidebarNav ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`hidden lg:inline-flex min-h-[3rem] xl:min-h-[3.25rem] px-2 lg:px-2 xl:px-2.5 rounded-l-2xl ${SIDEBAR_TOGGLE_CLASS}`}
            title={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {sidebarCollapsed ? <PanelLeft size={20} strokeWidth={2} /> : <PanelLeftClose size={20} strokeWidth={2} />}
          </button>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 lg:gap-1.5 xl:gap-2.5 min-w-0 flex-1 lg:flex-none py-1.5 lg:py-1 xl:py-1.5 pl-1 pr-1 sm:pr-2 lg:pr-1 xl:pr-2 overflow-hidden">
        <div
          className={clsx(
            'min-w-0 flex-col justify-center shrink-0 max-w-[38%] sm:max-w-[9rem] lg:max-w-[7.5rem] xl:max-w-[14rem]',
            showTenantOnDesktop ? 'flex' : 'flex lg:hidden',
          )}
        >
          <p className="text-xs sm:text-sm lg:text-xs xl:text-sm font-bold text-stone-900 leading-tight truncate">{tenantTitle}</p>
          {tenantRuc ? (
            <p className="hidden xl:block text-[10px] sm:text-xs text-stone-500 leading-tight truncate font-mono tabular-nums">
              RUC {tenantRuc}
            </p>
          ) : null}
        </div>
        <div className="flex flex-1 justify-center min-w-0 px-0.5 lg:hidden">
          <CashSessionBadge compact />
        </div>
        <span
          className={clsx(
            'w-px h-7 sm:h-8 lg:h-6 xl:h-8 bg-stone-200 shrink-0',
            showTenantOnDesktop ? 'block' : 'hidden lg:block',
          )}
          aria-hidden
        />
        <SubscriptionHeaderBadge />
      </div>

      {operations.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 hidden lg:flex items-center justify-center">
          <TopNavigation groups={visibleGroups} variant="desktop" className="pointer-events-auto" />
        </div>
      ) : null}

      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 lg:gap-1 xl:gap-2 ml-auto shrink-0 py-1.5 lg:py-1 xl:py-1.5 pl-2 lg:pl-1 xl:pl-2">
        <CashSessionBadge />
        <UserDropdown />
      </div>
    </header>
  )
}
