import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatures } from '@/contexts/FeatureContext'
import type { RestaurantFeature } from '@/utils/restaurantPermissions'

/**
 * Acceso a una pantalla del menú: permiso del usuario Y, en las que dependen de un módulo que el negocio debe tener activado
 * (insumos), la capacidad que anuncia el servidor. Usar esto, no `canAccess`, para armar menús y proteger rutas.
 */
export function useNavAccess() {
  const { canAccess, hasModule } = useAuth()
  const { hasFeature } = useFeatures()
  return useCallback(
    (feature: RestaurantFeature) => {
      if (!canAccess(feature)) return false
      if (feature === 'insumos') return hasFeature('restaurant_recipes')
      // Las compras además exigen que el negocio tenga el módulo de compras.
      if (feature === 'compras_insumos') return hasFeature('restaurant_recipes') && hasModule('purchases')
      return true
    },
    [canAccess, hasFeature, hasModule],
  )
}
