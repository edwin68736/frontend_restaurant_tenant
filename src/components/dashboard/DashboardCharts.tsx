import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  DashboardCategoryRow,
  DashboardDayRow,
  DashboardHourRow,
  DashboardPaymentRow,
  DashboardStatusRow,
  DashboardTablesSummary,
} from '@/services/restaurantDashboard.service'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { DashboardEmpty } from '@/components/dashboard/DashboardEmpty'
import { CHART_COLORS, chartTooltipStyle } from '@/components/dashboard/chartTheme'
import { formatSoles } from '@/utils/format'
import { formatDisplayDate } from '@/utils/datesPeru'

export function StatusDonutChart({ rows }: { rows: DashboardStatusRow[] }) {
  if (!rows.length) return <DashboardEmpty />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="count"
          nameKey="label"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function PaymentPieChart({ rows }: { rows: DashboardPaymentRow[] }) {
  if (!rows.length) return <DashboardEmpty />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={rows} dataKey="total" nameKey="label" outerRadius={95} paddingAngle={2}>
          {rows.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={chartTooltipStyle}
          formatter={(v: number) => formatSoles(v)}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function CategoriesBarChart({ rows }: { rows: DashboardCategoryRow[] }) {
  if (!rows.length) return <DashboardEmpty />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
        <XAxis
          dataKey="category_name"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={70}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={chartTooltipStyle}
          formatter={(v: number, name: string) =>
            name === 'total_amount' ? formatSoles(v) : v.toLocaleString('es-PE')
          }
        />
        <Legend />
        <Bar dataKey="quantity_sold" name="Cantidad" fill="#16a34a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="total_amount" name="Monto (S/)" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function trendStats(rows: DashboardDayRow[]) {
  const withSales = rows.filter((r) => r.total > 0)
  if (!withSales.length) {
    return { avg: 0, best: null as DashboardDayRow | null, worst: null as DashboardDayRow | null }
  }
  const total = rows.reduce((s, r) => s + r.total, 0)
  const avg = total / rows.length
  let best = withSales[0]
  let worst = withSales[0]
  for (const r of withSales) {
    if (r.total > best.total) best = r
    if (r.total < worst.total) worst = r
  }
  return { avg, best, worst }
}

export function TrendLineChart({ rows }: { rows: DashboardDayRow[] }) {
  const stats = trendStats(rows)
  const chartData = rows.map((r) => ({
    ...r,
    label: formatDisplayDate(r.day),
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
          <p className="text-[10px] uppercase font-semibold text-stone-500">Promedio diario</p>
          <p className="text-sm font-bold tabular-nums">{formatSoles(stats.avg)}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2">
          <p className="text-[10px] uppercase font-semibold text-green-700">Mejor día</p>
          <p className="text-sm font-bold tabular-nums text-green-800">
            {stats.best ? `${formatDisplayDate(stats.best.day)} · ${formatSoles(stats.best.total)}` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
          <p className="text-[10px] uppercase font-semibold text-amber-700">Peor día</p>
          <p className="text-sm font-bold tabular-nums text-amber-900">
            {stats.worst ? `${formatDisplayDate(stats.worst.day)} · ${formatSoles(stats.worst.total)}` : '—'}
          </p>
        </div>
      </div>
      {!rows.some((r) => r.total > 0) ? (
        <DashboardEmpty message="Sin ventas en los últimos 30 días" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v: number) => formatSoles(v)}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Ventas"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function HourDemandChart({ rows }: { rows: DashboardHourRow[] }) {
  if (!rows.some((r) => r.orders > 0)) return <DashboardEmpty message="Sin pedidos en el periodo" />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Bar dataKey="orders" name="Pedidos" fill="#0d9488" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TablesSummaryCards({ summary }: { summary: DashboardTablesSummary }) {
  if (!summary.enabled) return null
  const cards = [
    { label: 'Mesas ocupadas', value: summary.occupied, cls: 'border-amber-200 bg-amber-50 text-amber-800' },
    { label: 'Mesas libres', value: summary.free, cls: 'border-green-200 bg-green-50 text-green-800' },
    { label: 'Reservadas', value: summary.reserved, cls: 'border-sky-200 bg-sky-50 text-sky-800' },
    { label: 'Total mesas', value: summary.total, cls: 'border-stone-200 bg-stone-50 text-stone-800' },
  ]
  return (
    <DashboardSection title="Resumen de mesas" subtitle="Estado actual de la sucursal">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border px-4 py-3 ${c.cls}`}>
            <p className="text-xs font-semibold uppercase opacity-80">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}

export function TopProductsTable({
  rows,
  topN,
  onTopNChange,
}: {
  rows: import('@/services/restaurantDashboard.service').DashboardProductRow[]
  topN: number
  onTopNChange: (n: number) => void
}) {
  if (!rows.length) return <DashboardEmpty />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase text-stone-500 border-b border-stone-100">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Producto</th>
            <th className="py-2 pr-3">Cantidad</th>
            <th className="py-2 pr-3">Importe</th>
            <th className="py-2">Participación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.product_id}-${r.position}`} className="border-b border-stone-50">
              <td className="py-2 pr-3 tabular-nums">{r.position}</td>
              <td className="py-2 pr-3 font-medium text-stone-800">{r.product_name}</td>
              <td className="py-2 pr-3 tabular-nums">
                {r.quantity_sold.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
              </td>
              <td className="py-2 pr-3 tabular-nums">{formatSoles(r.total_amount)}</td>
              <td className="py-2 tabular-nums">{r.participation_pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-stone-500">Mostrar</label>
        <select
          value={topN}
          onChange={(e) => onTopNChange(Number(e.target.value))}
          className="border border-stone-200 rounded-lg px-2 py-1 text-sm bg-white"
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>Top {n}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
