import {
  salesService,
  type SalesByProductRow,
  type SalesByProductSummary,
} from '@/services/sales.service'
import { getCurrentMonthRange } from '@/utils/datesPeru'
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

const EXPORT_COLS: ExportColumn<SalesByProductRow>[] = [
  { key: 'category_name', label: 'Categoría' },
  { key: 'product_code', label: 'Código' },
  { key: 'product_name', label: 'Plato / producto' },
  { key: 'unit', label: 'Unidad', format: (v) => String(v || '—') },
  { key: 'quantity_sold', label: 'Cantidad', format: (v) => Number(v).toFixed(3), excelNumber: true },
  { key: 'lines_count', label: 'Líneas' },
  { key: 'sales_count', label: 'Comprobantes' },
  { key: 'total_amount', label: 'Total (S/)', format: (v) => Number(v).toFixed(2), excelNumber: true },
  { key: 'avg_line_amount', label: 'Prom. línea', format: (v) => Number(v).toFixed(2), excelNumber: true },
]

function PlatosVendidosFilters({ filters, onChange, catalogs, exportActions }: ReportFilterPanelProps) {
  return (
    <ReportFilterCard horizontal hint="Ranking de platos vendidos por categoría en el periodo seleccionado.">
      <ReportFilterField label="Desde" className="shrink-0">
        <input
          type="date"
          value={String(filters.from ?? '')}
          onChange={(e) => onChange({ from: e.target.value })}
          className={reportInputClass}
        />
      </ReportFilterField>
      <ReportFilterField label="Hasta" className="shrink-0">
        <input
          type="date"
          value={String(filters.to ?? '')}
          onChange={(e) => onChange({ to: e.target.value })}
          className={reportInputClass}
        />
      </ReportFilterField>
      {catalogs.branches.length > 1 && (
        <ReportFilterField label="Sucursal" className="shrink-0">
          <select
            value={String(filters.branch_id ?? '')}
            onChange={(e) => onChange({ branch_id: e.target.value ? Number(e.target.value) : '' })}
            className={reportSelectClass}
          >
            <option value="">Todas</option>
            {catalogs.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </ReportFilterField>
      )}
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
      {exportActions}
    </ReportFilterCard>
  )
}

function PlatosVendidosSummary({
  summary,
}: {
  summary: Record<string, unknown> | null
  rows: SalesByProductRow[]
}) {
  const s = summary as SalesByProductSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow desktopCols={5}>
      {[
        { label: 'Total vendido', value: formatSoles(s.total_amount) },
        { label: 'Unidades', value: Number(s.total_quantity).toFixed(3) },
        { label: 'Líneas', value: String(s.line_items) },
        { label: 'Comprobantes', value: String(s.distinct_sales) },
        { label: 'Platos distintos', value: String(s.products_count) },
      ].map((card) => (
        <ReportSummaryCard key={card.label} label={card.label} value={card.value} />
      ))}
    </ReportSummaryRow>
  )
}

function buildParams(filters: Record<string, unknown>) {
  const params: { from?: string; to?: string; branch_id?: number; category_id?: number } = {}
  if (filters.from) params.from = String(filters.from)
  if (filters.to) params.to = String(filters.to)
  if (filters.branch_id) params.branch_id = Number(filters.branch_id)
  if (filters.category_id) params.category_id = Number(filters.category_id)
  return params
}

export const salesByProductReportDefinition: TableReportDefinition<SalesByProductRow> = {
  kind: 'table',
  id: 'platos-vendidos',
  path: 'platos-vendidos',
  title: 'Platos vendidos',
  subtitle: 'Cantidades y montos por producto del cartá restaurante.',
  paginationMode: 'client',
  defaultPerPage: 25,
  columns: EXPORT_COLS,
  excelColumns: EXPORT_COLS,
  initialFilters: () => {
    const { from, to } = getCurrentMonthRange()
    return { from, to, branch_id: '', category_id: '' }
  },
  FilterPanel: PlatosVendidosFilters,
  SummaryPanel: PlatosVendidosSummary,
  fetch: async ({ filters }) => {
    const { data, summary } = await salesService.listByProduct(buildParams(filters))
    return {
      rows: data,
      total: data.length,
      summary: (summary ?? null) as unknown as Record<string, unknown>,
    }
  },
  fetchAllForExport: async (filters) => {
    const { data } = await salesService.listByProduct(buildParams(filters))
    return data
  },
}
