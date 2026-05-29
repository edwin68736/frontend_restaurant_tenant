import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import { companyService } from '@/services/company.service'

type BranchMenuProps = {
  onSelected?: () => void
}

const selectClass =
  'w-full rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-sm text-stone-800 shadow-sm ' +
  'focus:border-rest-400 focus:outline-none focus:ring-2 focus:ring-rest-500/25 ' +
  'disabled:cursor-wait disabled:opacity-60 appearance-none bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat'

/** Selector de sucursal para el menú del usuario (no va en el header). */
export function BranchSelectorMenu({ onSelected }: BranchMenuProps) {
  const { activeBranch, allowedBranches, canSwitchBranch, switchBranch } = useBranch()
  const [fallbackBranches, setFallbackBranches] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!canSwitchBranch || allowedBranches.length > 0) return
    setLoading(true)
    companyService
      .listBranches()
      .then((b) => setFallbackBranches((b ?? []).filter((x) => x.active !== false).map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => setFallbackBranches([]))
      .finally(() => setLoading(false))
  }, [canSwitchBranch, allowedBranches.length])

  if (!activeBranch) return null

  const options =
    allowedBranches.length > 0
      ? allowedBranches.map((b) => ({ id: b.id, name: b.name }))
      : fallbackBranches.length > 0
        ? fallbackBranches
        : [{ id: activeBranch.id, name: activeBranch.name }]

  if (!canSwitchBranch) {
    return (
      <div className="px-3 py-2 border-b border-stone-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Sucursal</p>
        <p className="flex items-center gap-2 text-sm text-stone-700">
          <MapPin size={14} className="text-rest-600 shrink-0" />
          <span className="truncate">{activeBranch.name}</span>
        </p>
      </div>
    )
  }

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branchId = Number(e.target.value)
    if (!branchId || branchId === activeBranch.id) return
    setSwitching(true)
    try {
      await switchBranch(branchId)
      onSelected?.()
    } catch {
      e.target.value = String(activeBranch.id)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="px-3 py-2 border-b border-stone-100">
      <label htmlFor="branch-select-menu" className="block text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
        Sucursal
      </label>
      <div className="relative">
        <MapPin
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-rest-600"
          aria-hidden
        />
        <select
          id="branch-select-menu"
          value={activeBranch.id}
          disabled={loading || switching}
          onChange={(e) => void handleChange(e)}
          className={selectClass}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          }}
        >
          {loading && options.length <= 1 ? (
            <option value={activeBranch.id}>{activeBranch.name}</option>
          ) : (
            options.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  )
}
