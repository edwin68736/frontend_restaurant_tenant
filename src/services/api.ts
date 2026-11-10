import axios, { AxiosError, type AxiosResponse } from 'axios'
import {
  BRANCH_MODE_ALL,
  BRANCH_MODE_HEADER,
  BRANCH_READ_ONLY_CODE,
  BRANCH_READ_ONLY_EVENT,
  READ_ONLY_MESSAGE,
  isReadOnlyMode,
} from '@/lib/branch/viewMode'
import { isDevelopmentMode } from '@/lib/runtime/environment'
import { getResolvedTenantApiUrl, getTenantBinding } from '@/lib/tenantBinding/store'
import { isTauriDesktop } from '@/lib/app'
import { currentEpoch, currentEpochSignal, isBranchSwitching } from '@/lib/branch/epoch'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Época de sucursal en la que salió la petición (interno, lo fija el interceptor). */
    _branchEpoch?: number
    /** Token con el que salió la petición (interno). */
    _reqToken?: string | null
    /** true = la petición no depende de la sucursal (login, refresh, contexto, cambio de sucursal). */
    _epochExempt?: boolean
    /** true = el AbortSignal de la época se adjuntó a esta petición (interno). */
    _epochAborts?: boolean
  }
}

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
  return '���'
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

/**
 * Peticiones que NO se atan a la época de sucursal: autenticación, contexto y cambio de sucursal.
 * Abortarlas al cambiar de sucursal rompería el propio cambio o el login.
 */
const EPOCH_EXEMPT_PREFIXES = [
  '/api/login',
  '/api/refresh',
  '/api/session/',
  '/api/restaurant/auth/',
  '/api/public/',
  // Suscripción/plan: es de la empresa, no de la sucursal (SubscriptionStatusProvider vive fuera del Outlet
  // y no se vuelve a pedir al cambiar de sucursal; si se abortara quedaría cargando para siempre).
  '/api/subscription/',
]

/**
 * Escrituras que SI se permiten en modo consulta ("todas las sucursales"): no operan sobre una sucursal.
 * Autenticacion/sesion, suscripcion de la empresa y consultas DNI/RUC (POST que solo lee).
 */
const READ_ONLY_WRITE_ALLOWLIST = [...EPOCH_EXEMPT_PREFIXES, '/api/consulta/']

export function isWriteAllowedInReadOnlyMode(url: string | undefined): boolean {
  if (!url) return false
  const path = url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
  return READ_ONLY_WRITE_ALLOWLIST.some((p) => path === p || path.startsWith(p))
}

export function isEpochExemptUrl(url: string | undefined): boolean {
  if (!url) return false
  const path = url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
  return EPOCH_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p))
}

function isSafeMethod(method: string | undefined): boolean {
  const m = (method ?? 'get').toLowerCase()
  return m === 'get' || m === 'head' || m === 'options'
}

/** Combina la señal propia de la petición con la de la época (cualquiera aborta). */
function combineSignals(a: AbortSignal | undefined | null, b: AbortSignal): AbortSignal {
  if (!a) return b
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any
  if (typeof anyFn === 'function') return anyFn.call(AbortSignal, [a, b])
  const ctrl = new AbortController()
  const abort = () => ctrl.abort()
  if (a.aborted || b.aborted) abort()
  else {
    a.addEventListener('abort', abort, { once: true })
    b.addEventListener('abort', abort, { once: true })
  }
  return ctrl.signal
}

api.interceptors.request.use((config) => {
  // Modo "todas las sucursales" = SOLO CONSULTA. Las lecturas llevan X-Branch-Mode: all (solo GET/HEAD/OPTIONS);
  // cualquier escritura se rechaza aqui, sin salir: sin la cabecera el servidor la ejecutaria en la sucursal activa.
  if (isReadOnlyMode()) {
    if (isSafeMethod(config.method)) {
      if (!isEpochExemptUrl(config.url)) config.headers[BRANCH_MODE_HEADER] = BRANCH_MODE_ALL
    } else if (!isWriteAllowedInReadOnlyMode(config.url)) {
      const response = {
        data: { code: BRANCH_READ_ONLY_CODE, error: READ_ONLY_MESSAGE },
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config,
      }
      return Promise.reject(
        new AxiosError(READ_ONLY_MESSAGE, BRANCH_READ_ONLY_CODE, config, null, response as AxiosResponse),
      )
    }
  }

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
  config._reqToken = token

  // Época de sucursal: toda petición sale marcada con la época vigente. Las de LECTURA además llevan
  // la señal de la época y se abortan al cambiar de sucursal. Las que escriben (POST/PUT/PATCH/DELETE)
  // NO se abortan: el servidor puede estar procesándolas (cobro) y cancelar el cliente solo ocultaría
  // el resultado; su respuesta se entrega igualmente.
  config._epochExempt = isEpochExemptUrl(config.url)
  if (!config._epochExempt) {
    config._branchEpoch = currentEpoch()
    if (isSafeMethod(config.method)) {
      config.signal = combineSignals(config.signal as AbortSignal | undefined, currentEpochSignal())
      config._epochAborts = true
    }
  }

  const slug = getTenantSlug()
  if (slug) config.headers['X-Tenant-Slug'] = slug

  return config
})

export const SESSION_EXPIRED_EVENT = 'tukichef-session-expired'
/** BRANCH_REQUIRED / BRANCH_FORBIDDEN del backend: BranchProvider refresca el contexto de sucursal. */
export const BRANCH_ERROR_EVENT = 'tukichef-branch-error'
/**
 * 402 emitido por `SubscriptionGate` (backend) cuando `can_operate=false` (plan vencido fuera
 * de gracia, suspendido o bloqueado). No es un error de autenticación: no desloguea, solo avisa
 * para que `SubscriptionStatusContext` refresque el hub y la UI bloquee con el motivo real en
 * vez de dejar que cada pantalla falle en silencio con su propio catch genérico.
 */
export const SUBSCRIPTION_BLOCKED_EVENT = 'tukichef-subscription-blocked'

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
  localStorage.removeItem('can_view_all')
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

/** Promesa que nunca se resuelve: descarta en silencio una respuesta de otra época (sin error visible). */
function discardSilently<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * La respuesta/error pertenece a una época anterior (se cambió de sucursal mientras viajaba).
 * Solo aplica a lecturas: la respuesta de una ESCRITURA (cobro, etc.) siempre se entrega.
 */
function isStaleEpoch(
  config: { _branchEpoch?: number; _epochExempt?: boolean; _epochAborts?: boolean } | undefined,
): boolean {
  if (!config || config._epochExempt || !config._epochAborts || config._branchEpoch === undefined) return false
  return config._branchEpoch !== currentEpoch()
}

/** La petición salió con un token que ya no es el vigente (el cambio de sucursal lo reemplazó). */
function isStaleToken(config: { _reqToken?: string | null } | undefined): boolean {
  if (!config || !config._reqToken) return false
  return config._reqToken !== localStorage.getItem('token')
}

api.interceptors.response.use(
  (r) => (isStaleEpoch(r.config) ? discardSilently() : r),
  (err) => {
    const cfg = err?.config as
      | { _branchEpoch?: number; _epochExempt?: boolean; _reqToken?: string | null; _epochAborts?: boolean; signal?: AbortSignal }
      | undefined
    // Cancelación por cambio de sucursal: no es un error ni debe mostrarse como tal.
    if (axios.isCancel(err) && isStaleEpoch(cfg)) {
      return discardSilently()
    }
    // Respuesta (cualquier error HTTP) de una época anterior: se ignora, no desloguea ni avisa.
    if (err.response && isStaleEpoch(cfg)) return discardSilently()

    const code = err.response?.data?.code as string | undefined
    // Modo consulta: el servidor (o el propio cliente) rechazo una escritura. No es un error de acceso.
    if (err.response?.status === 403 && code === BRANCH_READ_ONLY_CODE) {
      window.dispatchEvent(new CustomEvent(BRANCH_READ_ONLY_EVENT))
      return Promise.reject(err)
    }
    if (err.response?.status === 403 || err.response?.status === 400) {
      if (code === 'BRANCH_REQUIRED' || code === 'BRANCH_FORBIDDEN') {
        window.dispatchEvent(new CustomEvent(BRANCH_ERROR_EVENT, { detail: { code } }))
        return Promise.reject(err)
      }
    }
    if (err.response?.status === 403 && code === 'TENANT_ISOLATION_VIOLATION') {
      forceRelogin('tenant_isolation')
      return Promise.reject(err)
    }
    if (err.response?.status === 401 && code === 'TOKEN_TENANT_INVALID') {
      forceRelogin('session_expired')
      return Promise.reject(err)
    }
    if (err.response?.status === 409 && code === 'SESSION_UPDATED') {
      // Provocado por NUESTRO propio cambio de sucursal (token reemplazado mientras viajaba una
      // petición con el token viejo): no es "sesión vencida".
      if (isBranchSwitching() || isStaleToken(cfg)) return Promise.reject(err)
      forceRelogin('session_expired')
      return Promise.reject(err)
    }
    if (err.response?.status === 401) {
      if (isBranchSwitching() || isStaleToken(cfg)) return Promise.reject(err)
      forceRelogin('session_expired')
      return Promise.reject(err)
    }
    if (err.response?.status === 402) {
      const scode = err.response?.data?.code as string | undefined
      if (scode === 'SUBSCRIPTION_REQUIRED' || scode === 'TENANT_BLOCKED') {
        window.dispatchEvent(new CustomEvent(SUBSCRIPTION_BLOCKED_EVENT))
      }
      return Promise.reject(err)
    }
    return Promise.reject(err)
  },
)

export default api
export { API_BASE_URL, getApiBaseUrl, isTauriDesktop }
