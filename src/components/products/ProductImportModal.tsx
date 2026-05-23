import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import type { Category } from '@/services/products.service'
import {
  downloadRestaurantProductTemplate,
  importRestaurantProducts,
  validateRestaurantProductExcel,
  type ImportRowIssue,
  type ImportValidationResult,
  type ParsedImportRow,
} from '@/utils/restaurantProductImport'

type Props = {
  open: boolean
  onClose: () => void
  categories: Category[]
  onImported: () => void
}

type Step = 'select' | 'validated' | 'importing' | 'done'

export function ProductImportModal({ open, onClose, categories, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [fileName, setFileName] = useState('')
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<ImportValidationResult | null>(null)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; current?: string }>({
    done: 0,
    total: 0,
  })
  const [importResult, setImportResult] = useState<{
    created: number
    stockRegistered: number
    failed: { row: number; name: string; error: string }[]
  } | null>(null)

  const reset = () => {
    setStep('select')
    setFileName('')
    setValidation(null)
    setImportProgress({ done: 0, total: 0 })
    setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.name.match(/\.xlsx$/i)) {
      toast.error('Solo se admiten archivos .xlsx')
      return
    }
    setFileName(file.name)
    setValidating(true)
    setValidation(null)
    setImportResult(null)
    try {
      const result = await validateRestaurantProductExcel(file)
      setValidation(result)
      setStep('validated')
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} error(es) de validación. Corrige el Excel antes de importar.`)
      } else if (result.rows.length === 0) {
        toast.error('No hay filas de productos para importar')
      } else {
        toast.success(`${result.rows.length} fila(s) validadas correctamente`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo')
      setStep('select')
    } finally {
      setValidating(false)
    }
  }

  const handleImport = async () => {
    if (!validation || validation.errors.length > 0 || validation.rows.length === 0) return
    setStep('importing')
    setImportProgress({ done: 0, total: validation.rows.length })
    try {
      const result = await importRestaurantProducts(validation.rows, categories, setImportProgress)
      setImportResult(result)
      setStep('done')
      if (result.created > 0) {
        const stockMsg =
          result.stockRegistered > 0
            ? ` · ${result.stockRegistered} con stock inicial en kardex`
            : ''
        toast.success(`${result.created} producto(s) importados${stockMsg}`)
        onImported()
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} fila(s) no se guardaron`)
      }
    } catch {
      toast.error('Error durante la importación')
      setStep('validated')
    }
  }

  const canImport =
    validation != null && validation.errors.length === 0 && validation.rows.length > 0 && step === 'validated'
  const isImporting = step === 'importing'
  const importPct =
    importProgress.total > 0 ? Math.min(100, Math.round((importProgress.done / importProgress.total) * 100)) : 0

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-stone-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-rest-600 shrink-0" />
            <h3 className="font-bold text-stone-800 truncate">Importar productos (Excel)</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="p-2 rounded-lg hover:bg-stone-100 shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative p-4 sm:p-5 overflow-y-auto min-h-0 space-y-4">
          <p className="text-sm text-stone-600">
            Descarga la plantilla, completa los datos y súbela. La columna{' '}
            <strong>stock_inicial</strong> registra entrada en kardex (sucursal activa). Si hay cantidad,
            se activa control de stock automáticamente.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadRestaurantProductTemplate()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50"
            >
              <Download size={16} /> Descargar plantilla
            </button>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-rest-600 text-white hover:bg-rest-700 cursor-pointer">
              <Upload size={16} /> Elegir archivo .xlsx
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </label>
          </div>

          {fileName && (
            <p className="text-xs text-stone-500">
              Archivo: <span className="font-medium text-stone-700">{fileName}</span>
            </p>
          )}

          {validating && (
            <div className="flex items-center gap-2 text-sm text-stone-600 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-rest-600" />
              Validando columnas y datos…
            </div>
          )}

          {validation && !validating && step !== 'importing' && (
            <ValidationSummary validation={validation} />
          )}

          {step === 'done' && importResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm">
              <p className="font-medium text-emerald-800">
                Importación finalizada: {importResult.created} creado(s)
                {importResult.stockRegistered > 0 &&
                  `, ${importResult.stockRegistered} con stock inicial (kardex)`}
                {importResult.failed.length > 0 && `, ${importResult.failed.length} con error`}.
              </p>
              {importResult.failed.length > 0 && (
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-700 space-y-1">
                  {importResult.failed.map((f) => (
                    <li key={`${f.row}-${f.name}`}>
                      Fila {f.row} ({f.name}): {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isImporting && (
            <ImportLoadingOverlay
              done={importProgress.done}
              total={importProgress.total}
              percent={importPct}
              current={importProgress.current}
            />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-4 sm:px-5 py-3 border-t border-stone-200 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            {step === 'done' ? 'Cerrar' : 'Cancelar'}
          </button>
          {step === 'validated' && (
            <button
              type="button"
              disabled={!canImport}
              onClick={() => void handleImport()}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-40 disabled:pointer-events-none"
            >
              Importar {validation?.rows.length ?? 0} producto(s)
            </button>
          )}
          {isImporting && (
            <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-rest-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              Importando…
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ImportLoadingOverlay({
  done,
  total,
  percent,
  current,
}: {
  done: number
  total: number
  percent: number
  current?: string
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 backdrop-blur-[2px] rounded-b-2xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm mx-4 text-center space-y-4 py-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rest-50 border border-rest-100 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-rest-600" aria-hidden />
        </div>
        <div>
          <p className="font-semibold text-stone-800">Importando productos</p>
          <p className="text-sm text-stone-500 mt-1">Importación masiva por lotes (sin límite de 300 req/min)…</p>
        </div>
        <div className="space-y-2 text-left">
          <div className="flex justify-between text-xs font-medium text-stone-600">
            <span>
              {done} de {total} producto(s)
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-rest-500 to-rest-600 transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          {current && (
            <p className="text-xs text-stone-500 truncate" title={current}>
              Procesando: <span className="font-medium text-stone-700">{current}</span>
            </p>
          )}
        </div>
        <p className="text-xs text-amber-700/90">No cierres esta ventana hasta que termine.</p>
      </div>
    </div>
  )
}

function ValidationSummary({ validation }: { validation: ImportValidationResult }) {
  const ok = validation.errors.length === 0 && validation.rows.length > 0

  return (
    <div className="space-y-3">
      <div
        className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
          ok ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800' : 'border-amber-200 bg-amber-50/80 text-amber-900'
        }`}
      >
        {ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
        <div>
          {ok ? (
            <p>
              <strong>{validation.totalRows}</strong> fila(s) listas para importar. Pulsa &quot;Importar&quot; para
              guardarlas.
            </p>
          ) : (
            <p>
              {validation.totalRows > 0 && (
                <>
                  <strong>{validation.totalRows}</strong> fila(s) detectadas.{' '}
                </>
              )}
              <strong>{validation.errors.length}</strong> error(es). Corrige el Excel y vuelve a cargarlo.
            </p>
          )}
        </div>
      </div>

      {validation.errors.length > 0 && <ErrorsList errors={validation.errors} />}
      {validation.rows.length > 0 && <PreviewTable rows={validation.rows.slice(0, 15)} />}
      {validation.rows.length > 15 && (
        <p className="text-xs text-stone-500">Vista previa: primeras 15 de {validation.rows.length} filas.</p>
      )}
    </div>
  )
}

function ErrorsList({ errors }: { errors: ImportRowIssue[] }) {
  const shown = errors.slice(0, 40)
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 max-h-40 overflow-y-auto">
      <ul className="divide-y divide-red-100 text-xs">
        {shown.map((err, i) => (
          <li key={`${err.row}-${err.field}-${i}`} className="px-3 py-2 text-red-800">
            {err.row > 0 ? `Fila ${err.row}` : 'Archivo'} · {String(err.field ?? err.column)}: {err.message}
            {err.value != null && err.value !== '' && (
              <span className="text-red-600/80"> ({String(err.value)})</span>
            )}
          </li>
        ))}
      </ul>
      {errors.length > 40 && (
        <p className="px-3 py-2 text-xs text-red-600">… y {errors.length - 40} error(es) más</p>
      )}
    </div>
  )
}

function PreviewTable({ rows }: { rows: ParsedImportRow[] }) {
  return (
    <div className="rounded-xl border border-stone-200 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-stone-50">
          <tr>
            <th className="text-left px-2 py-2 font-semibold text-stone-600">#</th>
            <th className="text-left px-2 py-2 font-semibold text-stone-600">Nombre</th>
            <th className="text-left px-2 py-2 font-semibold text-stone-600">Código</th>
            <th className="text-right px-2 py-2 font-semibold text-stone-600">Precio</th>
            <th className="text-left px-2 py-2 font-semibold text-stone-600">Categoría</th>
            <th className="text-left px-2 py-2 font-semibold text-stone-600">Área</th>
            <th className="text-right px-2 py-2 font-semibold text-stone-600">Stock ini.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowNumber} className="border-t border-stone-100">
              <td className="px-2 py-1.5 text-stone-500">{r.rowNumber}</td>
              <td className="px-2 py-1.5">{r.nombre}</td>
              <td className="px-2 py-1.5 text-stone-600">{r.codigo || '—'}</td>
              <td className="px-2 py-1.5 text-right">{r.precio_venta.toFixed(2)}</td>
              <td className="px-2 py-1.5">{r.categoria || '—'}</td>
              <td className="px-2 py-1.5">{r.area_preparacion || '—'}</td>
              <td className="px-2 py-1.5 text-right">{r.stock_inicial > 0 ? r.stock_inicial : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
