import type { Comanda } from '@/services/restaurant.service'
import { formatSoles } from '@/utils/format'
import { sumMoney } from '@/utils/money'
import { formatModifierLines, parseStoredModifiers } from '@/utils/productModifiers'

type Props = {
  comanda: Comanda
  showPrice?: boolean
}

export function ComandaLineDisplay({ comanda, showPrice = false }: Props) {
  const mods = parseStoredModifiers(comanda.modifiers_json)
  const modLines = formatModifierLines(mods)
  const note = comanda.notes?.trim()

  return (
    <div className="text-sm">
      <div className="flex justify-between gap-2 font-medium text-stone-800">
        <span>
          {comanda.quantity}x {comanda.product_name}
        </span>
        {showPrice ? (
          <span className="shrink-0 tabular-nums text-rest-600">
            {formatSoles(sumMoney(comanda.quantity * comanda.unit_price))}
          </span>
        ) : null}
      </div>
      {modLines.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-2 border-l-2 border-rest-300">
          {modLines.map((line, idx) => (
            <li key={`${idx}-${line}`} className="text-xs text-stone-600">
              {line}
            </li>
          ))}
        </ul>
      )}
      {note ? <p className="text-xs text-amber-800 mt-1 italic">Obs: {note}</p> : null}
    </div>
  )
}
