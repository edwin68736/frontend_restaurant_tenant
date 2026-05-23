import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Printer, RefreshCw } from 'lucide-react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect'
import {
  listInstalledPrinters,
  loadStoredPrinterSettings,
  saveStoredPrinterSettings,
  testPrint,
  type PrinterConfig,
  type PrinterConnectionMode,
  type PrinterKind,
  type PrinterPaperWidth,
  type StoredPrinterSettings,
} from '@/services/printers.service'

function titleFor(kind: PrinterKind) {
  if (kind === 'comandas') return 'Impresora de comandas'
  if (kind === 'precuenta') return 'Impresora de precuenta'
  return 'Impresora de documentos'
}

function subtitleFor(kind: PrinterKind) {
  if (kind === 'comandas') return 'Para imprimir comandas de cocina/bar'
  if (kind === 'precuenta') return 'Para imprimir la precuenta'
  return 'Para boleta/factura/nota de venta'
}

export function PrintersSettingsTab() {
  const [printers, setPrinters] = useState<string[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(true)
  const [settings, setSettings] = useState<StoredPrinterSettings>(() => loadStoredPrinterSettings())
  const [testing, setTesting] = useState<Partial<Record<PrinterKind, boolean>>>({})

  const printerOptions = useMemo((): SearchableSelectOption[] => {
    const opts = printers.map((p) => ({ value: p, label: p }))
    return [{ value: '', label: 'Sin asignar' }, ...opts]
  }, [printers])

  const paperOptions = useMemo((): SearchableSelectOption[] => {
    return [
      { value: 80, label: '80mm' },
      { value: 58, label: '58mm' },
    ]
  }, [])

  const refreshPrinters = () => {
    setLoadingPrinters(true)
    listInstalledPrinters()
      .then((list) => setPrinters(list))
      .catch(() => {
        setPrinters([])
        toast.error('No se pudo cargar la lista de impresoras')
      })
      .finally(() => setLoadingPrinters(false))
  }

  useEffect(() => {
    refreshPrinters()
  }, [])

  useEffect(() => {
    saveStoredPrinterSettings(settings)
  }, [settings])

  const updateKind = (kind: PrinterKind, patch: Partial<PrinterConfig>) => {
    setSettings((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }))
  }

  const canTestPrinter = (cfg: PrinterConfig) => {
    if (cfg.connection === 'network') return Boolean(cfg.tcpHost?.trim())
    return Boolean(cfg.printerName?.trim())
  }

  const onTest = async (kind: PrinterKind) => {
    const cfg = settings[kind]
    if (cfg.connection === 'network') {
      if (!cfg.tcpHost?.trim()) {
        toast.error('Indica la IP o host de la impresora antes de probar')
        return
      }
    } else if (!cfg.printerName?.trim()) {
      toast.error('Selecciona una impresora Windows antes de probar')
      return
    }
    setTesting((prev) => ({ ...prev, [kind]: true }))
    try {
      const msg = await testPrint({
        kind,
        connection: cfg.connection,
        printerName: cfg.printerName,
        tcpHost: cfg.tcpHost,
        tcpPort: cfg.tcpPort,
        paperWidthMm: cfg.paperWidthMm,
      })
      toast.success(msg || 'Prueba enviada')
    } catch (e) {
      console.error('[printer test error]', e)
      toast.error('No se pudo imprimir. Revisa la consola de Tauri (cargo) para ver el error.')
    } finally {
      setTesting((prev) => ({ ...prev, [kind]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Configuración local de este equipo (no se sincroniza con el servidor).</p>
        <button
          type="button"
          onClick={refreshPrinters}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60 shrink-0"
          disabled={loadingPrinters}
        >
          <RefreshCw size={16} />
          {loadingPrinters ? 'Cargando...' : 'Actualizar impresoras'}
        </button>
      </div>

      {(['comandas', 'precuenta', 'documentos'] as const).map((kind) => {
        const cfg = settings[kind]
        const setConn = (connection: PrinterConnectionMode) => {
          updateKind(kind, { connection })
        }
        return (
          <div key={kind} className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center">
                  <Printer size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-stone-900">{titleFor(kind)}</h2>
                  <p className="text-sm text-stone-600">{subtitleFor(kind)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTest(kind)}
                disabled={testing[kind] || !canTestPrinter(cfg)}
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50"
              >
                {testing[kind] ? 'Probando...' : 'Probar'}
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-stone-600 mb-2">Conexión</p>
              <div className="inline-flex rounded-xl border border-stone-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setConn('windows')}
                  className={`px-3 py-2 text-xs font-semibold ${
                    cfg.connection !== 'network' ? 'bg-rest-600 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Impresora Windows
                </button>
                <button
                  type="button"
                  onClick={() => setConn('network')}
                  className={`px-3 py-2 text-xs font-semibold border-l border-stone-200 ${
                    cfg.connection === 'network' ? 'bg-rest-600 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Red (TCP/IP)
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {cfg.connection !== 'network' ? (
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Impresora Windows</label>
                  <SearchableSelect
                    value={cfg.printerName || ''}
                    onChange={(v) => updateKind(kind, { printerName: v == null ? '' : String(v) })}
                    options={printerOptions}
                    placeholder="Selecciona una impresora"
                    allowClear
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">IP o host</label>
                    <input
                      type="text"
                      value={cfg.tcpHost}
                      onChange={(e) => updateKind(kind, { tcpHost: e.target.value })}
                      placeholder="192.168.1.50"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Puerto TCP</label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={cfg.tcpPort || 9100}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10)
                        updateKind(kind, { tcpPort: Number.isFinite(n) ? n : 9100 })
                      }}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
              <div className={cfg.connection === 'network' ? 'md:col-span-2' : undefined}>
                <label className="block text-xs font-medium text-stone-600 mb-1">Tamaño de ticket</label>
                <SearchableSelect
                  value={cfg.paperWidthMm}
                  onChange={(v) => updateKind(kind, { paperWidthMm: (Number(v) === 58 ? 58 : 80) as PrinterPaperWidth })}
                  options={paperOptions}
                  searchable={false}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-stone-600">Impresión automática</div>
                <div className="text-xs text-stone-500">Si está desactivado, solo imprime al pulsar Imprimir.</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-stone-700 select-none">
                <input
                  type="checkbox"
                  checked={Boolean(cfg.autoPrint)}
                  onChange={(e) => updateKind(kind, { autoPrint: e.target.checked })}
                  className="h-4 w-4 accent-rest-600"
                />
                Activado
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}
