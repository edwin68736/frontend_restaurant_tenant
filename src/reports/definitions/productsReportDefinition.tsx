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
import { ReportSummaryCard, ReportSummaryRow } from '@/components/reports/ReportSummaryCard'

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
  { key: 'name', label: 'Nombre' },
  { key: 'category_name', label: 'Categoría', format: (v) => String(v ?? '—') },
  { key: 'preparation_area', label: 'Área', format: (v) => String(v ?? '—') },
  { key: 'unit', label: 'Unidad' },
  {
    key: 'sale_price',
    label: 'Precio venta',
    format: (v) => Number(v).toFixed(2),
    excelNumber: true,
  },
  {
    key: 'stock_total',
    label: 'Stock',
    format: (v) => (v != null ? Number(v).toFixed(3) : '—'),
    excelNumber: true,
  },
  {
    key: 'active',
    label: 'Activo',
    format: (v) => (v ? 'Sí' : 'No'),
  },
]

function ProductosFilters({ filters, onChange, catalogs, exportActions }: ReportFilterPanelProps) {
  return (
    <ReportFilterCard
      horizontal
      hint="Cartá del restaurante (solo platos is_restaurant) con stock y área de preparación."
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
      <ReportFilterField label="Stock menor a" className="shrink-0">
        <input
          type="number"
          min={0}
          step="0.001"
          value={String(filters.stock_less_than ?? '')}
          onChange={(e) => onChange({ stock_less_than: e.target.value })}
          placeholder="Opcional"
          className={reportInputClass}
        />
      </ReportFilterField>
      {exportActions}
    </ReportFilterCard>
  )
}

function ProductosSummary({
  rows,
}: {
  summary: Record<string, unknown> | null
  rows: ProductReportRow[]
}) {
  const active = rows.filter((r) => r.active).length
  return (
    <ReportSummaryRow desktopCols={3}>
      <ReportSummaryCard label="Platos en listado" value={rows.length} />
      <ReportSummaryCard label="Activos (página)" value={active} />
      <ReportSummaryCard
        label="Precio promedio"
        value={
          rows.length
            ? formatSoles(rows.reduce((s, r) => s + Number(r.sale_price) || 0, 0) / rows.length)
            : '—'
        }
      />
    </ReportSummaryRow>
  )
}

function buildParams(
  filters: Record<string, unknown>,
  page?: number,
  perPage?: number,
) {
  const params: Parameters<typeof productsService.listReport>[0] = {
    active_only: true,
  }
  if (filters.q) params.q = String(filters.q)
  if (filters.category_id) params.category_id = Number(filters.category_id)
  if (filters.branch_id) params.branch_id = Number(filters.branch_id)
  if (filters.preparation_area) params.preparation_area = String(filters.preparation_area)
  if (filters.stock_less_than) params.stock_less_than = Number(filters.stock_less_than)
  if (page != null) params.page = page
  if (perPage != null) params.per_page = perPage
  return params
}

export const productsReportDefinition: TableReportDefinition<ProductReportRow> = {
  kind: 'table',
  id: 'platos',
  path: 'platos',
  title: 'Reporte de platos',
  subtitle: 'Catálogo restaurante con precios, categoría y stock.',
  paginationMode: 'server',
  defaultPerPage: 25,
  columns: COLS,
  excelColumns: COLS,
  initialFilters: () => ({
    category_id: '',
    branch_id: '',
    preparation_area: '',
    stock_less_than: '',
    q: '',
  }),
  FilterPanel: ProductosFilters,
  SummaryPanel: ProductosSummary,
  fetch: async ({ page, perPage, filters }) => {
    const { data, total } = await productsService.listReport(buildParams(filters, page, perPage))
    return { rows: data, total }
  },
  fetchAllForExport: async (filters) => {
    const { data } = await productsService.listReport({ ...buildParams(filters), per_page: 10000 })
    return data
  },
}
