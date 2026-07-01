import { isCapacitorAndroid, isTauriDesktop } from '@/lib/platform/detect'
import type { PrinterConnectionMode, PrinterPlatformCapabilities } from './types'

export function getPrinterPlatformCapabilities(): PrinterPlatformCapabilities {
  return {
    windowsUsb: isTauriDesktop(),
    network: isTauriDesktop() || isCapacitorAndroid(),
    bluetooth: isCapacitorAndroid(),
  }
}

/** Conexiones válidas en la plataforma actual (Bluetooth primero en Android). */
export function availableConnectionModes(): PrinterConnectionMode[] {
  const cap = getPrinterPlatformCapabilities()
  const modes: PrinterConnectionMode[] = []
  if (cap.bluetooth) modes.push('bluetooth')
  if (cap.network) modes.push('network')
  if (cap.windowsUsb) modes.push('windows')
  return modes
}

export function defaultConnectionForPlatform(): PrinterConnectionMode {
  const modes = availableConnectionModes()
  if (modes.includes('bluetooth')) return 'bluetooth'
  if (modes.includes('windows')) return 'windows'
  if (modes.includes('network')) return 'network'
  return modes[0] ?? 'network'
}

/**
 * Modo de conexión real según plataforma y datos guardados.
 * En Android sin datos TCP/BT configurados → Bluetooth por defecto.
 */
export function effectiveConnection(cfg: {
  connection: PrinterConnectionMode
  tcpHost?: string
  bluetoothMac?: string
}): PrinterConnectionMode {
  const modes = availableConnectionModes()
  const hasTcp = Boolean(cfg.tcpHost?.trim())
  const hasBt = Boolean(cfg.bluetoothMac?.trim())

  if (isCapacitorAndroid()) {
    if (hasBt && modes.includes('bluetooth')) return 'bluetooth'
    if (hasTcp && modes.includes('network')) return 'network'
    if (modes.includes('bluetooth')) return 'bluetooth'
    if (modes.includes('network')) return 'network'
    return modes[0] ?? 'network'
  }

  if (modes.includes(cfg.connection)) return cfg.connection
  if (hasTcp && modes.includes('network')) return 'network'
  if (hasBt && modes.includes('bluetooth')) return 'bluetooth'
  return defaultConnectionForPlatform()
}

export function connectionModeLabel(mode: PrinterConnectionMode): string {
  if (mode === 'windows') return 'Impresora Windows'
  if (mode === 'bluetooth') return 'Bluetooth'
  return 'Red (TCP/IP)'
}
