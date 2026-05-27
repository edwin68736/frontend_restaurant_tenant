import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PortalModal } from '@/components/ui/PortalModal'
import {
  getProductImageUrl,
  productsService,
  type ModifierGroup,
  type Product,
} from '@/services/products.service'
import { formatSoles } from '@/utils/format'
import { formatAmountDisplay } from '@/utils/money'
import type { CatalogCartLine } from '@/utils/posCart'
import { createCatalogCartLine } from '@/utils/posCart'
import type { CartModifierEntry } from '@/types/productModifiers'
import {
  calcUnitPriceWithModifiers,
  classifyModifierGroups,
  formatModifierSummary,
  selectionFromVariant,
  toggleModifierSelection,
  getModifierSetupIssue,
  hasConfigurableModifierUI,
  productNeedsConfiguration,
  validateModifierSelection,
} from '@/utils/productModifiers'

type Props = {
  product: Product | null
  onClose: () => void
  onConfirm: (line: CatalogCartLine) => void
}

export function ProductConfigureModal({ product, onClose, onConfirm }: Props) {
  const [loading, setLoading] = useState(false)
  /** true solo después de que GET producto + grupos terminó (evita degradar antes de cargar vínculos). */
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [modifierGroupIds, setModifierGroupIds] = useState<number[]>([])
  const [allGroups, setAllGroups] = useState<ModifierGroup[]>([])
  const [selected, setSelected] = useState<CartModifierEntry[]>([])
  const [kitchenNote, setKitchenNote] = useState('')
  const degradedRef = useRef(false)
  const loadGenRef = useRef(0)

  useEffect(() => {
    degradedRef.current = false
    if (!product) {
      setOptionsLoaded(false)
      setModifierGroupIds([])
      setAllGroups([])
      return
    }
    const gen = ++loadGenRef.current
    setOptionsLoaded(false)
    setLoading(true)
    setModifierGroupIds([])
    setAllGroups([])
    setSelected([])
    setKitchenNote('')
    Promise.all([productsService.get(product.id), productsService.listModifierGroups()])
      .then(([detail, groups]) => {
        if (loadGenRef.current !== gen) return
        const ids = detail.modifier_group_ids ?? []
        setModifierGroupIds(ids)
        setAllGroups(groups ?? [])
        const { variantGroups } = classifyModifierGroups(ids, groups ?? [], product)
        const auto: CartModifierEntry[] = []
        for (const g of variantGroups) {
          const opts = g.options ?? []
          if (opts.length === 1) {
            const entry = selectionFromVariant(g, opts[0].id)
            if (entry) auto.push(entry)
          }
        }
        setSelected(auto)
      })
      .catch(() => {
        if (loadGenRef.current === gen) toast.error('No se pudieron cargar las opciones del producto')
      })
      .finally(() => {
        if (loadGenRef.current !== gen) return
        setLoading(false)
        setOptionsLoaded(true)
      })
  }, [product])

  const { variantGroups, modifierGroups } = useMemo(() => {
    if (!product) return { variantGroups: [] as ModifierGroup[], modifierGroups: [] as ModifierGroup[] }
    return classifyModifierGroups(modifierGroupIds, allGroups, product)
  }, [product, modifierGroupIds, allGroups])

  useEffect(() => {
    if (!product || !optionsLoaded || loading || degradedRef.current) return
    if (!productNeedsConfiguration(product)) return
    if (hasConfigurableModifierUI(product, modifierGroupIds, allGroups)) return
    degradedRef.current = true
    const issue = getModifierSetupIssue(product, modifierGroupIds, allGroups)
    toast.warning(issue ?? 'Configuración incompleta; se agrega con precio base.', { duration: 6000 })
    onConfirm(createCatalogCartLine(product, { quantity: 1, notes: '' }))
    onClose()
  }, [product, optionsLoaded, loading, modifierGroupIds, allGroups, onConfirm, onClose])

  const basePrice = product ? Number(product.sale_price) || 0 : 0
  const unitPrice = calcUnitPriceWithModifiers(basePrice, selected)

  const priceBreakdown = useMemo(() => {
    const lines: { label: string; amount: number }[] = [{ label: 'Precio base', amount: basePrice }]
    for (const m of selected) {
      const amt = Number(m.extra_price) || 0
      if (amt !== 0) {
        lines.push({
          label: m.type === 'variant' ? m.option_name : `+ ${m.option_name}`,
          amount: amt,
        })
      }
    }
    return lines
  }, [basePrice, selected])

  const handleConfirm = () => {
    if (!product) return
    const err = validateModifierSelection(variantGroups, modifierGroups, selected)
    if (err) {
      toast.error(err)
      return
    }
    const line = createCatalogCartLine(product, {
      quantity: 1,
      notes: kitchenNote,
      modifiers: selected,
      base_price: basePrice,
    })
    onConfirm(line)
    onClose()
  }

  if (!product) return null

  const imgUrl = getProductImageUrl(product.image_url)

  return (
    <PortalModal open onClose={onClose} className="max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-stone-200 shrink-0">
          <h3 className="font-bold text-stone-900 text-lg leading-tight">{product.name}</h3>
          {product.description?.trim() ? (
            <p className="text-xs text-stone-500 mt-1 line-clamp-2">{product.description}</p>
          ) : null}
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          <div className="flex gap-3 items-start">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt=""
                className="w-20 h-20 rounded-xl object-cover border border-stone-200 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-stone-100 border border-stone-200 shrink-0" />
            )}
            <div>
              <p className="text-sm text-stone-600">Precio base</p>
              <p className="text-xl font-bold text-rest-600 tabular-nums">{formatSoles(basePrice)}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-rest-600" />
            </div>
          ) : (
            <>
              {variantGroups.map((g) => (
                <section key={g.id}>
                  <p className="text-xs font-semibold text-stone-700 mb-2">
                    {g.name}
                    {g.required ? <span className="text-red-600"> *</span> : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(g.options ?? []).map((opt) => {
                      const active = selected.some(
                        (s) => s.type === 'variant' && s.option_id === opt.id,
                      )
                      const extra = Number(opt.extra_price) || 0
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setSelected((prev) => {
                              const without = prev.filter(
                                (s) => !(s.type === 'variant' && s.group_id === g.id),
                              )
                              const entry = selectionFromVariant(g, opt.id)
                              return entry ? [...without, entry] : without
                            })
                          }
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                            active
                              ? 'bg-rest-600 text-white border-rest-600'
                              : 'bg-white text-stone-800 border-stone-200 hover:border-rest-400'
                          }`}
                        >
                          {opt.name}
                          {extra > 0 ? ` (+S/ ${formatAmountDisplay(extra)})` : ''}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}

              {modifierGroups.map((g) => (
                <section key={g.id}>
                  <p className="text-xs font-semibold text-stone-700 mb-2">
                    {g.name}
                    {g.required ? <span className="text-red-600"> *</span> : null}
                    {g.multi_select ? (
                      <span className="text-stone-400 font-normal"> (varios)</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(g.options ?? []).map((opt) => {
                      const active = selected.some(
                        (s) => s.type === 'modifier' && s.option_id === opt.id,
                      )
                      const extra = Number(opt.extra_price) || 0
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelected((prev) => toggleModifierSelection(prev, g, opt.id))}
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                            active
                              ? 'bg-amber-100 text-amber-950 border-amber-400'
                              : 'bg-white text-stone-800 border-stone-200 hover:border-amber-300'
                          }`}
                        >
                          {active ? '✓ ' : ''}
                          {opt.name}
                          {extra > 0 ? ` (+S/ ${formatAmountDisplay(extra)})` : ''}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}

              <section>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Nota para cocina (opcional)
                </label>
                <textarea
                  value={kitchenNote}
                  onChange={(e) => setKitchenNote(e.target.value)}
                  placeholder="Ej: sin cebolla, poco ají…"
                  maxLength={500}
                  rows={2}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm min-h-[52px]"
                />
              </section>

              <section className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1">
                <p className="text-xs font-semibold text-stone-600 mb-1">Resumen</p>
                {priceBreakdown.map((row) => (
                  <div key={row.label} className="flex justify-between text-sm text-stone-700">
                    <span>{row.label}</span>
                    <span className="tabular-nums">
                      {row.amount >= 0 ? '+' : ''}
                      {formatSoles(Math.abs(row.amount))}
                    </span>
                  </div>
                ))}
                {selected.length > 0 && (
                  <p className="text-[11px] text-stone-500 pt-1">{formatModifierSummary(selected)}</p>
                )}
                <div className="flex justify-between font-bold text-stone-900 pt-2 border-t border-stone-200 text-base">
                  <span>Total unitario</span>
                  <span className="text-rest-600 tabular-nums">{formatSoles(unitPrice)}</span>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="p-4 border-t border-stone-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 min-h-[48px] py-2.5 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:bg-rest-700 disabled:opacity-50"
          >
            Agregar al pedido
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
