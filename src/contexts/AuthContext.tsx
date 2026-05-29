import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authService, type AuthUser, type LoginPayload, type LoginResponse } from '@/services/auth.service'
import { useTenantBinding } from '@/contexts/TenantBindingContext'
import { restaurantAuthService } from '@/services/restaurantAuth.service'
import { featureAllowed, type RestaurantFeature } from '@/utils/restaurantPermissions'
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
}

type SessionPayload = LoginResponse & {
  restaurant_permissions?: string[]
}

type AuthContextType = AuthState & {
  login: (p: LoginPayload) => Promise<LoginResponse>
  applySession: (data: SessionPayload) => void
  logout: () => void
  canAccess: (feature: RestaurantFeature) => boolean
  hasPerm: (perm: string) => boolean
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
  })

  const applySession = useCallback((data: SessionPayload) => {
    const user = data.user
    const perms = data.restaurant_permissions ?? []
    const { employeeType, staffId } = readUserMeta(user)

    localStorage.setItem('token', data.token)
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
    })
    window.dispatchEvent(new CustomEvent('tukichef-session-applied'))
  }, [])

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
        if (r.permissions?.length) {
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
    (feature: RestaurantFeature) => featureAllowed(state.restaurantPermissions, feature),
    [state.restaurantPermissions],
  )

  const hasPerm = useCallback(
    (perm: string) => state.restaurantPermissions.includes(perm),
    [state.restaurantPermissions],
  )

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
    localStorage.removeItem(PERMS_KEY)
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      employeeType: '',
      staffId: null,
      restaurantPermissions: [],
    })
    toast.info('Sesión cerrada')
    window.location.hash = '#/home'
  }

  return (
    <AuthContext.Provider value={{ ...state, login, applySession, logout, canAccess, hasPerm }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
