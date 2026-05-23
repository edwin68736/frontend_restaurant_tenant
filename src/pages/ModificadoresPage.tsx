import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, X, UtensilsCrossed } from 'lucide-react'
import { productsService, type ModifierGroup } from '@/services/products.service'
import { useAuth } from '@/contexts/AuthContext'

export default function ModificadoresPage() {
  const navigate = useNavigate()
  const { canAccess } = useAuth()
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [required, setRequired] = useState(false)
  const [optionsText, setOptionsText] = useState('')

  const load = () => {
    setLoading(true)
    productsService
      .listModifierGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setName('')
    setRequired(false)
    setOptionsText('')
    setModal(true)
  }

  const create = async () => {
    const options = optionsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!name.trim()) {
      toast.error('El nombre del grupo es requerido')
      return
    }
    if (options.length === 0) {
      toast.error('Agrega al menos una opción (una por línea o separadas por coma)')
      return
    }
    setSaving(true)
    try {
      await productsService.createModifierGroup({ name: name.trim(), required, options })
      toast.success('Grupo de modificadores creado')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Grupos de modificadores</h2>
          <p className="text-sm text-stone-500">Tamaño, cocción, extras. Asígnelos a productos en Productos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canAccess('productos') && (
            <button
              type="button"
              onClick={() => navigate('/productos')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 w-full sm:w-auto"
            >
              <UtensilsCrossed size={16} /> Productos
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 shadow-sm w-full sm:w-auto"
          >
            <Plus size={16} /> Nuevo grupo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-stone-700">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-700">Obligatorio</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-700">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{g.name}</td>
                    <td className="px-4 py-3">{g.required ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {g.options?.map((o) => o.name).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {groups.length === 0 && (
            <div className="text-center py-12 text-stone-400 text-sm">
              No hay grupos. Crea uno para usarlo en productos (ej. Tamaño: Grande, Mediano, Pequeño).
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">Nuevo grupo de modificadores</h3>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del grupo *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Tamaño, Cocción, Extras"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  El cliente debe elegir una opción
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Opciones * (una por línea o separadas por coma)</label>
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="Grande&#10;Mediano&#10;Pequeño"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm resize-none"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={create}
                disabled={saving}
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
