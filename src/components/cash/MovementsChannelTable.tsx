import type { MovementReportRow, PaymentMethodRecord } from '@/services/cashbank.service'
import { movementFlowBadgeClass, movementFlowLabel, movementSubtypeLabel } from '@/utils/cashMovementDisplay'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'

type Props = {
  rows: MovementReportRow[]
  paymentMethods: PaymentMethodRecord[]
  loading?: boolean
  emptyMessage?: string
  showPaymentMethod?: boolean
}

export function MovementsChannelTable({
  rows,
  paymentMethods,
  loading = false,
  emptyMessage = 'Sin movimientos',
  showPaymentMethod = true,
}: Props) {
  const paymentLabel = (code?: string) => paymentMethodDisplayLabel(code, paymentMethods)
  const headers = showPaymentMethod
    ? ['Fecha', 'Tipo', 'Categoría', 'Referencia', 'Usuario', 'Método', 'Monto']
    : ['Fecha', 'Tipo', 'Categoría', 'Referencia', 'Usuario', 'Monto']

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-stone-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-stone-400">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-stone-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((m, idx) => (
              <tr
                key={`${m.movement_id}-${m.doc_number}-${m.payment_method}-${m.amount}-${idx}`}
                className="border-b border-stone-100"
              >
                <td className="px-4 py-2 text-xs whitespace-nowrap">
                  {m.date ? new Date(m.date).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${movementFlowBadgeClass(m.type)}`}
                  >
                    {movementFlowLabel(m.type)}
                  </span>
                  {(m.type === 'venta' || m.type === 'compra' || m.type === 'anulacion_venta') && (
                    <span className="block text-[10px] text-stone-500 mt-0.5">{movementSubtypeLabel(m.type)}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-stone-600">{m.category || '—'}</td>
                <td className="px-4 py-2 text-stone-700">{m.doc_number || m.cash_reference || '—'}</td>
                <td className="px-4 py-2 text-stone-600">{m.user_name || '—'}</td>
                {showPaymentMethod && (
                  <td className="px-4 py-2 text-stone-600">{paymentLabel(m.payment_method)}</td>
                )}
                <td className="px-4 py-2 font-semibold tabular-nums whitespace-nowrap">
                  S/ {Number(m.amount).toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
