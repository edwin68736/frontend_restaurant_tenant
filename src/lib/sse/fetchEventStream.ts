/**
 * Cliente SSE sobre `fetch` con streaming (reemplaza a EventSource, que no admite cabeceras y obligaba a
 * mandar el JWT en la URL). Sin dependencias; se prueba con un `fetch` y un `ReadableStream` simulados.
 *
 * - `SseParser`: parser incremental del formato text/event-stream (chunks partidos en cualquier byte,
 *   saltos \n, \r\n y \r, comentarios/keepalive que empiezan por ":", campos event/data/id/retry).
 * - `fetchEventStream`: conecta, entrega los mensajes y reconecta SOLO con backoff exponencial con jitter
 *   (1 s -> 30 s) hasta que se aborta la señal. Ante 401 / 403 BRANCH_* / 409 SESSION_UPDATED llama al
 *   gestor de acceso del consumidor (refrescar token o contexto) y reabre UNA vez; si vuelve a fallar sin
 *   haber llegado a conectar, se detiene (sin bucles) y avisa con `onGiveUp`.
 *
 * Los eventos son notificaciones de cambio, no un log reproducible (no se usa Last-Event-ID): al reconectar
 * el consumidor debe volver a pedir su estado (`onOpen({ reconnected: true })`).
 *
 * RIESGO (no verificable en este entorno): requiere que el WebView entregue `response.body` como stream.
 * WebView2 (Tauri en Windows) y Chromium/Android System WebView modernos lo hacen; un WebView antiguo o
 * un proxy que bufferice la respuesta haría que los eventos lleguen tarde o no lleguen. Si `response.body`
 * es null se llama a `onGiveUp('no-streaming')`. Plan B documentado: ticket de un solo uso + EventSource.
 */

export interface SseMessage {
  event: string
  data: string
  id?: string
}

/** Parser incremental de text/event-stream. */
export class SseParser {
  private buffer = ''
  private event = ''
  private dataLines: string[] = []
  private id: string | undefined
  /** Último `retry:` recibido (ms), si lo hubo. */
  retryMs: number | undefined
  private first = true

  /** Alimenta un trozo de texto y devuelve los mensajes completos que contenga. */
  push(chunk: string): SseMessage[] {
    this.buffer += chunk
    if (this.first && this.buffer.length > 0) {
      this.first = false
      if (this.buffer.charCodeAt(0) === 0xfeff) this.buffer = this.buffer.slice(1)
    }
    const out: SseMessage[] = []
    // Una línea termina en \n, \r\n o \r. Un \r final puede ser la mitad de un \r\n: se espera al siguiente chunk.
    for (;;) {
      const m = /\r\n|\n|\r/.exec(this.buffer)
      if (!m) break
      if (m[0] === '\r' && m.index === this.buffer.length - 1) break
      const line = this.buffer.slice(0, m.index)
      this.buffer = this.buffer.slice(m.index + m[0].length)
      const msg = this.line(line)
      if (msg) out.push(msg)
    }
    return out
  }

  private line(line: string): SseMessage | null {
    if (line === '') {
      // Línea en blanco: despacha el evento acumulado (si no hay datos, se descarta).
      const had = this.dataLines.length > 0
      const msg: SseMessage | null = had
        ? { event: this.event || 'message', data: this.dataLines.join('\n'), id: this.id }
        : null
      this.event = ''
      this.dataLines = []
      return msg
    }
    if (line.startsWith(':')) return null // comentario / keepalive
    const i = line.indexOf(':')
    const field = i === -1 ? line : line.slice(0, i)
    let value = i === -1 ? '' : line.slice(i + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'event':
        this.event = value
        break
      case 'data':
        this.dataLines.push(value)
        break
      case 'id':
        if (!value.includes('\0')) this.id = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) this.retryMs = parseInt(value, 10)
        break
      default:
        break
    }
    return null
  }
}

/** Motivo por el que se dejó de reintentar. */
export type SseGiveUpReason = 'no-streaming' | 'unauthorized' | 'access-changed' | `http-${number}`

export interface FetchEventStreamOptions {
  url: string
  /** Se evalúa en CADA conexión (el token pudo renovarse entre reintentos). */
  getHeaders: () => Record<string, string>
  signal: AbortSignal
  onMessage: (msg: SseMessage) => void
  /** Conexión establecida (HTTP 200). `reconnected` es false solo en la primera de esta ejecución. */
  onOpen?: (info: { reconnected: boolean }) => void
  /**
   * 401: devuelve true si se puede reabrir (token renovado, o el token cambió mientras tanto) y false si no.
   * Si no se define, 401 detiene el stream.
   */
  onUnauthorized?: () => Promise<boolean>
  /**
   * 403 BRANCH_REQUIRED/BRANCH_FORBIDDEN o 409 SESSION_UPDATED: el consumidor refresca token/contexto.
   * Devuelve true para reabrir.
   */
  onAccessChanged?: (info: { status: number; code: string }) => Promise<boolean>
  /** Se dejó de reintentar (error no recuperable o autenticación imposible). */
  onGiveUp?: (reason: SseGiveUpReason) => void
  fetchImpl?: typeof fetch
  /** Backoff: base y tope en ms (por defecto 1000 y 30000). */
  baseDelayMs?: number
  maxDelayMs?: number
  /** Sin bytes (ni keepalive) durante este tiempo se considera muerta la conexión y se reabre. 0 = desactivado. */
  idleTimeoutMs?: number
  /** Inyectable para tests. */
  random?: () => number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

const RETRYABLE_STATUS = new Set([408, 425, 429])

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Backoff exponencial con jitter completo sobre la mitad superior: [d/2, d], d = min(max, base * 2^attempt). */
export function backoffDelay(attempt: number, base: number, max: number, random: () => number): number {
  const d = Math.min(max, base * 2 ** attempt)
  return Math.round(d / 2 + (d / 2) * random())
}

async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { code?: unknown }
    return typeof body?.code === 'string' ? body.code : ''
  } catch {
    return ''
  }
}

/** Conecta y reconecta hasta que `signal` se aborta o se agota la recuperación. Nunca rechaza por abort. */
export async function fetchEventStream(opts: FetchEventStreamOptions): Promise<void> {
  const {
    url,
    signal,
    getHeaders,
    onMessage,
    fetchImpl = (...a) => fetch(...a),
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    idleTimeoutMs = 70_000,
    random = Math.random,
    sleep = abortableSleep,
  } = opts

  let attempt = 0
  let opened = false // ya hubo al menos una conexión 200 en esta ejecución
  let authTried = false // ya se intentó recuperar acceso desde la última conexión 200

  while (!signal.aborted) {
    let serverRetry: number | undefined
    // Cada conexión tiene su propio controlador: el watchdog de inactividad la corta sin abortar el bucle.
    const conn = new AbortController()
    const onOuterAbort = () => conn.abort()
    signal.addEventListener('abort', onOuterAbort, { once: true })
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const armIdle = () => {
      if (!idleTimeoutMs) return
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => conn.abort(), idleTimeoutMs)
    }
    let openedAt = 0
    try {
      armIdle()
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { ...getHeaders(), Accept: 'text/event-stream' },
        signal: conn.signal,
        cache: 'no-store',
      })
      if (signal.aborted) return

      if (res.status === 200) {
        if (!res.body) {
          opts.onGiveUp?.('no-streaming')
          return
        }
        openedAt = Date.now()
        authTried = false
        const reconnected = opened
        opened = true
        opts.onOpen?.({ reconnected })

        const reader = res.body.getReader()
        // Abortar (desmontaje, cambio de alcance o watchdog) cancela la lectura pendiente aunque el WebView no
        // propague el abort al lector.
        conn.signal.addEventListener('abort', () => void reader.cancel().catch(() => {}), { once: true })
        const decoder = new TextDecoder()
        const parser = new SseParser()
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            armIdle()
            for (const msg of parser.push(decoder.decode(value, { stream: true }))) {
              if (signal.aborted) return
              onMessage(msg)
            }
          }
        } finally {
          serverRetry = parser.retryMs
          try {
            await reader.cancel()
          } catch {
            /* ya cerrado */
          }
        }
        // Fin limpio del stream (el servidor cerró): se reconecta tras una pausa.
      } else {
        const code = await readErrorCode(res)
        const isBranch = res.status === 403 && (code === 'BRANCH_REQUIRED' || code === 'BRANCH_FORBIDDEN')
        const isSession = res.status === 409 && code === 'SESSION_UPDATED'
        if (res.status === 401) {
          if (authTried || !opts.onUnauthorized) {
            opts.onGiveUp?.('unauthorized')
            return
          }
          authTried = true
          const ok = await opts.onUnauthorized()
          if (signal.aborted) return
          if (!ok) {
            opts.onGiveUp?.('unauthorized')
            return
          }
          continue // reabre de inmediato con el token nuevo
        }
        if (isBranch || isSession) {
          if (authTried || !opts.onAccessChanged) {
            opts.onGiveUp?.('access-changed')
            return
          }
          authTried = true
          const ok = await opts.onAccessChanged({ status: res.status, code })
          if (signal.aborted) return
          if (!ok) {
            opts.onGiveUp?.('access-changed')
            return
          }
          continue
        }
        if (res.status >= 400 && res.status < 500 && !RETRYABLE_STATUS.has(res.status)) {
          // 402/403/404...: reintentar no lo arregla; se reabrirá cuando cambie token, sucursal o época.
          opts.onGiveUp?.(`http-${res.status}`)
          return
        }
        // 5xx / 429 / 408: transitorio, backoff.
      }
    } catch {
      if (signal.aborted) return
      // Error de red o watchdog de inactividad: reintento con backoff.
    } finally {
      if (idleTimer) clearTimeout(idleTimer)
      signal.removeEventListener('abort', onOuterAbort)
    }

    if (signal.aborted) return
    // Una conexión que vivió un rato reinicia el backoff; una que cae al instante lo hace crecer.
    if (openedAt && Date.now() - openedAt > 10_000) attempt = 0
    let delay = backoffDelay(attempt, baseDelayMs, maxDelayMs, random)
    // El `retry:` del servidor es un mínimo (nunca por debajo de nuestro backoff, nunca por encima del tope).
    if (serverRetry !== undefined) delay = Math.min(maxDelayMs, Math.max(delay, serverRetry))
    attempt += 1
    await sleep(delay, signal)
  }
}
