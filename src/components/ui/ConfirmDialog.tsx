import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'

type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  variant?: 'danger' | 'default'
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  variant = 'default',
}: ConfirmDialogProps) {
  const confirmClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-rest-600 hover:bg-rest-700 text-white'

  return (
    <PortalModal open={open} onClose={loading ? () => undefined : onClose} className="max-w-md">
      <div
        className="bg-white rounded-2xl shadow-xl overflow-hidden"
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="p-5 sm:p-6">
          <div className="flex gap-4">
            <div
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
                variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
              }`}
            >
              <AlertTriangle
                size={22}
                className={variant === 'danger' ? 'text-red-700' : 'text-amber-700'}
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="confirm-dialog-title" className="font-bold text-stone-900 text-lg leading-snug">
                {title}
              </h3>
              <div id="confirm-dialog-desc" className="text-sm text-stone-600 mt-2 leading-relaxed">
                {message}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-stone-200 bg-stone-50/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 min-h-[48px] py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 min-h-[48px] py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 ${confirmClass}`}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
