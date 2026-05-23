import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import type { NavGroup, NavItem } from '@/config/restaurantNav'
import { navSheetLinkClasses } from '@/utils/restaurantUiColors'
import SubscriptionSidebarCard from './SubscriptionSidebarCard'

type Props = {
  open: boolean
  onClose: () => void
  groups: NavGroup[]
}

function SheetLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      className={({ isActive }) => navSheetLinkClasses(item.to, isActive)}
    >
      <Icon size={20} strokeWidth={2} />
      {item.label}
    </NavLink>
  )
}

export default function ResponsiveMenu({ open, onClose, groups }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[300] bg-stone-900/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-[301] flex w-[min(100%,320px)] flex-col bg-white shadow-2xl lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        <div className="flex h-14 items-center justify-between border-b border-stone-100 px-4">
          <span className="font-semibold text-stone-800">Menú</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <SubscriptionSidebarCard onNavigate={onClose} />
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SheetLink key={item.to} item={item} onClose={onClose} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>,
    document.body,
  )
}
