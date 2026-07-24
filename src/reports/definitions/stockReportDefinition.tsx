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

/** Número de stock (soporta decimales para insumos por peso). */
function stockNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const COLS: ExportColumn<ProductReportRow>[] = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Producto' },
  { key: 'category_name', label: 'Categoría', format: (v) => String(v ?? '—') },
  { key: 'unit', label: 'Unidad', format: (v) => String(v ?? '—') },
  {
    key: 'stock_total',
    label: 'Stock',
    format: (v) => String(stockNum(v)),
    excelNumber: true,
  },
  {
    key: 'min_stock',
    label: 'Stock mínimo',
    format: (v) => String(stockNum(v)),
    excelNumber: true,
  },
  {
    // Alerta legible cuando el stock está en o por debajo del mínimo.
    key: 'stock_total',
    label: 'Estado',
    format: (_v, row) => {
      const stock = stockNum(row.stock_total)
      const min = stockNum(row.min_stock)
      if (stock <= 0) return 'Sin stock'
      if (min > 0 && stock <= min) return 'Bajo mínimo'
      return 'OK'
    },
  },
  {
    key: 'sale_price',
    label: 'Precio',
    format: (v) => formatSoles(Number(v) || 0),
    excelNumber: true,
  },
]

function StockFilters({ filters, onChange, catalogs, exportActions }: ReportFilterPanelProps) {
  return (
    <ReportFilterCard
      horizontal
      hint="Productos con control de stock. Marque «solo bajo mínimo» para ver los que hay que reponer."
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
      <ReportFilterField label="Solo bajo mínimo" className="shrink-0">
        <input
          type="checkbox"
          checked={Boolean(filters.low_stock_only)}
          onChange={(e) => onChange({ low_stock_only: e.target.checked })}
          className="h-5 w-5 accent-rest-600"
        />
      </ReportFilterField>
      {exportActions}
    </ReportFilterCard>
  )
}

function buildParams(filters: Record<string, unknown>, page?: number, perPage?: number) {
  const params: Parameters<typeof productsService.listReport>[0] = {
    active_only: true,
    manage_stock_only: true,
  }
  if (filters.q) params.q = String(filters.q)
  if (filters.category_id) params.category_id = Number(filters.category_id)
  if (filters.branch_id) params.branch_id = Number(filters.branch_id)
  if (page != null) params.page = page
  if (perPage != null) params.per_page = perPage
  return params
}

/** «Bajo mínimo» se filtra en el cliente: stock <= min (con min > 0). */
function keepLowStock(rows: ProductReportRow[], on: boolean): ProductReportRow[] {
  if (!on) return rows
  return rows.filter((r) => {
    const stock = stockNum(r.stock_total)
    const min = stockNum(r.min_stock)
    return stock <= 0 || (min > 0 && stock <= min)
  })
}

export const stockReportDefinition: TableReportDefinition<ProductReportRow> = {
  kind: 'table',
  id: 'stock-productos',
  path: 'stock-productos',
  title: 'Stock de productos',
  subtitle: 'Productos con control de inventario y su stock actual.',
  // client: el filtro «bajo mínimo» se aplica sobre la data traída, sin endpoint aparte.
  paginationMode: 'client',
  defaultPerPage: 25,
  columns: COLS,
  excelColumns: COLS,
  initialFilters: () => ({
    q: '',
    category_id: '',
    branch_id: '',
    low_stock_only: false,
  }),
  FilterPanel: StockFilters,
  fetch: async ({ filters }) => {
    // Traemos todo con control de stock (client-side pagina/filtra el «bajo mínimo»).
    const { data } = await productsService.listReport({ ...buildParams(filters), per_page: 10000 })
    const rows = keepLowStock(data, Boolean(filters.low_stock_only))
    return { rows, total: rows.length }
  },
  fetchAllForExport: async (filters) => {
    const { data } = await productsService.listReport({ ...buildParams(filters), per_page: 10000 })
    return keepLowStock(data, Boolean(filters.low_stock_only))
  },
}
