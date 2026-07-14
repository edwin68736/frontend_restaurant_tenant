// Feature flags del cliente. Permiten alternar comportamientos durante pruebas
// sin recompilar (localStorage) o por build (VITE_*).

function flagOn(viteKey: string, storageKey: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env
    if (env?.[viteKey] === 'true') return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === 'true') return true
  } catch {
    /* noop */
  }
  return false
}

/**
 * Checkout compuesto del POS de venta rápida (1 request en vez de 4).
 * Activar:  VITE_POS_FAST_CHECKOUT=true  o  localStorage.setItem('POS_FAST_CHECKOUT','true')
 * Por defecto DESACTIVADO → el POS usa el flujo antiguo (openSession→addOrder→getSession→billSession).
 */
export function posFastCheckoutEnabled(): boolean {
  return flagOn('VITE_POS_FAST_CHECKOUT', 'POS_FAST_CHECKOUT')
}
