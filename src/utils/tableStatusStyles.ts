/** Estilos por estado de mesa (libre vs ocupada — colores distintos al verde corporativo). */

export type TableStatusKey = 'libre' | 'ocupada' | 'default'

export function tableStatusKey(status: string): TableStatusKey {
  if (status === 'libre') return 'libre'
  if (status === 'ocupada') return 'ocupada'
  return 'default'
}

const STYLES = {
  libre: {
    card: 'bg-emerald-50/80 border-emerald-300 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-200/60',
    badgeOuter: 'bg-emerald-100 border-emerald-500',
    badgeText: 'text-emerald-900',
    amount: 'text-emerald-800',
    statsPill: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    statsCount: 'text-emerald-950',
    chair: 'bg-emerald-500',
    surface: 'bg-white border-emerald-300 shadow-inner',
    surfaceAlt: 'bg-emerald-50/80 border-emerald-300 shadow-inner',
    statusChip: 'bg-emerald-100 text-emerald-800',
  },
  ocupada: {
    card: 'bg-amber-50/90 border-amber-400 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-200/70',
    badgeOuter: 'bg-amber-100 border-amber-500',
    badgeText: 'text-amber-950',
    amount: 'text-amber-900',
    statsPill: 'border-amber-300 bg-amber-50 text-amber-900',
    statsCount: 'text-amber-950',
    chair: 'bg-amber-500',
    surface: 'bg-amber-50/90 border-amber-400 shadow-inner',
    surfaceAlt: 'bg-amber-50/90 border-amber-400 shadow-inner',
    statusChip: 'bg-amber-200 text-amber-950',
  },
  default: {
    card: 'bg-stone-50 border-stone-300 hover:border-stone-400 hover:shadow-lg hover:shadow-stone-200/50',
    badgeOuter: 'bg-stone-100 border-stone-400',
    badgeText: 'text-stone-800',
    amount: 'text-stone-700',
    statsPill: 'border-stone-200 bg-stone-100 text-stone-700',
    statsCount: 'text-stone-900',
    chair: 'bg-stone-400',
    surface: 'bg-white border-stone-300 shadow-inner',
    surfaceAlt: 'bg-stone-50 border-stone-300 shadow-inner',
    statusChip: 'bg-stone-200 text-stone-800',
  },
} as const

export function tableStatusStyles(status: string) {
  return STYLES[tableStatusKey(status)]
}

export function tableStatusLabel(status: string): string {
  if (status === 'libre') return 'Libre'
  if (status === 'ocupada') return 'Ocupada'
  return status
}
