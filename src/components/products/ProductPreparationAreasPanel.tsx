import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { productsService, type PreparationAreaWithCount } from '@/services/products.service'
import { PortalModal } from '@/components/ui/PortalModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { sortPreparationAreas } from '@/utils/sortPreparationAreas'

const emptyForm = () => ({
  name: '',
  slug: '',
  sort_order: 1,
})

type Props = {
  onAreasChange?: () => void
}

export function ProductPreparationAreasPanel({ onAreasChange }: Props) {
  const [areas, setAreas] = useState<PreparationAreaWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<PreparationAreaWithCount | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PreparationAreaWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    productsService
      .listPreparationAreasWithCounts()
      .then((rows) => setAreas(sortPreparationAreas(rows)))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    const nextOrder =
      areas.length > 0 ? Math.max(...areas.map((a) => a.sort_order ?? 0), 0) + 1 : 1
    setForm({ ...emptyForm(), sort_order: nextOrder })
    setModal('create')
  }

  const openEdit = (area: PreparationAreaWithCount) => {
    setEditing(area)
    setForm({
      name: area.name,
      slug: area.slug,
      sort_order: area.sort_order ?? 0,
    })
    setModal('edit')
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    const order = Math.max(0, Math.floor(Number(form.sort_order) || 0))
    setSaving(true)
    try {
      if (modal === 'edit' && editing) {
        await productsService.updatePreparationArea(editing.id, {
          name: form.name.trim(),
          sort_order: order,
        })
        toast.success('Área actualizada')
      } else {
        await productsService.createPreparationArea(
          form.name.trim(),
          form.slug.trim() || undefined,
          order,
        )
        toast.success('Área creada')
      }
      setModal(null)
      load()
      onAreasChange?.()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productsService.deletePreparationArea(deleteTarget.id)
      toast.success('Área eliminada')
      if (editing?.id === deleteTarget.id) setModal(null)
      setDeleteTarget(null)
      load()
      onAreasChange?.()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <p className="text-sm text-stone-600">
          Áreas para comandas e impresoras. El <span className="font-medium">código</span> (slug) no cambia al
          editar; se usa en impresión y cocina.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 shrink-0"
        >
          <Plus size={16} />
          Agregar área
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200">
              <tr>
                {['Orden', 'Nombre', 'Código', 'Productos', 'Acciones'].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 text-xs font-semibold text-stone-700 ${h === 'Orden' || h === 'Productos' ? 'text-right w-20' : 'text-left'} ${h === 'Acciones' ? 'text-right w-28' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && areas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-stone-400">
                    Cargando…
                  </td>
                </tr>
              ) : areas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-stone-400">
                    No hay áreas registradas.
                  </td>
                </tr>
              ) : (
                areas.map((area) => (
                  <tr key={area.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-3 py-2 text-right tabular-nums text-stone-600">{area.sort_order ?? 0}</td>
                    <td className="px-3 py-2 font-medium text-stone-800">{area.name}</td>
                    <td className="px-3 py-2 text-stone-600 font-mono text-xs">{area.slug}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{area.product_count ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(area)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          aria-label={`Editar ${area.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(area)}
                          disabled={(area.product_count ?? 0) > 0}
                          title={
                            (area.product_count ?? 0) > 0
                              ? 'No se puede eliminar: hay productos vinculados'
                              : 'Eliminar área'
                          }
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Eliminar ${area.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PortalModal open={modal != null} onClose={() => setModal(null)} className="max-w-md">
        <div className="bg-white rounded-2xl shadow-xl w-full overflow-hidden">
          <div className="p-4 border-b border-stone-200">
            <h4 className="font-bold text-stone-800">
              {modal === 'edit' ? 'Editar área de preparación' : 'Nueva área de preparación'}
            </h4>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Ej. Cocina caliente"
              />
            </div>
            {modal === 'create' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Código (opcional)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono"
                  placeholder="Ej. cocina_caliente (auto si vacío)"
                />
              </div>
            )}
            {modal === 'edit' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Código</label>
                <p className="text-sm font-mono text-stone-600 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2">
                  {form.slug}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Orden</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="p-4 border-t border-stone-100 flex gap-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </PortalModal>

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar área"
        message={
          deleteTarget ? `¿Eliminar «${deleteTarget.name}»? Esta acción no se puede deshacer.` : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
