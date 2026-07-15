// Feature flags del cliente. Permiten alternar comportamientos durante pruebas
// sin recompilar (localStorage) o por build (VITE_*).

/** Apaga un flag activo por defecto: solo un 'false' explícito cuenta. */
function flagOff(viteKey: string, storageKey: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env
    if (env?.[viteKey] === 'false') return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === 'false') return true
  } catch {
    /* noop */
  }
  return false
}

/**
 * Checkout compuesto del POS (1 request en vez de 4). ACTIVO por defecto: además de ahorrar
 * round-trips, es el único camino que llega al atajo de venta directa del backend, que emite
 * la venta sin crear sesión ni comandas.
 *
 * Desactivar (vuelve al flujo antiguo openSession→addOrder→getSession→billSession):
 *   VITE_POS_FAST_CHECKOUT=false  o  localStorage.setItem('POS_FAST_CHECKOUT','false')
 */
export function posFastCheckoutEnabled(): boolean {
  return !flagOff('VITE_POS_FAST_CHECKOUT', 'POS_FAST_CHECKOUT')
}
