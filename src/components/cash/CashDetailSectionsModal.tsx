import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Printer } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'
import { MAX_H_SHEET_PANEL } from '@/utils/safeAreaClasses'
import {
  CASH_DETAIL_SECTION_OPTIONS,
  allCashDetailSections,
  type CashDetailSections,
} from '@/utils/cashSessionDetailTicket'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (sections: CashDetailSections) => void
  title?: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
  busy?: boolean
  /** Abierto encima de otro modal (p. ej. el de reportes de sesión). */
  stacked?: boolean
}

/**
 * Elige qué secciones lleva el ticket de detalle de caja. Siempre se abre con todo marcado; el
 * encabezado, el resumen/cuadre y las ventas por método de pago se imprimen siempre.
 */
export function CashDetailSectionsModal({
  open,
  onClose,
  onConfirm,
  title = 'Imprimir detalle de caja',
  description = 'Elige qué secciones incluir en el ticket.',
  cancelLabel = 'Cancelar',
  confirmLabel = 'Imprimir',
  busy = false,
  stacked = false,
}: Props) {
  const [sections, setSections] = useState<CashDetailSections>(allCashDetailSections)

  // Cada vez que se abre vuelve a marcarse todo.
  useEffect(() => {
    if (open) setSections(allCashDetailSections())
  }, [open])

  const noneChecked = CASH_DETAIL_SECTION_OPTIONS.every((o) => !sections[o.key])

  return (
    <PortalModal open={open} onClose={onClose} stacked={stacked} className="max-w-md" overlayClassName="items-end sm:items-center">
      <div className={clsx('bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full p-5 overflow-y-auto', MAX_H_SHEET_PANEL)}>
        <div className="flex items-center gap-2 mb-2">
          <Printer size={20} className="text-stone-700" />
          <h3 className="font-bold text-stone-800 text-lg">{title}</h3>
        </div>
        <p className="text-sm text-stone-600">{description}</p>
        <div className="mt-3 space-y-2">
          {CASH_DETAIL_SECTION_OPTIONS.map((o) => (
            <label key={o.key} className="flex items-start gap-2 cursor-pointer rounded-xl border border-stone-100 px-3 py-2 hover:bg-stone-50">
              <input
                type="checkbox"
                checked={sections[o.key]}
                onChange={(e) => setSections((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                className="mt-0.5 rounded border-stone-300"
              />
              <span>
                <span className="block text-sm font-medium text-stone-800">{o.label}</span>
                <span className="block text-xs text-stone-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-500">
          {noneChecked
            ? 'Sin secciones opcionales: solo se imprimirá el resumen, el cuadre de caja y las ventas por método de pago.'
            : 'Siempre se incluyen el encabezado, el resumen con el cuadre de caja y las ventas por método de pago.'}
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(sections)}
            className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
