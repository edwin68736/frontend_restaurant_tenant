import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ChefHat } from 'lucide-react'
import {
  COMANDA_PRINT_LAYOUT_OPTIONS,
  COMANDA_TEXT_SIZE_OPTIONS,
  loadComandaPrintLayoutSettings,
  saveComandaPrintLayoutSettings,
  type ComandaPrintLayoutSettings,
  type ComandaTextSize,
} from '@/services/printers/comandaPrintLayout'

export function ComandaPrintSettings() {
  const [expanded, setExpanded] = useState(true)
  const [settings, setSettings] = useState<ComandaPrintLayoutSettings>(() =>
    loadComandaPrintLayoutSettings(),
  )

  useEffect(() => {
    saveComandaPrintLayoutSettings(settings)
  }, [settings])

  return (
    <section className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-stone-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center shrink-0">
            <ChefHat size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-stone-900">Ajuste de comandas</h2>
            <p className="text-xs text-stone-500 mt-1">
              Controla qué datos salen impresos en la comanda de cocina y con qué tamaño de letra.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50"
        >
          {expanded ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {expanded && (
        <>
          <ul className="divide-y divide-stone-100">
            {COMANDA_PRINT_LAYOUT_OPTIONS.map((opt) => (
              <li key={opt.key}>
                <label className="flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer hover:bg-stone-50/80">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-800">{opt.label}</span>
                    {opt.hint ? (
                      <span className="block text-xs text-stone-500 mt-0.5">{opt.hint}</span>
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[opt.key])}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, [opt.key]: e.target.checked }))
                    }
                    className="h-5 w-5 shrink-0 accent-rest-600"
                    aria-label={opt.label}
                  />
                </label>
              </li>
            ))}
          </ul>

          <div className="border-t border-stone-100 px-5 py-3.5">
            <p className="text-sm font-medium text-stone-800">Tamaño del texto</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Aplica a la mesa, el mozo y los platos. Con «Mediano» el ticket sale más corto.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {COMANDA_TEXT_SIZE_OPTIONS.map((opt) => {
                const active = settings.textSize === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, textSize: opt.value as ComandaTextSize }))
                    }
                    className={clsx(
                      'rounded-lg border-2 px-3 py-2 text-left transition',
                      active
                        ? 'border-rest-500 bg-rest-500 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-rest-300',
                    )}
                  >
                    <span className="block text-sm font-semibold">{opt.label}</span>
                    <span
                      className={clsx('block text-[11px]', active ? 'text-rest-50' : 'text-stone-500')}
                    >
                      {opt.hint}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
