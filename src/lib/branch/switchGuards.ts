/**
 * Guardas de cambio de sucursal: las pantallas con trabajo pendiente (mesa/cuenta abierta, carrito)
 * se registran aquí. Antes de cambiar de sucursal BranchProvider pregunta al usuario y, si confirma,
 * ejecuta `onDiscard` de cada guarda (descartar sesión/carrito) ANTES de remontar la pantalla.
 */
export type BranchSwitchGuard = {
  /** Mensaje de confirmación; `null` si no hay nada pendiente. */
  getMessage: () => string | null
  /** Descarta el trabajo pendiente (se llama solo tras confirmar y cambiar con éxito). */
  onDiscard?: () => void
}

const guards = new Set<BranchSwitchGuard>()

export function registerBranchSwitchGuard(g: BranchSwitchGuard): () => void {
  guards.add(g)
  return () => {
    guards.delete(g)
  }
}

export function pendingSwitchMessages(): string[] {
  const out: string[] = []
  for (const g of guards) {
    const m = g.getMessage()
    if (m) out.push(m)
  }
  return out
}

export function discardPendingWork(): void {
  for (const g of [...guards]) {
    if (!g.getMessage()) continue
    try {
      g.onDiscard?.()
    } catch (err) {
      console.warn('[switchGuards] onDiscard falló', err)
    }
  }
}

/** Solo para tests. */
export function __clearGuardsForTests(): void {
  guards.clear()
}
