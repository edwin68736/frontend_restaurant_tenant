import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, Loader2 } from 'lucide-react'
import { paymentToneClass } from '@/pages/subscription/subscriptionUx'
import { PayDot } from './subscription/PayDot'
import { useSubscriptionPlan } from './subscription/useSubscriptionPlan'

type Props = {
  onNavigate?: () => void
  /** Visible también en desktop dentro del sidebar lateral. */
  inSidebar?: boolean
}

/** Plan en sidebar lateral (móvil drawer y desktop colapsable). */
export default function SubscriptionSidebarCard({ onNavigate, inSidebar }: Props) {
  const plan = useSubscriptionPlan()

  if (plan.state === 'empty') return null

  if (plan.state === 'loading') {
    return (
      <div
        className={`mb-3 flex h-11 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 ${inSidebar ? '' : 'lg:hidden'}`}
      >
        <Loader2 size={16} className="animate-spin text-stone-400" />
      </div>
    )
  }

  const { hub, pay, dateLabel, accent, isDark, planName, tooltip } = plan

  return (
    <Link
      to="/suscripcion"
      title={tooltip}
      onClick={onNavigate}
      className={`mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all hover:shadow-sm ${inSidebar ? '' : 'lg:hidden'} ${accent}`}
    >
      <CreditCard size={16} className={`shrink-0 ${isDark ? 'text-white' : 'text-rest-600'}`} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-stone-900'}`}>{planName}</p>
        <p
          className={`mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase truncate ${paymentToneClass(
            hub.billing_context?.current_payment_tone ?? 'success',
          )}`}
        >
          <PayDot kind={pay.icon} size={10} />
          <span className="truncate">{pay.label}</span>
          <span className={`font-normal normal-case ${isDark ? 'text-white/50' : 'text-stone-400'}`}>·</span>
          <span className={`font-semibold normal-case truncate ${isDark ? 'text-white/90' : 'text-stone-700'}`}>
            {dateLabel}
          </span>
        </p>
      </div>
      <ChevronRight size={14} className={`shrink-0 ${isDark ? 'text-white/40' : 'text-stone-400'}`} aria-hidden />
    </Link>
  )
}
