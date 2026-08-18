import { Printer } from 'lucide-react'
import type { PrinterConfig, PrinterConnectionMode, PrinterKind } from '@/services/printers.service'
import {
  availableConnectionModes,
  effectiveConnection,
  isPrinterConfigReady,
} from '@/services/printers.service'
import type { SearchableSelectOption } from '@/components/SearchableSelect'
import { ConnectionMethodPicker } from './ConnectionMethodPicker'
import { NetworkPrinterFields } from './NetworkPrinterFields'
import { WindowsPrinterFields } from './WindowsPrinterFields'
import { BluetoothPrinterFields } from './BluetoothPrinterFields'
import { TicketGeneralFields } from './TicketGeneralFields'
import { PrinterSettingsSection } from './PrinterSettingsSection'
import { printerConfigReady, printerKindSubtitle, printerKindTitle } from './helpers'
import { useEffect } from 'react'

type Props = {
  kind: PrinterKind
  cfg: PrinterConfig
  printerOptions: SearchableSelectOption[]
  paperOptions: SearchableSelectOption[]
  loadingPrinters: boolean
  onRefreshPrinters: () => void
  onChange: (patch: Partial<PrinterConfig>) => void
  onTest: () => void
  testing: boolean
}

export function PrinterKindCard({
  kind,
  cfg,
  printerOptions,
  paperOptions,
  loadingPrinters,
  onRefreshPrinters,
  onChange,
  onTest,
  testing,
}: Props) {
  const modes = availableConnectionModes()
  const resolvedConnection = effectiveConnection(cfg)
  const ready = printerConfigReady({ ...cfg, connection: resolvedConnection })

  useEffect(() => {
    if (cfg.connection !== resolvedConnection) {
      onChange({ connection: resolvedConnection })
    }
  }, [cfg.connection, resolvedConnection, onChange])

  const setConnection = (connection: PrinterConnectionMode) => {
    onChange({ connection })
  }

  return (
    <PrinterSettingsSection
      title={printerKindTitle(kind)}
      subtitle={printerKindSubtitle(kind)}
      icon={<Printer size={18} />}
      defaultOpen={false}
      badge={
        ready ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
            Lista
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-stone-200 text-stone-600">
            Sin configurar
          </span>
        )
      }
      actions={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTest()
          }}
          disabled={testing || !ready}
          className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50 whitespace-nowrap"
        >
          {testing ? 'Probando…' : 'Probar'}
        </button>
      }
    >
      <ConnectionMethodPicker modes={modes} value={resolvedConnection} onChange={setConnection} />

      {resolvedConnection === 'windows' && (
        <WindowsPrinterFields
          cfg={cfg}
          printerOptions={printerOptions}
          loadingPrinters={loadingPrinters}
          onRefreshPrinters={onRefreshPrinters}
          onChange={onChange}
        />
      )}
      {resolvedConnection === 'network' && <NetworkPrinterFields cfg={cfg} onChange={onChange} />}
      {resolvedConnection === 'bluetooth' && <BluetoothPrinterFields cfg={cfg} onChange={onChange} />}

      <TicketGeneralFields cfg={cfg} paperOptions={paperOptions} onChange={onChange} />

      {kind === 'documentos' && (
        <label className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-stone-200 p-4 cursor-pointer hover:bg-stone-50/60">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-stone-900">Abrir gaveta de dinero</span>
            <span className="block text-xs text-stone-500 mt-0.5">
              Al imprimir boleta, factura o nota de venta, se abre el cajón de dinero conectado a esta
              impresora. Si está desactivado, solo se imprime el comprobante.
            </span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(cfg.openDrawerOnPrint)}
            onChange={(e) => onChange({ openDrawerOnPrint: e.target.checked })}
            className="h-5 w-5 shrink-0 accent-rest-600"
            aria-label="Abrir gaveta de dinero"
          />
        </label>
      )}

      {!isPrinterConfigReady({ ...cfg, connection: resolvedConnection }) && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Completa los datos de conexión para poder imprimir con esta configuración.
        </p>
      )}
    </PrinterSettingsSection>
  )
}
