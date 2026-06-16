import { productsService, type ProductReportRow } from '@/services/products.service'
import { formatSoles } from '@/utils/format'
import type { ExportColumn } from '@/utils/exportExcel'
import type { ReportFilterPanelProps, TableReportDefinition } from '@/reports/types'
import {
  ReportFilterCard,
  ReportFilterField,
  reportInputClass,
  reportSelectClass,
} from '@/components/reports/ReportFilterCard'

const PREP_AREAS = [
  { value: '', label: 'Todas' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'bar', label: 'Bar' },
  { value: 'barra', label: 'Barra' },
  { value: 'postres', label: 'Postres' },
  { value: 'otro', label: 'Otro' },
]

const COLS: ExportColumn<ProductReportRow>[] = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Producto' },
  { key: 'category_name', label: 'Categoría', format: (v) => String(v ?? '—') },
  {
    key: 'sale_price',
    label: 'Precio',
    format: (v) => formatSoles(Number(v) || 0),
    excelNumber: true,
  },
  { key: 'preparation_area', label: 'Área preparación', format: (v) => String(v ?? '—') },
  {
    key: 'created_at',
    label: 'Fecha creación',
    format: (v) =>
      v ? new Date(String(v)).toLocaleDateString('es-PE', { dateStyle: 'short' }) : '—',
  },
  {
    key: 'branch_id',
    label: 'Sucursal',
    format: (v) => (v != null && Number(v) > 0 ? String(v) : '—'),
  },
]

function NoStockFilters({ filters, onChange, catalogs, exportActions }: ReportFilterPanelProps) {
  return (
    <ReportFilterCard
      horizontal
      hint="Platos sin control de stock (no generan movimientos de inventario)."
    >
      <ReportFilterField label="Buscar" className="min-w-[10rem] flex-1 shrink-0">
        <input
          type="search"
          value={String(filters.q ?? '')}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Nombre o código…"
          className={reportInputClass + ' w-full min-w-[10rem]'}
        />
      </ReportFilterField>
      <ReportFilterField label="Categoría" className="shrink-0">
        <select
          value={String(filters.category_id ?? '')}
          onChange={(e) => onChange({ category_id: e.target.value ? Number(e.target.value) : '' })}
          className={reportSelectClass}
        >
          <option value="">Todas</option>
          {catalogs.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </ReportFilterField>
      {catalogs.branches.length > 1 && (
        <ReportFilterField label="Sucursal" className="shrink-0">
          <select
            value={String(filters.branch_id ?? '')}
            onChange={(e) => onChange({ branch_id: e.target.value ? Number(e.target.value) : '' })}
            className={reportSelectClass}
          >
            <option value="">Actual</option>
            {catalogs.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </ReportFilterField>
      )}
      <ReportFilterField label="Área preparación" className="shrink-0">
        <select
          value={String(filters.preparation_area ?? '')}
          onChange={(e) => onChange({ preparation_area: e.target.value })}
          className={reportSelectClass}
        >
          {PREP_AREAS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </ReportFilterField>
      {exportActions}
    </ReportFilterCard>
  )
}

function buildParams(
  filters: Record<string, unknown>,
  page?: number,
  perPage?: number,
) {
  const params: Parameters<typeof productsService.listReport>[0] = {
    active_only: true,
    no_manage_stock_only: true,
  }
  if (filters.q) params.q = String(filters.q)
  if (filters.category_id) params.category_id = Number(filters.category_id)
  if (filters.branch_id) params.branch_id = Number(filters.branch_id)
  if (filters.preparation_area) params.preparation_area = String(filters.preparation_area)
  if (page != null) params.page = page
  if (perPage != null) params.per_page = perPage
  return params
}

export const noStockProductsReportDefinition: TableReportDefinition<ProductReportRow> = {
  kind: 'table',
  id: 'sin-control-stock',
  path: 'sin-control-stock',
  title: 'Productos sin control de stock',
  subtitle: 'Platos que no generan movimientos de inventario.',
  paginationMode: 'server',
  defaultPerPage: 25,
  columns: COLS,
  excelColumns: COLS,
  initialFilters: () => ({
    category_id: '',
    branch_id: '',
    preparation_area: '',
    q: '',
  }),
  FilterPanel: NoStockFilters,
  fetch: async ({ page, perPage, filters }) => {
    const { data, total } = await productsService.listReport(buildParams(filters, page, perPage))
    return { rows: data, total }
  },
  fetchAllForExport: async (filters) => {
    const { data } = await productsService.listReport({ ...buildParams(filters), per_page: 10000 })
    return data
  },
}
