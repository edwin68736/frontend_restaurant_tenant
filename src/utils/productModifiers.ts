import type { ModifierGroup } from '@/services/products.service'
import type { Product } from '@/services/products.service'
import type { CartModifierEntry, StoredModifierEntry } from '@/types/productModifiers'
import { formatAmountDisplay } from '@/utils/money'

export function productNeedsConfiguration(product: Product): boolean {
  return !!(product.has_modifiers || product.has_variants)
}

/** Una sola opción obligatoria (tamaño, término, etc.). */
export function isVariantLikeGroup(g: ModifierGroup): boolean {
  return !!(g.required && !g.multi_select)
}

/** Extras opcionales o multi-selección. */
export function isModifierLikeGroup(g: ModifierGroup): boolean {
  return !!(g.multi_select || !g.required)
}

/** Grupos asignados al producto, separados para el modal de configuración. */
export function classifyModifierGroups(
  modifierGroupIds: number[],
  allGroups: ModifierGroup[],
  product: Product,
): { variantGroups: ModifierGroup[]; modifierGroups: ModifierGroup[] } {
  const assigned = allGroups.filter((g) => modifierGroupIds.includes(g.id))
  const canVariants = !!(product.has_variants || product.has_modifiers)
  const variantGroups = canVariants ? assigned.filter(isVariantLikeGroup) : []
  const modifierGroups = product.has_modifiers ? assigned.filter(isModifierLikeGroup) : []
  return { variantGroups, modifierGroups }
}

/** Motivo por el que el modal no puede mostrar opciones (para mensajes al mozo). */
export function getModifierSetupIssue(
  product: Product,
  modifierGroupIds: number[],
  allGroups: ModifierGroup[],
): string | null {
  if (!productNeedsConfiguration(product)) return null
  if (modifierGroupIds.length === 0) {
    return 'Tienes grupos en Modificadores, pero este producto no tiene ninguno vinculado. Ve a Productos → editar → marca los grupos y Guardar.'
  }
  const assigned = allGroups.filter((g) => modifierGroupIds.includes(g.id))
  if (assigned.length === 0) {
    return 'Los grupos asignados no existen o están inactivos. Revisa Modificadores y Productos.'
  }
  const { variantGroups, modifierGroups } = classifyModifierGroups(modifierGroupIds, allGroups, product)
  const visible = [...variantGroups, ...modifierGroups]
  if (visible.length === 0) {
    return 'Los grupos asignados no coinciden con variantes/extras. En Modificadores: obligatorio sin «varios» = variante; «varios» = extras.'
  }
  if (!hasConfigurableModifierUI(product, modifierGroupIds, allGroups)) {
    return 'Los grupos asignados no tienen opciones. Agrega opciones en Modificadores (panel tenant si gestionas precios allí).'
  }
  return null
}

export function calcUnitPriceWithModifiers(
  basePrice: number,
  modifiers: CartModifierEntry[],
): number {
  const extras = modifiers.reduce((s, m) => s + (Number(m.extra_price) || 0), 0)
  return roundMoney(basePrice + extras)
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function normalizeKitchenNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ')
}

export function buildConfigureKey(modifiers: CartModifierEntry[], kitchenNote: string): string {
  const modPart = modifiers
    .map((m) => `${m.type}:${m.option_id}`)
    .sort()
    .join('|')
  return `p-${modPart}-n-${normalizeKitchenNote(kitchenNote)}`
}

/** Indica si el producto tiene al menos un grupo con opciones configurables en UI. */
export function hasConfigurableModifierUI(
  product: Product,
  modifierGroupIds: number[],
  allGroups: ModifierGroup[],
): boolean {
  const { variantGroups, modifierGroups } = classifyModifierGroups(
    modifierGroupIds,
    allGroups,
    product,
  )
  const withOptions = (groups: ModifierGroup[]) =>
    groups.some((g) => (g.options?.length ?? 0) > 0)
  return withOptions(variantGroups) || withOptions(modifierGroups)
}

export function validateModifierSelection(
  variantGroups: ModifierGroup[],
  modifierGroups: ModifierGroup[],
  selected: CartModifierEntry[],
): string | null {
  for (const g of variantGroups) {
    const picked = selected.filter((s) => s.group_id === g.id && s.type === 'variant')
    if (g.required && picked.length !== 1) {
      return `Elige una opción en «${g.name}»`
    }
    if (!g.required && picked.length > 1) {
      return `Solo una opción en «${g.name}»`
    }
  }
  for (const g of modifierGroups) {
    const picked = selected.filter((s) => s.group_id === g.id && s.type === 'modifier')
    if (g.required && picked.length === 0) {
      return `Elige al menos una opción en «${g.name}»`
    }
    if (!g.multi_select && picked.length > 1) {
      return `Solo una opción en «${g.name}»`
    }
  }
  return null
}

export function selectionFromVariant(
  group: ModifierGroup,
  optionId: number,
): CartModifierEntry | null {
  const opt = group.options?.find((o) => o.id === optionId)
  if (!opt) return null
  return {
    group_id: group.id,
    group_name: group.name,
    type: 'variant',
    option_id: opt.id,
    option_name: opt.name,
    extra_price: Number(opt.extra_price) || 0,
  }
}

export function toggleModifierSelection(
  selected: CartModifierEntry[],
  group: ModifierGroup,
  optionId: number,
): CartModifierEntry[] {
  const opt = group.options?.find((o) => o.id === optionId)
  if (!opt) return selected
  const entry: CartModifierEntry = {
    group_id: group.id,
    group_name: group.name,
    type: 'modifier',
    option_id: opt.id,
    option_name: opt.name,
    extra_price: Number(opt.extra_price) || 0,
  }
  const exists = selected.some((s) => s.type === 'modifier' && s.option_id === opt.id)
  if (exists) {
    return selected.filter((s) => !(s.type === 'modifier' && s.option_id === opt.id))
  }
  if (!group.multi_select) {
    return [...selected.filter((s) => !(s.type === 'modifier' && s.group_id === group.id)), entry]
  }
  return [...selected, entry]
}

function normalizeStoredType(x: StoredModifierEntry & { type?: string; group_type?: string }): 'variant' | 'modifier' {
  const t = x.type ?? x.group_type
  return t === 'variant' ? 'variant' : 'modifier'
}

/** Lee snapshot histórico desde BD. No consulta catálogo. */
export function parseStoredModifiers(raw: string | null | undefined): StoredModifierEntry[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: StoredModifierEntry[] = []
    for (const row of parsed) {
      if (row == null || typeof row !== 'object') continue
      const x = row as StoredModifierEntry & { name?: string }
      const option_name = String(x.option_name ?? x.name ?? '').trim()
      const option_id = Number(x.option_id) || 0
      if (!option_name && option_id <= 0) continue
      const type = normalizeStoredType(x)
      out.push({
        group_id: Number(x.group_id) || 0,
        group_name: String(x.group_name ?? ''),
        type,
        group_type: type,
        group_required: !!x.group_required,
        option_id,
        option_name,
        extra_price: Number(x.extra_price) || 0,
        snapshot: x.snapshot !== false,
      })
    }
    return out
  } catch {
    return []
  }
}

export function storedToCartModifiers(entries: StoredModifierEntry[]): CartModifierEntry[] {
  return entries
    .filter((e) => (e.option_name ?? '').trim() !== '' || (Number(e.option_id) || 0) > 0)
    .map((e) => ({
      group_id: Number(e.group_id) || 0,
      group_name: String(e.group_name ?? ''),
      type: e.type === 'variant' ? 'variant' : 'modifier',
      option_id: Number(e.option_id) || 0,
      option_name: String(e.option_name ?? '').trim() || 'Opción',
      extra_price: Number(e.extra_price) || 0,
    }))
}

export function modifiersToJson(modifiers: CartModifierEntry[]): string {
  if (modifiers.length === 0) return ''
  const payload: StoredModifierEntry[] = modifiers.map((m) => ({
    group_id: m.group_id,
    group_name: m.group_name,
    type: m.type,
    group_type: m.type,
    option_id: m.option_id,
    option_name: m.option_name,
    extra_price: m.extra_price,
    snapshot: true,
  }))
  return JSON.stringify(payload)
}

/** Líneas para UI / cocina bajo el nombre del producto. */
export function formatModifierLines(modifiers: StoredModifierEntry[] | CartModifierEntry[]): string[] {
  const lines: string[] = []
  for (const m of modifiers) {
    const label = String(m.option_name ?? (m as StoredModifierEntry).name ?? '').trim()
    if (!label) continue
    if (m.type === 'variant') {
      const price = Number(m.extra_price) || 0
      lines.push(price > 0 ? `${label} (+S/ ${formatAmountDisplay(price)})` : label)
    } else {
      const price = Number(m.extra_price) || 0
      lines.push(price > 0 ? `+ ${label} (+S/ ${formatAmountDisplay(price)})` : `+ ${label}`)
    }
  }
  return lines
}

/** Resumen corto para carrito (ej. "1L · + Tocino"). */
export function formatModifierSummary(modifiers: CartModifierEntry[] | StoredModifierEntry[]): string {
  const parts = formatModifierLines(modifiers)
  return parts.join(' · ')
}
