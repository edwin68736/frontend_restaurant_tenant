import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeatures } from '@/contexts/FeatureContext'
import { recipesService, type Availability } from '@/services/recipes.service'

/**
 * Qué platos descuentan insumos en la sucursal y para cuántas porciones alcanzan. Sin el módulo activado no consulta nada, y si la
 * consulta falla devuelve null: las pantallas quedan como siempre (el servidor igual valida al pedir y al cobrar).
 */
export function useRecipeStock(branchId?: number) {
  const { hasFeature } = useFeatures()
  const enabled = hasFeature('restaurant_recipes')
  const scope = enabled ? `sucursal-${branchId ?? 0}` : ''
  const [loaded, setLoaded] = useState<{ scope: string; data: Availability } | null>(null)
  const request = useRef(0)

  const refresh = useCallback(() => {
    const n = ++request.current
    if (!scope) return
    recipesService
      .availability(branchId)
      .then((data) => {
        if (n === request.current) setLoaded({ scope, data })
      })
      .catch(() => {
        if (n === request.current) setLoaded(null)
      })
  }, [scope, branchId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Lo de otra sucursal no vale mientras llega lo nuevo.
  return { availability: scope && loaded?.scope === scope ? loaded.data : null, refresh }
}
