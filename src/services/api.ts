import axios from 'axios'
import { isDevelopmentMode } from '@/lib/runtime/environment'
import { getResolvedTenantApiUrl, getTenantBinding } from '@/lib/tenantBinding/store'
import { isTauriDesktop } from '@/lib/app'

function normalizeApiOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  if (base.endsWith('/api')) base = base.slice(0, -4)
  return base
}

/** API central: solo bootstrap (tenant-by-ruc). */
export function getCentralApiBaseUrl(): string {
  const central = import.meta.env.VITE_CENTRAL_API_URL
  if (central && typeof central === 'string' && central.trim() !== '') {
    return normalizeApiOrigin(central)
  }
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return normalizeApiOrigin(fromEnv)
  }
  return 'https://api.tukifac.cloud'
}

/**
 * API del tenant desde vinculaci?n persistida.
 * En DEV las peticiones van por proxy Vite (baseURL '') y X-Tenant-Api-Origin.
 */
export function getTenantApiBaseUrl(): string {
  if (isDevelopmentMode()) {
    return ''
  }
  const url = getResolvedTenantApiUrl()
  return url ? normalizeApiOrigin(url) : ''
}

/** URL mostrada al usuario / overlay de conexi?n. */
export function getDisplayedTenantApiUrl(): string {
  const url = getResolvedTenantApiUrl()
  if (url) return normalizeApiOrigin(url)
  if (isDevelopmentMode()) {
    const central = getCentralApiBaseUrl()
    return central ? `${central} (proxy dev)` : 'Proxy local (Vite)'
  }
  return 'ÿÿÿ'
}

/** En DEV todas las peticiones van por proxy local (sin CORS). */
export function shouldUseDevProxy(): boolean {
  return import.meta.env.DEV
}

export function getCentralApiRequestBaseUrl(): string {
  if (shouldUseDevProxy()) return ''
  return getCentralApiBaseUrl()
}

/**
 * Origen para /uploads y /storage. En release los archivos los sirve el backend Go
 * (p. ej. api.tukifac.com), no el host del tenant SPA (demo.tukifac.com).
 */
export function getPublicAssetsBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_ASSETS_ORIGIN as string | undefined
  if (fromEnv?.trim()) return normalizeApiOrigin(fromEnv)
  if (shouldUseDevProxy()) return ''
  return getCentralApiBaseUrl()
}

export function resolvePublicAssetUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const base = getPublicAssetsBaseUrl()
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : '/' + url}`
}

function getApiBaseUrl(): string {
  if (shouldUseDevProxy()) return ''
  const tenantUrl = getTenantApiBaseUrl()
  if (tenantUrl) return tenantUrl
  return ''
}

const API_BASE_URL = getApiBaseUrl()

export function getTenantSlug(): string {
  return getTenantBinding()?.slug?.trim() ?? ''
}

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  if (isDevelopmentMode()) {
    config.baseURL = ''
    const tenantOrigin = getResolvedTenantApiUrl()
    if (tenantOrigin) {
      config.headers['X-Tenant-Api-Origin'] = normalizeApiOrigin(tenantOrigin)
    }
  } else {
    const tenantUrl = getTenantApiBaseUrl()
    config.baseURL = tenantUrl || ''
  }

  if (!getTenantBinding()?.apiUrl && !config.url?.includes('/api/public/')) {
    console.warn('[Tukichef] Sin URL de tenant: vincule el RUC primero.')
  }

  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const slug = getTenantSlug()
  if (slug) config.headers['X-Tenant-Slug'] = slug

  return config
})

export const SESSION_EXPIRED_EVENT = 'tukichef-session-expired'

const TOAST_SESSION_EXPIRED = 'session-expired'
const TOAST_TENANT_ISOLATION = 'tenant-isolation'

type ReloginReason = 'session_expired' | 'tenant_isolation'

let reloginHandled = false

export function resetReloginGuard() {
  reloginHandled = false
}

function getReloginMessage(reason: ReloginReason): string {
  if (reason === 'tenant_isolation') {
    return 'Sesi?n inv?lida para esta empresa. Vuelva a vincular el RUC e iniciar sesi?n.'
  }
  return 'Su sesi?n ha vencido. Inicie sesi?n nuevamente.'
}

function isPublicRouteHash(): boolean {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const path = hash.split('?')[0]
  return path === '/home' || path === '/login' || path === '/ruc' || path.startsWith('/pin/')
}

function forceRelogin(reason: ReloginReason) {
  if (reloginHandled) return
  reloginHandled = true

  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('active_branch')
  localStorage.removeItem('allowed_branches')
  localStorage.removeItem('can_switch_branch')
  localStorage.removeItem('restaurant_permissions')

  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))

  const toastId = reason === 'tenant_isolation' ? TOAST_TENANT_ISOLATION : TOAST_SESSION_EXPIRED
  import('sonner').then(({ toast }) => {
    toast.error(getReloginMessage(reason), { id: toastId })
  })

  if (!isPublicRouteHash()) {
    window.location.hash = '#/home'
  }
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const code = err.response?.data?.code as string | undefined
    if (err.response?.status === 403 && code === 'TENANT_ISOLATION_VIOLATION') {
      forceRelogin('tenant_isolation')
      return Promise.reject(err)
    }
    if (err.response?.status === 401 && code === 'TOKEN_TENANT_INVALID') {
      forceRelogin('session_expired')
      return Promise.reject(err)
    }
    if (err.response?.status === 409 && code === 'SESSION_UPDATED') {
      forceRelogin('session_expired')
      return Promise.reject(err)
    }
    if (err.response?.status === 401) {
      forceRelogin('session_expired')
      return Promise.reject(err)
    }
    return Promise.reject(err)
  },
)

export default api
export { API_BASE_URL, getApiBaseUrl, isTauriDesktop }
