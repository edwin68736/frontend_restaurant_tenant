import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import {
  formatDate,
  getUrgencyTier,
  nextPaymentDate,
  paymentStatusShort,
  widgetAccentClass,
  widgetTooltip,
} from '@/pages/subscription/subscriptionUx'

export function useSubscriptionPlan() {
  const { hub, loading } = useSubscriptionStatus()

  if (loading && !hub) {
    return { state: 'loading' as const }
  }

  if (!hub?.subscription?.has_subscription) {
    return { state: 'empty' as const }
  }

  const sub = hub.subscription
  const tier = getUrgencyTier(hub)
  const pay = paymentStatusShort(hub)
  const dateLabel = nextPaymentDate(sub) ? formatDate(nextPaymentDate(sub)) : '—'
  const accent = widgetAccentClass(tier, sub.is_blocked)
  const isDark = tier === 'blocked' || sub.is_blocked
  const planName = sub.plan_name || 'Plan'

  return {
    state: 'ready' as const,
    hub,
    sub,
    pay,
    dateLabel,
    accent,
    isDark,
    planName,
    tooltip: widgetTooltip(hub),
  }
}
