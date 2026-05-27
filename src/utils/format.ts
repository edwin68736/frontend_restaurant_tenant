import { formatAmountDisplay } from '@/utils/money'

/** Formato visual de moneda (2 decimales). Los cálculos internos usan roundSunat (6). */
export function formatMoney(n: number, currency = 'PEN'): string {
  const sym = currency === 'USD' ? '$' : 'S/'
  return `${sym} ${formatAmountDisplay(n)}`
}

/** Solo monto con símbolo soles (alias corto para UI POS/Mesas). */
export function formatSoles(n: number): string {
  return `S/ ${formatAmountDisplay(n)}`
}
