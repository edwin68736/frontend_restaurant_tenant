import { roundDisplay } from '@/utils/money'

/** Formato visual de moneda (2 decimales). Los cálculos internos usan roundSunat (6). */
export function formatMoney(n: number, currency = 'PEN'): string {
  const sym = currency === 'USD' ? '$' : 'S/'
  return `${sym} ${roundDisplay(n).toFixed(2)}`
}
