import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import type { BillingHub } from '@/services/subscription.service'
import {
  STATUS_LABELS,
  contractedPeriodLabel,
  formatDate,
  formatMoney,
  nextPaymentDate,
  paymentStatusShort,
  paymentToneClass,
  planAmountDisplay,
  statusBadgeClass,
} from './subscriptionUx'

type Props = { hub: BillingHub }

export default function CurrentSubscriptionCard({ hub }: Props) {
  const [expanded, setExpanded] = useState(false)
  const sub = hub.subscription
  const ctx = hub.billing_context
  const pay = paymentStatusShort(hub)
  const nextPay = nextPaymentDate(sub)
  const planAmt = planAmountDisplay(hub)

  return (
    <section className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-stone-50/80 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Suscripción actual</p>
            <h2 className="text-lg font-bold text-stone-900 truncate mt-0.5">{sub.plan_name || 'Sin plan'}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass(sub.status)}`}>
                {STATUS_LABELS[sub.status] ?? sub.status}
              </span>
              {sub.end_date ? (
                <span className="text-stone-600">
                  Vence: <span className="font-medium">{formatDate(sub.end_date)}</span>
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-stone-600">
              Próximo pago:{' '}
              <span className="font-semibold text-stone-900">
                {nextPay ? formatDate(nextPay) : '—'} · {formatMoney(planAmt)}
              </span>
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rest-700 mt-1">
            {expanded ? (
              <>
                Ocultar <ChevronUp size={16} />
              </>
            ) : (
              <>
                Ver detalles <ChevronDown size={16} />
              </>
            )}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-stone-100 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
            {[
              { label: 'Ciclo', value: contractedPeriodLabel(sub) },
              { label: 'Inicio', value: sub.start_date ? formatDate(sub.start_date) : '—' },
              { label: 'Fin', value: sub.end_date ? formatDate(sub.end_date) : '—' },
              {
                label: 'Días restantes',
                value: sub.days_until_expiry >= 0 ? `${sub.days_until_expiry} días` : 'Vencido',
              },
              { label: 'Estado de pago', value: ctx?.current_payment_label ?? pay.label },
            ].map(cell => (
              <div key={cell.label} className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">{cell.label}</p>
                <p className="text-sm font-semibold text-stone-900 mt-0.5">{cell.value}</p>
              </div>
            ))}
          </div>

          {hub.documents && !hub.documents.is_unlimited ? (
            <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5 text-sm">
              <p className="font-semibold text-stone-800">Documentos electrónicos</p>
              <p className="text-stone-600 mt-0.5">
                {hub.documents.total_available} disponibles · {hub.documents.plan_used} usados del plan
                {hub.documents.package_remaining > 0
                  ? ` · ${hub.documents.package_remaining} de paquetes`
                  : ''}
              </p>
            </div>
          ) : hub.documents?.is_unlimited ? (
            <p className="text-sm text-emerald-700 font-medium">Documentos electrónicos ilimitados en tu plan.</p>
          ) : null}

          {ctx?.current_payment_tone ? (
            <span
              className={clsx(
                'inline-flex px-2 py-0.5 rounded-full text-xs font-bold',
                paymentToneClass(ctx.current_payment_tone),
              )}
            >
              {ctx.current_payment_label}
            </span>
          ) : null}

          {hub.status_banner?.message && ctx?.show_status_banner ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              {hub.status_banner.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
