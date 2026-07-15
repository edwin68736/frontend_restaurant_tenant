import { Plus, UtensilsCrossed } from 'lucide-react'
import type { Product } from '@/services/products.service'
import { getProductImageUrl } from '@/services/products.service'
import { formatSoles } from '@/utils/format'
import { formatAmountDisplay } from '@/utils/money'

type Props = {
  product: Product
  stockQuantity?: number
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Fila compacta equivalente a PosProductGridCard: mismos colores, sombra, foco y precio en
 * verde. Cambia la disposición (miniatura + nombre + precio en una línea), no el lenguaje
 * visual, para que alternar vista no se sienta otra app.
 */
export function PosProductListRow({ product, stockQuantity, onClick }: Props) {
  const imgUrl = getProductImageUrl(product.image_url)
  const showStock = Boolean(product.manage_stock)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-stone-100/90 bg-white p-2 text-left shadow-[0_2px_10px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-stone-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.14)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 active:scale-[0.99]"
    >
      <div
        data-product-visual
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:h-16 sm:w-16"
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.name}
            className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-stone-900">{product.name}</p>
        {showStock && (
          <p className="mt-0.5 text-[11px] text-stone-400">
            Stock: {stockQuantity !== undefined ? formatAmountDisplay(stockQuantity) : '—'}
          </p>
        )}
      </div>

      <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold leading-tight text-white shadow-md">
        {formatSoles(Number(product.sale_price))}
      </span>
      <span
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-400 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600 sm:flex"
        aria-hidden
      >
        <Plus className="h-4 w-4" />
      </span>
    </button>
  )
}
