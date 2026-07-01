import { useEffect, useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { companyService, type BranchRow } from '@/services/company.service'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'
import { FIXED_OVERLAY_SAFE } from '@/utils/safeAreaClasses'

const empty = (): Partial<BranchRow> => ({ name: '', address: '', phone: '', fiscal_domicile_code: '', is_main: false })

export function RestaurantBranchesSettings() {
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BranchRow | null>(null)
  const [form, setForm] = useState<Partial<BranchRow>>(empty())
  const [saving, setSaving] = useState(false)

  const load = () =>
    companyService
      .listBranches()
      .then((d) => setBranches(d ?? []))
      .catch(() => toast.error('Error cargando sucursales'))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm(empty())
    setModalOpen(true)
  }

  const openEdit = (b: BranchRow) => {
    setEditing(b)
    setForm({ name: b.name, address: b.address, phone: b.phone, fiscal_domicile_code: b.fiscal_domicile_code ?? '', is_main: b.is_main })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Nombre requerido')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await companyService.updateBranch(editing.id, {
          name: form.name,
          address: form.address ?? '',
          phone: form.phone ?? '',
          fiscal_domicile_code: form.fiscal_domicile_code ?? '',
          is_main: form.is_main ?? false,
        })
      } else {
        await companyService.createBranch({
          name: form.name,
          address: form.address ?? '',
          phone: form.phone ?? '',
          fiscal_domicile_code: form.fiscal_domicile_code ?? '',
          is_main: form.is_main ?? false,
        })
      }
      toast.success(editing ? 'Sucursal actualizada' : 'Sucursal creada')
      setModalOpen(false)
      setLoading(true)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta sucursal?')) return
    try {
      await companyService.deleteBranch(id)
      toast.success('Sucursal eliminada')
      setLoading(true)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-stone-900">Sucursales</h2>
          <p className="text-sm text-stone-600">Sedes y puntos de venta del restaurante.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
        >
          <Plus size={15} />
          Nueva sucursal
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50/80 text-left text-xs text-stone-500 uppercase">
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Dirección</th>
                  <th className="px-4 py-2.5">Teléfono</th>
                  <th className="px-4 py-2.5">Cód. domicilio fiscal</th>
                  <th className="px-4 py-2.5">Principal</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-stone-800">
                      <span className="inline-flex items-center gap-2">
                        <MapPin size={14} className="text-stone-400" />
                        {b.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{b.address || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{b.phone || '—'}</td>
                    <td className="px-4 py-3 font-mono text-stone-600">{b.fiscal_domicile_code?.trim() || '—'}</td>
                    <td className="px-4 py-3">
                      {b.is_main && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rest-50 text-rest-800">
                          Principal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          className="p-1.5 text-stone-500 hover:text-rest-700 hover:bg-rest-50 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        {!b.is_main && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(b.id)}
                            className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {branches.length === 0 && (
              <p className="text-center py-10 text-stone-400 text-sm">No hay sucursales registradas</p>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 ${FIXED_OVERLAY_SAFE}`}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-stone-800">{editing ? 'Editar sucursal' : 'Nueva sucursal'}</h3>
            {(
              [
                ['name', 'Nombre *'],
                ['address', 'Dirección'],
                ['phone', 'Teléfono'],
                ['fiscal_domicile_code', 'Código de domicilio fiscal'],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
                <input
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  value={(form[k] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              </div>
            ))}
            <p className="text-xs text-stone-500 -mt-1">
              Código de establecimiento anexo (domicilio fiscal) por sucursal. Se usa en facturación electrónica cuando aplica.
            </p>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.is_main ?? false}
                onChange={(e) => setForm((f) => ({ ...f, is_main: e.target.checked }))}
                className="accent-rest-600"
              />
              Sucursal principal
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
