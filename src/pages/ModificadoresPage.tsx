import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react'
import { productsService, type ModifierGroup } from '@/services/products.service'
import { useAuth } from '@/contexts/AuthContext'
import { PortalModal } from '@/components/ui/PortalModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ModifierOptionsEditor } from '@/components/modifiers/ModifierOptionsEditor'
import {
  createEmptyOptionDraft,
  draftsFromApiOptions,
  validateOptionDrafts,
  type ModifierOptionDraft,
} from '@/utils/modifierOptionText'

export default function ModificadoresPage() {
  const navigate = useNavigate()
  const { canAccess } = useAuth()
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<ModifierGroup | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState('')
  const [required, setRequired] = useState(false)
  const [multiSelect, setMultiSelect] = useState(false)
  const [optionDrafts, setOptionDrafts] = useState<ModifierOptionDraft[]>([createEmptyOptionDraft()])

  const load = () => {
    setLoading(true)
    productsService
      .listModifierGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setRequired(false)
    setMultiSelect(false)
    setOptionDrafts([createEmptyOptionDraft()])
    setModal('create')
  }

  const openEdit = (g: ModifierGroup) => {
    setEditing(g)
    setName(g.name)
    setRequired(!!g.required)
    setMultiSelect(!!g.multi_select)
    setOptionDrafts(draftsFromApiOptions(g.options))
    setModal('edit')
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error('El nombre del grupo es requerido')
      return
    }
    const validationErr = validateOptionDrafts(optionDrafts)
    if (validationErr) {
      toast.error(validationErr)
      return
    }
    const options = optionDrafts
      .map((d) => ({
        name: d.name.trim(),
        extra_price: Math.round((Number(d.extra_price) || 0) * 100) / 100,
      }))
      .filter((d) => d.name.length > 0)

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        required,
        multi_select: multiSelect,
        options,
      }
      if (modal === 'edit' && editing) {
        await productsService.updateModifierGroup(editing.id, payload)
        toast.success('Grupo actualizado')
      } else {
        await productsService.createModifierGroup(payload)
        toast.success('Grupo creado')
      }
      setModal(null)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteGroup = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productsService.deleteModifierGroup(deleteTarget.id)
      toast.success('Grupo eliminado')
      if (editing?.id === deleteTarget.id) setModal(null)
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Grupos de extras</h2>
          <p className="text-sm text-stone-500">
            Extras reutilizables entre productos (queso, tocino…). Las presentaciones se configuran en cada
            producto en <strong>Productos</strong>.
          </p>
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

      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
        <p className="font-bold">Solo extras globales</p>
        <p className="mt-0.5">
          Cada opción <strong>suma</strong> al precio. Para tamaños o envases por producto (Coca 500 ml, Pizza
          mediana), usa <strong>Presentaciones</strong> al editar el producto.
        </p>
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
                  <th className="text-left px-4 py-3 font-semibold text-stone-700">Comportamiento</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-700">Opciones</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{g.name}</td>
                    <td className="px-4 py-3 text-xs text-stone-600 whitespace-nowrap">
                      {g.multi_select ? 'Varios extras' : 'Un extra'}
                      {g.required ? ' · obligatorio' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {(g.options ?? []).map((o) => (
                          <li key={o.id} className="text-xs text-stone-600 flex flex-wrap gap-x-1">
                            <span className="font-medium text-stone-800">{o.name}</span>
                            <span className="text-rest-700 tabular-nums">
                              {Number(o.extra_price) > 0
                                ? `+ S/ ${Number(o.extra_price).toFixed(2)}`
                                : '(sin cargo)'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(g)}
                          className="p-2.5 rounded-xl text-stone-500 hover:bg-rest-50 hover:text-rest-700"
                          title="Editar grupo"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(g)}
                          disabled={deleting && deleteTarget?.id === g.id}
                          className="p-2.5 rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                          title="Eliminar grupo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {groups.length === 0 && (
            <div className="text-center py-12 text-stone-400 text-sm">
              No hay grupos. Crea el primero con el botón «Nuevo grupo».
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDeleteGroup()}
        title="¿Eliminar este grupo?"
        message={
          deleteTarget ? (
            <>
              <p>
                Vas a eliminar <strong className="text-stone-800">«{deleteTarget.name}»</strong>.
              </p>
              <p className="mt-2">
                Se quitará de los productos vinculados. Los pedidos ya enviados conservan su detalle histórico.
              </p>
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        variant="danger"
      />

      <PortalModal open={modal != null} onClose={() => setModal(null)} className="max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
            <h3 className="font-bold text-stone-800 text-lg">
              {modal === 'edit' ? 'Editar grupo de extras' : 'Nuevo grupo de extras'}
            </h3>
          </div>

          <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del grupo *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Extras, Adicionales"
                className="w-full min-h-[44px] border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div className="rounded-xl border border-stone-200 p-3 space-y-2 bg-white">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={multiSelect}
                  onChange={(e) => setMultiSelect(e.target.checked)}
                  className="rounded border-stone-300"
                />
                Permitir elegir varios extras
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="rounded border-stone-300"
                />
                Obligatorio en el POS (al menos uno)
              </label>
            </div>

            <ModifierOptionsEditor options={optionDrafts} onChange={setOptionDrafts} />
          </div>

          <div className="flex gap-2 p-4 border-t border-stone-200 shrink-0">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="flex-1 min-h-[48px] py-2.5 border border-stone-200 rounded-xl text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 min-h-[48px] py-2.5 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:bg-rest-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : modal === 'edit' ? 'Guardar cambios' : 'Crear grupo'}
            </button>
          </div>
        </div>
      </PortalModal>
    </div>
  )
}
