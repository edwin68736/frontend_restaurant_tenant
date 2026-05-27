import type { KitchenComanda } from '@/services/restaurant.service'

/** Datos de cocina compartidos entre vistas de Comandas (evita refetch al cambiar modo). */
export type ComandasKitchenProps = {
  comandas: KitchenComanda[]
  loading: boolean
  onReload: () => void
}
