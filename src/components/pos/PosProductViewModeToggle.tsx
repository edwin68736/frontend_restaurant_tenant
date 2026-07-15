import { clsx } from 'clsx'
import { LayoutGrid, List } from 'lucide-react'
import type { PosProductViewMode } from '@/utils/posProductViewMode'

type Props = {
  mode: PosProductViewMode
  onChange: (mode: PosProductViewMode) => void
}

/** Alterna tarjetas / lista en el catálogo del POS y de mesas. */
export function PosProductViewModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5">
      {(
        [
          { value: 'grid' as const, icon: LayoutGrid, label: 'Ver en tarjetas' },
          { value: 'list' as const, icon: List, label: 'Ver en lista' },
        ]
      ).map(({ value, icon: Icon, label }) => {
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={clsx(
              'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rest-500/50',
              active ? 'bg-rest-600 text-white' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
            )}
          >
            <Icon size={15} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
