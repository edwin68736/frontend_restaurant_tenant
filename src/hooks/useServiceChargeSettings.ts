import { useCallback, useEffect, useState } from 'react'
import { restaurantService } from '@/services/restaurant.service'
import { dedupePromise } from '@/utils/dedupePromise'
import { registerCache } from '@/lib/cacheRegistry'
import { isValidServiceChargeRate } from '@/utils/serviceCharge'

export interface ServiceChargeSettings {
  /** Recargo al consumo activo con un % válido. */
  enabled: boolean
  /** % sobre el valor de venta sin IGV (0 si no está activo). */
  rate: number
}

const TTL_MS = 60_000
const OFF: ServiceChargeSettings = { enabled: false, rate: 0 }

let cached: { value: ServiceChargeSettings; at: number } | null = null

registerCache('serviceChargeSettings', 'session', () => {
  cached = null
})

function fromPayload(p: { service_charge_enabled?: boolean; service_charge_rate?: number }): ServiceChargeSettings {
  const rate = Number(p.service_charge_rate) || 0
  const enabled = p.service_charge_enabled === true && isValidServiceChargeRate(rate)
  return enabled ? { enabled: true, rate } : OFF
}

async function load(force: boolean): Promise<ServiceChargeSettings> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value
  const value = await dedupePromise('service-charge-settings', async () =>
    fromPayload(await restaurantService.getSettings()),
  )
  cached = { value, at: Date.now() }
  return value
}

/** Invalida la caché (p. ej. tras guardar el recargo en ajustes). */
export function invalidateServiceChargeSettings(): void {
  cached = null
}

/**
 * Configuración del recargo al consumo del tenant, leída de GET /api/restaurant/settings
 * (accesible con PIN de mozo/cajero). Caché corta de 60 s compartida por POS y Mesa.
 * Si la lectura falla, el recargo queda desactivado (el servidor igual lo valida).
 */
export function useServiceChargeSettings(): ServiceChargeSettings & { refresh: () => void } {
  const [state, setState] = useState<ServiceChargeSettings>(() => cached?.value ?? OFF)

  const refresh = useCallback(() => {
    void load(true)
      .then(setState)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    load(false)
      .then((v) => {
        if (alive) setState(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return { ...state, refresh }
}
