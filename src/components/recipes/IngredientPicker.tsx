import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch'
import { suppliesService, type Supply } from '@/services/supplies.service'
import { apiError } from '@/utils/supplies'
import { unitLabel } from '@/utils/recipes'
import { SUPPLY_INPUT } from '@/components/supplies/SupplyModalShell'

type Props = { branchId?: number; exclude: number[]; onPick: (s: Supply) => void }

/** Buscar un insumo para añadirlo a la receta. */
export function IngredientPicker({ branchId, exclude, onPick }: Props) {
  const search = useDebouncedSearch()
  const [results, setResults] = useState<Supply[]>([])
  const q = search.effectiveQuery ?? ''
  const typed = search.inputValue.trim() !== ''

  useEffect(() => {
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    suppliesService
      .list({ q, page: 1, per_page: 8, status: 'active', branch_id: branchId })
      .then((r) => {
        if (!cancelled) setResults(r.data)
      })
      .catch((e) => toast.error(apiError(e, 'No se pudieron buscar los insumos')))
    return () => {
      cancelled = true
    }
  }, [q, branchId])

  const options = results.filter((s) => !exclude.includes(s.id))

  return (
    <div>
      <input
        className={SUPPLY_INPUT}
        aria-label="Agregar ingrediente"
        placeholder="Agregar ingrediente: busca un insumo"
        value={search.inputValue}
        onChange={(e) => search.setInputValue(e.target.value)}
      />
      {typed && (
        <ul className="mt-1 max-h-44 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
          {options.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                onClick={() => {
                  onPick(s)
                  search.setInputValue('')
                  setResults([])
                }}
              >
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-xs text-stone-400">{unitLabel(s.unit)}</span>
              </button>
            </li>
          ))}
          {options.length === 0 && <li className="px-3 py-2 text-xs text-stone-500">{search.isDebouncing ? 'Buscando…' : 'Sin insumos que coincidan.'}</li>}
        </ul>
      )}
    </div>
  )
}
