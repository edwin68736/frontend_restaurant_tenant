import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  title?: string
  children: ReactNode
  className?: string
}

/** Tarjeta informativa no invasiva para formularios de ajustes. */
export function SettingsInfoCard({ title = 'Información', children, className = '' }: Props) {
  return (
    <div
      className={`rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-stone-700 ${className}`}
      role="note"
    >
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
          <Info size={16} aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">{title}</p>
          <div className="text-sm text-stone-700 space-y-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
