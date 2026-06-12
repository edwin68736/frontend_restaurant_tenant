import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { exportTableToPdf } from '@/utils/exportPdf'
import { exportTableToExcel } from '@/utils/exportExcel'
import type { TableReportDefinition } from '@/reports/types'

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

export function useTableReportRunner<T extends object>(definition: TableReportDefinition<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(definition.defaultPerPage ?? 25)
  const [filters, setFilters] = useState(definition.initialFilters)

  const patchFilters = useCallback((patch: Record<string, unknown>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await definition.fetch({ page, perPage, filters })
      setRows(result.rows)
      setTotal(result.total)
      setSummary(result.summary ?? null)
    } catch {
      toast.error(`Error al cargar ${definition.title}`)
      setRows([])
      setTotal(0)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [definition, page, perPage, filters])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (definition.paginationMode === 'client') {
      const tp = Math.max(1, Math.ceil(rows.length / perPage))
      if (page > tp) setPage(tp)
    }
  }, [definition.paginationMode, rows.length, perPage, page])

  const displayRows =
    definition.paginationMode === 'client'
      ? rows.slice((page - 1) * perPage, page * perPage)
      : rows

  const displayTotal =
    definition.paginationMode === 'client' ? rows.length : total

  const exportPdf = async () => {
    setLoading(true)
    try {
      const all = await definition.fetchAllForExport(filters)
      exportTableToPdf(
        definition.title,
        definition.columns,
        all,
        `${definition.id}-${String(filters.from ?? filters.date_from ?? 'reporte')}.pdf`,
      )
      toast.success('PDF exportado')
    } catch {
      toast.error('No se pudo exportar PDF')
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = async () => {
    setLoading(true)
    try {
      const all = await definition.fetchAllForExport(filters)
      const cols = definition.excelColumns ?? definition.columns
      await exportTableToExcel(
        definition.title,
        cols,
        all,
        `${definition.id}-${String(filters.from ?? filters.date_from ?? 'reporte')}.xlsx`,
      )
      toast.success('Excel exportado')
    } catch {
      toast.error('No se pudo exportar Excel')
    } finally {
      setLoading(false)
    }
  }

  return {
    rows: displayRows,
    allRows: rows,
    total: displayTotal,
    summary,
    loading,
    page,
    perPage,
    filters,
    perPageOptions: PER_PAGE_OPTIONS,
    setPage,
    setPerPage: (n: number) => {
      setPerPage(n)
      setPage(1)
    },
    patchFilters,
    reload: load,
    exportPdf,
    exportExcel,
    paginationMode: definition.paginationMode,
  }
}
