import { isCapacitorAndroid, isTauriDesktop } from '@/lib/platform/detect'
import type { PrinterConnectionMode, PrinterPlatformCapabilities } from './types'

export function getPrinterPlatformCapabilities(): PrinterPlatformCapabilities {
  return {
    windowsUsb: isTauriDesktop(),
    network: isTauriDesktop() || isCapacitorAndroid(),
    bluetooth: isCapacitorAndroid(),
  }
}

/** Conexiones válidas en la plataforma actual. */
export function availableConnectionModes(): PrinterConnectionMode[] {
  const cap = getPrinterPlatformCapabilities()
  const modes: PrinterConnectionMode[] = []
  if (cap.windowsUsb) modes.push('windows')
  if (cap.network) modes.push('network')
  if (cap.bluetooth) modes.push('bluetooth')
  return modes
}

export function defaultConnectionForPlatform(): PrinterConnectionMode {
  const modes = availableConnectionModes()
  if (modes.includes('windows')) return 'windows'
  if (modes.includes('network')) return 'network'
  return modes[0] ?? 'network'
}

/**
 * Modo de conexión real según plataforma y datos guardados.
 * Evita usar "windows" en Android cuando la UI muestra Red (TCP/IP).
 */
export function effectiveConnection(cfg: {
  connection: PrinterConnectionMode
  tcpHost?: string
  bluetoothMac?: string
}): PrinterConnectionMode {
  const modes = availableConnectionModes()
  if (modes.includes(cfg.connection)) return cfg.connection
  if (cfg.tcpHost?.trim() && modes.includes('network')) return 'network'
  if (cfg.bluetoothMac?.trim() && modes.includes('bluetooth')) return 'bluetooth'
  return defaultConnectionForPlatform()
}

export function connectionModeLabel(mode: PrinterConnectionMode): string {
  if (mode === 'windows') return 'Impresora Windows'
  if (mode === 'bluetooth') return 'Bluetooth'
  return 'Red (TCP/IP)'
}
