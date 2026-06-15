import { useEffect, useState } from 'react'

/** Altura del menú inferior móvil (h-14) + safe area. */
const MOBILE_BOTTOM_NAV_OFFSET = 'calc(3.5rem + env(safe-area-inset-bottom, 0px))'
import { Outlet, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import RestaurantHeader from '@/components/layout/RestaurantHeader'
import RestaurantSidebar, {
  readRestaurantSidebarCollapsed,
  writeRestaurantSidebarCollapsed,
} from '@/components/layout/RestaurantSidebar'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import { CashSessionOpenModal } from '@/components/CashSessionOpenModal'
import { BackendOfflineOverlay } from '@/components/layout/BackendOfflineOverlay'
import { BRAND_TOP_BAR } from '@/config/branding'
import { isPosFullBleedRoute } from '@/utils/posFullBleedRoute'

/**
 * Layout Tukichef: barra decorativa solo en pantallas grandes (lg+); sidebar colapsable como Tukifac.
 */
export default function RestaurantLayout() {
  const { pathname } = useLocation()
  const fullBleedMobile = isPosFullBleedRoute(pathname)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readRestaurantSidebarCollapsed)

  useEffect(() => {
    writeRestaurantSidebarCollapsed(sidebarCollapsed)
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-stone-50 lg:bg-green-700/90">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 hidden h-14 shrink-0 lg:block"
        aria-hidden
      >
        <img
          src={BRAND_TOP_BAR}
          alt=""
          className="h-full w-full object-cover object-center"
          decoding="async"
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-50 pt-safe lg:pt-0 lg:mt-6 lg:rounded-t-3xl lg:shadow-[0_-4px_20px_rgba(15,23,42,0.1)]">
        <div className="flex h-full min-h-0 w-full overflow-hidden">
          {sidebarOpen ? (
            <div
              className="fixed inset-x-0 top-0 z-[104] bg-stone-900/50 lg:hidden"
              style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          ) : null}

          <div
            className={clsx(
              'hidden h-full min-h-0 shrink-0 lg:flex lg:p-2',
              sidebarCollapsed ? 'lg:w-[5.5rem]' : 'lg:w-72',
            )}
          >
            <div className="h-full min-h-0 w-full overflow-hidden">
              <RestaurantSidebar embedded collapsed={sidebarCollapsed} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>

          {sidebarOpen ? (
            <div
              className="fixed left-0 top-0 z-[105] w-[min(80vw,17rem)] pt-safe pl-safe lg:hidden"
              style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
            >
              <RestaurantSidebar onClose={() => setSidebarOpen(false)} />
            </div>
          ) : null}

          <div
            className={clsx(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-safe lg:gap-2 lg:pb-2',
              fullBleedMobile ? 'gap-0 px-0 pt-0 lg:px-2 lg:pt-2' : 'gap-2 px-2 pt-2 sm:px-3 lg:px-2 lg:pt-2',
            )}
          >
            <div
              className={clsx(
                'relative z-[100] shrink-0 overflow-visible bg-white',
                fullBleedMobile
                  ? 'rounded-none border-0 border-b border-stone-100 shadow-none lg:rounded-2xl lg:border lg:border-stone-100 lg:shadow-md'
                  : 'rounded-2xl border border-stone-100 shadow-md',
              )}
            >
              <RestaurantHeader
                onMenuClick={() => setSidebarOpen(true)}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
              />
            </div>
            <CashSessionOpenModal />
            <BackendOfflineOverlay />
            <main
              className={clsx(
                'flex min-h-0 flex-1 flex-col overflow-hidden bg-white',
                fullBleedMobile
                  ? 'rounded-none border-0 shadow-none lg:rounded-2xl lg:border lg:border-stone-100 lg:shadow-md'
                  : 'rounded-2xl border border-stone-100 shadow-md',
              )}
            >
              <div
                className={clsx(
                  'flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-mobile-nav',
                  fullBleedMobile
                    ? 'px-0 py-0 lg:px-5 lg:py-3 lg:pb-3'
                    : 'px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 lg:pb-3',
                )}
              >
                <Outlet />
              </div>
            </main>
            <MobileBottomNav />
          </div>
        </div>
      </div>
    </div>
  )
}
