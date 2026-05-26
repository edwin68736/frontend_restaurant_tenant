import type { PosCartLine } from '@/utils/posCart'
import { cartLineLabel, cartLineUnitPrice, isManualCartLine } from '@/utils/posCart'

type Props = {
  line: PosCartLine
  subtotalLabel: string
  onQtyChange: (delta: number) => void
  onNotesChange: (notes: string) => void
  showNotes?: boolean
}

export function PosCartLineRow({ line, subtotalLabel, onQtyChange, onNotesChange, showNotes = true }: Props) {
  const manual = isManualCartLine(line)
  return (
    <li className="py-2 border-b border-stone-100 last:border-0 space-y-1.5">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-700 truncate">
              {manual && <span className="text-amber-700 text-[10px] font-semibold uppercase mr-1">Manual</span>}
              {cartLineLabel(line)}
            </span>
            <span className="text-xs font-semibold text-rest-600 shrink-0">
              S/ {cartLineUnitPrice(line).toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-stone-400">
            x{line.quantity} · {subtotalLabel}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onQtyChange(-1)}
            className="w-7 h-7 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold"
          >
            −
          </button>
          <span className="w-6 text-center font-medium">{line.quantity}</span>
          <button
            type="button"
            onClick={() => onQtyChange(1)}
            className="w-7 h-7 rounded-lg bg-rest-600 text-white hover:bg-rest-700 font-bold"
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
            className="w-full border border-stone-200 rounded-lg px-2 py-1 text-xs"
          />
        </div>
      )}
    </li>
  )
}
