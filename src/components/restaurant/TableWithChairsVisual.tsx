import { Armchair, User, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { tableStatusStyles } from '@/utils/tableStatusStyles'

const CHAIR_SLOTS = [
  { key: 'top', className: 'left-1/2 top-0 -translate-x-1/2' },
  { key: 'bottom', className: 'left-1/2 bottom-0 -translate-x-1/2' },
  { key: 'left', className: 'top-1/2 left-0 -translate-y-1/2' },
  { key: 'right', className: 'top-1/2 right-0 -translate-y-1/2' },
] as const

/** Número o nombre corto para el centro de la mesa (ej. "Mesa 12" → "12"). */
export function tableCenterLabel(name: string): string {
  const trimmed = name.trim()
  const trailing = trimmed.match(/(\d+)\s*$/i)
  if (trailing) return trailing[1]
  const mesaPrefix = trimmed.match(/^mesa\s*#?\s*(\d+)/i)
  if (mesaPrefix) return mesaPrefix[1]
  return trimmed.length > 8 ? `${trimmed.slice(0, 7)}…` : trimmed
}

type Props = {
  name: string
  capacity: number
  status: string
  /** Tamaño del diagrama mesa+sillas */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: {
    box: 'aspect-square w-[min(100%,4.75rem)] sm:w-[5.5rem]',
    inset: 'inset-[0.75rem] sm:inset-[0.85rem]',
    table: 'text-sm sm:text-base',
    chair: 'w-5 h-5',
    icon: 10,
    iconSm: 11,
  },
  md: {
    box: 'aspect-square w-[min(100%,5.5rem)] sm:w-[6.5rem] md:w-[7.25rem]',
    inset: 'inset-[0.9rem] sm:inset-[1rem] md:inset-[1.05rem]',
    table: 'text-lg sm:text-xl',
    chair: 'w-6 h-6 sm:w-7 sm:h-7',
    icon: 12,
    iconSm: 14,
  },
  lg: {
    box: 'aspect-square w-[min(100%,6rem)] sm:w-[7.5rem] md:w-[8.5rem]',
    inset: 'inset-[1rem] sm:inset-[1.1rem] md:inset-[1.2rem]',
    table: 'text-xl sm:text-2xl',
    chair: 'w-7 h-7 sm:w-8 sm:h-8',
    icon: 13,
    iconSm: 16,
  },
} as const

/**
 * Diagrama visual: mesa central con cuatro sillas (vista superior).
 */
export function TableWithChairsVisual({ name, capacity, status, size = 'md', className }: Props) {
  const st = tableStatusStyles(status)
  const sz = SIZE[size]
  const label = tableCenterLabel(name)
  const isOcupada = status === 'ocupada'

  return (
    <div className={clsx('relative mx-auto max-w-full', sz.box, className)}>
      {CHAIR_SLOTS.map((slot) => (
        <div
          key={slot.key}
          className={clsx(
            'absolute flex items-center justify-center rounded-md sm:rounded-lg shadow-sm transition-transform group-hover:scale-105',
            sz.chair,
            slot.className,
            st.chair,
          )}
          aria-hidden
        >
          <Armchair
            size={sz.icon}
            className="text-white sm:hidden"
            strokeWidth={2.25}
            aria-hidden
          />
          <Armchair
            size={sz.iconSm}
            className="text-white hidden sm:block"
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
      ))}

      <div
        className={clsx(
          'absolute flex flex-col items-center justify-center rounded-xl border-2',
          sz.inset,
          st.surface,
          isOcupada && 'ring-2 ring-amber-400/90 ring-offset-1',
        )}
      >
        <span className={clsx('font-bold text-stone-800 leading-none tabular-nums', sz.table)}>{label}</span>
      </div>

      <div
        className="absolute bottom-0 left-0 flex items-center gap-0.5 rounded-md border border-stone-200/80 bg-white/90 px-1 py-0.5 text-[10px] font-medium text-stone-600 shadow-sm"
        title={`${capacity} personas`}
      >
        <Users size={10} className="text-stone-500 shrink-0" aria-hidden />
        <span>{capacity}</span>
      </div>
    </div>
  )
}

type TableCardFooterProps = {
  floorName?: string
  waiterName?: string
  totalAmount?: number | null
  amountClassName?: string
}

export function TableCardFooter({ floorName, waiterName, totalAmount, amountClassName }: TableCardFooterProps) {
  return (
    <div className="mt-2 space-y-1 text-center min-w-0 px-1">
      {waiterName && (
        <p className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 truncate">
          <User size={10} className="shrink-0" aria-hidden />
          <span className="truncate">{waiterName}</span>
        </p>
      )}
      {floorName && <p className="text-[11px] text-stone-500 truncate">{floorName}</p>}
      {totalAmount != null && totalAmount > 0 && (
        <p className={clsx('text-sm font-semibold', amountClassName ?? 'text-amber-900')}>
          S/ {Number(totalAmount).toFixed(2)}
        </p>
      )}
    </div>
  )
}
