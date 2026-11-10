import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { authService, decodeJWT, type AuthUser, type LoginPayload, type LoginResponse } from '@/services/auth.service'
import { useTenantBinding } from '@/contexts/TenantBindingContext'
import { resetReloginGuard, SESSION_EXPIRED_EVENT, SESSION_REFRESHED_EVENT } from '@/services/api'
import { msUntilPinExpiryWarning } from '@/lib/session/pinExpiry'
import { restaurantAuthService } from '@/services/restaurantAuth.service'
import { canAccessFeature, type RestaurantFeature } from '@/utils/restaurantPermissions'
import { canManageGlobalCatalog as computeCanManageGlobalCatalog } from '@/utils/catalogPermissions'
import { toast } from 'sonner'

const PERMS_KEY = 'restaurant_permissions'

type AuthState = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  employeeType: string
  staffId: number | null
  restaurantPermissions: string[]
  /** Módulos del plan del tenant (del JWT). Gobierna el acceso a tukichef (módulo 'restaurant'). */
  modules: string[]
}

/** Extrae los módulos del plan desde el JWT del tenant. */
function modulesFromToken(token: string | null): string[] {
  if (!token) return []
  return decodeJWT<{ modules?: string[] }>(token)?.modules ?? []
}

type SessionPayload = LoginResponse & {
  restaurant_permissions?: string[]
}

type AuthContextType = AuthState & {
  login: (p: LoginPayload) => Promise<LoginResponse>
  applySession: (data: SessionPayload) => void
  /**
   * Cambio de token dentro de la misma sesión (cambio de sucursal): actualiza localStorage, el token
   * y los módulos en el estado y, si vienen, refresh_token y permisos. Los permisos finos se vuelven
   * a pedir al backend (efecto sobre state.token).
   */
  applyTokenUpdate: (u: { token: string; refresh_token?: string; restaurant_permissions?: string[] }) => void
  logout: () => void
  canAccess: (feature: RestaurantFeature) => boolean
  hasPerm: (perm: string) => boolean
  hasModule: (key: string) => boolean
  /** Puede crear/editar/eliminar el catálogo global (products.manage_global o products.manage). */
  canManageGlobalCatalog: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function readUserMeta(user: AuthUser | null): { employeeType: string; staffId: number | null } {
  const u = user as AuthUser & { employee_type?: string; staff_id?: number }
  return {
    employeeType: u?.employee_type ?? '',
    staffId: u?.staff_id ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { stored: tenantBinding } = useTenantBinding()
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    employeeType: '',
    staffId: null,
    restaurantPermissions: [],
    modules: [],
  })

  const applySession = useCallback((data: SessionPayload) => {
    resetReloginGuard()
    const user = data.user
    const perms = data.restaurant_permissions ?? []
    const { employeeType, staffId } = readUserMeta(user)

    localStorage.setItem('token', data.token)
    // Solo el login de correo/contraseña trae refresh token; el PIN no (y no hereda el de una sesión anterior).
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
    else localStorage.removeItem('refresh_token')
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem(PERMS_KEY, JSON.stringify(perms))
    if (data.active_branch) {
      localStorage.setItem('active_branch', JSON.stringify(data.active_branch))
    }
    localStorage.setItem('can_switch_branch', data.can_switch_branch ? 'true' : 'false')
    if (data.allowed_branches?.length) {
      localStorage.setItem('allowed_branches', JSON.stringify(data.allowed_branches))
    } else {
      localStorage.removeItem('allowed_branches')
    }

    setState({
      user,
      token: data.token,
      isAuthenticated: true,
      isLoading: false,
      employeeType,
      staffId,
      restaurantPermissions: perms,
      modules: modulesFromToken(data.token),
    })
    window.dispatchEvent(new CustomEvent('tukichef-session-applied'))
  }, [])

  const applyTokenUpdate = useCallback(
    (u: { token: string; refresh_token?: string; restaurant_permissions?: string[] }) => {
      localStorage.setItem('token', u.token)
      if (u.refresh_token) localStorage.setItem('refresh_token', u.refresh_token)
      const perms = u.restaurant_permissions
      if (Array.isArray(perms)) localStorage.setItem(PERMS_KEY, JSON.stringify(perms))
      setState((s) => ({
        ...s,
        token: u.token,
        modules: modulesFromToken(u.token),
        restaurantPermissions: Array.isArray(perms) ? perms : s.restaurantPermissions,
      }))
    },
    [],
  )

  useEffect(() => {
    const onSessionExpired = () => {
      authService.logout()
      localStorage.removeItem(PERMS_KEY)
      localStorage.removeItem('active_branch')
      localStorage.removeItem('allowed_branches')
      localStorage.removeItem('can_switch_branch')
      localStorage.removeItem('can_view_all')
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        employeeType: '',
        staffId: null,
        restaurantPermissions: [],
        modules: [],
      })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [])

  // Token renovado por el interceptor/SSE (409 SESSION_UPDATED): se sincroniza el estado. Los permisos finos
  // se vuelven a pedir solos (efecto sobre state.token).
  useEffect(() => {
    const onRefreshed = (e: Event) => {
      const token = (e as CustomEvent<{ token?: string }>).detail?.token
      if (!token) return
      setState((s) => (s.isAuthenticated ? { ...s, token, modules: modulesFromToken(token) } : s))
    }
    window.addEventListener(SESSION_REFRESHED_EVENT, onRefreshed)
    return () => window.removeEventListener(SESSION_REFRESHED_EVENT, onRefreshed)
  }, [])

  // Aviso de fin de turno del POS por PIN (5 min antes del exp del JWT).
  useEffect(() => {
    const wait = msUntilPinExpiryWarning(state.token)
    if (wait === null) return
    const t = window.setTimeout(() => {
      toast.warning('Su turno vence en unos 5 minutos. Termine lo pendiente; deberá volver a ingresar con su PIN.', {
        id: 'pin-expiry-warning',
        duration: 20000,
      })
    }, wait)
    return () => window.clearTimeout(t)
  }, [state.token])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser
        let perms: string[] = []
        try {
          perms = JSON.parse(localStorage.getItem(PERMS_KEY) || '[]') as string[]
        } catch {
          perms = []
        }
        const { employeeType, staffId } = readUserMeta(user)
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          employeeType,
          staffId,
          restaurantPermissions: perms,
          modules: modulesFromToken(token),
        })
      } catch {
        authService.logout()
        localStorage.removeItem(PERMS_KEY)
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          employeeType: '',
          staffId: null,
          restaurantPermissions: [],
          modules: [],
        })
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  useEffect(() => {
    if (!state.isAuthenticated || !state.token) return
    restaurantAuthService
      .getSessionPermissions()
      .then((r) => {
        if (Array.isArray(r.permissions)) {
          localStorage.setItem(PERMS_KEY, JSON.stringify(r.permissions))
          setState((s) => ({
            ...s,
            restaurantPermissions: r.permissions,
            employeeType: r.employee_type || s.employeeType,
            staffId: r.staff_id ?? s.staffId,
          }))
        }
      })
      .catch(() => {})
  }, [state.isAuthenticated, state.token])

  const canAccess = useCallback(
    (feature: RestaurantFeature) =>
      canAccessFeature(state.restaurantPermissions, feature, state.employeeType),
    [state.restaurantPermissions, state.employeeType],
  )

  const hasModule = useCallback(
    (key: string) => state.modules.includes(key),
    [state.modules],
  )

  const hasPerm = useCallback(
    (perm: string) => state.restaurantPermissions.includes(perm),
    [state.restaurantPermissions],
  )

  const canManageGlobalCatalog = useMemo(() => {
    const jwt = state.token ? decodeJWT<{ permissions?: string[]; auth_method?: string }>(state.token) : null
    return computeCanManageGlobalCatalog(jwt?.permissions, jwt?.auth_method)
  }, [state.token])

  const login = async (payload: LoginPayload) => {
    const slug = payload.slug?.trim() || tenantBinding?.slug
    if (!slug) {
      toast.error('Primero vincule la empresa con su RUC')
      throw new Error('tenant_slug_missing')
    }
    const data = (await authService.login({ ...payload, slug })) as SessionPayload
    applySession(data)
    toast.success(`Bienvenido, ${data.user.name}`)
    return data
  }

  const logout = () => {
    authService.logout()
    localStorage.removeItem('active_branch')
    localStorage.removeItem('allowed_branches')
    localStorage.removeItem('can_switch_branch')
    localStorage.removeItem('can_view_all')
    localStorage.removeItem(PERMS_KEY)
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      employeeType: '',
      staffId: null,
      restaurantPermissions: [],
      modules: [],
    })
    toast.info('Sesión cerrada')
    window.location.hash = '#/home'
  }

  return (
    <AuthContext.Provider value={{ ...state, login, applySession, applyTokenUpdate, logout, canAccess, hasPerm, hasModule, canManageGlobalCatalog }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
