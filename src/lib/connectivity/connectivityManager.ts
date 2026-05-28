import { probeBackendHealth } from './connectivityProbe'
import {
  CONNECTIVITY_DEFAULTS,
  type ConnectivityFailureKind,
  type ConnectivityState,
} from './types'

type Listener = () => void
type AxiosHookRegistrar = (onSuccess: () => void) => () => void

function initialState(): ConnectivityState {
  return {
    status: 'online',
    failureKind: 'none',
    message: '',
    consecutiveFailures: 0,
    recoveryMode: false,
    lastSuccessAt: null,
    lastFailureAt: null,
    showOfflineOverlay: false,
  }
}

class ConnectivityManager {
  private state: ConnectivityState = initialState()
  private listeners = new Set<Listener>()
  private probeTimerId: number | null = null
  private overlayTimer: number | null = null
  private sessionAbort: AbortController | null = null
  private probeInFlight = false
  private teardownFns: Array<() => void> = []
  private activeSessionId = 0
  private monitoring = false
  /** Última respuesta HTTP exitosa de la app (criterio principal en POS activo). */
  private lastApiSuccessAt = 0

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState(): ConnectivityState {
    return this.state
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }

  private patch(partial: Partial<ConnectivityState>) {
    this.state = { ...this.state, ...partial }
    this.emit()
  }

  private isSessionActive(sessionId: number): boolean {
    return this.monitoring && sessionId === this.activeSessionId
  }

  private hasRecentApiSuccess(): boolean {
    if (!this.lastApiSuccessAt) return false
    return Date.now() - this.lastApiSuccessAt < CONNECTIVITY_DEFAULTS.apiSuccessGraceMs
  }

  private clearProbeTimer() {
    if (this.probeTimerId !== null) {
      window.clearTimeout(this.probeTimerId)
      this.probeTimerId = null
    }
  }

  private clearOverlayTimer() {
    if (this.overlayTimer !== null) {
      window.clearTimeout(this.overlayTimer)
      this.overlayTimer = null
    }
  }

  private probeDelayMs(): number {
    return this.state.recoveryMode
      ? CONNECTIVITY_DEFAULTS.recoveryProbeIntervalMs
      : CONNECTIVITY_DEFAULTS.probeIntervalMs
  }

  private scheduleNextProbe(sessionId: number) {
    this.clearProbeTimer()
    if (!this.isSessionActive(sessionId)) return

    const delay = this.probeDelayMs()
    this.probeTimerId = window.setTimeout(() => {
      if (!this.isSessionActive(sessionId)) return
      if (document.visibilityState === 'hidden') {
        this.scheduleNextProbe(sessionId)
        return
      }
      const signal = this.sessionAbort?.signal
      void this.probe({ signal })
        .catch(() => undefined)
        .finally(() => {
          if (this.isSessionActive(sessionId)) {
            this.scheduleNextProbe(sessionId)
          }
        })
    }, delay)
  }

  private enterRecoveryMode() {
    if (this.state.recoveryMode) return
    this.patch({ recoveryMode: true })
    if (this.monitoring) {
      this.clearProbeTimer()
      this.scheduleNextProbe(this.activeSessionId)
    }
  }

  private exitRecoveryMode() {
    if (!this.state.recoveryMode) return
    this.patch({ recoveryMode: false })
  }

  private scheduleOverlayIfOffline() {
    this.clearOverlayTimer()
    if (this.state.status !== 'offline') {
      this.patch({ showOfflineOverlay: false })
      return
    }
    this.overlayTimer = window.setTimeout(() => {
      if (this.state.status === 'offline') {
        this.patch({ showOfflineOverlay: true })
      }
    }, CONNECTIVITY_DEFAULTS.overlayDelayMs)
  }

  private markOnline() {
    this.clearOverlayTimer()
    this.exitRecoveryMode()
    this.patch({
      status: 'online',
      failureKind: 'none',
      message: '',
      consecutiveFailures: 0,
      lastSuccessAt: new Date().toISOString(),
      showOfflineOverlay: false,
    })
  }

  private markOffline(kind: ConnectivityFailureKind, message: string) {
    this.patch({
      status: 'offline',
      failureKind: kind,
      message,
      lastFailureAt: new Date().toISOString(),
    })
    this.scheduleOverlayIfOffline()
  }

  /** Cualquier respuesta 2xx/3xx de axios confirma que el backend responde. */
  notifyHttpSuccess() {
    this.lastApiSuccessAt = Date.now()
    if (
      this.state.status === 'online' &&
      this.state.consecutiveFailures === 0 &&
      !this.state.recoveryMode
    ) {
      return
    }
    this.markOnline()
    if (this.monitoring) {
      this.clearProbeTimer()
      this.scheduleNextProbe(this.activeSessionId)
    }
  }

  async probe(opts?: { userInitiated?: boolean; signal?: AbortSignal }): Promise<boolean> {
    if (this.probeInFlight && !opts?.userInitiated) {
      return this.state.status === 'online'
    }

    if (!opts?.userInitiated && this.hasRecentApiSuccess()) {
      if (this.state.status !== 'online' || this.state.consecutiveFailures > 0) {
        this.markOnline()
      }
      return true
    }

    this.probeInFlight = true
    if (opts?.userInitiated) {
      this.patch({ status: 'checking', message: '' })
    }

    try {
      const result = await probeBackendHealth(CONNECTIVITY_DEFAULTS.probeTimeoutMs, opts?.signal)
      if (result.ok) {
        this.markOnline()
        return true
      }

      if (!opts?.userInitiated && this.hasRecentApiSuccess()) {
        return true
      }

      const failures = this.state.consecutiveFailures + 1
      const { kind, message } = result

      if (failures === 1) {
        this.enterRecoveryMode()
      }

      if (failures >= CONNECTIVITY_DEFAULTS.failuresBeforeOffline) {
        this.patch({ consecutiveFailures: failures })
        this.markOffline(kind, message)
        if (opts?.userInitiated) throw new Error(message)
        return false
      }

      this.patch({
        consecutiveFailures: failures,
        status: 'degraded',
        failureKind: kind,
        message,
        showOfflineOverlay: false,
      })
      if (opts?.userInitiated) throw new Error(message)
      return false
    } finally {
      this.probeInFlight = false
    }
  }

  startMonitoring(registerAxiosHook: AxiosHookRegistrar) {
    this.stopMonitoring({ resetState: false })
    const sessionId = ++this.activeSessionId
    this.monitoring = true
    this.sessionAbort = new AbortController()
    const signal = this.sessionAbort.signal

    void this.probe({ signal })
      .catch(() => undefined)
      .finally(() => {
        if (this.isSessionActive(sessionId)) {
          this.scheduleNextProbe(sessionId)
        }
      })

    const onVisibility = () => {
      if (!this.isSessionActive(sessionId)) return
      if (document.visibilityState !== 'visible') return
      void this.probe({ signal })
        .catch(() => undefined)
        .finally(() => {
          if (this.isSessionActive(sessionId)) {
            this.clearProbeTimer()
            this.scheduleNextProbe(sessionId)
          }
        })
    }

    const onBrowserOnline = () => {
      if (!this.isSessionActive(sessionId)) return
      this.enterRecoveryMode()
      void this.probe({ signal }).catch(() => undefined)
    }

    const onBrowserOffline = () => {
      if (!this.isSessionActive(sessionId)) return
      void this.probe({ signal }).catch(() => undefined)
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onBrowserOnline)
    window.addEventListener('offline', onBrowserOffline)

    this.teardownFns.push(
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => window.removeEventListener('online', onBrowserOnline),
      () => window.removeEventListener('offline', onBrowserOffline),
      registerAxiosHook(() => this.notifyHttpSuccess()),
    )
  }

  stopMonitoring(opts?: { resetState?: boolean }) {
    this.monitoring = false
    this.activeSessionId += 1
    this.clearProbeTimer()
    this.sessionAbort?.abort()
    this.sessionAbort = null
    this.teardownFns.forEach((fn) => fn())
    this.teardownFns = []
    this.clearOverlayTimer()
    this.probeInFlight = false
    this.lastApiSuccessAt = 0

    if (opts?.resetState !== false) {
      this.state = initialState()
      this.emit()
    }
  }
}

export const connectivityManager = new ConnectivityManager()
