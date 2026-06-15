import type { ReactNode } from 'react'

type CardProps = {
  label: string
  value: ReactNode
  hint?: ReactNode
}

/** Fila de KPIs: scroll horizontal en móvil, grilla en escritorio. */
export function ReportSummaryRow({
  children,
  desktopCols = 4,
}: {
  children: ReactNode
  desktopCols?: 2 | 3 | 4 | 5
}) {
  const gridCols =
    desktopCols === 5
      ? 'lg:grid-cols-5'
      : desktopCols === 3
        ? 'lg:grid-cols-3'
        : desktopCols === 2
          ? 'lg:grid-cols-2'
          : 'lg:grid-cols-4'

  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 lg:mx-0 lg:px-0 lg:grid ${gridCols} lg:gap-3 lg:overflow-visible`}
    >
      {children}
    </div>
  )
}

export function ReportSummaryCard({ label, value, hint }: CardProps) {
  return (
    <div className="shrink-0 min-w-[6.75rem] rounded-xl border border-stone-200 bg-white px-2.5 py-2 lg:min-w-0 lg:rounded-2xl lg:px-4 lg:py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 truncate lg:text-xs">
        {label}
      </p>
      <p className="text-sm font-bold text-stone-900 tabular-nums lg:text-lg">{value}</p>
      {hint ? <p className="text-[10px] text-stone-500 lg:text-xs">{hint}</p> : null}
    </div>
  )
}
