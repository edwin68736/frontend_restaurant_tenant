import {
  salesService,
  formatSaleDocumentNumber,
  type Sale,
  type SaleListSummary,
} from '@/services/sales.service'
import { billingStatusDisplayLabel } from '@/constants/billingStatus'
import { formatDisplayDate, getCurrentMonthRange } from '@/utils/datesPeru'
import type { ExportColumn } from '@/utils/exportExcel'
import type { ReportFilterPanelProps, TableReportDefinition } from '@/reports/types'
import {
  ReportFilterCard,
  ReportFilterField,
  reportInputClass,
  reportSelectClass,
} from '@/components/reports/ReportFilterCard'
import { ReportSummaryCard, ReportSummaryRow } from '@/components/reports/ReportSummaryCard'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : ''
}

const COLS: ExportColumn<Sale>[] = [
  { key: 'issue_date', label: 'Fecha', format: (v) => formatDisplayDate(String(v ?? '')) },
  {
    key: 'number',
    label: 'Comprobante',
    format: (_, r) => `${r.doc_type} ${formatSaleDocumentNumber(r)}`.trim(),
  },
  { key: 'contact_name', label: 'Cliente', format: (v) => String(v ?? '—') },
  { key: 'contact_doc_number', label: 'RUC / DNI', format: (v) => String(v ?? '—') },
  { key: 'subtotal', label: 'Subtotal', format: fmtMoney, excelNumber: true },
  { key: 'tax_amount', label: 'IGV', format: fmtMoney, excelNumber: true },
  { key: 'total', label: 'Total', format: fmtMoney, excelNumber: true },
  {
    key: 'status',
    label: 'Estado',
    format: (v) => (String(v) === 'cancelled' ? 'Anulada' : 'Activa'),
  },
  {
    key: 'billing_status',
    label: 'SUNAT',
    format: (v) => billingStatusDisplayLabel(String(v ?? '')),
  },
]

function SalesFilters({ filters, onChange, catalogs, exportActions }: ReportFilterPanelProps) {
  return (
    <ReportFilterCard
      horizontal
      hint="Ventas del restaurante con filtros por fecha, sucursal y estado."
    >
      <ReportFilterField label="Cliente / comprobante" className="min-w-[10rem] flex-1 shrink-0">
        <input
          type="search"
          value={String(filters.q ?? '')}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Buscar…"
          className={reportInputClass + ' w-full min-w-[10rem]'}
        />
      </ReportFilterField>
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
      <ReportFilterField label="Estado venta" className="shrink-0">
        <select
          value={String(filters.sale_status ?? 'all')}
          onChange={(e) => onChange({ sale_status: e.target.value })}
          className={reportSelectClass}
        >
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="cancelled">Anuladas</option>
        </select>
      </ReportFilterField>
      <ReportFilterField label="Método pago" className="shrink-0">
        <select
          value={String(filters.payment_method ?? '')}
          onChange={(e) => onChange({ payment_method: e.target.value })}
          className={reportSelectClass}
        >
          <option value="">Todos</option>
          {catalogs.paymentMethods.map((m) => (
            <option key={m.code} value={m.code}>{m.name}</option>
          ))}
        </select>
      </ReportFilterField>
      {exportActions}
    </ReportFilterCard>
  )
}

function SalesSummary({
  summary,
}: {
  summary: Record<string, unknown> | null
  rows: Sale[]
}) {
  const s = summary as SaleListSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow desktopCols={4}>
      {[
        { label: 'Ventas activas', value: fmtMoney(s.sum_active), hint: `${s.count_active ?? 0} comprobantes` },
        { label: 'Anuladas', value: fmtMoney(s.sum_cancelled), hint: `${s.count_cancelled ?? 0} comprobantes` },
        { label: 'Subtotal', value: fmtMoney(s.sum_subtotal) },
        { label: 'Total general', value: fmtMoney(s.sum_total) },
      ].map((card) => (
        <ReportSummaryCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
      ))}
    </ReportSummaryRow>
  )
}

function buildListParams(filters: Record<string, unknown>, page?: number, perPage?: number) {
  const params: Record<string, unknown> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.q) params.q = filters.q
  if (filters.branch_id) params.branch_id = Number(filters.branch_id)
  if (filters.payment_method) params.payment_method = filters.payment_method
  if (filters.sale_status && filters.sale_status !== 'all') params.sale_status = filters.sale_status
  if (page != null) params.page = page
  if (perPage != null) params.per_page = perPage
  return params
}

export const salesReportDefinition: TableReportDefinition<Sale> = {
  kind: 'table',
  id: 'ventas',
  path: 'ventas',
  title: 'Reporte de ventas',
  subtitle: 'Comprobantes emitidos desde POS, mesas y delivery.',
  paginationMode: 'server',
  defaultPerPage: 25,
  columns: COLS,
  excelColumns: COLS,
  initialFilters: () => {
    const { from, to } = getCurrentMonthRange()
    return { from, to, branch_id: '', sale_status: 'all', payment_method: '', q: '' }
  },
  FilterPanel: SalesFilters,
  SummaryPanel: SalesSummary,
  fetch: async ({ page, perPage, filters }) => {
    const { data, total, summary } = await salesService.list(
      buildListParams(filters, page, perPage) as Parameters<typeof salesService.list>[0],
    )
    return {
      rows: data,
      total,
      summary: summary as unknown as Record<string, unknown>,
    }
  },
  fetchAllForExport: async (filters) => {
    const { data } = await salesService.listAll(
      buildListParams(filters) as Parameters<typeof salesService.listAll>[0],
    )
    return data
  },
}
