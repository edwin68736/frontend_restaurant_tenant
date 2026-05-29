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

const ALLOWED_BRANCHES_KEY = 'allowed_branches'

function readAllowedBranches(): BranchBrief[] {
  try {
    const raw = localStorage.getItem(ALLOWED_BRANCHES_KEY)
    return raw ? (JSON.parse(raw) as BranchBrief[]) : []
  } catch {
    return []
  }
}

type BranchContextValue = {
  activeBranch: BranchBrief | null
  activeBranchId: number
  allowedBranches: BranchBrief[]
  canSwitchBranch: boolean
  resetEpoch: number
  setFromLogin: (branch: BranchBrief | null, canSwitch: boolean, allowed?: BranchBrief[]) => void
  switchBranch: (branchId: number) => Promise<void>
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined)

export function BranchProvider({ children }: { children: ReactNode }) {
  const [activeBranch, setActiveBranch] = useState<BranchBrief | null>(() => {
    try {
      const raw = localStorage.getItem('active_branch')
      return raw ? (JSON.parse(raw) as BranchBrief) : null
    } catch {
      return null
    }
  })
  const [allowedBranches, setAllowedBranches] = useState<BranchBrief[]>(readAllowedBranches)
  const [canSwitchBranch, setCanSwitchBranch] = useState(
    () => localStorage.getItem('can_switch_branch') === 'true',
  )
  const [resetEpoch, setResetEpoch] = useState(0)

  const setFromLogin = useCallback((branch: BranchBrief | null, canSwitch: boolean, allowed?: BranchBrief[]) => {
    setActiveBranch(branch)
    setCanSwitchBranch(canSwitch)
    const list = allowed?.length ? allowed : branch ? [branch] : []
    setAllowedBranches(list)
    if (branch) localStorage.setItem('active_branch', JSON.stringify(branch))
    localStorage.setItem('can_switch_branch', canSwitch ? 'true' : 'false')
    if (list.length) {
      localStorage.setItem(ALLOWED_BRANCHES_KEY, JSON.stringify(list))
    } else {
      localStorage.removeItem(ALLOWED_BRANCHES_KEY)
    }
  }, [])

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const raw = localStorage.getItem('active_branch')
        if (raw) {
          const b = JSON.parse(raw) as BranchBrief
          if (b?.id) setActiveBranch(b)
        }
        setCanSwitchBranch(localStorage.getItem('can_switch_branch') === 'true')
        setAllowedBranches(readAllowedBranches())
      } catch {
        /* ignore */
      }
    }
    syncFromStorage()
    window.addEventListener('tukichef-session-applied', syncFromStorage)
    return () => window.removeEventListener('tukichef-session-applied', syncFromStorage)
  }, [])

  const contextLoaded = useRef(false)
  useEffect(() => {
    if (contextLoaded.current || !localStorage.getItem('token')) return
    contextLoaded.current = true
    sessionService
      .getContext()
      .then((ctx) => {
        if (ctx.active_branch) setActiveBranch(ctx.active_branch)
        setCanSwitchBranch(!!ctx.can_switch_branch)
        if (ctx.allowed_branches?.length) {
          setAllowedBranches(ctx.allowed_branches)
          localStorage.setItem(ALLOWED_BRANCHES_KEY, JSON.stringify(ctx.allowed_branches))
        }
      })
      .catch(() => {
        contextLoaded.current = false
      })
  }, [])

  const switchBranch = useCallback(async (branchId: number) => {
    const res = await sessionService.switchBranch(branchId)
    localStorage.setItem('token', res.token)
    setActiveBranch(res.active_branch)
    setCanSwitchBranch(res.can_switch_branch)
    if (res.allowed_branches?.length) {
      setAllowedBranches(res.allowed_branches)
      localStorage.setItem(ALLOWED_BRANCHES_KEY, JSON.stringify(res.allowed_branches))
    }
    localStorage.setItem('active_branch', JSON.stringify(res.active_branch))
    localStorage.setItem('can_switch_branch', res.can_switch_branch ? 'true' : 'false')
    setResetEpoch((e) => e + 1)
    window.dispatchEvent(new CustomEvent('branch-changed'))
    toast.success(`Local: ${res.active_branch.name}`)
  }, [])

  const value = useMemo(
    () => ({
      activeBranch,
      activeBranchId: activeBranch?.id ?? 0,
      allowedBranches,
      canSwitchBranch,
      resetEpoch,
      setFromLogin,
      switchBranch,
    }),
    [activeBranch, allowedBranches, canSwitchBranch, resetEpoch, setFromLogin, switchBranch],
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
