import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { RESTAURANT_REPORTS_NAV } from '@/reports/registry'

export function ReportsSubNav() {
  return (
    <nav className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Tipos de reporte">
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
