import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { Wallet, Building2, CreditCard, Plus, X, TrendingUp, TrendingDown, FileText, History, Pencil, Trash2, Download } from 'lucide-react'
import {
  cashbankService,
  type CashSession,
  type CashMovement,
  type BankMovement,
  type BankAccount,
  type PaymentMethodRecord,
  type CashSessionReport,
  type MethodTotal,
} from '@/services/cashbank.service'
import { companyService } from '@/services/company.service'
import { SearchableSelect } from '@/components/SearchableSelect'
import { downloadCajaSessionReportPdf, parseSessionNotesBlock } from '@/utils/cajaSessionReportPdf'
import { downloadCajaSessionReportExcel } from '@/utils/cajaSessionReportExcel'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import {
  canManageCashSettings,
  canViewBankAccountBalances,
  canViewCashSettings,
} from '@/utils/restaurantPermissions'
import { MaskedAccountBalance } from '@/components/cash/MaskedAccountBalance'
import { CashOpenSessionForm } from '@/components/cash/CashOpenSessionForm'
import { CajaMovementsPanel } from '@/components/cash/CajaMovementsPanel'
import { CajaSessionReportsModal } from '@/components/cash/CajaSessionReportsModal'
import { CajaSessionReportView } from '@/components/cash/CajaSessionReportView'
import { useCashSession } from '@/contexts/CashSessionContext'
import { PortalModal } from '@/components/ui/PortalModal'
import { MAX_H_SHEET_PANEL } from '@/utils/safeAreaClasses'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'

const INCOME_CATEGORIES = [
  { value: 'ingreso_manual', label: 'Ingreso manual' },
  { value: 'venta_efectivo', label: 'Venta (efectivo manual)' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'prestamo_cobro', label: 'Cobro de préstamo' },
  { value: 'otro_ingreso', label: 'Otro ingreso' },
]

const EXPENSE_CATEGORIES = [
  { value: 'egreso_manual', label: 'Egreso manual' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'retiro', label: 'Retiro' },
  { value: 'pago_proveedor', label: 'Pago a proveedor' },
  { value: 'prestamo_entrega', label: 'Préstamo entregado' },
  { value: 'otro_egreso', label: 'Otro egreso' },
]

const ARQUEO_DENOMINATIONS = [
  { value: '200', label: 'Billete S/ 200', kind: 'bill' as const },
  { value: '100', label: 'Billete S/ 100', kind: 'bill' as const },
  { value: '50', label: 'Billete S/ 50', kind: 'bill' as const },
  { value: '20', label: 'Billete S/ 20', kind: 'bill' as const },
  { value: '10', label: 'Billete S/ 10', kind: 'bill' as const },
  { value: '5', label: 'Moneda S/ 5', kind: 'coin' as const },
  { value: '2', label: 'Moneda S/ 2', kind: 'coin' as const },
  { value: '1', label: 'Moneda S/ 1', kind: 'coin' as const },
  { value: '0.5', label: 'Moneda S/ 0.50', kind: 'coin' as const },
  { value: '0.2', label: 'Moneda S/ 0.20', kind: 'coin' as const },
  { value: '0.1', label: 'Moneda S/ 0.10', kind: 'coin' as const },
  { value: '0.05', label: 'Moneda S/ 0.05', kind: 'coin' as const },
  { value: '0.01', label: 'Moneda S/ 0.01', kind: 'coin' as const },
] as const

const ARQUEO_BILLS = ARQUEO_DENOMINATIONS.filter((d) => d.kind === 'bill')
const ARQUEO_COINS = ARQUEO_DENOMINATIONS.filter((d) => d.kind === 'coin')

function ArqueoDenominationSection({
  title,
  items,
  values,
  onChangeQty,
}: {
  title: string
  items: readonly (typeof ARQUEO_DENOMINATIONS)[number][]
  values: Record<string, number>
  onChangeQty: (key: string, qty: number) => void
}) {
  return (
    <section className="rounded-xl border border-stone-200 overflow-hidden bg-white">
      <div className="px-3 py-2 border-b border-stone-100 bg-stone-50">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-600">{title}</h4>
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((d) => {
          const qty = values[d.value] ?? 0
          const denom = Number(d.value)
          const amount = qty * denom
          const denomLabel = denom < 1 ? denom.toFixed(2) : d.value
          return (
            <div key={d.value} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-800 truncate">{d.label}</p>
                <p className="text-[11px] text-stone-400">S/ {denomLabel} c/u</p>
              </div>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={qty}
                onChange={(e) => onChangeQty(d.value, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-[4.25rem] shrink-0 rounded-lg border border-stone-200 px-2 py-1.5 text-sm text-right tabular-nums focus:border-rest-400 focus:outline-none focus:ring-2 focus:ring-rest-100"
                aria-label={`Cantidad ${d.label}`}
              />
              <p className="w-[5.5rem] shrink-0 text-right text-sm font-semibold text-stone-800 tabular-nums">
                S/ {amount.toFixed(2)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function emptyArqueo() {
  const out: Record<string, number> = {}
  ARQUEO_DENOMINATIONS.forEach((d) => {
    out[d.value] = 0
  })
  return out
}

function sumArqueo(arqueo: Record<string, number>) {
  return ARQUEO_DENOMINATIONS.reduce((sum, d) => sum + Number(d.value) * (arqueo[d.value] ?? 0), 0)
}

function parseArqueoJson(v: string | null | undefined) {
  if (!v) return emptyArqueo()
  try {
    const obj = JSON.parse(v) as Record<string, number>
    const out = emptyArqueo()
    Object.keys(out).forEach((k) => {
      out[k] = Math.max(0, Math.floor(Number(obj[k]) || 0))
    })
    return out
  } catch {
    return emptyArqueo()
  }
}

const REPORT_SESSION_NOTE_MAX = 72

function cashSessionOpenerLabel(s: CashSession): string {
  const name = (s.opened_by_name ?? '').trim()
  if (name) return name
  if (s.opened_by > 0) return `Usuario #${s.opened_by}`
  return ''
}

/** Etiqueta del select de reporte: fecha/estado, usuario que abrió y nota de apertura. */
function formatReportSessionSelectLabel(s: CashSession, style: 'current' | 'history') {
  const opener = cashSessionOpenerLabel(s)
  const openerPart = opener ? ` · ${opener}` : ''
  const base =
    style === 'current'
      ? `Sesión actual (ID ${s.id})${openerPart}`
      : `${s.opened_at ? new Date(s.opened_at).toLocaleString() : `Sesión ${s.id}`} · ${s.status === 'open' ? 'Abierta' : 'Cerrada'}${openerPart}`
  const opening = parseSessionNotesBlock(s.notes).opening.trim()
  if (!opening) return base
  const short = opening.length > REPORT_SESSION_NOTE_MAX ? `${opening.slice(0, REPORT_SESSION_NOTE_MAX)}…` : opening
  return `${base} - ${short}`
}

/** El modal de métodos solo permite caja o cuenta; normaliza tipos internos del sistema. */
function editablePaymentMethodDestination(
  destinationType: PaymentMethodRecord['destination_type'],
): 'cash' | 'bank_account' {
  return destinationType === 'bank_account' ? 'bank_account' : 'cash'
}

export default function CajaPage() {
  const { user, restaurantPermissions, employeeType } = useAuth()
  const canManageCashConfig = canManageCashSettings(restaurantPermissions, employeeType)
  const canViewCashConfig = canViewCashSettings(restaurantPermissions, employeeType)
  const canViewAccountBalances = canViewBankAccountBalances(employeeType)
  const restrictMovementsToUserId = canManageCashConfig ? undefined : user?.id
  const { activeBranch, activeBranchId } = useBranch()
  const {
    session: contextSession,
    loading: contextSessionLoading,
    refresh: refreshCashContext,
  } = useCashSession()
  const loadGenRef = useRef(0)
  const contextSessionRef = useRef(contextSession)
  const contextSessionLoadingRef = useRef(contextSessionLoading)
  contextSessionRef.current = contextSession
  contextSessionLoadingRef.current = contextSessionLoading
  const [session, setSession] = useState<CashSession | null | undefined>(undefined)
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [sessionSalesByMethod, setSessionSalesByMethod] = useState<MethodTotal[]>([])
  const [sessionTotalSales, setSessionTotalSales] = useState(0)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([])
  const [tab, setTab] = useState<'sesion' | 'movimientos' | 'reporte' | 'config'>('sesion')

  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [closeNotes, setCloseNotes] = useState('')
  const [closeWithArqueo, setCloseWithArqueo] = useState(false)
  const [closeArqueo, setCloseArqueo] = useState<Record<string, number>>(emptyArqueo())
  const [saving, setSaving] = useState(false)

  const [showMov, setShowMov] = useState(false)
  const [movType, setMovType] = useState<'income' | 'expense'>('income')
  const [movForm, setMovForm] = useState({
    category: 'ingreso_manual',
    reference: '',
    amount: 0,
    notes: '',
    payment_method: 'efectivo',
  })

  const [showArqueoModal, setShowArqueoModal] = useState(false)
  const [arqueoDraft, setArqueoDraft] = useState<Record<string, number>>(emptyArqueo())
  const [savingArqueo, setSavingArqueo] = useState(false)

  const [selectedReportSessionId, setSelectedReportSessionId] = useState<number | null>(null)
  const [report, setReport] = useState<CashSessionReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [historyReportsSession, setHistoryReportsSession] = useState<CashSession | null>(null)

  const isSessionOpen = session?.status === 'open'

  const [configTab, setConfigTab] = useState<'accounts' | 'methods'>('accounts')

  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [accountForm, setAccountForm] = useState({
    name: '',
    bank_name: '',
    account_number: '',
    currency: 'PEN',
    type: 'bank',
    payment_method: '',
    initial_balance: 0,
    active: true,
  })

  const [showAccountMovementsModal, setShowAccountMovementsModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([])
  const [loadingBankMovements, setLoadingBankMovements] = useState(false)
  const [savingBankMovement, setSavingBankMovement] = useState(false)
  const [bankMovForm, setBankMovForm] = useState({
    type: 'credit' as 'credit' | 'debit',
    description: '',
    reference: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
  })

  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodRecord | null>(null)
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: '',
    code: '',
    destination_type: 'cash' as 'cash' | 'bank_account',
    bank_account_id: '' as number | '',
    active: true,
  })

  const activePaymentMethods = useMemo(
    () => [...paymentMethods].filter((m) => m.active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [paymentMethods]
  )

  const paymentMethodOptions = useMemo(() => {
    if (activePaymentMethods.length > 0) return activePaymentMethods.map((m) => ({ value: m.code, label: m.name }))
    return [
      { value: 'efectivo', label: 'Efectivo' },
      { value: 'yape', label: 'Yape' },
      { value: 'plin', label: 'Plin' },
      { value: 'tarjeta', label: 'Tarjeta' },
      { value: 'transferencia', label: 'Transferencia' },
    ]
  }, [activePaymentMethods])

  const bankAccountNameById = useMemo(() => {
    const map: Record<number, string> = {}
    for (const a of bankAccounts) map[a.id] = a.name
    return map
  }, [bankAccounts])

  const paymentMethodLabel = (code: string | undefined) =>
    paymentMethodDisplayLabel(code, paymentMethods)

  const openNewAccount = () => {
    setEditingAccount(null)
    setAccountForm({
      name: '',
      bank_name: '',
      account_number: '',
      currency: 'PEN',
      type: 'bank',
      payment_method: '',
      initial_balance: 0,
      active: true,
    })
    setShowAccountModal(true)
  }

  const openEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc)
    setAccountForm({
      name: acc.name || '',
      bank_name: acc.bank_name || '',
      account_number: acc.account_number || '',
      currency: acc.currency || 'PEN',
      type: acc.type || 'bank',
      payment_method: acc.payment_method || '',
      initial_balance: 0,
      active: !!acc.active,
    })
    setShowAccountModal(true)
  }

  const saveAccount = async () => {
    if (!accountForm.name.trim()) { toast.error('Ingresa un nombre'); return }
    if (!accountForm.currency.trim()) { toast.error('Selecciona una moneda'); return }
    setSavingConfig(true)
    try {
      if (editingAccount) {
        await cashbankService.updateBankAccount(editingAccount.id, {
          name: accountForm.name.trim(),
          bank_name: accountForm.bank_name.trim(),
          account_number: accountForm.account_number.trim(),
          type: accountForm.type.trim() || 'bank',
          payment_method: accountForm.payment_method.trim(),
          active: !!accountForm.active,
        })
        toast.success('Cuenta actualizada')
      } else {
        await cashbankService.createBankAccount({
          name: accountForm.name.trim(),
          bank_name: accountForm.bank_name.trim(),
          account_number: accountForm.account_number.trim(),
          currency: accountForm.currency.trim(),
          type: accountForm.type.trim() || 'bank',
          payment_method: accountForm.payment_method.trim(),
          initial_balance: Number(accountForm.initial_balance || 0),
        })
        toast.success('Cuenta creada')
      }
      setShowAccountModal(false)
      await load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSavingConfig(false)
    }
  }

  const openAccountMovements = async (acc: BankAccount) => {
    setSelectedAccount(acc)
    setBankMovements([])
    setBankMovForm({
      type: 'credit',
      description: '',
      reference: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
    })
    setShowAccountMovementsModal(true)
    setLoadingBankMovements(true)
    try {
      const movs = await cashbankService.listBankMovements(acc.id)
      setBankMovements(movs ?? [])
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
      setBankMovements([])
    } finally {
      setLoadingBankMovements(false)
    }
  }

  const addBankMovement = async () => {
    if (!selectedAccount) return
    if (!bankMovForm.description.trim()) { toast.error('Ingresa una descripción'); return }
    if (Number(bankMovForm.amount || 0) <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    if (!bankMovForm.date) { toast.error('Selecciona una fecha'); return }
    setSavingBankMovement(true)
    try {
      await cashbankService.addBankMovement(selectedAccount.id, {
        type: bankMovForm.type,
        description: bankMovForm.description.trim(),
        reference: bankMovForm.reference.trim() || undefined,
        amount: Number(bankMovForm.amount || 0),
        date: bankMovForm.date,
      })
      toast.success(bankMovForm.type === 'credit' ? 'Ingreso registrado' : 'Egreso registrado')
      const [movs] = await Promise.all([cashbankService.listBankMovements(selectedAccount.id), load()])
      setBankMovements(movs ?? [])
      setBankMovForm((f) => ({ ...f, description: '', reference: '', amount: 0 }))
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSavingBankMovement(false)
    }
  }

  const openNewPaymentMethod = () => {
    setEditingPaymentMethod(null)
    setPaymentMethodForm({
      name: '',
      code: '',
      destination_type: 'cash',
      bank_account_id: '',
      active: true,
    })
    setShowPaymentMethodModal(true)
  }

  const openEditPaymentMethod = (pm: PaymentMethodRecord) => {
    setEditingPaymentMethod(pm)
    setPaymentMethodForm({
      name: pm.name || '',
      code: pm.code || '',
      destination_type: editablePaymentMethodDestination(pm.destination_type),
      bank_account_id: pm.bank_account_id ?? '',
      active: !!pm.active,
    })
    setShowPaymentMethodModal(true)
  }

  const savePaymentMethod = async () => {
    if (!paymentMethodForm.name.trim()) { toast.error('Ingresa un nombre'); return }
    if (!paymentMethodForm.code.trim()) { toast.error('Ingresa un código'); return }
    if (paymentMethodForm.destination_type === 'bank_account' && !paymentMethodForm.bank_account_id) {
      toast.error('Selecciona una cuenta')
      return
    }
    setSavingConfig(true)
    try {
      if (editingPaymentMethod) {
        await cashbankService.updatePaymentMethod(editingPaymentMethod.id, {
          name: paymentMethodForm.name.trim(),
          code: paymentMethodForm.code.trim(),
          destination_type: paymentMethodForm.destination_type,
          bank_account_id:
            paymentMethodForm.destination_type === 'bank_account' ? Number(paymentMethodForm.bank_account_id) : null,
          active: !!paymentMethodForm.active,
        })
        toast.success('Método actualizado')
      } else {
        await cashbankService.createPaymentMethod({
          name: paymentMethodForm.name.trim(),
          code: paymentMethodForm.code.trim(),
          destination_type: paymentMethodForm.destination_type,
          bank_account_id:
            paymentMethodForm.destination_type === 'bank_account' ? Number(paymentMethodForm.bank_account_id) : null,
        })
        toast.success('Método creado')
      }
      setShowPaymentMethodModal(false)
      await load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSavingConfig(false)
    }
  }

  const deletePaymentMethod = async (pm: PaymentMethodRecord) => {
    const ok = window.confirm(`¿Eliminar el método "${pm.name}"?`)
    if (!ok) return
    setSavingConfig(true)
    try {
      await cashbankService.deletePaymentMethod(pm.id)
      toast.success('Método eliminado')
      await load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSavingConfig(false)
    }
  }

  const load = useCallback(async () => {
    if (!activeBranchId) return
    const gen = ++loadGenRef.current
    setLoading(true)
    try {
      const ctx = contextSessionRef.current
      const ctxLoading = contextSessionLoadingRef.current
      const useContextSession =
        !ctxLoading &&
        ctx !== undefined &&
        (ctx === null || ctx.branch_id === activeBranchId || !ctx.branch_id)

      const openSessionPromise = useContextSession
        ? Promise.resolve(ctx)
        : cashbankService.getOpenSession(activeBranchId)

      const [sessR, histR, baR, pmR] = await Promise.allSettled([
        openSessionPromise,
        cashbankService.listSessions(activeBranchId),
        canViewCashConfig ? cashbankService.listBankAccounts(true) : Promise.resolve([] as BankAccount[]),
        canViewCashConfig ? cashbankService.listPaymentMethods(true) : Promise.resolve([] as PaymentMethodRecord[]),
      ])

      if (gen !== loadGenRef.current) return

      const sess = sessR.status === 'fulfilled' ? sessR.value : null
      const hist = histR.status === 'fulfilled' ? histR.value : []
      const ba = baR.status === 'fulfilled' ? baR.value : []
      const pm = pmR.status === 'fulfilled' ? pmR.value : []

      if (histR.status === 'rejected') toast.error('No se pudo cargar el historial de sesiones')
      if (baR.status === 'rejected' && canViewCashConfig) toast.error('No se pudieron cargar las cuentas')
      if (pmR.status === 'rejected' && canViewCashConfig) toast.error('No se pudieron cargar los métodos de pago')

      setSession(sess ?? null)
      setSessions(hist ?? [])
      setBankAccounts(ba ?? [])
      setPaymentMethods(pm ?? [])
      if (sess?.id != null) {
        const [movs, rep] = await Promise.all([
          cashbankService.listMovements(sess.id),
          cashbankService.getSessionReport(sess.id).catch(() => null),
        ])
        if (gen !== loadGenRef.current) return
        setMovements(movs ?? [])
        setSessionSalesByMethod(rep?.totals_by_method?.sales ?? [])
        setSessionTotalSales(Number(rep?.totals?.total_sales ?? 0))
      } else {
        setMovements([])
        setSessionSalesByMethod([])
        setSessionTotalSales(0)
      }
    } catch {
      if (gen === loadGenRef.current) toast.error('Error al cargar')
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [activeBranchId, canViewCashConfig])

  useEffect(() => {
    if (!activeBranchId) return
    void load()
  }, [activeBranchId, load])

  useEffect(() => {
    if (contextSessionLoading) return
    if (contextSession === undefined) return
    const valid =
      contextSession && (contextSession.branch_id === activeBranchId || !contextSession.branch_id)
        ? contextSession
        : null
    setSession(valid)
  }, [contextSession, contextSessionLoading, activeBranchId])

  const movementSessionOptions = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        label: s.opened_at
          ? `${new Date(s.opened_at).toLocaleString()} · ${s.status === 'open' ? 'Abierta' : 'Cerrada'}`
          : `Sesión ${s.id}`,
      })),
    [sessions],
  )

  useOnBranchChange(() => {
    setSession(null)
    setMovements([])
    setReport(null)
    setOpenModal(false)
    setCloseModal(false)
    if (activeBranchId) void load()
  })

  useEffect(() => {
    if (session?.id != null && selectedReportSessionId == null) setSelectedReportSessionId(session.id)
  }, [session?.id, selectedReportSessionId])

  const { totalIncome, totalExpense, currentBalance } = useMemo(() => {
    const opening = Number(session?.opening_balance ?? 0)
    let income = 0
    let expense = 0
    movements.forEach((m) => {
      if (m.type === 'income') income += Number(m.amount || 0)
      else expense += Number(m.amount || 0)
    })
    return { totalIncome: income, totalExpense: expense, currentBalance: opening + income - expense }
  }, [movements, session?.opening_balance])

  const handleOpenSession = async (openingBalance: number, notes?: string) => {
    if (!activeBranchId) {
      toast.error('No hay sucursal activa')
      return
    }
    setSaving(true)
    try {
      await cashbankService.openSession({
        branch_id: activeBranchId,
        opening_balance: openingBalance,
        notes,
      })
      toast.success('Caja abierta')
      setOpenModal(false)
      await load()
      await refreshCashContext()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const handleCloseSession = async () => {
    if (!session) return
    setSaving(true)
    try {
      const balance = closeWithArqueo ? sumArqueo(closeArqueo) : currentBalance
      const payload: { closing_balance: number; notes?: string; arqueo?: Record<string, number> } = {
        closing_balance: Number(balance || 0),
        notes: closeNotes || undefined,
      }
      if (closeWithArqueo) {
        const hasAny = ARQUEO_DENOMINATIONS.some((d) => (closeArqueo[d.value] ?? 0) > 0)
        if (hasAny) payload.arqueo = closeArqueo
      }
      await cashbankService.closeSession(session.id, payload)
      toast.success('Caja cerrada')
      setCloseModal(false)
      setCloseNotes('')
      setCloseWithArqueo(false)
      setCloseArqueo(emptyArqueo())
      setReport(null)
      await load()
      await refreshCashContext()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMovement = async () => {
    if (!session) return
    if (!movForm.category) { toast.error('Selecciona una categoría'); return }
    if (Number(movForm.amount || 0) <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    setSaving(true)
    try {
      await cashbankService.addMovement(session.id, {
        type: movType,
        category: movForm.category,
        reference: movForm.reference || undefined,
        payment_method: movForm.payment_method || undefined,
        amount: Number(movForm.amount || 0),
        notes: movForm.notes || undefined,
      })
      toast.success(movType === 'income' ? 'Ingreso registrado' : 'Egreso registrado')
      setShowMov(false)
      setMovForm((f) => ({ ...f, reference: '', amount: 0, notes: '' }))
      await load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveArqueo = async () => {
    if (!session) return
    setSavingArqueo(true)
    try {
      await cashbankService.saveArqueo(session.id, arqueoDraft)
      toast.success('Arqueo guardado')
      setShowArqueoModal(false)
      await load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSavingArqueo(false)
    }
  }

  const loadReport = async (id: number) => {
    setLoadingReport(true)
    try {
      const rep = await cashbankService.getSessionReport(id)
      setReport(rep ?? null)
      toast.success(
        'Reporte generado correctamente. Los datos se muestran abajo. Si exportas a PDF, el archivo se guardará en la carpeta de descargas de tu navegador (por ejemplo «Descargas» en Windows o «Downloads» en macOS), según lo que tengas configurado.',
        { duration: 6500 }
      )
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
      setReport(null)
    } finally {
      setLoadingReport(false)
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cajaTabs = [
    { key: 'sesion' as const, label: 'Sesión', icon: Wallet },
    { key: 'movimientos' as const, label: 'Movimientos', icon: TrendingUp },
    { key: 'reporte' as const, label: 'Reporte', icon: FileText },
    { key: 'config' as const, label: 'Cuentas y métodos', icon: CreditCard },
  ]

  return (
    <div className="w-full flex flex-col">
      <div className="mb-3 border-b border-stone-200/80 pb-2">
        <div className="mb-2">
          <h2 className="text-lg font-bold text-stone-800">Caja</h2>
          <p className="text-sm text-stone-500 hidden sm:block">Apertura/cierre, arqueo, movimientos y reporte de caja</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin" role="tablist" aria-label="Secciones de caja">
          {cajaTabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`shrink-0 px-3 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 ${
                  active ? 'bg-rest-600 text-white border-rest-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pb-1">
      {tab === 'sesion' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <Wallet size={18} />
              Sesión de caja
            </h3>
            {isSessionOpen && session ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-xs text-stone-500">Monto inicial</p>
                    <p className="text-lg font-bold text-stone-800">S/ {Number(session.opening_balance).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-xs text-stone-500">Ingresos efectivo (caja física)</p>
                    <p className="text-lg font-bold text-green-700">S/ {Number(totalIncome).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-xs text-stone-500">Egresos de caja</p>
                    <p className="text-lg font-bold text-red-600">S/ {Number(totalExpense).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-xs text-stone-500">Ventas cobradas (todos los medios)</p>
                    <p className="text-lg font-bold text-stone-900">S/ {Number(sessionTotalSales).toFixed(2)}</p>
                  </div>
                </div>

                {sessionSalesByMethod.length > 0 && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                    <p className="text-xs font-semibold text-stone-700 mb-2">Desglose de ventas por método</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                      {sessionSalesByMethod.map((x) => (
                        <li key={x.method} className="flex justify-between text-sm gap-2">
                          <span className="text-stone-600">{paymentMethodLabel(x.method)}</span>
                          <span className="font-semibold text-stone-800 tabular-nums">S/ {Number(x.total).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(() => {
                  const sn = parseSessionNotesBlock(session.notes)
                  if (!sn.opening && !sn.closing) return null
                  return (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Notas de la sesión</p>
                      {sn.opening ? (
                        <div>
                          <p className="text-xs text-stone-500">Apertura</p>
                          <p className="text-sm text-stone-800 whitespace-pre-wrap">{sn.opening}</p>
                        </div>
                      ) : null}
                      {sn.closing ? (
                        <div>
                          <p className="text-xs text-stone-500">Cierre</p>
                          <p className="text-sm text-stone-800 whitespace-pre-wrap">{sn.closing}</p>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}

                <div className="rounded-xl border border-stone-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-500">Saldo actual en caja (efectivo)</p>
                    <p className="text-xl font-bold text-stone-900">S/ {Number(currentBalance).toFixed(2)}</p>
                    <p className="text-xs text-stone-500">
                      Abierta: {session.opened_at ? new Date(session.opened_at).toLocaleString() : '—'}
                      {session.branch_name ? ` · ${session.branch_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMovType('income')
                        const defaultMethod = paymentMethodOptions[0]?.value ?? 'efectivo'
                        setMovForm({ category: 'ingreso_manual', reference: '', amount: 0, notes: '', payment_method: defaultMethod })
                        setShowMov(true)
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:opacity-90 flex items-center gap-2"
                    >
                      <TrendingUp size={16} />
                      Ingreso
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMovType('expense')
                        const defaultMethod = paymentMethodOptions[0]?.value ?? 'efectivo'
                        setMovForm({ category: 'egreso_manual', reference: '', amount: 0, notes: '', payment_method: defaultMethod })
                        setShowMov(true)
                      }}
                      className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:opacity-90 flex items-center gap-2"
                    >
                      <TrendingDown size={16} />
                      Egreso
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setArqueoDraft(session.arqueo_json ? parseArqueoJson(session.arqueo_json) : emptyArqueo())
                        setShowArqueoModal(true)
                      }}
                      className="px-3 py-2 border border-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 flex items-center gap-2"
                    >
                      <Wallet size={16} />
                      Arqueo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCloseNotes('')
                        setCloseArqueo(session.arqueo_json ? parseArqueoJson(session.arqueo_json) : emptyArqueo())
                        setCloseWithArqueo(!!session.arqueo_json)
                        setCloseModal(true)
                      }}
                      className="px-3 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:opacity-90"
                    >
                      Cerrar caja
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-stone-500">No hay sesión de caja abierta.</p>
                  <p className="text-xs text-stone-400">Abra la caja para registrar ventas, ingresos/egresos, arqueo y reporte.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
                >
                  <Plus size={16} /> Aperturar caja
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <History size={18} />
              {canManageCashConfig ? 'Historial de sesiones' : 'Mi historial de sesiones'}
            </h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-stone-400">Sin historial.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead className="bg-stone-50">
                    <tr>
                      {['Apertura', 'Cierre', 'Aperturó', 'Cerró', 'Inicial', 'Ingresos', 'Egresos', 'Saldo cierre', 'Estado', ''].map((h) => (
                        <th key={h || 'actions'} className="text-left px-3 py-2 text-xs font-semibold text-stone-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-stone-100">
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{s.opened_at ? new Date(s.opened_at).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{s.closed_at ? new Date(s.closed_at).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-xs text-stone-700">{s.opened_by_name || '—'}</td>
                        <td className="px-3 py-2 text-xs text-stone-700">{s.closed_by_name || '—'}</td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">S/ {Number(s.opening_balance).toFixed(2)}</td>
                        <td className="px-3 py-2 text-green-700 font-medium whitespace-nowrap">
                          S/ {Number(s.total_income ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-red-600 font-medium whitespace-nowrap">
                          S/ {Number(s.total_expense ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          {s.closing_balance != null ? `S/ ${Number(s.closing_balance).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {s.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setHistoryReportsSession(s)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 hover:bg-stone-50 whitespace-nowrap"
                          >
                            Reportes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'movimientos' && activeBranchId && (
        <div className="space-y-4">
          {isSessionOpen && session && (
            <div className="bg-white rounded-2xl border border-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-800">Sesión abierta (ID {session.id})</p>
                <p className="text-xs text-stone-500">
                  {movements.length} movimiento(s) físicos en caja · ventas electrónicas en la tabla inferior
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMovType('income')
                    const defaultMethod = paymentMethodOptions[0]?.value ?? 'efectivo'
                    setMovForm({ category: 'ingreso_manual', reference: '', amount: 0, notes: '', payment_method: defaultMethod })
                    setShowMov(true)
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:opacity-90"
                >
                  + Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovType('expense')
                    const defaultMethod = paymentMethodOptions[0]?.value ?? 'efectivo'
                    setMovForm({ category: 'egreso_manual', reference: '', amount: 0, notes: '', payment_method: defaultMethod })
                    setShowMov(true)
                  }}
                  className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:opacity-90"
                >
                  - Egreso
                </button>
              </div>
            </div>
          )}
          <CajaMovementsPanel
            branchId={activeBranchId}
            paymentMethods={paymentMethods}
            sessionOptions={movementSessionOptions}
            restrictToUserId={restrictMovementsToUserId}
            defaultSessionId={session?.id ?? selectedReportSessionId}
          />
        </div>
      )}

      {tab === 'reporte' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="w-full sm:max-w-md">
                <label className="block text-xs font-medium text-stone-600 mb-1">Sesión</label>
                <SearchableSelect
                  value={selectedReportSessionId ?? null}
                  onChange={(v) => {
                    const id = v == null || String(v) === '' ? null : Number(v)
                    setSelectedReportSessionId(id)
                    setReport(null)
                  }}
                  options={[
                    ...(session?.id != null
                      ? [
                          {
                            value: session.id,
                            label: formatReportSessionSelectLabel(
                              sessions.find((s) => s.id === session.id) ?? session,
                              'current',
                            ),
                          },
                        ]
                      : []),
                    ...sessions
                      .filter((s) => s.id !== session?.id)
                      .map((s) => ({
                        value: s.id,
                        label: formatReportSessionSelectLabel(s, 'history'),
                      })),
                  ]}
                  placeholder="Selecciona una sesión"
                  searchable={sessions.length > 8}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!selectedReportSessionId || loadingReport}
                  onClick={() => selectedReportSessionId && loadReport(selectedReportSessionId)}
                  className="px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {loadingReport ? 'Generando...' : 'Generar reporte'}
                </button>
                <button
                  type="button"
                  disabled={!report || loadingReport}
                  onClick={async () => {
                    if (!report) return
                    try {
                      const cfg = await companyService.getConfig()
                      downloadCajaSessionReportPdf(report, { companyName: cfg.business_name })
                    } catch {
                      downloadCajaSessionReportPdf(report)
                    }
                    toast.success(
                      'PDF descargado. Búscalo en la carpeta de descargas de tu navegador (normalmente «Descargas» / «Downloads»).',
                      { duration: 5000 }
                    )
                  }}
                  className="px-4 py-2 border border-stone-300 bg-white text-stone-800 rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 hover:bg-stone-50"
                >
                  <Download size={16} />
                  Exportar PDF
                </button>
                <button
                  type="button"
                  disabled={!report || loadingReport}
                  onClick={async () => {
                    if (!report) return
                    try {
                      const cfg = await companyService.getConfig().catch(() => null)
                      await downloadCajaSessionReportExcel(report, {
                        companyName: cfg?.business_name,
                      })
                      toast.success(
                        'Excel descargado. Búscalo en la carpeta de descargas de tu navegador (normalmente «Descargas» / «Downloads»).',
                        { duration: 5000 },
                      )
                    } catch {
                      toast.error('No se pudo generar el Excel')
                    }
                  }}
                  className="px-4 py-2 border border-stone-300 bg-white text-stone-800 rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 hover:bg-stone-50"
                >
                  <Download size={16} />
                  Exportar Excel
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            {!report ? (
              <p className="text-sm text-stone-400">{loadingReport ? 'Cargando reporte...' : 'Seleccione una sesión y genere el reporte.'}</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-stone-200 p-3 bg-stone-50/50 text-sm">
                  <p className="font-semibold text-stone-800">{report.session.branch_name || 'Sucursal'}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    Apertura: {report.session.opened_at ? new Date(report.session.opened_at).toLocaleString() : '—'}
                    {' · '}
                    Cierre: {report.session.closed_at ? new Date(report.session.closed_at).toLocaleString() : '—'}
                    {' · '}
                    {report.session.opened_by_user_name || '—'}
                  </p>
                  <p className="text-xs text-stone-500 mt-2">
                    Resumen consolidado de la sesión. El saldo físico solo incluye efectivo; los medios electrónicos se reportan aparte.
                  </p>
                </div>
                <CajaSessionReportView report={report} paymentMethods={paymentMethods} />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'config' && canViewCashConfig && (
        <div className="space-y-6">
          {!canManageCashConfig && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Configuración global del restaurante (solo lectura). Para crear o editar cuentas y métodos, contacte a un supervisor.
            </div>
          )}
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="inline-flex rounded-xl border border-stone-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setConfigTab('accounts')}
                className={`px-4 py-2 text-sm font-semibold ${configTab === 'accounts' ? 'bg-rest-600 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'}`}
              >
                Cuentas
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('methods')}
                className={`px-4 py-2 text-sm font-semibold ${configTab === 'methods' ? 'bg-rest-600 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'}`}
              >
                Métodos
              </button>
            </div>
          </div>

          {configTab === 'accounts' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                  <Building2 size={18} />
                  Cuentas (bancos / billeteras / caja)
                </h3>
                {canManageCashConfig && (
                  <button
                    type="button"
                    onClick={openNewAccount}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90"
                  >
                    <Plus size={16} />
                    Nueva
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 mb-4">
                {canManageCashConfig
                  ? 'Crea cuentas para banco, billetera móvil (Yape/Plin) o caja efectivo. Se usan como destino de métodos de pago.'
                  : 'Cuentas compartidas del restaurante. Solo consulta; la edición la realiza un supervisor.'}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-stone-50">
                    <tr>
                      {(canManageCashConfig
                        ? ['Nombre', 'Tipo', 'Método vinculado', 'Saldo', 'Estado', 'Acciones']
                        : ['Nombre', 'Tipo', 'Método vinculado', 'Saldo', 'Estado']
                      ).map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.length === 0 && (
                      <tr>
                        <td colSpan={canManageCashConfig ? 6 : 5} className="px-4 py-10 text-center text-sm text-stone-400">
                          No hay cuentas registradas.
                        </td>
                      </tr>
                    )}
                    {bankAccounts
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((a) => {
                        const typeLabel = a.type === 'cash' ? 'Caja (efectivo)' : a.type === 'wallet' ? 'Billetera' : 'Banco'
                        return (
                          <tr key={a.id} className="border-b border-stone-100">
                            <td className="px-4 py-2">
                              <p className="font-semibold text-stone-800">{a.name}</p>
                              <p className="text-xs text-stone-500">
                                {[a.bank_name, a.account_number].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-2 text-stone-700">{typeLabel}</td>
                            <td className="px-4 py-2 text-stone-700">{a.payment_method ? paymentMethodLabel(a.payment_method) : '—'}</td>
                            <td className="px-4 py-2">
                              <MaskedAccountBalance
                                currency={a.currency}
                                balance={a.balance}
                                visible={canViewAccountBalances}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-700'}`}>
                                {a.active ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            {canManageCashConfig && (
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditAccount(a)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-semibold"
                                  >
                                    <Pencil size={14} />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAccountMovements(a)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-semibold"
                                  >
                                    Movimientos
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {configTab === 'methods' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                  <CreditCard size={18} />
                  Métodos de pago
                </h3>
                {canManageCashConfig && (
                  <button
                    type="button"
                    onClick={openNewPaymentMethod}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90"
                  >
                    <Plus size={16} />
                    Nuevo
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 mb-4">
                {canManageCashConfig
                  ? 'Vincula cada método de pago a una cuenta (banco/billetera) o a la caja (efectivo).'
                  : 'Métodos de pago del restaurante (solo lectura).'}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[920px]">
                  <thead className="bg-stone-50">
                    <tr>
                      {(canManageCashConfig
                        ? ['Nombre', 'Código', 'Destino', 'Estado', 'Acciones']
                        : ['Nombre', 'Código', 'Destino', 'Estado']
                      ).map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paymentMethods.length === 0 && (
                      <tr>
                        <td colSpan={canManageCashConfig ? 5 : 4} className="px-4 py-10 text-center text-sm text-stone-400">
                          No hay métodos configurados.
                        </td>
                      </tr>
                    )}
                    {paymentMethods
                      .slice()
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((m) => {
                        const destinationLabel =
                          m.destination_type === 'bank_account'
                            ? bankAccountNameById[m.bank_account_id ?? 0] || 'Cuenta'
                            : 'Caja (efectivo)'
                        return (
                          <tr key={m.id} className="border-b border-stone-100">
                            <td className="px-4 py-2 font-semibold text-stone-800">{m.name}</td>
                            <td className="px-4 py-2 text-stone-700">{m.code}</td>
                            <td className="px-4 py-2 text-stone-700">
                              {m.destination_type === 'bank_account' ? `Cuenta: ${destinationLabel}` : destinationLabel}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-700'}`}>
                                {m.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            {canManageCashConfig && (
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditPaymentMethod(m)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-semibold"
                                  >
                                    <Pencil size={14} />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deletePaymentMethod(m)}
                                    disabled={savingConfig}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-red-700 disabled:opacity-50"
                                  >
                                    <Trash2 size={14} />
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      </div>

      <PortalModal open={showAccountModal} onClose={() => setShowAccountModal(false)} className="max-w-xl">
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">{editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
              <button type="button" onClick={() => setShowAccountModal(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">Nombre</label>
                <input
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. BCP - Cuenta Corriente / Yape / Caja Efectivo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Tipo</label>
                <SearchableSelect
                  value={accountForm.type}
                  onChange={(v) => setAccountForm((f) => ({ ...f, type: String(v) }))}
                  options={[
                    { value: 'bank', label: 'Banco' },
                    { value: 'wallet', label: 'Billetera' },
                    { value: 'cash', label: 'Caja (efectivo)' },
                  ]}
                  searchable={false}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Moneda</label>
                <SearchableSelect
                  value={accountForm.currency}
                  onChange={(v) => setAccountForm((f) => ({ ...f, currency: String(v) }))}
                  disabled={!!editingAccount}
                  options={[
                    { value: 'PEN', label: 'PEN' },
                    { value: 'USD', label: 'USD' },
                  ]}
                  searchable={false}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-stone-50 text-left flex items-center justify-between gap-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Banco (opcional)</label>
                <input
                  value={accountForm.bank_name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, bank_name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. BCP"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">N° cuenta / teléfono (opcional)</label>
                <input
                  value={accountForm.account_number}
                  onChange={(e) => setAccountForm((f) => ({ ...f, account_number: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. 123-456 / 999999999"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">Método vinculado (opcional)</label>
                <SearchableSelect
                  value={accountForm.payment_method}
                  onChange={(v) => setAccountForm((f) => ({ ...f, payment_method: String(v ?? '') }))}
                  options={[
                    { value: '', label: 'Sin vincular' },
                    ...paymentMethods
                      .filter((m) => m.active)
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((m) => ({ value: m.code, label: `${m.name} (${m.code})` })),
                  ]}
                  searchable={paymentMethods.length > 8}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>

              {!editingAccount && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Saldo inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={accountForm.initial_balance}
                    onChange={(e) => setAccountForm((f) => ({ ...f, initial_balance: Number(e.target.value) || 0 }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              )}

              {editingAccount && (
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={accountForm.active}
                      onChange={(e) => setAccountForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Activa
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setShowAccountModal(false)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveAccount}
                disabled={savingConfig}
                className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {savingConfig ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
      </PortalModal>

      <PortalModal open={showPaymentMethodModal} onClose={() => setShowPaymentMethodModal(false)} className="max-w-xl">
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">{editingPaymentMethod ? 'Editar método' : 'Nuevo método'}</h3>
              <button type="button" onClick={() => setShowPaymentMethodModal(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">Nombre</label>
                <input
                  value={paymentMethodForm.name}
                  onChange={(e) => setPaymentMethodForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. Yape, Plin, Tarjeta, Transferencia"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Código</label>
                <input
                  value={paymentMethodForm.code}
                  onChange={(e) => setPaymentMethodForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. yape, plin, efectivo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Destino</label>
                <SearchableSelect
                  value={paymentMethodForm.destination_type}
                  onChange={(v) =>
                    setPaymentMethodForm((f) => ({ ...f, destination_type: v as 'cash' | 'bank_account', bank_account_id: '' }))
                  }
                  options={[
                    { value: 'cash', label: 'Caja (efectivo)' },
                    { value: 'bank_account', label: 'Cuenta (banco/billetera)' },
                  ]}
                  searchable={false}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>

              {paymentMethodForm.destination_type === 'bank_account' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">Cuenta</label>
                  <SearchableSelect
                    value={paymentMethodForm.bank_account_id ?? ''}
                    onChange={(v) => setPaymentMethodForm((f) => ({ ...f, bank_account_id: v ? Number(v) : '' }))}
                    options={[
                      { value: '', label: 'Selecciona una cuenta' },
                      ...bankAccounts
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((a) => ({ value: a.id, label: a.name })),
                    ]}
                    searchable
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
              )}

              {editingPaymentMethod && (
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={paymentMethodForm.active}
                      onChange={(e) => setPaymentMethodForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Activo
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setShowPaymentMethodModal(false)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePaymentMethod}
                disabled={savingConfig}
                className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {savingConfig ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
      </PortalModal>

      <PortalModal
        open={showAccountMovementsModal && !!selectedAccount}
        onClose={() => {
          setShowAccountMovementsModal(false)
          setSelectedAccount(null)
          setBankMovements([])
        }}
        className="max-w-4xl"
      >
        {selectedAccount && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-stone-800">Movimientos — {selectedAccount.name}</h3>
                <p className="text-xs text-stone-500 flex items-center gap-1.5">
                  <span>Saldo:</span>
                  <MaskedAccountBalance
                    currency={selectedAccount.currency}
                    balance={selectedAccount.balance}
                    visible={canViewAccountBalances}
                    className="font-semibold"
                  />
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAccountMovementsModal(false)
                  setSelectedAccount(null)
                  setBankMovements([])
                }}
                className="p-1 rounded-lg hover:bg-stone-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Tipo</label>
                <SearchableSelect
                  value={bankMovForm.type}
                  onChange={(v) => setBankMovForm((f) => ({ ...f, type: v as 'credit' | 'debit' }))}
                  options={[
                    { value: 'credit', label: 'Ingreso' },
                    { value: 'debit', label: 'Egreso' },
                  ]}
                  searchable={false}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={bankMovForm.date}
                  onChange={(e) => setBankMovForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={bankMovForm.amount}
                  onChange={(e) => setBankMovForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addBankMovement}
                  disabled={savingBankMovement}
                  className="w-full px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {savingBankMovement ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">Descripción</label>
                <input
                  value={bankMovForm.description}
                  onChange={(e) => setBankMovForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. Depósito, retiro, comisión, etc."
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">Referencia (opcional)</label>
                <input
                  value={bankMovForm.reference}
                  onChange={(e) => setBankMovForm((f) => ({ ...f, reference: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. N° operación"
                />
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
                <p className="text-sm font-semibold text-stone-800">Historial</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-white">
                    <tr>
                      {['Fecha', 'Tipo', 'Descripción', 'Referencia', 'Monto'].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-stone-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingBankMovements && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-400">
                          Cargando...
                        </td>
                      </tr>
                    )}
                    {!loadingBankMovements && bankMovements.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-400">
                          Sin movimientos.
                        </td>
                      </tr>
                    )}
                    {!loadingBankMovements &&
                      bankMovements.map((m) => (
                        <tr key={m.id} className="border-t border-stone-100">
                          <td className="px-4 py-2 text-xs whitespace-nowrap">{m.date ? new Date(m.date).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {m.type === 'credit' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-stone-700">{m.description}</td>
                          <td className="px-4 py-2 text-stone-600">{m.reference || '—'}</td>
                          <td className={`px-4 py-2 font-bold whitespace-nowrap ${m.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                            {m.type === 'credit' ? '+' : '-'} {selectedAccount.currency} {Number(m.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </PortalModal>

      <PortalModal open={openModal} onClose={() => setOpenModal(false)} className="max-w-md" overlayClassName="items-end sm:items-center">
          <div className={clsx('bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full p-5 overflow-y-auto', MAX_H_SHEET_PANEL)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-stone-800 text-lg">Abrir caja</h3>
              <button type="button" onClick={() => setOpenModal(false)} className="p-2 rounded-xl hover:bg-stone-100 touch-manipulation">
                <X size={20} />
              </button>
            </div>
            <CashOpenSessionForm
              branchName={activeBranch?.name}
              saving={saving}
              showLater={false}
              cancelLabel="Cancelar"
              onCancel={() => setOpenModal(false)}
              onSubmit={handleOpenSession}
            />
          </div>
      </PortalModal>

      <PortalModal open={closeModal && !!session} onClose={() => setCloseModal(false)} className="max-w-2xl">
        {session && (() => {
          const arqueoTotal = sumArqueo(closeArqueo)
          const closingAmount = closeWithArqueo ? arqueoTotal : currentBalance
          const diff = closeWithArqueo ? arqueoTotal - currentBalance : 0
          const diffOk = !closeWithArqueo || Math.abs(diff) < 0.01
          const diffClass = diffOk ? 'text-emerald-700' : diff > 0 ? 'text-emerald-700' : 'text-red-700'

          return (
            <div className="flex max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-lg font-bold text-stone-800">Cerrar caja</h3>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Revise el resumen de la sesión. Puede cerrar con arqueo para registrar el efectivo contado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCloseModal(false)}
                  className="shrink-0 rounded-lg p-1.5 hover:bg-stone-100"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-stone-100 bg-stone-50/60 px-4 py-3 sm:grid-cols-3 sm:px-5">
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Monto inicial</p>
                  <p className="mt-0.5 text-lg font-bold text-stone-800 tabular-nums">S/ {Number(session.opening_balance).toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Saldo esperado</p>
                  <p className="mt-0.5 text-lg font-bold text-stone-900 tabular-nums">S/ {Number(currentBalance).toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    {closeWithArqueo ? 'Total contado' : 'Monto de cierre'}
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-stone-900 tabular-nums">S/ {Number(closingAmount).toFixed(2)}</p>
                  {closeWithArqueo && (
                    <p className={`mt-0.5 text-[10px] tabular-nums ${diffClass}`}>
                      {diffOk
                        ? 'Cuadrado con el saldo esperado'
                        : `${diff > 0 ? 'Sobra' : 'Falta'} S/ ${Math.abs(diff).toFixed(2)}`}
                    </p>
                  )}
                  {!closeWithArqueo && (
                    <p className="mt-0.5 text-[10px] text-stone-400">Sin arqueo (saldo del sistema)</p>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-b border-stone-100 px-4 py-3 sm:px-5">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={closeWithArqueo}
                    onChange={(e) => setCloseWithArqueo(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-rest-600 focus:ring-rest-500"
                  />
                  Cerrar con arqueo (recomendado)
                </label>
              </div>

              {closeWithArqueo && (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <ArqueoDenominationSection
                      title="Billetes"
                      items={ARQUEO_BILLS}
                      values={closeArqueo}
                      onChangeQty={(key, qty) => setCloseArqueo((a) => ({ ...a, [key]: qty }))}
                    />
                    <ArqueoDenominationSection
                      title="Monedas"
                      items={ARQUEO_COINS}
                      values={closeArqueo}
                      onChangeQty={(key, qty) => setCloseArqueo((a) => ({ ...a, [key]: qty }))}
                    />
                  </div>
                </div>
              )}

              <div className="shrink-0 border-t border-stone-200 px-4 py-4 sm:px-5">
                <label className="block text-xs font-medium text-stone-600 mb-1">Notas de cierre (opcional)</label>
                <input
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  placeholder="Arqueo, observaciones"
                />
              </div>

              <div className="flex shrink-0 gap-2 border-t border-stone-200 bg-white px-4 py-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setCloseModal(false)}
                  className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCloseSession}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {saving ? 'Cerrando...' : 'Cerrar caja'}
                </button>
              </div>
            </div>
          )
        })()}
      </PortalModal>

      <PortalModal open={showMov && !!session} onClose={() => setShowMov(false)} className="max-w-sm">
        {session && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">{movType === 'income' ? 'Registrar ingreso' : 'Registrar egreso'}</h3>
              <button type="button" onClick={() => setShowMov(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Categoría</label>
                <SearchableSelect
                  value={movForm.category}
                  onChange={(v) => setMovForm((f) => ({ ...f, category: String(v) }))}
                  options={(movType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => ({ value: c.value, label: c.label }))}
                  searchable={false}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Método</label>
                  <SearchableSelect
                    value={movForm.payment_method}
                    onChange={(v) => setMovForm((f) => ({ ...f, payment_method: String(v) }))}
                    options={paymentMethodOptions.map((m) => ({ value: m.value, label: m.label }))}
                    searchable={paymentMethodOptions.length > 8}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Monto (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={movForm.amount}
                    onChange={(e) => setMovForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Referencia (opcional)</label>
                <input
                  value={movForm.reference}
                  onChange={(e) => setMovForm((f) => ({ ...f, reference: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej. Compra insumos / retiro / etc."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notas (opcional)</label>
                <input
                  value={movForm.notes}
                  onChange={(e) => setMovForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setShowMov(false)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddMovement}
                disabled={saving}
                className={`flex-1 py-2 text-white rounded-xl text-sm font-medium disabled:opacity-50 ${
                  movType === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </PortalModal>

      <PortalModal open={showArqueoModal && !!session} onClose={() => setShowArqueoModal(false)} className="max-w-2xl">
        {session && (() => {
          const arqueoTotal = sumArqueo(arqueoDraft)
          const diff = arqueoTotal - currentBalance
          const diffOk = Math.abs(diff) < 0.01
          const diffClass = diffOk ? 'text-emerald-700' : diff > 0 ? 'text-emerald-700' : 'text-red-700'

          return (
            <div className="flex max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-lg font-bold text-stone-800">Arqueo de caja</h3>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Cuenta billetes y monedas. El total se compara con el saldo esperado de la sesión.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowArqueoModal(false)}
                  className="shrink-0 rounded-lg p-1.5 hover:bg-stone-100"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-stone-100 bg-stone-50/60 px-4 py-3 sm:grid-cols-3 sm:px-5">
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Total contado</p>
                  <p className="mt-0.5 text-lg font-bold text-stone-900 tabular-nums">S/ {arqueoTotal.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Saldo esperado</p>
                  <p className="mt-0.5 text-lg font-bold text-stone-800 tabular-nums">S/ {Number(currentBalance).toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Diferencia</p>
                  <p className={`mt-0.5 text-lg font-bold tabular-nums ${diffClass}`}>
                    {diffOk ? 'S/ 0.00' : `${diff > 0 ? '+' : ''}S/ ${diff.toFixed(2)}`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-stone-400">
                    {diffOk ? 'Cuadrado' : diff > 0 ? 'Sobra efectivo' : 'Falta efectivo'}
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <ArqueoDenominationSection
                    title="Billetes"
                    items={ARQUEO_BILLS}
                    values={arqueoDraft}
                    onChangeQty={(key, qty) => setArqueoDraft((a) => ({ ...a, [key]: qty }))}
                  />
                  <ArqueoDenominationSection
                    title="Monedas"
                    items={ARQUEO_COINS}
                    values={arqueoDraft}
                    onChangeQty={(key, qty) => setArqueoDraft((a) => ({ ...a, [key]: qty }))}
                  />
                </div>
              </div>

              <div className="flex shrink-0 gap-2 border-t border-stone-200 bg-white px-4 py-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setShowArqueoModal(false)}
                  className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveArqueo}
                  disabled={savingArqueo}
                  className="flex-1 rounded-xl bg-rest-600 py-2.5 text-sm font-medium text-white hover:bg-rest-700 disabled:opacity-50"
                >
                  {savingArqueo ? 'Guardando...' : 'Guardar arqueo'}
                </button>
              </div>
            </div>
          )
        })()}
      </PortalModal>

      {historyReportsSession && (
        <CajaSessionReportsModal
          sessionId={historyReportsSession.id}
          sessionLabel={
            historyReportsSession.opened_at
              ? new Date(historyReportsSession.opened_at).toLocaleString()
              : `Sesión ${historyReportsSession.id}`
          }
          onClose={() => setHistoryReportsSession(null)}
        />
      )}
    </div>
  )
}
