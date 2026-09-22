import { useEffect, useRef, useState } from 'react'
import { ImagePlus, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { companyService, type BranchRow } from '@/services/company.service'
import { resolvePublicAssetUrl } from '@/services/api'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'
import { FIXED_OVERLAY_SAFE } from '@/utils/safeAreaClasses'

const empty = (): Partial<BranchRow> => ({ name: '', address: '', phone: '', fiscal_domicile_code: '', is_main: false })

/** logo_data_url ya viene embebido (data:) por el backend; logo_url es una ruta /uploads relativa. */
function branchLogoSrc(v?: string | null): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  return s.startsWith('data:') ? s : resolvePublicAssetUrl(s)
}

export function RestaurantBranchesSettings() {
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BranchRow | null>(null)
  const [form, setForm] = useState<Partial<BranchRow>>(empty())
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

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
    setForm({
      name: b.name,
      address: b.address,
      phone: b.phone,
      fiscal_domicile_code: b.fiscal_domicile_code ?? '',
      is_main: b.is_main,
      logo_url: b.logo_url,
      logo_data_url: b.logo_data_url,
    })
    setModalOpen(true)
  }

  const handleBranchLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen (PNG, JPG, etc.)')
      return
    }
    setUploadingLogo(true)
    void companyService
      .uploadBranchLogo(editing.id, file)
      .then((res) => {
        const logo_url = res.logo_url ?? res.data?.logo_url ?? ''
        setForm((f) => ({ ...f, logo_url, logo_data_url: res.data?.logo_data_url }))
        toast.success('Logo de la sucursal guardado')
        void load()
      })
      .catch((err: { response?: { data?: { error?: string } } }) => {
        toast.error(err.response?.data?.error ?? 'Error al guardar el logo')
      })
      .finally(() => {
        setUploadingLogo(false)
        if (logoInputRef.current) logoInputRef.current.value = ''
      })
  }

  const clearBranchLogo = () => {
    if (!editing) return
    setUploadingLogo(true)
    void companyService
      .deleteBranchLogo(editing.id)
      .then(() => {
        setForm((f) => ({ ...f, logo_url: '', logo_data_url: '' }))
        if (logoInputRef.current) logoInputRef.current.value = ''
        toast.success('Logo de la sucursal eliminado')
        void load()
      })
      .catch((err: { response?: { data?: { error?: string } } }) => {
        toast.error(err.response?.data?.error ?? 'Error al quitar el logo')
      })
      .finally(() => setUploadingLogo(false))
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

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Logo de la sucursal</label>
              {editing ? (
                <div className="flex items-center gap-3">
                  {form.logo_data_url || form.logo_url ? (
                    <img
                      src={branchLogoSrc(form.logo_data_url || form.logo_url)}
                      alt="Logo de la sucursal"
                      className="h-12 w-12 rounded-lg object-contain border border-stone-200 bg-white"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg border border-dashed border-stone-300 flex items-center justify-center text-stone-300">
                      <ImagePlus size={18} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                    >
                      {form.logo_url ? 'Cambiar logo' : 'Cargar logo'}
                    </button>
                    {form.logo_url && (
                      <button
                        type="button"
                        onClick={clearBranchLogo}
                        disabled={uploadingLogo}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Quitar logo"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBranchLogoFile}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-500">Guarde la sucursal primero para poder cargarle un logo propio.</p>
              )}
              <p className="text-xs text-stone-500 mt-1">
                Opcional. Si no se configura, los comprobantes de esta sucursal usan el logo general de la empresa
                (Ajustes → Empresa).
              </p>
            </div>

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
