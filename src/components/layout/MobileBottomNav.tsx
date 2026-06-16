import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NAV_GROUPS } from '@/config/restaurantNav'
import { navBottomTabClasses } from '@/utils/restaurantUiColors'

/** Navegación inferior móvil: POS, Comandas, Mesas (operaciones diarias). */
export default function MobileBottomNav() {
  const { canAccess } = useAuth()

  const items = useMemo(() => {
    const ops = NAV_GROUPS.find((g) => g.id === 'operations')?.items ?? []
    return ops.filter((item) => canAccess(item.feature))
  }, [canAccess])

  if (items.length === 0) return null

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-[110] border-t border-stone-200/90 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-safe"
      aria-label="Navegación principal"
    >
      <div
        className="grid h-14 w-full"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => navBottomTabClasses(item.to, isActive)}
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  <span className="truncate max-w-full px-0.5">{item.shortLabel ?? item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
