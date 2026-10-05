import axios from 'axios'

/** Petición cancelada (navegación, Strict Mode, AbortController) — no es caída de red. */
export function isCanceledRequest(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (err.code === 'ERR_CANCELED') return true
  if (axios.isCancel(err)) return true
  return Boolean(err.config?.signal?.aborted)
}

/** Sin respuesta HTTP: sin internet, servidor caído, timeout, CORS, etc. */
export function isNetworkOrTimeoutError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (isCanceledRequest(err)) return false
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true
  return !err.response
}

export function networkErrorMessage(err: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sin conexión a internet en este dispositivo.'
  }
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return 'El servidor tardó demasiado en responder.'
    }
  }
  return 'No se pudo conectar con el servidor. Verifique su red o que el sistema esté en línea.'
}

/**
 * Mensaje para un cobro que falló. Sin respuesta HTTP (red lenta, timeout, WebView) el servidor
 * pudo haber guardado la venta igualmente: se avisa que reintentar es seguro (el cobro lleva una
 * clave de idempotencia, ver utils/idempotencyKey.ts) para que el cajero no la dé por perdida ni
 * la rehaga cambiando el carrito.
 */
export function checkoutErrorMessage(err: unknown): string {
  if (isNetworkOrTimeoutError(err)) {
    return 'No se recibió respuesta del servidor. Es posible que el cobro sí se haya registrado: vuelve a pulsar «Finalizar venta» (no se duplicará) o revisa en Ventas.'
  }
  const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
  return apiError ?? 'Error'
}
