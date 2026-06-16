import { useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet, Search } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryService, type StockMovement } from '@/services/inventory.service'
import { exportTableToPdf } from '@/utils/exportPdf'
import { exportTableToExcel } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportPdf'
import { getTodayPeru } from '@/utils/datesPeru'
import { useBranch } from '@/contexts/BranchContext'
import { useInventoryAccess } from '@/hooks/useInventoryAccess'
import { useReportCatalogs } from '@/reports/hooks/useReportCatalogs'

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

const getCurrentMonthRange = () => {
  const today = getTodayPeru()
  const [year, month] = today.split('-')
  return { from: `${year}-${month}-01`, to: today }
}

function fmtMovementType(t: unknown): string {
  const k = String(t || '').toLowerCase()
  const map: Record<string, string> = {
    in: 'Entrada',
    out: 'Salida',
    adjustment_in: 'Ajuste (+)',
    adjustment_out: 'Ajuste (−)',
    adjustment: 'Ajuste',
    transfer: 'Transferencia',
  }
  return map[k] || String(t || '')
}

function entryQty(row: StockMovement): string {
  const t = String(row.type || '').toLowerCase()
  if (t === 'in' || t === 'adjustment_in') {
    return Number(row.quantity).toLocaleString('es-PE', { maximumFractionDigits: 3 })
  }
  return ''
}

function outQty(row: StockMovement): string {
  const t = String(row.type || '').toLowerCase()
  if (t === 'out' || t === 'adjustment_out') {
    return Number(row.quantity).toLocaleString('es-PE', { maximumFractionDigits: 3 })
  }
  return ''
}

type Row = StockMovement

const COLS: ExportColumn<Row>[] = [
  {
    key: 'created_at',
    label: 'Fecha',
    format: (v: unknown) =>
      v
        ? new Date(String(v)).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
        : '',
  },
  { key: 'product_name', label: 'Producto' },
  { key: 'type', label: 'Tipo', format: (v: unknown) => fmtMovementType(v) },
  { key: 'reference', label: 'Referencia' },
  {
    key: 'entrada',
    label: 'Entrada',
    format: (_v: unknown, row?: Row) => (row ? entryQty(row) : ''),
  },
  {
    key: 'salida',
    label: 'Salida',
    format: (_v: unknown, row?: Row) => (row ? outQty(row) : ''),
  },
  {
    key: 'balance',
    label: 'Saldo',
    format: (v: unknown) =>
      v != null ? Number(v).toLocaleString('es-PE', { maximumFractionDigits: 3 }) : '',
  },
  { key: 'user_name', label: 'Usuario' },
  { key: 'notes', label: 'Observación' },
]

const MOVEMENT_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'purchase_in', label: 'Entrada por compra' },
  { value: 'sale_out', label: 'Salida por venta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'adjustment', label: 'Ajuste de inventario' },
  { value: 'in', label: 'Todas las entradas' },
  { value: 'out', label: 'Todas las salidas' },
]

export default function KardexReportView() {
  const canAccess = useInventoryAccess()
  const { activeBranchId } = useBranch()
  const { catalogs } = useReportCatalogs()
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const currentMonthRange = getCurrentMonthRange()
  const [filters, setFilters] = useState({
    product_q: '',
    category_id: '' as number | '',
    branch_id: '' as number | '',
    movement_kind: '',
    ref_notes_q: '',
    date_from: currentMonthRange.from,
    date_to: currentMonthRange.to,
  })
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!canAccess) return
    void load()
  }, [
    canAccess,
    filters.product_q,
    filters.category_id,
    filters.branch_id,
    filters.movement_kind,
    filters.ref_notes_q,
    filters.date_from,
    filters.date_to,
    page,
    perPage,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    filters.product_q,
    filters.category_id,
    filters.branch_id,
    filters.movement_kind,
    filters.ref_notes_q,
    filters.date_from,
    filters.date_to,
  ])

  const buildParams = (pageNum: number, pageSize: number) => {
    const params: Parameters<typeof inventoryService.listMovements>[0] = {
      page: pageNum,
      per_page: pageSize,
      restaurant_only: true,
    }
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    if (filters.branch_id) params.branch_id = Number(filters.branch_id)
    else if (activeBranchId > 0) params.branch_id = activeBranchId
    if (filters.product_q.trim()) params.product_q = filters.product_q.trim()
    if (filters.category_id) params.category_id = Number(filters.category_id)
    if (filters.movement_kind) params.movement_kind = filters.movement_kind
    if (filters.ref_notes_q.trim()) params.q = filters.ref_notes_q.trim()
    return params
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data: list, total: t } = await inventoryService.listMovements(buildParams(page, perPage))
      setData(Array.isArray(list) ? list : [])
      setTotal(Number(t) || 0)
    } catch {
      toast.error('Error al cargar kardex')
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllForExport = async (): Promise<Row[]> => {
    const { data: list } = await inventoryService.listMovements(buildParams(1, 10000))
    return Array.isArray(list) ? list : []
  }

  const exportPdf = async () => {
    try {
      const rows = await fetchAllForExport()
      if (!rows.length) {
        toast.error('No hay datos para exportar')
        return
      }
      exportTableToPdf<Row>(
        'Kardex restaurante',
        COLS,
        rows,
        `kardex-restaurante-${filters.date_from || 'todo'}-${filters.date_to || 'todo'}.pdf`,
      )
      toast.success('PDF descargado')
    } catch {
      toast.error('Error al exportar')
    }
  }

  const exportExcel = async () => {
    try {
      const rows = await fetchAllForExport()
      if (!rows.length) {
        toast.error('No hay datos para exportar')
        return
      }
      await exportTableToExcel<Row>(
        'Kardex restaurante',
        COLS,
        rows,
        `kardex-restaurante-${filters.date_from || 'todo'}-${filters.date_to || 'todo'}.xlsx`,
      )
      toast.success('Excel descargado')
    } catch {
      toast.error('Error al exportar')
    }
  }

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        El kardex de inventario requiere el módulo <strong>Inventario</strong> en tu plan.
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const effectivePage = Math.min(page, totalPages)

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1">Producto</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-sm"
                placeholder="Nombre o código"
                value={filters.product_q}
                onChange={(e) => setFilters((f) => ({ ...f, product_q: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Desde</label>
            <input
              type="date"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Hasta</label>
            <input
              type="date"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Categoría</label>
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={filters.category_id}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  category_id: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">Todas</option>
              {catalogs.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {catalogs.branches.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sucursal</label>
              <select
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                value={filters.branch_id}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    branch_id: e.target.value ? Number(e.target.value) : '',
                  }))
                }
              >
                <option value="">Sucursal activa</option>
                {catalogs.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Tipo movimiento</label>
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={filters.movement_kind}
              onChange={(e) => setFilters((f) => ({ ...f, movement_kind: e.target.value }))}
            >
              {MOVEMENT_KIND_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1">Referencia u observación</label>
            <input
              type="text"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={filters.ref_notes_q}
              onChange={(e) => setFilters((f) => ({ ...f, ref_notes_q: e.target.value }))}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Solo productos restaurante con control de stock. Período por defecto: mes actual.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            <FileDown size={14} /> Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-rest-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 sticky top-0">
                  <tr>
                    {COLS.map((c) => (
                      <th
                        key={String(c.key)}
                        className="text-left px-3 py-2 text-xs font-semibold text-stone-500"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.length ? (
                    data.map((row) => (
                      <tr key={row.id} className="border-t border-stone-100">
                        {COLS.map((col) => {
                          const val = row[col.key as keyof Row]
                          const text = col.format
                            ? col.format(val, row)
                            : String(val ?? '')
                          return (
                            <td key={String(col.key)} className="px-3 py-2 align-top text-stone-800">
                              {text}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={COLS.length} className="px-4 py-8 text-center text-stone-400">
                        No hay movimientos para los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-3 py-3 bg-stone-50/80 shrink-0">
                <p className="text-sm text-stone-600">
                  {(effectivePage - 1) * perPage + 1}-{Math.min(effectivePage * perPage, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    className="border border-stone-200 rounded-lg px-2 py-1 text-sm"
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value))
                      setPage(1)
                    }}
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={effectivePage <= 1}
                    onClick={() => setPage(effectivePage - 1)}
                    className="px-3 py-1 rounded-lg border border-stone-200 text-sm disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-stone-600">
                    {effectivePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={effectivePage >= totalPages}
                    onClick={() => setPage(effectivePage + 1)}
                    className="px-3 py-1 rounded-lg border border-stone-200 text-sm disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
