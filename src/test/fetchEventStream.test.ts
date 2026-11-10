import { describe, expect, it, vi } from 'vitest'
import {
  SseParser,
  abortableSleep,
  backoffDelay,
  fetchEventStream,
  type FetchEventStreamOptions,
  type SseMessage,
} from '@/lib/sse/fetchEventStream'

const enc = new TextEncoder()

/** Stream controlado por el test: se empuja texto (en los trozos que se quiera) y se cierra a voluntad. */
function controlledStream() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start: (c) => (ctrl = c) })
  return {
    stream,
    push: (s: string) => ctrl.enqueue(enc.encode(s)),
    close: () => {
      try {
        ctrl.close()
      } catch {
        /* ya cerrado */
      }
    },
  }
}

function res(status: number, opts: { body?: ReadableStream<Uint8Array> | null; json?: unknown } = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    body: opts.body === undefined ? null : opts.body,
    json: async () => opts.json ?? {},
  } as unknown as Response
}

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms))
const noSleep = async () => {}

function base(over: Partial<FetchEventStreamOptions> & { fetchImpl: typeof fetch }): FetchEventStreamOptions {
  return {
    url: '/api/billing/events',
    getHeaders: () => ({ Authorization: 'Bearer tok' }),
    signal: new AbortController().signal,
    onMessage: () => {},
    sleep: noSleep,
    idleTimeoutMs: 0,
    ...over,
  }
}

describe('SseParser', () => {
  it('une un evento partido en varios chunks (también a mitad de línea y de CRLF)', () => {
    const p = new SseParser()
    const out: SseMessage[] = []
    const raw = 'event: billing.status.updated\r\ndata: {"sale_id":1,'
    for (const part of [raw.slice(0, 7), raw.slice(7, 30), raw.slice(30), '"status":"accepted"}\r', '\n\r', '\n']) {
      out.push(...p.push(part))
    }
    expect(out).toEqual([{ event: 'billing.status.updated', data: '{"sale_id":1,"status":"accepted"}', id: undefined }])
  })

  it('ignora keepalives (":") y comentarios, y entrega varios eventos en un solo chunk', () => {
    const p = new SseParser()
    const out = p.push(': keepalive\n\nevent: a\ndata: 1\n\n: otro\n\ndata: 2\n\n')
    expect(out.map((m) => [m.event, m.data])).toEqual([
      ['a', '1'],
      ['message', '2'],
    ])
  })

  it('data multilínea se une con salto; retry: se registra; BOM inicial se ignora', () => {
    const p = new SseParser()
    const out = p.push('﻿retry: 3000\nevent: x\ndata: l1\ndata: l2\n\n')
    expect(out).toHaveLength(1)
    expect(out[0].data).toBe('l1\nl2')
    expect(p.retryMs).toBe(3000)
  })

  it('un evento incompleto no se entrega hasta la línea en blanco', () => {
    const p = new SseParser()
    expect(p.push('event: a\ndata: 1\n')).toEqual([])
    expect(p.push('\n')).toHaveLength(1)
  })
})

describe('backoffDelay', () => {
  it('crece exponencialmente con jitter y se topa en el máximo', () => {
    expect(backoffDelay(0, 1000, 30000, () => 1)).toBe(1000)
    expect(backoffDelay(0, 1000, 30000, () => 0)).toBe(500)
    expect(backoffDelay(3, 1000, 30000, () => 1)).toBe(8000)
    expect(backoffDelay(10, 1000, 30000, () => 1)).toBe(30000)
    expect(backoffDelay(10, 1000, 30000, () => 0)).toBe(15000)
  })
})

describe('fetchEventStream', () => {
  it('entrega los mensajes, el token va en cabecera y NO en la URL', async () => {
    const s = controlledStream()
    const fetchImpl = vi.fn(async () => res(200, { body: s.stream })) as unknown as typeof fetch
    const ctrl = new AbortController()
    const got: SseMessage[] = []
    const run = fetchEventStream(
      base({
        fetchImpl,
        signal: ctrl.signal,
        onMessage: (m) => got.push(m),
        getHeaders: () => ({ Authorization: 'Bearer SECRET', 'X-Tenant-Slug': 'demo' }),
      }),
    )
    await tick()
    s.push('event: billing.status.updated\ndata: {"sale_id":7}\n\n')
    await tick()
    expect(got).toHaveLength(1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/billing/events')
    expect(url).not.toMatch(/token|SECRET|tenant_slug|demo/)
    const h = init.headers as Record<string, string>
    expect(h.Authorization).toBe('Bearer SECRET')
    expect(h.Accept).toBe('text/event-stream')
    expect(h['X-Tenant-Slug']).toBe('demo')
    ctrl.abort()
    await run
  })

  it('401 -> refresh -> reconexión con el token nuevo', async () => {
    let token = 'old'
    const s = controlledStream()
    const seen: string[] = []
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization
      seen.push(auth)
      return auth === 'Bearer old' ? res(401, { json: { code: 'TOKEN_EXPIRED' } }) : res(200, { body: s.stream })
    }) as unknown as typeof fetch
    const onUnauthorized = vi.fn(async () => {
      token = 'new'
      return true
    })
    const ctrl = new AbortController()
    const got: SseMessage[] = []
    const run = fetchEventStream(
      base({
        fetchImpl,
        signal: ctrl.signal,
        getHeaders: () => ({ Authorization: `Bearer ${token}` }),
        onUnauthorized,
        onMessage: (m) => got.push(m),
      }),
    )
    await tick(20)
    s.push('data: {"sale_id":1}\n\n')
    await tick()
    expect(seen).toEqual(['Bearer old', 'Bearer new'])
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(got).toHaveLength(1)
    ctrl.abort()
    await run
  })

  it('401 repetido (el refresh no arregla nada) se detiene: sin bucle', async () => {
    const fetchImpl = vi.fn(async () => res(401)) as unknown as typeof fetch
    const onUnauthorized = vi.fn(async () => true)
    const onGiveUp = vi.fn()
    await fetchEventStream(base({ fetchImpl, onUnauthorized, onGiveUp }))
    expect(fetchImpl).toHaveBeenCalledTimes(2) // original + un único reintento
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(onGiveUp).toHaveBeenCalledWith('unauthorized')
  })

  it('401 sin forma de recuperar (refresh falla) se detiene', async () => {
    const fetchImpl = vi.fn(async () => res(401)) as unknown as typeof fetch
    const onGiveUp = vi.fn()
    await fetchEventStream(base({ fetchImpl, onUnauthorized: async () => false, onGiveUp }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(onGiveUp).toHaveBeenCalledWith('unauthorized')
  })

  it('409 SESSION_UPDATED y 403 BRANCH_* refrescan y reabren una vez', async () => {
    const codes = [
      [409, 'SESSION_UPDATED'],
      [403, 'BRANCH_FORBIDDEN'],
    ] as const
    for (const [status, code] of codes) {
      const s = controlledStream()
      let n = 0
      const fetchImpl = vi.fn(async () =>
        n++ === 0 ? res(status, { json: { code } }) : res(200, { body: s.stream }),
      ) as unknown as typeof fetch
      const onAccessChanged = vi.fn(async () => true)
      const ctrl = new AbortController()
      const run = fetchEventStream(base({ fetchImpl, signal: ctrl.signal, onAccessChanged }))
      await tick(20)
      expect(onAccessChanged).toHaveBeenCalledWith({ status, code })
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      ctrl.abort()
      await run
    }
  })

  it('409 repetido sin haber conectado se detiene (sin bucle)', async () => {
    const fetchImpl = vi.fn(async () => res(409, { json: { code: 'SESSION_UPDATED' } })) as unknown as typeof fetch
    const onGiveUp = vi.fn()
    await fetchEventStream(base({ fetchImpl, onAccessChanged: async () => true, onGiveUp }))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(onGiveUp).toHaveBeenCalledWith('access-changed')
  })

  it('errores 5xx y de red reintentan con backoff creciente; 404 se detiene', async () => {
    const delays: number[] = []
    let n = 0
    const fetchImpl = vi.fn(async () => {
      n++
      if (n === 1) return res(503)
      if (n === 2) throw new TypeError('network')
      return res(404)
    }) as unknown as typeof fetch
    const onGiveUp = vi.fn()
    await fetchEventStream(base({ fetchImpl, onGiveUp, random: () => 1, sleep: async (ms) => void delays.push(ms) }))
    expect(delays).toEqual([1000, 2000])
    expect(onGiveUp).toHaveBeenCalledWith('http-404')
  })

  it('si el servidor cierra el stream reconecta y avisa con reconnected=true', async () => {
    const first = controlledStream()
    const second = controlledStream()
    const streams = [first, second]
    let i = 0
    const fetchImpl = vi.fn(async () => res(200, { body: streams[i++].stream })) as unknown as typeof fetch
    const opens: boolean[] = []
    const ctrl = new AbortController()
    const run = fetchEventStream(base({ fetchImpl, signal: ctrl.signal, onOpen: (o) => opens.push(o.reconnected) }))
    await tick()
    first.close()
    await tick(20)
    expect(opens).toEqual([false, true])
    ctrl.abort()
    await run
  })

  it('abortar la señal cancela el fetch en curso y no vuelve a conectar', async () => {
    let received: AbortSignal | undefined
    const fetchImpl = vi.fn((_u: string, init: RequestInit) => {
      received = init.signal as AbortSignal
      return new Promise<Response>((_r, rej) =>
        received!.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))),
      )
    }) as unknown as typeof fetch
    const ctrl = new AbortController()
    const run = fetchEventStream(base({ fetchImpl, signal: ctrl.signal }))
    await tick()
    ctrl.abort()
    await run
    expect(received?.aborted).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('sin response.body avisa no-streaming y no reintenta', async () => {
    const fetchImpl = vi.fn(async () => res(200, { body: null })) as unknown as typeof fetch
    const onGiveUp = vi.fn()
    await fetchEventStream(base({ fetchImpl, onGiveUp }))
    expect(onGiveUp).toHaveBeenCalledWith('no-streaming')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('conexión muda (sin keepalive) más allá del timeout se corta y reabre', async () => {
    const streams = [controlledStream(), controlledStream(), controlledStream()]
    const signals: AbortSignal[] = []
    let i = 0
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal)
      const s = streams[Math.min(i++, streams.length - 1)]
      // un lector real termina al abortarse la petición
      ;(init.signal as AbortSignal).addEventListener('abort', () => s.close())
      return res(200, { body: s.stream })
    }) as unknown as typeof fetch
    const ctrl = new AbortController()
    const run = fetchEventStream(base({ fetchImpl, signal: ctrl.signal, idleTimeoutMs: 15, sleep: (_ms, s) => abortableSleep(5, s) }))
    await tick(80)
    expect(signals[0].aborted).toBe(true)
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)
    ctrl.abort()
    await run
  })
})
