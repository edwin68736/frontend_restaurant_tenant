import type { ReactNode } from 'react'
import { clsx } from 'clsx'

type Props = {
  children: ReactNode
  hint?: string
  /** Una sola fila horizontal (scroll en pantallas pequeñas). */
  horizontal?: boolean
}

export function ReportFilterCard({ children, hint, horizontal = false }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
      <div
        className={clsx(
          'flex items-end gap-3',
          horizontal ? 'flex-nowrap overflow-x-auto pb-0.5' : 'flex-wrap',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ReportFilterField({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

export const reportInputClass =
  'border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rest-500/30 focus:border-rest-500'

export const reportSelectClass =
  'border border-stone-200 rounded-xl px-3 py-2 text-sm min-w-[140px] bg-white focus:outline-none focus:ring-2 focus:ring-rest-500/30'
