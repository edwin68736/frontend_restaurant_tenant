import api from './api'

export interface LoginPayload {
  email: string
  password: string
  slug?: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
  employee_type?: string
  staff_id?: number
}

export type BranchBrief = { id: number; name: string; is_main?: boolean }

export interface LoginResponse {
  token: string
  user: AuthUser
  modules?: string[]
  permissions?: string[]
  restaurant_permissions?: string[]
  active_branch?: BranchBrief | null
  can_switch_branch?: boolean
}

export function decodeJWT<T = Record<string, unknown>>(token: string): T | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}

export const authService = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>('/api/login', payload)
    return data
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // No borrar tenantSlug/tenantName/tokenConsultaDatos: el RUC solo se ingresa la primera vez
  },
}
