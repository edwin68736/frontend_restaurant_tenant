/**
 * Registro único de cachés de módulo (Fase 4 aislamiento por sucursal).
 *
 * - `resetBranchCaches()` se llama al cambiar de sucursal: borra todo lo que depende de la sucursal
 *   (resultados de búsqueda, claves de idempotencia del cobro...).
 * - `clearAllCaches()` se llama al cerrar sesión / vencer la sesión: borra además lo que es por empresa
 *   (logo cacheado, etc.) para que nada sobreviva entre usuarios o empresas.
 *
 * Cada caché se registra a sí misma al importarse con `registerCache`.
 */
export type CacheScope = 'branch' | 'session'

type Entry = { scope: CacheScope; clear: () => void }

const entries = new Map<string, Entry>()

/** `branch`: se limpia al cambiar de sucursal Y al cerrar sesión. `session`: solo al cerrar sesión. */
export function registerCache(name: string, scope: CacheScope, clear: () => void): void {
  entries.set(name, { scope, clear })
}

function run(filter: (e: Entry) => boolean): void {
  for (const [name, e] of entries) {
    if (!filter(e)) continue
    try {
      e.clear()
    } catch (err) {
      console.warn(`[cacheRegistry] no se pudo limpiar "${name}"`, err)
    }
  }
}

export function resetBranchCaches(): void {
  run((e) => e.scope === 'branch')
}

export function clearAllCaches(): void {
  run(() => true)
}

/** Solo para tests. */
export function __registeredCacheNames(): string[] {
  return [...entries.keys()]
}
