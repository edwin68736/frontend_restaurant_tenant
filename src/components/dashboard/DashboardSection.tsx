import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function DashboardSection({ title, subtitle, actions, children, className = '' }: Props) {
  return (
    <section className={`bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">{title}</h2>
          {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
