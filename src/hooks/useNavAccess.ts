import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatures } from '@/contexts/FeatureContext'
import type { RestaurantFeature } from '@/utils/restaurantPermissions'

/**
 * Acceso a una pantalla del menú: permiso del usuario Y, en las que dependen de un módulo que el negocio debe tener activado
 * (insumos), la capacidad que anuncia el servidor. Usar esto, no `canAccess`, para armar menús y proteger rutas.
 */
export function useNavAccess() {
  const { canAccess } = useAuth()
  const { hasFeature } = useFeatures()
  return useCallback(
    (feature: RestaurantFeature) => canAccess(feature) && (feature !== 'insumos' || hasFeature('restaurant_recipes')),
    [canAccess, hasFeature],
  )
}
