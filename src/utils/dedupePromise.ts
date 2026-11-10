/** Promesas en vuelo por clave: evita GET duplicados concurrentes (p. ej. StrictMode en dev). */
import { registerCache } from '@/lib/cacheRegistry'

const inflight = new Map<string, Promise<unknown>>()

// Al cambiar de sucursal el interceptor de axios descarta en silencio (promesa que no se resuelve) las
// lecturas de la época anterior. Si su entrada siguiera aquí, una petición idéntica posterior (p. ej. al
// volver a la sucursal anterior) recibiría esa promesa colgada. Por eso se vacía al cambiar de época.
registerCache('dedupePromise', 'branch', () => inflight.clear())

export function dedupePromise<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>

  const promise = factory().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
}
