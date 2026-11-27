import api from '@/services/api'

/** Reportes de insumos y platos (F6). Todos los números los calcula el servidor; los costos solo llegan con permiso de verlos. */

export type StockRow = {
  supply_id: number
  code: string
  name: string
  unit: string
  quantity: number
  min_stock: number
  low: boolean
  negative: boolean
  avg_cost?: number
  value?: number
  last_cost?: number
}
export type StockSummary = { items: number; low_count: number; negative_count: number; total_value?: number; without_cost: number }

export type PurchaseRow = {
  purchase_id: number
  issue_date: string
  supplier: string
  document: string
  supply_id: number
  supply: string
  unit: string
  quantity: number
  unit_cost?: number
  amount?: number
}
export type PurchaseSummary = { total_amount?: number }

export type ConsumptionRow = {
  supply_id: number
  supply: string
  unit: string
  consumed: number
  restored: number
  net: number
  cost?: number
  without_cost: number
}
export type ConsumptionSummary = { total_cost?: number }

export type WasteRow = {
  date: string
  supply_id: number
  supply: string
  unit: string
  kind: 'merma' | 'desperdicio'
  quantity: number
  unit_cost?: number
  value?: number
  user: string
  notes: string
}
export type WasteSummary = { total_value?: number }

export type ProfitRow = {
  product_id: number
  presentation_id: number
  name: string
  units: number
  revenue: number
  cost: number
  margin: number
  margin_pct: number | null
  food_cost_pct: number | null
  units_without_cost: number
  revenue_without_cost: number
}
export type ProfitSummary = Omit<ProfitRow, 'product_id' | 'presentation_id' | 'name'> & { unconverted_usd: number }

export type ReportQuery = { from?: string; to?: string; branch_id?: number; supply_id?: number; page?: number; per_page?: number }

const BASE = '/api/restaurant/reports'

type Body<R, S> = { data: R[]; total?: number; summary: S }

const get = <R, S>(path: string, query: ReportQuery) =>
  api.get<Body<R, S>>(`${BASE}/${path}`, { params: query }).then((r) => {
    const data = r.data.data ?? []
    return { data, total: r.data.total ?? data.length, summary: r.data.summary }
  })

export const recipeReportsService = {
  stock: (q: ReportQuery) => get<StockRow, StockSummary>('supply-stock', q),
  purchases: (q: ReportQuery) => get<PurchaseRow, PurchaseSummary>('supply-purchases', q),
  consumption: (q: ReportQuery) => get<ConsumptionRow, ConsumptionSummary>('supply-consumption', q),
  waste: (q: ReportQuery) => get<WasteRow, WasteSummary>('supply-waste', q),
  profit: (q: ReportQuery) => get<ProfitRow, ProfitSummary>('dish-profitability', q),
}
