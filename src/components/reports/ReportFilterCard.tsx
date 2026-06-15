import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

type Props = {
  children: ReactNode
  hint?: string
  /** Una sola fila horizontal (scroll en pantallas pequeñas). */
  horizontal?: boolean
  /** En móvil, filtros colapsados por defecto para priorizar la tabla. */
  collapsibleMobile?: boolean
}

function FilterBody({
  children,
  hint,
  horizontal,
}: {
  children: ReactNode
  hint?: string
  horizontal?: boolean
}) {
  return (
    <>
      {hint ? <p className="text-xs text-stone-500 hidden lg:block">{hint}</p> : null}
      <div
        className={clsx(
          'flex items-end gap-2 lg:gap-3',
          horizontal ? 'flex-nowrap overflow-x-auto pb-0.5 -mx-0.5 px-0.5 lg:mx-0 lg:px-0' : 'flex-wrap',
        )}
      >
        {children}
      </div>
    </>
  )
}

export function ReportFilterCard({
  children,
  hint,
  horizontal = false,
  collapsibleMobile = true,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const desktopCard = (
    <div className="hidden lg:block bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shrink-0">
      <FilterBody hint={hint} horizontal={horizontal}>
        {children}
      </FilterBody>
    </div>
  )

  if (!collapsibleMobile) {
    return (
      <div className="bg-white rounded-xl lg:rounded-2xl border border-stone-200 p-2.5 lg:p-4 space-y-2 lg:space-y-3 shrink-0">
        <FilterBody hint={hint} horizontal={horizontal}>
          {children}
        </FilterBody>
      </div>
    )
  }

  return (
    <>
      <div className="lg:hidden shrink-0 rounded-xl border border-stone-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700"
          aria-expanded={mobileOpen}
        >
          <span>Filtros y exportación</span>
          <ChevronDown
            size={16}
            className={clsx('shrink-0 text-stone-500 transition-transform', mobileOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        {mobileOpen ? (
          <div className="border-t border-stone-100 px-3 pb-3 pt-2 space-y-2">
            <FilterBody horizontal={horizontal}>{children}</FilterBody>
          </div>
        ) : null}
      </div>
      {desktopCard}
    </>
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
    <div className={clsx('shrink-0', className)}>
      <label className="block text-[10px] lg:text-xs font-medium text-stone-500 mb-0.5 lg:mb-1">{label}</label>
      {children}
    </div>
  )
}

export const reportInputClass =
  'border border-stone-200 rounded-lg lg:rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 text-xs lg:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rest-500/30 focus:border-rest-500'

export const reportSelectClass =
  'border border-stone-200 rounded-lg lg:rounded-xl px-2 py-1.5 lg:px-3 lg:py-2 text-xs lg:text-sm min-w-[7rem] lg:min-w-[140px] bg-white focus:outline-none focus:ring-2 focus:ring-rest-500/30'
