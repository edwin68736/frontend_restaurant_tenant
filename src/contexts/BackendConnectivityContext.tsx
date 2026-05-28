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
import { connectivityManager } from '@/lib/connectivity/connectivityManager'
import type { ConnectivityFailureKind, ConnectivityStatus } from '@/lib/connectivity/types'
import { useAuth } from '@/contexts/AuthContext'

export type BackendConnectivityStatus = ConnectivityStatus

type BackendConnectivityContextValue = {
  status: BackendConnectivityStatus
  failureKind: ConnectivityFailureKind
  message: string
  isOffline: boolean
  isDegraded: boolean
  recoveryMode: boolean
  showOfflineOverlay: boolean
  consecutiveFailures: number
  retry: () => Promise<void>
}

const BackendConnectivityContext = createContext<BackendConnectivityContextValue | undefined>(
  undefined,
)

export function BackendConnectivityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [snap, setSnap] = useState(() => connectivityManager.getState())
  const monitoringStartedRef = useRef(false)

  useEffect(() => connectivityManager.subscribe(() => setSnap(connectivityManager.getState())), [])

  useEffect(() => {
    if (!isAuthenticated) {
      monitoringStartedRef.current = false
      connectivityManager.stopMonitoring()
      return
    }

    if (authLoading) return

    if (monitoringStartedRef.current) return
    monitoringStartedRef.current = true

    connectivityManager.startMonitoring((onSuccess) => {
      const reqId = api.interceptors.response.use(
        (res) => {
          onSuccess()
          return res
        },
        (err) => Promise.reject(err),
      )
      return () => api.interceptors.response.eject(reqId)
    })

    return () => {
      monitoringStartedRef.current = false
      connectivityManager.stopMonitoring()
    }
  }, [authLoading, isAuthenticated])

  const retry = useCallback(async () => {
    await connectivityManager.probe({ userInitiated: true })
  }, [])

  const value = useMemo(
    () => ({
      status: snap.status,
      failureKind: snap.failureKind,
      message: snap.message,
      isOffline: snap.status === 'offline',
      isDegraded: snap.status === 'degraded',
      recoveryMode: snap.recoveryMode,
      showOfflineOverlay: snap.showOfflineOverlay,
      consecutiveFailures: snap.consecutiveFailures,
      retry,
    }),
    [snap, retry],
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
