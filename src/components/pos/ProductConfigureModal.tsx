import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PortalModal } from '@/components/ui/PortalModal'
import {
  getProductImageUrl,
  productsService,
  type ModifierGroup,
  type Product,
  type ProductPresentation,
} from '@/services/products.service'
import { formatSoles } from '@/utils/format'
import { formatAmountDisplay } from '@/utils/money'
import type { CatalogCartLine } from '@/utils/posCart'
import { createCatalogCartLine } from '@/utils/posCart'
import type { CartModifierEntry } from '@/types/productModifiers'
import {
  calcUnitPriceWithModifiers,
  formatModifierSummary,
  getModifierSetupIssue,
  getProductExtraGroups,
  hasConfigurableModifierUI,
  productNeedsConfiguration,
  selectionFromProductPresentation,
  toggleExtraSelection,
  validateModifierSelection,
} from '@/utils/productModifiers'

type Props = {
  product: Product | null
  onClose: () => void
  onConfirm: (line: CatalogCartLine) => void
}

export function ProductConfigureModal({ product, onClose, onConfirm }: Props) {
  const [loading, setLoading] = useState(false)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [modifierGroupIds, setModifierGroupIds] = useState<number[]>([])
  const [presentations, setPresentations] = useState<ProductPresentation[]>([])
  const [allGroups, setAllGroups] = useState<ModifierGroup[]>([])
  const [selected, setSelected] = useState<CartModifierEntry[]>([])
  const [kitchenNote, setKitchenNote] = useState('')
  const degradedRef = useRef(false)
  const loadGenRef = useRef(0)
  const loadedProductIdRef = useRef<number | null>(null)
  const onConfirmRef = useRef(onConfirm)
  const onCloseRef = useRef(onClose)
  onConfirmRef.current = onConfirm
  onCloseRef.current = onClose

  const productId = product?.id ?? null

  useEffect(() => {
    degradedRef.current = false
    loadedProductIdRef.current = null
    if (!productId) {
      setOptionsLoaded(false)
      setModifierGroupIds([])
      setPresentations([])
      setAllGroups([])
      setSelected([])
      setKitchenNote('')
      return
    }
    const gen = ++loadGenRef.current
    setOptionsLoaded(false)
    setLoading(true)
    setModifierGroupIds([])
    setPresentations([])
    setAllGroups([])
    setSelected([])
    setKitchenNote('')
    Promise.all([productsService.get(productId), productsService.listModifierGroups()])
      .then(([detail, groups]) => {
        if (loadGenRef.current !== gen) return
        const ids = detail.modifier_group_ids ?? []
        const pres = (detail.presentations ?? []).filter((p) => p.name.trim())
        loadedProductIdRef.current = productId
        setModifierGroupIds(ids)
        setPresentations(pres)
        setAllGroups(groups ?? [])
        const auto: CartModifierEntry[] = []
        if (pres.length === 1) {
          auto.push(selectionFromProductPresentation(pres[0]))
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
  }, [productId])

  const extraGroups = useMemo(() => {
    if (!product) return []
    return getProductExtraGroups(modifierGroupIds, allGroups, product)
  }, [product, modifierGroupIds, allGroups])

  const productWithPres = useMemo((): Product | null => {
    if (!product) return null
    return { ...product, presentations }
  }, [product, presentations])

  useEffect(() => {
    if (!productWithPres || productId == null || loadedProductIdRef.current !== productId) return
    if (!optionsLoaded || loading || degradedRef.current) return
    if (!productNeedsConfiguration(productWithPres)) return
    if (hasConfigurableModifierUI(productWithPres, modifierGroupIds, allGroups, presentations)) return
    degradedRef.current = true
    const issue = getModifierSetupIssue(productWithPres, modifierGroupIds, allGroups, presentations)
    toast.warning(issue ?? 'Configuración incompleta; se agrega con precio base.', { duration: 6000 })
    onConfirmRef.current(createCatalogCartLine(productWithPres, { quantity: 1, notes: '' }))
    onCloseRef.current()
  }, [
    productWithPres,
    productId,
    optionsLoaded,
    loading,
    modifierGroupIds,
    allGroups,
    presentations,
  ])

  const basePrice = product ? Number(product.sale_price) || 0 : 0
  const unitPrice = calcUnitPriceWithModifiers(basePrice, selected)

  const selectedPresentation = selected.find((m) => m.type === 'variant')
  const displayBaseLabel = selectedPresentation ? 'Precio de la presentación' : 'Precio base del producto'
  const displayBaseAmount = selectedPresentation
    ? Number(selectedPresentation.extra_price) || basePrice
    : basePrice

  const priceBreakdown = useMemo(() => {
    const lines: { label: string; amount: number; sign: 'none' | 'plus' }[] = []
    const presentation = selected.find((m) => m.type === 'variant')
    const extras = selected.filter((m) => m.type === 'modifier')

    if (!presentation) {
      lines.push({ label: 'Precio base', amount: basePrice, sign: 'none' })
    } else {
      const p = Number(presentation.extra_price) || 0
      lines.push({
        label: presentation.option_name || 'Presentación',
        amount: p > 0 ? p : basePrice,
        sign: 'none',
      })
    }
    for (const m of extras) {
      const amt = Number(m.extra_price) || 0
      if (amt !== 0) lines.push({ label: m.option_name, amount: amt, sign: 'plus' })
    }
    return lines
  }, [basePrice, selected])

  const handleConfirm = () => {
    if (!productWithPres || productId == null || loadedProductIdRef.current !== productId) return
    const err = validateModifierSelection(presentations, extraGroups, selected, productWithPres)
    if (err) {
      toast.error(err)
      return
    }
    degradedRef.current = true
    onConfirmRef.current(
      createCatalogCartLine(productWithPres, {
        quantity: 1,
        notes: kitchenNote,
        modifiers: selected,
        base_price: basePrice,
      }),
    )
    onCloseRef.current()
  }

  if (!product) return null

  const imgUrl = getProductImageUrl(product.image_url)
  const activePresentations = presentations.filter((p) => p.name.trim())

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
              <p className="text-sm text-stone-600">{displayBaseLabel}</p>
              <p className="text-xl font-bold text-rest-600 tabular-nums">{formatSoles(displayBaseAmount)}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-rest-600" />
            </div>
          ) : (
            <>
              {activePresentations.length > 0 && (
                <div className="rounded-xl border-2 border-sky-200 bg-sky-50/60 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
                      Presentación del producto
                    </p>
                    <p className="text-[11px] text-sky-700/90 mt-0.5">
                      Elige una. Su precio reemplaza el precio base (no se suma).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activePresentations.map((pres) => {
                      const active = selected.some(
                        (s) =>
                          s.type === 'variant' &&
                          (pres.id ? s.option_id === pres.id : s.option_name === pres.name.trim()),
                      )
                      const salePrice = Number(pres.sale_price) || 0
                      return (
                        <button
                          key={pres.id ?? pres.name}
                          type="button"
                          onClick={() =>
                            setSelected((prev) => [
                              ...prev.filter((s) => s.type !== 'variant'),
                              selectionFromProductPresentation(pres),
                            ])
                          }
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                            active
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-stone-800 border-sky-200 hover:border-sky-400'
                          }`}
                        >
                          {pres.name}
                          {salePrice > 0 ? (
                            <span className="block text-[11px] font-normal opacity-90 tabular-nums">
                              S/ {formatAmountDisplay(salePrice)}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {extraGroups.length > 0 && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                      Extras y adicionales
                    </p>
                    <p className="text-[11px] text-amber-800/90 mt-0.5">Se suman al precio elegido.</p>
                  </div>
                  {extraGroups.map((g) => (
                    <section key={g.id}>
                      <p className="text-xs font-semibold text-stone-800 mb-2">
                        {g.name}
                        {g.required ? <span className="text-red-600"> *</span> : null}
                        {g.multi_select ? (
                          <span className="text-stone-500 font-normal"> (varios)</span>
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
                              onClick={() =>
                                setSelected((prev) => toggleExtraSelection(prev, g, opt.id))
                              }
                              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                                active
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-white text-stone-800 border-amber-200 hover:border-amber-400'
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
                </div>
              )}

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
                <p className="text-xs font-semibold text-stone-600 mb-1">Resumen de precio</p>
                {priceBreakdown.map((row) => (
                  <div key={row.label} className="flex justify-between text-sm text-stone-700">
                    <span>{row.sign === 'plus' ? `+ ${row.label}` : row.label}</span>
                    <span className="tabular-nums">
                      {row.sign === 'plus' ? '+' : ''}
                      {formatSoles(row.amount)}
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
