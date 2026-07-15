/** Ajustes locales de impresión de comandas (qué se muestra y con qué tamaño de letra). */

/**
 * Tamaño del texto de la comanda:
 * - grande: doble ancho y alto. Es el tamaño de siempre y el valor por defecto.
 * - mediano: tamaño normal. Existe para gastar menos papel: cada línea mide la mitad de
 *   alto y además entra el doble de texto por línea, así que se parten menos líneas.
 */
export type ComandaTextSize = 'grande' | 'mediano'

export type ComandaPrintLayoutSettings = {
  showTableFloor: boolean
  showWaiter: boolean
  textSize: ComandaTextSize
}

export const COMANDA_PRINT_LAYOUT_STORAGE_KEY = 'tukichef_comanda_print_layout_v1'

export const DEFAULT_COMANDA_PRINT_LAYOUT: ComandaPrintLayoutSettings = {
  showTableFloor: true,
  showWaiter: true,
  textSize: 'grande',
}

export const COMANDA_PRINT_LAYOUT_OPTIONS: {
  key: 'showTableFloor' | 'showWaiter'
  label: string
  hint?: string
}[] = [
  {
    key: 'showTableFloor',
    label: 'Mostrar el ambiente de la mesa',
    hint: 'La sala o piso junto al nombre: «Mesa 5 (Terraza)».',
  },
  { key: 'showWaiter', label: 'Mostrar el mozo' },
]

export const COMANDA_TEXT_SIZE_OPTIONS: { value: ComandaTextSize; label: string; hint: string }[] = [
  { value: 'grande', label: 'Grande', hint: 'Tamaño de siempre.' },
  { value: 'mediano', label: 'Mediano', hint: 'Ticket más corto: ahorra papel.' },
]

function normalizeLayout(
  raw: Partial<ComandaPrintLayoutSettings> | null | undefined,
): ComandaPrintLayoutSettings {
  // Ausente ⇒ se mantiene el comportamiento de siempre.
  return {
    showTableFloor: raw?.showTableFloor !== false,
    showWaiter: raw?.showWaiter !== false,
    textSize: raw?.textSize === 'mediano' ? 'mediano' : 'grande',
  }
}

export function loadComandaPrintLayoutSettings(): ComandaPrintLayoutSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_COMANDA_PRINT_LAYOUT }
  try {
    const raw = localStorage.getItem(COMANDA_PRINT_LAYOUT_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_COMANDA_PRINT_LAYOUT }
    return normalizeLayout(JSON.parse(raw) as Partial<ComandaPrintLayoutSettings>)
  } catch {
    return { ...DEFAULT_COMANDA_PRINT_LAYOUT }
  }
}

export function saveComandaPrintLayoutSettings(settings: ComandaPrintLayoutSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COMANDA_PRINT_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeLayout(settings)))
  } catch {
    /* quota */
  }
}
