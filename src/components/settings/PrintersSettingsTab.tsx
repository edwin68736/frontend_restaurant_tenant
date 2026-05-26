import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Smartphone, Monitor } from 'lucide-react'
import {
  getPrinterPlatformCapabilities,
  isNativePrintAvailable,
  listInstalledPrinters,
  loadStoredPrinterSettings,
  normalizeSlot,
  saveStoredPrinterSettings,
  testPrint,
  type PrinterConfig,
  type PrinterKind,
  type StoredPrinterSettings,
} from '@/services/printers.service'
import { preparationAreaLabel } from '@/constants/preparationAreas'
import { isCapacitorAndroid, isTauriDesktop } from '@/lib/platform/detect'
import { PrinterKindCard } from './printers/PrinterKindCard'
import { ComandasPrinterSettings } from './printers/ComandasPrinterSettings'

export function PrintersSettingsTab() {
  const [printers, setPrinters] = useState<string[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [settings, setSettings] = useState<StoredPrinterSettings>(() => loadStoredPrinterSettings())
  const [testing, setTesting] = useState<Partial<Record<PrinterKind, boolean>>>({})
  const [testingArea, setTestingArea] = useState<string | null>(null)

  const caps = getPrinterPlatformCapabilities()

  const printerOptions = useMemo(() => {
    const opts = printers.map((p) => ({ value: p, label: p }))
    return [{ value: '', label: 'Sin asignar' }, ...opts]
  }, [printers])

  const paperOptions = useMemo(
    () => [
      { value: 80, label: '80 mm' },
      { value: 58, label: '58 mm' },
    ],
    [],
  )

  const refreshPrinters = () => {
    if (!isTauriDesktop()) return
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
    if (isTauriDesktop()) refreshPrinters()
  }, [])

  useEffect(() => {
    saveStoredPrinterSettings(settings)
  }, [settings])

  const runTest = async (cfg: PrinterConfig, label: string) => {
    const msg = await testPrint({
      kind: 'comandas',
      connection: cfg.connection,
      printerName: cfg.printerName,
      tcpHost: cfg.tcpHost,
      tcpPort: cfg.tcpPort,
      paperWidthMm: cfg.paperWidthMm,
      bluetoothMac: cfg.bluetoothMac,
      bluetoothName: cfg.bluetoothName,
    })
    toast.success(msg || `Prueba enviada (${label})`)
  }

  const onTestDefault = async () => {
    setTesting((prev) => ({ ...prev, comandas: true }))
    try {
      await runTest(settings.comandasDefault, 'por defecto')
    } catch (e) {
      console.error('[printer test default]', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo imprimir la prueba')
    } finally {
      setTesting((prev) => ({ ...prev, comandas: false }))
    }
  }

  const onTestArea = async (areaKey: string) => {
    const cfg = settings.comandasByArea[areaKey]
    if (!cfg) return
    setTestingArea(areaKey)
    try {
      await runTest(cfg, preparationAreaLabel(areaKey))
    } catch (e) {
      console.error('[printer test area]', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo imprimir la prueba')
    } finally {
      setTestingArea(null)
    }
  }

  const onTestKind = async (kind: 'precuenta' | 'documentos') => {
    const cfg = settings[kind]
    setTesting((prev) => ({ ...prev, [kind]: true }))
    try {
      const msg = await testPrint({
        kind,
        connection: cfg.connection,
        printerName: cfg.printerName,
        tcpHost: cfg.tcpHost,
        tcpPort: cfg.tcpPort,
        paperWidthMm: cfg.paperWidthMm,
        bluetoothMac: cfg.bluetoothMac,
        bluetoothName: cfg.bluetoothName,
      })
      toast.success(msg || 'Prueba enviada')
    } catch (e) {
      console.error('[printer test]', e)
      toast.error(e instanceof Error ? e.message : 'No se pudo imprimir la prueba')
    } finally {
      setTesting((prev) => ({ ...prev, [kind]: false }))
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-stone-50/90 px-4 py-3 text-sm text-stone-700">
        <p className="font-semibold text-stone-900">Configuración local</p>
        <p className="text-xs text-stone-500 mt-1">
          Se guarda en este dispositivo (localStorage). No se sincroniza con el servidor.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {isTauriDesktop() && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700">
              <Monitor size={14} />
              Windows: USB + Red
            </span>
          )}
          {isCapacitorAndroid() && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700">
              <Smartphone size={14} />
              Android: Bluetooth + Red
            </span>
          )}
          {!isNativePrintAvailable() && (
            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
              En navegador web solo puedes guardar ajustes; la impresión directa requiere la app instalada.
            </span>
          )}
        </div>
      </div>

      <ComandasPrinterSettings
        comandasDefault={settings.comandasDefault}
        comandasByArea={settings.comandasByArea}
        printerOptions={printerOptions}
        paperOptions={paperOptions}
        loadingPrinters={loadingPrinters}
        onRefreshPrinters={refreshPrinters}
        onDefaultChange={(patch) =>
          setSettings((prev) => ({
            ...prev,
            comandasDefault: { ...prev.comandasDefault, ...patch },
          }))
        }
        onAreaChange={(areaKey, patch) =>
          setSettings((prev) => ({
            ...prev,
            comandasByArea: {
              ...prev.comandasByArea,
              [areaKey]: normalizeSlot({ ...prev.comandasByArea[areaKey], ...patch }),
            },
          }))
        }
        onAreaClear={(areaKey) =>
          setSettings((prev) => {
            const next = { ...prev.comandasByArea }
            delete next[areaKey]
            return { ...prev, comandasByArea: next }
          })
        }
        onTestDefault={() => void onTestDefault()}
        onTestArea={(areaKey) => void onTestArea(areaKey)}
        testingDefault={Boolean(testing.comandas)}
        testingArea={testingArea}
      />

      {(['precuenta', 'documentos'] as const).map((kind) => (
        <PrinterKindCard
          key={kind}
          kind={kind}
          cfg={settings[kind]}
          printerOptions={printerOptions}
          paperOptions={paperOptions}
          loadingPrinters={loadingPrinters}
          onRefreshPrinters={refreshPrinters}
          onChange={(patch) => setSettings((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }))}
          onTest={() => void onTestKind(kind)}
          testing={Boolean(testing[kind])}
        />
      ))}

      {!caps.windowsUsb && !caps.bluetooth && caps.network && (
        <p className="text-xs text-stone-500 px-1">
          Usa la IP fija de la ticketera en la misma red Wi‑Fi que el dispositivo.
        </p>
      )}
    </div>
  )
}
