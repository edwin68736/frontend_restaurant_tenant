import type { ReactNode } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { clsx } from 'clsx'
import { isCapacitorAndroid } from '@/lib/platform/detect'

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

/** Panel carrito móvil (POS / Mesa). En Android: más compacto, márgenes y rounded-xl. */
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
  if (!open) return null

  const android = isCapacitorAndroid()

  return (
    <div className="lg:hidden fixed inset-0 z-[115]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className={clsx(
          'absolute inset-x-0 bottom-0 flex justify-center',
          android ? 'px-4 pb-4' : 'p-3 sm:p-4',
        )}
      >
        <div
          className={clsx(
            'bg-white shadow-xl overflow-hidden flex flex-col w-full',
            android ? 'max-w-[23rem] rounded-xl max-h-[88vh]' : 'rounded-2xl max-h-[85vh]',
          )}
        >
          <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart size={18} className="text-stone-700 shrink-0" />
              <h3 className="font-bold text-stone-800 truncate">{title}</h3>
              {quantity > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold tabular-nums">
                  {quantity > 99 ? '99+' : quantity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onClearCart && pendingCartCount > 0 ? (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100"
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
                <X size={18} />
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
