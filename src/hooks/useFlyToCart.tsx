import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { UtensilsCrossed } from 'lucide-react'

export { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'

const FLY_DURATION_MS = 480
/** Un solo vuelo visible cada ~750 ms (clics rápidos en productos distintos). */
const FLY_GLOBAL_THROTTLE_MS = 750

type FlyItem = {
  id: number
  imageUrl: string | null
  from: { x: number; y: number; size: number }
  to: { x: number; y: number; size: number }
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
}

/** Misma posición que `FloatingCartButton` (right-4, sobre menú inferior). */
function getFloatingCartRect(): DOMRect {
  const rem = 16
  const btn = 3.25 * rem
  const right = 1 * rem
  const bottomNav = 3.5 * rem
  const gap = 0.625 * rem
  const left = window.innerWidth - right - btn
  const top = window.innerHeight - bottomNav - gap - btn
  return new DOMRect(left, top, btn, btn)
}

function FlyParticle({
  item,
  onDone,
}: {
  item: FlyItem
  onDone: (id: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const { from, to } = item
    const endSize = Math.max(28, to.size * 0.5)

    const anim = el.animate(
      [
        {
          transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(1)`,
          width: `${from.size}px`,
          height: `${from.size}px`,
          opacity: 1,
          filter: 'drop-shadow(0 10px 20px rgba(15, 23, 42, 0.3))',
        },
        {
          transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(0.25)`,
          width: `${endSize}px`,
          height: `${endSize}px`,
          opacity: 0.9,
          filter: 'drop-shadow(0 4px 8px rgba(15, 23, 42, 0.15))',
        },
      ],
      {
        duration: FLY_DURATION_MS,
        easing: 'cubic-bezier(0.15, 0.85, 0.25, 1)',
        fill: 'forwards',
      },
    )

    anim.onfinish = () => onDone(item.id)
    return () => anim.cancel()
  }, [item, onDone])

  return (
    <div
      ref={ref}
      className="fly-cart-particle pointer-events-none fixed left-0 top-0 z-[106] overflow-hidden rounded-2xl border-[3px] border-white bg-stone-100 will-change-transform"
      style={{ width: item.from.size, height: item.from.size }}
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-rest-600">
          <UtensilsCrossed size={Math.max(28, item.from.size * 0.4)} strokeWidth={2} aria-hidden />
        </div>
      )}
    </div>
  )
}

type FlyToCartOptions = {
  /** Destino en escritorio (p. ej. panel lateral del carrito en Mesa). */
  desktopCartRef?: RefObject<HTMLElement | null>
}

export function useFlyToCart(cartRef: RefObject<HTMLElement | null>, options?: FlyToCartOptions) {
  const desktopCartRef = options?.desktopCartRef
  const [items, setItems] = useState<FlyItem[]>([])
  const idRef = useRef(0)
  const lastFlyAtRef = useRef(0)

  const resolveCartRect = useCallback((): DOMRect | null => {
    if (isMobileViewport()) {
      return cartRef.current?.getBoundingClientRect() ?? getFloatingCartRect()
    }
    return desktopCartRef?.current?.getBoundingClientRect() ?? null
  }, [cartRef, desktopCartRef])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const cancelFlyAnimations = useCallback(() => {
    setItems([])
    lastFlyAtRef.current = 0
  }, [])

  const flyToCart = useCallback(
    (sourceEl: HTMLElement, imageUrl: string | null) => {
      const cartRect = resolveCartRect()
      if (!cartRect) return

      const now = Date.now()
      if (now - lastFlyAtRef.current < FLY_GLOBAL_THROTTLE_MS) return
      lastFlyAtRef.current = now

      const srcRect = sourceEl.getBoundingClientRect()
      const tileSize = Math.max(srcRect.width, srcRect.height)
      const fromSize = Math.min(112, Math.max(tileSize, 72))

      const from = {
        x: srcRect.left + srcRect.width / 2,
        y: srcRect.top + srcRect.height / 2,
        size: fromSize,
      }
      const to = {
        x: cartRect.left + cartRect.width / 2,
        y: cartRect.top + cartRect.height / 2,
        size: cartRect.width,
      }

      const id = ++idRef.current
      setItems([{ id, imageUrl, from, to }])
    },
    [resolveCartRect],
  )

  const FlyToCartLayer = useCallback(() => {
    if (items.length === 0 || typeof document === 'undefined') return null
    return createPortal(
      <div className="fixed inset-0 pointer-events-none z-[106]" aria-hidden>
        {items.map((item) => (
          <FlyParticle key={item.id} item={item} onDone={removeItem} />
        ))}
      </div>,
      document.body,
    )
  }, [items, removeItem])

  return { flyToCart, FlyToCartLayer, cancelFlyAnimations }
}
