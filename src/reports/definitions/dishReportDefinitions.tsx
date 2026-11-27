import { RecipeReportFilters } from '@/components/reports/RecipeReportFilters'
import { ReportFilterField, reportSelectClass } from '@/components/reports/ReportFilterCard'
import { ReportSummaryCard, ReportSummaryRow } from '@/components/reports/ReportSummaryCard'
import { recipeReportsService, type ProfitRow, type ProfitSummary } from '@/services/recipeReports.service'
import { recipesService } from '@/services/recipes.service'
import type { ReportFilterPanelProps, TableReportDefinition } from '@/reports/types'
import type { ExportColumn } from '@/utils/exportExcel'
import { getCurrentMonthRange } from '@/utils/datesPeru'
import { dishCostRows, knownCost, matches, money, pct, qty, sortDishCosts, sumOf, unitCost, type DishCostOrder, type DishCostRow } from '@/utils/recipeReports'

// ── Costos de la carta (hoy) ──

const COST_COLS: ExportColumn<DishCostRow>[] = [
  { key: 'name', label: 'Plato', wrap: true },
  { key: 'category', label: 'Categoría', wrap: true, format: (v) => String(v || '—') },
  { key: 'portion_cost', label: 'Costo porción', format: unitCost, excelNumber: true },
  { key: 'price', label: 'Precio', format: money, excelNumber: true },
  { key: 'net_price', label: 'Sin IGV', format: money, excelNumber: true },
  { key: 'food_cost_pct', label: 'Food cost %', format: pct, excelNumber: true },
  { key: 'margin', label: 'Margen', format: money, excelNumber: true },
  { key: 'available', label: 'Porciones', format: qty, excelNumber: true },
  { key: 'status', label: 'Estado' },
]

function CostFilters(props: ReportFilterPanelProps) {
  return (
    <RecipeReportFilters {...props} search="Plato o categoría…" hint="Costo, precio y porciones disponibles de cada plato con los costos de hoy.">
      <ReportFilterField label="Ordenar por" className="shrink-0">
        <select value={String(props.filters.order ?? 'cost')} onChange={(e) => props.onChange({ order: e.target.value })} className={reportSelectClass}>
          <option value="cost">Mayor costo</option>
          <option value="food_cost">Mayor food cost</option>
          <option value="available">Menos porciones</option>
        </select>
      </ReportFilterField>
      <ReportFilterField label="Solo con receta" className="shrink-0">
        <input type="checkbox" checked={Boolean(props.filters.with_recipe)} onChange={(e) => props.onChange({ with_recipe: e.target.checked })} className="h-5 w-5 accent-rest-600" />
      </ReportFilterField>
    </RecipeReportFilters>
  )
}

async function loadCosts(filters: Record<string, unknown>) {
  const { data } = await recipesService.list(filters.branch_id ? Number(filters.branch_id) : undefined)
  const rows = dishCostRows(data)
    .filter((r) => matches(`${r.name} ${r.category}`, filters.q))
    .filter((r) => !filters.with_recipe || r.status !== 'Sin receta')
  return sortDishCosts(rows, (filters.order as DishCostOrder) ?? 'cost')
}

export const dishCostsReportDefinition: TableReportDefinition<DishCostRow> = {
  kind: 'table',
  id: 'costos-carta',
  path: 'costos-carta',
  title: 'Costos de la carta',
  feature: 'restaurant_recipes',
  paginationMode: 'client',
  defaultPerPage: 50,
  columns: COST_COLS,
  initialFilters: () => ({ q: '', branch_id: '', order: 'cost', with_recipe: true }),
  FilterPanel: CostFilters,
  fetch: async ({ filters }) => {
    const rows = await loadCosts(filters)
    return { rows, total: rows.length }
  },
  fetchAllForExport: loadCosts,
}

// ── Rentabilidad de lo vendido ──

/** Lo desconocido viaja vacío: ni en pantalla ni en Excel debe salir como cero. */
type ProfitViewRow = Omit<ProfitRow, 'cost' | 'margin' | 'margin_pct' | 'food_cost_pct'> & {
  key: string
  cost?: number
  margin?: number
  margin_pct?: number
  food_cost_pct?: number
}

/** Sin margen %, nada de lo vendido tiene costo: costo y margen tampoco se conocen. */
function knownProfit<T extends Omit<ProfitRow, 'product_id' | 'presentation_id' | 'name'>>(r: T) {
  const cost = knownCost(r.cost, r.margin_pct == null ? r.units_without_cost : 0)
  return {
    ...r,
    cost,
    margin: cost === undefined ? undefined : r.margin,
    margin_pct: r.margin_pct ?? undefined,
    food_cost_pct: r.food_cost_pct ?? undefined,
  }
}

const PROFIT_COLS: ExportColumn<ProfitViewRow>[] = [
  { key: 'name', label: 'Plato', wrap: true },
  { key: 'units', label: 'Unidades', format: qty, excelNumber: true },
  { key: 'revenue', label: 'Venta sin IGV', format: money, excelNumber: true },
  { key: 'cost', label: 'Costo', format: money, excelNumber: true },
  { key: 'margin', label: 'Margen', format: money, excelNumber: true },
  { key: 'margin_pct', label: 'Margen %', format: pct, excelNumber: true },
  { key: 'food_cost_pct', label: 'Food cost %', format: pct, excelNumber: true },
  { key: 'units_without_cost', label: 'Unid. sin costo', format: (v) => (Number(v) > 0 ? qty(v) : '—'), excelNumber: true },
  { key: 'revenue_without_cost', label: 'Venta sin costo', format: (v) => (Number(v) > 0 ? money(v) : '—'), excelNumber: true },
]

function ProfitFilters(props: ReportFilterPanelProps) {
  return <RecipeReportFilters {...props} dates search="Plato…" hint="Ventas del período sin IGV contra el costo de los insumos que salieron. Lo vendido sin costo no entra al margen." />
}

function ProfitTotals({ summary }: { summary: Record<string, unknown> | null }) {
  const s = summary as ProfitSummary | null
  if (!s) return null
  return (
    <ReportSummaryRow>
      <ReportSummaryCard label="Venta sin IGV" value={money(s.revenue)} hint={s.unconverted_usd ? `Fuera: US$ ${s.unconverted_usd} sin tipo de cambio` : undefined} />
      <ReportSummaryCard label="Costo de insumos" value={money(s.cost)} hint={`Food cost ${pct(s.food_cost_pct)}`} />
      <ReportSummaryCard label="Margen" value={money(s.margin)} hint={pct(s.margin_pct)} />
      <ReportSummaryCard label="Venta sin costo" value={money(s.revenue_without_cost)} hint="no entra al margen" />
    </ReportSummaryRow>
  )
}

async function loadProfit(filters: Record<string, unknown>) {
  const { data, summary } = await recipeReportsService.profit({
    from: String(filters.from ?? ''),
    to: String(filters.to ?? ''),
    branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
  })
  const rows: ProfitViewRow[] = data
    .filter((r) => matches(r.name, filters.q))
    .map((r) => ({ ...knownProfit(r), key: `${r.product_id}-${r.presentation_id}` }))
  return { rows, summary: knownProfit(summary) }
}

export const dishProfitReportDefinition: TableReportDefinition<ProfitViewRow> = {
  kind: 'table',
  id: 'rentabilidad-platos',
  path: 'rentabilidad-platos',
  title: 'Rentabilidad de platos',
  feature: 'restaurant_recipes',
  paginationMode: 'client',
  defaultPerPage: 50,
  columns: PROFIT_COLS,
  excelTotals: (rows) => ({
    units: sumOf(rows, (r) => r.units),
    revenue: sumOf(rows, (r) => r.revenue),
    cost: sumOf(rows, (r) => r.cost),
    margin: sumOf(rows, (r) => r.margin),
    units_without_cost: sumOf(rows, (r) => r.units_without_cost),
    revenue_without_cost: sumOf(rows, (r) => r.revenue_without_cost),
  }),
  initialFilters: () => ({ ...getCurrentMonthRange(), branch_id: '', q: '' }),
  FilterPanel: ProfitFilters,
  SummaryPanel: ProfitTotals,
  fetch: async ({ filters }) => {
    const { rows, summary } = await loadProfit(filters)
    return { rows, total: rows.length, summary: summary as unknown as Record<string, unknown> }
  },
  fetchAllForExport: async (filters) => (await loadProfit(filters)).rows,
}
