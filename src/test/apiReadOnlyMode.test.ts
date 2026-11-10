import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api from '@/services/api'
import { __resetEpochForTests } from '@/lib/branch/epoch'
import {
  BRANCH_MODE_HEADER,
  BRANCH_READ_ONLY_EVENT,
  __resetViewModeForTests,
  setBranchViewMode,
} from '@/lib/branch/viewMode'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

/** Adaptador falso: registra cada petición que SALE y la respuesta la fija el test. */
function installAdapter(respond: (c: InternalAxiosRequestConfig) => { status: number; data?: unknown } = () => ({ status: 200, data: {} })) {
  const sent: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      sent.push(config)
      const { status, data } = respond(config)
      const response = { data: data ?? {}, status, statusText: '', headers: {}, config }
      if (status >= 200 && status < 300) resolve(response)
      else reject(Object.assign(new Error('http ' + status), { isAxiosError: true, response, config }))
    })
  api.defaults.adapter = adapter
  return sent
}

const headerOf = (c: InternalAxiosRequestConfig) => c.headers.get?.(BRANCH_MODE_HEADER) ?? (c.headers as Record<string, unknown>)[BRANCH_MODE_HEADER]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('token', 'tok-A')
  localStorage.setItem('can_view_all', 'true')
  __resetEpochForTests()
  __resetViewModeForTests()
})
afterEach(() => {
  setBranchViewMode('single')
})

describe('interceptor: X-Branch-Mode solo en lecturas y solo en modo "todas"', () => {
  it('modo una sucursal: ninguna petición lleva la cabecera', async () => {
    const sent = installAdapter()
    await api.get('/api/sales')
    await api.post('/api/restaurant/pos/checkout', { total: 1 })
    expect(sent).toHaveLength(2)
    sent.forEach((c) => expect(headerOf(c)).toBeFalsy())
  })

  it('modo "todas": GET, HEAD y OPTIONS llevan X-Branch-Mode: all', async () => {
    setBranchViewMode('all')
    const sent = installAdapter()
    await api.get('/api/sales')
    await api.head('/api/sales')
    await api.options('/api/sales')
    expect(sent.map((c) => c.method)).toEqual(['get', 'head', 'options'])
    sent.forEach((c) => expect(headerOf(c)).toBe('all'))
  })

  it('modo "todas": POST/PUT/PATCH/DELETE NO salen (rechazo en el cliente con BRANCH_READ_ONLY) y no llevan cabecera', async () => {
    setBranchViewMode('all')
    const sent = installAdapter()
    const events: string[] = []
    const onEvt = () => events.push('evt')
    window.addEventListener(BRANCH_READ_ONLY_EVENT, onEvt)
    const calls = [
      api.post('/api/restaurant/pos/checkout', {}),
      api.put('/api/products/1', {}),
      api.patch('/api/products/1/toggle'),
      api.delete('/api/products/1'),
    ]
    for (const p of calls) {
      await expect(p).rejects.toMatchObject({
        response: { status: 403, data: { code: 'BRANCH_READ_ONLY' } },
      })
    }
    window.removeEventListener(BRANCH_READ_ONLY_EVENT, onEvt)
    expect(sent).toHaveLength(0)
    expect(events).toHaveLength(4)
  })

  it('modo "todas": login, refresh, cambio de sucursal, suscripción y consultas DNI/RUC siguen pudiendo escribir (sin cabecera)', async () => {
    setBranchViewMode('all')
    const sent = installAdapter()
    await api.post('/api/login', {})
    await api.post('/api/session/switch-branch', { branch_id: 2 })
    await api.post('/api/restaurant/auth/pin', {})
    await api.post('/api/subscription/payments', {})
    await api.post('/api/consulta/dni', {})
    expect(sent).toHaveLength(5)
    sent.forEach((c) => expect(headerOf(c)).toBeFalsy())
  })

  it('modo "todas": las lecturas de sesión/suscripción (exentas) tampoco llevan la cabecera', async () => {
    setBranchViewMode('all')
    const sent = installAdapter()
    await api.get('/api/session/context')
    await api.get('/api/subscription/hub')
    expect(sent).toHaveLength(2)
    sent.forEach((c) => expect(headerOf(c)).toBeFalsy())
  })

  it('al volver a "una sucursal" desaparece la cabecera y las escrituras vuelven a salir', async () => {
    setBranchViewMode('all')
    setBranchViewMode('single')
    const sent = installAdapter()
    await api.get('/api/sales')
    await api.post('/api/restaurant/pos/checkout', {})
    expect(sent).toHaveLength(2)
    sent.forEach((c) => expect(headerOf(c)).toBeFalsy())
  })
})

describe('interceptor: respuesta BRANCH_READ_ONLY del servidor', () => {
  it('un 403 BRANCH_READ_ONLY emite el evento de aviso, no desloguea y se propaga el error', async () => {
    installAdapter(() => ({ status: 403, data: { code: 'BRANCH_READ_ONLY', error: 'solo lectura' } }))
    const evt = vi.fn()
    const expired = vi.fn()
    window.addEventListener(BRANCH_READ_ONLY_EVENT, evt)
    window.addEventListener('tukichef-session-expired', expired)
    await expect(api.post('/api/sales', {})).rejects.toMatchObject({ response: { status: 403 } })
    window.removeEventListener(BRANCH_READ_ONLY_EVENT, evt)
    window.removeEventListener('tukichef-session-expired', expired)
    expect(evt).toHaveBeenCalledTimes(1)
    expect(expired).not.toHaveBeenCalled()
    expect(localStorage.getItem('token')).toBe('tok-A')
  })

  it('un 403 BRANCH_FORBIDDEN sigue siendo error de acceso (no confundir con modo consulta)', async () => {
    installAdapter(() => ({ status: 403, data: { code: 'BRANCH_FORBIDDEN' } }))
    const ro = vi.fn()
    const branchErr = vi.fn()
    window.addEventListener(BRANCH_READ_ONLY_EVENT, ro)
    window.addEventListener('tukichef-branch-error', branchErr)
    await expect(api.post('/api/sales', {})).rejects.toBeTruthy()
    window.removeEventListener(BRANCH_READ_ONLY_EVENT, ro)
    window.removeEventListener('tukichef-branch-error', branchErr)
    expect(ro).not.toHaveBeenCalled()
    expect(branchErr).toHaveBeenCalledTimes(1)
  })
})
