import { clsx } from 'clsx'
import { AlertTriangle } from 'lucide-react'
import type { SupplyCheck } from '@/services/recipes.service'
import { shortageText } from '@/utils/recipeStock'

/** Aviso bajo el carrito: qué insumos no alcanzan y qué pasará al cobrar según la política del negocio. */
export function SupplyShortageNotice({ check }: { check: SupplyCheck | null }) {
  if (!check?.active || check.shortages.length === 0) return null
  const blocks = check.stock_policy === 'block'
  return (
    <div
      role="alert"
      className={clsx(
        'max-h-28 shrink-0 overflow-y-auto border-t px-3 py-2 text-xs',
        blocks ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={14} aria-hidden /> Insumos insuficientes
      </p>
      <ul className="mt-1 space-y-0.5">
        {check.shortages.map((s) => (
          <li key={s.supply_id}>
            {shortageText(s)}
            {s.dishes.length > 0 && <span className="opacity-75"> · {s.dishes.join(', ')}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-1">{blocks ? 'No se podrá cobrar este pedido.' : 'Se puede cobrar: el insumo quedará en negativo.'}</p>
    </div>
  )
}
