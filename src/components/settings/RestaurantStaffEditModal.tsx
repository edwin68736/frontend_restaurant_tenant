import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import {
  RESTAURANT_EMPLOYEE_TYPES,
  restaurantService,
  type RestaurantStaffManagementRow,
} from '@/services/restaurant.service'
import { EMPLOYEE_TYPE_LABELS } from '@/utils/restaurantPermissions'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'

type Props = {
  row: RestaurantStaffManagementRow | null
  onClose: () => void
  onSaved: () => void
}

export function RestaurantStaffEditModal({ row, onClose, onSaved }: Props) {
  const [employeeType, setEmployeeType] = useState('')
  const [pin, setPin] = useState('')
  const [clearPin, setClearPin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!row) return
    setEmployeeType(row.employee_type ?? '')
    setPin('')
    setClearPin(false)
  }, [row])

  if (!row) return null

  const hasPinCurrently = row.has_pin

  const handleSave = async () => {
    const pinDigits = pin.replace(/\D/g, '')
    if (employeeType && !clearPin && pinDigits && (pinDigits.length < 4 || pinDigits.length > 6)) {
      toast.error('PIN de acceso: 4 a 6 dígitos')
      return
    }
    setSaving(true)
    try {
      await restaurantService.setUserStaff(row.user_id, {
        employee_type: employeeType,
        ...(pinDigits ? { pin: pinDigits } : {}),
        ...(clearPin ? { clear_pin: true } : {}),
      })
      toast.success(employeeType ? 'Perfil guardado' : 'Acceso al restaurante quitado')
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      const isDup =
        msg?.toLowerCase().includes('pin ya está asignado') || msg?.toLowerCase().includes('pin duplicado')
      toast.error(isDup ? 'Ese PIN ya lo usa otro usuario. Elija otro PIN.' : msg ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 p-4`}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-stone-800">Perfil en restaurante</h3>
            <p className="text-xs text-stone-500 truncate">{row.name} · {row.email}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Rol en restaurante</label>
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value)}
            >
              {RESTAURANT_EMPLOYEE_TYPES.map((r) => (
                <option key={r.value || 'none'} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500 mt-1">
              Define qué puede hacer en Tukichef (POS, mesas, cocina, caja, etc.). No usa roles del panel tenant.
            </p>
          </div>

          {employeeType ? (
            <div className="border border-stone-200 rounded-xl p-3 space-y-3 bg-stone-50/50">
              <div>
                <p className="text-xs font-medium text-stone-700">PIN de acceso (login rápido)</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Único por usuario. Para entrar en terminal sin contraseña.</p>
                <p className="text-xs mt-2 text-stone-600">
                  Estado:{' '}
                  <span className={hasPinCurrently && !clearPin ? 'text-rest-700 font-medium' : ''}>
                    {clearPin ? 'Se quitará al guardar' : hasPinCurrently ? 'PIN configurado' : 'Sin PIN'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nuevo PIN (opcional)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={clearPin}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono bg-white disabled:bg-stone-100"
                  placeholder="4–6 dígitos"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearPin}
                  onChange={(e) => {
                    setClearPin(e.target.checked)
                    if (e.target.checked) setPin('')
                  }}
                  className="rounded border-stone-300 accent-rest-600"
                />
                Quitar PIN
              </label>
              {employeeType && (
                <p className="text-[11px] text-stone-500">
                  Permisos según rol: {EMPLOYEE_TYPE_LABELS[employeeType] ?? employeeType}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Sin rol de restaurante: este usuario no podrá usar Tukichef.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-stone-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600"
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
  )
}
