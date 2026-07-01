import { useState } from 'react'
import { X } from 'lucide-react'
import { useCashSession } from '@/contexts/CashSessionContext'
import { useBackendConnectivity } from '@/contexts/BackendConnectivityContext'
import { useBranch } from '@/contexts/BranchContext'
import { CashOpenSessionForm } from '@/components/cash/CashOpenSessionForm'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'
import { FIXED_OVERLAY_SHEET, MAX_H_SHEET_PANEL } from '@/utils/safeAreaClasses'

export function CashSessionOpenModal() {
  const { openModal, setOpenModal, openMySession } = useCashSession()
  const { isOffline } = useBackendConnectivity()
  const { activeBranch } = useBranch()
  const [saving, setSaving] = useState(false)

  if (!openModal || isOffline) return null

  const handleClose = () => {
    if (saving) return
    setOpenModal(false)
  }

  return (
    <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-end sm:items-center justify-center bg-black/50 ${FIXED_OVERLAY_SHEET}`}>
      <div className={`bg-white rounded-t-3xl sm:rounded-2xl p-5 w-full max-w-md space-y-2 shadow-xl ${MAX_H_SHEET_PANEL} overflow-y-auto`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-stone-800 text-lg">Abrir mi caja</h3>
            <p className="text-xs text-stone-500 mt-1">
              En esta sucursal aún no tiene caja abierta. Indique el efectivo inicial con el teclado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-stone-100 shrink-0 touch-manipulation"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <CashOpenSessionForm
          branchName={activeBranch?.name}
          saving={saving}
          onCancel={handleClose}
          onSubmit={async (balance, notes) => {
            setSaving(true)
            try {
              await openMySession(balance, notes)
            } catch {
              /* toast en openMySession */
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    </div>
  )
}
