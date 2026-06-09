import { clsx } from 'clsx'

type Props = {
  title: string
  subtitle?: string
  subtitleClassName?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Si true, el área de contenido crece y permite scroll interno en hijos flex-1 */
  fill?: boolean
}

/** Contenedor estándar: cabecera compacta + contenido a ancho completo. */
export function PageShell({
  title,
  subtitle,
  subtitleClassName,
  actions,
  children,
  className = '',
  fill = true,
}: Props) {
  return (
    <div className={clsx('w-full flex flex-col', fill && 'flex-1 min-h-0', className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 sm:gap-3 mb-2 sm:mb-3 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-bold text-stone-900 tracking-tight leading-tight">{title}</h1>
          {subtitle && (
            <p className={clsx('text-xs sm:text-sm text-stone-500 mt-0.5', subtitleClassName)}>{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 w-full lg:w-auto lg:justify-end">
            {actions}
          </div>
        )}
      </div>
      <div className={clsx(fill && 'flex-1 min-h-0 flex flex-col w-full')}>{children}</div>
    </div>
  )
}
