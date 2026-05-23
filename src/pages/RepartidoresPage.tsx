import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { restaurantService } from '@/services/restaurant.service'
import type { DeliveryDriver } from '@/types/restaurantOrder'
import { PageShell } from '@/components/layout/PageShell'

const empty = (): Omit<DeliveryDriver, 'id' | 'active'> & { active: boolean } => ({
  name: '',
  phone: '',
  vehicle_type: '',
  plate: '',
  notes: '',
  active: true,
})

export default function RepartidoresPage() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<DeliveryDriver | null>(null)
  const [form, setForm] = useState(empty())
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    restaurantService
      .listDeliveryDrivers(false)
      .then(setDrivers)
      .catch(() => toast.error('Error al cargar repartidores'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(empty())
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
    })
    setModal('edit')
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nombre requerido')
      return
    }
    setSaving(true)
    try {
      if (modal === 'edit' && editing) {
        await restaurantService.updateDeliveryDriver(editing.id, form)
        toast.success('Repartidor actualizado')
      } else {
        await restaurantService.createDeliveryDriver(form)
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
    <PageShell title="Repartidores" actions={
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
      >
        <Plus size={16} /> Nuevo repartidor
      </button>
    }>
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
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Vehículo</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Placa</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">Estado</th>
                <th className="text-right px-4 py-3 font-semibold text-stone-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-800">{d.name}</td>
                  <td className="px-4 py-3 text-stone-600">{d.phone || '—'}</td>
                  <td className="px-4 py-3 text-stone-600">{d.vehicle_type || '—'}</td>
                  <td className="px-4 py-3 text-stone-600">{d.plate || '—'}</td>
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
                    <button type="button" onClick={() => openEdit(d)} className="p-2 rounded-lg hover:bg-rest-50 text-stone-600">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => remove(d)} className="p-2 rounded-lg hover:bg-red-50 text-stone-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {drivers.length === 0 && <p className="text-center py-10 text-stone-400 text-sm">No hay repartidores registrados.</p>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-bold text-stone-800">{modal === 'create' ? 'Nuevo repartidor' : 'Editar repartidor'}</h3>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre *"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
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
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Activo
              </label>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
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
        </div>
      )}
    </PageShell>
  )
}
