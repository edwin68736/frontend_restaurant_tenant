import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { paymentToneClass } from '@/pages/subscription/subscriptionUx'
import { PayDot } from './subscription/PayDot'
import { useSubscriptionPlan } from './subscription/useSubscriptionPlan'

/** Plan en header — solo pantallas grandes (lg+). */
export default function SubscriptionHeaderBadge() {
  const plan = useSubscriptionPlan()

  if (plan.state === 'empty') return null

  if (plan.state === 'loading') {
    return (
      <div className="hidden lg:flex h-9 w-28 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 shrink-0">
        <Loader2 size={14} className="animate-spin text-stone-400" />
      </div>
    )
  }

  const { hub, pay, dateLabel, accent, isDark, planName, tooltip } = plan

  return (
    <Link
      to="/suscripcion"
      title={tooltip}
      className={`hidden lg:flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all hover:shadow-md shrink-0 ${accent}`}
    >
      <div className="flex flex-col items-end leading-none min-w-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/90' : 'text-stone-500'}`}>
          {planName}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold uppercase ${paymentToneClass(
            hub.billing_context?.current_payment_tone ?? 'success',
          )}`}
        >
          <PayDot kind={pay.icon} />
          {pay.label}
        </span>
      </div>
      <span className={`w-px h-7 shrink-0 ${isDark ? 'bg-white/20' : 'bg-stone-200'}`} aria-hidden />
      <div className={`text-[10px] leading-tight text-right shrink-0 ${isDark ? 'text-stone-200' : 'text-stone-600'}`}>
        <span className={`block font-medium ${isDark ? 'text-white/60' : 'text-stone-400'}`}>Próximo</span>
        <span className={`font-semibold whitespace-nowrap ${isDark ? 'text-white' : 'text-stone-800'}`}>{dateLabel}</span>
      </div>
    </Link>
  )
}
