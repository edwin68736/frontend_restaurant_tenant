import { CashMovementsReportView } from '@/components/reports/CashMovementsReportView'
import type { CustomReportDefinition } from '@/reports/types'

export const cashMovementsReportDefinition: CustomReportDefinition = {
  kind: 'custom',
  id: 'movimientos-caja',
  path: 'movimientos-caja',
  title: 'Movimientos de caja',
  subtitle: 'Efectivo y medios electrónicos con filtros por fecha y usuario.',
  View: CashMovementsReportView,
}
