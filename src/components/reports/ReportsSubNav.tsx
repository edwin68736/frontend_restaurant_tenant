import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { useFeatures } from '@/contexts/FeatureContext'
import { RESTAURANT_REPORTS_NAV } from '@/reports/registry'

export function ReportsSubNav() {
  const { hasFeature } = useFeatures()
  const items = RESTAURANT_REPORTS_NAV.filter((item) => !item.feature || hasFeature(item.feature))
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // En pantallas angostas las pestañas se deslizan: la activa queda a la vista.
  useEffect(() => {
    const nav = ref.current
    const active = nav?.querySelector('[aria-current="page"]')
    if (!nav || !active) return
    const n = nav.getBoundingClientRect()
    const a = active.getBoundingClientRect()
    nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2
  }, [pathname, items.length])

  return (
    <nav
      ref={ref}
      className="flex w-full items-center gap-1.5 overflow-x-auto flex-nowrap lg:flex-wrap pb-0.5 -mx-0.5 px-0.5 lg:mx-0 lg:px-0 scrollbar-thin"
      aria-label="Tipos de reporte"
    >
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={`/reportes/${item.path}`}
          className={({ isActive }) =>
            clsx(
              'px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'bg-rest-600 text-white shadow-sm'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50',
            )
          }
        >
          {item.title}
        </NavLink>
      ))}
    </nav>
  )
}
