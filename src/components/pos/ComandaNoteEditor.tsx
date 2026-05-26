import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Comanda } from '@/services/restaurant.service'
import { restaurantService } from '@/services/restaurant.service'

type Props = {
  comanda: Comanda
  onUpdated: (comandaId: number, notes: string) => void
}

export function ComandaNoteEditor({ comanda, onUpdated }: Props) {
  const [draft, setDraft] = useState(comanda.notes ?? '')
  const [saving, setSaving] = useState(false)

  const save = async (nextNotes: string) => {
    setSaving(true)
    try {
      await restaurantService.updateComandaNotes(comanda.id, nextNotes)
      onUpdated(comanda.id, nextNotes.trim())
      toast.success(nextNotes.trim() ? 'Nota guardada' : 'Nota eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la nota')
      setDraft(comanda.notes ?? '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Nota para cocina (opcional)"
          className="flex-1 border border-stone-200 rounded-lg px-2 py-1 text-xs min-w-0"
          disabled={saving}
        />
        <button
          type="button"
          disabled={saving || draft === (comanda.notes ?? '')}
          onClick={() => void save(draft)}
          className="px-2 py-1 text-xs font-semibold rounded-lg bg-rest-600 text-white disabled:opacity-40 shrink-0"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
        </button>
        {(draft.trim() || comanda.notes) && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setDraft('')
              void save('')
            }}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-red-600 shrink-0"
            title="Quitar nota"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
