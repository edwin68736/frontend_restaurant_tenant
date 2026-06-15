import { useReportCatalogs } from '@/reports/hooks/useReportCatalogs'
import { useTableReportRunner } from '@/reports/hooks/useTableReportRunner'
import type { TableReportDefinition } from '@/reports/types'
import { ReportExportBar } from '@/components/reports/ReportExportBar'
import { ReportPagination } from '@/components/reports/ReportPagination'
import { ReportTable } from '@/components/reports/ReportTable'

type Props<T extends object> = {
  definition: TableReportDefinition<T>
}

export function TableReportView<T extends object>({ definition }: Props<T>) {
  const { catalogs } = useReportCatalogs()
  const runner = useTableReportRunner(definition)
  const FilterPanel = definition.FilterPanel
  const SummaryPanel = definition.SummaryPanel

  const exportActions = (
    <ReportExportBar
      loading={runner.loading}
      onExportPdf={() => void runner.exportPdf()}
      onExportExcel={() => void runner.exportExcel()}
    />
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 lg:gap-3">
      <div className="shrink-0 space-y-2 lg:space-y-3">
        <FilterPanel
          filters={runner.filters}
          onChange={runner.patchFilters}
          catalogs={catalogs}
          exportActions={exportActions}
        />

        {SummaryPanel ? (
          <div className="shrink-0">
            <SummaryPanel summary={runner.summary} rows={runner.allRows} />
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-[min(52dvh,28rem)] lg:min-h-0 flex flex-col bg-white rounded-xl lg:rounded-2xl border border-stone-200 overflow-hidden">
        <ReportTable
          columns={definition.columns}
          rows={runner.rows}
          loading={runner.loading}
          fill
        />
        {runner.paginationMode !== 'none' && (
          <ReportPagination
            page={runner.page}
            perPage={runner.perPage}
            total={runner.total}
            perPageOptions={runner.perPageOptions}
            onPageChange={runner.setPage}
            onPerPageChange={runner.setPerPage}
          />
        )}
      </div>
    </div>
  )
}
