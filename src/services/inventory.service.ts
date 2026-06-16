import api from './api'

export interface StockByBranch {
  product_id: number
  branch_id: number
  quantity: number
  updated_at?: string
}

export interface StockMovement {
  id: number
  product_id: number
  product_code?: string
  product_name?: string
  branch_id: number
  branch_name?: string
  type: string
  quantity: number
  balance?: number
  reference?: string
  notes?: string
  user_id?: number
  user_name?: string
  created_at: string
}

export const inventoryService = {
  getStock: (productId: number, branch_id?: number) =>
    api
      .get<{ data: StockByBranch[] }>(`/api/inventory/stock/${productId}`, {
        params: branch_id ? { branch_id } : {},
      })
      .then((r) => r.data.data ?? []),

  listMovements: (params?: {
    product_id?: number
    product_q?: string
    category_id?: number
    branch_id?: number
    date_from?: string
    date_to?: string
    movement_kind?: string
    q?: string
    restaurant_only?: boolean
    page?: number
    per_page?: number
  }) =>
    api
      .get<{ data: StockMovement[]; total?: number }>('/api/inventory/movements', {
        params: {
          ...params,
          restaurant_only: params?.restaurant_only ? 'true' : undefined,
        },
      })
      .then((r) => ({
        data: r.data.data ?? [],
        total: r.data.total ?? r.data.data?.length ?? 0,
      })),

  getStockSummary: (productIds: number[]) =>
    productIds.length === 0
      ? Promise.resolve({} as Record<string, number>)
      : api
          .get<{ data: Record<string, number> }>('/api/inventory/stock-summary', {
            params: { product_ids: productIds.join(',') },
          })
          .then((r) => r.data.data ?? {}),

  adjustment: (body: {
    product_id: number
    branch_id: number
    type: 'in' | 'out'
    quantity: number
    notes: string
  }) => api.post<{ ok: boolean }>('/api/inventory/adjustment', body).then((r) => r.data),
}
