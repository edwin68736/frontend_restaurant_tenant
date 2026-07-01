import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'

type Props = {
  title: string
  subtitle?: string
  icon: ReactNode
  /** Cerrado al montar. */
  defaultOpen?: boolean
  /** Acciones en la fila del encabezado (p. ej. Probar). */
  actions?: ReactNode
  /** Badge de estado junto al título. */
  badge?: ReactNode
  children: ReactNode
  nested?: boolean
}

export function PrinterSettingsSection({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  actions,
  badge,
  children,
  nested = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={clsx(
        'overflow-hidden',
        nested
          ? 'rounded-xl border border-stone-200'
          : 'rounded-2xl border border-stone-200 bg-white shadow-sm',
      )}
    >
      <div
        className={clsx(
          'flex items-start gap-2 sm:gap-3',
          nested ? 'px-3 py-2.5 bg-stone-50' : 'p-4 sm:p-5',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-start gap-2 sm:gap-3 text-left min-w-0 touch-manipulation"
          aria-expanded={open}
        >
          <div
            className={clsx(
              'flex items-center justify-center shrink-0 rounded-2xl bg-rest-50 text-rest-700',
              nested ? 'w-8 h-8' : 'w-10 h-10',
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={clsx('font-bold text-stone-900', nested ? 'text-sm' : 'text-base')}>{title}</h2>
              {badge}
            </div>
            {subtitle ? (
              <p className={clsx('text-stone-600 mt-0.5', nested ? 'text-xs' : 'text-sm')}>{subtitle}</p>
            ) : null}
          </div>
          {open ? (
            <ChevronUp size={nested ? 16 : 18} className="text-stone-400 shrink-0 mt-1" aria-hidden />
          ) : (
            <ChevronDown size={nested ? 16 : 18} className="text-stone-400 shrink-0 mt-1" aria-hidden />
          )}
        </button>
        {actions ? <div className="shrink-0 self-start">{actions}</div> : null}
      </div>

      {open ? (
        <div
          className={clsx(
            'border-t border-stone-100',
            nested ? 'p-3 sm:p-4 space-y-3' : 'px-4 pb-4 sm:px-5 sm:pb-5 space-y-4',
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}
