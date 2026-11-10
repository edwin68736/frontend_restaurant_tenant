import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor, fireEvent, within } from '@testing-library/react'
import type { ReactNode } from 'react'

const applyTokenUpdate = vi.fn()
const authState = { isAuthenticated: true, isLoading: false, applyTokenUpdate }
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }))
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMock }))

const getContext = vi.fn()
const switchBranch = vi.fn()
vi.mock('@/services/session.service', () => ({
  sessionService: { getContext: () => getContext(), switchBranch: (id: number) => switchBranch(id) },
}))
vi.mock('@/services/company.service', () => ({ companyService: { listBranches: vi.fn(async () => []) } }))

import { BranchProvider, useBranch } from '@/contexts/BranchContext'
import { useBranchWriteGuard } from '@/hooks/useBranchWriteGuard'
import { BranchSelectorMenu } from '@/components/layout/RestaurantBranchBadge'
import { RequireOperationalBranch } from '@/components/layout/RequireOperationalBranch'
import { BranchReadOnlyBanner } from '@/components/layout/BranchReadOnlyBanner'
import { __clearGuardsForTests, registerBranchSwitchGuard } from '@/lib/branch/switchGuards'
import { __resetEpochForTests, currentEpoch, currentEpochSignal } from '@/lib/branch/epoch'
import { __resetViewModeForTests, getBranchViewMode, isReadOnlyMode } from '@/lib/branch/viewMode'
import { clearAllCaches } from '@/lib/cacheRegistry'

const B1 = { id: 1, name: 'Sucursal 1' }
const B2 = { id: 2, name: 'Sucursal 2' }

/** JWT mínimo (solo el payload importa para auth_method). */
const jwt = (payload: Record<string, unknown>) => `h.${btoa(JSON.stringify(payload))}.s`
const ADMIN_JWT = jwt({ auth_method: 'pwd', permissions: ['branches.view_all', 'sales.view'] })
const STALE_ADMIN_JWT = jwt({ auth_method: 'pwd', permissions: ['sales.view'] })

const wrapper = ({ children }: { children: ReactNode }) => <BranchProvider>{children}</BranchProvider>

function seed(opts: { canViewAll: boolean; token?: string }) {
  localStorage.setItem('token', opts.token ?? ADMIN_JWT)
  localStorage.setItem('active_branch', JSON.stringify(B1))
  localStorage.setItem('allowed_branches', JSON.stringify([B1, B2]))
  localStorage.setItem('can_switch_branch', 'true')
  if (opts.canViewAll) localStorage.setItem('can_view_all', 'true')
  getContext.mockResolvedValue({
    active_branch: B1,
    can_switch_branch: true,
    can_view_all: opts.canViewAll,
    allowed_branches: [B1, B2],
  })
}

beforeEach(() => {
  localStorage.clear()
  __resetEpochForTests()
  __resetViewModeForTests()
  __clearGuardsForTests()
  applyTokenUpdate.mockClear()
  switchBranch.mockReset()
  getContext.mockReset()
  Object.values(toastMock).forEach((m) => m.mockClear())
})
afterEach(() => {
  cleanup()
  clearAllCaches()
  vi.restoreAllMocks()
})

describe('useBranchWriteGuard / isReadOnlyMode', () => {
  it('en modo una sucursal se puede escribir; en "todas" el hook marca solo lectura y avisa', async () => {
    seed({ canViewAll: true })
    const { result } = renderHook(() => ({ branch: useBranch(), guard: useBranchWriteGuard() }), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    expect(result.current.guard.readOnly).toBe(false)
    expect(result.current.guard.guardWrite()).toBe(true)
    expect(isReadOnlyMode()).toBe(false)

    act(() => {
      expect(result.current.branch.setViewMode('all')).toBe(true)
    })
    expect(result.current.guard.readOnly).toBe(true)
    expect(isReadOnlyMode()).toBe(true)
    expect(result.current.guard.guardWrite()).toBe(false)
    expect(toastMock.warning).toHaveBeenCalledTimes(1)
    expect(String(toastMock.warning.mock.calls[0][0])).toMatch(/Modo consulta/)

    act(() => {
      expect(result.current.branch.setViewMode('single')).toBe(true)
    })
    expect(result.current.guard.readOnly).toBe(false)
    expect(result.current.guard.guardWrite()).toBe(true)
  })
})

describe('cambio de modo: remonta, cancela lecturas en vuelo, sin reemitir token', () => {
  it('abre época nueva (aborta la señal vieja), incrementa resetEpoch y NO llama a switch-branch ni cambia el token', async () => {
    seed({ canViewAll: true })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const tokenBefore = localStorage.getItem('token')
    const epoch0 = currentEpoch()
    const signal0 = currentEpochSignal()
    const re0 = result.current.resetEpoch
    const fired: string[] = []
    const onChanged = () => fired.push('branch-changed')
    window.addEventListener('branch-changed', onChanged)

    act(() => {
      result.current.setViewMode('all')
    })
    window.removeEventListener('branch-changed', onChanged)
    expect(signal0.aborted).toBe(true)
    expect(currentEpoch()).toBe(epoch0 + 1)
    expect(result.current.resetEpoch).toBe(re0 + 1)
    expect(fired).toEqual(['branch-changed'])
    expect(switchBranch).not.toHaveBeenCalled()
    expect(applyTokenUpdate).not.toHaveBeenCalled()
    expect(localStorage.getItem('token')).toBe(tokenBefore)
    expect(result.current.activeBranchId).toBe(1)
  })

  it('con trabajo pendiente pide confirmación; si se cancela, no cambia de modo', async () => {
    seed({ canViewAll: true })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    registerBranchSwitchGuard({ getMessage: () => 'Tiene abierta la cuenta de Mesa 4.' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    let ok = true
    act(() => {
      ok = result.current.setViewMode('all')
    })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(ok).toBe(false)
    expect(result.current.isAllBranches).toBe(false)
    expect(getBranchViewMode()).toBe('single')
  })

  it('elegir una sucursal concreta estando en "todas" sale del modo consulta con UNA sola época', async () => {
    seed({ canViewAll: true })
    switchBranch.mockResolvedValue({ token: 'tok-2', active_branch: B2, can_switch_branch: true, can_view_all: true, allowed_branches: [B1, B2] })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    act(() => {
      result.current.setViewMode('all')
    })
    const epoch1 = currentEpoch()
    await act(async () => {
      await result.current.switchBranch(2)
    })
    expect(result.current.isAllBranches).toBe(false)
    expect(isReadOnlyMode()).toBe(false)
    expect(result.current.activeBranchId).toBe(2)
    expect(currentEpoch()).toBe(epoch1 + 1)
  })
})

describe('permiso branches.view_all y persistencia', () => {
  it('sin can_view_all no se puede entrar en modo "todas"', async () => {
    seed({ canViewAll: false })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    expect(result.current.canViewAll).toBe(false)
    let ok = true
    act(() => {
      ok = result.current.setViewMode('all')
    })
    expect(ok).toBe(false)
    expect(isReadOnlyMode()).toBe(false)
  })

  it('el modo se persiste por empresa y se restaura; al perder el permiso (contexto) baja a una sucursal', async () => {
    seed({ canViewAll: true })
    const first = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    act(() => {
      first.result.current.setViewMode('all')
    })
    first.unmount()
    expect(Object.keys(localStorage).some((k) => k.startsWith('branch_view_mode'))).toBe(true)

    // "recarga": módulo reinicializado, el modo sale de localStorage
    __resetViewModeForTests()
    expect(getBranchViewMode()).toBe('all')
    // el backend ahora dice que ya no tiene view_all
    getContext.mockResolvedValue({ active_branch: B1, can_switch_branch: true, can_view_all: false, allowed_branches: [B1, B2] })
    const second = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(second.result.current.isAllBranches).toBe(false))
    expect(isReadOnlyMode()).toBe(false)
  })

  it('clearAllCaches (logout) borra el modo y su persistencia', async () => {
    seed({ canViewAll: true })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    act(() => {
      result.current.setViewMode('all')
    })
    expect(isReadOnlyMode()).toBe(true)
    clearAllCaches()
    expect(isReadOnlyMode()).toBe(false)
    expect(Object.keys(localStorage).some((k) => k.startsWith('branch_view_mode'))).toBe(false)
  })

  it('una sesión de PIN nunca tiene view_all, aunque localStorage lo diga', async () => {
    seed({ canViewAll: true, token: jwt({ auth_method: 'pin' }) })
    getContext.mockResolvedValue({ active_branch: B1, can_switch_branch: true, can_view_all: true, allowed_branches: [B1, B2] })
    const { result } = renderHook(() => useBranch(), { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    expect(result.current.canViewAll).toBe(false)
    let ok = true
    act(() => {
      ok = result.current.setViewMode('all')
    })
    expect(ok).toBe(false)
    expect(isReadOnlyMode()).toBe(false)
  })
})

describe('selector de sucursal del menú de usuario', () => {
  it('con can_view_all ofrece "Todas las sucursales" y al elegirla activa el modo consulta', async () => {
    seed({ canViewAll: true })
    render(<BranchSelectorMenu />, { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['all', '1', '2'])
    expect(select.value).toBe('1')
    fireEvent.change(select, { target: { value: 'all' } })
    await waitFor(() => expect(isReadOnlyMode()).toBe(true))
    await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('all'))
    expect(switchBranch).not.toHaveBeenCalled()
  })

  it('token anterior a V176 (sin branches.view_all en sus claims): se ofrece "todas" si el contexto dice can_view_all (el servidor decide por BD)', async () => {
    seed({ canViewAll: true, token: STALE_ADMIN_JWT })
    render(<BranchSelectorMenu />, { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toContain('all')
  })

  it('sin can_view_all NO hay opción "todas"', async () => {
    seed({ canViewAll: false })
    render(<BranchSelectorMenu />, { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['1', '2'])
  })

  it('con sesión de PIN (aunque tenga varias sucursales) NO hay opción "todas"', async () => {
    seed({ canViewAll: true, token: jwt({ auth_method: 'pin' }) })
    render(<BranchSelectorMenu />, { wrapper })
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['1', '2'])
  })

  it('un administrador de una sola sucursal con view_all (sin switch) igual ve el selector con "Todas"', async () => {
    localStorage.setItem('token', ADMIN_JWT)
    localStorage.setItem('active_branch', JSON.stringify(B1))
    localStorage.setItem('allowed_branches', JSON.stringify([B1]))
    localStorage.setItem('can_switch_branch', 'false')
    localStorage.setItem('can_view_all', 'true')
    getContext.mockResolvedValue({ active_branch: B1, can_switch_branch: false, can_view_all: true, allowed_branches: [B1] })
    render(<BranchSelectorMenu />, { wrapper })
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['all', '1'])
  })
})

describe('banner y páginas operativas en modo consulta', () => {
  it('el banner solo aparece en modo "todas" y las páginas operativas muestran "Seleccione una sucursal para operar"', async () => {
    seed({ canViewAll: true })
    const probe: { setMode?: (m: 'single' | 'all') => boolean } = {}
    function Grab() {
      probe.setMode = useBranch().setViewMode
      return null
    }
    render(
      <BranchProvider>
        <Grab />
        <BranchReadOnlyBanner />
        <RequireOperationalBranch>
          <div>pantalla de mesas</div>
        </RequireOperationalBranch>
      </BranchProvider>,
    )
    await waitFor(() => expect(getContext).toHaveBeenCalled())
    expect(screen.queryByTestId('branch-readonly-banner')).toBeNull()
    expect(screen.getByText('pantalla de mesas')).toBeTruthy()

    act(() => {
      probe.setMode!('all')
    })
    expect(screen.getByTestId('branch-readonly-banner').textContent).toContain('Modo consulta: todas las sucursales')
    expect(screen.queryByText('pantalla de mesas')).toBeNull()
    expect(screen.getByText('Seleccione una sucursal para operar')).toBeTruthy()

    // el botón del aviso vuelve al modo operativo
    fireEvent.click(within(screen.getByTestId('branch-required-notice')).getByRole('button', { name: /Operar en Sucursal 1/ }))
    await waitFor(() => expect(screen.getByText('pantalla de mesas')).toBeTruthy())
    expect(screen.queryByTestId('branch-readonly-banner')).toBeNull()
  })
})
