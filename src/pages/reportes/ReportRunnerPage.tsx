import { Navigate, useParams } from 'react-router-dom'
import { TableReportView } from '@/components/reports/TableReportView'
import {
  DEFAULT_REPORT_PATH,
  getReportByPath,
} from '@/reports/registry'
import { isTableReport } from '@/reports/types'

export default function ReportRunnerPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const definition = reportId ? getReportByPath(reportId) : undefined

  if (!definition) {
    return <Navigate to={`/reportes/${DEFAULT_REPORT_PATH}`} replace />
  }

  if (isTableReport(definition)) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        <TableReportView definition={definition} />
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
