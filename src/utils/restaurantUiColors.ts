import { clsx } from 'clsx'

/** Navegación principal: cada módulo con acento distinto (verde = marca en POS). */
const NAV_BY_PATH: Record<string, { active: string; idle: string }> = {
  '/pos': {
    active: 'bg-green-600 text-white shadow-md shadow-green-600/25',
    idle: 'text-green-800 hover:bg-green-50 active:bg-green-100',
  },
  '/comandas': {
    active: 'bg-orange-600 text-white shadow-md shadow-orange-600/25',
    idle: 'text-orange-900 hover:bg-orange-50 active:bg-orange-100',
  },
  '/salas': {
    active: 'bg-teal-600 text-white shadow-md shadow-teal-600/25',
    idle: 'text-teal-900 hover:bg-teal-50 active:bg-teal-100',
  },
}

const NAV_DEFAULT = {
  active: 'bg-stone-800 text-white shadow-sm',
  idle: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
}

export function navPillClasses(path: string, isActive: boolean, compact?: boolean): string {
  const accent = NAV_BY_PATH[path] ?? NAV_DEFAULT
  return clsx(
    'inline-flex items-center font-medium transition-all whitespace-nowrap shrink-0',
    compact
      ? 'gap-1 rounded-lg px-2.5 py-1.5 text-xs'
      : 'gap-1 lg:gap-1 lg:rounded-lg lg:px-2 lg:py-1.5 lg:text-xs xl:gap-1.5 xl:rounded-full xl:px-3.5 xl:py-2 xl:text-sm',
    isActive ? accent.active : accent.idle,
  )
}

const NAV_BOTTOM_ACTIVE: Record<string, string> = {
  '/pos': 'text-green-700 bg-green-50',
  '/comandas': 'text-orange-800 bg-orange-50',
  '/salas': 'text-teal-800 bg-teal-50',
}

/** Pestaña inferior móvil (POS / Comandas / Mesas). */
export function navBottomTabClasses(path: string, isActive: boolean): string {
  return clsx(
    'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg mx-0.5 px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors touch-manipulation',
    isActive ? (NAV_BOTTOM_ACTIVE[path] ?? 'text-stone-800 bg-stone-100') : 'text-stone-500 hover:text-stone-700 active:bg-stone-50',
  )
}

/** Ítem activo en menú lateral móvil. */
export function navSheetLinkClasses(path: string, isActive: boolean): string {
  const accent = NAV_BY_PATH[path] ?? NAV_DEFAULT
  return clsx(
    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
    isActive ? accent.active : 'text-stone-700 hover:bg-stone-100',
  )
}

/** Pestañas de tipo de pedido (Comandas / filtros). */
export function orderTypeTabClasses(type: string, active: boolean): string {
  const base =
    'shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors'
  const activeMap: Record<string, string> = {
    all: 'bg-stone-700 text-white border-stone-700',
    dine_in: 'bg-teal-600 text-white border-teal-600',
    takeaway: 'bg-blue-600 text-white border-blue-600',
    delivery: 'bg-violet-600 text-white border-violet-600',
    quick_sale: 'bg-green-600 text-white border-green-600',
  }
  const idleMap: Record<string, string> = {
    all: 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50',
    dine_in: 'bg-white text-teal-800 border-teal-200 hover:bg-teal-50',
    takeaway: 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50',
    delivery: 'bg-white text-violet-800 border-violet-200 hover:bg-violet-50',
    quick_sale: 'bg-white text-green-800 border-green-200 hover:bg-green-50',
  }
  if (active) return clsx(base, activeMap[type] ?? activeMap.all)
  return clsx(base, idleMap[type] ?? idleMap.all)
}

/** Botones tipo de venta en POS (Directa / Llevar / Delivery). */
export function posOrderTypeButtonClasses(type: string, active: boolean): string {
  const base = 'inline-flex items-center justify-center gap-0.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors'
  const activeMap: Record<string, string> = {
    quick_sale: 'bg-green-600 text-white border-green-600',
    takeaway: 'bg-blue-600 text-white border-blue-600',
    delivery: 'bg-violet-600 text-white border-violet-600',
  }
  const idleMap: Record<string, string> = {
    quick_sale: 'bg-white text-green-800 border-green-200 hover:bg-green-50',
    takeaway: 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50',
    delivery: 'bg-white text-violet-800 border-violet-200 hover:bg-violet-50',
  }
  if (active) return clsx(base, activeMap[type] ?? activeMap.quick_sale)
  return clsx(base, idleMap[type] ?? 'bg-white border-stone-200 hover:bg-stone-50 text-stone-600')
}

/** Badge de estado del pedido. */
export function orderStatusBadgeClasses(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-700',
    pending: 'bg-amber-100 text-amber-950',
    sent_to_kitchen: 'bg-orange-100 text-orange-950',
    preparing: 'bg-orange-100 text-orange-950',
    ready: 'bg-green-100 text-green-900',
    on_the_way: 'bg-sky-100 text-sky-900',
    delivered: 'bg-emerald-100 text-emerald-900',
    paid: 'bg-stone-200 text-stone-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return clsx('shrink-0 text-xs font-medium px-2 py-0.5 rounded-full', map[status] ?? map.pending)
}

/** Borde izquierdo de tarjeta según tipo de pedido. */
export function orderTypeCardAccentClasses(type: string): string {
  const map: Record<string, string> = {
    dine_in: 'border-l-4 border-l-teal-500',
    takeaway: 'border-l-4 border-l-blue-500',
    delivery: 'border-l-4 border-l-violet-500',
    quick_sale: 'border-l-4 border-l-green-500',
  }
  return map[type] ?? 'border-l-4 border-l-stone-300'
}

/** Etiqueta pequeña de tipo de pedido. */
export function orderTypeChipClasses(type: string): string {
  const map: Record<string, string> = {
    dine_in: 'bg-teal-50 text-teal-800 border border-teal-200',
    takeaway: 'bg-blue-50 text-blue-800 border border-blue-200',
    delivery: 'bg-violet-50 text-violet-800 border border-violet-200',
    quick_sale: 'bg-green-50 text-green-800 border border-green-200',
  }
  return clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-md', map[type] ?? 'bg-stone-100 text-stone-700 border border-stone-200')
}

/** Alertas: cola de pedidos pendientes (naranja, no verde). */
export function pendingQueueBadgeClasses(): string {
  return 'inline-flex min-w-[1.5rem] h-6 px-1.5 items-center justify-center rounded-md bg-orange-600 text-white text-sm font-bold'
}

export function pendingQueueLargeBadgeClasses(): string {
  return 'inline-flex min-w-[2.5rem] h-10 px-2 items-center justify-center rounded-xl bg-orange-600 text-white text-2xl font-bold tabular-nums shadow-md shadow-orange-600/35 ring-2 ring-orange-400/40'
}

export function pendingOrdersButtonClasses(hasPending: boolean): string {
  return clsx(
    'shrink-0 inline-flex flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors',
    hasPending
      ? 'animate-pulse border-orange-500 bg-orange-50 text-orange-900 shadow-md ring-2 ring-orange-300/50 hover:bg-orange-100'
      : 'border-stone-200 text-stone-600 hover:bg-white',
  )
}

export function pendingOrdersButtonIconClasses(hasPending: boolean): string {
  return hasPending ? 'text-orange-700' : 'text-stone-600'
}
