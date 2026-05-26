import type { PrinterKind } from '@/services/printers.service'

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
  if (cfg.connection === 'network') return Boolean(cfg.tcpHost?.trim())
  if (cfg.connection === 'bluetooth') return Boolean(cfg.bluetoothMac?.trim())
  return Boolean(cfg.printerName?.trim())
}
