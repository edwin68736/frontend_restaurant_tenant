/** Tamaño del logo en comprobantes (ESC/POS y PDF). Ajuste local del dispositivo. */
export type LogoPrintSize = 'pequeno' | 'mediano' | 'grande'

const STORAGE_KEY = 'tukichef_logo_print_size_v1'

export const DEFAULT_LOGO_PRINT_SIZE: LogoPrintSize = 'mediano'

export const LOGO_PRINT_SIZE_OPTIONS: { value: LogoPrintSize; label: string; hint: string }[] = [
  { value: 'pequeno', label: 'Pequeño', hint: 'Discreto, ocupa poco papel.' },
  { value: 'mediano', label: 'Mediano', hint: 'Tamaño recomendado.' },
  { value: 'grande', label: 'Grande', hint: 'Máxima visibilidad en el comprobante.' },
]

/**
 * Cuadro máximo del logo en el TICKET, en milímetros reales. Es el mismo para rollo de 58 mm y
 * de 80 mm, en el PDF y en la impresión térmica directa (ESC/POS): el ajuste da el mismo tamaño
 * físico en cualquier papel.
 *
 * Por eso el ancho máximo (46 mm) cabe en el imprimible del rollo de 58 mm (~48 mm) y ninguna
 * medida se recorta por papel. Como el ancho ya no puede crecer, la altura es la que separa los
 * tres tamaños en un logo cuadrado o apaisado típico (16 / 24 / 34 mm); un logo muy ancho queda
 * limitado por el ancho.
 *
 * Antes cada papel y cada impresión tenían su propia cuenta (PDF 42×19 mm igual en los dos
 * rollos, ESC/POS 512×150 px en 80 mm y 360×120 px en 58 mm): el mismo ajuste no se veía igual,
 * y los tres tamaños quedaban demasiado juntos y chicos.
 */
export const TICKET_LOGO_BOX_MM: Record<LogoPrintSize, { w: number; h: number }> = {
  pequeno: { w: 34, h: 16 },
  mediano: { w: 42, h: 24 },
  grande: { w: 46, h: 34 },
}

/** Resolución de la ticketera térmica: 8 puntos por mm (58 mm ≈ 384 px, 80 mm ≈ 576 px). */
export const ESCPOS_PX_PER_MM = 8

/**
 * Factor sobre la medida base del logo en A4 (cabecera de 38 mm de ancho). En A4 el logo
 * comparte cabecera con los datos de la empresa y el recuadro, así que la escala es más
 * contenida que en ticket.
 */
const A4_SCALE: Record<LogoPrintSize, number> = {
  pequeno: 1,
  mediano: 1.5,
  grande: 2,
}

export function readLogoPrintSize(): LogoPrintSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'pequeno' || raw === 'mediano' || raw === 'grande') return raw
  } catch {
    /* noop */
  }
  return DEFAULT_LOGO_PRINT_SIZE
}

export function saveLogoPrintSize(size: LogoPrintSize) {
  try {
    localStorage.setItem(STORAGE_KEY, size)
  } catch {
    /* quota */
  }
}

/** Cuadro máximo del logo (mm) en ticket según el ajuste guardado; igual en 58 y 80 mm. */
export function ticketLogoBoxMm(size: LogoPrintSize = readLogoPrintSize()): { w: number; h: number } {
  return TICKET_LOGO_BOX_MM[size]
}

/** Escala una medida base del logo en A4 según el ajuste guardado. */
export function scaleA4LogoDimension(base: number): number {
  return base * A4_SCALE[readLogoPrintSize()]
}
