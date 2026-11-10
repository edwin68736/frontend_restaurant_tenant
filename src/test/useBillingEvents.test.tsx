import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const auth = { token: 'tok-1' as string | null }
const branch = { activeBranchId: 1, resetEpoch: 0, isAllBranches: false, refreshContext: vi.fn(async () => {}) }
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/contexts/BranchContext', () => ({ useBranch: () => branch }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { useBillingEvents } from '@/hooks/useBillingEvents'
import { __resetEpochForTests } from '@/lib/branch/epoch'
import api, { __resetRefreshStateForTests } from '@/services/api'

const enc = new TextEncoder()
type Conn = {
  url: string
  headers: Record<string, string>
  signal: AbortSignal
  push: (s: string) => void
  close: () => void
}

let conns: Conn[]
let statusFor: (n: number) => number
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('token', 'tok-1')
  auth.token = 'tok-1'
  branch.activeBranchId = 1
  branch.resetEpoch = 0
  branch.isAllBranches = false
  __resetEpochForTests()
  __resetRefreshStateForTests()
  conns = []
  statusFor = () => 200
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const status = statusFor(conns.length + 1)
      let ctrl!: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({ start: (c) => (ctrl = c) })
      conns.push({
        url,
        headers,
        signal: init.signal as AbortSignal,
        push: (s) => ctrl.enqueue(enc.encode(s)),
        close: () => ctrl.close(),
      })
      return { status, body: stream, json: async () => ({}) } as unknown as Response
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useBillingEvents (fetch-stream)', () => {
  it('conecta con cabecera Authorization y sin token ni tenant_slug en la URL; entrega eventos', async () => {
    localStorage.setItem('token', 'tok-SECRET')
    const onUpdate = vi.fn()
    renderHook(() => useBillingEvents(onUpdate, true))
    await tick()
    expect(conns).toHaveLength(1)
    expect(conns[0].url).toBe('/api/billing/events')
    expect(conns[0].url).not.toMatch(/access_token|tenant_slug|SECRET/)
    expect(conns[0].headers.Authorization).toBe('Bearer tok-SECRET')
    conns[0].push('event: billing.status.updated\ndata: {"sale_id":5,"status":"accepted"}\n\n')
    await tick()
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ sale_id: 5, status: 'accepted' }))
  })

  it('no conecta si está deshabilitado o no hay token', async () => {
    renderHook(() => useBillingEvents(vi.fn(), false))
    localStorage.removeItem('token')
    renderHook(() => useBillingEvents(vi.fn(), true))
    await tick()
    expect(conns).toHaveLength(0)
  })

  it('se reabre al cambiar token, sucursal activa y época (y cierra la conexión anterior)', async () => {
    const { rerender } = renderHook(() => useBillingEvents(vi.fn(), true))
    await tick()
    expect(conns).toHaveLength(1)

    localStorage.setItem('token', 'tok-2')
    auth.token = 'tok-2'
    rerender()
    await tick()
    expect(conns).toHaveLength(2)
    expect(conns[0].signal.aborted).toBe(true)
    expect(conns[1].headers.Authorization).toBe('Bearer tok-2')

    branch.activeBranchId = 2
    rerender()
    await tick()
    expect(conns).toHaveLength(3)
    expect(conns[1].signal.aborted).toBe(true)

    branch.resetEpoch = 1
    rerender()
    await tick()
    expect(conns).toHaveLength(4)
    expect(conns[2].signal.aborted).toBe(true)
  })

  it('aborta la conexión al desmontar', async () => {
    const { unmount } = renderHook(() => useBillingEvents(vi.fn(), true))
    await tick()
    expect(conns[0].signal.aborted).toBe(false)
    unmount()
    expect(conns[0].signal.aborted).toBe(true)
    await tick(30)
    expect(conns).toHaveLength(1)
  })

  it('401 con refresh token: renueva (POST /api/session/refresh) y reabre con el token nuevo', async () => {
    localStorage.setItem('refresh_token', 'R1')
    statusFor = (n) => (n === 1 ? 401 : 200)
    const axiosPost = vi.fn()
    api.defaults.adapter = async (config) => {
      axiosPost(config.url)
      return { data: { token: 'tok-NEW' }, status: 200, statusText: '', headers: {}, config }
    }
    renderHook(() => useBillingEvents(vi.fn(), true))
    await tick(60)
    expect(axiosPost).toHaveBeenCalledWith('/api/session/refresh')
    expect(conns).toHaveLength(2)
    expect(conns[1].headers.Authorization).toBe('Bearer tok-NEW')
  })

  it('al reconectar tras una caída avisa a onReconnect (el consumidor vuelve a pedir su estado)', async () => {
    const onReconnect = vi.fn()
    renderHook(() => useBillingEvents(vi.fn(), true, onReconnect))
    await tick()
    expect(onReconnect).not.toHaveBeenCalled() // primera conexión: no es reconexión
    conns[0].close() // el servidor cierra; el backoff real es de 0.5 a 1 s
    await tick(1300)
    expect(conns).toHaveLength(2)
    expect(onReconnect).toHaveBeenCalledTimes(1)
  })
})
