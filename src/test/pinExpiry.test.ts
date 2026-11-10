import { describe, expect, it } from 'vitest'
import { msUntilPinExpiryWarning, PIN_EXPIRY_WARNING_MS } from '@/lib/session/pinExpiry'

function jwt(payload: object): string {
  return `h.${btoa(JSON.stringify(payload)).replace(/=/g, '')}.s`
}

describe('aviso de fin de turno (PIN)', () => {
  const now = 1_000_000_000_000
  it('PIN: avisa 5 min antes del exp', () => {
    const exp = Math.floor(now / 1000) + 3600
    expect(msUntilPinExpiryWarning(jwt({ auth_method: 'pin', exp }), now)).toBe(3600_000 - PIN_EXPIRY_WARNING_MS)
  })
  it('PIN ya dentro de la ventana: avisa ya', () => {
    const exp = Math.floor(now / 1000) + 120
    expect(msUntilPinExpiryWarning(jwt({ auth_method: 'pin', exp }), now)).toBe(0)
  })
  it('no aplica a pwd, sin exp, vencido o sin token', () => {
    const exp = Math.floor(now / 1000) + 3600
    expect(msUntilPinExpiryWarning(jwt({ auth_method: 'pwd', exp }), now)).toBeNull()
    expect(msUntilPinExpiryWarning(jwt({ auth_method: 'pin' }), now)).toBeNull()
    expect(msUntilPinExpiryWarning(jwt({ auth_method: 'pin', exp: Math.floor(now / 1000) - 5 }), now)).toBeNull()
    expect(msUntilPinExpiryWarning(null, now)).toBeNull()
  })
})
