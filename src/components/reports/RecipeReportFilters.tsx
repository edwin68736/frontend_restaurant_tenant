import type { ReactNode } from 'react'
import { ReportFilterCard, ReportFilterField, reportInputClass, reportSelectClass } from '@/components/reports/ReportFilterCard'
import type { ReportFilterPanelProps } from '@/reports/types'

type Props = ReportFilterPanelProps & {
  hint: string
  dates?: boolean
  search?: string
  children?: ReactNode
}

/** Filtros comunes de los reportes de insumos y platos: período, sucursal y buscador. */
export function RecipeReportFilters({ filters, onChange, catalogs, exportActions, hint, dates, search, children }: Props) {
  return (
    <ReportFilterCard horizontal hint={hint}>
      {dates && (
        <>
          <ReportFilterField label="Desde" className="shrink-0">
            <input type="date" value={String(filters.from ?? '')} onChange={(e) => onChange({ from: e.target.value })} className={reportInputClass} />
          </ReportFilterField>
          <ReportFilterField label="Hasta" className="shrink-0">
            <input type="date" value={String(filters.to ?? '')} onChange={(e) => onChange({ to: e.target.value })} className={reportInputClass} />
          </ReportFilterField>
        </>
      )}
      {search && (
        <ReportFilterField label="Buscar" className="min-w-[10rem] flex-1 shrink-0">
          <input
            type="search"
            value={String(filters.q ?? '')}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder={search}
            className={reportInputClass + ' w-full min-w-[10rem]'}
          />
        </ReportFilterField>
      )}
      {catalogs.branches.length > 1 && (
        <ReportFilterField label="Sucursal" className="shrink-0">
          <select
            value={String(filters.branch_id ?? '')}
            onChange={(e) => onChange({ branch_id: e.target.value ? Number(e.target.value) : '' })}
            className={reportSelectClass}
          >
            <option value="">Actual</option>
            {catalogs.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </ReportFilterField>
      )}
      {children}
      {exportActions}
    </ReportFilterCard>
  )
}
