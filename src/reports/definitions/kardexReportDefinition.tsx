import type { CustomReportDefinition } from '@/reports/types'
import KardexReportView from '@/reports/views/KardexReportView'

export const kardexReportDefinition: CustomReportDefinition = {
  kind: 'custom',
  id: 'kardex',
  path: 'kardex',
  title: 'Kardex de inventario',
  subtitle: 'Movimientos de platos con control de stock',
  View: KardexReportView,
}
