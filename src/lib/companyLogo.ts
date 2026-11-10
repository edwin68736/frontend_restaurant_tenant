import { companyService } from '@/services/company.service'
import { resolvePublicAssetUrl } from '@/services/api'
import { registerCache } from '@/lib/cacheRegistry'
import { currentTenantSlug, readTenantScoped, removeTenantScoped, writeTenantScoped } from '@/lib/tenantStorage'

/**
 * Logo del emisor para comprobantes. Es de la empresa, no de la venta, así que no se toma
 * del print_data: se resuelve una vez desde la config y se reutiliza.
 *
 * El backend lo manda embebido (logo_data_url), con lo que imprimir no depende de que el
 * dispositivo pueda descargar /uploads (CORS, origen). Si no viene, se cae a la URL pública.
 */
const STORAGE_KEY = 'tukichef_company_logo_v1'

let cached: string | null = null
let inFlight: Promise<string | null> | null = null
let seeded = false
/** Empresa a la que pertenece el logo en memoria: si cambia, el caché se descarta. */
let cachedSlug = ''

/** El logo es POR EMPRESA: nunca se reutiliza el de otra empresa en el mismo dispositivo. */
function syncTenant() {
  const slug = currentTenantSlug()
  if (slug !== cachedSlug) {
    cachedSlug = slug
    cached = null
    inFlight = null
    seeded = false
  }
}

function seedFromStorage() {
  syncTenant()
  if (seeded) return
  seeded = true
  try {
    cached = readTenantScoped(STORAGE_KEY) || null
  } catch {
    cached = null
  }
}

function persist(logo: string | null) {
  syncTenant()
  cached = logo
  seeded = true
  try {
    if (logo) writeTenantScoped(STORAGE_KEY, logo)
    else removeTenantScoped(STORAGE_KEY)
  } catch {
    /* quota */
  }
}

function pickLogo(cfg: { logo_data_url?: string; logo_url?: string } | null | undefined): string | null {
  const embedded = String(cfg?.logo_data_url ?? '').trim()
  if (embedded.startsWith('data:')) return embedded
  const raw = String(cfg?.logo_url ?? '').trim()
  if (!raw) return null
  return raw.startsWith('data:') ? raw : resolvePublicAssetUrl(raw)
}

/** Refresca el logo cacheado desde una config ya cargada (o al editarlo). */
export function primeCompanyLogo(cfg: { logo_data_url?: string; logo_url?: string } | null | undefined) {
  persist(pickLogo(cfg))
}

/** Olvida el logo cacheado (al borrarlo o cerrar sesión). */
export function clearCompanyLogoCache() {
  persist(null)
}

/** Cierre de sesión: se olvida el logo en memoria (el de la empresa vuelve a leerse de su clave). */
registerCache('companyLogo', 'session', () => {
  cached = null
  inFlight = null
  seeded = false
  cachedSlug = ''
})

/**
 * Devuelve el logo listo para imprimir, cargando la config la primera vez. Idempotente:
 * las llamadas concurrentes comparten la misma petición.
 */
export async function ensureCompanyLogoForPrint(): Promise<string | null> {
  seedFromStorage()
  if (cached) return cached
  if (inFlight) return inFlight
  inFlight = companyService
    .getConfig()
    .then((cfg) => {
      persist(pickLogo(cfg))
      return cached
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * Logo para imprimir UN comprobante puntual. Si `preferred` trae logo_url/logo_data_url ya
 * resuelto (ej. printData.company, que desde la Fase de logo-por-sucursal puede traer el logo
 * propio de la sucursal emisora — ver pkg/branchlogo.ResolveURL en el backend), se usa ESE,
 * sin pasar por el caché global de un solo slot (que es por-tenant, no por-sucursal, y se
 * pisaría si se guardara ahí un logo de sucursal). Si no viene nada resoluble, cae al logo
 * global cacheado de siempre.
 */
export async function resolveLogoForPrint(
  preferred?: { logo_data_url?: string; logo_url?: string } | null,
): Promise<string | null> {
  const picked = pickLogo(preferred)
  if (picked) return picked
  return ensureCompanyLogoForPrint()
}
