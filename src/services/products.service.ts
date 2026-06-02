import api, { resolvePublicAssetUrl } from './api'

export type ApiRequestOptions = { signal?: AbortSignal }

export interface Product {
  id: number
  code: string
  name: string
  description?: string
  image_url?: string | null
  sale_price: number
  purchase_price?: number
  unit: string
  category_id?: number | null
  category_name?: string
  is_restaurant: boolean
  preparation_area?: string | null
  has_modifiers?: boolean
  has_variants?: boolean
  presentations?: ProductPresentation[]
  manage_stock?: boolean
  active: boolean
  /** Sucursal dueña del plato (catálogo independiente por sucursal). */
  branch_id?: number
  /** Catálogo SUNAT N°07: 10 Gravado, 20 Exonerado, 30 Inafecto, 40 Exportación */
  igv_affectation_type?: string
  /** Si el precio de venta ya incluye IGV (solo aplica cuando es gravado) */
  price_includes_igv?: boolean
}

export interface ProductPresentation {
  id?: number
  name: string
  sale_price: number
  sort_order?: number
}

export interface ModifierGroup {
  id: number
  name: string
  required: boolean
  multi_select?: boolean
  options: { id: number; name: string; extra_price?: number }[]
}

export type ModifierOptionInput = { name: string; extra_price: number }

export interface Category {
  id: number
  name: string
  description?: string
  parent_id?: number | null
  active?: boolean
}

export interface BulkImportItemPayload {
  row_number: number
  name: string
  code?: string
  description?: string
  sale_price: number
  unit?: string
  category_name?: string
  igv_affectation_type?: string
  price_includes_igv?: boolean
  manage_stock?: boolean
  initial_stock?: number
  preparation_area?: string
}

export interface BulkImportResultPayload {
  created: number
  updated?: number
  stock_registered: number
  failed: { row: number; name: string; error: string }[]
}

export interface CreateProductInput {
  code?: string
  name: string
  description?: string
  image_url?: string
  unit?: string
  sale_price: number
  purchase_price?: number
  category_id?: number | null
  igv_affectation_type?: string
  price_includes_igv?: boolean
  manage_stock?: boolean
  /** Cantidad inicial en sucursal activa; registra kardex (entrada STOCK_INICIAL). */
  initial_stock?: number
  has_modifiers?: boolean
  has_variants?: boolean
  is_restaurant?: boolean
  preparation_area?: string | null
  modifier_group_ids?: number[]
  presentations?: ProductPresentation[]
  active?: boolean
}

/** Lista con paginación. restaurant_only=true y active_only=true por defecto. category_id y preparation_area opcionales. */
export const productsService = {
  list: (
    q = '',
    restaurantOnly = true,
    page = 1,
    perPage = 10,
    categoryId?: number | null,
    preparationArea?: string | null,
    branchId?: number | null,
    activeOnly = true,
    inactiveOnly = false,
    options?: ApiRequestOptions,
  ) =>
    api
      .get<{ data: Product[]; total?: number }>('/api/products', {
        params: {
          q,
          restaurant_only: restaurantOnly ? 'true' : 'false',
          active_only: inactiveOnly ? 'false' : activeOnly ? 'true' : 'false',
          inactive_only: inactiveOnly ? 'true' : 'false',
          page,
          per_page: perPage,
          category_id: categoryId ?? undefined,
          preparation_area: preparationArea ?? undefined,
          branch_id: branchId && branchId > 0 ? branchId : undefined,
        },
        signal: options?.signal,
      })
      .then((r) => ({
        data: r.data.data ?? [],
        total: r.data.total ?? 0,
      })),

  /** Lista todos los productos de restaurante (sin paginación). Para POS y Mesa. */
  listRestaurantAll: (q = '', branchId?: number) =>
    api
      .get<{ data: Product[] }>('/api/products', {
        params: {
          q,
          restaurant_only: 'true',
          active_only: 'true',
          page: 1,
          per_page: 0,
          branch_id: branchId && branchId > 0 ? branchId : undefined,
        },
      })
      .then((r) => r.data.data ?? []),

  get: (id: number) =>
    api
      .get<{ data: Product; modifier_group_ids: number[]; presentations?: ProductPresentation[] }>(
        `/api/products/${id}`,
      )
      .then((r) => ({
        data: {
          ...r.data.data!,
          presentations: r.data.presentations ?? [],
        },
        modifier_group_ids: r.data.modifier_group_ids ?? [],
        presentations: r.data.presentations ?? [],
      })),

  bulkImportRestaurant: (items: BulkImportItemPayload[]) =>
    api
      .post<{ success: boolean; data: BulkImportResultPayload }>(
        '/api/products/bulk-import/restaurant',
        { items },
      )
      .then((r) => r.data.data),

  create: (data: CreateProductInput) =>
    api.post<{ data: Product }>('/api/products', {
      name: data.name,
      code: data.code ?? '',
      description: data.description ?? '',
      image_url: data.image_url ?? '',
      unit: data.unit ?? 'NIU',
      sale_price: data.sale_price,
      purchase_price:
        data.purchase_price != null && data.purchase_price > 0 ? data.purchase_price : 0,
      category_id: data.category_id ?? null,
      preparation_area: data.preparation_area ?? '',
      igv_affectation_type: data.igv_affectation_type ?? '10',
      price_includes_igv: data.price_includes_igv ?? true,
      manage_stock: data.manage_stock ?? false,
      initial_stock:
        data.initial_stock != null && data.initial_stock > 0 ? data.initial_stock : undefined,
      has_modifiers: data.has_modifiers ?? false,
      has_variants: data.has_variants ?? false,
      is_restaurant: true,
      modifier_group_ids: data.modifier_group_ids ?? [],
      presentations: data.presentations ?? [],
    }).then((r) => r.data.data!),

  update: (id: number, data: Partial<CreateProductInput>) =>
    api.put(`/api/products/${id}`, data).then((r) => r.data),

  /** Activa/desactiva sin tocar el resto del producto (evita PUT parcial). */
  toggleActive: (id: number) =>
    api
      .patch<{ success: boolean; active: boolean }>(`/api/products/${id}/toggle`)
      .then((r) => r.data.active),

  delete: (id: number) => api.delete(`/api/products/${id}`).then((r) => r.data),

  listCategories: () =>
    api.get<{ data: Category[] }>('/api/categories').then((r) => r.data.data ?? []),

  createCategory: (name: string, description?: string) =>
    api.post<{ data: Category }>('/api/categories', { name, description: description ?? '' }).then((r) => r.data.data!),

  /** Stock total por producto (suma sucursales). Requiere módulo inventario. */
  getStockSummary: (productIds: number[]) =>
    productIds.length === 0
      ? Promise.resolve({} as Record<string, number>)
      : api
          .get<{ data: Record<string, number> }>('/api/inventory/stock-summary', {
            params: { product_ids: productIds.join(',') },
          })
          .then((r) => r.data.data ?? {}),

  listModifierGroups: () =>
    api.get<{ data: ModifierGroup[] }>('/api/modifier-groups').then((r) => r.data.data ?? []),

  createModifierGroup: (data: {
    name: string
    required: boolean
    multi_select?: boolean
    options: ModifierOptionInput[]
  }) =>
    api
      .post<{ group: ModifierGroup }>('/api/modifier-groups', {
        name: data.name,
        required: data.required ?? false,
        multi_select: data.multi_select ?? false,
        options: data.options ?? [],
      })
      .then((r) => r.data.group),

  updateModifierGroup: (
    id: number,
    data: { name: string; required: boolean; multi_select?: boolean; options: ModifierOptionInput[] },
  ) =>
    api
      .put<{ group: ModifierGroup }>(`/api/modifier-groups/${id}`, {
        name: data.name,
        required: data.required ?? false,
        multi_select: data.multi_select ?? false,
        options: data.options ?? [],
      })
      .then((r) => r.data.group),

  deleteModifierGroup: (id: number) =>
    api.delete(`/api/modifier-groups/${id}`).then((r) => r.data),

  uploadImage: (productId: number, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api
      .post<{ image_url: string }>(`/api/products/${productId}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.image_url)
  },
}

export function getProductImageUrl(url: string | null | undefined): string {
  return resolvePublicAssetUrl(url)
}
