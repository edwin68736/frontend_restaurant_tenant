import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}

/** Columna de configuración para un tipo de documento (comandas / precuenta / documentos). */
export function PrinterColumn({ icon, title, description, children }: Props) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3 sm:p-4 flex flex-col gap-4 min-w-0">
      <div className="flex items-start gap-2.5 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-rest-700 shrink-0">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-bold text-stone-900">{title}</h3>
          <p className="text-xs text-stone-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}
