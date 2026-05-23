import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import { companyService } from '@/services/company.service'

type BranchMenuProps = {
  onSelected?: () => void
}

/** Selector de sucursal para el menú del usuario (no va en el header). */
export function BranchSelectorMenu({ onSelected }: BranchMenuProps) {
  const { activeBranch, canSwitchBranch, switchBranch } = useBranch()
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    if (canSwitchBranch) {
      companyService.listBranches().then((b) => setBranches(b ?? [])).catch(() => [])
    }
  }, [canSwitchBranch])

  if (!activeBranch) return null

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

  return (
    <div className="px-1 py-1.5 border-b border-stone-100">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Sucursal</p>
      <ul role="menu">
        {branches.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm rounded-lg mx-1 transition-colors ${
                b.id === activeBranch.id
                  ? 'bg-rest-50 text-rest-800 font-semibold'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
              onClick={() => {
                if (b.id !== activeBranch.id) void switchBranch(b.id)
                onSelected?.()
              }}
            >
              <MapPin size={14} className="shrink-0 text-rest-600" />
              <span className="truncate text-left">{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
