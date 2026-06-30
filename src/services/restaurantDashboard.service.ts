import api from './api'

export interface DashboardSummary {
  total_sales: number
  total_orders: number
  average_ticket: number
  products_sold: number
  clients_served: number
  has_client_data: boolean
}

export interface DashboardStatusRow {
  status: string
  label: string
  count: number
}

export interface DashboardPaymentRow {
  method: string
  label: string
  total: number
  count: number
}

export interface DashboardProductRow {
  position: number
  product_id: number
  product_name: string
  quantity_sold: number
  total_amount: number
  participation_pct: number
}

export interface DashboardCategoryRow {
  category_name: string
  quantity_sold: number
  total_amount: number
}

export interface DashboardDayRow {
  day: string
  total: number
  count: number
}

export interface DashboardHourRow {
  hour: number
  label: string
  orders: number
}

export interface DashboardTablesSummary {
  enabled: boolean
  occupied: number
  free: number
  reserved: number
  total: number
}

export interface RestaurantDashboardData {
  summary: DashboardSummary
  sales_by_status: DashboardStatusRow[]
  sales_by_payment_method: DashboardPaymentRow[]
  top_products: DashboardProductRow[]
  top_categories: DashboardCategoryRow[]
  sales_last_30_days: DashboardDayRow[]
  sales_by_hour: DashboardHourRow[]
  tables_summary: DashboardTablesSummary
  /** true cuando el backend filtra métricas al cajero autenticado */
  scoped_to_user?: boolean
}

export type DashboardQuery = {
  start_date: string
  end_date: string
  top_n?: number
}

export const restaurantDashboardService = {
  get: (params: DashboardQuery): Promise<RestaurantDashboardData> =>
    api
      .get<{ data: RestaurantDashboardData }>('/api/restaurant/dashboard', { params })
      .then((r) => r.data.data),
}
