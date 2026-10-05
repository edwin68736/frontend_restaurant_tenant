import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { Bike, ChefHat, Clock, LayoutGrid, Receipt, RefreshCw, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { restaurantService, type KitchenComanda } from '@/services/restaurant.service'
import { cashbankService, type OpenCashSessionRow } from '@/services/cashbank.service'
import type { RestaurantOrderSummary } from '@/types/restaurantOrder'
import { formatMoney } from '@/utils/format'

export type TurnoRole = 'admin' | 'cashier' | 'waiter' | 'cook' | 'driver' | 'other'

type Tone = 'neutral' | 'good' | 'warn' | 'alert'

export type Tile = { key: string; label: string; value: string; hint?: string; icon: LucideIcon; tone: Tone; to?: string }

const REFRESH_MS = 30_000

const TONE: Record<Tone, string> = {
  neutral: 'border-stone-200 bg-white text-stone-900',
  good: 'border-teal-200 bg-teal-50/60 text-teal-950',
  warn: 'border-amber-200 bg-amber-50/70 text-amber-950',
  alert: 'border-red-200 bg-red-50/70 text-red-950',
}

export type TurnoData = {
  orders: RestaurantOrderSummary[] | null
  kitchen: KitchenComanda[] | null
  openCashes: OpenCashSessionRow[] | null
}

const EMPTY: TurnoData = { orders: null, kitchen: null, openCashes: null }

function minutesSince(iso: string | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Qué datos hacen falta según el rol (no se piden los que no se muestran). Cada petición es
 * independiente: si una falla (p. ej. sin permiso) simplemente no se muestra su tarjeta.
 */
function needs(role: TurnoRole) {
  return {
    orders: role !== 'cook',
    kitchen: role === 'cook' || role === 'waiter' || role === 'admin',
    openCashes: role === 'admin',
  }
}

/** "Mi turno": estado del trabajo del día según el rol, con datos en vivo (se refresca solo). */
export function MiTurnoBlock({ role }: { role: TurnoRole }) {
  const { staffId } = useAuth()
  const { activeBranchId } = useBranch()
  const { session, canOperateCash } = useCashSession()
  const [data, setData] = useState<TurnoData>(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const n = needs(role)
    const [orders, kitchen, openCashes] = await Promise.allSettled([
      n.orders ? restaurantService.listOpenOrders('all') : Promise.resolve(null),
      n.kitchen ? restaurantService.getKitchen() : Promise.resolve(null),
      n.openCashes && activeBranchId > 0 ? cashbankService.listOpenSessionsInBranch(activeBranchId) : Promise.resolve(null),
    ])
    const val = <T,>(r: PromiseSettledResult<T | null>): T | null => (r.status === 'fulfilled' ? r.value : null)
    setData({
      orders: val(orders),
      kitchen: val(kitchen),
      openCashes: val(openCashes),
    })
    setLoading(false)
  }, [role, activeBranchId])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  useOnBranchChange(() => {
    setData(EMPTY)
    setLoading(true)
  })

  const tiles = buildTiles(role, data, { staffId, session, canOperateCash })
  if (!loading && tiles.length === 0) return null

  return (
    <section aria-label="Mi turno">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Mi turno</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-100"
          aria-label="Actualizar mi turno"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>
      {loading && tiles.length === 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[4.5rem] rounded-xl border border-stone-200 bg-stone-50 animate-pulse" />
          ))}
        </div>
      ) : (
        <TileGrid tiles={tiles} />
      )}
    </section>
  )
}

/** Cuadrícula de tarjetas de estado (se reparte en el ancho disponible). */
export function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2.5">
      {tiles.map((t) => {
        const Icon = t.icon
        const body = (
          <div className={clsx('h-full rounded-xl border px-3.5 py-3 transition-colors', TONE[t.tone], t.to && 'hover:shadow-sm')}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{t.label}</span>
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums leading-tight">{t.value}</p>
            {t.hint ? <p className="mt-0.5 text-[11px] leading-snug opacity-70">{t.hint}</p> : null}
          </div>
        )
        return t.to ? (
          <Link key={t.key} to={t.to} className="block touch-manipulation">
            {body}
          </Link>
        ) : (
          <div key={t.key}>{body}</div>
        )
      })}
    </div>
  )
}

export function buildTiles(
  role: TurnoRole,
  d: TurnoData,
  ctx: {
    staffId: number | null
    session: { opening_balance: number; opened_at?: string } | null | undefined
    canOperateCash: boolean
  },
): Tile[] {
  const tiles: Tile[] = []
  const orders = d.orders ?? []
  const kitchen = d.kitchen ?? []
  const kCount = (status: string) => kitchen.filter((c) => c.status === status).length

  if (role === 'cashier' || role === 'other') {
    if (ctx.canOperateCash && ctx.session) {
      const mins = minutesSince(ctx.session.opened_at)
      tiles.push({
        key: 'cash',
        label: 'Mi caja',
        value: formatMoney(Number(ctx.session.opening_balance) || 0),
        hint: mins !== null ? `Saldo inicial · abierta hace ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}` : 'Saldo inicial',
        icon: Wallet,
        tone: 'good',
        to: '/caja',
      })
    }
    if (d.orders) {
      tiles.push({
        key: 'tocharge',
        label: 'Pedidos por cobrar',
        value: String(orders.length),
        hint: orders.length ? 'Abiertos en la sucursal' : 'Nada pendiente',
        icon: Receipt,
        tone: orders.length ? 'warn' : 'neutral',
        to: '/comandas',
      })
    }
  }

  if (role === 'waiter') {
    const mine = ctx.staffId ? orders.filter((o) => o.staff_id === ctx.staffId) : orders
    const mineIds = new Set(mine.map((o) => o.id))
    const ready = kitchen.filter((c) => c.status === 'lista' && mineIds.has(c.session_id)).length
    const myTables = mine.filter((o) => o.order_type === 'dine_in')
    tiles.push({
      key: 'tables',
      label: ctx.staffId ? 'Mis mesas abiertas' : 'Mesas abiertas',
      value: String(myTables.length),
      hint: myTables.length ? myTables.slice(0, 3).map((o) => o.table_name || o.order_code).join(' · ') : 'Ninguna por ahora',
      icon: LayoutGrid,
      tone: 'neutral',
      to: '/salas',
    })
    if (d.kitchen) {
      tiles.push({
        key: 'ready',
        label: 'Listos para servir',
        value: String(ready),
        hint: ready ? 'Platos que ya salieron de cocina' : 'Nada listo todavía',
        icon: ChefHat,
        tone: ready ? 'alert' : 'neutral',
        to: '/comandas',
      })
    }
    if (mine.length > myTables.length) {
      tiles.push({ key: 'other', label: 'Otros pedidos', value: String(mine.length - myTables.length), hint: 'Para llevar / delivery', icon: Receipt, tone: 'neutral', to: '/comandas' })
    }
  }

  if (role === 'cook') {
    const pend = kCount('pendiente')
    tiles.push({ key: 'pending', label: 'Por preparar', value: String(pend), hint: pend ? 'Esperando que las tomes' : 'Sin pendientes', icon: Clock, tone: pend ? 'alert' : 'neutral', to: '/comandas' })
    tiles.push({ key: 'cooking', label: 'En preparación', value: String(kCount('preparacion')), icon: ChefHat, tone: 'neutral', to: '/comandas' })
    tiles.push({ key: 'ready', label: 'Listos', value: String(kCount('lista')), hint: 'Esperando entrega', icon: ChefHat, tone: 'good', to: '/comandas' })
  }

  if (role === 'driver') {
    const deliveries = orders.filter((o) => o.order_type === 'delivery')
    const onWay = deliveries.filter((o) => o.order_status === 'on_the_way').length
    tiles.push({ key: 'deliv', label: 'Deliveries abiertos', value: String(deliveries.length), icon: Bike, tone: deliveries.length ? 'warn' : 'neutral', to: '/repartidores' })
    tiles.push({ key: 'way', label: 'En camino', value: String(onWay), icon: Bike, tone: 'neutral', to: '/repartidores' })
    tiles.push({ key: 'ready', label: 'Listos para recoger', value: String(deliveries.filter((o) => o.order_status === 'ready').length), icon: ChefHat, tone: 'good', to: '/repartidores' })
  }

  if (role === 'admin') {
    if (d.openCashes) {
      const total = d.openCashes.reduce((s, c) => s + (Number(c.current_balance) || 0), 0)
      tiles.push({
        key: 'cashes',
        label: 'Cajas abiertas',
        value: String(d.openCashes.length),
        hint: d.openCashes.length ? `${formatMoney(total)} en caja · ${d.openCashes.map((c) => c.user_name).slice(0, 2).join(', ')}` : 'Ninguna caja abierta',
        icon: Wallet,
        tone: d.openCashes.length ? 'good' : 'warn',
        to: '/caja',
      })
    }
    if (d.orders) {
      const tables = orders.filter((o) => o.order_type === 'dine_in').length
      tiles.push({ key: 'orders', label: 'Pedidos abiertos', value: String(orders.length), hint: plural(tables, 'mesa ocupada', 'mesas ocupadas'), icon: Users, tone: 'neutral', to: '/salas' })
    }
    if (d.kitchen) {
      const pend = kCount('pendiente')
      tiles.push({ key: 'kitchen', label: 'Cocina', value: String(pend + kCount('preparacion')), hint: `${pend} por preparar · ${kCount('lista')} listos`, icon: ChefHat, tone: pend > 5 ? 'alert' : 'neutral', to: '/comandas' })
    }
  }

  return tiles
}
