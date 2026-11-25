import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { PortalModal } from '@/components/ui/PortalModal'

type Props = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** Ventana de insumos: cabecera y pie fijos, cuerpo con desplazamiento (celulares y pantallas bajas). */
export function SupplyModalShell({ title, subtitle, onClose, children, footer, wide }: Props) {
  return (
    <PortalModal open onClose={onClose} className={wide ? 'max-w-2xl' : 'max-w-lg'}>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-stone-800">{title}</h2>
            {subtitle && <p className="truncate text-xs text-stone-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>
        <div className={clsx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3')}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-100 px-4 py-3">{footer}</div>}
      </div>
    </PortalModal>
  )
}

export const SUPPLY_INPUT = 'w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rest-500 disabled:bg-stone-100 disabled:text-stone-500'
export const SUPPLY_LABEL = 'mb-1 block text-xs font-medium text-stone-600'
export const SUPPLY_BTN_PRIMARY = 'rounded-xl bg-rest-600 px-4 py-2 text-sm font-medium text-white hover:bg-rest-700 disabled:opacity-50'
export const SUPPLY_BTN_GHOST = 'rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50'
