import { useEffect, useRef } from 'react'
import { getTenantApiBaseUrl } from '@/services/api'

export interface BillingStatusEvent {
  event: string
  tenant_id?: number
  sale_id: number
  status: string
  pipeline_status?: string
  sunat_message?: string
}

const TERMINAL_BILLING = new Set(['accepted', 'rejected', 'error'])

export function isBillingStatusTerminal(status: string): boolean {
  return TERMINAL_BILLING.has(status)
}

export function useBillingEvents(
  onUpdate: (evt: BillingStatusEvent) => void,
  enabled = true,
) {
  const handlerRef = useRef(onUpdate)
  handlerRef.current = onUpdate

  useEffect(() => {
    if (!enabled) return
    const token = localStorage.getItem('token')
    if (!token) return

    const url = `${getTenantApiBaseUrl()}/api/billing/events?access_token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    const onMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as BillingStatusEvent
        if (data?.sale_id) handlerRef.current(data)
      } catch {
        /* ignore */
      }
    }

    es.addEventListener('billing.status.updated', onMessage)
    return () => {
      es.removeEventListener('billing.status.updated', onMessage)
      es.close()
    }
  }, [enabled])
}
