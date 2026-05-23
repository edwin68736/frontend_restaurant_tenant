import axios from 'axios'
import { RESTAURANT_STORAGE_KEYS } from './public.service'
import { isTauriDesktop } from '@/lib/app'

function normalizeApiOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  if (base.endsWith('/api')) base = base.slice(0, -4)
  return base
}

/** En dev, si VITE_API_URL apunta fuera de localhost, Vite hace proxy en /api (sin CORS). */
function shouldUseDevProxy(): boolean {
  if (!import.meta.env.DEV) return false
  const fromEnv = import.meta.env.VITE_API_URL
  if (!fromEnv || typeof fromEnv !== 'string' || fromEnv.trim() === '') return true
  try {
    const host = new URL(normalizeApiOrigin(fromEnv)).hostname
    return host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.localhost')
  } catch {
    return false
  }
}

function getApiBaseUrl(): string {
  if (shouldUseDevProxy()) return ''

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

const API_BASE_URL = getApiBaseUrl()

/**
 * Slug del tenant para X-Tenant-Slug.
 * En Tukichef (Tauri / Capacitor) viene del RUC guardado al inicio; no hay subdominio.
 */
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

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 409 && err.response?.data?.code === 'SESSION_UPDATED') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('active_branch')
      localStorage.removeItem('can_switch_branch')
      import('sonner').then(({ toast }) => {
        toast.error('Tu acceso fue actualizado. Vuelve a iniciar sesión.')
      })
      window.location.hash = '#/home'
      return Promise.reject(err)
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('restaurant_permissions')
      window.location.hash = '#/home'
    }
    return Promise.reject(err)
  },
)

export default api
export { API_BASE_URL, getApiBaseUrl, isTauriDesktop }
