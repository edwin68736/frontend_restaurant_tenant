import type { ReportTableProps } from '@/reports/types'

export function ReportTable<T extends object>({
  columns,
  rows,
  loading,
  emptyMessage = 'Sin datos para mostrar',
  renderCell,
  fill = false,
}: ReportTableProps<T>) {
  return (
    <div
      className={
        fill
          ? 'flex-1 min-h-[12rem] overflow-auto'
          : 'overflow-auto max-h-[60vh]'
      }
    >
      <table className="w-full text-xs sm:text-sm min-w-[720px]">
        <thead className="bg-stone-50 sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="text-left px-2 py-2 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-stone-500 uppercase whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-stone-400">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-stone-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50/50">
                {columns.map((col) => {
                  const raw = row[col.key as keyof T]
                  const content = renderCell
                    ? renderCell({ row, column: col, value: raw })
                    : col.format
                      ? col.format(raw, row)
                      : String(raw ?? '—')
                  return (
                    <td key={String(col.key)} className="px-2 py-1.5 sm:px-4 sm:py-2 text-stone-700 whitespace-nowrap">
                      {content}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
