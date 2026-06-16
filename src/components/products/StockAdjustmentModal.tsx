import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { PortalModal } from '@/components/ui/PortalModal'
import { inventoryService } from '@/services/inventory.service'
import type { Product } from '@/services/products.service'

type Props = {
  product: Product
  branchId: number
  branchName: string
  onClose: () => void
  onSaved: () => void
}

export function StockAdjustmentModal({ product, branchId, branchName, onClose, onSaved }: Props) {
  const [type, setType] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (branchId <= 0) {
      toast.error('No hay sucursal activa para el ajuste')
      return
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('La cantidad debe ser mayor a cero')
      return
    }
    if (notes.trim() === '') {
      toast.error('Indica la observación del ajuste')
      return
    }
    if (type === 'out') {
      const stock = await inventoryService.getStock(product.id, branchId)
      const total =
        stock.find((s) => s.branch_id === branchId)?.quantity ?? stock[0]?.quantity ?? 0
      if (qty > total) {
        toast.error(`Stock insuficiente. Disponible: ${total}`)
        return
      }
    }
    setLoading(true)
    try {
      await inventoryService.adjustment({
        product_id: product.id,
        branch_id: branchId,
        type,
        quantity: qty,
        notes: notes.trim(),
      })
      toast.success('Ajuste registrado. Se actualizó el kardex.')
      onSaved()
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al registrar ajuste'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalModal open onClose={onClose} className="max-w-md">
      <div className="bg-white rounded-2xl shadow-xl w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2 p-5 pb-0">
          <div className="min-w-0">
            <h3 className="font-bold text-stone-800 text-lg">Ajustar inventario</h3>
            <p className="text-sm text-stone-600 mt-1 truncate">{product.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">Sucursal: {branchName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-stone-100 shrink-0 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
              Tipo de ajuste
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-stone-700">
                <input
                  type="radio"
                  name="adjType"
                  checked={type === 'in'}
                  onChange={() => setType('in')}
                  className="text-rest-600"
                />
                (+) Entrada
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-stone-700">
                <input
                  type="radio"
                  name="adjType"
                  checked={type === 'out'}
                  onChange={() => setType('out')}
                  className="text-rest-600"
                />
                (−) Salida
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Cantidad</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Observación</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo del ajuste"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm resize-none bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100 bg-stone-50/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50"
          >
            {loading ? 'Guardando…' : 'Registrar ajuste'}
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
