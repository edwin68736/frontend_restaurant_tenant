/**
 * Permisos del catálogo global de productos (espejo de `middleware.RequireGlobalCatalog` del backend).
 *
 * `products.manage_global` = crear/editar/eliminar productos y platos, categorías, marcas, unidades, imágenes,
 * importaciones, precio global y costo. `products.manage` lo implica (como todo `{modulo}.manage`).
 * El precio por sucursal, la visibilidad por sucursal y el ajuste de stock NO lo exigen: siguen con
 * products.edit / inventario.
 *
 * Los permisos del tenant viajan en el JWT (`permissions`). El POS por PIN no los lleva: su flujo se rige por
 * los permisos de restaurante (puente restaurantperm, p. ej. g.p), que el backend resuelve; ahí la UI queda como
 * estaba y el servidor decide.
 */
export const PERM_PRODUCTS_MANAGE_GLOBAL = 'products.manage_global'

/** Misma regla que el backend (tenantHasPermission): permiso exacto o `{modulo}.manage`. */
export function tenantHasPermission(permissions: string[] | null | undefined, required: string): boolean {
  if (!permissions || permissions.length === 0 || !required) return false
  if (permissions.includes(required)) return true
  const dot = required.indexOf('.')
  return dot > 0 && permissions.includes(`${required.slice(0, dot)}.manage`)
}

export function canManageGlobalCatalog(
  permissions: string[] | null | undefined,
  authMethod?: string | null,
): boolean {
  if (authMethod === 'pin') return true // el puente de restaurante lo resuelve el backend
  return tenantHasPermission(permissions, PERM_PRODUCTS_MANAGE_GLOBAL)
}
