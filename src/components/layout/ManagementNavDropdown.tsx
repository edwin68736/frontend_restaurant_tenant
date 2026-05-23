import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { clsx } from 'clsx'
import type { NavItem } from '@/config/restaurantNav'

type Props = {
  items: NavItem[]
  compact?: boolean
}

export default function ManagementNavDropdown({ items, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  const isActive = items.some((item) => pathname.startsWith(item.to))

  const updateMenuPosition = () => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const menuWidth = 208
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))
    setMenuPos({ top: rect.bottom + 8, left })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-management-nav-menu]')) setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (items.length === 0) return null

  const menu =
    open && menuPos
      ? createPortal(
          <div
            data-management-nav-menu
            className="fixed z-[200] min-w-[200px] max-w-[min(100vw-1rem,16rem)] rounded-xl border border-stone-200 bg-white shadow-xl ring-1 ring-black/5 py-1.5"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive: active }) =>
                    clsx(
                      'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors mx-1 rounded-lg',
                      active ? 'bg-stone-100 text-stone-900 font-semibold' : 'text-stone-700 hover:bg-stone-50',
                    )
                  }
                  role="menuitem"
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0 text-stone-500" />
                  {item.label}
                </NavLink>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 font-medium transition-all whitespace-nowrap',
          compact ? 'rounded-lg px-2.5 py-1.5 text-xs' : 'rounded-full px-3.5 py-2 text-sm',
          isActive
            ? 'bg-stone-800 text-white shadow-sm'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200/80 bg-white',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <LayoutGrid size={compact ? 15 : 16} strokeWidth={2} className="shrink-0 opacity-80" />
        <span>Gestión</span>
        <ChevronDown size={14} className={clsx('transition-transform opacity-70', open && 'rotate-180')} />
      </button>
      {menu}
    </div>
  )
}
