import type { Product } from '@/services/products.service'
import { calcItem } from '@/utils/taxCalc'
import type { TaxConfig } from '@/utils/taxCalc'

export type CatalogCartLine = {
  kind: 'catalog'
  product: Product
  quantity: number
  notes?: string
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

export function cartLineKey(line: PosCartLine, index: number): string {
  if (line.kind === 'manual') return line.lineId
  return `p-${line.product.id}-${index}`
}

export function cartLineLabel(line: PosCartLine): string {
  return line.kind === 'catalog' ? line.product.name : line.description.trim() || 'Producto manual'
}

export function cartLineUnitPrice(line: PosCartLine): number {
  return line.kind === 'catalog' ? Number(line.product.sale_price) || 0 : Number(line.unit_price) || 0
}

export function cartLineTotal(
  line: PosCartLine,
  taxRate: number,
  taxConfig: Partial<TaxConfig> | undefined,
): number {
  if (line.kind === 'catalog') {
    return calcItem(
      line.product.sale_price,
      line.quantity,
      0,
      line.product.igv_affectation_type ?? '10',
      line.product.price_includes_igv ?? false,
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
    price_includes_igv: partial?.price_includes_igv ?? false,
  }
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
      }
    }
    return {
      product_id: x.product.id,
      product_code: x.product.code || '',
      product_name: x.product.name,
      quantity: x.quantity,
      unit_price: x.product.sale_price,
      notes: (x.notes ?? '').trim(),
    }
  })
}

export function sumCartQty(cart: PosCartLine[]): number {
  return cart.reduce((s, x) => s + x.quantity, 0)
}

export function sumCartTotal(
  cart: PosCartLine[],
  taxRate: number,
  taxConfig: Partial<TaxConfig> | undefined,
): number {
  return cart.reduce((s, line) => s + cartLineTotal(line, taxRate, taxConfig), 0)
}
