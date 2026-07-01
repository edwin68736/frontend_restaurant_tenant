import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  CreditCard,
  Headphones,
  LogOut,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscriptionService } from '@/services/subscription.service'
import {
  buildSupportWhatsAppHref,
  DEFAULT_SUPPORT_WHATSAPP_MESSAGE,
  openExternalUrl,
} from '@/utils/supportWhatsApp'
import { canAccessAppSettings, EMPLOYEE_TYPE_LABELS } from '@/utils/restaurantPermissions'
import { readSafeInsets } from '@/utils/safeAreaInsets'
import { BranchSelectorMenu } from './RestaurantBranchBadge'
import { AppVersionBadge } from './AppVersionBadge'

const MENU_WIDTH = 224

export default function UserDropdown() {
  const { user, logout, employeeType, restaurantPermissions } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [supportHref, setSupportHref] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const isAdmin = employeeType === 'admin' || employeeType === 'supervisor'
  const showSettings = canAccessAppSettings(restaurantPermissions, employeeType)

  useEffect(() => {
    subscriptionService
      .getHub()
      .then((hub) => setSupportHref(buildSupportWhatsAppHref(hub.support, DEFAULT_SUPPORT_WHATSAPP_MESSAGE)))
      .catch(() => setSupportHref(null))
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    const update = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const { left: safeLeft, right: safeRight } = readSafeInsets()
      const edge = 8
      const left = Math.max(
        safeLeft + edge,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - safeRight - edge),
      )
      setMenuPos({ top: rect.bottom + 8, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (ref.current?.contains(target)) return
      if (target.closest('[data-user-dropdown-menu]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const roleLabel = EMPLOYEE_TYPE_LABELS[employeeType] ?? employeeType

  const menu =
    open && menuPos
      ? createPortal(
          <div
            data-user-dropdown-menu
            className="fixed z-[200] w-56 rounded-xl border border-stone-200 bg-white shadow-xl ring-1 ring-black/5 py-1.5"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            <div className="px-3 py-2.5 border-b border-stone-100 md:hidden">
              <p className="text-sm font-semibold text-stone-800 truncate">{user?.name}</p>
              <p className="text-xs text-stone-500">{roleLabel}</p>
            </div>
            <BranchSelectorMenu onSelected={() => setOpen(false)} />
            {isAdmin && (
              <Link
                to="/suscripcion"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-rest-50 hover:text-rest-800"
                role="menuitem"
              >
                <CreditCard size={16} className="text-rest-600" />
                Suscripción y pagos
              </Link>
            )}
            {showSettings && (
              <Link
                to="/ajustes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                role="menuitem"
              >
                <Settings size={16} className="text-stone-500" />
                {employeeType === 'waiter' || employeeType === 'mozo' ? 'Impresoras' : 'Ajustes'}
              </Link>
            )}
            <a
              href={supportHref ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!supportHref) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                setOpen(false)
                void openExternalUrl(supportHref)
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm ${
                supportHref ? 'text-stone-700 hover:bg-stone-50' : 'text-stone-400 pointer-events-none'
              }`}
              role="menuitem"
              aria-disabled={!supportHref}
            >
              <Headphones size={16} className="text-stone-500" />
              Soporte
            </a>
            <div className="px-3 py-2 border-t border-stone-100">
              <AppVersionBadge compact />
            </div>
            <div className="my-1 border-t border-stone-100" />
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/home')
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 xl:gap-2 pl-0.5 pr-1.5 py-0.5 xl:pl-1 xl:pr-2 xl:py-1 rounded-lg xl:rounded-xl border border-stone-200/80 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-gradient-to-br from-rest-600 to-rest-800 text-white text-[10px] xl:text-xs font-bold flex items-center justify-center shadow-sm">
          {initials}
        </div>
        <div className="hidden md:block lg:hidden xl:block text-left max-w-[120px]">
          <p className="text-xs font-semibold text-stone-800 truncate leading-tight">{user?.name}</p>
          <p className="text-[10px] text-stone-500 truncate leading-tight">{roleLabel}</p>
        </div>
        <ChevronDown
          size={14}
          className={`hidden md:block lg:hidden xl:block text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  )
}
