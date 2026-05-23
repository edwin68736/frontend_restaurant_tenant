/** Frases motivacionales (una aleatoria por visita a login/PIN). */
export const AUTH_MOTIVATIONAL_QUOTES = [
  'Tu arte en el plato, tu control en los números.',
  'Cada servicio cuenta, cada detalle importa.',
  'La pasión se sirve en cada mesa.',
  'Excelencia en cocina, armonía en el salón.',
  'Hoy es un buen día para sorprender a tus comensales.',
] as const

export function pickAuthQuote(): string {
  const i = Math.floor(Math.random() * AUTH_MOTIVATIONAL_QUOTES.length)
  return AUTH_MOTIVATIONAL_QUOTES[i]
}
