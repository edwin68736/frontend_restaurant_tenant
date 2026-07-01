import { forwardRef } from 'react'
import { ShoppingCart } from 'lucide-react'
import { clsx } from 'clsx'
import { isCapacitorAndroid } from '@/lib/platform/detect'
import { useTabletMobileViewport } from '@/hooks/useTabletMobileViewport'
import { FAB_CART_BOTTOM, RIGHT_SAFE_GUTTER } from '@/utils/safeAreaClasses'

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
  const android = isCapacitorAndroid()
  const tablet = useTabletMobileViewport()

  const sizeClass = tablet
    ? 'h-16 w-16'
    : android
      ? 'h-14 w-14'
      : 'h-[3.25rem] w-[3.25rem]'

  const iconSize = tablet ? 32 : android ? 28 : 26

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={quantity > 0 ? `Abrir carrito, ${label}` : 'Abrir carrito'}
      className={clsx(
        'lg:hidden fixed z-[105] flex items-center justify-center rounded-full',
        RIGHT_SAFE_GUTTER,
        'bg-rest-600 text-white shadow-lg shadow-rest-900/30 ring-4 ring-white',
        'hover:bg-rest-700 active:scale-95 transition-transform touch-manipulation',
        FAB_CART_BOTTOM,
        sizeClass,
        className,
      )}
    >
      <ShoppingCart size={iconSize} strokeWidth={2.25} aria-hidden />
      {quantity > 0 && (
        <span
          className={clsx(
            'absolute -top-0.5 -right-0.5 flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 font-bold leading-none text-white tabular-nums ring-2 ring-white',
            tablet ? 'h-6 text-[11px]' : 'h-5 text-[10px]',
          )}
          aria-hidden
        >
          {quantity > 99 ? '99+' : quantity}
        </span>
      )}
    </button>
  )
})
