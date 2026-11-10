import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'

/** Pantalla que reemplaza a las páginas operativas en el modo consulta "todas las sucursales". */
export function BranchRequiredNotice() {
  const { activeBranch, setViewMode } = useBranch()
  return (
    <div
      role="alert"
      data-testid="branch-required-notice"
      className="m-auto flex max-w-md flex-col items-center gap-3 py-10 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <MapPin size={24} aria-hidden />
      </span>
      <h2 className="text-lg font-bold text-stone-900">Seleccione una sucursal para operar</h2>
      <p className="text-sm text-stone-600">
        Está en modo consulta de todas las sucursales. Esta pantalla (ventas, mesas, comandas, caja y configuración)
        opera sobre una sola sucursal.
      </p>
      <button
        type="button"
        onClick={() => setViewMode('single')}
        className="rounded-xl bg-rest-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rest-700"
      >
        {activeBranch ? `Operar en ${activeBranch.name}` : 'Volver a una sucursal'}
      </button>
    </div>
  )
}

/** Envuelve una ruta operativa: en modo consulta muestra el aviso en vez de la pantalla. */
export function RequireOperationalBranch({ children }: { children: ReactNode }) {
  const { isAllBranches } = useBranch()
  if (isAllBranches) return <BranchRequiredNotice />
  return <>{children}</>
}
