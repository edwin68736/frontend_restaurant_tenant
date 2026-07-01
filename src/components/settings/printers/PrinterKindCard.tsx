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

      {!isPrinterConfigReady({ ...cfg, connection: resolvedConnection }) && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Completa los datos de conexión para poder imprimir con esta configuración.
        </p>
      )}
    </PrinterSettingsSection>
  )
}
