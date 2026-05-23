import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { TouchDecimalKeypad, formatAmountDisplay, parseAmountInput } from '@/components/ui/TouchDecimalKeypad'

type Props = {
  branchName?: string
  saving?: boolean
  onCancel: () => void
  onSubmit: (openingBalance: number, notes?: string) => Promise<void>
  cancelLabel?: string
  showLater?: boolean
}

export function CashOpenSessionForm({
  branchName,
  saving = false,
  onCancel,
  onSubmit,
  cancelLabel = 'Después',
  showLater = true,
}: Props) {
  const [amountInput, setAmountInput] = useState('')
  const [notes, setNotes] = useState('')

  const amountLabel = formatAmountDisplay(amountInput)

  const handleSubmit = async () => {
    await onSubmit(parseAmountInput(amountInput), notes.trim() || undefined)
    setAmountInput('')
    setNotes('')
  }

  return (
    <div className="space-y-4">
      {branchName ? (
        <div className="flex items-center gap-2 rounded-xl bg-rest-50 border border-rest-100 px-3 py-2.5">
          <MapPin size={16} className="text-rest-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-rest-600 font-medium">Sucursal</p>
            <p className="text-sm font-semibold text-stone-800 truncate">{branchName}</p>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium text-stone-500 mb-1 text-center">Monto inicial en efectivo</p>
        <div
          className="text-center py-3 px-4 rounded-2xl bg-stone-900 text-white font-bold tracking-tight tabular-nums"
          aria-live="polite"
        >
          <span className="text-lg font-medium text-stone-400 mr-1">S/</span>
          <span className="text-[clamp(2rem,8vw,2.75rem)]">{amountLabel}</span>
        </div>
      </div>

      <TouchDecimalKeypad value={amountInput} onChange={setAmountInput} />

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Observación (opcional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Turno mañana"
          className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm"
          disabled={saving}
        />
      </div>

      <div className="flex gap-2 pt-1">
        {showLater ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 touch-manipulation"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSubmit()}
          className="flex-[1.4] py-3 bg-rest-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation shadow-md shadow-rest-600/20"
        >
          {saving ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </div>
    </div>
  )
}

export { formatAmountDisplay, parseAmountInput }
