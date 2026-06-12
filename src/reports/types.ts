import type { ReactNode } from 'react'
import type { ExportColumn } from '@/utils/exportExcel'
import type { PaymentMethodRecord } from '@/services/cashbank.service'

export type ReportPaginationMode = 'server' | 'client' | 'none'

export interface ReportCatalogs {
  branches: { id: number; name: string }[]
  categories: { id: number; name: string }[]
  paymentMethods: PaymentMethodRecord[]
  staffUsers: { user_id: number; name: string }[]
}

export interface ReportFilterPanelProps {
  filters: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
  catalogs: ReportCatalogs
  /** Botones PDF/Excel (renderizados junto al buscador o al final de filtros). */
  exportActions?: ReactNode
}

export interface ReportFetchParams {
  page: number
  perPage: number
  filters: Record<string, unknown>
}

export interface ReportFetchResult<T> {
  rows: T[]
  total: number
  summary?: Record<string, unknown> | null
}

export interface TableReportDefinition<T extends object = Record<string, unknown>> {
  kind: 'table'
  id: string
  path: string
  title: string
  subtitle?: string
  paginationMode: ReportPaginationMode
  defaultPerPage?: number
  columns: ExportColumn<T>[]
  excelColumns?: ExportColumn<T>[]
  initialFilters: () => Record<string, unknown>
  FilterPanel: React.ComponentType<ReportFilterPanelProps>
  fetch: (params: ReportFetchParams) => Promise<ReportFetchResult<T>>
  fetchAllForExport: (filters: Record<string, unknown>) => Promise<T[]>
  SummaryPanel?: React.ComponentType<{
    summary: Record<string, unknown> | null
    rows: T[]
  }>
}

export interface CustomReportDefinition {
  kind: 'custom'
  id: string
  path: string
  title: string
  subtitle?: string
  View: React.ComponentType
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReportDefinition = TableReportDefinition<any> | CustomReportDefinition

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTableReport(def: ReportDefinition): def is TableReportDefinition<any> {
  return def.kind === 'table'
}

export type ReportRunnerState<T extends object> = {
  rows: T[]
  total: number
  summary: Record<string, unknown> | null
  loading: boolean
  page: number
  perPage: number
  filters: Record<string, unknown>
  setPage: (p: number) => void
  setPerPage: (n: number) => void
  patchFilters: (patch: Record<string, unknown>) => void
  reload: () => void
  exportPdf: () => Promise<void>
  exportExcel: () => Promise<void>
}

export type ReportTableCellContext<T> = {
  row: T
  column: ExportColumn<T>
  value: unknown
}

export type ReportTableProps<T extends object> = {
  columns: ExportColumn<T>[]
  rows: T[]
  loading: boolean
  emptyMessage?: string
  renderCell?: (ctx: ReportTableCellContext<T>) => ReactNode
  /** Usa el espacio vertical disponible del contenedor padre. */
  fill?: boolean
}
