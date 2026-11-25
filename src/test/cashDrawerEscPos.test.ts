/**
 * Gaveta de dinero al imprimir la venta: se fija sobre los bytes finales que reciben los puentes
 * nativos (Tauri en Windows, plugin Bluetooth en Android), partiendo de los ajustes guardados, igual
 * que en un cobro real. Regresión: con 58 mm la gaveta no abría. El pulso iba al final, detrás del
 * corte, y las impresoras sin cortador automático (habituales en 58 mm) pueden perderlo ahí.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrintData } from '@/types/printData'
import type { PrinterPaperWidth } from '@/services/printers/types'

const platform = vi.hoisted(() => ({ current: 'windows' as 'windows' | 'android' }))
const sent = vi.hoisted(() => [] as string[])

vi.mock('@/lib/platform/detect', () => ({
  isTauriDesktop: () => platform.current === 'windows',
  isCapacitorAndroid: () => platform.current === 'android',
  isNativeApp: () => true,
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (_cmd: string, args: { input: { data_base64: string } }) => {
    sent.push(args.input.data_base64)
    return 'OK'
  },
}))
vi.mock('@/plugins/tukichef-printer', () => ({
  TukichefPrinter: {
    getConnectionStatus: async () => ({ connected: true, address: 'AA:BB' }),
    connectPrinter: async () => ({ connected: true }),
    printTicket: async ({ dataBase64 }: { dataBase64: string }) => {
      sent.push(dataBase64)
    },
  },
}))
vi.mock('@/utils/receiptSound', () => ({ playSaleReceiptSound: async () => {} }))
vi.mock('@/lib/companyLogo', () => ({ resolveLogoForPrint: async () => 'logo.png' }))
// jsdom no tiene canvas: rasters ficticios con el mismo encabezado GS v 0 y ancho real de cada papel.
vi.mock('@/utils/escposRasterImage', () => {
  const raster = (paper: 58 | 80) => {
    const widthBytes = paper === 58 ? 48 : 72
    return new Uint8Array([0x1d, 0x76, 0x30, 0, widthBytes, 0, 1, 0, ...new Array(widthBytes).fill(0xff)])
  }
  return {
    buildEscPosLogoRaster: async (_url: string, paper: 58 | 80) => raster(paper),
    buildEscPosPayConditionSunatRowRaster: async (_l: string[], _q: string, paper: 58 | 80) => raster(paper),
    buildEscPosWalletQrRaster: async (_url: string, paper: 58 | 80) => raster(paper),
  }
})

import { printDocumentAuto, openCashDrawer } from '@/services/printers.service'
import { emptyPrinterSettings, saveStoredPrinterSettings } from '@/services/printers/storage'

const INIT = [0x1b, 0x40]
const DRAWER = [0x1b, 0x70, 0x00, 0x19, 0xfa]
const CUT = [0x1d, 0x56, 0x41, 0x10]

const sale = {
  sunat_code: '03',
  doc_type: 'BOLETA',
  number: 'B001-1',
  issue_date: '25/11/2026',
  currency: 'PEN',
  company: { ruc: '20000000001', business_name: 'Empresa SAC' },
  client: { business_name: 'Varios', doc_number: '00000000' },
  items: [{ quantity: 1, description: 'Lomo saltado', unit_price: 28, total: 28 }],
  total: 28,
  tax_amount: 4.27,
  payment_condition: 'Contado',
  payments: [{ method: 'cash', amount: 28 }],
  qr_data: '20000000001|03|B001|1',
} as unknown as PrintData

function configure(paperWidthMm: PrinterPaperWidth, openDrawerOnPrint: boolean) {
  const settings = emptyPrinterSettings()
  settings.documentos = {
    ...settings.documentos,
    ...(platform.current === 'windows'
      ? { connection: 'windows' as const, printerName: 'POS' }
      : { connection: 'bluetooth' as const, bluetoothMac: 'AA:BB' }),
    paperWidthMm,
    openDrawerOnPrint,
  }
  saveStoredPrinterSettings(settings)
}

function lastPayload(): number[] {
  return Array.from(atob(sent.at(-1)!), (c) => c.charCodeAt(0))
}

function positions(bytes: number[], seq: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i <= bytes.length - seq.length; i++) {
    if (seq.every((b, j) => bytes[i + j] === b)) out.push(i)
  }
  return out
}

describe.each(['windows', 'android'] as const)('gaveta al imprimir la venta (%s)', (os) => {
  beforeEach(() => {
    platform.current = os
    sent.length = 0
    localStorage.clear()
  })

  it.each([58, 80] as const)('%i mm con la opción activa: un solo pulso, antes del ticket', async (paper) => {
    configure(paper, true)
    await printDocumentAuto(sale)
    const bytes = lastPayload()
    expect(bytes.slice(0, INIT.length + DRAWER.length)).toEqual([...INIT, ...DRAWER])
    expect(positions(bytes, DRAWER)).toEqual([INIT.length])
    expect(bytes.slice(-CUT.length)).toEqual(CUT)
  })

  it.each([58, 80] as const)('%i mm con la opción desactivada: no hay pulso', async (paper) => {
    configure(paper, false)
    await printDocumentAuto(sale)
    const bytes = lastPayload()
    expect(positions(bytes, [0x1b, 0x70])).toEqual([])
    expect(bytes.slice(-CUT.length)).toEqual(CUT)
  })

  it.each([58, 80] as const)('%i mm: el botón «Abrir gaveta» manda el mismo pulso', async (paper) => {
    configure(paper, false)
    await openCashDrawer()
    expect(lastPayload()).toEqual([...INIT, ...DRAWER])
  })
})
