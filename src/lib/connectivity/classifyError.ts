import axios from 'axios'
import { isCanceledRequest, isNetworkOrTimeoutError } from '@/utils/networkErrors'
import type { ConnectivityFailureKind } from './types'

function isFetchAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export function classifyProbeError(err: unknown): {
  kind: ConnectivityFailureKind
  message: string
} {
  if (isCanceledRequest(err) || isFetchAbort(err)) {
    return { kind: 'none', message: '' }
  }

  if (err instanceof TypeError) {
    const browserOffline = typeof navigator !== 'undefined' && !navigator.onLine
    return {
      kind: browserOffline ? 'no_internet' : 'server_unreachable',
      message: browserOffline
        ? 'Sin conexión de red en este dispositivo.'
        : 'No se pudo conectar al servidor. Verifique la red local o que el sistema esté encendido.',
    }
  }

  const browserOffline = typeof navigator !== 'undefined' && !navigator.onLine

  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return {
        kind: 'server_slow',
        message: 'El servidor tardó demasiado en responder.',
      }
    }
    if (err.response && err.response.status >= 500) {
      return {
        kind: 'server_error',
        message: 'El servidor respondió con un error interno.',
      }
    }
    if (isNetworkOrTimeoutError(err)) {
      return {
        kind: browserOffline ? 'no_internet' : 'server_unreachable',
        message: browserOffline
          ? 'Sin conexión de red en este dispositivo.'
          : 'No se pudo conectar al servidor. Verifique la red local o que el sistema esté encendido.',
      }
    }
  }

  if (browserOffline) {
    return {
      kind: 'no_internet',
      message: 'Sin conexión de red en este dispositivo.',
    }
  }

  return {
    kind: 'server_unreachable',
    message: 'No se pudo conectar al servidor.',
  }
}
