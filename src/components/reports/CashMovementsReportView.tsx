import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard } from 'lucide-react'
import { ReportExportBar } from '@/components/reports/ReportExportBar'
import { toast } from 'sonner'
import {
  cashbankService,
  type MovementChannelBlock,
  type MovementReportRow,
  type MovementsReportParams,
  type PaymentMethodRecord,
} from '@/services/cashbank.service'
import { useBranch } from '@/contexts/BranchContext'
import { useReportCatalogs } from '@/reports/hooks/useReportCatalogs'
import { exportTableToExcel } from '@/utils/exportExcel'
import { exportTableToPdf } from '@/utils/exportPdf'
import type { ExportColumn } from '@/utils/exportExcel'
import { formatSoles } from '@/utils/cashMovementChannels'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'
import { getCurrentMonthRange } from '@/utils/datesPeru'
import { MovementsChannelTable } from '@/components/cash/MovementsChannelTable'
import {
  ReportFilterCard,
  ReportFilterField,
  reportInputClass,
  reportSelectClass,
} from '@/components/reports/ReportFilterCard'

const emptyBlock = (): MovementChannelBlock => ({
  data: [],
  total: 0,
  summary: { total_rows: 0, sum_income: 0, sum_expense: 0, net_movement: 0 },
})

const EXPORT_COLS: ExportColumn<MovementReportRow>[] = [
  { key: 'date', label: 'Fecha', format: (v) => (v ? new Date(String(v)).toLocaleString() : '') },
  { key: 'type', label: 'Tipo' },
  { key: 'category', label: 'Categoría' },
  { key: 'doc_number', label: 'Referencia' },
  { key: 'user_name', label: 'Usuario' },
  { key: 'payment_method', label: 'Método' },
  { key: 'amount', label: 'Monto', format: (v) => Number(v).toFixed(2), excelNumber: true },
]

function ChannelSummaryCards({
  title,
  icon: Icon,
  accent,
  block,
  isCash,
  paymentMethods,
}: {
  title: string
  icon: typeof Banknote
  accent: string
  block: MovementChannelBlock
  isCash: boolean
  paymentMethods: PaymentMethodRecord[]
}) {
  const s = block.summary
  const pmLabel = (code: string) => paymentMethodDisplayLabel(code, paymentMethods)

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${accent}`}>
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-stone-600" />
        <p className="text-sm font-semibold text-stone-800">{title}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Registros', value: String(s.total_rows) },
          { label: 'Ingresos', value: formatSoles(s.sum_income), cls: 'text-green-700' },
          { label: 'Egresos', value: formatSoles(s.sum_expense), cls: 'text-red-600' },
          {
            label: isCash ? 'Saldo físico' : 'Neto ventas',
            value: formatSoles(
              isCash && s.physical_balance != null ? s.physical_balance : s.net_movement,
            ),
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-white/80 bg-white/70 px-3 py-2">
            <p className="text-[10px] uppercase text-stone-500 font-semibold">{k.label}</p>
            <p className={`text-sm font-bold tabular-nums ${k.cls ?? 'text-stone-800'}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {(s.sales_by_method?.length ?? 0) > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {s.sales_by_method!.map((x) => (
            <li key={x.method} className="flex justify-between gap-2">
              <span className="text-stone-600">{pmLabel(x.method)}</span>
              <span className="font-semibold tabular-nums">{formatSoles(x.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CashMovementsReportView() {
  const { activeBranchId } = useBranch()
  const { catalogs } = useReportCatalogs(true)
  const { from, to } = getCurrentMonthRange()

  const [filters, setFilters] = useState({
    date_from: from,
    date_to: to,
    user_id: '' as number | '',
    payment_method: '',
    type: '' as '' | 'income' | 'expense',
    session_id: '' as number | '',
  })
  const [cashBlock, setCashBlock] = useState<MovementChannelBlock>(emptyBlock)
  const [electronicBlock, setElectronicBlock] = useState<MovementChannelBlock>(emptyBlock)
  const [loading, setLoading] = useState(false)

  const paymentMethods = catalogs.paymentMethods

  const paymentMethodOptions = useMemo(() => {
    const active = paymentMethods.filter((m) => m.active)
    if (active.length > 0) return active.map((m) => ({ value: m.code, label: m.name }))
    return [
      { value: 'efectivo', label: 'Efectivo' },
      { value: 'yape', label: 'Yape' },
      { value: 'plin', label: 'Plin' },
      { value: 'tarjeta', label: 'Tarjeta' },
    ]
  }, [paymentMethods])

  const paymentLabel = (code?: string) => paymentMethodDisplayLabel(code, paymentMethods)

  const buildParams = useCallback(
    (perPage = 0): MovementsReportParams => {
      const params: MovementsReportParams = {
        branch_id: activeBranchId,
        per_page: perPage,
      }
      if (!filters.session_id) {
        if (filters.date_from) params.date_from = filters.date_from
        if (filters.date_to) params.date_to = filters.date_to
      }
      if (filters.user_id) params.user_id = Number(filters.user_id)
      if (filters.payment_method) params.payment_method = filters.payment_method
      if (filters.type) params.type = filters.type
      if (filters.session_id) params.session_id = Number(filters.session_id)
      return params
    },
    [activeBranchId, filters],
  )

  const load = useCallback(async () => {
    if (!activeBranchId) return
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams(0))
      setCashBlock(res.cash ?? emptyBlock())
      setElectronicBlock(res.electronic ?? emptyBlock())
    } catch {
      toast.error('Error al cargar movimientos')
      setCashBlock(emptyBlock())
      setElectronicBlock(emptyBlock())
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, buildParams])

  useEffect(() => {
    void load()
  }, [load])

  const mapRowsForExport = (rows: MovementReportRow[]) =>
    rows.map((r) => ({
      ...r,
      date: r.date ? new Date(r.date).toLocaleString() : '',
      type:
        r.type === 'income' || r.type === 'ingreso'
          ? 'Ingreso'
          : r.type === 'expense' || r.type === 'egreso'
            ? 'Egreso'
            : r.type,
      payment_method: paymentLabel(r.payment_method),
    }))

  const exportExcel = async () => {
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams(0))
      await exportTableToExcel(
        'Caja física (efectivo)',
        EXPORT_COLS,
        mapRowsForExport(res.cash?.data ?? []),
        `movimientos-efectivo-${filters.date_from}-${filters.date_to}.xlsx`,
      )
      await exportTableToExcel(
        'Medios electrónicos',
        EXPORT_COLS,
        mapRowsForExport(res.electronic?.data ?? []),
        `movimientos-electronicos-${filters.date_from}-${filters.date_to}.xlsx`,
      )
      toast.success('Excel exportado (2 archivos)')
    } catch {
      toast.error('No se pudo exportar Excel')
    } finally {
      setLoading(false)
    }
  }

  const exportPdf = async () => {
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams(0))
      exportTableToPdf(
        'Movimientos efectivo',
        EXPORT_COLS,
        mapRowsForExport(res.cash?.data ?? []),
        `movimientos-efectivo-${filters.date_from}.pdf`,
      )
      exportTableToPdf(
        'Movimientos electrónicos',
        EXPORT_COLS,
        mapRowsForExport(res.electronic?.data ?? []),
        `movimientos-electronicos-${filters.date_from}.pdf`,
      )
      toast.success('PDF exportado (2 archivos)')
    } catch {
      toast.error('No se pudo exportar PDF')
    } finally {
      setLoading(false)
    }
  }

  const exportActions = (
    <ReportExportBar
      loading={loading}
      onExportPdf={() => void exportPdf()}
      onExportExcel={() => void exportExcel()}
    />
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <ReportFilterCard hint="Con sesión de caja seleccionada, las fechas se ignoran (misma lógica que reporte de cierre).">
        <ReportFilterField label="Desde">
          <input
            type="date"
            value={filters.date_from}
            disabled={!!filters.session_id}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className={reportInputClass}
          />
        </ReportFilterField>
        <ReportFilterField label="Hasta">
          <input
            type="date"
            value={filters.date_to}
            disabled={!!filters.session_id}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className={reportInputClass}
          />
        </ReportFilterField>
        <ReportFilterField label="Usuario">
          <select
            value={filters.user_id}
            onChange={(e) =>
              setFilters((f) => ({ ...f, user_id: e.target.value ? Number(e.target.value) : '' }))
            }
            className={reportSelectClass}
          >
            <option value="">Todos</option>
            {catalogs.staffUsers.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}</option>
            ))}
          </select>
        </ReportFilterField>
        <ReportFilterField label="Medio de pago">
          <select
            value={filters.payment_method}
            onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
            className={reportSelectClass}
          >
            <option value="">Todos</option>
            {paymentMethodOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </ReportFilterField>
        <ReportFilterField label="Tipo">
          <select
            value={filters.type}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                type: e.target.value as '' | 'income' | 'expense',
              }))
            }
            className={reportSelectClass}
          >
            <option value="">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Egresos</option>
          </select>
        </ReportFilterField>
        {exportActions}
      </ReportFilterCard>

      <ChannelSummaryCards
        title="Caja física (efectivo)"
        icon={Banknote}
        accent="border-amber-200 bg-amber-50/50"
        block={cashBlock}
        isCash
        paymentMethods={paymentMethods}
      />
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <MovementsChannelTable
          rows={cashBlock.data}
          paymentMethods={paymentMethods}
          loading={loading}
          emptyMessage="Sin movimientos de efectivo"
        />
      </div>

      <ChannelSummaryCards
        title="Medios electrónicos"
        icon={CreditCard}
        accent="border-sky-200 bg-sky-50/50"
        block={electronicBlock}
        isCash={false}
        paymentMethods={paymentMethods}
      />
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <MovementsChannelTable
          rows={electronicBlock.data}
          paymentMethods={paymentMethods}
          loading={loading}
          emptyMessage="Sin movimientos electrónicos"
        />
      </div>
    </div>
  )
}
