import api from './api'

export interface Floor {
  id: number
  name: string
  sort_order: number
  active: boolean
}

export interface RestaurantTable {
  id: number
  floor_id: number
  floor_name?: string
  name: string
  capacity: number
  status: string
  active: boolean
  session_id?: number | null
  total_amount?: number
  waiter_name?: string
}

export interface StaffOption {
  id: number
  user_id: number
  employee_type: string
  display_name: string
  staff_code?: string
}

export interface RestaurantStaffManagementRow {
  user_id: number
  name: string
  email: string
  active: boolean
  staff_id?: number
  employee_type: string
  display_name: string
  staff_code: string
  has_pin: boolean
  staff_active: boolean
  profile_complete?: boolean
  branch_ids?: number[]
  branch_names?: string[]
  role_edit_locked?: boolean
}

export const RESTAURANT_EMPLOYEE_TYPES = [
  { value: '', label: 'Sin acceso restaurante' },
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'waiter', label: 'Mozo' },
  { value: 'cook', label: 'Cocinero' },
  { value: 'driver', label: 'Repartidor / Delivery' },
] as const

export interface SessionDetail {
  id: number
  table_id: number | null
  table_name?: string
  floor_name?: string
  waiter_name?: string
  driver_name?: string
  contact_name?: string
  guests: number
  opened_at: string
  status: string
  order_code?: string
  order_type?: string
  order_status?: string
  contact_id?: number | null
  customer_name?: string
  customer_phone?: string
  delivery_driver_id?: number | null
  delivery_address?: string
  delivery_reference?: string
  estimated_minutes?: number
  total_amount: number
  notes?: string
  orders: {
    id: number
    order_number: number
    notes: string
    printed_at?: string | null
    printed_by_id?: number | null
    created_at?: string
    comandas: Comanda[]
  }[]
}

export interface Comanda {
  id: number
  order_id: number
  session_id: number
  product_id?: number
  product_name: string
  product_code?: string
  quantity: number
  unit_price: number
  notes?: string
  modifiers_json?: string
  igv_affectation_type?: string
  price_includes_igv?: boolean
  status: string
  cancelled_at?: string | null
  preparation_area?: string
  printed?: boolean
  printed_at?: string | null
  created_at?: string
}

/** Línea de cocina con contexto del pedido (GET /kitchen). */
export interface KitchenComanda extends Comanda {
  order_number?: number
  order_code?: string
  order_type?: string
  order_status?: string
  table_id?: number | null
  table_name?: string
  floor_name?: string
  customer_name?: string
  customer_phone?: string
  delivery_address?: string
  waiter_name?: string
  driver_name?: string
  session_opened_at?: string
}

export interface OrderItemInput {
  product_id?: number
  product_code?: string
  product_name: string
  quantity: number
  unit_price: number
  notes?: string
  modifiers_json?: string
  igv_affectation_type?: string
  price_includes_igv?: boolean
}

export const restaurantService = {
  getSettings: () => api.get<{ has_deletion_pin: boolean }>('/api/restaurant/settings').then((r) => r.data),

  updateSettings: (data: { deletion_pin: string }) =>
    api.put<{ success: boolean }>('/api/restaurant/settings', data).then((r) => r.data),

  listStaffManagement: () =>
    api
      .get<{ data: RestaurantStaffManagementRow[] }>('/api/restaurant/staff/management')
      .then((r) => r.data.data ?? r.data ?? []),

  createStaffUser: (body: {
    name: string
    email: string
    phone?: string
    employee_type: string
    pin: string
    staff_code?: string
    display_name?: string
    branch_ids: number[]
  }) =>
    api.post<{ success: boolean; data: RestaurantStaffManagementRow }>('/api/restaurant/staff/users', body).then((r) => r.data),

  setUserStaff: (
    userId: number,
    body: {
      employee_type: string
      pin?: string
      clear_pin?: boolean
      staff_code?: string
      display_name?: string
      branch_ids?: number[]
    },
  ) =>
    api
      .put<{ success: boolean; has_pin?: boolean }>(`/api/restaurant/users/${userId}/staff`, body)
      .then((r) => r.data),

  /** Devuelve false si no hay PIN (muestra toast y no abre el modal de anulación). */
  ensureDeletionPinConfigured: async (): Promise<boolean> => {
    const { has_deletion_pin } = await restaurantService.getSettings()
    return has_deletion_pin
  },

  listFloors: () => api.get<{ data: Floor[] }>('/api/restaurant/floors').then((r) => r.data.data ?? r.data ?? []),
  createFloor: (data: { name: string; sort_order?: number }) =>
    api.post('/api/restaurant/floors', data).then((r) => r.data),
  updateFloor: (id: number, data: { name?: string; sort_order?: number; active?: boolean }) =>
    api.put(`/api/restaurant/floors/${id}`, data).then((r) => r.data),
  deleteFloor: (id: number) => api.delete(`/api/restaurant/floors/${id}`).then((r) => r.data),

  listTables: (floor_id?: number) =>
    api.get<{ data: RestaurantTable[] }>('/api/restaurant/tables', { params: { floor_id } }).then((r) => r.data.data ?? r.data ?? []),
  createTable: (data: { floor_id: number; name: string; capacity: number }) =>
    api.post('/api/restaurant/tables', data).then((r) => r.data),
  updateTable: (id: number, data: { floor_id?: number; name?: string; capacity?: number; active?: boolean }) =>
    api.put(`/api/restaurant/tables/${id}`, data).then((r) => r.data),
  deleteTable: (id: number) => api.delete(`/api/restaurant/tables/${id}`).then((r) => r.data),
  getTableSession: (tableId: number) =>
    api.get<{ data: SessionDetail }>(`/api/restaurant/tables/${tableId}/session`).then((r) => r.data.data),

  listStaff: () =>
    api.get<{ data: StaffOption[] }>('/api/restaurant/staff').then((r) => {
      const rows = (r.data.data ?? r.data ?? []) as Array<{
        id: number
        user_id: number
        employee_type: string
        display_name?: string
        staff_code?: string
      }>
      return rows.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        employee_type: s.employee_type,
        display_name: s.display_name || s.staff_code || `#${s.id}`,
        staff_code: s.staff_code,
      }))
    }),

  openSession: (data: {
    table_id?: number | null
    staff_id?: number | null
    guests?: number
    notes?: string
    order_type?: string
    contact_id?: number | null
    customer_name?: string
    customer_phone?: string
    delivery_driver_id?: number | null
    delivery_address?: string
    delivery_reference?: string
    estimated_minutes?: number
    save_as_draft?: boolean
  }) =>
    api.post<{ success: boolean; data: { id: number; order_code?: string } }>('/api/restaurant/sessions', data).then((r) => r.data),

  listOpenOrders: (orderType = 'all') =>
    api
      .get<{ data: import('@/types/restaurantOrder').RestaurantOrderSummary[] }>('/api/restaurant/orders', {
        params: { order_type: orderType === 'all' ? undefined : orderType },
      })
      .then((r) => r.data.data ?? []),

  updateSession: (sessionId: number, data: Record<string, unknown>) =>
    api.patch(`/api/restaurant/sessions/${sessionId}`, data).then((r) => r.data),

  updateOrderStatus: (sessionId: number, orderStatus: string) =>
    api.put(`/api/restaurant/sessions/${sessionId}/order-status`, { order_status: orderStatus }).then((r) => r.data),

  getPrecuenta: (sessionId: number) =>
    api
      .get<{ data: import('@/types/restaurantOrder').PrecuentaPayload }>(`/api/restaurant/sessions/${sessionId}/precuenta`)
      .then((r) => r.data.data),

  listDeliveryDrivers: (activeOnly = true) =>
    api
      .get<{ data: import('@/types/restaurantOrder').DeliveryDriver[] }>('/api/restaurant/delivery-drivers', {
        params: { active_only: activeOnly ? 'true' : 'false' },
      })
      .then((r) => r.data.data ?? []),

  listDeliveryCompanies: (activeOnly = true) =>
    api
      .get<{ data: import('@/types/restaurantOrder').DeliveryCompany[] }>('/api/restaurant/delivery-companies', {
        params: { active_only: activeOnly ? 'true' : 'false' },
      })
      .then((r) => r.data.data ?? []),

  createDeliveryCompany: (data: { name: string }) =>
    api.post('/api/restaurant/delivery-companies', data).then((r) => r.data),

  updateDeliveryCompany: (
    id: number,
    data: { name: string; active?: boolean; sort_order?: number },
  ) => api.put(`/api/restaurant/delivery-companies/${id}`, data).then((r) => r.data),

  deleteDeliveryCompany: (id: number) =>
    api.delete(`/api/restaurant/delivery-companies/${id}`).then((r) => r.data),

  createDeliveryDriver: (data: {
    name: string
    phone?: string
    vehicle_type?: string
    plate?: string
    notes?: string
    delivery_company_id?: number | null
  }) => api.post('/api/restaurant/delivery-drivers', data).then((r) => r.data),

  updateDeliveryDriver: (
    id: number,
    data: {
      name: string
      phone?: string
      vehicle_type?: string
      plate?: string
      notes?: string
      active?: boolean
      delivery_company_id?: number | null
    },
  ) => api.put(`/api/restaurant/delivery-drivers/${id}`, data).then((r) => r.data),

  deleteDeliveryDriver: (id: number) => api.delete(`/api/restaurant/delivery-drivers/${id}`).then((r) => r.data),
  getSession: (sessionId: number) =>
    api.get<{ data: SessionDetail }>(`/api/restaurant/sessions/${sessionId}`).then((r) => r.data.data),
  cancelSession: (sessionId: number, reason: string, pin: string) =>
    api.post(`/api/restaurant/sessions/${sessionId}/cancel`, { reason, pin }).then((r) => r.data),
  cancelAllComandas: (
    sessionId: number,
    data: { reason: string; pin: string; order_id?: number },
  ) =>
    api
      .post<{ success: boolean; data: { cancelled_count: number } }>(
        `/api/restaurant/sessions/${sessionId}/cancel-comandas`,
        data,
      )
      .then((r) => r.data),
  addOrder: (sessionId: number, data: { staff_id?: number; notes?: string; items: OrderItemInput[] }) =>
    api.post(`/api/restaurant/sessions/${sessionId}/orders`, data).then((r) => r.data),
  billSession: (sessionId: number, data: {
    series_id: number
    doc_type: string
    currency?: string
    contact_id?: number | null
    cash_session_id?: number | null
    issue_date?: string
    close_session?: boolean
    discount_mode?: 'percent' | 'amount'
    discount_value?: number
    discount_amount?: number
    payments: { method: string; amount: number; reference?: string; notes?: string }[]
  }) => api.post<{ success: boolean; data: { id: number; number: string; total: number }; print_data?: import('@/types/printData').PrintData }>(`/api/restaurant/sessions/${sessionId}/bill`, data).then((r) => r.data),

  closeSession: (sessionId: number) =>
    api.post(`/api/restaurant/sessions/${sessionId}/close`).then((r) => r.data),

  updateComandaNotes: (comandaId: number, notes: string) =>
    api.patch(`/api/restaurant/comandas/${comandaId}/notes`, { notes }).then((r) => r.data),

  updateComandaStatus: (comandaId: number, status: string) =>
    api.put(`/api/restaurant/comandas/${comandaId}/status`, { status }).then((r) => r.data),
  printComanda: (comandaId: number) => api.post(`/api/restaurant/comandas/${comandaId}/print`).then((r) => r.data),
  markTableOrderPrinted: (tableOrderId: number) =>
    api.post(`/api/restaurant/table-orders/${tableOrderId}/printed`).then((r) => r.data),
  cancelComanda: (comandaId: number, reason: string, pin: string) =>
    api.delete(`/api/restaurant/comandas/${comandaId}`, { data: { reason, pin } }).then((r) => r.data),

  getKitchen: () =>
    api.get<{ data: KitchenComanda[] }>('/api/restaurant/kitchen').then((r) => r.data.data ?? r.data ?? []),
}
