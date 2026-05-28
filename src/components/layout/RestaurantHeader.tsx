import { useMemo, useState } from 'react'
import { Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getStoredTenant } from '@/services/public.service'
import { BRAND_LOGO } from '@/config/branding'
import { NAV_GROUPS } from '@/config/restaurantNav'
import TopNavigation from './TopNavigation'
import ManagementNavDropdown from './ManagementNavDropdown'
import ResponsiveMenu from './ResponsiveMenu'
import UserDropdown from './UserDropdown'
import CashSessionBadge from './CashSessionBadge'
import SubscriptionHeaderBadge from './SubscriptionHeaderBadge'

export default function RestaurantHeader() {
  const { canAccess } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const tenant = getStoredTenant()

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((item) => canAccess(item.feature)),
      })).filter((g) => g.items.length > 0),
    [canAccess],
  )

  const managementItems = useMemo(
    () => visibleGroups.find((g) => g.id === 'management')?.items ?? [],
    [visibleGroups],
  )

  return (
    <>
      <header className="sticky top-0 z-[100] shrink-0 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-sm shadow-stone-900/5">
        <div className="flex items-center gap-1.5 sm:gap-3 min-h-14 py-1.5 sm:py-0 sm:h-14 px-2 sm:px-4 lg:px-5 w-full">
          {managementItems.length > 0 ? (
            <div className="hidden lg:block shrink-0">
              <ManagementNavDropdown items={managementItems} />
            </div>
          ) : null}
          {/* Marca + empresa (+ plan en lg+) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0 overflow-hidden">
            <img
              src={BRAND_LOGO}
              alt="Tukichef"
              className="h-[clamp(1.375rem,6.5vw,2.5rem)] w-auto max-w-[clamp(3rem,14vw,7.5rem)] object-contain object-left shrink-0"
            />
            <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-none">
              <div className="min-w-0 flex-1 lg:max-w-[min(100%,12rem)] xl:max-w-[14rem]">
                <p className="text-[11px] min-[360px]:text-xs sm:text-sm md:text-base font-bold text-stone-900 leading-tight truncate">
                  {tenant?.name || 'Restaurante'}
                </p>
                {tenant?.ruc ? (
                  <p className="text-[9px] min-[360px]:text-[10px] sm:text-xs text-stone-500 truncate leading-tight">
                    RUC: {tenant.ruc}
                  </p>
                ) : null}
              </div>
              <span className="hidden lg:block w-px h-8 bg-stone-200 shrink-0" aria-hidden />
              <SubscriptionHeaderBadge />
            </div>
          </div>

          {/* Navegación desktop */}
          <TopNavigation groups={visibleGroups} variant="desktop" />

          {/* Derecha */}
          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            <CashSessionBadge />
            <UserDropdown />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition-colors touch-manipulation"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <ResponsiveMenu open={menuOpen} onClose={() => setMenuOpen(false)} groups={visibleGroups} />
    </>
  )
}
