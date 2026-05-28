import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { restaurantService } from '@/services/restaurant.service'
import type { DeliveryCompany, DeliveryDriver } from '@/types/restaurantOrder'
import { PageShell } from '@/components/layout/PageShell'
import { PortalModal } from '@/components/ui/PortalModal'

type DriverForm = {
  name: string
  phone: string
  vehicle_type: string
  plate: string
  notes: string
  active: boolean
  delivery_company_id: number | ''
}

const emptyDriver = (): DriverForm => ({
  name: '',
  phone: '',
  vehicle_type: '',
  plate: '',
  notes: '',
  active: true,
  delivery_company_id: '',
})

function companyName(d: DeliveryDriver): string {
  return d.delivery_company?.name ?? '—'
}

export default function RepartidoresPage() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([])
  const [companies, setCompanies] = useState<DeliveryCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<DeliveryDriver | null>(null)
  const [form, setForm] = useState(emptyDriver)
  const [saving, setSaving] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyModal, setCompanyModal] = useState<'edit' | 'delete' | null>(null)
  const [editingCompany, setEditingCompany] = useState<DeliveryCompany | null>(null)
  const [companyForm, setCompanyForm] = useState({ name: '', active: true })
  const [companySaving, setCompanySaving] = useState(false)
  const [companyDeleting, setCompanyDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.allSettled([
      restaurantService.listDeliveryDrivers(false),
      restaurantService.listDeliveryCompanies(false),
    ])
      .then(([driversRes, companiesRes]) => {
        if (driversRes.status === 'fulfilled') {
          setDrivers(driversRes.value)
        } else {
          setDrivers([])
          toast.error('No se pudieron cargar los repartidores')
        }
        if (companiesRes.status === 'fulfilled') {
          setCompanies(companiesRes.value)
        } else {
          setCompanies([])
          const msg =
            (companiesRes.reason as { response?: { data?: { error?: string } } })?.response?.data
              ?.error ?? 'No se pudieron cargar las empresas de delivery'
          toast.error(msg)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyDriver())
    setModal('create')
  }

  const openEdit = (d: DeliveryDriver) => {
    setEditing(d)
    setForm({
      name: d.name,
      phone: d.phone ?? '',
      vehicle_type: d.vehicle_type ?? '',
      plate: d.plate ?? '',
      notes: d.notes ?? '',
      active: d.active,
      delivery_company_id: d.delivery_company_id ?? '',
    })
    setModal('edit')
  }

  const refreshCompanies = async () => {
    const list = await restaurantService.listDeliveryCompanies(false)
    setCompanies(list)
    return list
  }

  const addCompany = async () => {
    const name = newCompanyName.trim()
    if (!name) {
      toast.error('Nombre de empresa requerido')
      return
    }
    try {
      await restaurantService.createDeliveryCompany({ name })
      toast.success('Empresa agregada')
      setNewCompanyName('')
      await refreshCompanies()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const openEditCompany = (c: DeliveryCompany) => {
    setEditingCompany(c)
    setCompanyForm({ name: c.name, active: c.active })
    setCompanyModal('edit')
  }

  const openDeleteCompany = (c: DeliveryCompany) => {
    setEditingCompany(c)
    setCompanyModal('delete')
  }

  const saveCompany = async () => {
    if (!editingCompany) return
    const name = companyForm.name.trim()
    if (!name) {
      toast.error('Nombre de empresa requerido')
      return
    }
    setCompanySaving(true)
    try {
      await restaurantService.updateDeliveryCompany(editingCompany.id, {
        name,
        active: companyForm.active,
        sort_order: editingCompany.sort_order ?? 0,
      })
      toast.success('Empresa actualizada')
      setCompanyModal(null)
      setEditingCompany(null)
      await refreshCompanies()
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setCompanySaving(false)
    }
  }

  const confirmDeleteCompany = async () => {
    if (!editingCompany) return
    setCompanyDeleting(true)
    try {
      await restaurantService.deleteDeliveryCompany(editingCompany.id)
      toast.success('Empresa eliminada')
      setCompanyModal(null)
      setEditingCompany(null)
      await refreshCompanies()
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setCompanyDeleting(false)
    }
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nombre requerido')
      return
    }
    const companyId =
      form.delivery_company_id === '' ? null : Number(form.delivery_company_id)
    const payload = {
      name: form.name.trim(),
      phone: form.phone,
      vehicle_type: form.vehicle_type,
      plate: form.plate,
      notes: form.notes,
      delivery_company_id: companyId,
    }
    setSaving(true)
    try {
      if (modal === 'edit' && editing) {
        await restaurantService.updateDeliveryDriver(editing.id, { ...payload, active: form.active })
        toast.success('Repartidor actualizado')
      } else {
        await restaurantService.createDeliveryDriver(payload)
        toast.success('Repartidor creado')
      }
      setModal(null)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (d: DeliveryDriver) => {
    if (!confirm(`¿Eliminar a ${d.name}?`)) return
    try {
      await restaurantService.deleteDeliveryDriver(d.id)
      toast.success('Eliminado')
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  return (
    <PageShell
      title="Repartidores"
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
        >
          <Plus size={16} /> Nuevo repartidor
        </button>
      }
    >
      <div className="mb-6 bg-white rounded-2xl border border-stone-200 p-4">
        <h3 className="text-sm font-semibold text-stone-800 mb-2">Empresas de delivery</h3>
        <p className="text-xs text-stone-500 mb-3">
          Plataformas como PedidosYa o Rappi. Cada repartidor se vincula a una empresa.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {companies.map((c) => (
            <div
              key={c.id}
              className={`inline-flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-full border text-xs font-medium shadow-sm ${
                c.active
                  ? 'bg-violet-100 text-violet-800 border-violet-200/80'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
              }`}
            >
              <span className="truncate max-w-[7.5rem] sm:max-w-[9rem]" title={c.name}>
                {c.name}
              </span>
              <button
                type="button"
                onClick={() => openEditCompany(c)}
                className="inline-flex items-center justify-center p-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300/80 hover:bg-amber-200"
                title="Editar empresa"
                aria-label={`Editar ${c.name}`}
              >
                <Pencil size={12} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => openDeleteCompany(c)}
                className="inline-flex items-center justify-center p-1 rounded-full bg-red-100 text-red-700 border border-red-300/80 hover:bg-red-200"
                title="Eliminar empresa"
                aria-label={`Eliminar ${c.name}`}
              >
                <Trash2 size={12} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {companies.length === 0 && (
            <span className="text-xs text-stone-400">Sin empresas registradas.</span>
          )}
        </div>
        <div className="flex gap-2 max-w-md">
          <input
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder="Nueva empresa (ej. PedidosYa)"
            className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void addCompany()}
            className="px-3 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium"
          >
            Agregar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Empresa</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Vehículo</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Estado</th>
                <th className="text-right px-4 py-3 font-semibold text-stone-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-800">{d.name}</td>
                  <td className="px-4 py-3 text-stone-600">{companyName(d)}</td>
                  <td className="px-4 py-3 text-stone-600">{d.phone || '—'}</td>
                  <td className="px-4 py-3 text-stone-600">{d.vehicle_type || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.active ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(d)}
                      className="p-2 rounded-lg hover:bg-rest-50 text-stone-600"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(d)}
                      className="p-2 rounded-lg hover:bg-red-50 text-stone-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {drivers.length === 0 && (
            <p className="text-center py-10 text-stone-400 text-sm">No hay repartidores registrados.</p>
          )}
        </div>
      )}

      <PortalModal
        open={companyModal === 'edit'}
        onClose={() => {
          if (!companySaving) {
            setCompanyModal(null)
            setEditingCompany(null)
          }
        }}
        className="max-w-sm"
      >
        {editingCompany && companyModal === 'edit' && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-stone-800">Editar empresa</h3>
              <button
                type="button"
                onClick={() => setCompanyModal(null)}
                disabled={companySaving}
                className="p-1 rounded-lg hover:bg-stone-100 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            <input
              value={companyForm.name}
              onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre de la empresa"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={companyForm.active}
                onChange={(e) => setCompanyForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Activa (visible al asignar repartidores)
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompanyModal(null)}
                disabled={companySaving}
                className="flex-1 py-2 border border-stone-200 rounded-xl text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={companySaving}
                onClick={() => void saveCompany()}
                className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {companySaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </PortalModal>

      <PortalModal
        open={companyModal === 'delete'}
        onClose={() => {
          if (!companyDeleting) {
            setCompanyModal(null)
            setEditingCompany(null)
          }
        }}
        className="max-w-sm"
      >
        {editingCompany && companyModal === 'delete' && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-5 space-y-3">
            <h3 className="font-bold text-stone-800">Eliminar empresa</h3>
            <p className="text-sm text-stone-600">
              ¿Eliminar la empresa <span className="font-semibold text-stone-800">{editingCompany.name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <p className="text-xs text-stone-500">
              Solo se puede eliminar si ningún repartidor está vinculado a esta empresa.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompanyModal(null)}
                disabled={companyDeleting}
                className="flex-1 py-2 border border-stone-200 rounded-xl text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={companyDeleting}
                onClick={() => void confirmDeleteCompany()}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {companyDeleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        )}
      </PortalModal>

      <PortalModal open={!!modal} onClose={() => setModal(null)} className="max-w-md">
        {modal && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-5 space-y-3">
            <h3 className="font-bold text-stone-800">
              {modal === 'create' ? 'Nuevo repartidor' : 'Editar repartidor'}
            </h3>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre *"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            <select
              value={form.delivery_company_id === '' ? '' : String(form.delivery_company_id)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  delivery_company_id: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Empresa de delivery (opcional)</option>
              {companies
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Teléfono"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.vehicle_type}
                onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))}
                placeholder="Vehículo"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                value={form.plate}
                onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
                placeholder="Placa"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notas"
              rows={2}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            {modal === 'edit' && (
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Activo
              </label>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2 border border-stone-200 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </PortalModal>
    </PageShell>
  )
}
