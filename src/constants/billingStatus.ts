/** Estados canónicos de tenant_sales.billing_status — deben coincidir con backend_go/pkg/billingstate. */

export const BILLING_STATUS = {
  pending: 'pending',
  sent: 'sent',
  accepted: 'accepted',
  observed: 'observed',
  rejected: 'rejected',
  error: 'error',
} as const

export type SaleBillingStatus = (typeof BILLING_STATUS)[keyof typeof BILLING_STATUS]

const VALID = new Set<string>(Object.values(BILLING_STATUS))

export function normalizeBillingStatus(raw: unknown): SaleBillingStatus {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (VALID.has(s)) return s as SaleBillingStatus
  return BILLING_STATUS.pending
}

export const BILLING_STATUS_COLORS: Record<SaleBillingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  observed: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-600',
  error: 'bg-orange-100 text-orange-700',
}

export const BILLING_STATUS_LABELS: Record<SaleBillingStatus, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  accepted: 'Aceptado',
  observed: 'Aceptado con observaciones',
  rejected: 'Rechazado',
  error: 'Error envío',
}

export function billingStatusLabel(status: unknown): string {
  return BILLING_STATUS_LABELS[normalizeBillingStatus(status)]
}

export function canShowCdr(status: unknown): boolean {
  const s = normalizeBillingStatus(status)
  return s === BILLING_STATUS.accepted || s === BILLING_STATUS.observed || s === BILLING_STATUS.rejected
}

export function canShowXmlSent(status: unknown): boolean {
  const s = normalizeBillingStatus(status)
  return s === BILLING_STATUS.sent || s === BILLING_STATUS.accepted || s === BILLING_STATUS.observed || s === BILLING_STATUS.rejected
}

export function canShowXmlGenerated(status: unknown): boolean {
  const s = normalizeBillingStatus(status)
  return s === BILLING_STATUS.pending || s === BILLING_STATUS.error
}

export function canShowSunatOfficialPdf(status: unknown): boolean {
  const s = normalizeBillingStatus(status)
  return s === BILLING_STATUS.sent || s === BILLING_STATUS.accepted || s === BILLING_STATUS.observed
}
