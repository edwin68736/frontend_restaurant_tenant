/**
 * Assets en /public (Tukichef).
 * Color corporativo en UI: clases `rest-*` (= escala Tailwind `green`; principal `rest-600` / `green-600`).
 */
export const BRAND_LOGO = '/logo-tukichef.png'
export const BRAND_LOGO_H = '/tuki_h.png'
/** Barra decorativa superior del layout autenticado (public/top_van.png). */
export const BRAND_TOP_BAR = '/top_van.png'
export const BRAND_BG = '/fondo.png'
export const BRAND_WAITER = '/mozo2.png'
export const BRAND_CASHIER = '/cajero.png'
export const BRAND_KITCHEN = '/cocinero.png'
export const BRAND_DELIVERY = '/delivery.png'

/** Personaje del panel PIN según estación (null = sin ilustración). */
export function pinStationCharacter(station: string): string | null {
  const key = station.toLowerCase()
  const map: Record<string, string> = {
    waiter: BRAND_WAITER,
    mozo: BRAND_WAITER,
    cashier: BRAND_CASHIER,
    cajero: BRAND_CASHIER,
    kitchen: BRAND_KITCHEN,
    cocina: BRAND_KITCHEN,
    delivery: BRAND_DELIVERY,
  }
  return map[key] ?? null
}
