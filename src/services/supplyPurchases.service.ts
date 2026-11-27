import api from '@/services/api'

/** Compras, proveedores, ingresos, mermas y carga inicial de insumos. Rutas que solo tocan insumos. */
export type Supplier = { id: number; doc_type: string; doc_number: string; business_name: string; phone: string }

export type SupplierInput = { doc_type: string; doc_number: string; business_name: string; phone?: string }

export type SupplyPurchaseLine = {
  product_id: number
  name: string
  unit: string
  quantity: number
  unit_cost: number
  line_total: number
}

export type SupplyPurchase = {
  id: number
  supplier: string
  doc_type: string
  series: string
  number: string
  issue_date: string
  total: number
  payment_method: string
  status: string
  lines?: SupplyPurchaseLine[]
}

export type SupplyPurchaseBody = {
  supplier_id: number
  doc_type: string
  series: string
  number: string
  issue_date: string
  due_date?: string
  payment_method: string
  notes?: string
  price_includes_igv: boolean
  lines: { supply_id: number; sale_unit_id?: number; quantity: number; line_total: number }[]
}

export type SupplyEntryKind = 'ingreso' | 'merma' | 'desperdicio'

export type SupplyEntryBody = {
  supply_id: number
  kind: SupplyEntryKind
  quantity: number
  total_cost: number
  notes: string
}

export type SupplyHistoryRow = {
  purchase_id: number
  issue_date: string
  supplier: string
  document: string
  quantity: number
  unit: string
  status: string
  line_total?: number
}

const BASE = '/api/restaurant'

export const supplyPurchasesService = {
  suppliers: (q: string) =>
    api.get<{ data: Supplier[] }>(`${BASE}/suppliers`, { params: { q: q || undefined } }).then((r) => r.data.data ?? []),

  createSupplier: (body: SupplierInput) => api.post<{ data: Supplier }>(`${BASE}/suppliers`, body).then((r) => r.data.data),

  list: (page: number) =>
    api
      .get<{ data: SupplyPurchase[]; total: number }>(`${BASE}/supply-purchases`, { params: { page } })
      .then((r) => ({ data: r.data.data ?? [], total: r.data.total ?? 0 })),

  get: (id: number) => api.get<{ data: SupplyPurchase }>(`${BASE}/supply-purchases/${id}`).then((r) => r.data.data),

  /** La clave identifica el intento: repetirla devuelve la compra ya registrada. */
  create: (body: SupplyPurchaseBody, idempotencyKey: string) =>
    api
      .post<{ data: SupplyPurchase }>(`${BASE}/supply-purchases`, { ...body, idempotency_key: idempotencyKey })
      .then((r) => r.data.data),

  void: (id: number) => api.post(`${BASE}/supply-purchases/${id}/void`),

  entry: (body: SupplyEntryBody, idempotencyKey: string) =>
    api.post(`${BASE}/supply-entries`, { ...body, idempotency_key: idempotencyKey }),

  initialStock: (supplyId: number, quantity: number, unitCost: number) =>
    api.post(`${BASE}/supplies/${supplyId}/initial-stock`, { quantity, unit_cost: unitCost }),

  history: (supplyId: number, branchId?: number) =>
    api
      .get<{ data: SupplyHistoryRow[] }>(`${BASE}/supplies/${supplyId}/purchases`, { params: { branch_id: branchId || undefined } })
      .then((r) => r.data.data ?? []),
}
