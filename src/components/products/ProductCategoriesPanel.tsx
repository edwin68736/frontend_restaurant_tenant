import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { productsService, type CategoryWithCount } from '@/services/products.service'
import { companyService } from '@/services/company.service'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { PortalModal } from '@/components/ui/PortalModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { sortCategories } from '@/utils/sortCategories'

const emptyForm = (branchId = '') => ({
  name: '',
  description: '',
  sort_order: 1,
  /** '' = todas las sucursales; id en texto = solo esa sucursal. */
  branch_id: branchId,
})

type Props = {
  onCategoriesChange?: () => void
}

export function ProductCategoriesPanel({ onCategoriesChange }: Props) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<CategoryWithCount | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Sucursales del tenant: con más de una se muestra de qué sucursal es cada categoría (vacío = todas).
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([])
  const multiBranch = branches.length > 1
  // Quien administra el catálogo global gestiona todas las categorías; el resto, solo las de SU sucursal activa (el backend
  // lo exige igual).
  const { canManageGlobalCatalog } = useAuth()
  const { activeBranchId } = useBranch()
  const canManageRow = (c: CategoryWithCount) =>
    canManageGlobalCatalog || (c.branch_id != null && c.branch_id === activeBranchId)
  useEffect(() => {
    companyService.listBranches().then((b) => setBranches(b ?? [])).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    productsService
      .listCategoriesWithCounts()
      .then((rows) => setCategories(sortCategories(rows)))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    const nextOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order ?? 0), 0) + 1
        : 1
    setForm({
      ...emptyForm(!canManageGlobalCatalog && activeBranchId > 0 ? String(activeBranchId) : ''),
      sort_order: nextOrder,
    })
    setModal('create')
  }

  const openEdit = (cat: CategoryWithCount) => {
    setEditing(cat)
    setForm({
      name: cat.name,
      description: cat.description ?? '',
      sort_order: cat.sort_order ?? 0,
      branch_id: cat.branch_id != null ? String(cat.branch_id) : '',
    })
    setModal('edit')
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    const order = Math.max(0, Math.floor(Number(form.sort_order) || 0))
    // Con una sola sucursal no hay ámbito que elegir (la categoría es de todas, como siempre).
    const branchId = multiBranch ? (form.branch_id === '' ? null : Number(form.branch_id)) : undefined
    setSaving(true)
    try {
      if (modal === 'edit' && editing) {
        await productsService.updateCategory(editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          sort_order: order,
          // Solo quien administra el catálogo global puede cambiar el ámbito; el resto lo conserva.
          ...(canManageGlobalCatalog && branchId !== undefined ? { branch_id: branchId } : {}),
        })
        toast.success('Categoría actualizada')
      } else {
        await productsService.createCategory(form.name.trim(), form.description.trim(), order, branchId)
        toast.success('Categoría creada')
      }
      setModal(null)
      load()
      onCategoriesChange?.()
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
      await productsService.deleteCategory(deleteTarget.id)
      toast.success('Categoría eliminada')
      if (editing?.id === deleteTarget.id) setModal(null)
      setDeleteTarget(null)
      load()
      onCategoriesChange?.()
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
          Orden en POS y filtros según el campo <span className="font-medium">Orden</span> (menor = primero).
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 shrink-0"
        >
          <Plus size={16} />
          Agregar categoría
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200">
              <tr>
                {['Orden', 'Nombre', ...(multiBranch ? ['Sucursal'] : []), 'Descripción', 'Productos', 'Acciones'].map((h) => (
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
              {loading && categories.length === 0 ? (
                <tr>
                  <td colSpan={multiBranch ? 6 : 5} className="px-4 py-10 text-center text-stone-400">
                    Cargando…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={multiBranch ? 6 : 5} className="px-4 py-10 text-center text-stone-400">
                    No hay categorías registradas.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-3 py-2 text-right tabular-nums text-stone-600">{cat.sort_order ?? 0}</td>
                    <td className="px-3 py-2 font-medium text-stone-800">{cat.name}</td>
                    {multiBranch && (
                      <td className="px-3 py-2 text-stone-600">
                        {cat.branch_id == null
                          ? 'Todas'
                          : (branches.find((b) => b.id === cat.branch_id)?.name ?? `Sucursal ${cat.branch_id}`)}
                      </td>
                    )}
                    <td className="px-3 py-2 text-stone-600">{cat.description?.trim() || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cat.product_count ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {canManageRow(cat) && (
                        <button
                          type="button"
                          onClick={() => openEdit(cat)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          aria-label={`Editar ${cat.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        )}
                        {canManageRow(cat) && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          disabled={(cat.product_count ?? 0) > 0}
                          title={
                            (cat.product_count ?? 0) > 0
                              ? 'No se puede eliminar: hay productos vinculados'
                              : 'Eliminar categoría'
                          }
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Eliminar ${cat.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                        )}
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
              {modal === 'edit' ? 'Editar categoría' : 'Nueva categoría'}
            </h4>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Ej. Bebidas"
              />
            </div>
            {multiBranch && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Disponible en</label>
                <select
                  value={form.branch_id}
                  onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                  disabled={!canManageGlobalCatalog}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-stone-50"
                >
                  {canManageGlobalCatalog && <option value="">Todas las sucursales</option>}
                  {branches
                    .filter((b) => canManageGlobalCatalog || b.id === activeBranchId)
                    .map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        Solo {b.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-stone-500 mt-1">
                  {canManageGlobalCatalog
                    ? 'Una categoría de una sola sucursal solo admite productos que se vendan únicamente allí. Si ya tiene productos de otras sucursales no se podrá limitar.'
                    : 'Tu usuario administra las categorías de su sucursal.'}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Descripción</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>
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
              <p className="text-xs text-stone-500 mt-1">Menor número = aparece primero en el POS.</p>
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
        title="Eliminar categoría"
        message={
          deleteTarget
            ? `¿Eliminar «${deleteTarget.name}»? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
