import { useEffect, useRef } from 'react'
import { registerBranchSwitchGuard } from '@/lib/branch/switchGuards'
import { registerCache } from '@/lib/cacheRegistry'

/**
 * Sucursal en la que se vio por primera vez cada sesión de mesa (sessionId -> branchId).
 * No se limpia al cambiar de sucursal (justamente sirve para reconocer sesiones AJENAS tras el
 * cambio); sí al cerrar sesión.
 */
const owners = new Map<number, number>()
registerCache('tableSessionOwners', 'session', () => owners.clear())

/** Solo para tests. */
export function __tableSessionOwnersForTests() {
  return owners
}

type Options = {
  sessionId: number
  activeBranchId: number
  /** Hay mesa/cuenta abierta o carrito con productos: cambiar de sucursal exige confirmar. */
  pendingMessage: string | null
  /** Descartar sesión y carrito (se ejecuta tras confirmar y cambiar con éxito). */
  onDiscard: () => void
}

/**
 * MesaPage nunca debe operar un sessionId de OTRA sucursal:
 *  - `foreign` es true si la sesión se abrió en una sucursal distinta de la activa (p. ej. al cambiar
 *    de sucursal con la mesa abierta); la pantalla no debe consultarla ni operarla.
 *  - registra una guarda que pide confirmación antes de cambiar de sucursal y descarta sesión y carrito.
 */
export function useTableSessionBranchGuard({ sessionId, activeBranchId, pendingMessage, onDiscard }: Options): {
  foreign: boolean
} {
  if (sessionId && activeBranchId && !owners.has(sessionId)) owners.set(sessionId, activeBranchId)
  const owner = sessionId ? owners.get(sessionId) : undefined
  const foreign = owner !== undefined && activeBranchId > 0 && owner !== activeBranchId

  const msgRef = useRef(pendingMessage)
  const discardRef = useRef(onDiscard)
  useEffect(() => {
    msgRef.current = pendingMessage
    discardRef.current = onDiscard
  })

  useEffect(() => {
    return registerBranchSwitchGuard({
      getMessage: () => msgRef.current,
      onDiscard: () => discardRef.current(),
    })
  }, [])

  return { foreign }
}
