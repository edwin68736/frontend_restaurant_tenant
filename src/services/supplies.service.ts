import api from '@/services/api'

/** Insumos (materia prima): se compran y se mueven en inventario, nunca se venden. Ver /api/restaurant/supplies. */
export type SupplyBranchStock = { branch_id: number; branch_name: string; quantity: number }

export type Supply = {
  id: number
  code: string
  name: string
  description: string
  unit: string
  unit_id?: number | null
  min_stock: number
  active: boolean
  has_expiry_date: boolean
  expiry_date?: string
  stock_total: number
  stock_by_branch: SupplyBranchStock[] | null
  /** Último costo por unidad base. Solo llega con permiso de ver costos. */
  unit_cost?: number
  /** Costo promedio de la sucursal consultada; falta mientras no haya una entrada con costo. */
  avg_cost?: number
}

export type SupplyInput = {
  code?: string
  name?: string
  description?: string
  unit?: string
  unit_id?: number
  min_stock?: number
  active?: boolean
  has_expiry_date?: boolean
  expiry_date?: string
  unit_cost?: number
}

export type MeasureUnit = { id: number; code: string; name: string }

export type SupplyUnit = {
  id: number
  name: string
  unit_id?: number | null
  unit: string
  conversion_factor: number
  is_base: boolean
  allow_fraction: boolean
  sort_order: number
  active: boolean
}

export type SupplyUnitInput = {
  name: string
  unit_id?: number
  conversion_factor: number
  is_base: boolean
  allow_fraction: boolean
  sort_order: number
  active: boolean
}

export type SupplyMovement = {
  id: number
  branch_id: number
  type: string
  quantity: number
  balance: number
  reference: string
  notes: string
  created_at: string
  unit_cost?: number
  /** Salió sin que hubiera un costo conocido. */
  cost_unknown?: boolean
}

const BASE = '/api/restaurant/supplies'

export const suppliesService = {
  list: (params: { q?: string; page: number; per_page: number; status: 'active' | 'inactive' | 'all'; branch_id?: number }) =>
    api
      .get<{ data: Supply[]; total: number }>(BASE, {
        params: {
          q: params.q || undefined,
          page: params.page,
          per_page: params.per_page,
          active_only: params.status === 'active' ? 'true' : undefined,
          inactive_only: params.status === 'inactive' ? 'true' : undefined,
          branch_id: params.branch_id || undefined,
        },
      })
      .then((r) => ({ data: r.data.data ?? [], total: r.data.total ?? 0 })),

  create: (body: SupplyInput) => api.post<{ data: Supply }>(BASE, body).then((r) => r.data.data),

  update: (id: number, body: SupplyInput) => api.put<{ data: Supply }>(`${BASE}/${id}`, body).then((r) => r.data.data),

  unitCatalog: () => api.get<{ data: MeasureUnit[] }>(`${BASE}/unit-catalog`).then((r) => r.data.data ?? []),

  movements: (id: number, page: number, branch_id?: number) =>
    api
      .get<{ data: SupplyMovement[]; total: number }>(`${BASE}/${id}/movements`, {
        params: { page, branch_id: branch_id || undefined },
      })
      .then((r) => ({ data: r.data.data ?? [], total: r.data.total ?? 0 })),

  listUnits: (id: number) => api.get<{ data: SupplyUnit[] }>(`${BASE}/${id}/units`).then((r) => r.data.data ?? []),

  createUnit: (id: number, body: SupplyUnitInput) => api.post(`${BASE}/${id}/units`, body),

  updateUnit: (id: number, unitId: number, body: SupplyUnitInput) => api.put(`${BASE}/${id}/units/${unitId}`, body),

  deleteUnit: (id: number, unitId: number) => api.delete(`${BASE}/${id}/units/${unitId}`),
}
