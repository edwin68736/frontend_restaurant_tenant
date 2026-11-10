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
    /** true = ya se reintentó UNA vez tras renovar el token por un 409 SESSION_UPDATED (corta cualquier bucle). */
    _sessionRetried?: boolean
    /** true = ya se reenvió UNA vez con el token que otra petición acababa de renovar (interno). */
    _staleResent?: boolean
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

type ReloginReason = 'session_expired' | 'tenant_isolation' | 'access_changed'

let reloginHandled = false

export function resetReloginGuard() {
  reloginHandled = false
}

function getReloginMessage(reason: ReloginReason): string {
  if (reason === 'access_changed') {
    return 'Su acceso cambió; vuelva a ingresar.'
  }
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

/** Cierra la sesión local (mismo camino que el interceptor). Lo usa el stream SSE cuando no hay cómo recuperarse. */
export function expireSession(reason: ReloginReason = 'session_expired') {
  forceRelogin(reason)
}

function forceRelogin(reason: ReloginReason) {
  if (reloginHandled) return
  reloginHandled = true

  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
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

// --- Renovación del access token (refresh token) ---------------------------------------------------
// Solo el login de correo/contraseña recibe refresh_token; el POS por PIN NO tiene (su sesión es de turno
// y al vencer o ser revocada se vuelve a ingresar). El backend (POST /api/session/refresh) reconstruye rol,
// permisos y módulos desde la BD y respeta la sucursal activa si el usuario aún puede acceder a ella.

/** Emitido tras renovar el access token: AuthContext actualiza token/módulos y BranchContext el contexto. */
export const SESSION_REFRESHED_EVENT = 'tukichef-session-refreshed'

const REFRESH_URL = '/api/session/refresh'

export type RefreshOutcome =
  | { status: 'ok'; token: string }
  /** No hay refresh token (sesión PIN) o el servidor lo rechazó: no hay forma de recuperar la sesión. */
  | { status: 'unavailable-session' }
  /** Fallo transitorio (red, 5xx): la sesión puede seguir siendo válida; no se debe cerrar. */
  | { status: 'transient' }

/** true si hay refresh token (login de correo/contraseña). El PIN nunca lo tiene. */
export function hasRefreshToken(): boolean {
  return !!localStorage.getItem('refresh_token')
}

function isRefreshUrl(url: string | undefined): boolean {
  return !!url && url.split('?')[0].endsWith(REFRESH_URL)
}

function storedActiveBranchId(): number | undefined {
  try {
    const id = Number(JSON.parse(localStorage.getItem('active_branch') || 'null')?.id)
    return id > 0 ? id : undefined
  } catch {
    return undefined
  }
}

/** Sucursal activa (claim active_branch_id) de un JWT; 0 si no se puede leer. */
function jwtBranchId(token: string | null | undefined): number {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return 0
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { active_branch_id?: number }
    return Number(json.active_branch_id) || 0
  } catch {
    return 0
  }
}

/** Último token emitido por un refresh nuestro (distingue "otra petición ya renovó" de "cambio de sucursal"). */
let lastRefreshedToken: string | null = null
/** Un único refresh en vuelo: un burst de 409 comparte la misma renovación. */
let refreshInFlight: Promise<RefreshOutcome> | null = null

export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return Promise.resolve({ status: 'unavailable-session' })
  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    try {
      const resp = await api.post<{ token?: string; modules?: string[]; permissions?: string[] }>(REFRESH_URL, {
        refresh_token: refreshToken,
        active_branch_id: storedActiveBranchId(),
      })
      const token = resp?.data?.token
      if (!token) return { status: 'transient' }
      lastRefreshedToken = token
      localStorage.setItem('token', token)
      window.dispatchEvent(
        new CustomEvent(SESSION_REFRESHED_EVENT, {
          detail: { token, modules: resp.data.modules, permissions: resp.data.permissions },
        }),
      )
      return { status: 'ok', token }
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status
      // 4xx del refresh (salvo 408/429): el refresh token ya no sirve. Red caída, 5xx, 429: transitorio.
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return { status: 'unavailable-session' }
      }
      return { status: 'transient' }
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/** Solo para tests. */
export function __resetRefreshStateForTests(): void {
  lastRefreshedToken = null
  refreshInFlight = null
}

/**
 * Cabeceras de una petición autenticada hecha FUERA de axios (stream SSE con fetch). Replica las del
 * interceptor: token, tenant, modo consulta y, en desarrollo, el origen que enruta el proxy de Vite.
 */
export function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const slug = getTenantSlug()
  if (slug) headers['X-Tenant-Slug'] = slug
  if (isDevelopmentMode()) {
    const origin = getResolvedTenantApiUrl()
    if (origin) headers['X-Tenant-Api-Origin'] = normalizeApiOrigin(origin)
  }
  if (isReadOnlyMode()) headers[BRANCH_MODE_HEADER] = BRANCH_MODE_ALL
  return headers
}

/**
 * Recuperación ante 409 SESSION_UPDATED (el backend subió la versión de sesión: cambió rol, permisos o
 * asignación de sucursales). Devuelve el token a usar para reintentar, o null si se debe abandonar:
 *  - sin refresh token (PIN) o refresh rechazado -> cierra sesión con "Su acceso cambió; vuelva a ingresar";
 *  - fallo transitorio del refresh -> no cierra sesión (null; el llamador rechaza el error original).
 */
export async function recoverFromSessionUpdated(): Promise<string | null> {
  if (!hasRefreshToken()) {
    forceRelogin('access_changed')
    return null
  }
  const out = await refreshAccessToken()
  if (out.status === 'ok') return out.token
  if (out.status === 'unavailable-session') forceRelogin('access_changed')
  return null
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

/**
 * 409 SESSION_UPDATED ajeno a un cambio de sucursal propio: el acceso del usuario cambió en el servidor.
 * Se intenta UNA renovación del token y UN reintento de la petición original; sin refresh token (PIN) o
 * si el refresh falla se cierra sesión con un mensaje claro. Sin bucles: cada petición se reintenta una
 * sola vez (`_sessionRetried`) y el propio refresh nunca entra aquí.
 *
 * Seguridad frente a duplicados: el 409 lo emite el middleware de sucursal ANTES de que corra el handler,
 * así que la petición rechazada no se ejecutó y reenviarla no duplica nada; además el reintento conserva
 * cuerpo y cabeceras (incluida la clave de idempotencia del cobro) para que el servidor la reconozca si
 * algún día no fuera así. Una ESCRITURA no se reenvía si la sucursal del token nuevo difiere de la del
 * token con el que salió: se escribiría en una sucursal distinta de la que el usuario veía.
 */
async function retryAfterSessionUpdated(err: AxiosError): Promise<never | AxiosResponse> {
  const original = err.config
  if (!original || isRefreshUrl(original.url)) return Promise.reject(err)
  const sentToken = original._reqToken ?? null
  const current = localStorage.getItem('token')

  let newToken: string | null = null
  if (original._sessionRetried) {
    // Segundo 409 tras renovar: el acceso fue revocado de verdad. Fin (sin más reintentos).
    forceRelogin('access_changed')
    return Promise.reject(err)
  }
  if (sentToken && current && sentToken !== current) {
    // Otra petición del mismo burst ya renovó el token: se reenvía UNA vez con el vigente. Si el reemplazo
    // lo hizo un cambio de sucursal (no un refresh) se descarta como siempre (comportamiento de la Fase 4).
    if (current !== lastRefreshedToken || original._staleResent) return Promise.reject(err)
    original._staleResent = true
    newToken = current
  } else {
    newToken = await recoverFromSessionUpdated()
    if (!newToken) return Promise.reject(err) // sesión cerrada, o fallo transitorio sin cerrar
    original._sessionRetried = true
  }

  if (!isSafeMethod(original.method) && jwtBranchId(sentToken) !== jwtBranchId(newToken)) {
    window.dispatchEvent(new CustomEvent(BRANCH_ERROR_EVENT, { detail: { code: 'BRANCH_FORBIDDEN' } }))
    return Promise.reject(err)
  }
  return api(original)
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

    // El propio refresh: su fallo lo interpreta refreshAccessToken (no debe cerrar sesión ni reentrar aquí).
    if (isRefreshUrl(err?.config?.url)) return Promise.reject(err)

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
      if (isBranchSwitching()) return Promise.reject(err)
      return retryAfterSessionUpdated(err)
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
