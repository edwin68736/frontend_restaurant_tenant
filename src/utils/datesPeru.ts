/** Fecha de hoy en Perú (YYYY-MM-DD). */
export function getTodayPeru(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
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
