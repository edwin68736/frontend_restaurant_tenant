import { FileText, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { goToRestaurantSeriesSettings } from '@/utils/restaurantSeriesNavigation'

const REQUIRED_DOCS = ['Nota de venta', 'Boleta', 'Factura'] as const

export type BranchSeriesEmptyReason = 'missing' | 'other_branch' | 'load_error'

type Props = {
  /** Variante compacta para modales. */
  compact?: boolean
  className?: string
  branchName?: string
  reason?: BranchSeriesEmptyReason
}

export function BranchCheckoutSeriesEmptyState({
  compact = false,
  className,
  branchName,
  reason = 'missing',
}: Props) {
  const navigate = useNavigate()

  const title =
    reason === 'load_error'
      ? 'No se pudieron verificar las series de esta sucursal'
      : reason === 'other_branch'
        ? 'Las series están configuradas en otra sucursal'
        : branchName
          ? `La sucursal «${branchName}» no tiene series de venta listas`
          : 'Esta sucursal aún no tiene series configuradas'

  const description =
    reason === 'load_error'
      ? 'Hubo un error al consultar las series. Revisa tu conexión e intenta actualizar. Si el problema continúa, contacta soporte.'
      : reason === 'other_branch'
        ? `Tu sesión opera en «${branchName ?? 'esta sucursal'}», pero las series de venta están registradas en otra sucursal. Cambia de local o crea las series aquí.`
        : 'Antes de emitir comprobantes debes configurar al menos una serie de venta (nota de venta, boleta o factura) para la sucursal activa.'

  return (
    <div
      className={clsx(
        'rounded-2xl border border-amber-200 bg-amber-50/90 text-stone-800',
        compact ? 'p-4' : 'p-6 sm:p-8',
        className,
      )}
      role="status"
    >
      <div className={clsx('flex gap-3', compact ? 'flex-col items-center text-center' : 'items-start')}>
        <div
          className={clsx(
            'flex shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800',
            compact ? 'h-11 w-11' : 'h-12 w-12',
          )}
        >
          <FileText size={compact ? 22 : 24} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className={clsx('font-bold text-stone-900', compact ? 'text-sm' : 'text-base')}>
            {title}
          </h3>
          <p className={clsx('text-stone-600', compact ? 'text-xs' : 'text-sm')}>{description}</p>
          {reason === 'missing' && (
            <div className={clsx('text-stone-700', compact ? 'text-xs' : 'text-sm')}>
              <p className="font-medium text-stone-800 mb-1">Requisitos mínimos:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {REQUIRED_DOCS.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => goToRestaurantSeriesSettings(navigate)}
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-xl bg-rest-600 font-semibold text-white hover:bg-rest-700 transition-colors',
              compact ? 'mt-2 w-full px-4 py-2.5 text-sm' : 'mt-3 px-5 py-2.5 text-sm',
            )}
          >
            <Settings size={16} aria-hidden />
            Configurar series
          </button>
        </div>
      </div>
    </div>
  )
}
