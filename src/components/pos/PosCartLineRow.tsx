import type { PosCartLine } from '@/utils/posCart'
import {
  cartLineBasePrice,
  cartLineLabel,
  cartLineUnitPrice,
  isCatalogCartLine,
  isManualCartLine,
  manualPriceIgvLabel,
} from '@/utils/posCart'
import { formatSoles } from '@/utils/format'
import { formatModifierLines } from '@/utils/productModifiers'

type Props = {
  line: PosCartLine
  subtotalLabel: string
  onQtyChange: (delta: number) => void
  onNotesChange: (notes: string) => void
  showNotes?: boolean
}

export function PosCartLineRow({ line, subtotalLabel, onQtyChange, onNotesChange, showNotes = true }: Props) {
  const manual = isManualCartLine(line)
  const catalog = isCatalogCartLine(line)
  const modifierLines = catalog && line.modifiers.length > 0 ? formatModifierLines(line.modifiers) : []

  return (
    <li className="py-2 border-b border-stone-100 last:border-0 space-y-1.5">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-700 truncate">
              {manual && <span className="text-amber-700 text-[10px] font-semibold uppercase mr-1">Manual</span>}
              {cartLineLabel(line)}
            </span>
            <span className="text-xs font-semibold text-rest-600 shrink-0 tabular-nums">
              {formatSoles(cartLineUnitPrice(line))}
            </span>
          </div>
          {catalog && line.unit_price !== line.base_price && (
            <p className="text-[10px] text-stone-400">
              Base {formatSoles(cartLineBasePrice(line))} + extras
            </p>
          )}
          {manual && (
            <p className="text-[10px] text-amber-800/90">
              {manualPriceIgvLabel(line.price_includes_igv, line.igv_affectation_type)}
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
          <div className="text-xs text-stone-400">
            x{line.quantity} · {subtotalLabel}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onQtyChange(-1)}
            className="w-8 h-8 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold text-lg"
          >
            −
          </button>
          <span className="w-6 text-center font-medium">{line.quantity}</span>
          <button
            type="button"
            onClick={() => onQtyChange(1)}
            className="w-8 h-8 rounded-lg bg-rest-600 text-white hover:bg-rest-700 font-bold text-lg"
          >
            +
          </button>
        </div>
      </div>
      {showNotes && (
        <div>
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
