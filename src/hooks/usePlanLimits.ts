import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/services/api'

export type PlanLimit = { used: number; max: number; unlimited: boolean }

export type PlanLimits = {
  users: PlanLimit
  branches: PlanLimit
  products: PlanLimit
  documents: PlanLimit
}

const emptyLimit: PlanLimit = { used: 0, max: 0, unlimited: true }

export const EMPTY_PLAN_LIMITS: PlanLimits = {
  users: emptyLimit,
  branches: emptyLimit,
  products: emptyLimit,
  documents: emptyLimit,
}

/**
 * Cuotas del plan del tenant (usuarios, sucursales, productos, documentos).
 *
 * El ERP las expone vía ModulesContext, que tukichef no monta: aquí solo hacen falta los
 * límites para avisar cuando se acercan al tope, no el catálogo de módulos. Si la consulta
 * falla se devuelven cuotas «ilimitadas» para no inventar avisos que no corresponden.
 */
export function usePlanLimits(): PlanLimits {
  return usePlanLimitsState().limits
}

/** Igual que usePlanLimits, pero además devuelve `refresh` para volver a leer los conteos (p. ej. tras importar o dar de alta). */
export function usePlanLimitsState(): { limits: PlanLimits; refresh: () => Promise<void> } {
  const [limits, setLimits] = useState<PlanLimits>(EMPTY_PLAN_LIMITS)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ limits?: Partial<PlanLimits> }>('/api/session/modules')
      if (alive.current) setLimits({ ...EMPTY_PLAN_LIMITS, ...(data.limits ?? {}) })
    } catch {
      if (alive.current) setLimits(EMPTY_PLAN_LIMITS)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void refresh()
    return () => {
      alive.current = false
    }
  }, [refresh])

  return { limits, refresh }
}
