import { useState } from 'react'
import { X } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'

type Props = {
  open: boolean
  title: string
  description?: string
  orderLabel?: string
  onClose: () => void
  onConfirm: (reason: string, pin: string) => Promise<void>
}

export function VoidOrderPinModal({ open, title, description, orderLabel, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    setReason('')
    setPin('')
    onClose()
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(reason, pin)
      setReason('')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalModal open={open} onClose={handleClose} className="max-w-sm">
      <div className="bg-white rounded-2xl p-5 w-full space-y-3 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-stone-800">{title}</h3>
            {orderLabel && <p className="text-sm text-rest-700 font-medium mt-0.5">{orderLabel}</p>}
            {description && <p className="text-xs text-stone-500 mt-1">{description}</p>}
          </div>
          <button type="button" onClick={handleClose} className="p-1 rounded-lg hover:bg-stone-100 shrink-0">
            <X size={18} />
          </button>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo de anulación *"
          className="w-full border border-stone-200 rounded-xl p-2 text-sm resize-none"
          rows={2}
        />
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          maxLength={6}
          inputMode="numeric"
          placeholder="PIN de operaciones *"
          className="w-full border border-stone-200 rounded-xl p-2 text-sm"
          autoComplete="off"
        />
        <p className="text-xs text-stone-500">
          Mismo PIN configurado en Ajustes del restaurante. El pedido y sus comandas se eliminarán de la base de datos.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={loading || !reason.trim() || !pin.trim()}
            onClick={() => void handleConfirm()}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Anulando...' : 'Anular pedido'}
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
