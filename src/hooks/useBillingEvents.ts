import { useEffect, useRef } from 'react'
import {
  buildAuthHeaders,
  expireSession,
  getApiBaseUrl,
  recoverFromSessionUpdated,
  refreshAccessToken,
} from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { fetchEventStream } from '@/lib/sse/fetchEventStream'
import { isBranchSwitching } from '@/lib/branch/epoch'

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

/**
 * Estados de facturación en vivo (SSE) sobre `fetch` con la cabecera Authorization: el token y el tenant ya
 * NO van en la URL. Se reabre cuando cambia lo que define el alcance del stream (token, sucursal activa,
 * modo de vista y época) y se aborta al desmontar. Si la conexión se cae y vuelve, `onReconnect` avisa al
 * consumidor para que vuelva a pedir su estado (los eventos son notificaciones de cambio, no un log).
 */
export function useBillingEvents(
  onUpdate: (evt: BillingStatusEvent) => void,
  enabled = true,
  onReconnect?: () => void,
) {
  const handlerRef = useRef(onUpdate)
  handlerRef.current = onUpdate
  const reconnectRef = useRef(onReconnect)
  reconnectRef.current = onReconnect

  const { token: authToken } = useAuth()
  const { activeBranchId, resetEpoch, isAllBranches, refreshContext } = useBranch()
  const refreshContextRef = useRef(refreshContext)
  refreshContextRef.current = refreshContext

  useEffect(() => {
    if (!enabled) return
    if (!localStorage.getItem('token')) return

    const ctrl = new AbortController()
    let tokenUsed: string | null = null

    void fetchEventStream({
      url: `${getApiBaseUrl()}/api/billing/events`,
      signal: ctrl.signal,
      getHeaders: () => {
        const headers = buildAuthHeaders()
        tokenUsed = localStorage.getItem('token')
        return headers
      },
      onMessage: (msg) => {
        if (msg.event !== 'billing.status.updated') return
        try {
          const data = JSON.parse(msg.data) as BillingStatusEvent
          if (data?.sale_id) handlerRef.current(data)
        } catch {
          /* ignore */
        }
      },
      onOpen: ({ reconnected }) => {
        if (reconnected) reconnectRef.current?.()
      },
      // 401: si el token ya cambió (cambio de sucursal / otro refresh) se reabre con el vigente; si no, se
      // renueva con el refresh token. Sin refresh (PIN) un 401 es sesión vencida: igual que el resto de la API.
      onUnauthorized: async () => {
        if (localStorage.getItem('token') !== tokenUsed) return true
        const out = await refreshAccessToken()
        if (out.status === 'ok') return true
        if (out.status === 'unavailable-session') expireSession('session_expired')
        return false
      },
      onAccessChanged: async ({ status }) => {
        if (isBranchSwitching()) return false // el cambio de sucursal propio reabre el stream por el efecto
        if (localStorage.getItem('token') !== tokenUsed) return true
        try {
          if (status === 409) return (await recoverFromSessionUpdated()) !== null
          await refreshContextRef.current() // 403 BRANCH_*: la sucursal activa pudo cambiar
          return true
        } catch {
          return false
        }
      },
      onGiveUp: (reason) => {
        if (reason === 'no-streaming') {
          console.warn('[Tukichef] Este WebView no entrega streaming de fetch; estados SUNAT en vivo desactivados.')
        }
      },
    })

    return () => ctrl.abort()
  }, [enabled, authToken, activeBranchId, resetEpoch, isAllBranches])
}
