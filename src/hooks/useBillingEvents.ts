import { useEffect, useRef } from 'react'
import { getApiBaseUrl } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'

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
  // El token vigente (AuthContext) es dependencia del efecto: al cambiar de sucursal o renovarse el
  // token, la conexión SSE se cierra y se reabre con el token nuevo.
  // RIESGO CONOCIDO: EventSource no admite cabeceras, así que el token sigue yendo en la URL
  // (?access_token=). Quitarlo exige un cambio de backend (cookie corta o ticket de un solo uso)
  // o usar fetch-streaming con Authorization.
  const { token: authToken } = useAuth()

  useEffect(() => {
    if (!enabled) return
    const token = authToken || localStorage.getItem('token')
    if (!token) return

    const url = `${getApiBaseUrl()}/api/billing/events?access_token=${encodeURIComponent(token)}`
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
  }, [enabled, authToken])
}
