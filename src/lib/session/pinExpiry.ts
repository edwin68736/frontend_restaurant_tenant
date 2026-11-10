import { decodeJWT } from '@/services/auth.service'

/** Antelación del aviso de fin de turno del POS por PIN. */
export const PIN_EXPIRY_WARNING_MS = 5 * 60 * 1000

/**
 * Milisegundos hasta el momento en que hay que avisar que el token de PIN está por vencer
 * (exp - 5 min); 0 si ya está dentro de esa ventana; null si no aplica (no es PIN, sin exp, ya vencido).
 * El backend fija un `exp` absoluto en el PIN: el turno no se alarga al cambiar de sucursal.
 */
export function msUntilPinExpiryWarning(token: string | null, now = Date.now()): number | null {
  if (!token) return null
  const jwt = decodeJWT<{ exp?: number; auth_method?: string }>(token)
  if (!jwt || jwt.auth_method !== 'pin' || typeof jwt.exp !== 'number') return null
  const msLeft = jwt.exp * 1000 - now
  if (msLeft <= 0) return null
  return Math.max(0, msLeft - PIN_EXPIRY_WARNING_MS)
}
