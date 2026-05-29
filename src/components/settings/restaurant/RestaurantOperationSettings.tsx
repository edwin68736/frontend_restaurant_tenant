import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCw, Shield, Users } from 'lucide-react'
import { toast } from 'sonner'
import { restaurantService, type RestaurantStaffManagementRow } from '@/services/restaurant.service'
import { EMPLOYEE_TYPE_LABELS } from '@/utils/restaurantPermissions'
import { RestaurantStaffEditModal } from '../RestaurantStaffEditModal'
import { RestaurantStaffCreateModal } from '../RestaurantStaffCreateModal'

export function RestaurantOperationSettings() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RestaurantStaffManagementRow[]>([])
  const [hasDeletionPin, setHasDeletionPin] = useState(false)
  const [deletionPin, setDeletionPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [editing, setEditing] = useState<RestaurantStaffManagementRow | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settings, staff] = await Promise.all([
        restaurantService.getSettings(),
        restaurantService.listStaffManagement(),
      ])
      setHasDeletionPin(settings.has_deletion_pin)
      setRows(staff)
    } catch {
      toast.error('No se pudieron cargar los ajustes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveDeletionPin = async () => {
    const digits = deletionPin.replace(/\D/g, '')
    if (digits.length < 4 || digits.length > 6) {
      toast.error('PIN de operaciones: 4 a 6 dígitos')
      return
    }
    setSavingPin(true)
    try {
      await restaurantService.updateSettings({ deletion_pin: digits })
      setHasDeletionPin(true)
      setDeletionPin('')
      toast.success('PIN de operaciones guardado')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar')
    } finally {
      setSavingPin(false)
    }
  }

  const staffWithAccess = rows.filter((r) => r.employee_type)

  return (
    <div className="space-y-5">
      <section className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Shield size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-stone-900">PIN de operaciones</h2>
            <p className="text-sm text-stone-600 mt-1">
              Para anular pedidos, comandas y otras acciones sensibles.
            </p>
            <p className="text-xs mt-2 text-stone-500">
              Estado:{' '}
              <span className={hasDeletionPin ? 'text-rest-700 font-medium' : 'text-amber-700'}>
                {hasDeletionPin ? 'Configurado' : 'Sin configurar'}
              </span>
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-md">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={deletionPin}
                onChange={(e) => setDeletionPin(e.target.value.replace(/\D/g, ''))}
                placeholder={hasDeletionPin ? 'Nuevo PIN (4–6 dígitos)' : 'PIN (4–6 dígitos)'}
                className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                disabled={savingPin || deletionPin.length < 4}
                onClick={() => void saveDeletionPin()}
                className="px-4 py-2 rounded-xl bg-rest-600 text-white text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
              >
                {savingPin ? 'Guardando...' : hasDeletionPin ? 'Actualizar PIN' : 'Guardar PIN'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-stone-900">Usuarios del restaurante</h2>
              <p className="text-sm text-stone-600">
                {rows.length} en total · {staffWithAccess.length} con acceso al restaurante
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rest-600 text-white text-sm font-medium hover:bg-rest-700"
            >
              <Plus size={16} />
              Nuevo usuario
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50/80 text-left text-xs text-stone-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Usuario</th>
                  <th className="px-4 py-2.5 font-medium">Sucursales</th>
                  <th className="px-4 py-2.5 font-medium">Rol</th>
                  <th className="px-4 py-2.5 font-medium">PIN acceso</th>
                  <th className="px-4 py-2.5 font-medium w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.user_id} className={!row.active ? 'opacity-50' : undefined}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-800">{row.name}</div>
                      <div className="text-xs text-stone-500 truncate max-w-[200px]">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600 max-w-[180px]">
                      {row.branch_names?.length ? (
                        <span className="line-clamp-2" title={row.branch_names.join(', ')}>
                          {row.branch_names.join(', ')}
                        </span>
                      ) : row.employee_type ? (
                        <span className="text-stone-400">Sin asignar</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.employee_type ? (
                        <span className="inline-flex px-2 py-0.5 rounded-lg bg-rest-50 text-rest-800 text-xs font-medium">
                          {EMPLOYEE_TYPE_LABELS[row.employee_type] ?? row.employee_type}
                        </span>
                      ) : row.profile_complete === false && row.active ? (
                        <span className="inline-flex px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 text-xs font-medium">
                          Registro incompleto
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">Sin acceso restaurante</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">
                      {!row.employee_type ? '—' : row.has_pin ? 'Configurado' : 'Sin PIN'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rest-700 hover:bg-rest-50"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <RestaurantStaffEditModal row={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />
      )}
      {creating && (
        <RestaurantStaffCreateModal
          onClose={() => setCreating(false)}
          onSaved={() => void load()}
          onFailed={() => void load()}
        />
      )}
    </div>
  )
}
