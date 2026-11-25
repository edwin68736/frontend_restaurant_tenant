import api from '@/services/api'

/** Recetas: costo, precio sugerido y disponibilidad. Todos los números los calcula el servidor. Ver /api/restaurant/recipes. */
export type RecipeLine = {
  supply_id: number
  name: string
  base_unit: string
  /** Cantidad servida, en `unit` (vacía = la unidad base). */
  quantity: number
  unit: string
  waste_pct: number
  qty_gross: number
  stock: number
  /** Solo con permiso de ver costos. */
  supply_cost?: number
  line_cost?: number
  cost_missing?: boolean
}

export type Costing = {
  portion_cost: number
  net_price: number
  /** Sol neto por cada sol publicado. */
  net_factor: number
  food_cost_pct: number
  margin: number
  margin_pct: number
  suggested_price: number
  suggested_food_cost_pct: number
  target_food_cost_pct: number
  over_target: boolean
  current_price_missing?: boolean
}

export type Dish = {
  product_id: number
  presentation_id: number
  name: string
  presentation_name?: string
  category_id?: number
  category_name?: string
  price: number
  branch_price: boolean
  is_combo: boolean
  has_recipe: boolean
  inherited?: boolean
  incomplete: boolean
  missing?: string[]
  available?: number
  limiting?: string
  yield_qty?: number
  recipe_target_food_cost_pct?: number | null
  costing?: Costing
  lines?: RecipeLine[]
}

export type RecipeSettings = {
  target_food_cost_pct: number
  price_rounding: 'none' | '0.10' | '0.50' | '1.00' | 'x.90'
  rounding_direction: 'up' | 'nearest'
  recipe_cost_basis: 'avg' | 'last'
}

export type RecipeBody = {
  presentation_id: number
  yield_qty: number
  target_food_cost_pct: number | null
  lines: { supply_id: number; quantity: number; unit: string; waste_pct: number }[]
}

export type RecipeDetail = { data: Dish[]; base_recipe: Dish | null; can_view_cost: boolean }

export type PriceChange = {
  id: number
  presentation_id: number
  branch_id: number
  price_before: number
  price_after: number
  user_name: string | null
  created_at: string
}

const BASE = '/api/restaurant/recipes'
const params = (branchId?: number) => ({ branch_id: branchId || undefined })

export const recipesService = {
  list: (branchId?: number) =>
    api
      .get<{ data: Dish[]; can_view_cost: boolean }>(BASE, { params: params(branchId) })
      .then((r) => ({ data: r.data.data ?? [], canViewCost: !!r.data.can_view_cost })),

  get: (productId: number, branchId?: number) =>
    api.get<RecipeDetail>(`${BASE}/${productId}`, { params: params(branchId) }).then((r) => r.data),

  save: (productId: number, body: RecipeBody, branchId?: number) =>
    api.put<RecipeDetail>(`${BASE}/${productId}`, body, { params: params(branchId) }).then((r) => r.data),

  remove: (productId: number, presentationId: number, branchId?: number) =>
    api
      .delete<RecipeDetail>(`${BASE}/${productId}`, { params: { ...params(branchId), presentation_id: presentationId } })
      .then((r) => r.data),

  applyPrice: (productId: number, body: { presentation_id: number; current_price: number; new_price: number }, branchId?: number) =>
    api.post<{ applied_branch_id: number }>(`${BASE}/${productId}/apply-price`, body, { params: params(branchId) }).then((r) => r.data),

  priceHistory: (productId: number, branchId?: number) =>
    api.get<{ data: PriceChange[] }>(`${BASE}/${productId}/price-history`, { params: params(branchId) }).then((r) => r.data.data ?? []),

  settings: () => api.get<{ data: RecipeSettings }>('/api/restaurant/recipe-settings').then((r) => r.data.data),

  saveSettings: (body: RecipeSettings) =>
    api.put<{ data: RecipeSettings }>('/api/restaurant/recipe-settings', body).then((r) => r.data.data),
}
