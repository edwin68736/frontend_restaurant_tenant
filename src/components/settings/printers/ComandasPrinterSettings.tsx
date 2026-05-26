import { useEffect, useMemo, useState } from 'react'
import { ChefHat, ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { clsx } from 'clsx'
import {
  PREPARATION_AREAS_WITH_VALUE,
  preparationAreaLabel,
  normalizePreparationAreaKey,
} from '@/constants/preparationAreas'
import type { PrinterConfig } from '@/services/printers.service'
import { isPrinterConfigReady } from '@/services/printers.service'
import { productsService } from '@/services/products.service'
import type { SearchableSelectOption } from '@/components/SearchableSelect'
import { PrinterConfigEditor } from './PrinterConfigEditor'
import { emptyPrinterSettings, normalizeSlot } from '@/services/printers.service'

type Props = {
  comandasDefault: PrinterConfig
  comandasByArea: Record<string, PrinterConfig>
  printerOptions: SearchableSelectOption[]
  paperOptions: SearchableSelectOption[]
  loadingPrinters: boolean
  onRefreshPrinters: () => void
  onDefaultChange: (patch: Partial<PrinterConfig>) => void
  onAreaChange: (areaKey: string, patch: Partial<PrinterConfig>) => void
  onAreaClear: (areaKey: string) => void
  onTestDefault: () => void
  onTestArea: (areaKey: string) => void
  testingDefault: boolean
  testingArea: string | null
}

function emptyAreaSlot(defaultCfg: PrinterConfig): PrinterConfig {
  const base = emptyPrinterSettings().comandasDefault
  return {
    ...base,
    paperWidthMm: defaultCfg.paperWidthMm,
    autoPrint: defaultCfg.autoPrint,
  }
}

export function ComandasPrinterSettings({
  comandasDefault,
  comandasByArea,
  printerOptions,
  paperOptions,
  loadingPrinters,
  onRefreshPrinters,
  onDefaultChange,
  onAreaChange,
  onAreaClear,
  onTestDefault,
  onTestArea,
  testingDefault,
  testingArea,
}: Props) {
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({})
  const [productAreaKeys, setProductAreaKeys] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    productsService
      .listRestaurantAll()
      .then((products) => {
        if (cancelled) return
        const keys = new Set<string>()
        for (const p of products ?? []) {
          const k = normalizePreparationAreaKey(p.preparation_area)
          if (k) keys.add(k)
        }
        setProductAreaKeys([...keys].sort())
      })
      .catch(() => {
        if (!cancelled) setProductAreaKeys([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const areaKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const a of PREPARATION_AREAS_WITH_VALUE) {
      if (a.value) keys.add(a.value)
    }
    for (const k of productAreaKeys) keys.add(k)
    for (const k of Object.keys(comandasByArea)) keys.add(k)
    return [...keys].sort()
  }, [productAreaKeys, comandasByArea])

  const toggleArea = (key: string) => {
    setExpandedAreas((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const enableArea = (key: string) => {
    if (!comandasByArea[key]) {
      onAreaChange(key, emptyAreaSlot(comandasDefault))
    }
    setExpandedAreas((prev) => ({ ...prev, [key]: true }))
  }

  return (
    <section className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center shrink-0">
            <ChefHat size={18} />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">Impresoras de comandas</h2>
            <p className="text-sm text-stone-600">
              Por defecto y por área de preparación (cocina, bar, etc.). Sin área o sin impresora de área → se usa la
              por defecto.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-rest-200 bg-rest-50/40 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-stone-900">Impresora de comandas por defecto</p>
            <p className="text-xs text-stone-500">Productos sin área o áreas sin impresora dedicada.</p>
          </div>
          <button
            type="button"
            onClick={onTestDefault}
            disabled={testingDefault || !isPrinterConfigReady(comandasDefault)}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50 shrink-0"
          >
            {testingDefault ? 'Probando…' : 'Probar'}
          </button>
        </div>
        <PrinterConfigEditor
          cfg={comandasDefault}
          printerOptions={printerOptions}
          paperOptions={paperOptions}
          loadingPrinters={loadingPrinters}
          onRefreshPrinters={onRefreshPrinters}
          onChange={onDefaultChange}
          showAutoPrint
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold text-stone-900">Por área de preparación</p>
        <p className="text-xs text-stone-500 -mt-2">
          Opcional. Si no configuras un área, sus comandas salen por la impresora por defecto.
        </p>

        {areaKeys.length === 0 && (
          <p className="text-xs text-stone-500 rounded-lg border border-dashed border-stone-200 px-3 py-4 text-center">
            No hay áreas definidas en productos. Usa solo la impresora por defecto.
          </p>
        )}

        {areaKeys.map((areaKey) => {
          const dedicated = Boolean(comandasByArea[areaKey])
          const areaCfg = dedicated
            ? normalizeSlot(comandasByArea[areaKey])
            : emptyAreaSlot(comandasDefault)
          const expanded = expandedAreas[areaKey] ?? dedicated
          const ready = dedicated && isPrinterConfigReady(areaCfg)

          return (
            <div key={areaKey} className="rounded-xl border border-stone-200">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 border-b border-stone-100 rounded-t-xl">
                <button
                  type="button"
                  onClick={() => (dedicated ? toggleArea(areaKey) : enableArea(areaKey))}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <Printer size={16} className="text-stone-500 shrink-0" />
                  <span className="font-semibold text-sm text-stone-900 truncate">
                    {preparationAreaLabel(areaKey)}
                  </span>
                  <span
                    className={clsx(
                      'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0',
                      ready
                        ? 'bg-emerald-100 text-emerald-800'
                        : dedicated
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-stone-200 text-stone-600',
                    )}
                  >
                    {ready ? 'Lista' : dedicated ? 'Incompleta' : 'Por defecto'}
                  </span>
                  {expanded ? <ChevronUp size={16} className="ml-auto shrink-0" /> : <ChevronDown size={16} className="ml-auto shrink-0" />}
                </button>
                {dedicated && (
                  <button
                    type="button"
                    onClick={() => onAreaClear(areaKey)}
                    className="text-xs text-stone-500 hover:text-red-600 px-2 py-1 shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {expanded && dedicated && (
                <div className="p-4 space-y-3 overflow-visible">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onTestArea(areaKey)}
                      disabled={testingArea === areaKey || !isPrinterConfigReady(areaCfg)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-50"
                    >
                      {testingArea === areaKey ? 'Probando…' : 'Probar área'}
                    </button>
                  </div>
                  <PrinterConfigEditor
                    cfg={areaCfg}
                    printerOptions={printerOptions}
                    paperOptions={paperOptions}
                    loadingPrinters={loadingPrinters}
                    onRefreshPrinters={onRefreshPrinters}
                    onChange={(patch) => onAreaChange(areaKey, patch)}
                    showAutoPrint={false}
                    compact
                  />
                </div>
              )}

              {expanded && !dedicated && (
                <div className="p-4">
                  <p className="text-xs text-stone-600 mb-3">
                    Las comandas de <strong>{preparationAreaLabel(areaKey)}</strong> se imprimen en la impresora por
                    defecto.
                  </p>
                  <button
                    type="button"
                    onClick={() => enableArea(areaKey)}
                    className="text-sm font-semibold text-rest-700 hover:text-rest-800"
                  >
                    + Configurar impresora dedicada
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
