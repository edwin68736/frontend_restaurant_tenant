import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CreditCard, Receipt, ShoppingBag, TrendingUp } from 'lucide-react'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import { restaurantDashboardService, type RestaurantDashboardData } from '@/services/restaurantDashboard.service'
import { getTodayPeru } from '@/utils/datesPeru'
import { formatMoney } from '@/utils/format'
import { TileGrid, type Tile, type TurnoRole } from './MiTurnoBlock'

const REFRESH_MS = 60_000

/** Quién ve el resumen: administración (toda la sucursal) y quien cobra (solo lo suyo). */
export function showsResumenHoy(role: TurnoRole): boolean {
  return role === 'admin' || role === 'cashier' || role === 'other'
}

function buildTiles(role: TurnoRole, d: RestaurantDashboardData): Tile[] {
  const s = d.summary
  const link = role === 'admin' ? '/dashboard' : '/ventas'
  const tiles: Tile[] = [
    {
      key: 'sales',
      label: 'Ventas de hoy',
      value: formatMoney(Number(s.total_sales) || 0),
      hint: role === 'admin' ? 'Toda la sucursal' : 'Lo que has cobrado hoy',
      icon: TrendingUp,
      tone: 'good',
      to: link,
    },
    {
      key: 'orders',
      label: 'Pedidos cobrados',
      value: String(Number(s.total_orders) || 0),
      hint: Number(s.total_orders) ? undefined : 'Aún sin ventas hoy',
      icon: Receipt,
      tone: 'neutral',
      to: link,
    },
  ]
  if (role === 'admin') {
    tiles.push({
      key: 'avg',
      label: 'Ticket promedio',
      value: formatMoney(Number(s.average_ticket) || 0),
      icon: ShoppingBag,
      tone: 'neutral',
      to: link,
    })
    const methods = [...(d.sales_by_payment_method ?? [])].sort((a, b) => b.total - a.total)
    // Solo montos positivos: el desglose puede traer filas negativas (devoluciones/otros) que
    // descuadrarían el porcentaje (daba más de 100%).
    const sum = methods.reduce((acc, m) => acc + Math.max(Number(m.total) || 0, 0), 0)
    const top = methods[0]
    if (top && sum > 0) {
      tiles.push({
        key: 'pay',
        label: 'Pago principal',
        value: top.label || top.method,
        hint: `${Math.min(100, Math.round(((Number(top.total) || 0) / sum) * 100))}% de lo cobrado`,
        icon: CreditCard,
        tone: 'neutral',
        to: link,
      })
    }
  }
  return tiles
}

/** Resumen de ventas del día. Usa el mismo endpoint del Dashboard, que ya acota a cada cajero. */
export function ResumenHoyBlock({ role }: { role: TurnoRole }) {
  const { activeBranchId } = useBranch()
  const [data, setData] = useState<RestaurantDashboardData | null>(null)

  const load = useCallback(async () => {
    try {
      const today = getTodayPeru()
      setData(await restaurantDashboardService.get({ start_date: today, end_date: today, top_n: 1 }))
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load, activeBranchId])

  useOnBranchChange(() => setData(null))

  // Sin permiso o sin respuesta: no se muestra (ni error ni hueco).
  if (!data) return null

  return (
    <section aria-label="Resumen de hoy">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Resumen de hoy</h3>
        <Link
          to={role === 'admin' ? '/dashboard' : '/ventas'}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-100"
        >
          <BarChart3 size={12} />
          {role === 'admin' ? 'Ver dashboard' : 'Ver ventas'}
        </Link>
      </div>
      <TileGrid tiles={buildTiles(role, data)} />
    </section>
  )
}
