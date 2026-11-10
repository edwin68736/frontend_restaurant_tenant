import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import api, { BRANCH_ERROR_EVENT, SESSION_EXPIRED_EVENT, resetReloginGuard } from '@/services/api'
import {
  __resetEpochForTests,
  beginBranchSwitch,
  bumpBranchEpoch,
  endBranchSwitch,
} from '@/lib/branch/epoch'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

type Deferred = { config: InternalAxiosRequestConfig; resolve: (status: number, data?: unknown) => void }

/** Adaptador falso: la respuesta la controla el test y respeta el AbortSignal como el real. */
function installAdapter() {
  const pending: Deferred[] = []
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      const respond = (status: number, data: unknown = {}) => {
        const response = { data, status, statusText: '', headers: {}, config }
        if (status >= 200 && status < 300) resolve(response)
        else reject(Object.assign(new Error('http ' + status), { isAxiosError: true, response, config }))
      }
      const signal = config.signal
      if (signal) {
        const onAbort = () =>
          reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED', __CANCEL__: true, config }))
        if (signal.aborted) onAbort()
        else signal.addEventListener?.('abort', onAbort, { once: true })
      }
      pending.push({ config, resolve: respond })
    })
  api.defaults.adapter = adapter
  return pending
}

const tick = () => new Promise((r) => setTimeout(r, 0))

/** true si la promesa NO se resolvió ni rechazó tras dejar correr la cola de tareas. */
async function staysPending(p: Promise<unknown>): Promise<boolean> {
  let settled = false
  p.then(
    () => (settled = true),
    () => (settled = true),
  )
  await new Promise((r) => setTimeout(r, 20))
  return !settled
}

describe('interceptor axios: época de sucursal', () => {
  let expired: () => void
  let expiredCalls: number
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'tok-A')
    __resetEpochForTests()
    resetReloginGuard()
    expiredCalls = 0
    expired = () => {
      expiredCalls += 1
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
  })
  afterEach(() => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('aborta una lectura en vuelo al cambiar de época y no produce error visible', async () => {
    const pending = installAdapter()
    const p = api.get('/api/sales')
    await tick()
    expect(pending[0].config.signal?.aborted).toBe(false)
    bumpBranchEpoch()
    expect(pending[0].config.signal?.aborted).toBe(true)
    // ni resuelve ni rechaza: el .catch(() => toast.error(...)) de la pantalla vieja nunca corre
    expect(await staysPending(p)).toBe(true)
    expect(expiredCalls).toBe(0)
  })

  it('descarta la respuesta que llega de otra época aunque el adaptador no respete el abort', async () => {
    const pending = installAdapter()
    const p = api.get('/api/sales')
    await tick()
    bumpBranchEpoch()
    pending[0].resolve(200, { data: [{ id: 1, branch: 'A' }] })
    expect(await staysPending(p)).toBe(true)
  })

  it('descarta también errores HTTP de la época anterior (no desloguea)', async () => {
    const pending = installAdapter()
    const p = api.get('/api/sales')
    await tick()
    bumpBranchEpoch()
    pending[0].resolve(401, { code: 'TOKEN_TENANT_INVALID' })
    expect(await staysPending(p)).toBe(true)
    expect(expiredCalls).toBe(0)
  })

  it('una petición de la época nueva se resuelve con normalidad', async () => {
    const pending = installAdapter()
    bumpBranchEpoch()
    const p = api.get('/api/sales')
    await tick()
    pending[0].resolve(200, { ok: true })
    const r = await p
    expect(r.data).toEqual({ ok: true })
  })

  it('no aborta login, contexto ni cambio de sucursal', async () => {
    const pending = installAdapter()
    const calls = [
      api.post('/api/login', {}),
      api.get('/api/session/context'),
      api.post('/api/session/switch-branch', {}),
    ]
    await tick()
    bumpBranchEpoch()
    pending.forEach((d) => expect(d.config.signal?.aborted).not.toBe(true))
    pending.forEach((d) => d.resolve(200, { ok: 1 }))
    const res = await Promise.all(calls)
    expect(res).toHaveLength(3)
  })

  it('no aborta escrituras (POST): el servidor puede estar procesando el cobro', async () => {
    const pending = installAdapter()
    const p = api.post('/api/restaurant/pos/checkout', { total: 10 })
    await tick()
    bumpBranchEpoch()
    expect(pending[0].config.signal?.aborted).not.toBe(true)
    pending[0].resolve(200, { sale: 1 })
    expect((await p).data).toEqual({ sale: 1 })
  })

  it('respeta la señal propia de la petición (la señal de la época no la pisa)', async () => {
    const pending = installAdapter()
    const own = new AbortController()
    const p = api.get('/api/products', { signal: own.signal })
    await tick()
    own.abort()
    expect(pending[0].config.signal?.aborted).toBe(true)
    // cancelación propia: SÍ rechaza (el llamador la distingue con isAbortError)
    await expect(p).rejects.toBeTruthy()
  })

  it('SESSION_UPDATED provocado por el propio cambio de sucursal no cierra la sesión', async () => {
    const pending = installAdapter()
    const p = api.get('/api/session/context')
    await tick()
    beginBranchSwitch()
    pending[0].resolve(409, { code: 'SESSION_UPDATED' })
    await expect(p).rejects.toBeTruthy()
    endBranchSwitch()
    expect(expiredCalls).toBe(0)
  })

  it('SESSION_UPDATED de una petición con token ya reemplazado no cierra la sesión', async () => {
    const pending = installAdapter()
    const p = api.get('/api/session/context')
    await tick()
    localStorage.setItem('token', 'tok-B') // el cambio de sucursal reemplazó el token mientras viajaba
    pending[0].resolve(409, { code: 'SESSION_UPDATED' })
    await expect(p).rejects.toBeTruthy()
    expect(expiredCalls).toBe(0)
  })

  it('SESSION_UPDATED genuino (token vigente, sin cambio en curso) sí cierra la sesión', async () => {
    const pending = installAdapter()
    const p = api.get('/api/session/context')
    await tick()
    pending[0].resolve(409, { code: 'SESSION_UPDATED' })
    await expect(p).rejects.toBeTruthy()
    expect(expiredCalls).toBe(1)
  })

  it('BRANCH_FORBIDDEN dispara el evento de sucursal y no desloguea', async () => {
    const pending = installAdapter()
    let branchErrors = 0
    const onBranchError = () => {
      branchErrors += 1
    }
    window.addEventListener(BRANCH_ERROR_EVENT, onBranchError)
    const p = api.get('/api/sales')
    await tick()
    pending[0].resolve(403, { code: 'BRANCH_FORBIDDEN' })
    await expect(p).rejects.toBeTruthy()
    window.removeEventListener(BRANCH_ERROR_EVENT, onBranchError)
    expect(branchErrors).toBe(1)
    expect(expiredCalls).toBe(0)
  })
})
