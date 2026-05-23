import { forwardRef } from 'react'
import { ShoppingCart } from 'lucide-react'
import { clsx } from 'clsx'

type Props = {
  quantity: number
  onClick: () => void
  className?: string
}

/**
 * Botón flotante del carrito (móvil): esquina inferior derecha, sobre el contenido y encima del menú inferior.
 */
export const FloatingCartButton = forwardRef<HTMLButtonElement, Props>(function FloatingCartButton(
  { quantity, onClick, className },
  ref,
) {
  const label = quantity === 1 ? '1 artículo' : `${quantity} artículos`

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={quantity > 0 ? `Abrir carrito, ${label}` : 'Abrir carrito'}
      className={clsx(
        'lg:hidden fixed right-4 z-[105] flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full',
        'bg-rest-600 text-white shadow-lg shadow-rest-900/30 ring-4 ring-white',
        'hover:bg-rest-700 active:scale-95 transition-transform touch-manipulation',
        className,
      )}
      style={{ bottom: 'calc(3.5rem + 0.625rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <ShoppingCart size={26} strokeWidth={2.25} aria-hidden />
      <span
        className={clsx(
          'absolute -top-0.5 -right-0.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ring-2 ring-white',
          quantity > 0 ? 'bg-amber-500 text-white' : 'bg-stone-400 text-white',
        )}
      >
        {quantity > 99 ? '99+' : quantity}
      </span>
    </button>
  )
})
