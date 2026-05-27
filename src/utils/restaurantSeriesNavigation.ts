import type { NavigateFunction } from 'react-router-dom'

/** Estado de navegación para abrir Ajustes → pestaña Series. */
export const RESTAURANT_SERIES_SETTINGS_NAV = {
  restaurantSettingsTab: 'series' as const,
}

export function goToRestaurantSeriesSettings(navigate: NavigateFunction): void {
  navigate('/ajustes', { state: RESTAURANT_SERIES_SETTINGS_NAV })
}
