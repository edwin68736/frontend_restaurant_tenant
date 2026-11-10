import { getTenantBinding } from '@/lib/tenantBinding/store'

/**
 * Almacenamiento local por EMPRESA (tenant): logo cacheado y ajustes de impresión no se comparten
 * entre empresas que usan el mismo dispositivo.
 *
 * La clave llevaba solo el nombre base; ahora es `base::<slug>`. Migración perezosa: si no existe
 * la clave de la empresa pero sí la antigua (sin slug), la primera empresa que la lee la adopta y la
 * antigua se borra, de modo que las configuraciones existentes no se pierden.
 */
export function currentTenantSlug(): string {
  try {
    return getTenantBinding()?.slug?.trim() ?? ''
  } catch {
    return ''
  }
}

export function tenantScopedKey(base: string, slug = currentTenantSlug()): string {
  return slug ? `${base}::${slug}` : base
}

/** Lee la clave de la empresa actual; si no existe adopta (y borra) la clave antigua sin slug. */
export function readTenantScoped(base: string, slug = currentTenantSlug()): string | null {
  const scoped = tenantScopedKey(base, slug)
  const own = localStorage.getItem(scoped)
  if (own != null || scoped === base) return own
  const legacy = localStorage.getItem(base)
  if (legacy != null) {
    try {
      localStorage.setItem(scoped, legacy)
      localStorage.removeItem(base)
    } catch {
      /* quota */
    }
  }
  return legacy
}

export function writeTenantScoped(base: string, value: string, slug = currentTenantSlug()): void {
  localStorage.setItem(tenantScopedKey(base, slug), value)
}

export function removeTenantScoped(base: string, slug = currentTenantSlug()): void {
  localStorage.removeItem(tenantScopedKey(base, slug))
}
