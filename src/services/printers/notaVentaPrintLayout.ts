/** Ajustes locales de impresión solo para notas de venta (SUNAT 00). */

export type NotaVentaPrintLayoutSettings = {
  showLogo: boolean
  showEmailAndPhone: boolean
  showDocTypeAndNumber: boolean
  showClientData: boolean
  showPaymentCondition: boolean
}

export const NOTA_VENTA_PRINT_LAYOUT_STORAGE_KEY = 'tukichef_nota_venta_print_layout_v1'

export const DEFAULT_NOTA_VENTA_PRINT_LAYOUT: NotaVentaPrintLayoutSettings = {
  showLogo: true,
  showEmailAndPhone: true,
  showDocTypeAndNumber: true,
  showClientData: true,
  showPaymentCondition: true,
}

// A diferencia de Tukifac, aquí no hay opción de cuentas bancarias: eso se controla en
// Ajustes → Restaurante → Comprobantes, que ya elige qué cuentas salen en ticket y PDF
// (y sin cuentas seleccionadas, no se imprime nada bancario).
export const NOTA_VENTA_PRINT_LAYOUT_OPTIONS: {
  key: keyof NotaVentaPrintLayoutSettings
  label: string
  hint?: string
}[] = [
  { key: 'showLogo', label: 'Mostrar logo' },
  { key: 'showEmailAndPhone', label: 'Mostrar email y teléfono del tenant' },
  {
    key: 'showDocTypeAndNumber',
    label: 'Mostrar el tipo de comprobante y número',
    hint: 'Tipo, número',
  },
  { key: 'showClientData', label: 'Mostrar datos del cliente' },
  {
    key: 'showPaymentCondition',
    label: 'Mostrar condición de pago',
    hint: 'Contado o crédito. Las cuentas bancarias se configuran en Restaurante → Comprobantes.',
  },
]

export function isNotaVentaSunatCode(code?: string | null): boolean {
  return String(code ?? '').trim() === '00'
}

function normalizeLayout(
  raw: Partial<NotaVentaPrintLayoutSettings> | null | undefined,
): NotaVentaPrintLayoutSettings {
  // Ausente ⇒ true: por defecto se imprime todo.
  return {
    showLogo: raw?.showLogo !== false,
    showEmailAndPhone: raw?.showEmailAndPhone !== false,
    showDocTypeAndNumber: raw?.showDocTypeAndNumber !== false,
    showClientData: raw?.showClientData !== false,
    showPaymentCondition: raw?.showPaymentCondition !== false,
  }
}

export function loadNotaVentaPrintLayoutSettings(): NotaVentaPrintLayoutSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_NOTA_VENTA_PRINT_LAYOUT }
  try {
    const raw = localStorage.getItem(NOTA_VENTA_PRINT_LAYOUT_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_NOTA_VENTA_PRINT_LAYOUT }
    return normalizeLayout(JSON.parse(raw) as Partial<NotaVentaPrintLayoutSettings>)
  } catch {
    return { ...DEFAULT_NOTA_VENTA_PRINT_LAYOUT }
  }
}

export function saveNotaVentaPrintLayoutSettings(settings: NotaVentaPrintLayoutSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      NOTA_VENTA_PRINT_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalizeLayout(settings)),
    )
  } catch {
    /* quota */
  }
}

/** Devuelve ajustes solo para nota de venta; null en boleta/factura y demás documentos. */
export function getNotaVentaPrintLayout(
  sunatCode?: string | null,
): NotaVentaPrintLayoutSettings | null {
  if (!isNotaVentaSunatCode(sunatCode)) return null
  return loadNotaVentaPrintLayoutSettings()
}
