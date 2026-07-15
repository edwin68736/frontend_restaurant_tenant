import { companyService } from '@/services/company.service'
import { resolvePublicAssetUrl } from '@/services/api'

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

function seedFromStorage() {
  if (seeded) return
  seeded = true
  try {
    cached = localStorage.getItem(STORAGE_KEY) || null
  } catch {
    cached = null
  }
}

function persist(logo: string | null) {
  cached = logo
  seeded = true
  try {
    if (logo) localStorage.setItem(STORAGE_KEY, logo)
    else localStorage.removeItem(STORAGE_KEY)
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
