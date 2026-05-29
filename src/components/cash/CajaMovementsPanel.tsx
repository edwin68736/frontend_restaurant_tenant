import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  cashbankService,
  type MovementReportRow,
  type MovementReportSummary,
  type MovementsReportParams,
  type PaymentMethodRecord,
} from '@/services/cashbank.service'
import { restaurantService } from '@/services/restaurant.service'
import { exportTableToExcel } from '@/utils/exportExcel'
import { movementFlowBadgeClass, movementFlowLabel, movementSubtypeLabel } from '@/utils/cashMovementDisplay'

const emptySummary = (): MovementReportSummary => ({
  total_rows: 0,
  sum_income: 0,
  sum_expense: 0,
  net_movement: 0,
})

type Props = {
  branchId: number
  paymentMethods: PaymentMethodRecord[]
  sessionOptions?: { id: number; label: string }[]
  /** Si se define, el reporte solo incluye movimientos de ese usuario (cajero). */
  restrictToUserId?: number
}

export function CajaMovementsPanel({
  branchId,
  paymentMethods,
  sessionOptions = [],
  restrictToUserId,
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
  const [rows, setRows] = useState<MovementReportRow[]>([])
  const [summary, setSummary] = useState<MovementReportSummary>(emptySummary())
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 25

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

  const paymentLabel = (code?: string) => {
    const v = (code || '').trim()
    const found = paymentMethodOptions.find((m) => m.value === v)
    return found?.label ?? (v || 'Efectivo')
  }

  const buildParams = useCallback(
    (opts?: { page?: number; perPage?: number }): MovementsReportParams => {
      const params: MovementsReportParams = {
        branch_id: branchId,
        page: opts?.page ?? page,
        per_page: opts?.perPage ?? perPage,
      }
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      if (restrictToUserId) params.user_id = restrictToUserId
      else if (filters.user_id) params.user_id = Number(filters.user_id)
      if (filters.payment_method) params.payment_method = filters.payment_method
      if (filters.type) params.type = filters.type
      if (filters.session_id) params.session_id = Number(filters.session_id)
      return params
    },
    [branchId, filters, page, restrictToUserId],
  )

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams())
      setRows(res.data ?? [])
      setTotal(res.total ?? 0)
      setSummary(res.summary ?? emptySummary())
    } catch {
      toast.error('Error al cargar movimientos')
      setRows([])
      setTotal(0)
      setSummary(emptySummary())
    } finally {
      setLoading(false)
    }
  }, [branchId, buildParams])

  useEffect(() => {
    void load()
  }, [load])

  const exportExcel = async () => {
    setLoading(true)
    try {
      const res = await cashbankService.listMovementsReport(buildParams({ page: 1, perPage: 0 }))
      const data = res.data ?? []
      await exportTableToExcel(
        'Movimientos de caja',
        [
          { key: 'date', label: 'Fecha' },
          { key: 'type', label: 'Tipo' },
          { key: 'category', label: 'Categoría' },
          { key: 'doc_number', label: 'Referencia' },
          { key: 'user_name', label: 'Usuario' },
          { key: 'payment_method', label: 'Método' },
          { key: 'amount', label: 'Monto' },
          { key: 'notes_detail', label: 'Notas' },
        ],
        data.map((r) => ({
          ...r,
          date: r.date ? new Date(r.date).toLocaleString() : '',
          type: r.type === 'income' || r.type === 'ingreso' ? 'Ingreso' : r.type === 'expense' || r.type === 'egreso' ? 'Egreso' : r.type,
          payment_method: paymentLabel(r.payment_method),
          amount: Number(r.amount).toFixed(2),
        })),
        `movimientos-caja-${filters.date_from}-${filters.date_to}.xlsx`,
      )
      toast.success('Excel exportado')
    } catch {
      toast.error('No se pudo exportar')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Desde</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => {
                setPage(1)
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
                setPage(1)
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
                  setPage(1)
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
                setPage(1)
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
                setPage(1)
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
                  setPage(1)
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Registros', value: String(summary.total_rows) },
            { label: 'Ingresos', value: `S/ ${summary.sum_income.toFixed(2)}`, cls: 'text-green-700' },
            { label: 'Egresos', value: `S/ ${summary.sum_expense.toFixed(2)}`, cls: 'text-red-600' },
            { label: 'Neto', value: `S/ ${summary.net_movement.toFixed(2)}` },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2">
              <p className="text-[10px] uppercase text-stone-500 font-semibold">{k.label}</p>
              <p className={`text-sm font-bold tabular-nums ${k.cls ?? 'text-stone-800'}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-stone-50">
              <tr>
                {['Fecha', 'Tipo', 'Categoría', 'Referencia', 'Usuario', 'Método', 'Monto'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                    Sin movimientos con estos filtros
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.movement_id} className="border-b border-stone-100">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {m.date ? new Date(m.date).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${movementFlowBadgeClass(m.type)}`}
                      >
                        {movementFlowLabel(m.type)}
                      </span>
                      {(m.type === 'venta' || m.type === 'compra' || m.type === 'anulacion_venta') && (
                        <span className="block text-[10px] text-stone-500 mt-0.5">{movementSubtypeLabel(m.type)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-stone-600">{m.category || '—'}</td>
                    <td className="px-4 py-2 text-stone-700">{m.doc_number || m.cash_reference || '—'}</td>
                    <td className="px-4 py-2 text-stone-600">{m.user_name || '—'}</td>
                    <td className="px-4 py-2 text-stone-600">{paymentLabel(m.payment_method)}</td>
                    <td className="px-4 py-2 font-semibold tabular-nums whitespace-nowrap">
                      S/ {Number(m.amount).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 text-sm">
            <span className="text-stone-500">
              Página {page} de {totalPages} ({total} registros)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-stone-200 rounded-lg disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-stone-200 rounded-lg disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
