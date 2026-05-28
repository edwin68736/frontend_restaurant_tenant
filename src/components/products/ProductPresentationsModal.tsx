import { useEffect, useState } from 'react'
import { PortalModal } from '@/components/ui/PortalModal'
import { ProductPresentationsEditor } from '@/components/products/ProductPresentationsEditor'
import type { ProductPresentation } from '@/services/products.service'

type Props = {
  open: boolean
  productName?: string
  presentations: ProductPresentation[]
  onClose: () => void
  onSave: (presentations: ProductPresentation[]) => void
}

export function ProductPresentationsModal({
  open,
  productName,
  presentations,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ProductPresentation[]>([])

  useEffect(() => {
    if (open) {
      setDraft(presentations.length > 0 ? presentations : [{ name: '', sale_price: 0 }])
    }
  }, [open, presentations])

  const handleSave = () => {
    const rows = draft
      .map((p) => ({
        ...p,
        name: p.name.trim(),
        sale_price: Math.round((Number(p.sale_price) || 0) * 100) / 100,
      }))
      .filter((p) => p.name.length > 0)
    onSave(rows)
    onClose()
  }

  return (
    <PortalModal open={open} onClose={onClose} className="max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-stone-200 shrink-0">
          <h3 className="font-bold text-stone-900 text-lg">Presentaciones</h3>
          {productName ? (
            <p className="text-sm text-stone-500 mt-0.5 truncate">{productName}</p>
          ) : null}
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <ProductPresentationsEditor presentations={draft} onChange={setDraft} embedded />
        </div>
        <div className="p-4 border-t border-stone-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 min-h-[48px] py-2.5 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:bg-rest-700"
          >
            Guardar presentaciones
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
