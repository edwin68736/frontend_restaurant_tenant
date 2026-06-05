import { NavLink } from 'react-router-dom'
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
      <Icon size={compact ? 15 : 16} strokeWidth={2} className="shrink-0 opacity-90" />
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
      className={`hidden lg:flex items-center justify-center gap-2 min-w-0 ${className}`}
      aria-label="Navegación principal"
    >
      {operations.map((item) => (
        <NavPill key={item.to} item={item} />
      ))}
    </nav>
  )
}
