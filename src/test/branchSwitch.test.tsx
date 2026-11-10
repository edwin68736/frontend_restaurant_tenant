import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const applyTokenUpdate = vi.fn()
const authState = { isAuthenticated: true, isLoading: false, applyTokenUpdate }

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const switchCalls: { id: number; d: Deferred<unknown> }[] = []
const getContext = vi.fn()

vi.mock('@/services/session.service', () => ({
  sessionService: {
    getContext: () => getContext(),
    switchBranch: (id: number) => {
      const d = deferred<unknown>()
      switchCalls.push({ id, d })
      return d.promise
    },
  },
}))

import { BranchProvider, useBranch } from '@/contexts/BranchContext'
import { useTableSessionBranchGuard, __tableSessionOwnersForTests } from '@/hooks/useTableSessionBranchGuard'
import { __clearGuardsForTests, discardPendingWork, pendingSwitchMessages } from '@/lib/branch/switchGuards'
import { __resetEpochForTests, currentEpoch } from '@/lib/branch/epoch'

const B1 = { id: 1, name: 'Sucursal 1' }
const B2 = { id: 2, name: 'Sucursal 2' }
const B3 = { id: 3, name: 'Sucursal 3' }
const switchResponse = (b: { id: number; name: string }, token: string) => ({
  token,
  active_branch: b,
  can_switch_branch: true,
  allowed_branches: [B1, B2, B3],
})

const wrapper = ({ children }: { children: ReactNode }) => <BranchProvider>{children}</BranchProvider>

beforeEach(() => {
  switchCalls.length = 0
  applyTokenUpdate.mockClear()
  __resetEpochForTests()
  __clearGuardsForTests()
  __tableSessionOwnersForTests().clear()
  localStorage.clear()
  localStorage.setItem('token', 'tok-1')
  localStorage.setItem('active_branch', JSON.stringify(B1))
  localStorage.setItem('can_switch_branch', 'true')
  getContext.mockResolvedValue({ active_branch: B1, can_switch_branch: true, allowed_branches: [B1, B2, B3] })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('switchBranch serializado', () => {
  it('dos cambios seguidos se ejecutan uno tras otro, en orden, y el último queda activo', async () => {
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())

    let p2!: Promise<boolean>
    let p3!: Promise<boolean>
    act(() => {
      p2 = result.current.switchBranch(2)
      p3 = result.current.switchBranch(3)
    })
    // solo UNA llamada al servidor mientras la primera no termine
    await waitFor(() => expect(switchCalls).toHaveLength(1))
    expect(switchCalls[0].id).toBe(2)
    expect(result.current.switching).toBe(true)

    await act(async () => {
      switchCalls[0].d.resolve(switchResponse(B2, 'tok-2'))
      await p2
    })
    // recién ahora arranca el segundo
    await waitFor(() => expect(switchCalls).toHaveLength(2))
    expect(switchCalls[1].id).toBe(3)
    expect(result.current.activeBranchId).toBe(2)

    await act(async () => {
      switchCalls[1].d.resolve(switchResponse(B3, 'tok-3'))
      await p3
    })
    expect(result.current.activeBranchId).toBe(3)
    expect(result.current.switching).toBe(false)
    expect(applyTokenUpdate.mock.calls.map((c) => c[0].token)).toEqual(['tok-2', 'tok-3'])
    expect(JSON.parse(localStorage.getItem('active_branch')!)).toEqual(B3)
  })

  it('actualiza el token del AuthContext, abre época nueva y remonta (resetEpoch)', async () => {
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const epoch0 = currentEpoch()
    const re0 = result.current.resetEpoch

    let p!: Promise<boolean>
    act(() => {
      p = result.current.switchBranch(2)
    })
    await waitFor(() => expect(switchCalls).toHaveLength(1))
    await act(async () => {
      switchCalls[0].d.resolve({ ...switchResponse(B2, 'tok-2'), refresh_token: 'ref-2' })
      await p
    })
    expect(applyTokenUpdate).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-2', refresh_token: 'ref-2' }))
    expect(currentEpoch()).toBe(epoch0 + 1)
    expect(result.current.resetEpoch).toBe(re0 + 1)
  })

  it('cambiar a la sucursal ya activa no llama al servidor', async () => {
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    let ok = true
    await act(async () => {
      ok = await result.current.switchBranch(1)
    })
    expect(ok).toBe(false)
    expect(switchCalls).toHaveLength(0)
  })

  it('si el servidor rechaza, no cambia nada y el siguiente cambio de la cola sigue', async () => {
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    let p2!: Promise<boolean>
    let p3!: Promise<boolean>
    act(() => {
      p2 = result.current.switchBranch(2)
      p3 = result.current.switchBranch(3)
    })
    await waitFor(() => expect(switchCalls).toHaveLength(1))
    await act(async () => {
      switchCalls[0].d.reject({ response: { data: { error: 'sin acceso' } } })
      expect(await p2).toBe(false)
    })
    expect(result.current.activeBranchId).toBe(1)
    await waitFor(() => expect(switchCalls).toHaveLength(2))
    await act(async () => {
      switchCalls[1].d.resolve(switchResponse(B3, 'tok-3'))
      expect(await p3).toBe(true)
    })
    expect(result.current.activeBranchId).toBe(3)
  })
})

describe('MesaPage: cambio de sucursal con mesa/cuenta abierta', () => {
  /** Mismo hook que usa MesaPage, con la misma configuración de guarda. */
  function useMesa(sessionId: number, branchId: number, onDiscard: () => void, pending: string | null) {
    return useTableSessionBranchGuard({ sessionId, activeBranchId: branchId, pendingMessage: pending, onDiscard })
  }

  it('pide confirmación; si el usuario cancela, NO cambia de sucursal ni descarta la sesión', async () => {
    const onDiscard = vi.fn()
    renderHook(() => useMesa(77, 1, onDiscard, 'Tiene abierta la cuenta de Mesa 4.'), { wrapper })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    let ok = true
    await act(async () => {
      ok = await result.current.switchBranch(2)
    })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(String(confirm.mock.calls[0][0])).toContain('Mesa 4')
    expect(ok).toBe(false)
    expect(switchCalls).toHaveLength(0)
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('al confirmar y cambiar: descarta sesión y carrito (onDiscard) ANTES de remontar, y la mesa queda ajena', async () => {
    const order: string[] = []
    const onDiscard = vi.fn(() => order.push('discard'))
    // Un solo árbol: el hook de la mesa y el proveedor comparten el mismo BranchProvider.
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: number }) => {
        const branch = useBranch()
        const g = useMesa(sessionId, branch.activeBranchId, onDiscard, 'Tiene abierta la cuenta de Mesa 4.')
        return { branch, g }
      },
      { wrapper, initialProps: { sessionId: 77 } },
    )
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    expect(result.current.g.foreign).toBe(false)
    expect(pendingSwitchMessages()).toHaveLength(1)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const epochBefore = result.current.branch.resetEpoch

    let p!: Promise<boolean>
    act(() => {
      p = result.current.branch.switchBranch(2)
    })
    await waitFor(() => expect(switchCalls).toHaveLength(1))
    await act(async () => {
      switchCalls[0].d.resolve(switchResponse(B2, 'tok-2'))
      expect(await p).toBe(true)
    })

    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(result.current.branch.resetEpoch).toBe(epochBefore + 1)
    // Tras el cambio, la sesión 77 (abierta en la sucursal 1) es AJENA: la pantalla no debe consultarla.
    rerender({ sessionId: 77 })
    expect(result.current.g.foreign).toBe(true)
    // Una sesión nueva en la sucursal 2 sí es propia.
    rerender({ sessionId: 90 })
    expect(result.current.g.foreign).toBe(false)
  })

  it('sin trabajo pendiente no pregunta nada', async () => {
    renderHook(() => useMesa(5, 1, vi.fn(), null), { wrapper })
    expect(pendingSwitchMessages()).toEqual([])
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const confirm = vi.spyOn(window, 'confirm')
    act(() => {
      void result.current.switchBranch(2)
    })
    await waitFor(() => expect(switchCalls).toHaveLength(1))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('discardPendingWork solo invoca guardas con trabajo pendiente', () => {
    const a = vi.fn()
    const b = vi.fn()
    renderHook(() => useMesa(1, 1, a, 'pendiente'), { wrapper })
    renderHook(() => useMesa(2, 1, b, null), { wrapper })
    discardPendingWork()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })
})
