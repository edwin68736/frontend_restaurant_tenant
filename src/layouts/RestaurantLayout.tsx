import { Outlet } from 'react-router-dom'
import RestaurantHeader from '@/components/layout/RestaurantHeader'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import { CashSessionOpenModal } from '@/components/CashSessionOpenModal'
import { BackendOfflineOverlay } from '@/components/layout/BackendOfflineOverlay'
import { BRAND_TOP_BAR } from '@/config/branding'

/**
 * Layout Tukichef: barra decorativa solo en pantallas grandes (lg+); móvil sin barra para ganar altura.
 */
export default function RestaurantLayout() {
  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-stone-50 lg:bg-green-700/90">
      {/* Barra horizontal: solo desktop / tablet horizontal grande */}
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

      {/* Panel: sin margen superior en móvil; con barra decorativa en lg+ */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-50 pt-safe lg:pt-0 lg:mt-6 lg:rounded-t-3xl lg:shadow-[0_-4px_20px_rgba(15,23,42,0.1)]">
        <RestaurantHeader />
        <CashSessionOpenModal />
        <BackendOfflineOverlay />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-auto px-3 py-2.5 pb-[calc(3.5rem+var(--safe-bottom))] sm:px-4 sm:py-3 lg:px-5 lg:pb-3">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
