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
import { cashbankService, type CashSession } from '@/services/cashbank.service'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import { hasPermission } from '@/utils/restaurantPermissions'

type CashSessionContextValue = {
  session: CashSession | null | undefined
  loading: boolean
  canOperateCash: boolean
  refresh: () => Promise<void>
  openModal: boolean
  setOpenModal: (v: boolean) => void
  openMySession: (openingBalance: number, notes?: string) => Promise<void>
  /** Usuario puede cobrar en efectivo (cajero/admin, no mozo). */
  canChargeCash: boolean
}

const CashSessionContext = createContext<CashSessionContextValue | undefined>(undefined)

export function canChargeCashByRole(employeeType: string, permissions: string[]): boolean {
  const et = employeeType.toLowerCase()
  if (et === 'waiter' || et === 'mozo') return false
  return hasPermission(permissions, 'c.v') || ['cashier', 'admin', 'supervisor'].includes(et)
}

export function CashSessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, token, employeeType, restaurantPermissions } = useAuth()
  const { activeBranchId } = useBranch()
  const canOperateCash = canChargeCashByRole(employeeType, restaurantPermissions)
  const canChargeCash = canOperateCash

  const [session, setSession] = useState<CashSession | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  /** true cuando ya se consultó la caja del usuario en la sucursal activa. */
  const [checkedForBranch, setCheckedForBranch] = useState(false)
  const lastFetchedBranchRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || authLoading) {
      setSession(undefined)
      setCheckedForBranch(false)
      setLoading(false)
      setOpenModal(false)
      return
    }

    if (!activeBranchId || !canOperateCash) {
      setSession(null)
      setCheckedForBranch(true)
      setLoading(false)
      setOpenModal(false)
      lastFetchedBranchRef.current = activeBranchId
      return
    }

    setLoading(true)
    setCheckedForBranch(false)
    try {
      const s = await cashbankService.getOpenSession(activeBranchId)
      const valid =
        s && (s.branch_id === activeBranchId || !s.branch_id) ? s : null
      setSession(valid)
      lastFetchedBranchRef.current = activeBranchId
      if (valid) setOpenModal(false)
    } catch {
      setSession(undefined)
    } finally {
      setCheckedForBranch(true)
      setLoading(false)
    }
  }, [activeBranchId, authLoading, canOperateCash, isAuthenticated, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useOnBranchChange(() => {
    setSession(undefined)
    setCheckedForBranch(false)
    setOpenModal(false)
    void refresh()
  })

  useEffect(() => {
    if (
      !isAuthenticated ||
      authLoading ||
      !canOperateCash ||
      !activeBranchId ||
      loading ||
      !checkedForBranch ||
      lastFetchedBranchRef.current !== activeBranchId
    ) {
      return
    }
    if (session === null) {
      setOpenModal(true)
    } else if (session) {
      setOpenModal(false)
    }
  }, [
    isAuthenticated,
    authLoading,
    canOperateCash,
    activeBranchId,
    loading,
    checkedForBranch,
    session,
  ])

  const openMySession = useCallback(
    async (openingBalance: number, notes?: string) => {
      if (!activeBranchId) {
        toast.error('No hay sucursal activa')
        return
      }
      try {
        const s = await cashbankService.openSession({
          branch_id: activeBranchId,
          opening_balance: openingBalance,
          notes,
        })
        setSession(s)
        setOpenModal(false)
        setCheckedForBranch(true)
        lastFetchedBranchRef.current = activeBranchId
        toast.success('Caja abierta')
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(msg ?? 'No se pudo abrir la caja')
        throw e
      }
    },
    [activeBranchId],
  )

  const value = useMemo(
    () => ({
      session,
      loading,
      canOperateCash,
      refresh,
      openModal,
      setOpenModal,
      openMySession,
      canChargeCash,
    }),
    [session, loading, canOperateCash, refresh, openModal, openMySession, canChargeCash],
  )

  return <CashSessionContext.Provider value={value}>{children}</CashSessionContext.Provider>
}

export function useCashSession() {
  const ctx = useContext(CashSessionContext)
  if (!ctx) throw new Error('useCashSession requiere CashSessionProvider')
  return ctx
}
