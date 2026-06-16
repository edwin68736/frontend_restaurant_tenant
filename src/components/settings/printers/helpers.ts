import type { PrinterKind } from '@/services/printers.service'
import { effectiveConnection } from '@/services/printers/platform'
import type { PrinterConnectionMode } from '@/services/printers/types'

export function printerKindTitle(kind: PrinterKind): string {
  if (kind === 'comandas') return 'Impresora de comandas'
  if (kind === 'precuenta') return 'Impresora de precuenta'
  return 'Impresora de documentos'
}

export function printerKindSubtitle(kind: PrinterKind): string {
  if (kind === 'comandas') return 'Para imprimir comandas de cocina/bar'
  if (kind === 'precuenta') return 'Para imprimir la precuenta'
  return 'Para boleta/factura/nota de venta'
}

export function printerConfigReady(
  cfg: {
    connection: string
    printerName?: string
    tcpHost?: string
    bluetoothMac?: string
  },
): boolean {
  const connection = effectiveConnection({
    connection: cfg.connection as PrinterConnectionMode,
    tcpHost: cfg.tcpHost,
    bluetoothMac: cfg.bluetoothMac,
  })
  if (connection === 'network') return Boolean(cfg.tcpHost?.trim())
  if (connection === 'bluetooth') return Boolean(cfg.bluetoothMac?.trim())
  return Boolean(cfg.printerName?.trim())
}
