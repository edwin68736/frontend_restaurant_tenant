import { RecipeReportFilters } from '@/components/reports/RecipeReportFilters'
import { ReportFilterField } from '@/components/reports/ReportFilterCard'
import { ReportSummaryCard, ReportSummaryRow } from '@/components/reports/ReportSummaryCard'
import {
  recipeReportsService,
  type ConsumptionRow,
  type ConsumptionSummary,
  type PurchaseRow,
  type PurchaseSummary,
  type ReportQuery,
  type StockRow,
  type StockSummary,
  type WasteRow,
  type WasteSummary,
} from '@/services/recipeReports.service'
import type { ReportFilterPanelProps, TableReportDefinition } from '@/reports/types'
import type { ExportColumn } from '@/utils/exportExcel'
import { formatDisplayDate, getCurrentMonthRange } from '@/utils/datesPeru'
import { knownCost, matches, money, qty, stockStatus, sumOf, unitCost } from '@/utils/recipeReports'
import { unitLabel } from '@/utils/recipes'

const query = (filters: Record<string, unknown>): ReportQuery => ({
  from: filters.from ? String(filters.from) : undefined,
  to: filters.to ? String(filters.to) : undefined,
  branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
})

const monthFilters = () => ({ ...getCurrentMonthRange(), branch_id: '' })

const unit: <T extends { unit: string }>() => ExportColumn<T> = () => ({ key: 'unit', label: 'Unidad', format: (v) => unitLabel(String(v)) })

/** Todas las páginas, para exportar. */
async function allPages<R>(load: (page: number) => Promise<{ data: R[]; total: number }>): Promise<R[]> {
  const rows: R[] = []
  for (let page = 1; ; page++) {
    const { data, total } = await load(page)
    rows.push(...data)
    if (data.length === 0 || rows.length >= total) return rows
  }
}

// ── Existencias ──

type StockViewRow = StockRow & { status: string }

const STOCK_COLS: ExportColumn<StockViewRow>[] = [
  { key: 'name', label: 'Insumo', wrap: true },
  { key: 'code', label: 'Código' },
  unit<StockViewRow>(),
  { key: 'quantity', label: 'Stock', format: qty, excelNumber: true },
  { key: 'min_stock', label: 'Mínimo', format: qty, excelNumber: true },
  { key: 'status', label: 'Estado' },
  { key: 'avg_cost', label: 'Costo promedio', format: unitCost, excelNumber: true },
  { key: 'last_cost', label: 'Último costo', format: unitCost, excelNumber: true },
  { key: 'value', label: 'Valor', format: money, excelNumber: true },
]

function StockFilters(props: ReportFilterPanelProps) {
  return (
    <RecipeReportFilters {...props} search="Insumo o código…" hint="Saldo actual de cada insumo. El stock negativo se muestra y no resta del valor total. El último costo es el de la última compra de cualquier sucursal.">
      <ReportFilterField label="Solo avisos" className="shrink-0">
        <input type="checkbox" checked={Boolean(props.filters.alerts)} onChange={(e) => props.onChange({ alerts: e.target.checked })} className="h-5 w-5 accent-rest-600" />
      </ReportFilterField>
    </RecipeReportFilters>
  )
}

function StockTotals({ summary }: { summary: Record<string, unknown> | null }) {
  const s = summary as StockSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow>
      <ReportSummaryCard label="Valor del stock" value={money(s.total_value)} hint={s.without_cost > 0 ? `${s.without_cost} con stock sin costo` : undefined} />
      <ReportSummaryCard label="Insumos" value={s.items} />
      <ReportSummaryCard label="Bajo mínimo" value={s.low_count} />
      <ReportSummaryCard label="En negativo" value={s.negative_count} />
    </ReportSummaryRow>
  )
}

async function loadStock(filters: Record<string, unknown>) {
  const { data, summary } = await recipeReportsService.stock(query(filters))
  const rows = data
    .filter((r) => matches(`${r.name} ${r.code}`, filters.q))
    .filter((r) => !filters.alerts || r.low || r.negative)
    .map((r) => ({ ...r, status: stockStatus(r) }))
  return { rows, summary }
}

export const supplyStockReportDefinition: TableReportDefinition<StockViewRow> = {
  kind: 'table',
  id: 'existencias-insumos',
  path: 'existencias-insumos',
  title: 'Existencias de insumos',
  feature: 'restaurant_recipes',
  paginationMode: 'client',
  defaultPerPage: 50,
  columns: STOCK_COLS,
  excelTotals: (rows) => ({ value: sumOf(rows, (r) => r.value) }),
  initialFilters: () => ({ q: '', branch_id: '', alerts: false }),
  FilterPanel: StockFilters,
  SummaryPanel: StockTotals,
  fetch: async ({ filters }) => {
    const { rows, summary } = await loadStock(filters)
    return { rows, total: rows.length, summary: summary as unknown as Record<string, unknown> }
  },
  fetchAllForExport: async (filters) => (await loadStock(filters)).rows,
}

// ── Compras ──

const PURCHASE_COLS: ExportColumn<PurchaseRow>[] = [
  { key: 'issue_date', label: 'Fecha', format: (v) => formatDisplayDate(String(v)) },
  { key: 'supplier', label: 'Proveedor', wrap: true, format: (v) => String(v || '—') },
  { key: 'document', label: 'Comprobante' },
  { key: 'supply', label: 'Insumo', wrap: true },
  { key: 'quantity', label: 'Cantidad', format: qty, excelNumber: true },
  unit<PurchaseRow>(),
  { key: 'unit_cost', label: 'Costo unitario', format: unitCost, excelNumber: true },
  { key: 'amount', label: 'Importe sin IGV', format: money, excelNumber: true },
]

function PurchaseFilters(props: ReportFilterPanelProps) {
  return <RecipeReportFilters {...props} dates hint="Insumos comprados, en su unidad base y sin IGV. No incluye compras anuladas." />
}

function PurchaseTotals({ summary }: { summary: Record<string, unknown> | null }) {
  const s = summary as PurchaseSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow desktopCols={3}>
      <ReportSummaryCard label="Comprado sin IGV" value={money(s.total_amount)} hint="de todo el período" />
    </ReportSummaryRow>
  )
}

export const supplyPurchasesReportDefinition: TableReportDefinition<PurchaseRow> = {
  kind: 'table',
  id: 'compras-por-insumo',
  path: 'compras-por-insumo',
  title: 'Compras por insumo',
  feature: 'restaurant_recipes',
  paginationMode: 'server',
  defaultPerPage: 50,
  columns: PURCHASE_COLS,
  excelTotals: (rows) => ({ amount: sumOf(rows, (r) => r.amount) }),
  initialFilters: monthFilters,
  FilterPanel: PurchaseFilters,
  SummaryPanel: PurchaseTotals,
  fetch: async ({ page, perPage, filters }) => {
    const { data, total, summary } = await recipeReportsService.purchases({ ...query(filters), page, per_page: perPage })
    return { rows: data, total, summary: summary as unknown as Record<string, unknown> }
  },
  fetchAllForExport: (filters) => allPages((page) => recipeReportsService.purchases({ ...query(filters), page, per_page: 1000 })),
}

// ── Consumo ──

const CONSUMPTION_COLS: ExportColumn<ConsumptionRow>[] = [
  { key: 'supply', label: 'Insumo', wrap: true },
  unit<ConsumptionRow>(),
  { key: 'consumed', label: 'Consumido', format: qty, excelNumber: true },
  { key: 'restored', label: 'Repuesto', format: qty, excelNumber: true },
  { key: 'net', label: 'Neto', format: qty, excelNumber: true },
  { key: 'cost', label: 'Costo', format: money, excelNumber: true },
  { key: 'without_cost', label: 'Sin costo', format: (v) => (Number(v) > 0 ? qty(v) : '—'), excelNumber: true },
]

function ConsumptionFilters(props: ReportFilterPanelProps) {
  return <RecipeReportFilters {...props} dates search="Insumo…" hint="Lo que salió por recetas menos lo repuesto por anulaciones y devoluciones, de mayor a menor costo." />
}

function ConsumptionTotals({ summary }: { summary: Record<string, unknown> | null }) {
  const s = summary as ConsumptionSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow desktopCols={3}>
      <ReportSummaryCard label="Costo consumido" value={money(s.total_cost)} hint="sin IGV, de todo el período" />
    </ReportSummaryRow>
  )
}

async function loadConsumption(filters: Record<string, unknown>) {
  const { data, summary } = await recipeReportsService.consumption(query(filters))
  const known = data.map((r) => ({ ...r, cost: knownCost(r.cost, r.without_cost) }))
  const unpriced = known.filter((r) => r.without_cost > 0).length
  return {
    rows: known.filter((r) => matches(r.supply, filters.q)),
    summary: { ...summary, total_cost: knownCost(summary.total_cost, unpriced) },
  }
}

export const supplyConsumptionReportDefinition: TableReportDefinition<ConsumptionRow> = {
  kind: 'table',
  id: 'consumo-insumos',
  path: 'consumo-insumos',
  title: 'Consumo de insumos',
  feature: 'restaurant_recipes',
  paginationMode: 'client',
  defaultPerPage: 50,
  columns: CONSUMPTION_COLS,
  excelTotals: (rows) => ({ cost: sumOf(rows, (r) => r.cost) }),
  initialFilters: () => ({ ...monthFilters(), q: '' }),
  FilterPanel: ConsumptionFilters,
  SummaryPanel: ConsumptionTotals,
  fetch: async ({ filters }) => {
    const { rows, summary } = await loadConsumption(filters)
    return { rows, total: rows.length, summary: summary as unknown as Record<string, unknown> }
  },
  fetchAllForExport: async (filters) => (await loadConsumption(filters)).rows,
}

// ── Mermas ──

const WASTE_COLS: ExportColumn<WasteRow>[] = [
  { key: 'date', label: 'Fecha', format: (v) => formatDisplayDate(String(v)) },
  { key: 'supply', label: 'Insumo', wrap: true },
  { key: 'kind', label: 'Tipo', format: (v) => (v === 'merma' ? 'Merma' : 'Desperdicio') },
  { key: 'quantity', label: 'Cantidad', format: qty, excelNumber: true },
  unit<WasteRow>(),
  { key: 'value', label: 'Valor', format: money, excelNumber: true },
  { key: 'user', label: 'Usuario', wrap: true, format: (v) => String(v || '—') },
  { key: 'notes', label: 'Motivo', wrap: true, format: (v) => String(v || '—') },
]

function WasteFilters(props: ReportFilterPanelProps) {
  return <RecipeReportFilters {...props} dates hint="Mermas y desperdicios registrados a mano. La merma propia de cada receta ya está dentro del consumo." />
}

function WasteTotals({ summary }: { summary: Record<string, unknown> | null }) {
  const s = summary as WasteSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow desktopCols={3}>
      <ReportSummaryCard label="Valor perdido" value={money(s.total_value)} hint="de todo el período" />
    </ReportSummaryRow>
  )
}

export const supplyWasteReportDefinition: TableReportDefinition<WasteRow> = {
  kind: 'table',
  id: 'mermas',
  path: 'mermas',
  title: 'Mermas y desperdicios',
  feature: 'restaurant_recipes',
  paginationMode: 'server',
  defaultPerPage: 50,
  columns: WASTE_COLS,
  excelTotals: (rows) => ({ value: sumOf(rows, (r) => r.value) }),
  initialFilters: monthFilters,
  FilterPanel: WasteFilters,
  SummaryPanel: WasteTotals,
  fetch: async ({ page, perPage, filters }) => {
    const { data, total, summary } = await recipeReportsService.waste({ ...query(filters), page, per_page: perPage })
    return { rows: data, total, summary: summary as unknown as Record<string, unknown> }
  },
  fetchAllForExport: (filters) => allPages((page) => recipeReportsService.waste({ ...query(filters), page, per_page: 1000 })),
}
