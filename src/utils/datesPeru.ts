/** Fecha de hoy en Perú (YYYY-MM-DD). */
export function getTodayPeru(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

/** Máximo de días hacia atrás para la fecha de emisión de una factura/boleta (SUNAT). */
export const ISSUE_DATE_MAX_DAYS_BACK = 3

/** Fecha mínima de emisión: hoy (Perú) menos ISSUE_DATE_MAX_DAYS_BACK días. */
export function getMinIssueDatePeru(): string {
  const [y, m, d] = getTodayPeru().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - ISSUE_DATE_MAX_DAYS_BACK)).toISOString().slice(0, 10)
}

/** Ajusta una fecha YYYY-MM-DD a la ventana permitida de emisión [hoy-3, hoy]. */
export function clampIssueDatePeru(value: string): string {
  const d = String(value ?? '').slice(0, 10)
  const today = getTodayPeru()
  if (!/^d{4}-d{2}-d{2}$/.test(d)) return today
  const min = getMinIssueDatePeru()
  return d < min ? min : d > today ? today : d
}

export function getCurrentMonthRange(): { from: string; to: string } {
  const today = getTodayPeru()
  const [year, month] = today.split('-')
  return { from: `${year}-${month}-01`, to: today }
}

export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value.includes('T') ? value : `${value}T12:00:00`) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
}
