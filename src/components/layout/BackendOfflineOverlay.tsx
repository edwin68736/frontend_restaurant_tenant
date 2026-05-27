import { useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useBackendConnectivity } from '@/contexts/BackendConnectivityContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { REST_OFFLINE_OVERLAY_Z } from '@/utils/restaurantUiLayers'

/**
 * Pantalla cuando no hay conexión con el backend.
 * Evita confundir al usuario (p. ej. modal «Abrir caja» por error de red).
 */
export function BackendOfflineOverlay() {
  const { showOfflineOverlay, message, retry, status } = useBackendConnectivity()
  const { refresh: refreshCash } = useCashSession()
  const [retrying, setRetrying] = useState(false)

  if (!showOfflineOverlay) return null

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retry()
      await refreshCash()
    } catch {
      /* mensaje ya en contexto */
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 ${REST_OFFLINE_OVERLAY_Z} flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4`}
      role="alertdialog"
      aria-labelledby="offline-title"
      aria-describedby="offline-desc"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <WifiOff className="w-7 h-7 text-amber-700" aria-hidden />
        </div>
        <div>
          <h2 id="offline-title" className="text-lg font-bold text-stone-900">
            Verifica tu conexión a internet
          </h2>
          <p id="offline-desc" className="text-sm text-stone-600 mt-2 leading-relaxed">
            {message ||
              'No pudimos comunicarnos con el sistema. Los datos no se sincronizarán hasta recuperar la conexión.'}
          </p>
          <p className="text-xs text-stone-500 mt-3">
            Si el problema persiste, espere a que vuelva la conexión e intente reconectar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={retrying || status === 'checking'}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-rest-600 text-white rounded-xl font-semibold hover:bg-rest-700 disabled:opacity-50"
        >
          <RefreshCw size={18} className={retrying || status === 'checking' ? 'animate-spin' : ''} />
          {retrying || status === 'checking' ? 'Comprobando…' : 'Reintentar conexión'}
        </button>
      </div>
    </div>
  )
}
