import { Plus, Trash2 } from 'lucide-react'
import type { ProductPresentation } from '@/services/products.service'

type Props = {
  presentations: ProductPresentation[]
  onChange: (rows: ProductPresentation[]) => void
  /** Sin borde exterior cuando va dentro de otro modal */
  embedded?: boolean
}

function emptyRow(): ProductPresentation {
  return { name: '', sale_price: 0 }
}

export function ProductPresentationsEditor({ presentations, onChange, embedded }: Props) {
  const rows = presentations.length > 0 ? presentations : [emptyRow()]

  const setRow = (index: number, patch: Partial<ProductPresentation>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRow = () => onChange([...rows, emptyRow()])

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([emptyRow()])
      return
    }
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div
      className={
        embedded
          ? 'flex flex-col flex-1 min-h-0 space-y-2'
          : 'space-y-2 rounded-lg border border-sky-200 bg-sky-50/50 p-2.5'
      }
    >
      <div className="flex items-center justify-between gap-2 shrink-0">
        <p className="text-xs font-bold text-sky-900">Presentaciones de este producto</p>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 hover:text-sky-950 px-2 py-1 rounded-lg hover:bg-sky-100"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
      <p className="text-[11px] text-sky-800/90 leading-relaxed shrink-0">
        Cada fila es un tamaño o envase propio (ej. 500 ml, Familiar). El precio reemplaza el precio base en mesa/POS.
      </p>
      <div
        className={
          embedded
            ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y space-y-2 pr-1 min-h-[120px] max-h-[min(55dvh,520px)]'
            : 'space-y-2 max-h-[min(50vh,420px)] overflow-y-auto overscroll-contain touch-pan-y pr-1'
        }
      >
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row gap-2 p-2 rounded-xl border border-sky-100 bg-white"
          >
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-medium text-stone-500 mb-0.5">Nombre</label>
              <input
                type="text"
                value={row.name}
                onChange={(e) => setRow(index, { name: e.target.value })}
                placeholder="Ej. 500 ml, Mediana"
                className="w-full min-h-[44px] border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="w-full sm:w-28 shrink-0">
              <label className="block text-[10px] font-medium text-stone-500 mb-0.5">Precio S/</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={row.sale_price === 0 ? '' : row.sale_price}
                onChange={(e) => {
                  const v = e.target.value
                  setRow(index, { sale_price: v === '' ? 0 : Math.max(0, Number(v) || 0) })
                }}
                placeholder="0.00"
                className="w-full min-h-[44px] border border-stone-200 rounded-xl px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex sm:items-end">
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50"
                aria-label="Quitar presentación"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
