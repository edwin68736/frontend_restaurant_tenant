import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  page: number
  perPage: number
  total: number
  perPageOptions: readonly number[]
  onPageChange: (p: number) => void
  onPerPageChange: (n: number) => void
}

export function ReportPagination({
  page,
  perPage,
  total,
  perPageOptions,
  onPageChange,
  onPerPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-stone-100 bg-stone-50/80">
      <p className="text-xs text-stone-500">
        {total === 0 ? 'Sin registros' : `Mostrando ${from}–${to} de ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white"
        >
          {perPageOptions.map((n) => (
            <option key={n} value={n}>{n} / página</option>
          ))}
        </select>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-white"
          aria-label="Anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-stone-600 tabular-nums min-w-[4rem] text-center">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-white"
          aria-label="Siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
