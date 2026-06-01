import api from './api'
import type { InvoiceInfo } from './billing.service'

export interface Sale {
  id: number
  doc_type: string
  series: string
  number: string
  issue_date: string
  contact_id: number | null
  contact_name?: string
  subtotal: number
  tax_amount: number
  total: number
  currency: string
  status: string
  billing_status: 'pending' | 'sent' | 'accepted' | 'observed' | 'rejected' | 'error'
  branch_id: number
  created_at: string
  /** NV con FE emitida */
  electronic_issue_sale_id?: number | null
  original_sale_id?: number | null
  /** Método principal (legacy); si hay `payments`, preferir esa lista. */
  payment_method?: string
}

export interface SaleItem {
  id: number
  product_id: number | null
  code: string
  description: string
  unit: string
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  igv_affectation_type: string
  subtotal: number
  tax_amount: number
  total: number
  modifiers_json?: string
}

export interface SalePayment {
  id: number
  sale_id: number
  method: string
  amount: number
  reference?: string
  notes?: string
  created_at?: string
}

export interface SaleDetail {
  sale: Sale
  items: SaleItem[]
  payments?: SalePayment[]
  invoice?: InvoiceInfo
  print_data?: unknown
  contact?: {
    id?: number
    doc_type?: string
    doc_number?: string
    business_name?: string
    phone?: string
  }
}

/**
 * Texto del correlativo para listados/UI.
 * En BD `number` suele guardarse ya como "NV001-00000017" y `series` repite la serie;
 * no debe concatenarse otra vez (evita "NV001-NV001-00000017").
 */
export function formatSaleDocumentNumber(s: { series?: string; number?: string | number }): string {
  const series = String(s.series ?? '').trim()
  const num = String(s.number ?? '').trim()
  if (!num && !series) return '—'
  if (!series) return num
  if (num.includes('-')) {
    if (num.startsWith(`${series}-`)) return num
    if (/^[A-Za-z0-9]{1,12}-\d/.test(num)) return num
  }
  const tail = /^\d+$/.test(num) ? num.padStart(8, '0') : num
  return `${series}-${tail}`
}

export type ApiRequestOptions = { signal?: AbortSignal }

export interface SaleListSummary {
  sum_total: number
  sum_subtotal: number
  sum_tax: number
  sum_cancelled: number
  sum_active: number
  count_cancelled: number
  count_active: number
}

export const emptySaleListSummary = (): SaleListSummary => ({
  sum_total: 0,
  sum_subtotal: 0,
  sum_tax: 0,
  sum_cancelled: 0,
  sum_active: 0,
  count_cancelled: 0,
  count_active: 0,
})

function parseSaleListSummary(raw: unknown): SaleListSummary {
  const s = (raw ?? {}) as Partial<SaleListSummary>
  return {
    sum_total: Number(s.sum_total) || 0,
    sum_subtotal: Number(s.sum_subtotal) || 0,
    sum_tax: Number(s.sum_tax) || 0,
    sum_cancelled: Number(s.sum_cancelled) || 0,
    sum_active: Number(s.sum_active) || 0,
    count_cancelled: Number(s.count_cancelled) || 0,
    count_active: Number(s.count_active) || 0,
  }
}

export const salesService = {
  list: (
    params?: {
      q?: string
      from?: string
      to?: string
      doc_type?: string
      status?: string
      billing_status?: string
      sunat_code?: string
      page?: number
      per_page?: number
    },
    options?: ApiRequestOptions,
  ) => {
    const p = params ?? {}
    return api.get<{ data: Sale[]; total?: number; summary?: SaleListSummary }>('/api/sales', { params: p, signal: options?.signal }).then((r) => {
      const data = r.data.data ?? []
      const total = (r.data as { total?: number }).total ?? 0
      const summary = parseSaleListSummary(r.data.summary)
      return { data, total, summary }
    })
  },
  get: (id: number): Promise<SaleDetail> =>
    api.get(`/api/sales/${id}`).then((r) => {
      const d = r.data as SaleDetail
      d.items = d.items ?? []
      d.payments = d.payments ?? []
      return d
    }),

  listAll: (
    params?: {
      q?: string
      from?: string
      to?: string
      doc_type?: string
      status?: string
      billing_status?: string
      sunat_code?: string
    },
    options?: ApiRequestOptions,
  ) =>
    api
      .get<{ data: Sale[]; total?: number; summary?: SaleListSummary }>('/api/sales', {
        params: { ...(params ?? {}), export_all: '1' },
        signal: options?.signal,
      })
      .then((r) => ({
        data: r.data.data ?? [],
        total: (r.data as { total?: number }).total ?? 0,
        summary: parseSaleListSummary(r.data.summary),
      })),

  issueElectronicFromNota: (saleId: number, body: { series_id: number; issue_date?: string }) =>
    api.post<{ sale: Sale }>(`/api/sales/${saleId}/issue-electronic`, body).then((r) => r.data),

  cancelNota: (saleId: number, reason: string) =>
    api.post<{ success: boolean; message?: string }>(`/api/sales/${saleId}/cancel`, { reason }).then((r) => r.data),
}
