import { useEffect, useRef, useState } from 'react'
import { UtensilsCrossed, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { roundMoney } from '@/utils/checkoutDiscount'
import { getProductImageUrl } from '@/services/products.service'
import type { PosCartLine } from '@/utils/posCart'
import {
  cartLineBasePrice,
  cartLineHasMissingPrice,
  cartLineLabel,
  cartLineUnitPrice,
  isCatalogCartLine,
  isManualCartLine,
} from '@/utils/posCart'
import { formatSoles } from '@/utils/format'
import { formatModifierLines } from '@/utils/productModifiers'

type Props = {
  line: PosCartLine
  subtotalLabel: string
  onQtyChange: (delta: number) => void
  onNotesChange: (notes: string) => void
  onUnitPriceChange?: (value: string) => void
  showNotes?: boolean
}

function formatUnitPriceInput(n: number): string {
  const v = roundMoney(n)
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function CartUnitPriceInput({
  unitPrice,
  onCommit,
  invalid,
}: {
  unitPrice: number
  onCommit: (value: string) => void
  invalid?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const savedRef = useRef(unitPrice)

  useEffect(() => {
    if (!editing) savedRef.current = unitPrice
  }, [unitPrice, editing])

  const commit = () => {
    const trimmed = draft.trim().replace(',', '.')
    if (trimmed === '') {
      setEditing(false)
      return
    }
    const parsed = Number.parseFloat(trimmed)
    if (Number.isNaN(parsed) || parsed < 0) {
      setEditing(false)
      return
    }
    if (roundMoney(parsed) !== roundMoney(savedRef.current)) {
      onCommit(String(parsed))
    }
    setEditing(false)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? draft : formatUnitPriceInput(unitPrice)}
      onFocus={() => {
        savedRef.current = unitPrice
        setDraft('')
        setEditing(true)
      }}
      onBlur={commit}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setDraft('')
          setEditing(false)
          e.currentTarget.blur()
        }
      }}
      className={clsx(
        'h-8 w-[4.75rem] box-border rounded-lg border px-1.5 text-xs font-semibold tabular-nums text-right focus:outline-none focus:ring-1',
        invalid
          ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-400'
          : 'border-stone-200 text-rest-700 focus:border-rest-500 focus:ring-rest-400',
      )}
      aria-label="Precio unitario de venta"
      aria-invalid={invalid || undefined}
    />
  )
}

export function PosCartLineRow({
  line,
  subtotalLabel,
  onQtyChange,
  onNotesChange,
  onUnitPriceChange,
  showNotes = true,
}: Props) {
  const manual = isManualCartLine(line)
  const catalog = isCatalogCartLine(line)
  const modifierLines = catalog && line.modifiers.length > 0 ? formatModifierLines(line.modifiers) : []
  const thumbUrl = catalog ? getProductImageUrl(line.product.image_url) : null
  const missingPrice = cartLineHasMissingPrice(line)

  return (
    <li
      className={clsx(
        'py-2 border-b last:border-0 space-y-1.5',
        missingPrice ? 'border-red-100 bg-red-50/60 -mx-2 px-2 rounded-lg' : 'border-stone-100',
      )}
    >
      <div className="flex gap-2.5 items-start">
        <div
          className="w-12 h-12 rounded-lg border border-stone-200 bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center"
          aria-hidden
        >
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : manual ? (
            <span className="text-[10px] font-bold text-amber-700 uppercase">Man.</span>
          ) : (
            <UtensilsCrossed className="w-5 h-5 text-stone-400" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-stone-700 truncate text-sm leading-tight block">
              {manual && <span className="text-amber-700 text-[10px] font-semibold uppercase mr-1">Manual</span>}
              {cartLineLabel(line)}
            </span>
            {catalog && line.unit_price !== line.base_price && (
              <p className="text-[10px] text-stone-400">
                Base {formatSoles(cartLineBasePrice(line))} + extras
              </p>
            )}
            {missingPrice && (
              <p className="flex items-center gap-1 text-[10px] font-semibold text-red-600 mt-0.5">
                <AlertTriangle size={11} /> Sin precio de venta configurado
              </p>
            )}
            {modifierLines.length > 0 && (
              <ul className="mt-0.5 space-y-0.5">
                {modifierLines.map((m) => (
                  <li key={m} className="text-[11px] text-stone-600 pl-2 border-l-2 border-rest-300">
                    {m}
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-stone-400 mt-0.5">
              x{line.quantity} · {subtotalLabel}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 self-start">
            {onUnitPriceChange ? (
              <CartUnitPriceInput
                unitPrice={cartLineUnitPrice(line)}
                onCommit={onUnitPriceChange}
                invalid={missingPrice}
              />
            ) : (
              <span
                className={clsx(
                  'h-8 min-w-[4.75rem] px-1.5 flex items-center justify-end text-xs font-semibold tabular-nums',
                  missingPrice ? 'text-red-600' : 'text-rest-600',
                )}
              >
                {formatSoles(cartLineUnitPrice(line))}
              </span>
            )}
            <button
              type="button"
              onClick={() => onQtyChange(-1)}
              className="w-8 h-8 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold text-lg"
              aria-label="Quitar uno"
            >
              −
            </button>
            <span className="w-6 text-center font-medium tabular-nums">{line.quantity}</span>
            <button
              type="button"
              onClick={() => onQtyChange(1)}
              className="w-8 h-8 rounded-lg bg-rest-600 text-white hover:bg-rest-700 font-bold text-lg"
              aria-label="Agregar uno"
            >
              +
            </button>
          </div>
        </div>
      </div>
      {showNotes && (
        <div className="pl-[3.25rem]">
          <label className="block text-[10px] font-medium text-stone-500 mb-0.5">Nota para comanda (opcional)</label>
          <input
            type="text"
            value={line.notes ?? ''}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ej. sin cebolla, bien cocido"
            maxLength={500}
            className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs min-h-[36px]"
          />
        </div>
      )}
    </li>
  )
}
