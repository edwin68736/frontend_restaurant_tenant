import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch'
import { supplyPurchasesService, type Supplier } from '@/services/supplyPurchases.service'
import { apiError } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL } from './SupplyModalShell'

type Props = { selected: Supplier | null; onSelect: (s: Supplier | null) => void }

/** Buscar un proveedor o crearlo en el acto. */
export function SupplierPicker({ selected, onSelect }: Props) {
  const search = useDebouncedSearch()
  const [results, setResults] = useState<Supplier[]>([])
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ doc_number: '', business_name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const q = search.effectiveQuery ?? ''

  useEffect(() => {
    if (selected || creating) return
    let cancelled = false
    supplyPurchasesService
      .suppliers(q)
      .then((list) => {
        if (!cancelled) setResults(list.slice(0, 6))
      })
      .catch((e) => toast.error(apiError(e, 'No se pudieron cargar los proveedores')))
    return () => {
      cancelled = true
    }
  }, [q, selected, creating])

  const create = async () => {
    const doc = draft.doc_number.trim()
    if (!doc || !draft.business_name.trim()) {
      toast.error('Escribe el documento y el nombre del proveedor')
      return
    }
    setSaving(true)
    try {
      const supplier = await supplyPurchasesService.createSupplier({
        // 6 = RUC (11 dígitos), 1 = DNI
        doc_type: doc.length === 11 ? '6' : '1',
        doc_number: doc,
        business_name: draft.business_name.trim(),
        phone: draft.phone.trim() || undefined,
      })
      setCreating(false)
      onSelect(supplier)
    } catch (e) {
      toast.error(apiError(e, 'No se pudo crear el proveedor'))
    } finally {
      setSaving(false)
    }
  }

  if (selected) {
    return (
      <div>
        <span className={SUPPLY_LABEL}>Proveedor</span>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-800">{selected.business_name}</p>
            <p className="text-xs text-stone-500">{selected.doc_number}</p>
          </div>
          <button type="button" className="text-xs font-medium text-rest-700" onClick={() => onSelect(null)}>Cambiar</button>
        </div>
      </div>
    )
  }

  if (creating) {
    return (
      <div className="space-y-2 rounded-xl border border-stone-200 p-3">
        <span className={SUPPLY_LABEL}>Nuevo proveedor</span>
        <input className={SUPPLY_INPUT} inputMode="numeric" placeholder="RUC o DNI" value={draft.doc_number} onChange={(e) => setDraft({ ...draft, doc_number: e.target.value })} />
        <input className={SUPPLY_INPUT} placeholder="Nombre o razón social" value={draft.business_name} onChange={(e) => setDraft({ ...draft, business_name: e.target.value })} />
        <input className={SUPPLY_INPUT} inputMode="tel" placeholder="Teléfono (opcional)" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" className={SUPPLY_BTN_GHOST} onClick={() => setCreating(false)}>Cancelar</button>
          <button type="button" className={SUPPLY_BTN_PRIMARY} disabled={saving} onClick={create}>Guardar proveedor</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <span className={SUPPLY_LABEL}>Proveedor</span>
      <input className={SUPPLY_INPUT} placeholder="Buscar por nombre o documento" value={search.inputValue} onChange={(e) => search.setInputValue(e.target.value)} />
      <ul className="mt-1 divide-y divide-stone-100">
        {results.map((s) => (
          <li key={s.id}>
            <button type="button" className="w-full py-1.5 text-left text-sm text-stone-700 hover:text-rest-700" onClick={() => onSelect(s)}>
              {s.business_name} <span className="text-xs text-stone-400">{s.doc_number}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-1 text-xs font-medium text-rest-700" onClick={() => setCreating(true)}>+ Nuevo proveedor</button>
    </div>
  )
}
