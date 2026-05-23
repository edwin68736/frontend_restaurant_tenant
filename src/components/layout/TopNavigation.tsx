import { NavLink } from 'react-router-dom'
import type { NavGroup, NavItem } from '@/config/restaurantNav'
import { navPillClasses } from '@/utils/restaurantUiColors'
import ManagementNavDropdown from './ManagementNavDropdown'

type Props = {
  groups: NavGroup[]
  variant?: 'desktop' | 'mobile-scroll'
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

function splitGroups(groups: NavGroup[]) {
  const operations = groups.find((g) => g.id === 'operations')?.items ?? []
  const management = groups.find((g) => g.id === 'management')?.items ?? []
  return { operations, management }
}

export default function TopNavigation({ groups, variant = 'desktop' }: Props) {
  const { operations, management } = splitGroups(groups)

  if (variant === 'mobile-scroll') {
    return null
  }

  return (
    <nav className="hidden lg:flex items-center justify-center gap-2 flex-1 min-w-0 px-2" aria-label="Navegación principal">
      {operations.map((item) => (
        <NavPill key={item.to} item={item} />
      ))}
      {management.length > 0 && <ManagementNavDropdown items={management} />}
    </nav>
  )
}
