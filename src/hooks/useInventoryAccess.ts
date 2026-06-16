import { decodeJWT } from '@/services/auth.service'

/** Módulo inventory en JWT (alineado con RequireModule("inventory") del backend). */
export function useInventoryAccess(): boolean {
  const token = localStorage.getItem('token')
  if (!token) return false
  const payload = decodeJWT<{ modules?: string[] }>(token)
  return (payload?.modules ?? []).includes('inventory')
}
