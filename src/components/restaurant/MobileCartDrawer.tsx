import type { ReactNode } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { clsx } from 'clsx'
import { isCapacitorAndroid } from '@/lib/platform/detect'
import { useTabletMobileViewport } from '@/hooks/useTabletMobileViewport'
import {
  DRAWER_BOTTOM_SAFE,
  DRAWER_BOTTOM_SAFE_LG,
  DRAWER_BOTTOM_WRAP_X_LG,
  DRAWER_BOTTOM_WRAP_X_RESP,
  MAX_H_CART_DRAWER_PANEL,
  MAX_H_SHEET_PANEL,
} from '@/utils/safeAreaClasses'

type Props = {
  open: boolean
  onClose: () => void
  quantity: number
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** Ítems pendientes en carrito (sin comandas enviadas). */
  pendingCartCount?: number
  onClearCart?: () => void
}

/** Panel carrito móvil (POS / Mesa). Teléfono Android: compacto; tablet: panel más ancho y alto. */
export function MobileCartDrawer({
  open,
  onClose,
  quantity,
  title = 'Carrito',
  children,
  footer,
  pendingCartCount = 0,
  onClearCart,
}: Props) {
  const tablet = useTabletMobileViewport()
  const androidPhone = isCapacitorAndroid() && !tablet

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-[115]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className={clsx(
          'absolute inset-x-0 bottom-0 flex justify-center',
          androidPhone
            ? clsx(DRAWER_BOTTOM_WRAP_X_LG, DRAWER_BOTTOM_SAFE_LG)
            : tablet
              ? clsx(DRAWER_BOTTOM_WRAP_X_LG, DRAWER_BOTTOM_SAFE_LG)
              : clsx('pt-3 sm:pt-4', DRAWER_BOTTOM_WRAP_X_RESP, DRAWER_BOTTOM_SAFE, 'sm:pb-drawer-bottom-lg'),
        )}
      >
        <div
          className={clsx(
            'bg-white shadow-xl overflow-hidden flex flex-col w-full',
            androidPhone && clsx('max-w-[23rem] rounded-xl', MAX_H_CART_DRAWER_PANEL),
            tablet && clsx('max-w-[min(94vw,40rem)] rounded-2xl', MAX_H_SHEET_PANEL),
            !androidPhone && !tablet && clsx('rounded-2xl', MAX_H_CART_DRAWER_PANEL),
          )}
        >
          <div
            className={clsx(
              'border-b border-stone-200 flex items-center justify-between gap-2 shrink-0',
              tablet ? 'p-5' : 'p-4',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart size={tablet ? 22 : 18} className="text-stone-700 shrink-0" />
              <h3 className={clsx('font-bold text-stone-800 truncate', tablet && 'text-lg')}>{title}</h3>
              {quantity > 0 && (
                <span
                  className={clsx(
                    'inline-flex items-center justify-center rounded-full bg-red-600 text-white font-bold tabular-nums',
                    tablet ? 'min-w-[26px] h-6 px-2 text-xs' : 'min-w-[22px] h-5 px-1.5 text-[11px]',
                  )}
                >
                  {quantity > 99 ? '99+' : quantity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onClearCart && pendingCartCount > 0 ? (
                <button
                  type="button"
                  onClick={onClearCart}
                  className={clsx(
                    'rounded-lg font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100',
                    tablet ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[11px]',
                  )}
                >
                  Vaciar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-stone-100 text-stone-600"
                aria-label="Cerrar carrito"
              >
                <X size={tablet ? 22 : 18} />
              </button>
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  )
}
