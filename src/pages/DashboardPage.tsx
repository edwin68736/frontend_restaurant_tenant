import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageShell } from '@/components/layout/PageShell'
import { DashboardKpiGrid } from '@/components/dashboard/DashboardKpiGrid'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import {
  CategoriesBarChart,
  HourDemandChart,
  PaymentPieChart,
  StatusDonutChart,
  TablesSummaryCards,
  TopProductsTable,
  TrendLineChart,
} from '@/components/dashboard/DashboardCharts'
import {
  restaurantDashboardService,
  type RestaurantDashboardData,
} from '@/services/restaurantDashboard.service'
import { getTodayPeru } from '@/utils/datesPeru'
import { reportInputClass } from '@/components/reports/ReportFilterCard'
import { useAuth } from '@/contexts/AuthContext'

const today = () => getTodayPeru()

function isDashboardBranchView(employeeType: string, permissions: string[]): boolean {
  if (permissions.includes('s.m')) return true
  const et = employeeType.toLowerCase()
  return et === 'admin' || et === 'supervisor'
}

export default function DashboardPage() {
  const { employeeType, restaurantPermissions } = useAuth()
  const branchView = isDashboardBranchView(employeeType, restaurantPermissions)
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [appliedRange, setAppliedRange] = useState({ start: today(), end: today() })
  const [topN, setTopN] = useState(10)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RestaurantDashboardData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await restaurantDashboardService.get({
        start_date: appliedRange.start,
        end_date: appliedRange.end,
        top_n: topN,
      })
      setData(result)
    } catch {
      toast.error('No se pudo cargar el dashboard')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [appliedRange, topN])

  useEffect(() => {
    void load()
  }, [load])

  const applyFilters = () => {
    if (endDate < startDate) {
      toast.error('La fecha fin debe ser mayor o igual a la fecha inicio')
      return
    }
    setAppliedRange({ start: startDate, end: endDate })
  }

  const clearFilters = () => {
    const t = today()
    setStartDate(t)
    setEndDate(t)
    setAppliedRange({ start: t, end: t })
  }

  return (
    <PageShell
      title="Dashboard"
      subtitle={
        data?.scoped_to_user || (!branchView && !data)
          ? 'Tus ventas y pedidos en el periodo seleccionado'
          : 'Métricas operativas y ventas de la sucursal'
      }
      actions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      }
      fill
    >
      <div className="space-y-4 pb-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={reportInputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Fecha fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={reportInputClass}
            />
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-rest-600 text-white hover:bg-rest-700"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-stone-200 hover:bg-stone-50"
          >
            Limpiar
          </button>
          <p className="text-xs text-stone-500 ml-auto">
            Periodo activo: {appliedRange.start} → {appliedRange.end}
            {(data?.scoped_to_user || !branchView) && (
              <span className="block sm:inline sm:ml-2 text-rest-700 font-medium">
                · Solo tus operaciones
              </span>
            )}
          </p>
        </div>

        {loading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <div className="space-y-4">
            <DashboardKpiGrid summary={data.summary} />

            <div className="grid lg:grid-cols-2 gap-4">
              <DashboardSection title="Ventas por estado" subtitle="Pedidos en el periodo">
                <StatusDonutChart rows={data.sales_by_status} />
              </DashboardSection>
              <DashboardSection title="Ventas por método de pago">
                <PaymentPieChart rows={data.sales_by_payment_method} />
              </DashboardSection>
            </div>

            <DashboardSection
              title="Top platos más vendidos"
              subtitle="Ranking por cantidad vendida"
            >
              <TopProductsTable
                rows={data.top_products}
                topN={topN}
                onTopNChange={(n) => setTopN(n)}
              />
            </DashboardSection>

            <DashboardSection title="Categorías más vendidas">
              <CategoriesBarChart rows={data.top_categories} />
            </DashboardSection>

            <DashboardSection
              title="Tendencia de ventas"
              subtitle="Últimos 30 días (independiente del filtro global)"
            >
              <TrendLineChart rows={data.sales_last_30_days} />
            </DashboardSection>

            <DashboardSection title="Horas de mayor demanda" subtitle="Pedidos por hora de apertura">
              <HourDemandChart rows={data.sales_by_hour} />
            </DashboardSection>

            <TablesSummaryCards summary={data.tables_summary} />
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
