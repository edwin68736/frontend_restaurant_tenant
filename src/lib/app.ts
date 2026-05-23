/**
 * Detección de runtime Tukichef.
 * Reexporta desde platform/ para compatibilidad con imports existentes.
 */
export {
  getAppRuntime,
  isCapacitorNative,
  isCapacitorAndroid,
  isTauriDesktop,
  isWebBrowser,
  isNativeShell,
  getCapacitorPlatform,
} from '@/lib/platform/detect'

export type { AppRuntime, CapacitorPlatform, DeviceFormFactor } from '@/lib/platform/types'

export {
  getDeviceFormFactor,
  allowsLandscapeOrientation,
  measureScreenEdges,
} from '@/lib/platform/formFactor'
