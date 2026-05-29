import { useEffect, useState } from 'react'
import { companyService } from '@/services/company.service'

type BranchOption = { id: number; name: string; is_main?: boolean }

type Props = {
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function StaffBranchMultiSelect({ value, onChange, disabled }: Props) {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    companyService
      .listBranches()
      .then((rows) => setBranches((rows ?? []).filter((b) => b.active !== false)))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: number) => {
    if (disabled) return
    if (value.includes(id)) {
      if (value.length <= 1) return
      onChange(value.filter((x) => x !== id))
      return
    }
    onChange([...value, id].sort((a, b) => a - b))
  }

  if (loading) {
    return <p className="text-xs text-stone-500">Cargando sucursales…</p>
  }

  if (!branches.length) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
        Registre sucursales en Ajustes antes de asignar usuarios.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {branches.map((b) => {
          const checked = value.includes(b.id)
          return (
            <label
              key={b.id}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                checked
                  ? 'border-rest-400 bg-rest-50 text-rest-900'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                className="rounded border-stone-300 accent-rest-600"
                checked={checked}
                disabled={disabled || (checked && value.length <= 1)}
                onChange={() => toggle(b.id)}
              />
              <span>
                {b.name}
                {b.is_main ? <span className="text-[10px] text-stone-500 ml-1">(principal)</span> : null}
              </span>
            </label>
          )
        })}
      </div>
      <p className="text-[11px] text-stone-500">
        Seleccione una o más sucursales. Con varias, el usuario podrá cambiar de local desde el menú.
      </p>
    </div>
  )
}
