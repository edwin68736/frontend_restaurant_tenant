import type { Product } from '@/services/products.service'
import { calcItem } from '@/utils/taxCalc'
import type { TaxConfig } from '@/utils/taxCalc'
import type { CartModifierEntry } from '@/types/productModifiers'
import {
  buildConfigureKey,
  calcUnitPriceWithModifiers,
  modifiersToJson,
} from '@/utils/productModifiers'
import { roundMoney } from '@/utils/checkoutDiscount'

export type CatalogCartLine = {
  kind: 'catalog'
  product: Product
  quantity: number
  /** Nota libre de cocina (sin cebolla, etc.). */
  notes?: string
  base_price: number
  unit_price: number
  modifiers: CartModifierEntry[]
  configureKey: string
}

export type ManualCartLine = {
  kind: 'manual'
  lineId: string
  description: string
  code: string
  unit: string
  unit_price: number
  quantity: number
  notes?: string
  igv_affectation_type: string
  price_includes_igv: boolean
}

export type PosCartLine = CatalogCartLine | ManualCartLine

export function isManualCartLine(line: PosCartLine): line is ManualCartLine {
  return line.kind === 'manual'
}

export function isCatalogCartLine(line: PosCartLine): line is CatalogCartLine {
  return line.kind === 'catalog'
}

export function cartLineKey(line: PosCartLine, index: number): string {
  if (line.kind === 'manual') return line.lineId
  return `p-${line.product.id}-${line.configureKey}-${index}`
}

export function cartLineLabel(line: PosCartLine): string {
  return line.kind === 'catalog' ? line.product.name : line.description.trim() || 'Producto manual'
}

export function cartLineUnitPrice(line: PosCartLine): number {
  if (line.kind === 'catalog') return Number(line.unit_price) || 0
  return Number(line.unit_price) || 0
}

export function cartLineBasePrice(line: PosCartLine): number {
  if (line.kind === 'catalog') return Number(line.base_price) || Number(line.product.sale_price) || 0
  return Number(line.unit_price) || 0
}

export function cartLineTotal(
  line: PosCartLine,
  taxRate: number,
  taxConfig: Partial<TaxConfig> | undefined,
): number {
  const unit = cartLineUnitPrice(line)
  if (line.kind === 'catalog') {
    return calcItem(
      unit,
      line.quantity,
      0,
      line.product.igv_affectation_type ?? '10',
      line.product.price_includes_igv ?? true,
      taxRate,
      taxConfig,
    ).total
  }
  return calcItem(
    line.unit_price,
    line.quantity,
    0,
    line.igv_affectation_type,
    line.price_includes_igv,
    taxRate,
    taxConfig,
  ).total
}

/** Clave de fusión en carrito: modificadores, nota y precio unitario acordado. */
export function buildCatalogConfigureKey(
  modifiers: CartModifierEntry[],
  notes: string,
  unitPrice: number,
): string {
  return `${buildConfigureKey(modifiers, notes)}@u${roundMoney(unitPrice).toFixed(2)}`
}

export function applyCatalogLineUnitPrice(line: CatalogCartLine, unitPrice: number): CatalogCartLine {
  const price = roundMoney(Math.max(0, unitPrice))
  return {
    ...line,
    unit_price: price,
    configureKey: buildCatalogConfigureKey(line.modifiers, line.notes ?? '', price),
  }
}

export function createCatalogCartLine(
  product: Product,
  partial?: {
    quantity?: number
    notes?: string
    modifiers?: CartModifierEntry[]
    base_price?: number
  },
): CatalogCartLine {
  const base = partial?.base_price ?? (Number(product.sale_price) || 0)
  const modifiers = partial?.modifiers ?? []
  const notes = partial?.notes ?? ''
  const unit_price = calcUnitPriceWithModifiers(base, modifiers)
  return {
    kind: 'catalog',
    product,
    quantity: partial?.quantity ?? 1,
    notes,
    base_price: base,
    unit_price,
    modifiers,
    configureKey: buildCatalogConfigureKey(modifiers, notes, unit_price),
  }
}

export function createManualCartLine(partial?: Partial<ManualCartLine>): ManualCartLine {
  return {
    kind: 'manual',
    lineId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: partial?.description ?? '',
    code: partial?.code ?? 'MANUAL',
    unit: partial?.unit ?? 'NIU',
    unit_price: partial?.unit_price ?? 0,
    quantity: partial?.quantity ?? 1,
    notes: partial?.notes ?? '',
    igv_affectation_type: partial?.igv_affectation_type ?? '10',
    price_includes_igv: partial?.price_includes_igv ?? true,
  }
}

export function catalogLinesMatch(a: CatalogCartLine, b: CatalogCartLine): boolean {
  return a.product.id === b.product.id && a.configureKey === b.configureKey
}

export type AppendCatalogResult = { cart: PosCartLine[]; merged: boolean }

/** Agrega o incrementa cantidad si producto, modificadores, nota y precio coinciden. */
export function appendCatalogLine(cart: PosCartLine[], line: CatalogCartLine): AppendCatalogResult {
  const i = cart.findIndex((x) => x.kind === 'catalog' && catalogLinesMatch(x, line))
  if (i >= 0) {
    return {
      cart: cart.map((x, j) =>
        j === i && x.kind === 'catalog' ? { ...x, quantity: x.quantity + line.quantity } : x,
      ),
      merged: true,
    }
  }
  return { cart: [...cart, line], merged: false }
}

export function cartToOrderItems(cart: PosCartLine[]) {
  return cart.map((x) => {
    if (x.kind === 'manual') {
      const name = x.description.trim()
      if (!name) throw new Error('Completa la descripción del producto manual')
      return {
        product_code: (x.code || 'MANUAL').trim(),
        product_name: name,
        quantity: x.quantity,
        unit_price: x.unit_price,
        notes: (x.notes ?? '').trim(),
        modifiers_json: '',
        igv_affectation_type: x.igv_affectation_type || '10',
        price_includes_igv: x.price_includes_igv,
      }
    }
    return {
      product_id: x.product.id,
      product_code: x.product.code || '',
      product_name: x.product.name,
      quantity: x.quantity,
      unit_price: x.unit_price,
      notes: (x.notes ?? '').trim(),
      modifiers_json: modifiersToJson(x.modifiers),
    }
  })
}

export function sumCartQty(cart: PosCartLine[]): number {
  return cart.reduce((s, x) => s + x.quantity, 0)
}

/** Etiqueta corta para mostrar cómo se interpreta el precio unitario (manual / carrito). */
export function manualPriceIgvLabel(priceIncludesIgv: boolean, igvAffectationType: string): string {
  const aff = String(igvAffectationType || '10').trim()
  if (['20', '21', '30', '31', '32', '33', '34', '35', '36', '40'].includes(aff)) {
    return 'Sin IGV (afectación no gravada)'
  }
  return priceIncludesIgv ? 'Unit. incluye IGV' : 'Unit. + IGV en el total'
}

export function sumCartTotal(
  cart: PosCartLine[],
  taxRate: number,
  taxConfig: Partial<TaxConfig> | undefined,
): number {
  return cart.reduce((s, line) => s + cartLineTotal(line, taxRate, taxConfig), 0)
}
