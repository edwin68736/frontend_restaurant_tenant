import { Plus, Trash2 } from 'lucide-react'
import { createEmptyOptionDraft, type ModifierOptionDraft } from '@/utils/modifierOptionText'

type Props = {
  options: ModifierOptionDraft[]
  onChange: (options: ModifierOptionDraft[]) => void
  /** true = grupo de extras (varios); false = variante (una opción) */
  isExtrasGroup: boolean
}

export function ModifierOptionsEditor({ options, onChange, isExtrasGroup }: Props) {
  const rows = options.length > 0 ? options : [createEmptyOptionDraft()]

  const setRow = (index: number, patch: Partial<ModifierOptionDraft>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }

  const addRow = () => {
    onChange([...rows, createEmptyOptionDraft()])
  }

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([createEmptyOptionDraft()])
      return
    }
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-stone-700">
          {isExtrasGroup ? 'Extras disponibles' : 'Opciones de variante'} *
        </label>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 text-xs font-semibold text-rest-700 hover:text-rest-800 px-2 py-1.5 rounded-lg hover:bg-rest-50"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
      <p className="text-[11px] text-stone-500 leading-relaxed">
        {isExtrasGroup
          ? 'Cada fila es un extra opcional. El precio adicional se suma al plato (no reemplaza el precio base).'
          : 'El mozo elige una sola opción. El precio adicional se suma al precio base del producto.'}
      </p>

      <div className="space-y-2 max-h-[min(40vh,320px)] overflow-y-auto pr-0.5">
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row gap-2 p-2.5 rounded-xl border border-stone-200 bg-stone-50/80"
          >
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-medium text-stone-500 mb-0.5 uppercase tracking-wide">
                Nombre
              </label>
              <input
                type="text"
                value={row.name}
                onChange={(e) => setRow(index, { name: e.target.value })}
                placeholder={isExtrasGroup ? 'Ej. Papa extra' : 'Ej. Familiar'}
                className="w-full min-h-[44px] border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            <div className="w-full sm:w-28 shrink-0">
              <label className="block text-[10px] font-medium text-stone-500 mb-0.5 uppercase tracking-wide">
                + S/
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={row.extra_price === 0 ? '' : row.extra_price}
                onChange={(e) => {
                  const v = e.target.value
                  setRow(index, { extra_price: v === '' ? 0 : Math.max(0, Number(v) || 0) })
                }}
                placeholder="0.00"
                className="w-full min-h-[44px] border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white tabular-nums"
              />
            </div>
            <div className="flex sm:flex-col justify-end sm:justify-center sm:pt-5">
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
                title="Quitar opción"
                aria-label="Quitar opción"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:border-rest-400 hover:text-rest-700 hover:bg-rest-50/50"
      >
        <Plus size={18} /> Agregar otra opción
      </button>
    </div>
  )
}

