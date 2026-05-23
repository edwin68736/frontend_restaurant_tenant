import { LayoutGrid, List } from 'lucide-react'
import { clsx } from 'clsx'

export type ComandasViewMode = 'items' | 'orders'

type Props = {
  value: ComandasViewMode
  onChange: (mode: ComandasViewMode) => void
}

export function ComandasViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex w-full sm:w-auto rounded-xl border border-stone-200 bg-stone-50 p-0.5"
      role="tablist"
      aria-label="Modo de vista"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'items'}
        onClick={() => onChange('items')}
        className={clsx(
          'flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-xs sm:text-sm font-semibold transition-colors touch-manipulation',
          value === 'items'
            ? 'bg-orange-600 text-white shadow-sm'
            : 'text-stone-600 hover:bg-white/80',
        )}
      >
        <List size={16} className="shrink-0" />
        Por ítem
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'orders'}
        onClick={() => onChange('orders')}
        className={clsx(
          'flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-xs sm:text-sm font-semibold transition-colors touch-manipulation',
          value === 'orders'
            ? 'bg-orange-600 text-white shadow-sm'
            : 'text-stone-600 hover:bg-white/80',
        )}
      >
        <LayoutGrid size={16} className="shrink-0" />
        Por pedido
      </button>
    </div>
  )
}
