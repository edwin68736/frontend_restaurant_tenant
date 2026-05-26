export const ORDER_TYPES = {
  dine_in: 'dine_in',
  takeaway: 'takeaway',
  delivery: 'delivery',
  quick_sale: 'quick_sale',
} as const

export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES]

export const ORDER_STATUS = {
  draft: 'draft',
  pending: 'pending',
  sent_to_kitchen: 'sent_to_kitchen',
  preparing: 'preparing',
  ready: 'ready',
  on_the_way: 'on_the_way',
  delivered: 'delivered',
  paid: 'paid',
  cancelled: 'cancelled',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Mesa',
  takeaway: 'Para llevar',
  delivery: 'Delivery',
  quick_sale: 'Venta directa',
  all: 'Todos',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  sent_to_kitchen: 'En cocina',
  preparing: 'Preparando',
  ready: 'Listo',
  on_the_way: 'En camino',
  delivered: 'Entregado',
  paid: 'Cobrado',
  cancelled: 'Cancelado',
}

export interface DeliveryDriver {
  id: number
  name: string
  phone: string
  vehicle_type: string
  plate: string
  active: boolean
  notes: string
  delivery_company_id?: number | null
  delivery_company?: DeliveryCompany | null
}

export interface DeliveryCompany {
  id: number
  name: string
  sort_order?: number
  active: boolean
}

export interface RestaurantOrderSummary {
  id: number
  order_code: string
  order_type: string
  order_status: string
  table_id: number | null
  table_name?: string
  floor_name?: string
  customer_name: string
  contact_name?: string
  customer_phone: string
  delivery_address: string
  delivery_reference: string
  driver_name?: string
  total_amount: number
  opened_at: string
  notes: string
  item_count: number
  active_comandas: number
  contact_id?: number | null
  delivery_driver_id?: number | null
  estimated_minutes?: number
}

export interface PrecuentaPayload {
  order_code: string
  order_type: string
  table_name: string
  customer_name: string
  customer_phone: string
  delivery_address?: string
  delivery_reference?: string
  driver_name?: string
  opened_at: string
  notes: string
  subtotal: number
  tax_amount: number
  total: number
  lines: { product_name: string; quantity: number; unit_price: number; line_total: number; notes: string }[]
}
