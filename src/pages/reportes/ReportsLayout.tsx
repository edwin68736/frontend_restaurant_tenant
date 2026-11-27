import { Outlet, useParams } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { ReportsSubNav } from '@/components/reports/ReportsSubNav'
import { getReportByPath, DEFAULT_REPORT_PATH } from '@/reports/registry'

export default function ReportsLayout() {
  const { reportId = DEFAULT_REPORT_PATH } = useParams<{ reportId: string }>()
  const definition = getReportByPath(reportId)
  const title = definition?.title ?? 'Reportes'

  return (
    <PageShell
      title={title}
      subtitle="Análisis del restaurante con exportación PDF y Excel"
      subtitleClassName="hidden lg:block"
      className="flex-1 min-h-0 h-full"
      fill
    >
      {/* En su propia fila: con las pestañas al lado, el título quedaba aplastado. */}
      <div className="shrink-0 mb-2 lg:mb-3">
        <ReportsSubNav />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </PageShell>
  )
}
