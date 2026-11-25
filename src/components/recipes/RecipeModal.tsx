import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { recipesService, type PriceChange, type RecipeDetail } from '@/services/recipes.service'
import { apiError, formatCost, formatQty } from '@/utils/supplies'
import {
  buildRecipeBody, defaultUnit, dishToForm, formatPrice, recipeTabs, unitLabel, unitOptions, type RecipeForm, type RecipeLineForm,
} from '@/utils/recipes'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from '@/components/supplies/SupplyModalShell'
import { ApplyPriceModal } from './ApplyPriceModal'
import { CostSummary } from './CostSummary'
import { IngredientPicker } from './IngredientPicker'

type Props = {
  productId: number
  /** Presentación que se abre primero (0 = el plato o la receta común). */
  presentationId: number
  branchId?: number
  branchName: string
  canManage: boolean
  canViewCost: boolean
  canApplyPrice: boolean
  onClose: () => void
  /** Se guardó, quitó o cambió el precio: la lista debe recargarse. */
  onChanged: () => void
}

export function RecipeModal(props: Props) {
  const { productId, branchId, canManage, canViewCost, onClose, onChanged } = props
  const [detail, setDetail] = useState<RecipeDetail | null>(null)
  const [failed, setFailed] = useState('')
  const [tabId, setTabId] = useState(props.presentationId)
  const [form, setForm] = useState<RecipeForm>(dishToForm(null))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [applying, setApplying] = useState(false)
  const [history, setHistory] = useState<PriceChange[] | null>(null)

  const tabs = detail ? recipeTabs(detail) : []
  const tab = tabs.find((t) => t.presentationId === tabId) ?? tabs[0]
  const dish = tab?.dish ?? null
  const isCombo = !!dish?.is_combo
  const editable = canManage && !isCombo

  const show = useCallback((d: RecipeDetail, presentationId: number) => {
    const list = recipeTabs(d)
    const next = list.find((t) => t.presentationId === presentationId) ?? list[0]
    setDetail(d)
    setTabId(next?.presentationId ?? 0)
    setForm(dishToForm(next?.dish ?? null))
    setDirty(false)
    setHistory(null)
  }, [])

  const load = useCallback(
    (presentationId: number) => {
      recipesService
        .get(productId, branchId)
        .then((d) => show(d, presentationId))
        .catch((e) => setFailed(apiError(e, 'No se pudo cargar la receta')))
    },
    [productId, branchId, show],
  )

  useEffect(() => load(props.presentationId), [load, props.presentationId])

  const patch = (next: Partial<RecipeForm>) => {
    setForm((f) => ({ ...f, ...next }))
    setDirty(true)
  }
  const patchLine = (supplyId: number, next: Partial<RecipeLineForm>) =>
    patch({ lines: form.lines.map((l) => (l.supply_id === supplyId ? { ...l, ...next } : l)) })

  const selectTab = (id: number) => {
    if (id === tabId) return
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    if (detail) show(detail, id)
  }

  const close = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    onClose()
  }

  const save = async () => {
    if (!tab) return
    const body = buildRecipeBody(form, tab.presentationId)
    if (typeof body === 'string') {
      toast.error(body)
      return
    }
    setSaving(true)
    try {
      show(await recipesService.save(productId, body, branchId), tab.presentationId)
      toast.success('Receta guardada')
      onChanged()
    } catch (e) {
      toast.error(apiError(e, 'No se pudo guardar la receta'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!tab) return
    setSaving(true)
    try {
      show(await recipesService.remove(productId, tab.presentationId, branchId), tab.presentationId)
      toast.success('Receta quitada')
      onChanged()
    } catch (e) {
      toast.error(apiError(e, 'No se pudo quitar la receta'))
    } finally {
      setSaving(false)
      setConfirmRemove(false)
    }
  }

  const loadHistory = () => {
    recipesService
      .priceHistory(productId, branchId)
      .then(setHistory)
      .catch((e) => toast.error(apiError(e, 'No se pudo cargar el historial')))
  }

  // Los costos por línea son los de lo guardado: con cambios pendientes ya no corresponden.
  const savedLine = (supplyId: number) => (dirty ? undefined : dish?.lines?.find((l) => l.supply_id === supplyId))
  const title = detail?.data[0]?.name ?? 'Receta'

  return (
    <>
      <SupplyModalShell
        wide
        title={title}
        subtitle={isCombo ? 'Combo: su costo sale de las recetas de sus componentes' : 'Receta'}
        onClose={close}
        footer={
          <>
            {editable && tab?.own && (
              <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'mr-auto !text-red-700')} disabled={saving} onClick={() => setConfirmRemove(true)}>
                Quitar receta
              </button>
            )}
            <button type="button" className={SUPPLY_BTN_GHOST} onClick={close}>Cerrar</button>
            {editable && (
              <button type="button" className={SUPPLY_BTN_PRIMARY} disabled={saving || !detail} onClick={save}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </>
        }
      >
        {failed ? (
          <p className="py-6 text-center text-sm text-red-600">{failed}</p>
        ) : !detail || !tab ? (
          <p className="py-6 text-center text-sm text-stone-500">Cargando…</p>
        ) : (
          <div className="space-y-3">
            {tabs.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.presentationId}
                    type="button"
                    role="tab"
                    aria-selected={t.presentationId === tab.presentationId}
                    className={clsx(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium',
                      t.presentationId === tab.presentationId ? 'bg-rest-600 text-white' : 'bg-stone-100 text-stone-600',
                    )}
                    onClick={() => selectTab(t.presentationId)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {tabs.length > 1 && tab.presentationId === 0 && (
              <p className="text-xs text-stone-500">La usan las presentaciones que no tengan receta propia.</p>
            )}
            {tab.presentationId > 0 && dish?.inherited && (
              <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">Usa la receta de todas las presentaciones. Si la guardas aquí, tendrá una propia.</p>
            )}

            {dish && (dish.has_recipe || isCombo) && !dirty && <CostSummary dish={dish} />}
            {dirty && <p className="text-xs text-stone-500">Guarda para ver el costo y la disponibilidad con estos cambios.</p>}

            {dish && !dirty && props.canApplyPrice && dish.costing && tab.presentationId === dish.presentation_id && (tabs.length === 1 || tab.presentationId > 0) && (
              <button type="button" className={SUPPLY_BTN_GHOST} onClick={() => setApplying(true)}>Aplicar precio…</button>
            )}

            {isCombo ? (
              <p className="text-xs text-stone-500">Para completar un combo, crea la receta de cada plato que lo compone. Los extras no se costean.</p>
            ) : (
              <>
                {form.lines.length === 0 && <p className="text-sm text-stone-500">Este plato todavía no tiene receta.</p>}
                <ul className="space-y-2">
                  {form.lines.map((l) => {
                    const saved = savedLine(l.supply_id)
                    return (
                      <li key={l.supply_id} className="rounded-xl border border-stone-200 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-stone-800">{l.name}</p>
                          {editable && (
                            <button type="button" aria-label={`Quitar ${l.name}`} className="rounded-lg p-1 text-stone-400 hover:text-red-600" onClick={() => patch({ lines: form.lines.filter((x) => x.supply_id !== l.supply_id) })}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                          <label>
                            <span className={SUPPLY_LABEL}>Cantidad</span>
                            <input className={SUPPLY_INPUT} inputMode="decimal" value={l.quantity} disabled={!editable} onChange={(e) => patchLine(l.supply_id, { quantity: e.target.value })} />
                          </label>
                          <label>
                            <span className={SUPPLY_LABEL}>Unidad</span>
                            <select className={SUPPLY_INPUT} value={l.unit} disabled={!editable} onChange={(e) => patchLine(l.supply_id, { unit: e.target.value })}>
                              {unitOptions(l.base_unit).map((u) => (
                                <option key={u} value={u}>{unitLabel(u)}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className={SUPPLY_LABEL}>Merma %</span>
                            <input className={SUPPLY_INPUT} inputMode="decimal" placeholder="0" value={l.waste} disabled={!editable} onChange={(e) => patchLine(l.supply_id, { waste: e.target.value })} />
                          </label>
                        </div>
                        {saved && (
                          <p className="mt-1 text-[11px] text-stone-500">
                            Stock {formatQty(saved.stock)} {unitLabel(l.base_unit)}
                            {canViewCost && saved.line_cost != null && <> · cuesta {formatCost(saved.line_cost)} ({formatCost(saved.supply_cost ?? 0)} por {unitLabel(l.base_unit)})</>}
                            {canViewCost && saved.cost_missing && <span className="text-amber-800"> · sin costo registrado</span>}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {editable && (
                  <IngredientPicker
                    branchId={branchId}
                    exclude={form.lines.map((l) => l.supply_id)}
                    onPick={(s) =>
                      patch({ lines: [...form.lines, { supply_id: s.id, name: s.name, base_unit: s.unit, unit: defaultUnit(s.unit), quantity: '', waste: '' }] })
                    }
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className={SUPPLY_LABEL}>Rinde (porciones)</span>
                    <input className={SUPPLY_INPUT} inputMode="decimal" value={form.yield} disabled={!editable} onChange={(e) => patch({ yield: e.target.value })} />
                  </label>
                  {canViewCost && (
                    <label>
                      <span className={SUPPLY_LABEL}>Food cost objetivo propio (%)</span>
                      <input className={SUPPLY_INPUT} inputMode="decimal" placeholder="El general" value={form.target} disabled={!editable} onChange={(e) => patch({ target: e.target.value })} />
                    </label>
                  )}
                </div>
              </>
            )}

            {canViewCost && (
              <div>
                {history === null ? (
                  <button type="button" className="text-xs font-medium text-rest-700" onClick={loadHistory}>Ver cambios de precio</button>
                ) : history.length === 0 ? (
                  <p className="text-xs text-stone-500">Aún no se aplicó ningún precio desde recetas.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 text-xs text-stone-600">
                    {history.map((h) => (
                      <li key={h.id} className="py-1.5">
                        {new Date(h.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })} · {formatPrice(h.price_before)} → <strong>{formatPrice(h.price_after)}</strong>
                        {h.presentation_id > 0 ? ` · ${tabs.find((t) => t.presentationId === h.presentation_id)?.label ?? 'presentación'}` : h.branch_id > 0 ? ' · precio de la sucursal' : ' · precio general'}
                        {h.user_name ? ` · ${h.user_name}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </SupplyModalShell>

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        loading={saving}
        variant="danger"
        title="Quitar receta"
        message={tab && tab.presentationId > 0 ? 'La presentación volverá a usar la receta común, si existe.' : 'Se borran sus ingredientes. El plato y su precio no cambian.'}
        confirmLabel="Quitar"
      />

      {applying && dish && (
        <ApplyPriceModal
          dish={dish}
          branchId={branchId}
          branchName={props.branchName}
          onClose={() => setApplying(false)}
          onDone={() => {
            setApplying(false)
            load(tabId)
            onChanged()
          }}
        />
      )}
    </>
  )
}
