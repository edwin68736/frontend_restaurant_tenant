import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { RESTAURANT_EMPLOYEE_TYPES, restaurantService } from '@/services/restaurant.service'
import { EMPLOYEE_TYPE_LABELS } from '@/utils/restaurantPermissions'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'
import { StaffBranchMultiSelect } from './StaffBranchMultiSelect'
import { companyService } from '@/services/company.service'

const OPERATIVE_ROLES = RESTAURANT_EMPLOYEE_TYPES.filter((r) => r.value !== '')

type Props = {
  onClose: () => void
  onSaved: () => void
  onFailed?: () => void
}

export function RestaurantStaffCreateModal({ onClose, onSaved, onFailed }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [employeeType, setEmployeeType] = useState('waiter')
  const [pin, setPin] = useState('')
  const [branchIds, setBranchIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    companyService
      .listBranches()
      .then((rows) => {
        const active = (rows ?? []).filter((b) => b.active !== false)
        const main = active.find((b) => b.is_main) ?? active[0]
        if (main) setBranchIds([main.id])
      })
      .catch(() => setBranchIds([]))
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nombre requerido')
      return
    }
    if (!email.trim()) {
      toast.error('Email requerido')
      return
    }
    const pinDigits = pin.replace(/\D/g, '')
    if (pinDigits.length < 4 || pinDigits.length > 6) {
      toast.error('PIN de acceso: 4 a 6 dígitos')
      return
    }
    if (branchIds.length === 0) {
      toast.error('Seleccione al menos una sucursal')
      return
    }
    setSaving(true)
    try {
      await restaurantService.createStaffUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        employee_type: employeeType,
        pin: pinDigits,
        branch_ids: branchIds,
      })
      toast.success('Usuario creado')
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      const isDup =
        msg?.toLowerCase().includes('pin ya está asignado') || msg?.toLowerCase().includes('pin duplicado')
      toast.error(isDup ? 'Ese PIN ya lo usa otro usuario. Elija otro PIN.' : msg ?? 'Error al crear')
      onFailed?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 p-4`}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-stone-800">Nuevo usuario</h3>
            <p className="text-xs text-stone-500">Operativo Tukichef (mozo, cajero, cocina…)</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-stone-500 mt-1">Identificador interno. El acceso diario es con PIN.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Teléfono</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Sucursales *</label>
            <StaffBranchMultiSelect value={branchIds} onChange={setBranchIds} disabled={saving} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Rol en restaurante *</label>
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value)}
            >
              {OPERATIVE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500 mt-1">
              Permisos Tukichef: {EMPLOYEE_TYPE_LABELS[employeeType] ?? employeeType}. No usa roles del panel ERP.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">PIN de acceso *</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4–6 dígitos"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono"
            />
          </div>
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
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
