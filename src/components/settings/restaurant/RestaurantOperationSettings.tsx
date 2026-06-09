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

  const renderStaffRole = (row: RestaurantStaffManagementRow) => {
    if (row.employee_type) {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-lg bg-rest-50 text-rest-800 text-xs font-medium">
          {EMPLOYEE_TYPE_LABELS[row.employee_type] ?? row.employee_type}
        </span>
      )
    }
    if (row.profile_complete === false && row.active) {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 text-xs font-medium">
          Registro incompleto
        </span>
      )
    }
    return <span className="text-stone-400 text-xs">Sin acceso restaurante</span>
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="bg-white border border-stone-200 rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Shield size={17} className="sm:w-[18px] sm:h-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-stone-900 text-base sm:text-lg">PIN de operaciones</h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
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

      <section className="bg-white border border-stone-200 rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-stone-200 flex flex-col gap-3">
          <div className="flex items-start gap-3 min-w-0 w-full">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center shrink-0">
              <Users size={17} className="sm:w-[18px] sm:h-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-stone-900 text-base sm:text-lg leading-tight">Usuarios del restaurante</h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                {rows.length} en total · {staffWithAccess.length} con acceso
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-rest-600 text-white text-xs sm:text-sm font-medium hover:bg-rest-700 min-w-0"
            >
              <Plus size={15} className="shrink-0 sm:w-4 sm:h-4" />
              <span className="truncate sm:hidden">Nuevo</span>
              <span className="truncate hidden sm:inline">Nuevo usuario</span>
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Actualizar"
              aria-label="Actualizar lista"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50 min-w-0"
            >
              <RefreshCw size={15} className={`shrink-0 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-stone-100">
            {rows.map((row) => (
              <div key={row.user_id} className={`p-3 space-y-2 ${!row.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-800 text-sm leading-tight">{row.name}</p>
                    <p className="text-xs text-stone-500 truncate">{row.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-rest-700 hover:bg-rest-50 shrink-0"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderStaffRole(row)}
                  {row.employee_type ? (
                    <span className="text-[11px] text-stone-500">
                      PIN: {row.has_pin ? 'Configurado' : 'Sin PIN'}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-stone-600">
                  <span className="text-stone-400">Sucursales: </span>
                  {row.branch_names?.length ? row.branch_names.join(', ') : row.employee_type ? 'Sin asignar' : '—'}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
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
                    <td className="px-4 py-3">{renderStaffRole(row)}</td>
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
          </>
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
