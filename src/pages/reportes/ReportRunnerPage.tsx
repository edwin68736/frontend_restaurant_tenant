import { Navigate, useParams } from 'react-router-dom'
import { TableReportView } from '@/components/reports/TableReportView'
import { useFeatures } from '@/contexts/FeatureContext'
import {
  DEFAULT_REPORT_PATH,
  getReportByPath,
} from '@/reports/registry'
import { isTableReport } from '@/reports/types'

export default function ReportRunnerPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const definition = reportId ? getReportByPath(reportId) : undefined
  const { hasFeature, ready } = useFeatures()

  // Hasta saber qué funciones tiene el negocio no se redirige: al recargar un reporte del módulo volvería a «ventas».
  if (definition?.feature && !ready) return null

  if (!definition || (definition.feature && !hasFeature(definition.feature))) {
    return <Navigate to={`/reportes/${DEFAULT_REPORT_PATH}`} replace />
  }

  if (isTableReport(definition)) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        {/* key: cada reporte arranca con sus propios filtros y filas; sin ella se arrastran los del anterior. */}
        <TableReportView key={definition.id} definition={definition} />
      </div>
    )
  }

  const CustomView = definition.View
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <CustomView />
    </div>
  )
}
