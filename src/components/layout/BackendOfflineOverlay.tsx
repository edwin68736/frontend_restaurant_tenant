import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, ServerCrash, WifiOff, X } from 'lucide-react'
import { useBackendConnectivity } from '@/contexts/BackendConnectivityContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { getDisplayedTenantApiUrl } from '@/services/api'
import { isDevelopmentMode } from '@/lib/runtime/environment'
import type { ConnectivityFailureKind } from '@/lib/connectivity/types'
import { REST_OFFLINE_OVERLAY_Z } from '@/utils/restaurantUiLayers'
import { DRAWER_BOTTOM_WRAP_X_RESP } from '@/utils/safeAreaClasses'

function titleForKind(kind: ConnectivityFailureKind): string {
  switch (kind) {
    case 'no_internet':
      return 'Sin conexión de red'
    case 'server_slow':
      return 'El servidor responde muy lento'
    case 'server_error':
      return 'Error en el servidor'
    case 'server_unreachable':
    default:
      return 'No se pudo conectar al servidor'
  }
}

function IconForKind({ kind }: { kind: ConnectivityFailureKind }) {
  if (kind === 'no_internet') {
    return <WifiOff className="w-5 h-5 text-amber-800 shrink-0" aria-hidden />
  }
  return <ServerCrash className="w-5 h-5 text-amber-800 shrink-0" aria-hidden />
}

/**
 * Barra de conectividad no bloqueante: degraded = aviso; offline = panel expandible sin tapar el POS.
 */
export function BackendOfflineOverlay() {
  const {
    status,
    isDegraded,
    showOfflineOverlay,
    message,
    failureKind,
    retry,
    consecutiveFailures,
  } = useBackendConnectivity()
  const { refresh: refreshCash } = useCashSession()
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)
  const [offlineDismissed, setOfflineDismissed] = useState(false)

  if (status === 'online' || status === 'checking') return null

  const showDegradedBar = isDegraded
  const showOfflineBar = showOfflineOverlay && !offlineDismissed

  if (!showDegradedBar && !showOfflineBar) return null

  const title = titleForKind(failureKind)
  const serverUrl = getDisplayedTenantApiUrl()

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retry()
      await refreshCash()
      setOfflineDismissed(false)
    } catch {
      /* mensaje en contexto */
    } finally {
      setRetrying(false)
    }
  }

  const handleChangeServer = () => {
    if (isDevelopmentMode()) navigate('/ajustes')
  }

  if (showDegradedBar && !showOfflineBar) {
    return (
      <div
        className={`fixed top-0 left-0 right-0 ${REST_OFFLINE_OVERLAY_Z} pt-safe ${DRAWER_BOTTOM_WRAP_X_RESP} pointer-events-none`}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-3xl mt-2 pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-md text-sm text-amber-950">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          <span className="flex-1 min-w-0">
            Comprobando conexión con el servidor… ({consecutiveFailures}/3)
          </span>
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="shrink-0 text-xs font-semibold text-rest-700 hover:text-rest-900 disabled:opacity-50"
          >
            {retrying ? '…' : 'Reintentar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 ${REST_OFFLINE_OVERLAY_Z} pt-safe ${DRAWER_BOTTOM_WRAP_X_RESP} pointer-events-none`}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto max-w-lg mt-2 pointer-events-auto rounded-2xl border border-amber-300 bg-white shadow-xl overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200">
          <IconForKind kind={failureKind} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-900 text-sm">{title}</p>
            <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
              {message || 'Los cambios pueden no sincronizarse hasta recuperar la conexión.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOfflineDismissed(true)}
            className="p-1 rounded-lg hover:bg-amber-100 text-stone-500"
            aria-label="Minimizar aviso y seguir operando"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Servidor actual
            </p>
            <p className="text-xs font-mono text-stone-800 break-all mt-0.5">{serverUrl}</p>
          </div>
          <p className="text-[11px] text-stone-500">
            Puede seguir tomando pedidos; al recuperar conexión el aviso desaparecerá solo.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:bg-rest-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Comprobando…' : 'Reintentar'}
            </button>
            {isDevelopmentMode() && (
              <button
                type="button"
                onClick={handleChangeServer}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-xl border border-stone-200 text-sm font-semibold text-stone-800 hover:bg-stone-50"
              >
                Cambiar servidor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
