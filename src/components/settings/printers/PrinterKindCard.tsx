import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import type { PrinterConfig, PrinterConnectionMode, PrinterKind } from '@/services/printers.service'
import {
  availableConnectionModes,
  effectiveConnection,
} from '@/services/printers.service'
import type { SearchableSelectOption } from '@/components/SearchableSelect'
import { ConnectionMethodPicker } from './ConnectionMethodPicker'
import { NetworkPrinterFields } from './NetworkPrinterFields'
import { WindowsPrinterFields } from './WindowsPrinterFields'
import { BluetoothPrinterFields } from './BluetoothPrinterFields'
import { TicketGeneralFields } from './TicketGeneralFields'
import { printerConfigReady, printerKindSubtitle, printerKindTitle } from './helpers'

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

  useEffect(() => {
    if (cfg.connection !== resolvedConnection) {
      onChange({ connection: resolvedConnection })
    }
  }, [cfg.connection, resolvedConnection, onChange])

  const setConnection = (connection: PrinterConnectionMode) => {
    onChange({ connection })
  }

  return (
    <section className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center shrink-0">
            <Printer size={18} />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">{printerKindTitle(kind)}</h2>
            <p className="text-sm text-stone-600">{printerKindSubtitle(kind)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !printerConfigReady({ ...cfg, connection: resolvedConnection })}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50 shrink-0 self-start"
        >
          {testing ? 'Probando…' : 'Probar impresión'}
        </button>
      </div>

      <div className="mt-5 space-y-4">
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
      </div>
    </section>
  )
}
