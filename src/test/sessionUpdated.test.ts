import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api, {
  SESSION_EXPIRED_EVENT,
  SESSION_REFRESHED_EVENT,
  __resetRefreshStateForTests,
  resetReloginGuard,
} from '@/services/api'
import { __resetEpochForTests } from '@/lib/branch/epoch'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), info: vi.fn() },
}))

function jwt(payload: object): string {
  return `h.${btoa(JSON.stringify(payload)).replace(/=/g, '')}.s`
}
const TOK_A = jwt({ active_branch_id: 1, v: 'A' })
const TOK_B = jwt({ active_branch_id: 1, v: 'B' })
const TOK_B_OTHER_BRANCH = jwt({ active_branch_id: 2, v: 'B2' })

type Call = { url: string; method: string; auth: string | undefined; data: unknown; headers: Record<string, unknown> }
type Reply = { status: number; data?: unknown }

/** Adaptador falso: la respuesta de cada llamada la decide `handler`. */
function install(handler: (c: Call, n: number) => Reply) {
  const calls: Call[] = []
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const call: Call = {
      url: String(config.url),
      method: String(config.method),
      auth: config.headers.Authorization as string | undefined,
      data: config.data,
      headers: config.headers as unknown as Record<string, unknown>,
    }
    calls.push(call)
    const r = handler(call, calls.length)
    const response = { data: r.data ?? {}, status: r.status, statusText: '', headers: {}, config }
    if (r.status >= 200 && r.status < 300) return response
    throw Object.assign(new Error('http ' + r.status), { isAxiosError: true, response, config })
  }
  api.defaults.adapter = adapter
  return calls
}

describe('409 SESSION_UPDATED: refresh y reintento único', () => {
  let expired = 0
  let refreshedEvents = 0
  const onExpired = () => void (expired += 1)
  const onRefreshed = () => void (refreshedEvents += 1)
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', TOK_A)
    __resetEpochForTests()
    __resetRefreshStateForTests()
    resetReloginGuard()
    toastError.mockClear()
    expired = 0
    refreshedEvents = 0
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.addEventListener(SESSION_REFRESHED_EVENT, onRefreshed)
  })
  afterEach(() => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
    window.removeEventListener(SESSION_REFRESHED_EVENT, onRefreshed)
  })

  it('con refresh token: 409 -> refresh -> reintenta UNA vez con el token nuevo -> éxito, sin cerrar sesión', async () => {
    localStorage.setItem('refresh_token', 'R1')
    const calls = install((c) => {
      if (c.url === '/api/session/refresh') return { status: 200, data: { token: TOK_B } }
      return c.auth === `Bearer ${TOK_A}`
        ? { status: 409, data: { code: 'SESSION_UPDATED' } }
        : { status: 200, data: { ok: 1 } }
    })
    const r = await api.get('/api/sales')
    expect(r.data).toEqual({ ok: 1 })
    expect(calls.map((c) => c.url)).toEqual(['/api/sales', '/api/session/refresh', '/api/sales'])
    expect(calls[2].auth).toBe(`Bearer ${TOK_B}`)
    expect(localStorage.getItem('token')).toBe(TOK_B)
    expect(refreshedEvents).toBe(1)
    expect(expired).toBe(0)
  })

  it('escritura: se reintenta con el MISMO cuerpo y cabeceras (clave de idempotencia incluida)', async () => {
    localStorage.setItem('refresh_token', 'R1')
    const calls = install((c) => {
      if (c.url === '/api/session/refresh') return { status: 200, data: { token: TOK_B } }
      return c.auth === `Bearer ${TOK_A}`
        ? { status: 409, data: { code: 'SESSION_UPDATED' } }
        : { status: 201, data: { id: 9 } }
    })
    const body = { total: 10, idempotency_key: 'K-1' }
    const r = await api.post('/api/sales', body, { headers: { 'Idempotency-Key': 'K-1' } })
    expect(r.status).toBe(201)
    const sales = calls.filter((c) => c.url === '/api/sales')
    expect(sales).toHaveLength(2)
    expect(JSON.parse(String(sales[1].data))).toEqual(body)
    expect(sales[1].headers['Idempotency-Key']).toBe('K-1')
  })

  it('escritura NO se reintenta si el token nuevo cambia de sucursal', async () => {
    localStorage.setItem('refresh_token', 'R1')
    const calls = install((c) => {
      if (c.url === '/api/session/refresh') return { status: 200, data: { token: TOK_B_OTHER_BRANCH } }
      return { status: 409, data: { code: 'SESSION_UPDATED' } }
    })
    await expect(api.post('/api/sales', { a: 1 })).rejects.toBeTruthy()
    expect(calls.filter((c) => c.url === '/api/sales')).toHaveLength(1)
    expect(expired).toBe(0)
  })

  it('sin refresh token (PIN): cierra sesión con "Su acceso cambió" y no intenta refrescar', async () => {
    const calls = install(() => ({ status: 409, data: { code: 'SESSION_UPDATED' } }))
    await expect(api.get('/api/sales')).rejects.toBeTruthy()
    expect(calls.map((c) => c.url)).toEqual(['/api/sales'])
    expect(expired).toBe(1)
    await new Promise((r) => setTimeout(r, 10))
    expect(toastError).toHaveBeenCalledWith('Su acceso cambió; vuelva a ingresar.', expect.anything())
    expect(String(toastError.mock.calls[0][0])).not.toMatch(/vencido/)
  })

  it('refresh rechazado (REFRESH_INVALID) cierra sesión con el mensaje claro', async () => {
    localStorage.setItem('refresh_token', 'R1')
    const calls = install((c) =>
      c.url === '/api/session/refresh'
        ? { status: 401, data: { code: 'REFRESH_INVALID' } }
        : { status: 409, data: { code: 'SESSION_UPDATED' } },
    )
    await expect(api.get('/api/sales')).rejects.toBeTruthy()
    expect(calls.map((c) => c.url)).toEqual(['/api/sales', '/api/session/refresh'])
    expect(expired).toBe(1)
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('fallo transitorio del refresh (503) NO cierra sesión', async () => {
    localStorage.setItem('refresh_token', 'R1')
    install((c) =>
      c.url === '/api/session/refresh' ? { status: 503 } : { status: 409, data: { code: 'SESSION_UPDATED' } },
    )
    await expect(api.get('/api/sales')).rejects.toBeTruthy()
    expect(expired).toBe(0)
    expect(localStorage.getItem('token')).toBe(TOK_A)
  })

  it('sin bucle: si tras refrescar vuelve a dar 409 se cierra sesión (1 refresh, 1 reintento)', async () => {
    localStorage.setItem('refresh_token', 'R1')
    const calls = install((c) =>
      c.url === '/api/session/refresh'
        ? { status: 200, data: { token: TOK_B } }
        : { status: 409, data: { code: 'SESSION_UPDATED' } },
    )
    await expect(api.get('/api/sales')).rejects.toBeTruthy()
    expect(calls.map((c) => c.url)).toEqual(['/api/sales', '/api/session/refresh', '/api/sales'])
    expect(expired).toBe(1)
  })

  it('varias peticiones simultáneas con 409 comparten UN solo refresh y todas se reintentan', async () => {
    localStorage.setItem('refresh_token', 'R1')
    const calls = install((c) => {
      if (c.url === '/api/session/refresh') return { status: 200, data: { token: TOK_B } }
      return c.auth === `Bearer ${TOK_A}`
        ? { status: 409, data: { code: 'SESSION_UPDATED' } }
        : { status: 200, data: { u: c.url } }
    })
    const rs = await Promise.all([api.get('/api/a'), api.get('/api/b'), api.get('/api/c')])
    expect(rs.map((r) => r.data.u)).toEqual(['/api/a', '/api/b', '/api/c'])
    expect(calls.filter((c) => c.url === '/api/session/refresh')).toHaveLength(1)
    expect(expired).toBe(0)
  })
})
