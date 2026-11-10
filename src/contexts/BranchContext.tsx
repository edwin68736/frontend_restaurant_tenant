import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { sessionService, type BranchBrief } from '@/services/session.service'
import { decodeJWT } from '@/services/auth.service'
import { useAuth } from '@/contexts/AuthContext'
import { BRANCH_ERROR_EVENT, SESSION_REFRESHED_EVENT } from '@/services/api'
import {
  beginBranchSwitch,
  bumpBranchEpoch,
  endBranchSwitch,
  setActiveBranchIdForCache,
} from '@/lib/branch/epoch'
import { discardPendingWork, pendingSwitchMessages } from '@/lib/branch/switchGuards'
import { clearAllCaches, resetBranchCaches } from '@/lib/cacheRegistry'
import {
  BRANCH_READ_ONLY_EVENT,
  CAN_VIEW_ALL_KEY,
  READ_ONLY_MESSAGE,
  getBranchViewMode,
  reconcileViewMode,
  setBranchViewMode,
  type BranchViewMode,
} from '@/lib/branch/viewMode'

const ALLOWED_BRANCHES_KEY = 'allowed_branches'
/** Mínimo entre refrescos de contexto disparados por foco/visibilidad. */
const CONTEXT_REFRESH_MIN_INTERVAL_MS = 60_000

function readAllowedBranches(): BranchBrief[] {
  try {
    const raw = localStorage.getItem(ALLOWED_BRANCHES_KEY)
    return raw ? (JSON.parse(raw) as BranchBrief[]) : []
  } catch {
    return []
  }
}

function readActiveBranch(): BranchBrief | null {
  try {
    const raw = localStorage.getItem('active_branch')
    return raw ? (JSON.parse(raw) as BranchBrief) : null
  } catch {
    return null
  }
}

/**
 * El backend decide "ver todas" con los permisos del rol en BD (no con el JWT), igual que el `can_view_all` que informan
 * login y contexto: un token anterior a V176 ya funciona. Solo se excluye el POS por PIN, que nunca ve todas.
 */
function sessionAllowsViewAll(): boolean {
  try {
    const token = localStorage.getItem('token')
    if (!token) return false
    const jwt = decodeJWT<{ auth_method?: string }>(token)
    return !!jwt && jwt.auth_method !== 'pin'
  } catch {
    return false
  }
}

function readCanViewAll(): boolean {
  try {
    return localStorage.getItem(CAN_VIEW_ALL_KEY) === 'true' && sessionAllowsViewAll()
  } catch {
    return false
  }
}

type BranchContextValue = {
  activeBranch: BranchBrief | null
  activeBranchId: number
  allowedBranches: BranchBrief[]
  canSwitchBranch: boolean
  /** Permiso branches.view_all (nunca el POS por PIN): habilita el modo consulta de todas las sucursales. */
  canViewAll: boolean
  /** Modo vigente: 'single' (operativo) o 'all' (todas las sucursales, SOLO CONSULTA). */
  viewMode: BranchViewMode
  /** true en modo consulta "todas las sucursales": no se puede operar ni escribir. */
  isAllBranches: boolean
  /**
   * Cambia entre una sucursal y todas. 'all' solo si canViewAll. Remonta las pantallas y aborta las lecturas en
   * vuelo SIN reemitir token. Devuelve false si no se pudo (sin permiso, cancelado, cambio en curso).
   */
  setViewMode: (mode: BranchViewMode) => boolean
  /** true mientras hay un cambio de sucursal en curso (bloquear el selector). */
  switching: boolean
  resetEpoch: number
  setFromLogin: (
    branch: BranchBrief | null,
    canSwitch: boolean,
    allowed?: BranchBrief[],
    canViewAll?: boolean,
  ) => void
  /**
   * Cambia de sucursal. Serializado (varios cambios seguidos se encolan). Devuelve `true` si se
   * cambió, `false` si el usuario canceló la confirmación o el servidor lo rechazó.
   */
  switchBranch: (branchId: number) => Promise<boolean>
  /** Vuelve a pedir el contexto de sucursal al backend (permisos/asignaciones pueden cambiar). */
  refreshContext: () => Promise<void>
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined)

export function BranchProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, applyTokenUpdate } = useAuth()
  const [activeBranch, setActiveBranch] = useState<BranchBrief | null>(readActiveBranch)
  const [allowedBranches, setAllowedBranches] = useState<BranchBrief[]>(readAllowedBranches)
  const [canSwitchBranch, setCanSwitchBranch] = useState(
    () => localStorage.getItem('can_switch_branch') === 'true',
  )
  const [canViewAll, setCanViewAll] = useState(readCanViewAll)
  const [viewMode, setViewModeState] = useState<BranchViewMode>(getBranchViewMode)
  const [resetEpoch, setResetEpoch] = useState(0)
  const [switching, setSwitching] = useState(false)
  const switchingRef = useRef(false)

  // La sucursal activa debe estar disponible para claves de caché ANTES de que los hijos pidan datos
  // (los efectos de los hijos corren antes que los del proveedor), por eso se fija durante el render.
  const activeRef = useRef<number>(activeBranch?.id ?? 0)
  activeRef.current = activeBranch?.id ?? 0
  setActiveBranchIdForCache(activeRef.current)

  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const lastRefreshAtRef = useRef(0)

  const persistBranch = useCallback(
    (b: BranchBrief | null, canSwitch: boolean, allowed?: BranchBrief[]) => {
      if (b) localStorage.setItem('active_branch', JSON.stringify(b))
      else localStorage.removeItem('active_branch')
      localStorage.setItem('can_switch_branch', canSwitch ? 'true' : 'false')
      const list = allowed?.length ? allowed : b ? [b] : []
      setAllowedBranches(list)
      if (list.length) localStorage.setItem(ALLOWED_BRANCHES_KEY, JSON.stringify(list))
      else localStorage.removeItem(ALLOWED_BRANCHES_KEY)
    },
    [],
  )

  /** Nueva época: aborta lecturas en vuelo, limpia cachés de sucursal y remonta las pantallas. */
  const bumpReset = useCallback(() => {
    bumpBranchEpoch()
    resetBranchCaches()
    setResetEpoch((e) => e + 1)
    window.dispatchEvent(new CustomEvent('branch-changed'))
  }, [])

  /**
   * Aplica el permiso "ver todas". Si se retira (o la sesión es de PIN) y estaba en modo "todas", se baja a
   * "una sucursal": nunca se queda en modo consulta sin permiso. Devuelve true si bajó el modo.
   */
  const applyCanViewAll = useCallback((requested: boolean): boolean => {
    const value = requested && sessionAllowsViewAll()
    setCanViewAll(value)
    try {
      if (value) localStorage.setItem(CAN_VIEW_ALL_KEY, 'true')
      else localStorage.removeItem(CAN_VIEW_ALL_KEY)
    } catch {
      /* noop */
    }
    if (reconcileViewMode(value)) {
      setViewModeState('single')
      return true
    }
    return false
  }, [])

  /** Aplica una sucursal activa nueva al estado, a localStorage y a la clave de caché. */
  const applyBranch = useCallback(
    (b: BranchBrief | null, canSwitch: boolean, allowed?: BranchBrief[], canViewAllNext?: boolean) => {
      activeRef.current = b?.id ?? 0
      setActiveBranchIdForCache(activeRef.current)
      setActiveBranch(b)
      setCanSwitchBranch(canSwitch)
      persistBranch(b, canSwitch, allowed)
      if (canViewAllNext !== undefined) applyCanViewAll(canViewAllNext)
    },
    [applyCanViewAll, persistBranch],
  )

  const setFromLogin = useCallback(
    (branch: BranchBrief | null, canSwitch: boolean, allowed?: BranchBrief[], canViewAllNext?: boolean) => {
      // Login nuevo: el modo consulta de una sesión anterior no se hereda; el PIN nunca trae view_all.
      applyBranch(branch, canSwitch, allowed, canViewAllNext ?? false)
    },
    [applyBranch],
  )

  const setViewMode = useCallback(
    (next: BranchViewMode): boolean => {
      if (switchingRef.current) return false
      if (next === 'all' && !readCanViewAll()) return false
      if (next === getBranchViewMode()) return false
      const pending = pendingSwitchMessages()
      if (pending.length > 0) {
        const ok = window.confirm(
          `${pending.join('\n\n')}\n\nSi cambia de modo se descartará ese trabajo. ¿Desea continuar?`,
        )
        if (!ok) return false
      }
      // El modo se fija ANTES de abrir la época nueva: las lecturas que salgan después ya llevan la cabecera correcta.
      setBranchViewMode(next)
      setViewModeState(next)
      discardPendingWork()
      bumpReset()
      toast.info(next === 'all' ? 'Modo consulta: todas las sucursales' : 'Modo operativo: una sucursal')
      return true
    },
    [bumpReset],
  )

  const refreshContext = useCallback(async () => {
    lastRefreshAtRef.current = Date.now()
    const ctx = await sessionService.getContext()
    const prevId = activeRef.current
    const nextId = ctx.active_branch?.id ?? 0
    if (!ctx.active_branch) {
      // Sin sucursal activa en el servidor: se conserva lo que haya y solo se actualiza el permiso.
      setCanSwitchBranch(!!ctx.can_switch_branch)
      if (applyCanViewAll(!!ctx.can_view_all)) bumpReset()
      return
    }
    const modeDowngraded = getBranchViewMode() === 'all' && !ctx.can_view_all
    applyBranch(ctx.active_branch, !!ctx.can_switch_branch, ctx.allowed_branches, !!ctx.can_view_all)
    if (modeDowngraded) {
      bumpReset()
      toast.info('Ya no tiene acceso a todas las sucursales')
    }
    // El backend cambió la sucursal activa por su cuenta (asignaciones, permisos): se trata como un
    // cambio real, sin posibilidad de confirmar, así que el trabajo pendiente se descarta.
    if (prevId && nextId && prevId !== nextId) {
      discardPendingWork()
      bumpReset()
      toast.info(`Su sucursal activa ahora es ${ctx.active_branch?.name ?? ''}`.trim())
    }
  }, [applyBranch, applyCanViewAll, bumpReset])

  const doSwitch = useCallback(
    async (branchId: number): Promise<boolean> => {
      if (!branchId || branchId === activeRef.current) return false

      const pending = pendingSwitchMessages()
      if (pending.length > 0) {
        const ok = window.confirm(
          `${pending.join('\n\n')}\n\nSi cambia de sucursal se descartará ese trabajo. ¿Desea continuar?`,
        )
        if (!ok) return false
      }

      beginBranchSwitch()
      switchingRef.current = true
      setSwitching(true)
      try {
        const res = await sessionService.switchBranch(branchId)
        // 1) token nuevo en localStorage y en AuthContext (caja, SSE y permisos lo usan)
        applyTokenUpdate({
          token: res.token,
          refresh_token: res.refresh_token,
          restaurant_permissions: res.restaurant_permissions,
        })
        // 2) sucursal nueva
        applyBranch(res.active_branch, res.can_switch_branch, res.allowed_branches, res.can_view_all)
        // Elegir una sucursal concreta saca del modo consulta (una sola época: bumpReset de abajo).
        if (getBranchViewMode() === 'all') {
          setBranchViewMode('single')
          setViewModeState('single')
        }
        // 3) descartar mesa/carrito ANTES de remontar para no operar un sessionId de otra sucursal
        discardPendingWork()
        // 4) época nueva: abortar lecturas viejas y remontar pantallas
        bumpReset()
        toast.success(`Local: ${res.active_branch.name}`)
        return true
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(msg ?? 'No se pudo cambiar de sucursal')
        return false
      } finally {
        endBranchSwitch()
        switchingRef.current = false
        setSwitching(false)
      }
    },
    [applyBranch, applyTokenUpdate, bumpReset],
  )

  const switchBranch = useCallback(
    (branchId: number) => {
      const run = queueRef.current.then(() => doSwitch(branchId))
      queueRef.current = run.catch(() => undefined)
      return run
    },
    [doSwitch],
  )

  // Sincroniza con login por PIN/credenciales que escriben en localStorage.
  useEffect(() => {
    const syncFromStorage = () => {
      const b = readActiveBranch()
      if (b?.id) {
        activeRef.current = b.id
        setActiveBranchIdForCache(b.id)
        setActiveBranch(b)
      }
      setCanSwitchBranch(localStorage.getItem('can_switch_branch') === 'true')
      setAllowedBranches(readAllowedBranches())
      setCanViewAll(readCanViewAll())
    }
    syncFromStorage()
    window.addEventListener('tukichef-session-applied', syncFromStorage)
    return () => window.removeEventListener('tukichef-session-applied', syncFromStorage)
  }, [])

  // Logout / sesión vencida: el estado de sucursal no sobrevive.
  useEffect(() => {
    if (authLoading || isAuthenticated) return
    activeRef.current = 0
    setActiveBranchIdForCache(0)
    setActiveBranch(null)
    setAllowedBranches([])
    setCanSwitchBranch(false)
    setCanViewAll(false)
    setViewModeState('single')
    localStorage.removeItem('active_branch')
    localStorage.removeItem('can_switch_branch')
    localStorage.removeItem(CAN_VIEW_ALL_KEY)
    localStorage.removeItem(ALLOWED_BRANCHES_KEY)
    bumpBranchEpoch()
    clearAllCaches()
  }, [authLoading, isAuthenticated])

  // Escritura rechazada por el modo consulta (cliente o servidor BRANCH_READ_ONLY): aviso claro, sin duplicar.
  useEffect(() => {
    const onReadOnly = () => toast.warning(READ_ONLY_MESSAGE, { id: 'branch-read-only' })
    window.addEventListener(BRANCH_READ_ONLY_EVENT, onReadOnly)
    return () => window.removeEventListener(BRANCH_READ_ONLY_EVENT, onReadOnly)
  }, [])

  // Contexto: al autenticarse, al volver a la app (foco/visibilidad, con tope) y tras BRANCH_*.
  useEffect(() => {
    if (authLoading || !isAuthenticated || !localStorage.getItem('token')) return
    void refreshContext().catch(() => {})

    const onVisible = () => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - lastRefreshAtRef.current < CONTEXT_REFRESH_MIN_INTERVAL_MS) return
      void refreshContext().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    let branchErrorHandled = false
    const onBranchError = () => {
      if (branchErrorHandled) return
      branchErrorHandled = true
      toast.error('Su acceso a la sucursal cambió. Se actualizó la sucursal activa.', {
        id: 'branch-access-changed',
      })
      void refreshContext()
        .catch(() => {})
        .finally(() => {
          branchErrorHandled = false
        })
    }
    window.addEventListener(BRANCH_ERROR_EVENT, onBranchError)

    // Token renovado tras un 409 SESSION_UPDATED: el rol/asignaciones pudieron cambiar la sucursal activa o
    // los permisos; el contexto se vuelve a pedir (y, si la sucursal cambió, se abre época nueva).
    const onSessionRefreshed = () => void refreshContext().catch(() => {})
    window.addEventListener(SESSION_REFRESHED_EVENT, onSessionRefreshed)

    return () => {
      window.removeEventListener(SESSION_REFRESHED_EVENT, onSessionRefreshed)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener(BRANCH_ERROR_EVENT, onBranchError)
    }
  }, [authLoading, isAuthenticated, refreshContext])

  const value = useMemo(
    () => ({
      activeBranch,
      activeBranchId: activeBranch?.id ?? 0,
      allowedBranches,
      canSwitchBranch,
      canViewAll,
      viewMode,
      isAllBranches: viewMode === 'all',
      setViewMode,
      switching,
      resetEpoch,
      setFromLogin,
      switchBranch,
      refreshContext,
    }),
    [
      activeBranch,
      allowedBranches,
      canSwitchBranch,
      canViewAll,
      viewMode,
      setViewMode,
      switching,
      resetEpoch,
      setFromLogin,
      switchBranch,
      refreshContext,
    ],
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch requiere BranchProvider')
  return ctx
}

/** Ejecuta el efecto solo al cambiar sucursal (no en el montaje inicial). */
export function useOnBranchChange(effect: () => void) {
  const { resetEpoch } = useBranch()
  const skipMount = useRef(true)
  useEffect(() => {
    if (skipMount.current) {
      skipMount.current = false
      return
    }
    effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetEpoch])
}
