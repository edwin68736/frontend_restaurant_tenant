import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { ArrowLeft, X, Trash2, FileText, ShoppingCart, Plus, Printer, ChevronRight } from 'lucide-react'
import { SearchInput } from '@/components/SearchInput'
import { PosProductGridCard } from '@/components/pos/PosProductGridCard'
import { usePosInfiniteProducts } from '@/hooks/usePosInfiniteProducts'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { restaurantService, type SessionDetail, type Comanda } from '@/services/restaurant.service'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'
import type { PrintData } from '@/types/printData'
import { productsService, type Product, type Category, getProductImageUrl } from '@/services/products.service'
import { sortCategories } from '@/utils/sortCategories'
import { companyService, pickDefaultNotaVentaSeries } from '@/services/company.service'
import { resolveTaxRatePercent } from '@/constants/tax'
import { useBranchCheckoutSeries } from '@/contexts/BranchCheckoutSeriesContext'
import { BranchCheckoutSeriesEmptyState } from '@/components/pos/BranchCheckoutSeriesEmptyState'
import { contactsService, type Contact, type CreateContactInput } from '@/services/contacts.service'
import { cashbankService, type BankAccount, type PaymentMethodRecord } from '@/services/cashbank.service'
import { consultaService } from '@/services/consulta.service'
import { SearchableSelect } from '@/components/SearchableSelect'
import { getConfiguredPrinter, isAutoPrintEnabled, isNativePrintAvailable, printDocumentAuto, printPrecuentaAuto } from '@/services/printers.service'
import {
  cartLineToPrecuentaPrintItem,
  cartToOrderItems,
  collectCheckoutLineTaxTotals,
  comandaToPrecuentaPrintItem,
  comandaLineTotal,
  formatPrecuentaIssueDate,
  getActiveKitchenRounds,
  getActiveSessionOrders,
  getOrderRoundHistory,
  countCancellableComandas,
  sumSessionComandaQty,
  type KitchenRound,
} from '@/utils/posOrderHelpers'
import {
  appendCatalogLine,
  applyCatalogLineUnitPrice,
  buildCatalogConfigureKey,
  cartLineKey,
  cartLineLabel,
  cartLineTotal,
  cartLineUnitPrice,
  createCatalogCartLine,
  sumCartQty,
  type CatalogCartLine,
  type ManualCartLine,
  type PosCartLine,
} from '@/utils/posCart'
import { roundMoney } from '@/utils/checkoutDiscount'
import {
  formatModifierLines,
  formatModifierSummary,
  parseStoredModifiers,
  productNeedsConfiguration,
} from '@/utils/productModifiers'
import { ManualProductModal } from '@/components/pos/ManualProductModal'
import { PosCartLineRow } from '@/components/pos/PosCartLineRow'
import { ProductConfigureModal } from '@/components/pos/ProductConfigureModal'
import { CartClearButton } from '@/components/pos/CartClearButton'
import { playCartAddSound, playCartClearSound } from '@/utils/cartSounds'
import { ComandaLineDisplay } from '@/components/pos/ComandaLineDisplay'
import { ComandaNoteEditor } from '@/components/pos/ComandaNoteEditor'
import { printAllKitchenRounds, printKitchenRound } from '@/utils/kitchenPrint'
import { KitchenRoundHistoryModal } from '@/components/restaurant/KitchenRoundHistoryModal'
import { VoidOrderPinModal } from '@/components/restaurant/VoidOrderPinModal'
import { POSCheckoutModal } from '@/components/pos/POSCheckoutModal'
import { checkoutContactIsValid, isFacturaDocType, pickVariosContactId } from '@/utils/checkoutContacts'
import {
  BILLING_NOT_ENABLED_MESSAGE,
  isElectronicBillingSunatCode,
} from '@/utils/restaurantCheckoutSeries'
import {
  contactDocConsultMinLength,
  contactDocNumberPlaceholder,
  contactDocSelectOptions,
  contactDocSupportsConsulta,
  sanitizeContactDocNumber,
  toContactDocCode,
} from '@/utils/contactDocTypes'
import { findPaymentMethodRecord, isPaymentMethodLinkedForSale, normalizePaymentMethodCodeForLookup } from '@/utils/paymentMethodCheckout'
import { defaultOperationalPaymentCode, filterOperationalPaymentMethods } from '@/utils/operationalPaymentMethods'
import {
  applyCheckoutDiscountToLines,
  buildRestaurantBillDiscount,
  type CheckoutDiscountMode,
} from '@/utils/checkoutDiscount'
import { paidCoversTotal, roundSunat, sumMoney } from '@/utils/money'
import { formatMoney, formatSoles } from '@/utils/format'
import { canApplyCheckoutDiscount, canCancelComanda } from '@/utils/restaurantPermissions'
import { FloatingCartButton } from '@/components/restaurant/FloatingCartButton'
import { MobileCartDrawer } from '@/components/restaurant/MobileCartDrawer'
import { PortalModal } from '@/components/ui/PortalModal'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'
import { FIXED_OVERLAY_SAFE, MAX_H_PANEL_85 } from '@/utils/safeAreaClasses'
import { useFlyToCart } from '@/hooks/useFlyToCart'

export default function MesaPage() {
  const { canAccess, employeeType, restaurantPermissions } = useAuth()
  const allowCheckoutDiscount = canApplyCheckoutDiscount(restaurantPermissions, employeeType)
  const { activeBranchId, activeBranch } = useBranch()
  const {
    checkoutSeries,
    seriesMetaReady,
    hasCheckoutSeries,
    sunatEnabled,
    canFactura,
    seriesLoadError,
    seriesOnOtherBranches,
  } = useBranchCheckoutSeries()
  const { session: myCashSession, canChargeCash } = useCashSession()
  const canCerrarMesa = canAccess('cerrar_mesa')
  const canAnularComanda = canCancelComanda(restaurantPermissions, employeeType)
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const id = Number(sessionId)
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [preparationAreaFilter, setPreparationAreaFilter] = useState<string | null>(null)
  const productsScrollRef = useRef<HTMLDivElement>(null)
  const productsSentinelRef = useRef<HTMLDivElement>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [cart, setCart] = useState<PosCartLine[]>([])
  const [manualProductOpen, setManualProductOpen] = useState(false)
  const [configureProduct, setConfigureProduct] = useState<Product | null>(null)
  const configureFlySourceRef = useRef<HTMLElement | undefined>(undefined)
  const [sunat, setSunat] = useState<{ tax_rate?: number; igv_regime?: string; tax_benefit_zone?: boolean } | null>(null)
  const [ordersModalOpen, setOrdersModalOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [seriesId, setSeriesId] = useState(0)
  const [docType, setDocType] = useState('NOTA DE VENTA')
  const [contactId, setContactId] = useState<number | null>(null)
  const [payments, setPayments] = useState<{ method: string; amount: number; reference?: string }[]>([
    { method: 'cash', amount: 0, reference: '' },
  ])
  const [checkoutDiscountMode, setCheckoutDiscountMode] = useState<CheckoutDiscountMode>('percent')
  const [checkoutDiscountValue, setCheckoutDiscountValue] = useState(0)
  const [precuentaOpen, setPrecuentaOpen] = useState(false)
  const [anulComanda, setAnulComanda] = useState<Comanda | null>(null)
  const [anulReason, setAnulReason] = useState('')
  const [anulPin, setAnulPin] = useState('')
  const [printData, setPrintData] = useState<PrintData | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [lastSale, setLastSale] = useState<{
    id: number
    number: string
    total: number
    clientEmail?: string
  } | null>(null)
  const [comandaModal, setComandaModal] = useState<{ orderId: number; orderNumber: number; comandas: Comanda[] } | null>(null)
  const [kitchenHistoryOpen, setKitchenHistoryOpen] = useState(false)
  const [voidComandasTarget, setVoidComandasTarget] = useState<
    { mode: 'all' } | { mode: 'round'; orderId: number; orderNumber: number } | null
  >(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([])
  const checkoutPaymentMethods = useMemo(() => filterOperationalPaymentMethods(paymentMethods), [paymentMethods])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [clientQuickAddOpen, setClientQuickAddOpen] = useState(false)
  const [clientQuickAdd, setClientQuickAdd] = useState({ doc_type: '6', doc_number: '', business_name: '', address: '' })
  const [consultaLoading, setConsultaLoading] = useState(false)
  const [createContactLoading, setCreateContactLoading] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const cartBtnRef = useRef<HTMLButtonElement>(null)
  const desktopCartRef = useRef<HTMLDivElement>(null)
  const { flyToCart, FlyToCartLayer, cancelFlyAnimations } = useFlyToCart(cartBtnRef, { desktopCartRef })
  const configuringRef = useRef(false)

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!id) return
    if (!opts?.silent) setLoading(true)
    restaurantService
      .getSession(id)
      .then(setSession)
      .catch(() => toast.error('Sesión no encontrada'))
      .finally(() => {
        if (!opts?.silent) setLoading(false)
      })
  }, [id])

  useEffect(() => { load() }, [load])

  const loadMesaMeta = useCallback(() => {
    if (!activeBranchId) return
    productsService.listCategories().then((rows) => setCategories(sortCategories(rows))).catch(() => [])
    companyService.getSunat().then(setSunat).catch(() => setSunat(null))
    contactsService
      .list('', 'customer')
      .then((list) => {
        setContacts(list)
        const variosId = pickVariosContactId(list)
        if (variosId) setContactId((prev) => prev ?? variosId)
      })
      .catch(() => setContacts([]))
    cashbankService
      .listPaymentMethods(true)
      .then((list) => {
        setPaymentMethods(list && list.length > 0 ? list.filter((m) => m.active) : [])
      })
      .catch(() => setPaymentMethods([]))
    cashbankService.listBankAccounts(true).then(setBankAccounts).catch(() => setBankAccounts([]))
  }, [activeBranchId])

  useEffect(() => {
    loadMesaMeta()
  }, [loadMesaMeta])

  useOnBranchChange(() => {
    loadMesaMeta()
  })

  useEffect(() => {
    const def = pickDefaultNotaVentaSeries(checkoutSeries)
    if (def) {
      setSeriesId(def.id)
      setDocType(String(def.doc_type || '').trim() || 'NOTA DE VENTA')
    } else {
      setSeriesId(0)
    }
  }, [checkoutSeries])

  const branchSeriesMissing = Boolean(activeBranchId) && seriesMetaReady && !hasCheckoutSeries
  const seriesEmptyReason = seriesLoadError
    ? 'load_error'
    : seriesOnOtherBranches
      ? 'other_branch'
      : 'missing'

  const {
    products,
    hasMore,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    isSearching: productsSearching,
    stockByProductId,
    loadMore: loadMoreProducts,
    search: productSearch,
  } = usePosInfiniteProducts({
    activeBranchId,
    categoryFilter,
    preparationAreaFilter,
    scopeKey: id,
    enabled: !!id,
    onError: () => toast.error('No se pudieron cargar los productos'),
  })

  const search = productSearch.inputValue
  const setSearch = productSearch.setInputValue

  useEffect(() => {
    const root = productsScrollRef.current
    const sentinel = productsSentinelRef.current
    if (!root || !sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreProducts()
      },
      { root, rootMargin: '160px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMoreProducts, products.length])

  const categoriesWithProducts = useMemo(() => {
    return categories
  }, [categories])

  const preparationAreas = useMemo(() => {
    const areas = new Set(
      products
        .map((p) => p.preparation_area || '')
        .filter(Boolean)
    )
    return Array.from(areas).sort((a, b) => a.localeCompare(b))
  }, [products])

  useEffect(() => {
    configuringRef.current = configureProduct != null
  }, [configureProduct])

  const addToCart = useCallback(
    (p: Product, sourceEl?: HTMLElement) => {
      if (configuringRef.current) return
      if (productNeedsConfiguration(p)) {
        configuringRef.current = true
        cancelFlyAnimations()
        configureFlySourceRef.current = sourceEl
        setConfigureProduct(p)
        return
      }
      const imageUrl = getProductImageUrl(p.image_url)
      const line = createCatalogCartLine(p, { quantity: 1, notes: '' })
      let merged = false
      setCart((c) => {
        const result = appendCatalogLine(c, line)
        merged = result.merged
        return result.cart
      })
      if (!merged && sourceEl) flyToCart(sourceEl, imageUrl)
      playCartAddSound()
    },
    [flyToCart, cancelFlyAnimations],
  )

  const onConfiguredProduct = useCallback(
    (line: CatalogCartLine) => {
      const source = configureFlySourceRef.current
      configureFlySourceRef.current = undefined
      configuringRef.current = false
      setConfigureProduct(null)
      const imageUrl = getProductImageUrl(line.product.image_url)
      let merged = false
      setCart((c) => {
        const result = appendCatalogLine(c, line)
        merged = result.merged
        return result.cart
      })
      if (!merged && source) flyToCart(source, imageUrl)
      playCartAddSound()
    },
    [flyToCart],
  )

  const clearPendingCart = useCallback(() => {
    if (cart.length === 0) return
    setCart([])
    playCartClearSound()
  }, [cart.length])
  const setQty = (index: number, qty: number) => {
    if (qty <= 0) setCart((c) => c.filter((_, i) => i !== index))
    else setCart((c) => c.map((x, i) => (i === index ? { ...x, quantity: qty } : x)))
  }
  const setCartNotes = (index: number, notes: string) => {
    setCart((c) =>
      c.map((x, i) => {
        if (i !== index) return x
        if (x.kind !== 'catalog') return { ...x, notes }
        return { ...x, notes, configureKey: buildCatalogConfigureKey(x.modifiers, notes, x.unit_price) }
      }),
    )
  }
  const setCartUnitPrice = (index: number, raw: string) => {
    const parsed = Number.parseFloat(raw.replace(',', '.'))
    if (Number.isNaN(parsed) || parsed < 0) return
    setCart((c) =>
      c.map((x, i) => {
        if (i !== index) return x
        if (x.kind === 'manual') return { ...x, unit_price: roundMoney(parsed) }
        return applyCatalogLineUnitPrice(x, parsed)
      }),
    )
  }

  const taxRate = resolveTaxRatePercent(sunat?.tax_rate)
  const taxConfig = { taxRate, igvRegime: sunat?.igv_regime, taxBenefitZone: sunat?.tax_benefit_zone }
  const cartTotal = useMemo(
    () => sumMoney(...cart.map((line) => cartLineTotal(line, taxRate, taxConfig))),
    [cart, taxRate, taxConfig.igvRegime, taxConfig.taxBenefitZone]
  )
  const sessionTotal = session?.total_amount ?? 0
  const totalToPay = sumMoney(cartTotal, sessionTotal)

  const checkoutLineTax = useMemo(
    () => collectCheckoutLineTaxTotals(cart, session, taxRate, taxConfig),
    [cart, session, taxRate, taxConfig.igvRegime, taxConfig.taxBenefitZone],
  )
  const checkoutBilling = useMemo(
    () => applyCheckoutDiscountToLines(checkoutLineTax, checkoutDiscountMode, checkoutDiscountValue),
    [checkoutLineTax, checkoutDiscountMode, checkoutDiscountValue],
  )
  const billingSubtotal = useMemo(
    () => roundSunat(checkoutLineTax.reduce((acc, line) => acc + line.subtotal, 0)),
    [checkoutLineTax],
  )
  const payableTotal = allowCheckoutDiscount ? checkoutBilling.payableTotal : totalToPay
  const checkoutTaxAmount = checkoutBilling.taxAmount
  const canComanda = cart.length > 0
  const canGenerarVenta = (cart.length > 0 || sessionTotal > 0) && session?.status === 'open'
  const soloCerrarMesa = session?.status === 'open' && sessionTotal <= 0 && cart.length === 0

  const sessionItemQty = useMemo(() => sumSessionComandaQty(session), [session])
  const activeSessionOrders = useMemo(() => getActiveSessionOrders(session), [session])
  const activeKitchenRounds = useMemo(() => getActiveKitchenRounds(session), [session])
  const kitchenRoundHistory = useMemo(() => getOrderRoundHistory(session), [session])
  const printableKitchenRounds = useMemo(
    () => kitchenRoundHistory.filter((r) => r.comandas.length > 0),
    [kitchenRoundHistory],
  )
  const newCartQty = useMemo(() => sumCartQty(cart), [cart])

  useEffect(() => {
    if (ordersModalOpen && activeSessionOrders.length === 0) {
      setOrdersModalOpen(false)
    }
  }, [ordersModalOpen, activeSessionOrders.length])

  const resolveOrderItems = () => {
    try {
      return cartToOrderItems(cart)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revisa el carrito')
      return null
    }
  }

  const patchComandaNote = (comandaId: number, notes: string) => {
    setComandaModal((prev) =>
      prev ? { ...prev, comandas: prev.comandas.map((c) => (c.id === comandaId ? { ...c, notes } : c)) } : null,
    )
    setSession((prev) => {
      if (!prev?.orders) return prev
      return {
        ...prev,
        orders: prev.orders.map((ord) => ({
          ...ord,
          comandas: (ord.comandas ?? []).map((c) => (c.id === comandaId ? { ...c, notes } : c)),
        })),
      }
    })
  }
  const totalCartQty = sessionItemQty + newCartQty

  const defaultContactId = useMemo(() => pickVariosContactId(contacts), [contacts])

  const effectiveContactId = contactId ?? defaultContactId

  const selectedSeries = useMemo(
    () => checkoutSeries.find((s) => s.id === seriesId) ?? null,
    [checkoutSeries, seriesId],
  )

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === effectiveContactId) ?? null,
    [contacts, effectiveContactId],
  )

  const checkoutContactOk = checkoutContactIsValid(selectedContact, docType, selectedSeries?.sunat_code)

  const applyCheckoutDefaults = useCallback(() => {
    const def = pickDefaultNotaVentaSeries(checkoutSeries)
    if (def) {
      setSeriesId(def.id)
      setDocType(String(def.doc_type || '').trim() || 'NOTA DE VENTA')
    }
    const variosId = pickVariosContactId(contacts)
    if (variosId) setContactId(variosId)
  }, [checkoutSeries, contacts])

  const reprintKitchenRound = async (round: KitchenRound) => {
    if (round.comandas.length === 0 || !session) return
    const printed = await printKitchenRound({
      sessionDetail: session,
      orderCode: session.order_code ?? '',
      orderNumber: round.orderNumber,
      tableOrderId: round.orderId,
      comandas: round.comandas,
      manual: true,
      markPrinted: false,
    })
    if (!printed) {
      setComandaModal({ orderId: round.orderId, orderNumber: round.orderNumber, comandas: round.comandas })
      if (!isNativePrintAvailable()) {
        toast.info('Vista previa de comanda (impresión solo en app de escritorio o Android)')
      } else {
        toast.error('No se pudo imprimir. Revisa la impresora de comandas en Ajustes.')
      }
    }
  }

  const reprintAllKitchenRounds = async () => {
    if (!session || printableKitchenRounds.length === 0) return
    const printed = await printAllKitchenRounds({
      sessionDetail: session,
      orderCode: session.order_code ?? '',
      rounds: printableKitchenRounds,
      manual: true,
      markPrinted: false,
    })
    if (!printed) {
      if (!isNativePrintAvailable()) {
        toast.info('Vista previa de comanda (impresión solo en app de escritorio o Android)')
      } else {
        toast.error('No se pudo imprimir. Revisa la impresora de comandas en Ajustes.')
      }
    }
  }

  const printNewKitchenRound = async (
    order: { id?: number; order_number?: number; comandas?: Comanda[] },
    sessionSnapshot: SessionDetail,
  ) => {
    const tableOrderId = Number(order?.id ?? 0) || 0
    const orderNumber = Number(order?.order_number ?? 0) || 0
    const comandas = Array.isArray(order?.comandas) ? order.comandas : []
    if (tableOrderId <= 0 || orderNumber <= 0 || comandas.length === 0) return
    setComandaModal({ orderId: tableOrderId, orderNumber, comandas })
    const printed = await printKitchenRound({
      sessionDetail: sessionSnapshot,
      orderCode: sessionSnapshot.order_code ?? '',
      orderNumber,
      tableOrderId,
      comandas,
    })
    if (!printed) {
      toast.info('Revisa impresora de comandas en Ajustes o usa Reimprimir')
    }
  }

  const renderKitchenCartStrip = () => {
    if (activeSessionOrders.length === 0) return null
    const inKitchenItems = activeKitchenRounds.reduce((n, r) => n + r.comandas.length, 0)
    return (
      <div className="px-2 py-2 border-b border-amber-200/80 bg-amber-50/50 shrink-0">
        <button
          type="button"
          onClick={() => setOrdersModalOpen(true)}
          className="w-full flex items-center gap-2 rounded-xl border border-amber-200/80 bg-white px-2.5 py-2 text-left hover:bg-amber-50/90 transition-colors touch-manipulation"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-800">
              {activeSessionOrders.length}{' '}
              {activeSessionOrders.length === 1 ? 'comanda en mesa' : 'comandas en mesa'}
            </p>
            <p className="text-[10px] text-stone-500 truncate">
              {inKitchenItems > 0
                ? `${inKitchenItems} ítem${inKitchenItems === 1 ? '' : 's'} en cocina · `
                : ''}
              {formatSoles(sessionTotal)} · Ver, imprimir o anular
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
        </button>
        {cart.length > 0 && (
          <p className="text-[10px] text-stone-500 mt-1.5 px-0.5 leading-snug">
            Abajo: ítems nuevos para la siguiente comanda.
          </p>
        )}
      </div>
    )
  }

  const sendComanda = async () => {
    const s = session
    if (!s) return
    if (!canComanda) return
    setAdding(true)
    try {
      const items = resolveOrderItems()
      if (!items) return
      const res = await restaurantService.addOrder(id, { items })
      const order = (res as { data?: { id?: number; order_number?: number; comandas?: Comanda[] } })?.data
      toast.success('Comanda enviada a cocina')
      setCart([])
      const refreshed = await restaurantService.getSession(id)
      setSession(refreshed)
      if (order) await printNewKitchenRound(order, refreshed)
      else load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setAdding(false)
    }
  }

  const closeMesa = async () => {
    try {
      await restaurantService.closeSession(id)
      toast.success('Mesa cerrada')
      navigate('/salas')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const doCheckout = async () => {
    const s = session
    if (!s) { toast.error('No hay una mesa cargada'); return }
    const paid = payments.reduce((s, p) => s + p.amount, 0)
    if (!paidCoversTotal(paid, payableTotal)) {
      toast.error('El monto pagado debe ser al menos el total')
      return
    }
    if (branchSeriesMissing) return
    if (!seriesId) return
    if (!sunatEnabled && isElectronicBillingSunatCode(selectedSeries?.sunat_code)) {
      toast.error(BILLING_NOT_ENABLED_MESSAGE)
      return
    }
    const selectedContactId = effectiveContactId
    const contactForCheckout = contacts.find((c) => c.id === selectedContactId) ?? null
    if (!checkoutContactIsValid(contactForCheckout, docType, selectedSeries?.sunat_code)) {
      toast.error(
        isFacturaDocType(docType, selectedSeries?.sunat_code)
          ? 'La factura requiere un cliente con RUC'
          : 'Selecciona un cliente',
      )
      return
    }

    if (paymentMethods.length > 0) {
      for (const p of payments) {
        const pm = findPaymentMethodRecord(paymentMethods, p.method)
        if (!pm) {
          toast.error('Método de pago no configurado. Revísalo en Caja → Cuentas y métodos.')
          return
        }
        if (!isPaymentMethodLinkedForSale(pm, bankAccounts)) {
          toast.error(`El método "${pm.name}" no tiene una cuenta vinculada.`)
          return
        }
      }
    }

    const needsCashSession =
      payments.some((p) => findPaymentMethodRecord(paymentMethods, p.method)?.destination_type === 'cash') ||
      (paymentMethods.length === 0 && payments.some((p) => normalizePaymentMethodCodeForLookup(p.method) === 'cash'))

    setAdding(true)
    try {
      let sessionForBill = s
      if (cart.length > 0) {
        const items = resolveOrderItems()
        if (!items) return
        const orderRes = await restaurantService.addOrder(id, { items })
        const order = (orderRes as { data?: { id?: number; order_number?: number; comandas?: Comanda[] } })?.data
        setCart([])
        sessionForBill = await restaurantService.getSession(id)
        setSession(sessionForBill)
        if (order) await printNewKitchenRound(order, sessionForBill)
        else await load()
      }
      const billLines = collectCheckoutLineTaxTotals([], sessionForBill, taxRate, taxConfig)
      const billDiscount = buildRestaurantBillDiscount(
        billLines,
        checkoutDiscountMode,
        checkoutDiscountValue,
        allowCheckoutDiscount,
      )
      if (!paidCoversTotal(paid, billDiscount.payableTotal)) {
        toast.error(`El monto pagado debe ser al menos el total (${formatMoney(billDiscount.payableTotal)})`)
        return
      }
      if (needsCashSession) {
        if (!canChargeCash) {
          toast.error('Los mozos no pueden cobrar en efectivo; use otro método o un cajero')
          return
        }
        if (!myCashSession?.id) {
          toast.error('Abra su caja para cobrar en efectivo (menú Caja)')
          return
        }
      }
      const res = await restaurantService.billSession(id, {
        series_id: seriesId,
        doc_type: docType,
        currency: 'PEN',
        contact_id: selectedContactId,
        cash_session_id: myCashSession?.id ?? null,
        close_session: true,
        discount_mode: billDiscount.discount_mode,
        discount_value: billDiscount.discount_value,
        discount_amount: billDiscount.discount_amount,
        payments: payments.map((p) => ({
          method: p.method,
          amount: roundSunat(p.amount),
          reference: p.reference?.trim() ?? '',
          notes: '',
        })),
      })
      toast.success('Venta generada. Mesa cerrada.')
      setCheckoutOpen(false)
      setPrintData(res.print_data ?? null)
      const saleContact = contacts.find((c) => c.id === selectedContactId)
      setLastSale(
        res.data
          ? {
              id: res.data.id,
              number: res.data.number,
              total: res.data.total,
              clientEmail: saleContact?.email?.trim() ?? '',
            }
          : null,
      )
      setReceiptModalOpen(true)
      if (isNativePrintAvailable() && isAutoPrintEnabled('documentos') && res.print_data) {
        const cfg = getConfiguredPrinter('documentos')
        if (!cfg) {
          toast.error('Configura la impresora de documentos en Ajustes')
        } else {
          try {
            const msg = await printDocumentAuto(res.print_data)
            toast.success(msg || 'Comprobante enviado a la impresora')
          } catch (e) {
            console.error('[document print error]', e)
            toast.error('No se pudo imprimir el comprobante. Revisa la consola de Tauri (cargo).')
          }
        }
      }
      // Navegar al cerrar el modal
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setAdding(false)
    }
  }

  const printPrecuenta = async () => {
    const s = session
    if (!s) return
    if (!isNativePrintAvailable()) return
    const cfg = getConfiguredPrinter('precuenta')
    if (!cfg) {
      toast.error('Configura la impresora de precuenta en Ajustes')
      return
    }
    if (totalToPay <= 0) return
    const items = [
      ...activeSessionOrders.flatMap((ord) =>
        ord.comandas.map((c) => comandaToPrecuentaPrintItem(c, taxRate, taxConfig)),
      ),
      ...cart.map((c) => cartLineToPrecuentaPrintItem(c, taxRate, taxConfig)),
    ]
    try {
      const msg = await printPrecuentaAuto({
        tableName: s.table_name ?? null,
        issueDate: formatPrecuentaIssueDate(s.opened_at),
        items,
        total: totalToPay,
      })
      toast.success(msg || 'Precuenta enviada a la impresora')
    } catch (e) {
      console.error('[precuenta print error]', e)
      toast.error('No se pudo imprimir la precuenta. Revisa la consola de Tauri (cargo).')
    }
  }

  const openPrecuenta = () => {
    setPrecuentaOpen(true)
    if (!isAutoPrintEnabled('precuenta')) return
    void printPrecuenta()
  }

  const openCheckout = () => {
    if (branchSeriesMissing) return
    if (!canGenerarVenta) return
    applyCheckoutDefaults()
    setCheckoutDiscountMode('percent')
    setCheckoutDiscountValue(0)
    setPayments([
      {
        method: defaultOperationalPaymentCode(paymentMethods),
        amount: totalToPay,
        reference: '',
      },
    ])
    setCheckoutOpen(true)
  }

  useEffect(() => {
    if (!checkoutOpen || allowCheckoutDiscount) return
    setCheckoutDiscountValue(0)
  }, [checkoutOpen, allowCheckoutDiscount])

  useEffect(() => {
    if (!checkoutOpen || payments.length !== 1) return
    setPayments((prev) => {
      if (prev.length !== 1) return prev
      const cur = prev[0]?.amount ?? 0
      const nextAmount = payableTotal
      if (cur > nextAmount + 0.009) return prev
      if (Math.abs(cur - nextAmount) < 0.009) return prev
      return [{ ...prev[0], amount: nextAmount }]
    })
  }, [checkoutOpen, payableTotal, payments.length])

  const confirmAnulComanda = async () => {
    if (!anulComanda) return
    if (!anulReason.trim()) { toast.error('Indica el motivo de anulación'); return }
    if (!anulPin.trim()) { toast.error('Ingresa el PIN de seguridad'); return }
    setAdding(true)
    try {
      await restaurantService.cancelComanda(anulComanda.id, anulReason.trim(), anulPin)
      toast.success('Comanda anulada')
      setAnulComanda(null)
      setAnulReason('')
      setAnulPin('')
      load({ silent: true })
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setAdding(false)
    }
  }

  const requestVoidComandas = async (
    target: { mode: 'all' } | { mode: 'round'; orderId: number; orderNumber: number },
  ) => {
    const count =
      target.mode === 'all'
        ? countCancellableComandas(session)
        : countCancellableComandas(session, target.orderId)
    if (count === 0) {
      toast.error('No hay ítems que se puedan anular')
      return
    }
    try {
      const ok = await restaurantService.ensureDeletionPinConfigured()
      if (!ok) {
        toast.error('Configure el PIN de operaciones en Ajustes → Restaurante')
        return
      }
      setVoidComandasTarget(target)
    } catch {
      toast.error('No se pudo verificar el PIN de seguridad')
    }
  }

  const renderCartLines = () =>
    cart.map((item, i) => (
      <PosCartLineRow
        key={cartLineKey(item, i)}
        line={item}
        subtotalLabel={`Importe: ${formatSoles(cartLineTotal(item, taxRate, taxConfig))}`}
        onQtyChange={(d) => setQty(i, item.quantity + d)}
        onNotesChange={(n) => setCartNotes(i, n)}
        onUnitPriceChange={(v) => setCartUnitPrice(i, v)}
        showNotes
      />
    ))

  const renderCartTotals = () => (
    <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/30 shrink-0">
      {sessionTotal > 0 && (
        <p className="text-xs text-stone-500 mb-1 tabular-nums">En mesa: {formatSoles(sessionTotal)}</p>
      )}
      <div className="flex justify-between items-baseline font-bold text-stone-800 text-base">
        <span>Total</span>
        <span className="text-rest-600">{formatMoney(totalToPay)}</span>
      </div>
    </div>
  )

  const renderCartActions = () => {
    if (session?.status !== 'open') return null
    return (
      <div className="px-2 pb-2 pt-1 shrink-0 grid grid-cols-2 gap-1.5">
        {soloCerrarMesa && canCerrarMesa ? (
          <div className="col-span-2">
            <p className="text-xs text-stone-500 mb-1.5 px-1">Mesa pagada. Cierra para liberar.</p>
            <button
              type="button"
              onClick={closeMesa}
              className="w-full py-2.5 bg-stone-600 text-white rounded-xl text-sm font-medium hover:bg-stone-700"
            >
              Cerrar mesa
            </button>
          </div>
        ) : !soloCerrarMesa ? (
          <>
            <button
              type="button"
              onClick={() => setManualProductOpen(true)}
              className="col-span-2 inline-flex items-center justify-center gap-1 py-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100"
            >
              <Plus size={14} /> Producto manual
            </button>
            <button
              type="button"
              onClick={openPrecuenta}
              disabled={totalToPay <= 0}
              className="inline-flex items-center justify-center gap-1 py-2 border border-rest-400 text-rest-700 rounded-xl text-xs font-medium hover:bg-rest-50 disabled:opacity-50"
            >
              <FileText size={14} /> Precuenta
            </button>
            <button
              type="button"
              onClick={sendComanda}
              disabled={!canComanda || adding}
              className="inline-flex items-center justify-center gap-1 py-2 bg-stone-200 text-stone-800 rounded-xl text-xs font-medium hover:bg-stone-300 disabled:opacity-50"
            >
              {adding ? '...' : 'Comanda'}
            </button>
            {canCerrarMesa && (
              <button
                type="button"
                onClick={openCheckout}
                disabled={branchSeriesMissing || !canGenerarVenta || adding}
                className="col-span-2 inline-flex items-center justify-center gap-1 py-2.5 bg-rest-600 text-white rounded-xl text-xs font-semibold hover:bg-rest-700 disabled:opacity-50"
              >
                Generar venta
              </button>
            )}
          </>
        ) : null}
      </div>
    )
  }

  if (loading || !session) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden w-full max-w-full h-full lg:bg-stone-50/80 lg:-mx-5 lg:-my-3">
      <main className="flex-1 min-h-0 flex flex-col w-full max-w-full mx-auto px-0 pt-0 pb-0 lg:pt-1 lg:pb-2 lg:pl-2 lg:pr-0">
        {branchSeriesMissing && (
          <div className="shrink-0 px-2 pb-2 lg:px-0">
            <BranchCheckoutSeriesEmptyState
              branchName={activeBranch?.name}
              reason={seriesEmptyReason}
            />
          </div>
        )}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-1 pb-1 min-w-0 w-full lg:px-0 lg:pb-1.5">
          <button
            type="button"
            onClick={() => navigate('/salas')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rest-600 text-white text-xs font-medium hover:bg-rest-700 shrink-0"
          >
            <ArrowLeft size={16} /> Mesas
          </button>
          {activeSessionOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setOrdersModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-medium hover:bg-stone-900 shrink-0"
            >
              <FileText size={14} />
              <span>Pedidos</span>
              <span className="inline-flex min-w-[1.25rem] h-5 px-1 items-center justify-center rounded-md bg-rest-600 text-white text-xs font-bold">
                {activeSessionOrders.length}
              </span>
            </button>
          )}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h2 className="text-sm sm:text-base font-bold text-stone-800 truncate">
              {session.table_name ?? 'Mesa'}
            </h2>
            <p className="text-xs text-stone-500 tabular-nums">
              En mesa {formatSoles(sessionTotal)}
              {cart.length > 0 && <> · Nuevo {formatSoles(cartTotal)}</>}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 lg:gap-3 w-full min-w-0 max-w-full mx-auto">
          <div className="flex w-full min-w-0 max-w-full flex-1 flex-col min-h-0 mx-auto">
            <div className="flex w-full gap-1 overflow-x-auto px-1 pb-1 min-w-0 shrink-0 lg:gap-1.5 lg:px-0 lg:pb-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  categoryFilter === null
                    ? 'bg-rest-600 text-white border-rest-600'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Todas
              </button>
              {categoriesWithProducts.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap ${
                    categoryFilter === cat.id
                      ? 'bg-rest-600 text-white border-rest-600'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {preparationAreas.length > 0 && (
              <div className="flex w-full gap-1 overflow-x-auto px-1 pb-1 min-w-0 shrink-0 lg:gap-1.5 lg:px-0 lg:pb-1.5">
                <span className="shrink-0 text-xs text-stone-500 self-center pr-1">Área:</span>
                  <button
                    type="button"
                    onClick={() => setPreparationAreaFilter(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
                      preparationAreaFilter === null
                        ? 'bg-stone-600 text-white border-stone-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    Todas
                  </button>
                  {preparationAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setPreparationAreaFilter(area)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${
                        preparationAreaFilter === area
                          ? 'bg-stone-600 text-white border-stone-600'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
              </div>
            )}

            <div className="flex w-full max-w-full min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-y border-stone-200/80 bg-white shadow-none lg:rounded-2xl lg:border lg:shadow-sm">
              <div className="px-2 py-1.5 border-b border-stone-100 shrink-0 flex items-center gap-2 lg:px-3 lg:py-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  isSearching={productsSearching}
                  placeholder="Buscar producto..."
                  className="flex-1 min-w-0"
                  inputClassName="text-sm py-1.5"
                />
              </div>
              <div ref={productsScrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2 lg:p-3">
              <div className="grid w-full max-w-full grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5 2xl:grid-cols-6 justify-items-stretch">
              {products.map((p) => (
                <PosProductGridCard
                  key={p.id}
                  product={p}
                  stockQuantity={stockByProductId[String(p.id)]}
                  onClick={(e) => {
                    const visual = (e.currentTarget as HTMLElement).querySelector(
                      '[data-product-visual]',
                    ) as HTMLElement | null
                    addToCart(p, visual ?? e.currentTarget)
                  }}
                />
              ))}
              </div>
              <div ref={productsSentinelRef} className="h-1 w-full shrink-0" aria-hidden />
              {(productsLoading || productsSearching) && products.length === 0 && (
                <div className="py-8 text-center text-stone-400 text-sm">
                  <div className="inline-block w-6 h-6 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {productsLoadingMore && (
                <div className="py-3 text-center text-stone-400 text-sm">
                  <div className="inline-block w-5 h-5 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!productsLoading && !productsSearching && products.length === 0 && (
                <div className="py-8 text-center text-stone-400 text-xs sm:text-sm">
                  No hay productos con este filtro.
                </div>
              )}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex shrink-0 flex-col min-h-0 w-[18.5rem] xl:w-[24rem] 2xl:w-[30rem]">
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-l-xl xl:rounded-l-2xl border border-stone-200/80 border-r-0 shadow-sm overflow-hidden">
              <div className="px-2 py-2 border-b border-stone-100 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      ref={desktopCartRef}
                      className="relative hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rest-50 text-rest-600"
                      aria-hidden
                    >
                      <ShoppingCart size={18} />
                      {totalCartQty > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold leading-none text-white tabular-nums ring-2 ring-white">
                          {totalCartQty > 99 ? '99+' : totalCartQty}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-stone-800 text-sm">Pedido</h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 min-w-0">
                    <CartClearButton disabled={cart.length === 0} onClear={clearPendingCart} />
                    <span className="text-xs text-stone-500 truncate max-w-[6rem]">{session.table_name}</span>
                  </div>
                </div>
              </div>
              {renderKitchenCartStrip()}
              <ul className="px-2 py-2 space-y-0.5 text-sm overflow-y-auto flex-1 min-h-0">
                {renderCartLines()}
              </ul>
              {renderCartTotals()}
              {renderCartActions()}
            </div>
          </div>
        </div>
      </main>

      {!cartDrawerOpen && (
        <FloatingCartButton
          ref={cartBtnRef}
          quantity={totalCartQty}
          onClick={() => setCartDrawerOpen(true)}
        />
      )}
      <FlyToCartLayer />

      <MobileCartDrawer
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        quantity={totalCartQty}
        pendingCartCount={cart.length}
        onClearCart={clearPendingCart}
        footer={
          <div className="shrink-0 border-t border-stone-200">
            {renderCartTotals()}
            <div className="p-3 pt-0">{renderCartActions()}</div>
          </div>
        }
      >
        {renderKitchenCartStrip()}
        <ul className="p-4 pt-2 space-y-0.5 text-sm flex-1 min-h-0 overflow-y-auto">
          {renderCartLines()}
        </ul>
      </MobileCartDrawer>

      {ordersModalOpen && (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} ${FIXED_OVERLAY_SAFE} overflow-y-auto`}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOrdersModalOpen(false)} aria-hidden="true" />
          <div className="relative flex justify-center">
            <div className={clsx('w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col', MAX_H_PANEL_85)}>
              <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-stone-800">Pedidos en mesa</h3>
                  <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-rest-600 text-white text-sm font-bold">
                    {activeSessionOrders.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canAnularComanda && countCancellableComandas(session) > 0 && (
                    <button
                      type="button"
                      onClick={() => void requestVoidComandas({ mode: 'all' })}
                      className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                    >
                      Anular todo
                    </button>
                  )}
                  {printableKitchenRounds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setKitchenHistoryOpen(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                    >
                      Historial
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOrdersModalOpen(false)}
                    className="p-2 rounded-xl hover:bg-stone-100 text-stone-600"
                    aria-label="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 bg-amber-50/60 border-b border-amber-100 text-[11px] text-amber-900">
                Detalle de comandas enviadas. El carrito solo agrega ítems nuevos.
              </div>
              <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3">
                {activeSessionOrders.length === 0 ? (
                  <p className="text-sm text-stone-500 text-center py-6">No hay ítems activos en pedidos</p>
                ) : (
                activeSessionOrders.map((ord) => {
                  const round = printableKitchenRounds.find((r) => r.orderId === ord.id)
                  return (
                  <div key={ord.id} className="rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-3 py-2 bg-stone-50/60 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-800">Comanda #{ord.order_number}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {canAnularComanda && countCancellableComandas(session, ord.id) > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void requestVoidComandas({
                                mode: 'round',
                                orderId: ord.id,
                                orderNumber: ord.order_number,
                              })
                            }
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Anular ronda
                          </button>
                        )}
                        {round && (
                          <button
                            type="button"
                            onClick={() => void reprintKitchenRound(round)}
                            className="text-xs font-semibold text-rest-600 hover:underline"
                          >
                            Reimprimir
                          </button>
                        )}
                        <span className="text-sm font-semibold text-rest-700 tabular-nums">
                          {formatSoles(
                            sumMoney(...(ord.comandas ?? []).map((c) => comandaLineTotal(c, taxRate, taxConfig))),
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <ul className="space-y-2 text-sm">
                        {ord.comandas?.map((c) => {
                          const mods = parseStoredModifiers(c.modifiers_json)
                          const summary = mods.length > 0 ? formatModifierSummary(mods) : ''
                          return (
                          <li key={c.id} className="flex items-start justify-between gap-2 text-stone-600">
                            <span className="min-w-0">
                              <span className="font-medium text-stone-800">
                                {c.quantity}x {c.product_name}
                              </span>
                              {summary ? (
                                <span className="block text-xs text-stone-500 mt-0.5">{summary}</span>
                              ) : null}
                              {c.notes?.trim() ? (
                                <span className="block text-xs text-amber-700 italic mt-0.5">Obs: {c.notes.trim()}</span>
                              ) : null}
                            </span>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="tabular-nums font-medium text-stone-800">
                                {formatSoles(comandaLineTotal(c, taxRate, taxConfig))}
                              </span>
                              {session.status === 'open' && canAnularComanda && (
                                <button
                                  type="button"
                                  onClick={() => { setAnulComanda(c); setAnulReason(''); setAnulPin('') }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded text-xs flex items-center gap-1"
                                  title="Anular comanda (requiere PIN)"
                                >
                                  <Trash2 size={12} /> Anular
                                </button>
                              )}
                            </div>
                          </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                  )
                })
                )}
              </div>
              <div className="p-4 border-t border-stone-200 bg-stone-50/30 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-stone-800">
                  <span>Total en mesa</span>
                  <span className="tabular-nums text-rest-700">{formatSoles(sessionTotal)}</span>
                </div>
                <div className="flex gap-2">
                  {printableKitchenRounds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void reprintAllKitchenRounds()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rest-600 text-white hover:bg-rest-700 font-medium"
                    >
                      <Printer size={16} />
                      Imprimir todas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOrdersModalOpen(false)}
                    className={`py-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 hover:bg-stone-50 font-medium ${
                      printableKitchenRounds.length > 0 ? 'px-4' : 'w-full'
                    }`}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <POSCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        loading={adding}
        title="Procesar venta"
        confirmLabel="Confirmar venta"
        rawTotal={totalToPay}
        payableTotal={payableTotal}
        billingSubtotal={billingSubtotal}
        discountMode={checkoutDiscountMode}
        discountValue={checkoutDiscountValue}
        onDiscountModeChange={setCheckoutDiscountMode}
        onDiscountValueChange={setCheckoutDiscountValue}
        igvAmount={checkoutTaxAmount}
        series={checkoutSeries}
        seriesId={seriesId}
        docType={docType}
        onSeriesChange={(sid, dt) => {
          setSeriesId(sid)
          setDocType(dt)
        }}
        contactId={effectiveContactId}
        contacts={contacts}
        onContactChange={setContactId}
        onAddContact={() => setClientQuickAddOpen(true)}
        onPreferVariosContact={() => {
          const variosId = pickVariosContactId(contacts)
          if (variosId) setContactId(variosId)
        }}
        paymentMethods={checkoutPaymentMethods}
        payments={payments}
        onPaymentsChange={setPayments}
        allowDiscount={allowCheckoutDiscount}
        onConfirm={doCheckout}
        confirmDisabled={!checkoutContactOk || !seriesId}
        sunatEnabled={sunatEnabled}
        canFactura={canFactura}
      />

      {/* Modal Precuenta */}
      {precuentaOpen && (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 ${FIXED_OVERLAY_SAFE}`}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-800">Precuenta</h3>
              <button onClick={() => setPrecuentaOpen(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-stone-500 mb-3">Detalle para que el cliente revise antes de pagar.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500 text-xs">
                    <th className="py-2 pr-1 w-12 text-center">Cant.</th>
                    <th className="py-2 pr-2">Descripción</th>
                    <th className="py-2 text-right w-20">P.U.</th>
                    <th className="py-2 text-right w-20">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessionOrders.flatMap((ord) =>
                    ord.comandas.map((c) => (
                      <tr key={c.id} className="border-b border-stone-100">
                        <td className="py-2 text-center tabular-nums">{c.quantity}</td>
                        <td className="py-2 pr-2">
                          <div>{c.product_name}</div>
                          {formatModifierLines(parseStoredModifiers(c.modifiers_json)).map((line) => (
                            <div key={line} className="text-xs text-stone-500 pl-2">
                              {line}
                            </div>
                          ))}
                          {c.notes?.trim() ? (
                            <div className="text-xs text-amber-700 italic pl-2">Obs: {c.notes.trim()}</div>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatSoles(Number(c.unit_price))}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {formatSoles(comandaLineTotal(c, taxRate, taxConfig))}
                        </td>
                      </tr>
                    )) ?? []
                  )}
                  {cart.map((item, i) => (
                    <tr key={`cart-${cartLineKey(item, i)}`} className="border-b border-stone-100">
                      <td className="py-2 text-center tabular-nums">{item.quantity}</td>
                      <td className="py-2 pr-2">
                        {cartLineLabel(item)}
                        {item.kind === 'catalog' &&
                          formatModifierLines(item.modifiers).map((line) => (
                            <div key={line} className="text-xs text-stone-500 pl-2">
                              {line}
                            </div>
                          ))}
                        {item.notes?.trim() ? (
                          <div className="text-xs text-stone-500">{item.notes.trim()}</div>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatSoles(cartLineUnitPrice(item))}</td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {formatSoles(cartLineTotal(item, taxRate, taxConfig))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t-2 border-stone-200 flex justify-between items-center font-bold text-stone-800">
                <span>Total a pagar</span>
                <span className="text-lg tabular-nums">{formatSoles(totalToPay)}</span>
              </div>
              <p className="mt-4 text-sm text-stone-600 border-b border-stone-400 pb-1">
                Documento:{' '}
                <span className="inline-block min-w-[12rem] border-b border-stone-400">&nbsp;</span>
              </p>
            </div>
            <div className="p-4 border-t border-stone-200">
              <div className="flex gap-2">
                {isNativePrintAvailable() && getConfiguredPrinter('precuenta') && (
                  <button
                    type="button"
                    onClick={() => void printPrecuenta()}
                    className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl font-medium hover:bg-rest-700"
                  >
                    Reimprimir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPrecuentaOpen(false)}
                  className="flex-1 py-2.5 bg-stone-200 text-stone-800 rounded-xl font-medium hover:bg-stone-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comanda */}
      {comandaModal && (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 ${FIXED_OVERLAY_SAFE}`}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-800">Comanda</h3>
              <button onClick={() => setComandaModal(null)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-stone-600">
                {session?.table_name ?? 'Pedido rápido'} · Pedido #{comandaModal.orderNumber}
              </p>
              <div className="mt-3 border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-center w-20">Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comandaModal.comandas.map((c) => (
                      <tr key={c.id} className="border-b border-stone-100 last:border-0 align-top">
                        <td className="py-2 px-3">
                          <ComandaLineDisplay comanda={c} />
                          <ComandaNoteEditor comanda={c} onUpdated={patchComandaNote} />
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-stone-800 align-top">
                          {c.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-stone-200">
              <div className="flex gap-2">
                {isNativePrintAvailable() && getConfiguredPrinter('comandas') && (
                  <button
                    type="button"
                    onClick={() =>
                      void reprintKitchenRound({
                        orderId: comandaModal.orderId,
                        orderNumber: comandaModal.orderNumber,
                        comandas: comandaModal.comandas,
                        allDelivered: false,
                      })
                    }
                    className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl font-medium hover:bg-rest-700"
                  >
                    Reimprimir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setComandaModal(null)}
                  className="flex-1 py-2.5 bg-stone-200 text-stone-800 rounded-xl font-medium hover:bg-stone-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <VoidOrderPinModal
        open={voidComandasTarget != null}
        title={
          voidComandasTarget?.mode === 'round'
            ? `Anular comanda #${voidComandasTarget.orderNumber}`
            : 'Vaciar comandas de la mesa'
        }
        orderLabel={
          voidComandasTarget
            ? `${countCancellableComandas(
                session,
                voidComandasTarget.mode === 'round' ? voidComandasTarget.orderId : undefined,
              )} ítem(s) por anular`
            : undefined
        }
        description={
          voidComandasTarget?.mode === 'round'
            ? 'Se anularán todos los ítems de esta ronda. La mesa sigue abierta.'
            : 'Se anularán todas las comandas activas de la mesa. La mesa sigue abierta para nuevos pedidos.'
        }
        confirmLabel="Anular todo"
        pinHint="Mismo PIN configurado en Ajustes → Restaurante."
        onClose={() => setVoidComandasTarget(null)}
        onConfirm={async (reason, pin) => {
          if (!voidComandasTarget || !id) return
          try {
            const res = await restaurantService.cancelAllComandas(id, {
              reason: reason.trim(),
              pin: pin.trim(),
              ...(voidComandasTarget.mode === 'round'
                ? { order_id: voidComandasTarget.orderId }
                : {}),
            })
            toast.success(
              res.data?.cancelled_count === 1
                ? '1 ítem anulado'
                : `${res.data?.cancelled_count ?? 0} ítems anulados`,
            )
            setVoidComandasTarget(null)
            load({ silent: true })
          } catch (e: unknown) {
            toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al anular')
            throw e
          }
        }}
      />

      {/* Modal Anular comanda */}
      {anulComanda && (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 ${FIXED_OVERLAY_SAFE}`}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-stone-800 mb-2">Anular comanda</h3>
            <p className="text-sm text-stone-600 mb-4">
              {anulComanda.product_name} x{anulComanda.quantity} —{' '}
              {formatSoles(comandaLineTotal(anulComanda, taxRate, taxConfig))}
            </p>
            <p className="text-xs text-rest-700 mb-3">Se requiere el PIN de operaciones (Ajustes → Restaurante).</p>
            <input
              value={anulReason}
              onChange={(e) => setAnulReason(e.target.value)}
              placeholder="Motivo de anulación"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mb-2"
            />
            <input
              type="password"
              value={anulPin}
              onChange={(e) => setAnulPin(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN"
              maxLength={6}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAnulComanda(null); setAnulReason(''); setAnulPin('') }}
                className="flex-1 py-2 border border-stone-200 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAnulComanda}
                disabled={adding || !anulReason.trim() || !anulPin.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-red-700"
              >
                {adding ? '...' : 'Anular'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PortalModal open={clientQuickAddOpen} onClose={() => setClientQuickAddOpen(false)} className="max-w-md" stacked>
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">Registrar cliente</h3>
              <button type="button" onClick={() => setClientQuickAddOpen(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[9.5rem] shrink-0">
                  <SearchableSelect
                    value={toContactDocCode(clientQuickAdd.doc_type)}
                    onChange={(v) =>
                      setClientQuickAdd((q) => ({
                        ...q,
                        doc_type: String(v ?? '6'),
                        doc_number: '',
                      }))
                    }
                    options={contactDocSelectOptions()}
                    searchable={false}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
                <input
                  type="text"
                  value={clientQuickAdd.doc_number}
                  onChange={(e) =>
                    setClientQuickAdd((q) => ({
                      ...q,
                      doc_number: sanitizeContactDocNumber(q.doc_type, e.target.value),
                    }))
                  }
                  placeholder={contactDocNumberPlaceholder(clientQuickAdd.doc_type)}
                  className="flex-1 min-w-[6rem] border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
                {contactDocSupportsConsulta(clientQuickAdd.doc_type) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ruc = (await companyService.getConfig()).ruc
                      if (!ruc) {
                        toast.error('No se pudo obtener RUC de la empresa')
                        return
                      }
                      setConsultaLoading(true)
                      try {
                        const docCode = toContactDocCode(clientQuickAdd.doc_type)
                        if (docCode === '6') {
                          const res = await consultaService.ruc(ruc, clientQuickAdd.doc_number)
                          if (res.success) {
                            setClientQuickAdd((q) => ({
                              ...q,
                              business_name: res.razon_social ?? '',
                              address: res.direccion_completa ?? res.direccion ?? '',
                            }))
                            toast.success('Datos obtenidos')
                          } else toast.error('RUC no encontrado')
                        } else {
                          const res = await consultaService.dni(ruc, clientQuickAdd.doc_number)
                          if (res.success) {
                            setClientQuickAdd((q) => ({
                              ...q,
                              business_name: res.nombre_completo ?? '',
                              address: '',
                            }))
                            toast.success('Datos obtenidos')
                          } else toast.error('DNI no encontrado')
                        }
                      } catch {
                        toast.error('Error al consultar')
                      } finally {
                        setConsultaLoading(false)
                      }
                    }}
                    disabled={
                      consultaLoading ||
                      clientQuickAdd.doc_number.length < contactDocConsultMinLength(clientQuickAdd.doc_type)
                    }
                    className="px-3 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 disabled:opacity-50"
                  >
                    {consultaLoading ? '...' : 'Consultar'}
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Razón social / Nombre</label>
                <input
                  value={clientQuickAdd.business_name}
                  onChange={(e) => setClientQuickAdd((q) => ({ ...q, business_name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Obligatorio"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Dirección (opcional)</label>
                <input
                  value={clientQuickAdd.address}
                  onChange={(e) => setClientQuickAdd((q) => ({ ...q, address: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setClientQuickAddOpen(false)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  createContactLoading ||
                  !clientQuickAdd.business_name.trim() ||
                  !clientQuickAdd.doc_number.trim()
                }
                onClick={async () => {
                  setCreateContactLoading(true)
                  try {
                    const data: CreateContactInput = {
                      type: 'customer',
                      doc_type: toContactDocCode(clientQuickAdd.doc_type),
                      doc_number: clientQuickAdd.doc_number.trim(),
                      business_name: clientQuickAdd.business_name.trim(),
                      address: clientQuickAdd.address || undefined,
                    }
                    const created = await contactsService.create(data)
                    setContacts((c) => [...c, created])
                    setContactId(created.id)
                    toast.success('Cliente registrado')
                    setClientQuickAddOpen(false)
                    setClientQuickAdd({ doc_type: '6', doc_number: '', business_name: '', address: '' })
                  } catch (e: unknown) {
                    toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
                  } finally {
                    setCreateContactLoading(false)
                  }
                }}
                className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {createContactLoading ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
      </PortalModal>

      <KitchenRoundHistoryModal
        open={kitchenHistoryOpen}
        onClose={() => setKitchenHistoryOpen(false)}
        rounds={kitchenRoundHistory}
        orderCode={session?.order_code}
        onReprint={(round) => void reprintKitchenRound(round)}
        onReprintAll={() => void reprintAllKitchenRounds()}
        showReprintAll={printableKitchenRounds.length > 0}
      />

      <ReceiptPrintModal
        open={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false)
          setPrintData(null)
          setLastSale(null)
          navigate('/salas')
        }}
        printData={printData}
        saleId={lastSale?.id}
        saleNumber={lastSale?.number}
        total={lastSale?.total}
        defaultEmail={lastSale?.clientEmail}
      />

      <ManualProductModal
        open={manualProductOpen}
        onClose={() => setManualProductOpen(false)}
        onAdd={(line: ManualCartLine) => {
          setCart((c) => [...c, line])
          playCartAddSound()
        }}
      />

      <ProductConfigureModal
        key={configureProduct?.id ?? 'closed'}
        product={configureProduct}
        onClose={() => {
          configureFlySourceRef.current = undefined
          configuringRef.current = false
          cancelFlyAnimations()
          setConfigureProduct(null)
        }}
        onConfirm={onConfiguredProduct}
      />
    </div>
  )
}
