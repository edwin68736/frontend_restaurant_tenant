import { isNativeShell } from '@/lib/platform/detect'
import {
  clearLegacyLocalStorageBinding,
  clearTenantBindingOnDevice,
  readTenantBindingFromDevice,
  writeTenantBindingToDevice,
} from './persist'
import {
  isValidTenantBinding,
  normalizeBindingApiUrl,
  TENANT_BINDING_VERSION,
  type TenantBinding,
  type TenantByRucResponse,
} from './types'

let cache: TenantBinding | null = null
let initPromise: Promise<TenantBinding | null> | null = null

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribeTenantBinding(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTenantBinding(): TenantBinding | null {
  return cache
}

/** true solo si hay configuración válida (slug + URL del tenant, no API central). */
export function isTenantBound(): boolean {
  return isValidTenantBinding(cache)
}

/**
 * Carga vinculación desde almacenamiento nativo (Tauri/Capacitor).
 * Sin archivo de configuración → no vinculado → debe mostrarse pantalla RUC.
 * No migra automáticamente desde localStorage en apps nativas.
 */
export async function initTenantBindingStore(): Promise<TenantBinding | null> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    // Tauri/Capacitor: nunca usar localStorage del WebView como vinculación (solo archivo nativo).
    if (isNativeShell()) {
      clearLegacyLocalStorageBinding()
    }

    let binding = await readTenantBindingFromDevice()

    if (binding && !isValidTenantBinding(binding)) {
      await clearTenantBindingOnDevice()
      binding = null
    }

    cache = binding
    notify()
    return binding
  })()
  return initPromise
}

export function resetTenantBindingInit(): void {
  initPromise = null
}

export async function reloadTenantBindingStore(): Promise<TenantBinding | null> {
  resetTenantBindingInit()
  return initTenantBindingStore()
}

function devTenantApiFallback(): string {
  const central = import.meta.env.VITE_CENTRAL_API_URL || import.meta.env.VITE_API_URL
  if (central && typeof central === 'string' && central.trim()) {
    return normalizeBindingApiUrl(central)
  }
  return 'http://localhost:3000'
}

export async function bindTenantFromRuc(data: TenantByRucResponse, ruc: string): Promise<TenantBinding> {
  const rucNorm = ruc.replace(/\D/g, '').trim()
  const slug = (data.tenant_slug || data.slug).trim()
  let apiUrl = normalizeBindingApiUrl(data.api_url || '')
  if (!apiUrl && import.meta.env.DEV) {
    apiUrl = devTenantApiFallback()
  }

  if (!slug) {
    throw new Error('El servidor no devolvió el identificador de la empresa')
  }
  if (!apiUrl) {
    throw new Error('El servidor no devolvió la URL del tenant. Contacte soporte.')
  }

  const candidate: TenantBinding = {
    version: TENANT_BINDING_VERSION,
    slug,
    apiUrl,
    name: data.name?.trim() ?? '',
    ruc: rucNorm,
    tokenConsultaDatos: data.token_consulta_datos?.trim() ?? '',
    boundAt: new Date().toISOString(),
  }

  if (!isValidTenantBinding(candidate)) {
    throw new Error(
      'La URL del tenant no es válida. Debe ser el subdominio de su empresa (no api.tukifac.com).',
    )
  }

  if (cache && cache.slug !== slug) {
    throw new Error(
      'Esta instalación ya está vinculada a otra empresa. Desinstale la aplicación para vincular otro RUC.',
    )
  }

  const binding: TenantBinding = {
    ...candidate,
    boundAt: cache?.boundAt ?? candidate.boundAt,
  }

  await writeTenantBindingToDevice(binding)
  clearLegacyLocalStorageBinding()
  cache = binding
  notify()
  return binding
}

export async function wipeTenantBinding(): Promise<void> {
  await clearTenantBindingOnDevice()
  clearLegacyLocalStorageBinding()
  cache = null
  resetTenantBindingInit()
  notify()
}
