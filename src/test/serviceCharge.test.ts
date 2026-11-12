import { describe, expect, it } from 'vitest'
import { MAX_SERVICE_CHARGE_RATE, isValidServiceChargeRate, serviceChargeAmount } from '@/utils/serviceCharge'

describe('serviceChargeAmount', () => {
  it('calcula % sobre la base con 2 decimales', () => {
    expect(serviceChargeAmount(100, 10)).toBe(10)
    expect(serviceChargeAmount(84.75, 10)).toBe(8.48) // 8.475 → 8.48
    expect(serviceChargeAmount(33.33, 13)).toBe(4.33)
  })
  it('devuelve 0 con base <= 0 o % fuera de (0, 13]', () => {
    expect(serviceChargeAmount(0, 10)).toBe(0)
    expect(serviceChargeAmount(-5, 10)).toBe(0)
    expect(serviceChargeAmount(100, 0)).toBe(0)
    expect(serviceChargeAmount(100, 13.01)).toBe(0)
    expect(serviceChargeAmount(100, Number.NaN)).toBe(0)
  })
  it('acepta exactamente el tope', () => {
    expect(MAX_SERVICE_CHARGE_RATE).toBe(13)
    expect(serviceChargeAmount(100, 13)).toBe(13)
    expect(isValidServiceChargeRate(13)).toBe(true)
    expect(isValidServiceChargeRate(0.01)).toBe(true)
    expect(isValidServiceChargeRate(0)).toBe(false)
  })
})
