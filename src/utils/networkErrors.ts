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
