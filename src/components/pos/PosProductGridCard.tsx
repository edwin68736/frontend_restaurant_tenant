import { UtensilsCrossed } from 'lucide-react'
import type { Product } from '@/services/products.service'
import { getProductImageUrl } from '@/services/products.service'
import { formatSoles } from '@/utils/format'
import { formatAmountDisplay } from '@/utils/money'

type Props = {
  product: Product
  stockQuantity?: number
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export function PosProductGridCard({ product, stockQuantity, onClick }: Props) {
  const imgUrl = getProductImageUrl(product.image_url)
  const showStock = Boolean(product.manage_stock)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-stone-100/90 bg-white text-left shadow-[0_2px_10px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-stone-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.14)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 active:scale-[0.98]"
    >
      <div data-product-visual className="relative aspect-square overflow-hidden bg-stone-100">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.name}
            className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
            <UtensilsCrossed className="h-10 w-10" />
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold leading-tight text-white shadow-md sm:bottom-2 sm:right-2 sm:px-3 sm:py-1 sm:text-xs">
          {formatSoles(Number(product.sale_price))}
        </span>
      </div>
      <div className="px-3 pb-3 pt-2">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-stone-900 sm:text-sm">{product.name}</p>
        {showStock && (
          <p className="mt-1 text-[10px] text-stone-400 sm:text-xs">
            Stock:{' '}
            {stockQuantity !== undefined ? formatAmountDisplay(stockQuantity) : '—'}
          </p>
        )}
      </div>
    </button>
  )
}
