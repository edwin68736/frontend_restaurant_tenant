import { X } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'
import type { Comanda } from '@/services/restaurant.service'
import type { KitchenRound } from '@/utils/posOrderHelpers'

type Props = {
  open: boolean
  onClose: () => void
  rounds: KitchenRound[]
  orderCode?: string
  onReprint: (round: KitchenRound) => void
}

export function KitchenRoundHistoryModal({ open, onClose, rounds, orderCode, onReprint }: Props) {
  const visible = rounds.filter((r) => r.comandas.length > 0)
  return (
    <PortalModal open={open} onClose={onClose} className="max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl w-full max-h-[min(85vh,640px)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
        <div>
          <h3 className="font-bold text-stone-800">Historial de comandas</h3>
          {orderCode && <p className="text-xs text-stone-500 mt-0.5">Pedido {orderCode}</p>}
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100" aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
      <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-6">Aún no hay comandas enviadas.</p>
        ) : (
          visible.map((round) => (
            <RoundCard key={round.orderId} round={round} onReprint={() => onReprint(round)} />
          ))
        )}
      </div>
      </div>
    </PortalModal>
  )
}

function RoundCard({ round, onReprint }: { round: KitchenRound; onReprint: () => void }) {
  const printed = !!round.printedAt
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-stone-800">Comanda #{round.orderNumber}</span>
          {printed ? (
            <span className="ml-2 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              Impresa
            </span>
          ) : (
            <span className="ml-2 text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
              Sin marcar impresa
            </span>
          )}
          {round.allDelivered && (
            <span className="ml-1 text-[10px] text-stone-500">· Entregada</span>
          )}
        </div>
        <button
          type="button"
          onClick={onReprint}
          className="text-xs font-semibold text-rest-600 hover:underline shrink-0"
        >
          Reimprimir
        </button>
      </div>
      <ul className="text-xs text-stone-600 space-y-0.5">
        {round.comandas.map((c: Comanda) => (
          <li key={c.id} className="flex justify-between gap-2">
            <span className="truncate">
              {c.quantity}x {c.product_name}
              {(c as Comanda & { preparation_area?: string }).preparation_area &&
                ` · ${(c as Comanda & { preparation_area?: string }).preparation_area}`}
            </span>
            <span className="text-stone-400 shrink-0 capitalize">{c.status}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
