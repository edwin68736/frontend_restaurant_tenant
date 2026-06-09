import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import type { NavGroup, NavItem } from '@/config/restaurantNav'
import { navPillClasses } from '@/utils/restaurantUiColors'
type Props = {
  groups: NavGroup[]
  variant?: 'desktop' | 'mobile-scroll'
  className?: string
}

function NavPill({ item, compact }: { item: NavItem; compact?: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => navPillClasses(item.to, isActive, compact)}
      title={item.label}
    >
      <Icon
        size={compact ? 15 : 16}
        strokeWidth={2}
        className={clsx('shrink-0 opacity-90', !compact && 'lg:w-3.5 lg:h-3.5 xl:w-4 xl:h-4')}
      />
      <span>{compact ? item.shortLabel ?? item.label : item.label}</span>
    </NavLink>
  )
}

export default function TopNavigation({ groups, variant = 'desktop', className = '' }: Props) {
  const operations = groups.find((g) => g.id === 'operations')?.items ?? []

  if (variant === 'mobile-scroll') {
    return null
  }

  return (
    <nav
      className={clsx('hidden lg:flex items-center justify-center gap-1 xl:gap-2 min-w-0', className)}
      aria-label="Navegación principal"
    >
      {operations.map((item) => (
        <NavPill key={item.to} item={item} />
      ))}
    </nav>
  )
}
