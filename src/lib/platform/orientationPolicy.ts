import { ScreenOrientation } from '@capacitor/screen-orientation'
import { allowsLandscapeOrientation, measureScreenEdges } from './formFactor'
import { isCapacitorNative } from './detect'

let orientationListenerAttached = false

/**
 * Teléfonos pequeños: solo portrait. Tablets / pantallas grandes: portrait + landscape.
 */
export async function applyOrientationPolicy(): Promise<void> {
  if (!isCapacitorNative()) return

  try {
    if (allowsLandscapeOrientation()) {
      await ScreenOrientation.unlock()
    } else {
      await ScreenOrientation.lock({ orientation: 'portrait' })
    }
  } catch (e) {
    console.warn('[Tukichef] No se pudo aplicar política de orientación', e)
  }
}

export function startOrientationPolicyWatcher(): () => void {
  if (!isCapacitorNative() || typeof window === 'undefined') {
    return () => {}
  }

  const onChange = () => {
    void applyOrientationPolicy()
  }

  if (!orientationListenerAttached) {
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    orientationListenerAttached = true
  }

  void applyOrientationPolicy()

  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
    orientationListenerAttached = false
  }
}

export function getOrientationDebugInfo() {
  const edges = measureScreenEdges()
  return {
    ...edges,
    formFactor: allowsLandscapeOrientation(edges) ? 'tablet' : 'phone',
    landscapeAllowed: allowsLandscapeOrientation(edges),
  }
}
