import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PackageMinus, Settings2 } from 'lucide-react'
import { clsx } from 'clsx'
import { PageShell } from '@/components/layout/PageShell'
import { SearchInput } from '@/components/SearchInput'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { recipesService, type Dish } from '@/services/recipes.service'
import { apiError, formatCost } from '@/utils/supplies'
import { dishCategories, dishKey, dishTitle, filterDishes, formatPct, formatPrice, type RecipeStatus } from '@/utils/recipes'
import { SUPPLY_BTN_GHOST, SUPPLY_INPUT } from '@/components/supplies/SupplyModalShell'
import { ConsumptionModal } from '@/components/recipes/ConsumptionModal'
import { RecipeModal } from '@/components/recipes/RecipeModal'
import { RecipeSettingsModal } from '@/components/recipes/RecipeSettingsModal'

const PAGE_SIZE = 60

export default function RecetasPage() {
  const { hasPerm } = useAuth()
  const { activeBranchId, activeBranch } = useBranch()
  const canManage = hasPerm('rc.m')
  // El descuento de insumos al cobrar lo decide quien administra el restaurante.
  const canSetConsumption = hasPerm('s.m')
  const [consumptionOpen, setConsumptionOpen] = useState(false)
  const [params, setParams] = useSearchParams()

  const [dishes, setDishes] = useState<Dish[]>([])
  const [canViewCost, setCanViewCost] = useState(false)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [status, setStatus] = useState<RecipeStatus>('all')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [open, setOpen] = useState<{ productId: number; presentationId: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const load = useCallback(() => {
    recipesService
      .list(activeBranchId)
      .then((r) => {
        setDishes(r.data)
        setCanViewCost(r.canViewCost)
      })
      .catch((e) => {
        setDishes([])
        toast.error(apiError(e, 'No se pudieron cargar las recetas'))
      })
      .finally(() => setLoading(false))
  }, [activeBranchId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])
  useEffect(() => setShown(PAGE_SIZE), [q, categoryId, status])

  // Desde Productos se llega con ?plato=ID: abre su receta.
  useEffect(() => {
    const id = Number(params.get('plato'))
    if (id > 0) {
      setOpen({ productId: id, presentationId: 0 })
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const categories = useMemo(() => dishCategories(dishes), [dishes])
  const filtered = useMemo(() => filterDishes(dishes, { q, categoryId, status }), [dishes, q, categoryId, status])

  return (
    <PageShell
      title="Recetas"
      subtitle={canViewCost ? 'Costo, precio sugerido y para cuántas porciones alcanza cada plato.' : 'Ingredientes y para cuántas porciones alcanza cada plato.'}
      actions={
        canViewCost || canSetConsumption ? (
          <div className="flex flex-wrap items-center gap-2">
            {canSetConsumption && (
              <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'flex items-center gap-1.5')} onClick={() => setConsumptionOpen(true)}>
                <PackageMinus size={16} /> Descuento al cobrar
              </button>
            )}
            {canViewCost && (
              <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'flex items-center gap-1.5')} onClick={() => setSettingsOpen(true)}>
                <Settings2 size={16} /> Precio sugerido
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar plato" />
        </div>
        <select aria-label="Categoría" className={clsx(SUPPLY_INPUT, 'sm:w-48')} value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select aria-label="Estado" className={clsx(SUPPLY_INPUT, 'sm:w-48')} value={status} onChange={(e) => setStatus(e.target.value as RecipeStatus)}>
          <option value="all">Todos</option>
          <option value="none">Sin receta</option>
          {canViewCost && <option value="incomplete">Incompletas</option>}
          {canViewCost && <option value="over">Sobre el objetivo</option>}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-10 text-center text-sm text-stone-500">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">{dishes.length === 0 ? 'Todavía no hay platos en la carta.' : 'Sin resultados.'}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, shown).map((d) => (
              <li key={dishKey(d)}>
                <button
                  type="button"
                  className="flex h-full w-full flex-col gap-1.5 rounded-2xl border border-stone-200 bg-white p-3 text-left hover:border-rest-400"
                  onClick={() => setOpen({ productId: d.product_id, presentationId: d.presentation_id })}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800">{dishTitle(d)}</p>
                      <p className="truncate text-xs text-stone-500">
                        {formatPrice(d.price)}
                        {d.category_name ? ` · ${d.category_name}` : ''}
                        {d.is_combo ? ' · Combo' : ''}
                      </p>
                    </div>
                    {d.available != null && (
                      <div className="shrink-0 text-right">
                        <p className={clsx('text-lg font-bold leading-tight', d.available === 0 ? 'text-red-600' : 'text-stone-800')}>{d.available}</p>
                        <p className="text-[11px] text-stone-500">porciones</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    {!d.has_recipe && <span className="rounded-full bg-stone-100 px-2 py-0.5">Sin receta</span>}
                    {d.incomplete && d.has_recipe && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Incompleta</span>}
                    {d.limiting && <span>Limita {d.limiting}</span>}
                    {d.costing && (
                      <>
                        <span>Costo {formatCost(d.costing.portion_cost)}</span>
                        {!d.costing.current_price_missing && (
                          <span className={clsx(d.costing.over_target && 'rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700')}>
                            Food cost {formatPct(d.costing.food_cost_pct)}
                          </span>
                        )}
                        <span>Sugerido {formatPrice(d.costing.suggested_price)}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && filtered.length > shown && (
          <div className="mt-3 text-center">
            <button type="button" className={SUPPLY_BTN_GHOST} onClick={() => setShown((n) => n + PAGE_SIZE)}>Ver más ({filtered.length - shown})</button>
          </div>
        )}
      </div>

      {open && (
        <RecipeModal
          productId={open.productId}
          presentationId={open.presentationId}
          branchId={activeBranchId}
          branchName={activeBranch?.name ?? ''}
          canManage={canManage}
          canViewCost={canViewCost}
          canApplyPrice={canManage && canViewCost && hasPerm('g.p')}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
      {consumptionOpen && (
        <ConsumptionModal branchId={activeBranchId} branchName={activeBranch?.name ?? ''} onClose={() => setConsumptionOpen(false)} />
      )}
      {settingsOpen && (
        <RecipeSettingsModal
          canManage={canManage}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false)
            load()
          }}
        />
      )}
    </PageShell>
  )
}
