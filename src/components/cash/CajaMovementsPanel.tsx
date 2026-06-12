import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, FileSpreadsheet, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  cashbankService,
  type MovementChannelBlock,
  type MovementReportRow,
  type MovementsReportParams,
  type PaymentMethodRecord,
} from '@/services/cashbank.service'
import { restaurantService } from '@/services/restaurant.service'
import { exportTableToExcel } from '@/utils/exportExcel'
import { formatSoles } from '@/utils/cashMovementChannels'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'
import { MovementsChannelTable } from '@/components/cash/MovementsChannelTable'

const emptyBlock = (): MovementChannelBlock => ({
  data: [],
  total: 0,
  summary: { total_rows: 0, sum_income: 0, sum_expense: 0, net_movement: 0 },
})

type Props = {
  branchId: number
  paymentMethods: PaymentMethodRecord[]
  sessionOptions?: { id: number; label: string }[]
  restrictToUserId?: number
  /** Sesión activa de caja: por defecto se filtra igual que en Reporte (sin recorte por fechas). */
  defaultSessionId?: number | null
}

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
      {isCash && s.opening_balance != null && (
        <p className="text-xs text-stone-500">
          Monto inicial de sesión: {formatSoles(s.opening_balance)}
        </p>
      )}
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

export function CajaMovementsPanel({
  branchId,
  paymentMethods,
  sessionOptions = [],
  restrictToUserId,
  defaultSessionId = null,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`

  const [filters, setFilters] = useState({
    date_from: monthStart,
    date_to: today,
    user_id: (restrictToUserId ?? '') as number | '',
    payment_method: '',
    type: '' as '' | 'income' | 'expense',
    session_id: '' as number | '',
  })
  const [staffUsers, setStaffUsers] = useState<{ user_id: number; name: string }[]>([])
  const [cashBlock, setCashBlock] = useState<MovementChannelBlock>(emptyBlock)
  const [electronicBlock, setElectronicBlock] = useState<MovementChannelBlock>(emptyBlock)
  const [loading, setLoading] = useState(false)
  /** Cargamos todas las filas por canal; la paginación compartida vaciaba tablas con pocos registros. */
  const perPage = 0

  useEffect(() => {
    if (defaultSessionId == null) return
    setFilters((f) => {
      if (f.session_id !== '' && f.session_id !== defaultSessionId) return f
      return { ...f, session_id: defaultSessionId }
    })
  }, [defaultSessionId])

  useEffect(() => {
    if (restrictToUserId) {
      setStaffUsers([])
      return
    }
    restaurantService
      .listStaff()
      .then((list) =>
        setStaffUsers(
          (list ?? []).map((s) => ({
            user_id: s.user_id,
            name: s.display_name || `#${s.user_id}`,
          })),
        ),
      )
      .catch(() => setStaffUsers([]))
  }, [restrictToUserId])

  const paymentMethodOptions = useMemo(() => {
    const active = paymentMethods.filter((m) => m.active)
    if (active.length > 0) return active.map((m) => ({ value: m.code, label: m.name }))
    return [
      { value: 'efectivo', label: 'Efectivo' },
      { value: 'yape', label: 'Yape' },
      { value: 'plin', label: 'Plin' },
      { value: 'tarjeta', label: 'Tarjeta' },
      { value: 'transferencia', label: 'Transferencia' },
    ]
  }, [paymentMethods])

  const paymentLabel = (code?: string) => paymentMethodDisplayLabel(code, paymentMethods)

  const buildParams = useCallback(
    (opts?: { perPage?: number }): MovementsReportParams => {
      const params: MovementsReportParams = {
        branch_id: branchId,
        per_page: opts?.perPage ?? perPage,
      }
      // Con sesión activa, el backend ignora fechas (misma lógica que el reporte de cierre).
      if (!filters.session_id) {
        if (filters.date_from) params.date_from = filters.date_from
        if (filters.date_to) params.date_to = filters.date_to
      }
      if (restrictToUserId) params.user_id = restrictToUserId
      else if (filters.user_id) params.user_id = Number(filters.user_id)
      if (filters.payment_method) params.payment_method = filters.payment_method
      if (filters.type) params.type = filters.type
      if (filters.session_id) params.session_id = Number(filters.session_id)
      return params
    },
    [branchId, filters, restrictToUserId],
  )

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams())
      setCashBlock(res.cash ?? emptyBlock())
      setElectronicBlock(res.electronic ?? emptyBlock())
    } catch {
      toast.error('Error al cargar movimientos')
      setCashBlock(emptyBlock())
      setElectronicBlock(emptyBlock())
    } finally {
      setLoading(false)
    }
  }, [branchId, buildParams])

  useEffect(() => {
    void load()
  }, [load])

  const mapRowsForExcel = (rows: MovementReportRow[]) =>
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
      amount: Number(r.amount).toFixed(2),
    }))

  const exportExcel = async () => {
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams({ perPage: 0 }))
      const cols = [
        { key: 'date', label: 'Fecha' },
        { key: 'type', label: 'Tipo' },
        { key: 'category', label: 'Categoría' },
        { key: 'doc_number', label: 'Referencia' },
        { key: 'user_name', label: 'Usuario' },
        { key: 'payment_method', label: 'Método' },
        { key: 'amount', label: 'Monto' },
      ]
      await exportTableToExcel(
        'Caja física (efectivo)',
        cols,
        mapRowsForExcel(res.cash?.data ?? []),
        `movimientos-efectivo-${filters.date_from}-${filters.date_to}.xlsx`,
      )
      await exportTableToExcel(
        'Medios electrónicos',
        cols,
        mapRowsForExcel(res.electronic?.data ?? []),
        `movimientos-electronicos-${filters.date_from}-${filters.date_to}.xlsx`,
      )
      toast.success('Excel exportado (2 hojas)')
    } catch {
      toast.error('No se pudo exportar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <p className="text-xs text-stone-500">
          Movimientos operativos del turno. La caja física solo incluye efectivo; los medios electrónicos se muestran por separado.
          {filters.session_id
            ? ' Filtrando por sesión de caja (igual que en Reporte).'
            : ' Seleccione una sesión para ver el mismo detalle que en Reporte.'}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Desde</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, date_from: e.target.value }))
              }}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, date_to: e.target.value }))
              }}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          {!restrictToUserId && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Usuario</label>
              <select
                value={filters.user_id}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, user_id: e.target.value ? Number(e.target.value) : '' }))
                }}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm min-w-[140px]"
              >
                <option value="">Todos</option>
                {staffUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Medio de pago</label>
            <select
              value={filters.payment_method}
              onChange={(e) => {
                setFilters((f) => ({ ...f, payment_method: e.target.value }))
              }}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm min-w-[130px]"
            >
              <option value="">Todos</option>
              {paymentMethodOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Tipo</label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters((f) => ({ ...f, type: e.target.value as '' | 'income' | 'expense' }))
              }}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Egresos</option>
            </select>
          </div>
          {sessionOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sesión</label>
              <select
                value={filters.session_id}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, session_id: e.target.value ? Number(e.target.value) : '' }))
                }}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm min-w-[160px]"
              >
                <option value="">Todas</option>
                {sessionOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Search size={15} />
            Buscar
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={loading}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm font-medium hover:bg-stone-50 flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>
        </div>
      </div>

      <ChannelSummaryCards
        title="Caja física (efectivo)"
        icon={Banknote}
        accent="border-green-200 bg-green-50/30"
        block={cashBlock}
        isCash
        paymentMethods={paymentMethods}
      />

      <div className="bg-white rounded-2xl border border-green-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-green-100 bg-green-50/50">
          <p className="text-sm font-semibold text-stone-800">Movimientos de efectivo</p>
          <p className="text-xs text-stone-500">Ventas en efectivo, ingresos/egresos manuales y gastos de caja</p>
        </div>
        <MovementsChannelTable
          rows={cashBlock.data}
          paymentMethods={paymentMethods}
          loading={loading}
          emptyMessage="Sin movimientos de efectivo con estos filtros"
        />
      </div>

      <ChannelSummaryCards
        title="Medios electrónicos"
        icon={CreditCard}
        accent="border-blue-200 bg-blue-50/30"
        block={electronicBlock}
        isCash={false}
        paymentMethods={paymentMethods}
      />

      <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/50">
          <p className="text-sm font-semibold text-blue-900">Ventas por medios electrónicos</p>
          <p className="text-xs text-stone-500">Yape, Plin, tarjeta, transferencia y otros (no afectan el arqueo de efectivo)</p>
        </div>
        <MovementsChannelTable
          rows={electronicBlock.data}
          paymentMethods={paymentMethods}
          loading={loading}
          emptyMessage="Sin ventas electrónicas con estos filtros"
        />
      </div>

    </div>
  )
}
