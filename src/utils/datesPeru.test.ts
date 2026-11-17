import { describe, expect, it } from 'vitest'
import { clampIssueDatePeru, getMinIssueDatePeru, getTodayPeru } from './datesPeru'

describe('clampIssueDatePeru', () => {
  it('conserva una fecha válida dentro de la ventana (no la reemplaza por hoy)', () => {
    const min = getMinIssueDatePeru()
    expect(clampIssueDatePeru(min)).toBe(min)
    expect(min).not.toBe(getTodayPeru())
  })
  it('ajusta fechas fuera de la ventana y valores inválidos', () => {
    expect(clampIssueDatePeru('2000-01-01')).toBe(getMinIssueDatePeru())
    expect(clampIssueDatePeru('2999-01-01')).toBe(getTodayPeru())
    expect(clampIssueDatePeru('')).toBe(getTodayPeru())
    expect(clampIssueDatePeru('basura')).toBe(getTodayPeru())
  })
})
