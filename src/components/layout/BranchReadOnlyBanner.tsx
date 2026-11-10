import { Eye } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'

/** Banner permanente del modo consulta: deja claro que se ven todas las sucursales y que no se puede operar. */
export function BranchReadOnlyBanner() {
  const { isAllBranches, activeBranch, setViewMode, switching } = useBranch()
  if (!isAllBranches) return null
  return (
    <div
      role="status"
      data-testid="branch-readonly-banner"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <Eye size={16} className="shrink-0 text-amber-700" aria-hidden />
      <span className="font-semibold">Modo consulta: todas las sucursales</span>
      <span className="hidden text-amber-800 sm:inline">Solo lectura; para operar elija una sucursal.</span>
      <button
        type="button"
        disabled={switching}
        onClick={() => setViewMode('single')}
        className="ml-auto rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
      >
        {activeBranch ? `Operar en ${activeBranch.name}` : 'Volver a una sucursal'}
      </button>
    </div>
  )
}
