import axios from 'axios'
import { RESTAURANT_STORAGE_KEYS } from './public.service'
import { isTauriDesktop } from '@/lib/app'

function normalizeApiOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  if (base.endsWith('/api')) base = base.slice(0, -4)
  return base
}

function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
}

/** Origen del backend en desarrollo local (misma convención que frontend_tenant). */
function getLocalDevApiOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return normalizeApiOrigin(fromEnv)
  }
  return 'http://localhost:3000'
}

/** API central (solo bootstrap RUC). Ej: https://api.tukifac.com o app.tukifac.com */
export function getCentralApiBaseUrl(): string {
  const central = import.meta.env.VITE_CENTRAL_API_URL
  if (central && typeof central === 'string' && central.trim() !== '') {
    return normalizeApiOrigin(central)
  }
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return normalizeApiOrigin(fromEnv)
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
      return 'http://localhost:3000'
    }
  }
  return 'https://api.tukifac.cloud'
}

/**
 * API del tenant (subdominio persistido tras RUC).
 * Producción: https://empresa1.tukifac.com — el host identifica el tenant.
 */
export function getTenantApiBaseUrl(): string {
  if (typeof window !== 'undefined' && isLocalDevHost(window.location.hostname)) {
    return getLocalDevApiOrigin()
  }

  const stored = localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantApiUrl)?.trim()
  if (stored) return normalizeApiOrigin(stored)

  const slug = getTenantSlug()
  const appDomain = import.meta.env.VITE_APP_DOMAIN
  if (slug && appDomain && typeof appDomain === 'string') {
    const domain = appDomain.replace(/^\./, '')
    if (domain === 'localhost' || domain.endsWith('.localhost')) {
      return getLocalDevApiOrigin()
    }
    return `https://${slug}.${domain}`
  }

  return getCentralApiBaseUrl()
}

/** En dev (npm run dev / tauri:dev) Vite proxifica /api → backend (.env). Evita CORS. */
export function shouldUseDevProxy(): boolean {
  return import.meta.env.DEV
}

/** Base URL para peticiones al API central (tenant-by-ruc, etc.). */
export function getCentralApiRequestBaseUrl(): string {
  if (shouldUseDevProxy()) return ''
  return getCentralApiBaseUrl()
}

function getApiBaseUrl(): string {
  if (shouldUseDevProxy()) return ''
  return getTenantApiBaseUrl()
}

const API_BASE_URL = getApiBaseUrl()

/** Slug del tenant (RUC). Se envía como redundancia; el host del subdominio es la fuente de verdad. */
export function getTenantSlug(): string {
  return localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantSlug)?.trim() || ''
}

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const slug = getTenantSlug()
  if (!slug && !config.url?.includes('/api/public/')) {
    console.warn('[Tukichef] Falta tenant: ingrese el RUC de la empresa primero.')
  }
  if (slug) config.headers['X-Tenant-Slug'] = slug

  return config
})

function forceRelogin(message: string) {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('active_branch')
  localStorage.removeItem('can_switch_branch')
  localStorage.removeItem('restaurant_permissions')
  import('sonner').then(({ toast }) => toast.error(message))
  window.location.hash = '#/home'
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const code = err.response?.data?.code as string | undefined
    if (err.response?.status === 403 && code === 'TENANT_ISOLATION_VIOLATION') {
      forceRelogin('Sesión inválida para esta empresa. Vuelva a vincular el RUC e iniciar sesión.')
      return Promise.reject(err)
    }
    if (err.response?.status === 401 && code === 'TOKEN_TENANT_INVALID') {
      forceRelogin('Su sesión expiró o es obsoleta. Inicie sesión nuevamente.')
      return Promise.reject(err)
    }
    if (err.response?.status === 409 && err.response?.data?.code === 'SESSION_UPDATED') {
      forceRelogin('Tu acceso fue actualizado. Vuelve a iniciar sesión.')
      return Promise.reject(err)
    }
    if (err.response?.status === 401) {
      forceRelogin('Sesión expirada. Inicie sesión nuevamente.')
      return Promise.reject(err)
    }
    return Promise.reject(err)
  },
)

export default api
export { API_BASE_URL, getApiBaseUrl, isTauriDesktop }
