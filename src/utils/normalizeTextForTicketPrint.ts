const SYMBOL_REPLACEMENTS: [RegExp, string][] = [
  [/ß/g, 'ss'],
  [/¿/g, '?'],
  [/¡/g, '!'],
  [/€/g, 'EUR'],
  [/°/g, 'o'],
  [/ª/g, 'a'],
  [/º/g, 'o'],
  [/—/g, '-'],
  [/–/g, '-'],
  [/…/g, '...'],
  [/[\u201c\u201d]/g, '"'],
  [/[\u2018\u2019]/g, "'"],
  [/[\u200b-\u200d\ufeff]/g, ''],
  [/[\u00b7\u2022\u2023\u2043\u2219\u25cf\u2027\u00b0]/g, '-'],
  [/[\u00a0\u202f\u2007\u2009\u200a\u3000]/g, ' '],
]

/**
 * Convierte texto a caracteres imprimibles en ticketeras ESC/POS (sin tildes ni ñ literal).
 * - Vocales acentuadas → sin tilde (café → cafe).
 * - ñ + o → nio (año → anio, niño → ninio).
 * - Demás ñ → n (pañuelo → panuelo).
 */
export function normalizeTextForTicketPrint(text: string): string {
  if (!text) return ''
  let s = String(text)

  s = s.replace(/ñ([oO])/g, 'ni$1')
  s = s.replace(/Ñ([oO])/g, 'Ni$1')
  s = s.replace(/ñ/g, 'n').replace(/Ñ/g, 'N')

  s = s.normalize('NFD').replace(/\p{M}+/gu, '')

  for (const [re, rep] of SYMBOL_REPLACEMENTS) {
    s = s.replace(re, rep)
  }

  // Ticketeras ESC/POS (CP437/850): quitar multibyte; conservar saltos de linea y tab.
  s = s.replace(/[^\x20-\x7E\n\r\t]/g, '')

  return s
}
