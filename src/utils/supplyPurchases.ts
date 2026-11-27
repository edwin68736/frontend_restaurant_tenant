import type { SupplyPurchaseBody } from '@/services/supplyPurchases.service'
import { parseAmount } from '@/utils/supplies'

export type PurchaseLineForm = {
  supply_id: number
  name: string
  base_unit: string
  /** 0 = unidad base. */
  sale_unit_id: number
  units: { id: number; name: string; factor: number }[]
  quantity: string
  total: string
}

export type PurchaseForm = {
  supplier_id: number
  doc_type: string
  series: string
  number: string
  issue_date: string
  due_date: string
  payment_method: string
  price_includes_igv: boolean
  notes: string
  lines: PurchaseLineForm[]
}

export function emptyPurchaseForm(today: string): PurchaseForm {
  return {
    supplier_id: 0, doc_type: 'FACTURA', series: '', number: '', issue_date: today, due_date: '', payment_method: 'cash',
    price_includes_igv: true, notes: '', lines: [],
  }
}

export function purchaseTotal(lines: PurchaseLineForm[]): number {
  return Math.round(lines.reduce((sum, l) => sum + (parseAmount(l.total) ?? 0), 0) * 100) / 100
}

/** Costo por unidad base que resulta de la línea (solo orientativo: el servidor calcula el definitivo y quita el IGV). */
export function lineBaseCost(line: PurchaseLineForm): number | null {
  const qty = parseAmount(line.quantity)
  const total = parseAmount(line.total)
  if (!qty || !total) return null
  const factor = line.units.find((u) => u.id === line.sale_unit_id)?.factor ?? 1
  return total / (qty * factor)
}

/** Cuerpo de la compra, o el mensaje de lo que falta. */
export function buildPurchaseBody(form: PurchaseForm): SupplyPurchaseBody | string {
  if (!form.supplier_id) return 'Elige el proveedor'
  if (!form.series.trim() || !form.number.trim()) return 'Escribe la serie y el número del comprobante'
  if (form.lines.length === 0) return 'Agrega al menos un insumo'
  const lines: SupplyPurchaseBody['lines'] = []
  for (const l of form.lines) {
    const quantity = parseAmount(l.quantity)
    const total = parseAmount(l.total)
    if (!quantity) return `Indica la cantidad de ${l.name}`
    if (!total) return `Indica el importe de ${l.name}`
    lines.push({ supply_id: l.supply_id, sale_unit_id: l.sale_unit_id || undefined, quantity, line_total: total })
  }
  return {
    supplier_id: form.supplier_id,
    doc_type: form.doc_type,
    series: form.series.trim().toUpperCase(),
    number: form.number.trim(),
    issue_date: form.issue_date,
    due_date: form.payment_method === 'credit' && form.due_date ? form.due_date : undefined,
    payment_method: form.payment_method,
    price_includes_igv: form.price_includes_igv,
    notes: form.notes.trim() || undefined,
    lines,
  }
}
