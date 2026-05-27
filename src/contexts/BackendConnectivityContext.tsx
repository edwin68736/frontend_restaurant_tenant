import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import api from '@/services/api'
import { isNetworkOrTimeoutError } from '@/utils/networkErrors'
import { useAuth } from '@/contexts/AuthContext'

export type BackendConnectivityStatus = 'checking' | 'online' | 'offline'

/** Espera antes de mostrar el modal (evita parpadeo al cargar POS u otras vistas). */
const OFFLINE_OVERLAY_DELAY_MS = 1_200
const HEALTH_PROBE_INTERVAL_MS = 45_000

type BackendConnectivityContextValue = {
  status: BackendConnectivityStatus
  message: string
  /** Estado interno: el backend no respondió al health check. */
  isOffline: boolean
  /** Solo true tras ~1,2 s offline sostenido — usar en el overlay visual. */
  showOfflineOverlay: boolean
  retry: () => Promise<void>
}

const BackendConnectivityContext = createContext<BackendConnectivityContextValue | undefined>(
  undefined,
)

async function probeBackend(): Promise<void> {
  await api.get('/health', { timeout: 12_000, validateStatus: (s) => s >= 200 && s < 500 })
}

export function BackendConnectivityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [status, setStatus] = useState<BackendConnectivityStatus>('online')
  const [message, setMessage] = useState('')
  const [showOfflineOverlay, setShowOfflineOverlay] = useState(false)
  const probeInFlightRef = useRef(false)

  const markOnline = useCallback(() => {
    setStatus('online')
    setMessage('')
    setShowOfflineOverlay(false)
  }, [])

  const markOffline = useCallback((msg?: string) => {
    setStatus('offline')
    setMessage(
      msg ??
        (typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Sin conexión a internet.'
          : 'No se pudo conectar con el servidor.'),
    )
  }, [])

  const runHealthProbe = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      if (probeInFlightRef.current) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        markOffline('Sin conexión a internet en este dispositivo.')
        return
      }
      probeInFlightRef.current = true
      if (opts?.userInitiated) {
        setStatus('checking')
        setMessage('')
      }
      try {
        await probeBackend()
        markOnline()
      } catch (e) {
        markOffline(
          isNetworkOrTimeoutError(e) ? undefined : 'El servidor no respondió correctamente.',
        )
        if (opts?.userInitiated) throw e
      } finally {
        probeInFlightRef.current = false
      }
    },
    [markOffline, markOnline],
  )

  const retry = useCallback(async () => {
    await runHealthProbe({ userInitiated: true })
  }, [runHealthProbe])

  // Retraso al mostrar el modal: solo si el offline se mantiene.
  useEffect(() => {
    if (status !== 'offline') {
      setShowOfflineOverlay(false)
      return
    }
    const timer = window.setTimeout(() => setShowOfflineOverlay(true), OFFLINE_OVERLAY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      markOnline()
      return
    }

    void runHealthProbe().catch(() => undefined)

    const onBrowserOffline = () => markOffline('Sin conexión a internet en este dispositivo.')
    const onBrowserOnline = () => {
      void runHealthProbe().catch(() => undefined)
    }
    window.addEventListener('offline', onBrowserOffline)
    window.addEventListener('online', onBrowserOnline)

    const interval = window.setInterval(() => {
      void runHealthProbe().catch(() => undefined)
    }, HEALTH_PROBE_INTERVAL_MS)

    // Cualquier respuesta HTTP exitosa confirma que hay conexión (sin marcar offline en errores sueltos).
    const reqId = api.interceptors.response.use(
      (res) => {
        markOnline()
        return res
      },
      (err) => Promise.reject(err),
    )

    return () => {
      window.removeEventListener('offline', onBrowserOffline)
      window.removeEventListener('online', onBrowserOnline)
      window.clearInterval(interval)
      api.interceptors.response.eject(reqId)
    }
  }, [authLoading, isAuthenticated, markOffline, markOnline, runHealthProbe])

  const value = useMemo(
    () => ({
      status,
      message,
      isOffline: status === 'offline',
      showOfflineOverlay,
      retry,
    }),
    [status, message, showOfflineOverlay, retry],
  )

  return (
    <BackendConnectivityContext.Provider value={value}>{children}</BackendConnectivityContext.Provider>
  )
}

export function useBackendConnectivity() {
  const ctx = useContext(BackendConnectivityContext)
  if (!ctx) throw new Error('useBackendConnectivity requiere BackendConnectivityProvider')
  return ctx
}
