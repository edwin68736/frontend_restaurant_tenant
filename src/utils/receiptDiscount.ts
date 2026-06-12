import type { PrintData } from '@/types/printData'
import { roundSunat } from '@/utils/money'

export function receiptTotalDiscount(data: Pick<PrintData, 'items'>): number {
  return roundSunat(
    (data.items ?? []).reduce((sum, it) => sum + (Number(it.discount) || 0), 0),
  )
}

export function hasReceiptDiscount(data: Pick<PrintData, 'items'>): boolean {
  return receiptTotalDiscount(data) > 0.000001
}
