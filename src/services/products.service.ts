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
  preparation_area_id?: number | null
  preparation_area?: string | null
  has_modifiers?: boolean
  has_variants?: boolean
  /** Producto compuesto: su precio es fijo y se sirve explotado en sus componentes. */
  has_combo?: boolean
  presentations?: ProductPresentation[]
  combo_groups?: ComboGroup[]
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

/**
 * Tipo de selección de un grupo de combo:
 * - fixed: componente siempre incluido, el cliente no elige (ej: el pollo).
 * - single: el cliente elige exactamente una opción (ej: tu bebida).
 * - multiple: elige entre min_select y max_select, con cantidad si allow_quantity.
 */
export type ComboSelectionType = 'fixed' | 'single' | 'multiple'

export interface ComboGroupItem {
  id?: number
  product_id: number
  preparation_area_id?: number | null
  default_quantity: number
  max_quantity: number
  /** Sobreprecio si es una opción premium (ej: cambiar agua por gaseosa: +1.50). */
  extra_price: number
  is_default?: boolean
  sort_order?: number
  /** Datos vivos del producto componente (solo lectura, los envía el backend). */
  product_name?: string
  product_code?: string
  product_sale_price?: number
  product_image_url?: string
  preparation_area?: string
}

export interface ComboGroup {
  id?: number
  name: string
  selection_type: ComboSelectionType
  min_select: number
  max_select: number
  allow_quantity?: boolean
  sort_order?: number
  items: ComboGroupItem[]
}

/** Lo que el cliente eligió en un grupo al pedir el combo. */
export interface ComboSelection {
  group_id: number
  items: { product_id: number; quantity: number }[]
}

export type ModifierOptionInput = { name: string; extra_price: number }

export interface Category {
  id: number
  name: string
  description?: string
  parent_id?: number | null
  sort_order?: number
  active?: boolean
}

export interface CategoryWithCount extends Category {
  product_count?: number
}

export interface PreparationArea {
  id: number
  name: string
  slug: string
  sort_order?: number
  active?: boolean
}

export interface PreparationAreaWithCount extends PreparationArea {
  product_count?: number
}

/** Fila enriquecida cuando GET /api/products se llama con report=1 */
export interface ProductReportRow extends Product {
  stock_total?: number
  stock_by_branch?: { branch_id: number; branch_name: string; quantity: number }[]
  serials?: string[]
  serial_count?: number
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

export interface BulkDeleteProductRef {
  id: number
  name: string
}

export interface BulkDeleteBlockedItem {
  id: number
  name: string
  reasons: string[]
}

export interface BulkDeleteRestaurantResult {
  deleted: BulkDeleteProductRef[]
  blocked: BulkDeleteBlockedItem[]
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
  preparation_area_id?: number | null
  preparation_area?: string | null
  modifier_group_ids?: number[]
  presentations?: ProductPresentation[]
  /** Grupos del combo. En update: omitir = no tocar; [] = deja de ser combo. */
  combo_groups?: ComboGroup[]
  active?: boolean
}

export type ProductSortField = 'id' | 'code' | 'name' | 'category' | 'price' | 'stock'
export type ProductSortDir = 'asc' | 'desc'

/** Lista con paginación. restaurant_only=true y active_only=true por defecto. category_id y preparation_area opcionales. */
export const productsService = {
  list: (
    q = '',
    restaurantOnly = true,
    page = 1,
    perPage = 10,
    categoryId?: number | null,
    preparationArea?: number | string | null,
    branchId?: number | null,
    activeOnly = true,
    inactiveOnly = false,
    options?: ApiRequestOptions & {
      sortBy?: ProductSortField
      sortDir?: ProductSortDir
      /** Solo combos (tab Combos del panel). */
      combosOnly?: boolean
      /** Sin combos: candidatos a componente (un combo no puede contener otro combo). */
      excludeCombos?: boolean
    },
  ) =>
    api
      .get<{ data: Product[]; total?: number }>('/api/products', {
        params: {
          q,
          restaurant_only: restaurantOnly ? 'true' : 'false',
          combos_only: options?.combosOnly ? 'true' : undefined,
          exclude_combos: options?.excludeCombos ? 'true' : undefined,
          active_only: inactiveOnly ? 'false' : activeOnly ? 'true' : 'false',
          inactive_only: inactiveOnly ? 'true' : 'false',
          page,
          per_page: perPage,
          category_id: categoryId ?? undefined,
          preparation_area_id:
            typeof preparationArea === 'number' ? preparationArea : undefined,
          preparation_area:
            typeof preparationArea === 'string' && preparationArea.trim()
              ? preparationArea.trim()
              : undefined,
          branch_id: branchId && branchId > 0 ? branchId : undefined,
          sort_by: options?.sortBy,
          sort_dir: options?.sortDir,
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

  /** Búsqueda exacta por código de barras (POS / cámara). Variantes EAN-13 / UPC-A en el servidor. */
  lookupByBarcode: (code: string, branchId?: number | null) =>
    api
      .get<{ data: Product }>('/api/products/lookup-by-code', {
        params: {
          code: code.trim(),
          branch_id: branchId && branchId > 0 ? branchId : undefined,
        },
      })
      .then((r) => r.data.data ?? null)
      .catch((e: { response?: { status?: number } }) => {
        if (e?.response?.status === 404) return null
        throw e
      }),

  get: (id: number) =>
    api
      .get<{
        data: Product
        modifier_group_ids: number[]
        presentations?: ProductPresentation[]
        combo_groups?: ComboGroup[]
        /** Suma de los componentes a precio de lista: sirve para mostrar el ahorro. */
        combo_components_total?: number
      }>(`/api/products/${id}`)
      .then((r) => ({
        data: {
          ...r.data.data!,
          presentations: r.data.presentations ?? [],
          combo_groups: r.data.combo_groups ?? [],
        },
        modifier_group_ids: r.data.modifier_group_ids ?? [],
        presentations: r.data.presentations ?? [],
        combo_groups: r.data.combo_groups ?? [],
        combo_components_total: r.data.combo_components_total ?? 0,
      })),

  bulkImportRestaurant: (items: BulkImportItemPayload[], branchId?: number) =>
    api
      .post<{ success: boolean; data: BulkImportResultPayload }>(
        '/api/products/bulk-import/restaurant',
        { branch_id: branchId && branchId > 0 ? branchId : undefined, items },
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
      preparation_area_id: data.preparation_area_id ?? null,
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
      combo_groups: data.combo_groups ?? [],
    }).then((r) => r.data.data!),

  update: (id: number, data: Partial<CreateProductInput>) =>
    api.put(`/api/products/${id}`, data).then((r) => r.data),

  /** Activa/desactiva sin tocar el resto del producto (evita PUT parcial). */
  toggleActive: (id: number) =>
    api
      .patch<{ success: boolean; active: boolean }>(`/api/products/${id}/toggle`)
      .then((r) => r.data.active),

  delete: (id: number) => api.delete(`/api/products/${id}`).then((r) => r.data),

  bulkDeleteRestaurant: (productIds: number[], pin: string, reason: string) =>
    api
      .post<BulkDeleteRestaurantResult>('/api/products/bulk-delete/restaurant', {
        product_ids: productIds,
        pin,
        reason,
      })
      .then((r) => r.data),

  /** Listado para reportes: stock, categoría, series (cartá restaurante con restaurant_only). */
  listReport: (params: {
    q?: string
    category_id?: number
    branch_id?: number
    active_only?: boolean
    no_manage_stock_only?: boolean
    page?: number
    per_page?: number
    stock_less_than?: number
    preparation_area?: string
  }) =>
    api
      .get<{ data: ProductReportRow[]; total?: number }>('/api/products', {
        params: {
          q: params.q,
          category_id: params.category_id,
          branch_id: params.branch_id,
          active_only: params.active_only ?? true,
          page: params.page,
          per_page: params.per_page,
          stock_less_than: params.stock_less_than,
          preparation_area: params.preparation_area,
          restaurant_only: true,
          no_manage_stock_only: params.no_manage_stock_only ? 'true' : undefined,
          report: true,
        },
      })
      .then((r) => ({
        data: r.data.data ?? [],
        total: r.data.total ?? 0,
      })),

  listCategories: () =>
    api.get<{ data: Category[] }>('/api/categories').then((r) => r.data.data ?? []),

  listCategoriesWithCounts: () =>
    api
      .get<{ data: CategoryWithCount[] }>('/api/categories', { params: { with_counts: 'true' } })
      .then((r) => r.data.data ?? []),

  createCategory: (name: string, description?: string, sortOrder?: number) =>
    api
      .post<{ data: Category }>('/api/categories', {
        name,
        description: description ?? '',
        sort_order: sortOrder,
      })
      .then((r) => r.data.data!),

  updateCategory: (
    id: number,
    data: { name: string; description?: string; sort_order: number },
  ) =>
    api.put<{ data: Category }>(`/api/categories/${id}`, data).then((r) => r.data.data!),

  deleteCategory: (id: number) => api.delete(`/api/categories/${id}`).then((r) => r.data),

  listPreparationAreas: () =>
    api.get<{ data: PreparationArea[] }>('/api/preparation-areas').then((r) => r.data.data ?? []),

  listPreparationAreasWithCounts: () =>
    api
      .get<{ data: PreparationAreaWithCount[] }>('/api/preparation-areas', {
        params: { with_counts: 'true' },
      })
      .then((r) => r.data.data ?? []),

  createPreparationArea: (name: string, slug?: string, sortOrder?: number) =>
    api
      .post<{ data: PreparationArea }>('/api/preparation-areas', {
        name,
        slug: slug ?? '',
        sort_order: sortOrder,
      })
      .then((r) => r.data.data!),

  updatePreparationArea: (id: number, data: { name: string; sort_order: number }) =>
    api.put<{ data: PreparationArea }>(`/api/preparation-areas/${id}`, data).then((r) => r.data.data!),

  deletePreparationArea: (id: number) =>
    api.delete(`/api/preparation-areas/${id}`).then((r) => r.data),

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
