import api from './api'
import type { LoginResponse } from './auth.service'

export type RestaurantAuthConfig = {
  tenant_name: string
  tenant_slug: string
  pin_login_enabled: boolean
}

export type PinLoginPayload = {
  pin: string
  station: 'waiter' | 'cashier' | 'kitchen' | 'delivery' | 'admin'
}

export const restaurantAuthService = {
  getConfig: () =>
    api.get<RestaurantAuthConfig>('/api/restaurant/auth/config').then((r) => r.data),

  pinLogin: (body: PinLoginPayload) =>
    api.post<LoginResponse & { restaurant_permissions?: string[] }>(
      '/api/restaurant/auth/pin',
      body,
    ).then((r) => r.data),

  getSessionPermissions: () =>
    api.get<{ permissions: string[]; employee_type: string; staff_id?: number; auth_method?: string }>(
      '/api/restaurant/session/permissions',
    ).then((r) => r.data),
}
