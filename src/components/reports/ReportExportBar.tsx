import { FileDown, FileSpreadsheet } from 'lucide-react'

type Props = {
  onExportPdf: () => void
  onExportExcel: () => void
  loading?: boolean
}

export function ReportExportBar({ onExportPdf, onExportExcel, loading }: Props) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        disabled={loading}
        onClick={() => void onExportPdf()}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 lg:gap-1.5 lg:px-3 lg:py-2 rounded-lg lg:rounded-xl text-xs lg:text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors shrink-0"
      >
        <FileDown size={16} />
        PDF
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void onExportExcel()}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 lg:gap-1.5 lg:px-3 lg:py-2 rounded-lg lg:rounded-xl text-xs lg:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0"
      >
        <FileSpreadsheet size={16} />
        Excel
      </button>
    </div>
  )
}
