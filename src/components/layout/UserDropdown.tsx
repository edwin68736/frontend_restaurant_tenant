import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  CreditCard,
  Headphones,
  LogOut,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { EMPLOYEE_TYPE_LABELS } from '@/utils/restaurantPermissions'
import { isNativePrintAvailable } from '@/services/printers.service'
import { BranchSelectorMenu } from './RestaurantBranchBadge'
import { AppVersionBadge } from './AppVersionBadge'

export default function UserDropdown() {
  const { user, logout, employeeType, hasPerm } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isAdmin = employeeType === 'admin' || employeeType === 'supervisor'
  const showSettings = isNativePrintAvailable() || hasPerm('s.m')

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const roleLabel = EMPLOYEE_TYPE_LABELS[employeeType] ?? employeeType

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl border border-stone-200/80 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rest-600 to-rest-800 text-white text-xs font-bold flex items-center justify-center shadow-sm">
          {initials}
        </div>
        <div className="hidden md:block text-left max-w-[120px]">
          <p className="text-xs font-semibold text-stone-800 truncate leading-tight">{user?.name}</p>
          <p className="text-[10px] text-stone-500 truncate leading-tight">{roleLabel}</p>
        </div>
        <ChevronDown size={14} className={`text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-stone-200 bg-white shadow-xl ring-1 ring-black/5 py-1.5 z-[100]"
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
              Ajustes
            </Link>
          )}
          <a
            href="https://wa.me/51999999999"
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
            role="menuitem"
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
        </div>
      )}
    </div>
  )
}
