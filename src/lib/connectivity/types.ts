export type ConnectivityStatus = 'online' | 'degraded' | 'offline' | 'checking'

/** Motivo mostrado al usuario (no asumir siempre "sin internet"). */
export type ConnectivityFailureKind =
  | 'none'
  | 'no_internet'
  | 'server_unreachable'
  | 'server_slow'
  | 'server_error'

export type ConnectivityState = {
  status: ConnectivityStatus
  failureKind: ConnectivityFailureKind
  message: string
  consecutiveFailures: number
  /** true tras el primer fallo: heartbeat acelerado hasta recuperar */
  recoveryMode: boolean
  lastSuccessAt: string | null
  lastFailureAt: string | null
  /** Banner/modal visible tras debounce cuando status === offline */
  showOfflineOverlay: boolean
}

export const CONNECTIVITY_DEFAULTS = {
  /** Heartbeat en estado estable */
  probeIntervalMs: 30_000,
  /** Tras el primer fallo consecutivo */
  recoveryProbeIntervalMs: 10_000,
  probeTimeoutMs: 5_000,
  failuresBeforeOffline: 3,
  overlayDelayMs: 1_200,
  /**
   * Si hubo una respuesta API exitosa en este lapso, el POS se considera en línea
   * aunque falle el probe liviano (evita falsos positivos mientras se trabaja).
   */
  apiSuccessGraceMs: 45_000,
} as const

/** Ruta liviana (sin ping MySQL/Redis). Ver backend GET /health/live */
export const CONNECTIVITY_PROBE_PATH = '/health/live' as const
