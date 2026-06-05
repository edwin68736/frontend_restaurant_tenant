import { CheckCircle2, Receipt } from 'lucide-react'
import type { BillingHub, BillingInvoice } from '@/services/subscription.service'
import {
  STATUS_LABELS,
  billingCyclePaymentTotal,
  formatBillingPeriod,
  formatDate,
  formatMoney,
  INVOICE_STATUS_UI,
  sortInvoicesForBillingList,
} from './subscriptionUx'

type Props = {
  hub: BillingHub
  onPay: (invoice: BillingInvoice) => void
}

function InvoiceRow({
  hub,
  invoice,
  onPay,
}: {
  hub: BillingHub
  invoice: BillingInvoice
  onPay: (inv: BillingInvoice) => void
}) {
  const sub = hub.subscription
  const ui = INVOICE_STATUS_UI[invoice.status] ?? INVOICE_STATUS_UI.pending
  const total = billingCyclePaymentTotal(invoice, sub)
  const canPay = invoice.status === 'pending' || invoice.status === 'overdue'

  return (
    <article
      className={`rounded-xl border border-stone-100 bg-white border-l-4 ${ui.stripe} px-4 py-3.5 shadow-sm`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${ui.badge}`}>
            {ui.label}
          </span>
          <h3 className="text-sm font-bold text-stone-900 mt-1.5">{sub.plan_name || 'Plan'}</h3>
          <p className="text-sm text-stone-600">Periodo {formatBillingPeriod(invoice.period_end)}</p>
          <p className="text-lg font-bold text-stone-900 mt-1">{formatMoney(total, invoice.currency)}</p>
          <p className="text-xs text-stone-500 mt-1">
            Emisión {formatDate(invoice.period_start)} · Vence {formatDate(invoice.due_date)}
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-2">
          {canPay ? (
            <button
              type="button"
              onClick={() => onPay(invoice)}
              className="px-4 py-2 rounded-xl bg-rest-600 text-white text-sm font-semibold hover:bg-rest-700 touch-manipulation"
            >
              Pagar
            </button>
          ) : invoice.status === 'paid' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 px-2 py-1">
              <CheckCircle2 size={14} />
              Pagado
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function BillingTab({ hub, onPay }: Props) {
  const sorted = sortInvoicesForBillingList(hub.invoices)
  const pending = sorted.filter(i => i.status === 'pending' || i.status === 'overdue')
  const paid = sorted.filter(i => i.status === 'paid')

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white p-8 text-center">
        <Receipt className="mx-auto text-stone-300 mb-2" size={32} />
        <p className="text-sm text-stone-500">No hay facturas registradas por el momento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 px-0.5">
            Pendientes y vencidos
          </h3>
          <div className="space-y-3">
            {pending.map(inv => (
              <InvoiceRow key={inv.id} hub={hub} invoice={inv} onPay={onPay} />
            ))}
          </div>
        </div>
      ) : null}

      {paid.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 px-0.5">Completados</h3>
          <div className="space-y-3">
            {paid.map(inv => (
              <InvoiceRow key={inv.id} hub={hub} invoice={inv} onPay={onPay} />
            ))}
          </div>
        </div>
      ) : null}

      {hub.subscription.has_pending_payment_review ? (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          Tienes un comprobante en revisión ({STATUS_LABELS.pending_review ?? 'En revisión'}).
        </p>
      ) : null}
    </div>
  )
}
