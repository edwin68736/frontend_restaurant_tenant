import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { RESTAURANT_REPORTS_NAV } from '@/reports/registry'

export function ReportsSubNav() {
  return (
    <nav
      className="flex w-full lg:w-auto items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 -mx-0.5 px-0.5 lg:mx-0 lg:px-0 lg:justify-end scrollbar-thin"
      aria-label="Tipos de reporte"
    >
      {RESTAURANT_REPORTS_NAV.map((item) => (
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
