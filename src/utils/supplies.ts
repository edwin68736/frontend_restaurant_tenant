import type { Supply, SupplyInput } from '@/services/supplies.service'

export type SupplyForm = {
  code: string
  name: string
  description: string
  unit_id: number | ''
  min_stock: string
  unit_cost: string
  active: boolean
  expiry_date: string
}

export function emptySupplyForm(defaultUnitId: number | ''): SupplyForm {
  return { code: '', name: '', description: '', unit_id: defaultUnitId, min_stock: '', unit_cost: '', active: true, expiry_date: '' }
}

export function supplyToForm(s: Supply): SupplyForm {
  return {
    code: s.code,
    name: s.name,
    description: s.description ?? '',
    unit_id: s.unit_id ?? '',
    min_stock: s.min_stock ? String(s.min_stock) : '',
    unit_cost: s.unit_cost != null && s.unit_cost > 0 ? String(s.unit_cost) : '',
    active: s.active,
    expiry_date: s.expiry_date ?? '',
  }
}

/** Número >= 0 o null si el texto no lo es. Vacío = 0. Acepta coma decimal (teclado del celular). */
export function parseAmount(value: string): number | null {
  const t = value.trim().replace(',', '.')
  if (t === '') return 0
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Cuerpo de alta o edición. El costo solo viaja con permiso para verlo, y la unidad base solo si cambia: el servidor la rechaza
 * cuando el insumo ya tiene movimientos.
 */
export function buildSupplyInput(form: SupplyForm, opts: { canViewCost: boolean; original?: Supply | null }): SupplyInput | string {
  const name = form.name.trim()
  if (!name) return 'El nombre es requerido'
  if (form.unit_id === '') return 'Elige la unidad base'
  const minStock = parseAmount(form.min_stock)
  if (minStock === null) return 'El stock mínimo no es válido'
  const body: SupplyInput = {
    name,
    description: form.description.trim(),
    min_stock: minStock,
    active: form.active,
    has_expiry_date: form.expiry_date !== '',
  }
  if (form.expiry_date) body.expiry_date = form.expiry_date
  if (form.code.trim()) body.code = form.code.trim()
  if (!opts.original || opts.original.unit_id !== form.unit_id) body.unit_id = form.unit_id
  if (opts.canViewCost) {
    const cost = parseAmount(form.unit_cost)
    if (cost === null) return 'El costo no es válido'
    body.unit_cost = cost
  }
  return body
}

export function isLowStock(s: Pick<Supply, 'stock_total' | 'min_stock'>): boolean {
  return s.min_stock > 0 && s.stock_total <= s.min_stock
}

export function formatQty(n: number): string {
  return Number(n).toLocaleString('es-PE', { maximumFractionDigits: 3 })
}

export function apiError(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}
