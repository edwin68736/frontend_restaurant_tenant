import { salesReportDefinition } from '@/reports/definitions/salesReportDefinition'
import { salesByProductReportDefinition } from '@/reports/definitions/salesByProductReportDefinition'
import { productsReportDefinition } from '@/reports/definitions/productsReportDefinition'
import { cashMovementsReportDefinition } from '@/reports/definitions/cashMovementsReportDefinition'
import type { ReportDefinition } from '@/reports/types'
import { isTableReport } from '@/reports/types'

/** Orden de pestañas en la UI. */
export const RESTAURANT_REPORT_DEFINITIONS: ReportDefinition[] = [
  salesReportDefinition,
  salesByProductReportDefinition,
  productsReportDefinition,
  cashMovementsReportDefinition,
]

export const RESTAURANT_REPORTS_NAV = RESTAURANT_REPORT_DEFINITIONS.map((d) => ({
  path: d.path,
  title: d.title,
}))

export const DEFAULT_REPORT_PATH = salesReportDefinition.path

export function getReportByPath(segment: string): ReportDefinition | undefined {
  return RESTAURANT_REPORT_DEFINITIONS.find((d) => d.path === segment)
}

export function getTableReports() {
  return RESTAURANT_REPORT_DEFINITIONS.filter(isTableReport)
}
