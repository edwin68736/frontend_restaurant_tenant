import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Printer } from 'lucide-react'
import { clsx } from 'clsx'
import {
  preparationAreaLabel,
  normalizePreparationAreaKey,
} from '@/constants/preparationAreas'
import type { PrinterConfig } from '@/services/printers.service'
import { isPrinterConfigReady } from '@/services/printers.service'
import { productsService } from '@/services/products.service'
import type { SearchableSelectOption } from '@/components/SearchableSelect'
import { PrinterConfigEditor } from './PrinterConfigEditor'
import { PrinterSettingsSection } from './PrinterSettingsSection'
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
  const [catalogAreaKeys, setCatalogAreaKeys] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    productsService
      .listPreparationAreas()
      .then((areas) => {
        if (cancelled) return
        setCatalogAreaKeys(
          (areas ?? [])
            .map((a) => normalizePreparationAreaKey(a.slug))
            .filter(Boolean)
            .sort(),
        )
      })
      .catch(() => {
        if (!cancelled) setCatalogAreaKeys([])
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    for (const k of catalogAreaKeys) keys.add(k)
    for (const k of productAreaKeys) keys.add(k)
    for (const k of Object.keys(comandasByArea)) keys.add(k)
    return [...keys].sort()
  }, [catalogAreaKeys, productAreaKeys, comandasByArea])

  const configuredAreasCount = useMemo(
    () => areaKeys.filter((k) => Boolean(comandasByArea[k])).length,
    [areaKeys, comandasByArea],
  )

  const defaultReady = isPrinterConfigReady(comandasDefault)

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
    <PrinterSettingsSection
      title="Impresoras de comandas"
      subtitle="Por defecto y por área de preparación (cocina, bar, etc.). Sin área dedicada → impresora por defecto."
      icon={<ChefHat size={18} />}
      defaultOpen={false}
      badge={
        defaultReady ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
            Por defecto lista
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-stone-200 text-stone-600">
            Configurar
          </span>
        )
      }
    >
      <PrinterSettingsSection
        nested
        title="Impresora por defecto"
        subtitle="Productos sin área o áreas sin impresora dedicada."
        icon={<Printer size={16} />}
        defaultOpen={false}
        badge={
          defaultReady ? (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Lista
            </span>
          ) : null
        }
        actions={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTestDefault()
            }}
            disabled={testingDefault || !defaultReady}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50"
          >
            {testingDefault ? 'Probando…' : 'Probar'}
          </button>
        }
      >
        <PrinterConfigEditor
          cfg={comandasDefault}
          printerOptions={printerOptions}
          paperOptions={paperOptions}
          loadingPrinters={loadingPrinters}
          onRefreshPrinters={onRefreshPrinters}
          onChange={onDefaultChange}
          showAutoPrint
        />
      </PrinterSettingsSection>

      <PrinterSettingsSection
        nested
        title="Impresión por área de preparación"
        subtitle={
          configuredAreasCount > 0
            ? `${configuredAreasCount} área(s) con impresora dedicada · ${areaKeys.length} disponible(s)`
            : 'Opcional — cocina, bar y otras áreas'
        }
        icon={<Printer size={16} />}
        defaultOpen={false}
      >
        <p className="text-xs text-stone-500">
          Si no configuras un área, sus comandas salen por la impresora por defecto.
        </p>

        {areaKeys.length === 0 && (
          <p className="text-xs text-stone-500 rounded-lg border border-dashed border-stone-200 px-3 py-4 text-center">
            No hay áreas definidas en productos. Usa solo la impresora por defecto.
          </p>
        )}

        <div className="space-y-2">
          {areaKeys.map((areaKey) => {
            const dedicated = Boolean(comandasByArea[areaKey])
            const areaCfg = dedicated
              ? normalizeSlot(comandasByArea[areaKey])
              : emptyAreaSlot(comandasDefault)
            const expanded = expandedAreas[areaKey] ?? false
            const ready = dedicated && isPrinterConfigReady(areaCfg)

            return (
              <div key={areaKey} className="rounded-xl border border-stone-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50">
                  <button
                    type="button"
                    onClick={() => (dedicated ? toggleArea(areaKey) : enableArea(areaKey))}
                    className="flex-1 flex items-center gap-2 text-left min-w-0 touch-manipulation"
                    aria-expanded={expanded}
                  >
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
                  <div className="p-3 sm:p-4 space-y-3 border-t border-stone-100">
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
                  <div className="p-3 sm:p-4 border-t border-stone-100">
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
      </PrinterSettingsSection>
    </PrinterSettingsSection>
  )
}
