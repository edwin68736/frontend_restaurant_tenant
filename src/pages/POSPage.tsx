import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import {
  X,
  ShoppingCart,
  Trash2,
  FileText,
  ChefHat,
  Save,
  Menu,
  Package,
  Bike,
  Zap,
  ScanBarcode,
  Plus,
} from 'lucide-react'
import { SearchInput } from '@/components/SearchInput'
import { PosProductGridCard } from '@/components/pos/PosProductGridCard'
import { PosProductListRow } from '@/components/pos/PosProductListRow'
import { PosProductViewModeToggle } from '@/components/pos/PosProductViewModeToggle'
import {
  readPosProductViewMode,
  savePosProductViewMode,
  type PosProductViewMode,
} from '@/utils/posProductViewMode'
import { usePosInfiniteProducts } from '@/hooks/usePosInfiniteProducts'
import { restaurantService, type Comanda, type SessionDetail } from '@/services/restaurant.service'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'
import { PortalModal } from '@/components/ui/PortalModal'
import { MAX_H_PANEL_80, MAX_H_PANEL_85 } from '@/utils/safeAreaClasses'
import type { PrintData } from '@/types/printData'
import { productsService, type Product, type Category, getProductImageUrl } from '@/services/products.service'
import { sortCategories } from '@/utils/sortCategories'
import { findProductByBarcodeInList } from '@/utils/barcodeLookup'
import { posFastCheckoutEnabled } from '@/config/featureFlags'
import { companyService, pickDefaultNotaVentaSeries } from '@/services/company.service'
import { contactsService, type Contact, type CreateContactInput } from '@/services/contacts.service'
import { cashbankService, type BankAccount, type PaymentMethodRecord } from '@/services/cashbank.service'
import { consultaService } from '@/services/consulta.service'
import { resolveTaxRatePercent } from '@/constants/tax'
import { SearchableSelect } from '@/components/SearchableSelect'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import { useBranchCheckoutSeries } from '@/contexts/BranchCheckoutSeriesContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { canApplyCheckoutDiscount, canCancelOrder } from '@/utils/restaurantPermissions'
import {
  getConfiguredPrinter,
  isAutoPrintEnabled,
  isNativePrintAvailable,
  printDocumentAuto,
  printPrecuentaAuto,
} from '@/services/printers.service'
import { findPaymentMethodRecord, isPaymentMethodLinkedForSale, normalizePaymentMethodCodeForLookup } from '@/utils/paymentMethodCheckout'
import { defaultOperationalPaymentCode, filterOperationalPaymentMethods } from '@/utils/operationalPaymentMethods'
import { ORDER_TYPE_LABELS, ORDER_STATUS_LABELS, type DeliveryDriver, type PrecuentaPayload, type RestaurantOrderSummary } from '@/types/restaurantOrder'
import { VoidOrderPinModal } from '@/components/restaurant/VoidOrderPinModal'
import { FloatingCartButton } from '@/components/restaurant/FloatingCartButton'
import { MobileCartDrawer } from '@/components/restaurant/MobileCartDrawer'
import { useFlyToCart } from '@/hooks/useFlyToCart'
import { isCapacitorNative } from '@/lib/app'
import { PosBarcodeScannerModal } from '@/components/pos/PosBarcodeScannerModal'
import { cartToOrderItems, collectCheckoutLineTaxTotals, comandaLineTotal, countCancellableComandas, formatPrecuentaIssueDate, getActiveKitchenRounds, getOrderRoundHistory, precuentaApiLineToPrintItem, type KitchenRound } from '@/utils/posOrderHelpers'
import { printAllKitchenRounds, printKitchenRound } from '@/utils/kitchenPrint'
import {
  appendCatalogLine,
  applyCatalogLineUnitPrice,
  buildCatalogConfigureKey,
  cartLineKey,
  cartLineTaxTotals,
  cartLineTotal,
  createCatalogCartLine,
  sumCartQty,
  type CatalogCartLine,
  type ManualCartLine,
  type PosCartLine,
} from '@/utils/posCart'
import { roundMoney } from '@/utils/checkoutDiscount'
import { productNeedsConfiguration } from '@/utils/productModifiers'
import { ProductConfigureModal } from '@/components/pos/ProductConfigureModal'
import { CartClearButton } from '@/components/pos/CartClearButton'
import { playCartAddSound, playCartClearSound, playCartRemoveSound } from '@/utils/cartSounds'
import { ComandaLineDisplay } from '@/components/pos/ComandaLineDisplay'
import { formatModifierLines, formatModifierSummary, parseStoredModifiers } from '@/utils/productModifiers'
import { ManualProductModal } from '@/components/pos/ManualProductModal'
import { PosCartLineRow } from '@/components/pos/PosCartLineRow'
import { ComandaNoteEditor } from '@/components/pos/ComandaNoteEditor'
import { KitchenRoundHistoryModal } from '@/components/restaurant/KitchenRoundHistoryModal'
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
import { BranchCheckoutSeriesEmptyState } from '@/components/pos/BranchCheckoutSeriesEmptyState'
import {
  applyCheckoutDiscountToLines,
  buildRestaurantBillDiscount,
  type CheckoutDiscountMode,
} from '@/utils/checkoutDiscount'
import { paidCoversTotal, roundSunat, sumMoney } from '@/utils/money'
import { formatMoney, formatSoles } from '@/utils/format'
import {
  orderStatusBadgeClasses,
  orderTypeCardAccentClasses,
  orderTypeChipClasses,
  pendingOrdersButtonClasses,
  pendingOrdersButtonIconClasses,
  pendingQueueBadgeClasses,
  pendingQueueLargeBadgeClasses,
  posOrderTypeButtonClasses,
} from '@/utils/restaurantUiColors'

const POS_SCANNER_STORAGE_KEY = 'tukichef-pos-scanner-mode'
type PosOrderType = 'takeaway' | 'delivery' | 'quick_sale'

function readScannerModePreference(): boolean {
  try {
    return localStorage.getItem(POS_SCANNER_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export default function POSPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { employeeType, restaurantPermissions } = useAuth()
  const { activeBranchId, activeBranch, resetEpoch } = useBranch()
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
  const allowCheckoutDiscount = canApplyCheckoutDiscount(restaurantPermissions, employeeType)
  const allowCancelOrder = canCancelOrder(restaurantPermissions, employeeType)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [preparationAreaFilter, setPreparationAreaFilter] = useState<string | null>(null)
  const productsScrollRef = useRef<HTMLDivElement>(null)
  const productsSentinelRef = useRef<HTMLDivElement>(null)
  const [sunat, setSunat] = useState<{ tax_rate?: number; igv_regime?: string; tax_benefit_zone?: boolean } | null>(null)
  const [cart, setCart] = useState<PosCartLine[]>([])
  const [manualProductOpen, setManualProductOpen] = useState(false)
  const [configureProduct, setConfigureProduct] = useState<Product | null>(null)
  const configureFlySourceRef = useRef<HTMLElement | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [seriesId, setSeriesId] = useState(0)
  const [docType, setDocType] = useState('NOTA DE VENTA')
  const [contactId, setContactId] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([])
  const checkoutPaymentMethods = useMemo(() => filterOperationalPaymentMethods(paymentMethods), [paymentMethods])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [payments, setPayments] = useState<{ method: string; amount: number; reference?: string }[]>([
    { method: 'cash', amount: 0, reference: '' },
  ])
  const [checkoutDiscountMode, setCheckoutDiscountMode] = useState<CheckoutDiscountMode>('percent')
  const [checkoutDiscountValue, setCheckoutDiscountValue] = useState(0)
  const [printData, setPrintData] = useState<PrintData | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [lastSale, setLastSale] = useState<{
    id: number
    number: string
    total: number
    clientEmail?: string
  } | null>(null)
  const [clientQuickAddOpen, setClientQuickAddOpen] = useState(false)
  const [clientQuickAdd, setClientQuickAdd] = useState({ doc_type: '6', doc_number: '', business_name: '', address: '' })
  const [consultaLoading, setConsultaLoading] = useState(false)
  const [createContactLoading, setCreateContactLoading] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const cartBtnRef = useRef<HTMLButtonElement>(null)
  const desktopCartRef = useRef<HTMLDivElement>(null)
  const { flyToCart, FlyToCartLayer, cancelFlyAnimations } = useFlyToCart(cartBtnRef, { desktopCartRef })
  const configuringRef = useRef(false)
  const [posOrderType, setPosOrderType] = useState<PosOrderType>('quick_sale')
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [comandaModal, setComandaModal] = useState<{ orderId: number; orderNumber: number; comandas: Comanda[] } | null>(null)
  const [kitchenHistoryOpen, setKitchenHistoryOpen] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [sessionTotal, setSessionTotal] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryReference, setDeliveryReference] = useState('')
  const [deliveryDriverId, setDeliveryDriverId] = useState<number | null>(null)
  const [estimatedMinutes, setEstimatedMinutes] = useState(30)
  const [orderNotes, setOrderNotes] = useState('')
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([])
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [openOrdersList, setOpenOrdersList] = useState<RestaurantOrderSummary[]>([])
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false)
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false)
  const [precuentaOpen, setPrecuentaOpen] = useState(false)
  const [precuentaData, setPrecuentaData] = useState<PrecuentaPayload | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [orderDetailsModal, setOrderDetailsModal] = useState<'takeaway' | 'delivery' | null>(null)
  const [voidOrderTarget, setVoidOrderTarget] = useState<RestaurantOrderSummary | null>(null)
  const [voidComandasTarget, setVoidComandasTarget] = useState<
    { mode: 'all' } | { mode: 'round'; orderId: number; orderNumber: number } | null
  >(null)
  const [scannerMode, setScannerMode] = useState(readScannerModePreference)
  const [productViewMode, setProductViewMode] = useState<PosProductViewMode>(readPosProductViewMode)
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false)
  const [scanProcessing, setScanProcessing] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const useCameraBarcodeScanner = isCapacitorNative()

  const loadSession = useCallback(async (sessionId: number): Promise<SessionDetail> => {
    const detail = await restaurantService.getSession(sessionId)
    setActiveSessionId(detail.id)
    setOrderCode(detail.order_code ?? '')
    setOrderStatus(detail.order_status ?? '')
    setSessionTotal(detail.total_amount ?? 0)
    setCustomerName(detail.customer_name ?? detail.contact_name ?? '')
    setCustomerPhone(detail.customer_phone ?? '')
    setDeliveryAddress(detail.delivery_address ?? '')
    setDeliveryReference(detail.delivery_reference ?? '')
    setDeliveryDriverId(detail.delivery_driver_id ?? null)
    setEstimatedMinutes(detail.estimated_minutes ?? 30)
    setOrderNotes(detail.notes ?? '')
    if (detail.order_type === 'delivery' || detail.order_type === 'takeaway' || detail.order_type === 'quick_sale') {
      setPosOrderType(detail.order_type as PosOrderType)
    }
    if (detail.contact_id) setContactId(detail.contact_id)
    setSessionDetail(detail)
    setCart([])
    return detail
  }, [])

  useEffect(() => {
    const sid = searchParams.get('session')
    if (sid && /^\d+$/.test(sid)) {
      loadSession(Number(sid)).catch(() => toast.error('No se pudo cargar el pedido'))
    }
  }, [searchParams, loadSession])

  const loadPendingOrders = useCallback(async (opts?: { silent?: boolean; modal?: boolean }) => {
    if (!activeBranchId) return
    if (!opts?.silent) setPendingOrdersLoading(true)
    if (opts?.modal) setOpenOrdersLoading(true)
    try {
      const rows = await restaurantService.listOpenOrders('all')
      const filtered = rows.filter((o) => o.order_type === 'takeaway' || o.order_type === 'delivery')
      setOpenOrdersList(filtered)
    } catch {
      setOpenOrdersList([])
      if (!opts?.silent) toast.error('No se pudieron cargar los pedidos')
    } finally {
      setPendingOrdersLoading(false)
      setOpenOrdersLoading(false)
    }
  }, [activeBranchId])

  const requestVoidOrder = async (order: RestaurantOrderSummary) => {
    try {
      const ok = await restaurantService.ensureDeletionPinConfigured()
      if (!ok) {
        toast.error('Configure el PIN de operaciones en Ajustes → Restaurante')
        return
      }
      setVoidOrderTarget(order)
    } catch {
      toast.error('No se pudo verificar el PIN de seguridad')
    }
  }

  const requestVoidActiveSession = () => {
    if (!activeSessionId) return
    void requestVoidOrder({
      id: activeSessionId,
      order_code: orderCode,
      order_type: posOrderType,
      order_status: orderStatus ?? 'pending',
      total_amount: sessionTotal,
    } as RestaurantOrderSummary)
  }

  const requestVoidComandas = async (
    target: { mode: 'all' } | { mode: 'round'; orderId: number; orderNumber: number },
  ) => {
    if (!activeSessionId) return
    const count =
      target.mode === 'all'
        ? countCancellableComandas(sessionDetail)
        : countCancellableComandas(sessionDetail, target.orderId)
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

  useEffect(() => {
    void loadPendingOrders({ silent: true })
  }, [activeBranchId, resetEpoch, loadPendingOrders])

  useEffect(() => {
    if (!ordersOpen) return
    void loadPendingOrders({ silent: true, modal: true })
  }, [ordersOpen, loadPendingOrders])

  const loadPosMeta = useCallback(() => {
    if (!activeBranchId) return
    productsService.listCategories().then((rows) => setCategories(sortCategories(rows)))
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
    restaurantService.listDeliveryDrivers(true).then(setDrivers).catch(() => setDrivers([]))
  }, [activeBranchId])

  useEffect(() => {
    loadPosMeta()
  }, [loadPosMeta])

  useEffect(() => {
    const def = pickDefaultNotaVentaSeries(checkoutSeries)
    if (def) {
      setSeriesId(def.id)
      setDocType(String(def.doc_type || '').trim() || 'NOTA DE VENTA')
    } else {
      setSeriesId(0)
    }
  }, [checkoutSeries])

  const {
    products,
    hasMore,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    isSearching: productsSearching,
    stockByProductId,
    loadMore: loadMoreProducts,
    refresh: refreshProducts,
    search: productSearch,
  } = usePosInfiniteProducts({
    activeBranchId,
    categoryFilter,
    preparationAreaFilter,
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'No se pudieron cargar los productos'
      toast.error(msg)
    },
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

  const branchSeriesMissing = Boolean(activeBranchId) && seriesMetaReady && !hasCheckoutSeries
  const seriesEmptyReason = seriesLoadError
    ? 'load_error'
    : seriesOnOtherBranches
      ? 'other_branch'
      : 'missing'

  useOnBranchChange(() => {
    setCart([])
    setCheckoutOpen(false)
    setActiveSessionId(null)
    setSessionDetail(null)
    setComandaModal(null)
    setOrderCode('')
    setSessionTotal(0)
    loadPosMeta()
    refreshProducts()
    void loadPendingOrders({ silent: true })
  })

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

  const categoriesWithProducts = useMemo(() => sortCategories(categories), [categories])

  const preparationAreas = useMemo(() => {
    const areas = new Set(products.map((p) => p.preparation_area || '').filter(Boolean))
    return Array.from(areas).sort((a, b) => a.localeCompare(b))
  }, [products])

  const taxRate = resolveTaxRatePercent(sunat?.tax_rate)
  const taxConfig = { taxRate, igvRegime: sunat?.igv_regime, taxBenefitZone: sunat?.tax_benefit_zone }

  // Delega en cartLineTaxTotals para que el total (a pagar) excluya la bonificación gravada ('15'),
  // igual que la etiqueta de subtotal por línea. Así el "Total a pagar" del modal no cobra la bonificación.
  const getCartItemTotals = (item: PosCartLine) => cartLineTaxTotals(item, taxRate, taxConfig)

  const cartTotal = useMemo(
    () => sumMoney(...cart.map((i) => getCartItemTotals(i).total)),
    [cart, taxRate, taxConfig.igvRegime, taxConfig.taxBenefitZone]
  )
  const total = sumMoney(cartTotal, sessionTotal)

  const checkoutLineTax = useMemo(
    () => collectCheckoutLineTaxTotals(cart, sessionDetail, taxRate, taxConfig),
    [cart, sessionDetail, taxRate, taxConfig.igvRegime, taxConfig.taxBenefitZone],
  )
  const checkoutBilling = useMemo(
    () => applyCheckoutDiscountToLines(checkoutLineTax, checkoutDiscountMode, checkoutDiscountValue),
    [checkoutLineTax, checkoutDiscountMode, checkoutDiscountValue],
  )
  const billingSubtotal = useMemo(
    () => roundSunat(checkoutLineTax.reduce((acc, line) => acc + line.subtotal, 0)),
    [checkoutLineTax],
  )
  const payableTotal = allowCheckoutDiscount ? checkoutBilling.payableTotal : total
  const checkoutTaxAmount = checkoutBilling.taxAmount

  const cartQty = sumCartQty(cart)
  const activeKitchenRounds = useMemo(() => getActiveKitchenRounds(sessionDetail), [sessionDetail])
  const kitchenRoundHistory = useMemo(() => getOrderRoundHistory(sessionDetail), [sessionDetail])
  const printableKitchenRounds = useMemo(
    () => kitchenRoundHistory.filter((r) => r.comandas.length > 0),
    [kitchenRoundHistory],
  )
  const pendingOrdersCount = openOrdersList.length
  const hasPendingOrders = pendingOrdersCount > 0
  const isDirectSale = posOrderType === 'quick_sale'
  const isRestaurantOrder = !isDirectSale
  const takeawayHasDetails = !!(customerName.trim() || customerPhone.trim() || orderNotes.trim())
  const deliveryHasDetails = !!(deliveryAddress.trim() || deliveryReference.trim() || deliveryDriverId)

  const applyPosOrderType = (next: PosOrderType) => {
    if (activeSessionId && posOrderType !== next) {
      setActiveSessionId(null)
      setSessionDetail(null)
      setOrderCode('')
      setOrderStatus('')
      setSessionTotal(0)
      setCart([])
      setSearchParams({})
      toast.info('Se inició un pedido nuevo')
    }
    setPosOrderType(next)
    if (next === 'quick_sale') setOrderDetailsModal(null)
  }

  const deliveryDriverLabel =
    deliveryDriverId != null
      ? drivers.find((d) => d.id === deliveryDriverId)?.name ?? sessionDetail?.driver_name
      : sessionDetail?.driver_name

  const renderOrderCustomerInfo = () => {
    if (!isRestaurantOrder || !activeSessionId) return null
    const editBtn = (
      <button
        type="button"
        onClick={() => setOrderDetailsModal(posOrderType === 'delivery' ? 'delivery' : 'takeaway')}
        className="text-[10px] font-medium text-rest-600 hover:underline shrink-0"
      >
        Editar datos
      </button>
    )
    if (posOrderType === 'takeaway') {
      if (!customerName.trim() && !customerPhone.trim() && !orderNotes.trim()) {
        return (
          <button
            type="button"
            onClick={() => setOrderDetailsModal('takeaway')}
            className="w-full text-left text-xs text-rest-600 hover:underline rounded-lg border border-dashed border-stone-300 px-2 py-1.5"
          >
            + Datos para llevar (nombre, teléfono, notas)
          </button>
        )
      }
      return (
        <div className="text-xs text-stone-600 rounded-lg border border-stone-200 bg-white px-2 py-1.5 space-y-0.5">
          <div className="flex justify-between gap-2 items-start">
            <span className="font-semibold text-stone-700">Para llevar</span>
            {editBtn}
          </div>
          {customerName.trim() && <p className="truncate"><span className="text-stone-500">Cliente:</span> {customerName}</p>}
          {customerPhone.trim() && <p><span className="text-stone-500">Tel.:</span> {customerPhone}</p>}
          {orderNotes.trim() && <p className="line-clamp-2"><span className="text-stone-500">Notas:</span> {orderNotes}</p>}
        </div>
      )
    }
    if (posOrderType === 'delivery') {
      return (
        <div className="text-xs text-stone-600 rounded-lg border border-violet-200 bg-violet-50/50 px-2 py-1.5 space-y-0.5">
          <div className="flex justify-between gap-2 items-start">
            <span className="font-semibold text-violet-900">Delivery</span>
            {editBtn}
          </div>
          {deliveryAddress.trim() && <p className="line-clamp-2"><span className="text-stone-500">Dir.:</span> {deliveryAddress}</p>}
          {deliveryReference.trim() && <p className="truncate"><span className="text-stone-500">Ref.:</span> {deliveryReference}</p>}
          {deliveryDriverLabel && <p><span className="text-stone-500">Repartidor:</span> {deliveryDriverLabel}</p>}
          {customerName.trim() && <p className="truncate"><span className="text-stone-500">Cliente:</span> {customerName}</p>}
          {customerPhone.trim() && <p><span className="text-stone-500">Tel.:</span> {customerPhone}</p>}
        </div>
      )
    }
    return null
  }

  const reprintKitchenRound = async (round: KitchenRound) => {
    if (round.comandas.length === 0) return
    const printed = await printKitchenRound({
      sessionDetail,
      orderCode,
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
    if (printableKitchenRounds.length === 0) return
    const printed = await printAllKitchenRounds({
      sessionDetail,
      orderCode,
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

  const renderSentKitchenBlock = () => {
    if (!isRestaurantOrder || activeKitchenRounds.length === 0) return null
    const cancellableAll = countCancellableComandas(sessionDetail)
    return (
      <div className="px-2 py-2 border-b border-amber-200/80 bg-amber-50/50 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-semibold text-amber-900">Ya en cocina</p>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {allowCancelOrder && cancellableAll > 0 && (
              <button
                type="button"
                onClick={() => void requestVoidComandas({ mode: 'all' })}
                className="text-[10px] font-semibold text-red-600 hover:underline"
              >
                Anular todo
              </button>
            )}
            {printableKitchenRounds.length > 0 && (
              <button
                type="button"
                onClick={() => void reprintAllKitchenRounds()}
                className="text-[10px] font-semibold text-rest-600 hover:underline"
              >
                Imprimir todas
              </button>
            )}
            {printableKitchenRounds.length > 0 && (
              <button
                type="button"
                onClick={() => setKitchenHistoryOpen(true)}
                className="text-[10px] font-semibold text-rest-600 hover:underline"
              >
                Historial
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2 max-h-36 overflow-y-auto">
          {activeKitchenRounds.map((round) => (
            <div key={round.orderId} className="rounded-lg border border-amber-200/60 bg-white/90 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-stone-700">Comanda #{round.orderNumber}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {allowCancelOrder && countCancellableComandas(sessionDetail, round.orderId) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void requestVoidComandas({
                          mode: 'round',
                          orderId: round.orderId,
                          orderNumber: round.orderNumber,
                        })
                      }
                      className="text-[10px] font-semibold text-red-600 hover:underline"
                    >
                      Anular ronda
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void reprintKitchenRound(round)}
                    className="text-[10px] font-semibold text-rest-600 hover:underline"
                  >
                    Reimprimir
                  </button>
                </div>
              </div>
              <ul className="text-[11px] text-stone-600 space-y-0.5">
                {round.comandas.map((c) => {
                  const mods = parseStoredModifiers(c.modifiers_json)
                  const summary = mods.length > 0 ? formatModifierSummary(mods) : ''
                  return (
                    <li key={c.id} className="flex justify-between gap-1 text-[11px] text-stone-600">
                      <span className="truncate min-w-0">
                        {c.quantity}x {c.product_name}
                        {summary ? ` · ${summary}` : ''}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium text-stone-700">
                        {formatSoles(comandaLineTotal(c, taxRate, taxConfig))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-500 mt-1.5 leading-snug">
          El carrito solo tiene ítems nuevos. Comanda envía otra ronda sin repetir lo ya impreso.
        </p>
      </div>
    )
  }

  const renderCartHeader = () => (
    <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/50 shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {orderCode ? (
            <>
              <h2 className="font-semibold text-stone-800 text-sm leading-tight truncate">{orderCode}</h2>
              {orderStatus && (
                <p className="text-xs text-stone-500 truncate flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className={orderStatusBadgeClasses(orderStatus)}>
                    {ORDER_STATUS_LABELS[orderStatus] ?? orderStatus}
                  </span>
                  {sessionTotal > 0 && <span>{formatSoles(sessionTotal)}</span>}
                </p>
              )}
              {hasPendingOrders && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={pendingQueueBadgeClasses()}>{pendingOrdersCount}</span>
                  <span className="text-xs font-medium text-orange-800">
                    {pendingOrdersCount === 1 ? 'pendiente en cola' : 'pendientes en cola'}
                  </span>
                </div>
              )}
            </>
          ) : pendingOrdersLoading ? (
            <span className="text-sm text-stone-400">Cargando…</span>
          ) : hasPendingOrders ? (
            <div className="flex items-center gap-2">
              <span
                className={pendingQueueLargeBadgeClasses()}
                aria-label={`${pendingOrdersCount} pedidos pendientes`}
              >
                {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
              </span>
              <span className="text-sm font-semibold text-stone-800 leading-snug">
                {pendingOrdersCount === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
              </span>
            </div>
          ) : (
            <span className="text-sm text-stone-500">0 pedidos pendientes</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isRestaurantOrder && activeSessionId && allowCancelOrder && (
            <button
              type="button"
              onClick={requestVoidActiveSession}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 border border-red-100 hover:bg-red-50"
              title="Anular pedido completo"
            >
              <Trash2 size={12} /> Anular pedido
            </button>
          )}
          <CartClearButton disabled={cart.length === 0} onClear={clearPendingCart} />
          <div
            ref={desktopCartRef}
            className="relative hidden lg:flex h-9 w-9 items-center justify-center rounded-full bg-rest-50 text-rest-600"
            aria-hidden
          >
            <ShoppingCart size={18} />
            {cartQty > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold leading-none text-white tabular-nums ring-2 ring-white">
                {cartQty > 99 ? '99+' : cartQty}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOrdersOpen(true)}
            className={pendingOrdersButtonClasses(hasPendingOrders)}
            title={hasPendingOrders ? `${pendingOrdersCount} pedidos pendientes` : 'Ver pedidos'}
          >
            <Menu size={18} className={`shrink-0 ${pendingOrdersButtonIconClasses(hasPendingOrders)}`} />
            <span className={`text-xs font-semibold leading-none whitespace-nowrap ${pendingOrdersButtonIconClasses(hasPendingOrders)}`}>
              Pedidos
            </span>
          </button>
        </div>
      </div>
      {renderOrderCustomerInfo()}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => applyPosOrderType('quick_sale')}
          className={posOrderTypeButtonClasses('quick_sale', posOrderType === 'quick_sale')}
          title="Cobro inmediato sin comanda ni precuenta"
        >
          <Zap size={14} />
          Directa
        </button>
        <button
          type="button"
          onClick={() => {
            applyPosOrderType('takeaway')
            setOrderDetailsModal('takeaway')
          }}
          className={posOrderTypeButtonClasses('takeaway', posOrderType === 'takeaway')}
          title="Pedido con comanda; datos opcionales"
        >
          <Package size={14} />
          Llevar
          {takeawayHasDetails && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
        </button>
        <button
          type="button"
          onClick={() => {
            applyPosOrderType('delivery')
            setOrderDetailsModal('delivery')
          }}
          className={posOrderTypeButtonClasses('delivery', posOrderType === 'delivery')}
          title="Delivery con dirección y repartidor"
        >
          <Bike size={14} />
          Delivery
          {deliveryHasDetails && <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />}
        </button>
      </div>
    </div>
  )

  const renderCartActions = (onCobrar?: () => void) => {
    if (isDirectSale) {
      return (
        <div className="px-2 pb-3 pt-1 shrink-0 space-y-1.5">
          <button
            type="button"
            onClick={() => setManualProductOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1 py-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100"
          >
            <Plus size={14} /> Producto manual
          </button>
          <button
            type="button"
            onClick={onCobrar ?? openCheckout}
            disabled={cart.length === 0 || branchSeriesMissing}
            className="w-full py-3 bg-rest-500 text-white rounded-xl text-sm font-semibold hover:bg-rest-600 disabled:opacity-50 shadow-md shadow-rest-500/20"
          >
            Cobrar venta directa
          </button>
        </div>
      )
    }
    return (
      <div className="px-2 pb-3 pt-1 shrink-0 space-y-1.5">
        <button
          type="button"
          onClick={() => setManualProductOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1 py-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100"
        >
          <Plus size={14} /> Producto manual
        </button>
        <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={actionLoading || cart.length === 0}
          onClick={() => void sendComanda()}
          className="inline-flex items-center justify-center gap-1 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
        >
          <ChefHat size={14} /> Comanda
        </button>
        <button
          type="button"
          disabled={actionLoading}
          onClick={() => void saveDraftOrder()}
          className="inline-flex items-center justify-center gap-1 py-2 border border-stone-200 rounded-xl text-xs font-medium hover:bg-stone-50 disabled:opacity-50"
        >
          <Save size={14} /> Guardar
        </button>
        <button
          type="button"
          disabled={!activeSessionId && cart.length === 0}
          onClick={() => void openPrecuenta()}
          className="inline-flex items-center justify-center gap-1 py-2 border border-stone-200 rounded-xl text-xs font-medium hover:bg-stone-50 disabled:opacity-50"
        >
          <FileText size={14} /> Precuenta
        </button>
        <button
          type="button"
          onClick={onCobrar ?? openCheckout}
          disabled={branchSeriesMissing || (cart.length === 0 && sessionTotal <= 0)}
          className="inline-flex items-center justify-center gap-1 py-2 bg-rest-500 text-white rounded-xl text-xs font-semibold hover:bg-rest-600 disabled:opacity-50"
        >
          Cobrar
        </button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    configuringRef.current = configureProduct != null
  }, [configureProduct])

  const addProduct = useCallback(
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

  const patchComandaNote = (comandaId: number, notes: string) => {
    setComandaModal((prev) =>
      prev
        ? { ...prev, comandas: prev.comandas.map((c) => (c.id === comandaId ? { ...c, notes } : c)) }
        : null,
    )
    setSessionDetail((prev) => {
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

  useEffect(() => {
    try {
      localStorage.setItem(POS_SCANNER_STORAGE_KEY, scannerMode ? 'true' : 'false')
    } catch {
      /* ignore */
    }
    if (!scannerMode) {
      setCameraScannerOpen(false)
      return
    }
    if (useCameraBarcodeScanner) {
      setCameraScannerOpen(true)
      return
    }
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [scannerMode, useCameraBarcodeScanner])

  const changeProductViewMode = useCallback((mode: PosProductViewMode) => {
    setProductViewMode(mode)
    savePosProductViewMode(mode)
  }, [])

  const setScannerModeOff = useCallback(() => {
    setScannerMode(false)
    setCameraScannerOpen(false)
  }, [])

  const toggleScannerMode = useCallback(() => {
    setScannerMode((on) => {
      const next = !on
      if (!next) setCameraScannerOpen(false)
      return next
    })
  }, [])

  const handleBarcodeScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim()
      if (!code || scanProcessing) return
      setScanProcessing(true)
      try {
        let product =
          findProductByBarcodeInList(products, code) ??
          (await productsService.lookupByBarcode(code, activeBranchId ?? undefined))
        if (product) {
          addProduct(product)
          setSearch('')
          toast.success(`${product.name} agregado al carrito`)
          searchInputRef.current?.focus()
        } else {
          toast.error('No se encontró un producto con ese código')
        }
      } catch {
        toast.error('Error al buscar el producto')
      } finally {
        setScanProcessing(false)
      }
    },
    [addProduct, scanProcessing, setSearch, activeBranchId, products],
  )
  const setQty = (index: number, qty: number) => {
    if (qty <= 0) {
      playCartRemoveSound()
      setCart((c) => c.filter((_, i) => i !== index))
    } else setCart((c) => c.map((x, i) => (i === index ? { ...x, quantity: qty } : x)))
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

  const renderCartLineItems = () =>
    cart.map((item, i) => (
      <PosCartLineRow
        key={cartLineKey(item, i)}
        line={item}
        subtotalLabel={`Subtotal: ${formatSoles(cartLineTotal(item, taxRate, taxConfig))}`}
        onQtyChange={(d) => setQty(i, item.quantity + d)}
        onNotesChange={(n) => setCartNotes(i, n)}
        onUnitPriceChange={(v) => setCartUnitPrice(i, v)}
        showNotes={isRestaurantOrder}
      />
    ))

  const resolveOrderItems = () => {
    try {
      return cartToOrderItems(cart)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revisa el carrito')
      return null
    }
  }

  const buildSessionPayload = () => ({
    table_id: null as null,
    order_type: posOrderType,
    contact_id: contactId,
    customer_name: customerName,
    customer_phone: customerPhone,
    delivery_driver_id: deliveryDriverId,
    delivery_address: deliveryAddress,
    delivery_reference: deliveryReference,
    estimated_minutes: estimatedMinutes,
    notes: orderNotes,
  })

  const ensureSession = async (saveDraft = false): Promise<number> => {
    if (activeSessionId) {
      await restaurantService.updateSession(activeSessionId, buildSessionPayload())
      return activeSessionId
    }
    const res = await restaurantService.openSession({ ...buildSessionPayload(), save_as_draft: saveDraft, guests: 1 })
    const id = (res as { data: { id: number; order_code?: string } }).data.id
    const code = (res as { data: { order_code?: string } }).data.order_code
    setActiveSessionId(id)
    if (code) setOrderCode(code)
    setSearchParams({ session: String(id) })
    return id
  }

  const sendComanda = async () => {
    if (!isRestaurantOrder) return
    if (cart.length === 0) {
      toast.error('Agrega productos al carrito')
      return
    }
    if (posOrderType === 'delivery' && !deliveryAddress.trim()) {
      toast.error('Completa la dirección en Delivery')
      setOrderDetailsModal('delivery')
      return
    }
    setActionLoading(true)
    try {
      const sid = await ensureSession(false)
      const items = resolveOrderItems()
      if (!items) return
      const res = await restaurantService.addOrder(sid, { items })
      const order = (res as { data?: { id?: number; order_number?: number; comandas?: Comanda[] } })?.data
      const tableOrderId = Number(order?.id ?? 0) || 0
      const orderNumber = Number(order?.order_number ?? 0) || 0
      const comandas = Array.isArray(order?.comandas) ? order!.comandas! : []
      toast.success('Comanda enviada a cocina')
      setCart([])
      const refreshed = await loadSession(sid)
      if (tableOrderId > 0 && orderNumber > 0 && comandas.length > 0) {
        setComandaModal({ orderId: tableOrderId, orderNumber, comandas })
        const printed = await printKitchenRound({
          sessionDetail: refreshed,
          orderCode: refreshed.order_code ?? orderCode,
          orderNumber,
          tableOrderId,
          comandas,
        })
        if (!printed && comandas.length > 0) {
          toast.info('Revisa impresora de comandas en Ajustes o usa Reimprimir en el historial')
        }
      }
      void loadPendingOrders({ silent: true })
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setActionLoading(false)
    }
  }

  const saveDraftOrder = async () => {
    if (!isRestaurantOrder) return
    setActionLoading(true)
    try {
      if (cart.length > 0) {
        const sid = await ensureSession(true)
        const items = resolveOrderItems()
        if (!items) return
        await restaurantService.addOrder(sid, { items })
        setCart([])
        await loadSession(sid)
      } else {
        await ensureSession(true)
        toast.success('Pedido guardado')
      }
      void loadPendingOrders({ silent: true })
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setActionLoading(false)
    }
  }

  const openPrecuenta = async () => {
    if (!isRestaurantOrder) return
    let sid = activeSessionId
    try {
      if (!sid && cart.length > 0) {
        sid = await ensureSession(true)
        const items = resolveOrderItems()
        if (!items) return
        await restaurantService.addOrder(sid, { items })
        setCart([])
        await loadSession(sid)
      }
      if (!sid) {
        toast.error('No hay pedido activo')
        return
      }
      const data = await restaurantService.getPrecuenta(sid)
      setPrecuentaData(data)
      setPrecuentaOpen(true)
      if (isNativePrintAvailable() && isAutoPrintEnabled('precuenta') && getConfiguredPrinter('precuenta')) {
        await printPrecuentaAuto({
          tableName: data.table_name || null,
          orderCode: data.order_code,
          customerName: data.customer_name || null,
          issueDate: formatPrecuentaIssueDate(data.opened_at),
          items: data.lines.map(precuentaApiLineToPrintItem),
          total: data.total,
        })
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const reprintPrecuenta = async () => {
    const data = precuentaData
    if (!data) return
    if (!isNativePrintAvailable()) {
      toast.error('La impresión de precuenta requiere la app de escritorio o Android')
      return
    }
    const cfg = getConfiguredPrinter('precuenta')
    if (!cfg) {
      toast.error('Configura la impresora de precuenta en Ajustes')
      return
    }
    try {
      const msg = await printPrecuentaAuto({
        tableName: data.table_name || null,
        orderCode: data.order_code,
        customerName: data.customer_name || null,
        issueDate: formatPrecuentaIssueDate(data.opened_at),
        items: data.lines.map(precuentaApiLineToPrintItem),
        total: data.total,
      })
      toast.success(msg || 'Precuenta enviada a la impresora')
    } catch (e) {
      console.error('[precuenta reprint error]', e)
      toast.error('No se pudo imprimir la precuenta')
    }
  }

  const openCheckout = () => {
    if (branchSeriesMissing) return
    if (cart.length === 0 && sessionTotal <= 0) return
    applyCheckoutDefaults()
    setCheckoutDiscountMode('percent')
    setCheckoutDiscountValue(0)
    setPayments([
      {
        method: defaultOperationalPaymentCode(paymentMethods),
        amount: total,
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

  const doCheckout = async () => {
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

    if (needsCashSession) {
      if (!canChargeCash) {
        toast.error('No tiene permiso para cobrar en efectivo')
        return
      }
      if (!myCashSession?.id) {
        toast.error('Abra su caja para cobrar en efectivo (menú Caja)')
        return
      }
    }

    setLoading(true)
    try {
      let billRes: Awaited<ReturnType<typeof restaurantService.billSession>>

      if (posFastCheckoutEnabled()) {
        // NUEVO (feature flag): un solo request. El backend compone Open+AddOrder+Bill
        // y recalcula el descuento en servidor a partir de discount_mode/discount_value.
        const items = resolveOrderItems()
        if (!items) return
        billRes = await restaurantService.posCheckout({
          session_id: activeSessionId ?? null,
          order_type: posOrderType,
          guests: 1,
          notes: orderNotes || (isDirectSale ? 'Venta directa' : 'POS'),
          contact_id: selectedContactId,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_driver_id: deliveryDriverId,
          delivery_address: deliveryAddress,
          delivery_reference: deliveryReference,
          estimated_minutes: estimatedMinutes,
          items,
          series_id: seriesId,
          doc_type: docType,
          currency: 'PEN',
          cash_session_id: myCashSession?.id ?? null,
          discount_mode: checkoutDiscountMode,
          discount_value: allowCheckoutDiscount ? checkoutDiscountValue : 0,
          payments: payments.map((p) => ({
            method: p.method,
            amount: roundSunat(p.amount),
            reference: p.reference?.trim() ?? '',
            notes: '',
          })),
        })
      } else {
        // ANTIGUO: openSession → addOrder → getSession → billSession (4 round-trips).
        let sid = activeSessionId
        if (!sid) {
          const res = await restaurantService.openSession({
            ...buildSessionPayload(),
            notes: orderNotes || (isDirectSale ? 'Venta directa' : 'POS'),
            guests: 1,
          })
          sid = (res as { data: { id: number } }).data.id
        }
        if (cart.length > 0) {
          const items = resolveOrderItems()
          if (!items) return
          await restaurantService.addOrder(sid!, { items })
        }
        const sessionForBill = await restaurantService.getSession(sid!)
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
        billRes = await restaurantService.billSession(sid, {
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
      }
      toast.success('Venta registrada')
      setCart([])
      setActiveSessionId(null)
      setSessionDetail(null)
      setComandaModal(null)
      setOrderCode('')
      setSessionTotal(0)
      setSearchParams({})
      setCheckoutOpen(false)
      setPayments([
        {
          method: defaultOperationalPaymentCode(paymentMethods),
          amount: 0,
          reference: '',
        },
      ])
      setPrintData(billRes.print_data ?? null)
      const saleContact = contacts.find((c) => c.id === selectedContactId)
      setLastSale(
        billRes.data
          ? {
              id: billRes.data.id,
              number: billRes.data.number,
              total: billRes.data.total,
              clientEmail: saleContact?.email?.trim() ?? '',
            }
          : null,
      )
      setReceiptModalOpen(true)
      // Una venta directa no deja pedido pendiente: refrescar la lista solo pediría datos
      // para descartarlos, y son ~5 queries por pedido abierto justo tras cobrar.
      if (!isDirectSale) void loadPendingOrders({ silent: true })
      if (isNativePrintAvailable() && isAutoPrintEnabled('documentos') && billRes.print_data) {
        const cfg = getConfiguredPrinter('documentos')
        if (!cfg) {
          toast.error('Configura la impresora de documentos en Ajustes')
        } else {
          try {
            const msg = await printDocumentAuto(billRes.print_data)
            toast.success(msg || 'Comprobante enviado a la impresora')
          } catch (e) {
            console.error('[document print error]', e)
            // La venta ya está registrada: el fallo de impresora se informa, no se dramatiza.
            const detail = e instanceof Error ? e.message : ''
            toast.error(
              detail
                ? `${detail} La venta se registró; puedes reimprimir el comprobante.`
                : 'No se pudo imprimir el comprobante. La venta se registró; puedes reimprimirlo.',
              { duration: 6000 },
            )
          }
        }
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setLoading(false)
    }
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
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 lg:gap-3 w-full min-w-0 max-w-full mx-auto">
          {/* Productos — ancho completo en móvil */}
          <div className="flex w-full min-w-0 max-w-full flex-1 flex-col min-h-0 mx-auto">
            {/* Filtro categorías */}
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
            {/* Filtro área de preparación */}
            {preparationAreas.length > 0 && (
              <div className="flex w-full gap-1 overflow-x-auto px-1 pb-1 min-w-0 shrink-0 lg:gap-1.5 lg:px-0 lg:pb-1.5">
                <span className="shrink-0 text-xs text-stone-500 self-center pr-1">Área:</span>
                <button
                  type="button"
                  onClick={() => setPreparationAreaFilter(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    preparationAreaFilter === null ? 'bg-stone-600 text-white border-stone-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Todas
                </button>
                {preparationAreas.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setPreparationAreaFilter(area)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap ${
                      preparationAreaFilter === area ? 'bg-stone-600 text-white border-stone-600' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
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
                  ref={searchInputRef}
                  value={search}
                  onChange={setSearch}
                  onKeyDown={(e) => {
                    if (scannerMode && e.key === 'Enter') {
                      e.preventDefault()
                      void handleBarcodeScan(search)
                    }
                  }}
                  isSearching={productsSearching || scanProcessing}
                  placeholder={
                    scannerMode ? 'Escanear código de barras…' : 'Buscar producto...'
                  }
                  leadingIcon={
                    scannerMode ? (
                      <ScanBarcode size={18} className="text-rest-600" aria-hidden />
                    ) : undefined
                  }
                  className="flex-1 min-w-0"
                  inputClassName={clsx(
                    'text-sm py-1.5',
                    scannerMode && 'border-rest-300 focus:ring-rest-500/40 pr-3',
                  )}
                  disabled={scanProcessing}
                />
                <div
                  className={clsx(
                    'flex shrink-0 select-none items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors',
                    scannerMode
                      ? 'border-rest-300 bg-rest-50 text-rest-800'
                      : 'border-stone-200 bg-stone-50 text-stone-600',
                  )}
                  title={
                    scannerMode
                      ? useCameraBarcodeScanner
                        ? 'Cámara activa para escanear códigos'
                        : 'Modo escáner activo: Enter agrega al carrito'
                      : useCameraBarcodeScanner
                        ? 'Abrir cámara para escanear códigos'
                        : 'Activar modo escáner de código de barras'
                  }
                >
                  <ScanBarcode
                    size={16}
                    className={scannerMode ? 'text-rest-600' : 'text-stone-400'}
                    aria-hidden
                  />
                  <span className="hidden text-xs font-medium sm:inline">Escáner</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={scannerMode}
                    aria-label="Modo escáner de código de barras"
                    onClick={toggleScannerMode}
                    className={clsx(
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rest-500/50',
                      scannerMode ? 'bg-rest-600' : 'bg-stone-300',
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                        scannerMode ? 'translate-x-5' : 'translate-x-1',
                      )}
                    />
                  </button>
                </div>
                <PosProductViewModeToggle mode={productViewMode} onChange={changeProductViewMode} />
              </div>
              <div ref={productsScrollRef} className="flex-1 min-h-0 w-full overflow-y-auto px-2 py-2 lg:p-3">
                <div
                  className={clsx(
                    'w-full max-w-full',
                    productViewMode === 'list'
                      ? 'flex flex-col gap-2'
                      : 'grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5 2xl:grid-cols-6 justify-items-stretch',
                  )}
                >
                {products.map((p) => {
                  const onPick = (e: React.MouseEvent<HTMLButtonElement>) => {
                    const visual = (e.currentTarget as HTMLElement).querySelector(
                      '[data-product-visual]',
                    ) as HTMLElement | null
                    addProduct(p, visual ?? e.currentTarget)
                  }
                  const props = {
                    product: p,
                    stockQuantity: stockByProductId[String(p.id)],
                    onClick: onPick,
                  }
                  return productViewMode === 'list' ? (
                    <PosProductListRow key={p.id} {...props} />
                  ) : (
                    <PosProductGridCard key={p.id} {...props} />
                  )
                })}
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

          {/* Carrito — ancho amplio; pegado al borde derecho de la vista */}
          <div className="hidden lg:flex shrink-0 flex-col min-h-0 w-[18.5rem] xl:w-[24rem] 2xl:w-[30rem]">
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-l-xl xl:rounded-l-2xl border border-stone-200/80 border-r-0 shadow-sm overflow-hidden">
              {renderCartHeader()}
              {renderSentKitchenBlock()}
              <ul className="px-2 py-2 space-y-0.5 text-sm overflow-y-auto flex-1 min-h-0">
                {cart.length === 0 && activeKitchenRounds.length > 0 && (
                  <li className="py-3 text-center text-xs text-stone-400">Agrega productos para una nueva ronda</li>
                )}
                {renderCartLineItems()}
              </ul>
              <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/30 shrink-0">
                <div className="flex justify-between items-baseline font-bold text-stone-800 text-base">
                  <span>Total</span>
                  <span className="text-rest-600">{formatMoney(total)}</span>
                </div>
              </div>

              {renderCartActions()}
            </div>
          </div>
        </div>
      </main>

      {!cartDrawerOpen && (
        <FloatingCartButton
          ref={cartBtnRef}
          quantity={cartQty}
          onClick={() => setCartDrawerOpen(true)}
        />
      )}
      <FlyToCartLayer />

      <MobileCartDrawer
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        quantity={cartQty}
        pendingCartCount={cart.length}
        onClearCart={clearPendingCart}
        footer={
          <div className="p-3 border-t border-stone-200 bg-stone-50/30 shrink-0">
            {renderCartActions(() => {
              setCartDrawerOpen(false)
              openCheckout()
            })}
          </div>
        }
      >
        <div className="border-b border-stone-100 shrink-0">{renderCartHeader()}</div>
        {renderSentKitchenBlock()}
        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          <ul className="space-y-1 text-sm mb-4">
            {cart.length === 0 && activeKitchenRounds.length > 0 && (
              <li className="py-3 text-center text-xs text-stone-400">Agrega productos para una nueva ronda</li>
            )}
            {renderCartLineItems()}
          </ul>
          <div className="border-t border-stone-200 pt-3">
            <div className="flex justify-between items-baseline font-bold text-stone-800 text-lg">
              <span>Total</span>
              <span className="text-rest-600">{formatMoney(total)}</span>
            </div>
          </div>
        </div>
      </MobileCartDrawer>

      {/* Modal para llevar — datos opcionales */}
      <PortalModal open={orderDetailsModal === 'takeaway'} onClose={() => setOrderDetailsModal(null)} className="max-w-md">
          <div className="bg-white rounded-2xl shadow-xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800 flex items-center gap-2">
                <Package size={18} /> Para llevar
              </h3>
              <button type="button" onClick={() => setOrderDetailsModal(null)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Datos opcionales del pedido. El cliente del comprobante se elige en el carrito.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nombre quien recoge</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Teléfono</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notas del pedido</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm resize-none"
                  placeholder="Ej. sin ají, para las 8pm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setOrderDetailsModal(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium hover:bg-stone-50"
              >
                Omitir
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
                onClick={async () => {
                  try {
                    if (activeSessionId) await restaurantService.updateSession(activeSessionId, buildSessionPayload())
                    setOrderDetailsModal(null)
                    toast.success('Datos guardados')
                  } catch (e: unknown) {
                    toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
                  }
                }}
              >
                Listo
              </button>
            </div>
          </div>
      </PortalModal>

      <PortalModal open={orderDetailsModal === 'delivery'} onClose={() => setOrderDetailsModal(null)} className="max-w-md">
          <div className="bg-white rounded-2xl shadow-xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800 flex items-center gap-2">
                <Bike size={18} /> Delivery
              </h3>
              <button type="button" onClick={() => setOrderDetailsModal(null)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Contacto entrega (nombre)</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Teléfono</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Dirección *</label>
                <input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Calle, número, distrito"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Referencia</label>
                <input
                  value={deliveryReference}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Repartidor</label>
                <SearchableSelect
                  value={deliveryDriverId ?? ''}
                  onChange={(v) => setDeliveryDriverId(v === '' || v == null ? null : Number(v))}
                  options={[{ value: '', label: 'Sin asignar' }, ...drivers.map((d) => ({ value: d.id, label: d.name }))]}
                  searchable={drivers.length > 6}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Tiempo estimado (min)</label>
                <input
                  type="number"
                  min={5}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Math.max(5, Number(e.target.value) || 30))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <button
              type="button"
              className="mt-4 w-full py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
              onClick={async () => {
                if (!deliveryAddress.trim()) {
                  toast.error('Ingresa la dirección de delivery')
                  return
                }
                try {
                  if (activeSessionId) await restaurantService.updateSession(activeSessionId, buildSessionPayload())
                  setOrderDetailsModal(null)
                  toast.success('Datos guardados')
                } catch (e: unknown) {
                  toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
                }
              }}
            >
              Listo
            </button>
          </div>
      </PortalModal>

      <POSCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        loading={loading}
        rawTotal={total}
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
        onSeriesChange={(id, dt) => {
          setSeriesId(id)
          setDocType(dt)
        }}
        contactId={effectiveContactId}
        contacts={contacts}
        onContactChange={(id) => {
          setContactId(id)
          const c = contacts.find((x) => x.id === id)
          if (c && !customerName.trim()) setCustomerName(c.business_name)
        }}
        onAddContact={() => setClientQuickAddOpen(true)}
        onPreferVariosContact={() => {
          const variosId = pickVariosContactId(contacts)
          if (variosId) setContactId(variosId)
        }}
        paymentMethods={checkoutPaymentMethods}
        payments={payments}
        onPaymentsChange={setPayments}
        onConfirm={doCheckout}
        confirmDisabled={!checkoutContactOk || !seriesId}
        allowDiscount={allowCheckoutDiscount}
        sunatEnabled={sunatEnabled}
        canFactura={canFactura}
      />

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

      <PortalModal open={ordersOpen} onClose={() => setOrdersOpen(false)} className="max-w-lg" overlayClassName="items-end sm:items-center">
          <div className={clsx('relative bg-white rounded-2xl shadow-xl w-full flex flex-col', MAX_H_PANEL_80)}>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-800">Pedidos</h3>
                <p className="text-xs text-stone-500">
                  {pendingOrdersCount === 0 ? 'Sin pedidos pendientes' : `${pendingOrdersCount} pendiente${pendingOrdersCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <button type="button" onClick={() => setOrdersOpen(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1 min-h-0 space-y-2">
              {openOrdersLoading && <p className="text-sm text-stone-500 text-center py-6">Cargando...</p>}
              {!openOrdersLoading && openOrdersList.length === 0 && (
                <p className="text-sm text-stone-500 text-center py-6">No hay pedidos abiertos</p>
              )}
              {openOrdersList.map((o) => (
                <div
                  key={o.id}
                  className={`flex gap-2 p-3 rounded-xl border border-stone-200 hover:shadow-sm bg-white ${orderTypeCardAccentClasses(o.order_type)}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOrdersOpen(false)
                      setSearchParams({ session: String(o.id) })
                      void loadSession(o.id).then(() => loadPendingOrders({ silent: true }))
                    }}
                    className="flex-1 min-w-0 text-left hover:bg-stone-50/80 rounded-lg -m-1 p-1 transition-colors"
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <span className="font-semibold text-stone-800">{o.order_code || `#${o.id}`}</span>
                      <span className="text-sm font-medium text-stone-800 tabular-nums">{formatSoles(Number(o.total_amount))}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={orderTypeChipClasses(o.order_type)}>
                        {ORDER_TYPE_LABELS[o.order_type] ?? o.order_type}
                      </span>
                      <span className={orderStatusBadgeClasses(o.order_status)}>
                        {ORDER_STATUS_LABELS[o.order_status] ?? o.order_status}
                      </span>
                    </div>
                    {o.customer_name && (
                      <p className="text-xs text-stone-500 mt-0.5 truncate">{o.customer_name}</p>
                    )}
                    {o.customer_phone && (
                      <p className="text-xs text-stone-500 truncate">Tel. {o.customer_phone}</p>
                    )}
                    {o.order_type === 'delivery' && o.delivery_address && (
                      <p className="text-xs text-stone-500 line-clamp-2">{o.delivery_address}</p>
                    )}
                  </button>
                  {allowCancelOrder && (
                    <button
                      type="button"
                      title="Anular pedido"
                      onClick={() => void requestVoidOrder(o)}
                      className="shrink-0 self-center p-2 rounded-lg text-red-600 hover:bg-red-50 border border-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
      </PortalModal>

      <VoidOrderPinModal
        open={!!voidOrderTarget}
        title="Anular pedido"
        orderLabel={voidOrderTarget?.order_code}
        description="Solo si aún no se generó la venta. Se elimina el pedido y sus comandas."
        onClose={() => setVoidOrderTarget(null)}
        onConfirm={async (reason, pin) => {
          if (!voidOrderTarget) return
          try {
            await restaurantService.cancelSession(voidOrderTarget.id, reason, pin)
            toast.success('Pedido anulado')
            const voidedId = voidOrderTarget.id
            setVoidOrderTarget(null)
            if (activeSessionId === voidedId) {
              setActiveSessionId(null)
              setSessionDetail(null)
              setComandaModal(null)
              setOrderCode('')
              setSessionTotal(0)
              setCart([])
              setSearchParams({})
            }
            void loadPendingOrders({ silent: true })
          } catch (e: unknown) {
            toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al anular')
            throw e
          }
        }}
      />

      <VoidOrderPinModal
        open={voidComandasTarget != null}
        title={
          voidComandasTarget?.mode === 'round'
            ? `Anular comanda #${voidComandasTarget.orderNumber}`
            : 'Vaciar comandas del pedido'
        }
        orderLabel={
          voidComandasTarget
            ? `${countCancellableComandas(
                sessionDetail,
                voidComandasTarget.mode === 'round' ? voidComandasTarget.orderId : undefined,
              )} ítem(s) por anular`
            : orderCode || undefined
        }
        description={
          voidComandasTarget?.mode === 'round'
            ? 'Se anularán todos los ítems de esta ronda. El pedido sigue abierto.'
            : 'Se anularán todas las comandas activas. El pedido sigue abierto para agregar nuevos ítems.'
        }
        confirmLabel="Anular todo"
        pinHint="Mismo PIN configurado en Ajustes → Restaurante."
        onClose={() => setVoidComandasTarget(null)}
        onConfirm={async (reason, pin) => {
          if (!voidComandasTarget || !activeSessionId) return
          try {
            const res = await restaurantService.cancelAllComandas(activeSessionId, {
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
            const refreshed = await loadSession(activeSessionId)
            setSessionDetail(refreshed)
            setSessionTotal(Number(refreshed.total_amount) || 0)
            void loadPendingOrders({ silent: true })
          } catch (e: unknown) {
            toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al anular')
            throw e
          }
        }}
      />

      <PortalModal open={!!comandaModal} onClose={() => setComandaModal(null)} className="max-w-md">
        {comandaModal && (
          <div className={clsx('bg-white rounded-2xl shadow-xl w-full flex flex-col overflow-hidden', MAX_H_PANEL_85)}>
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="font-bold text-stone-800">Comanda · Ronda #{comandaModal.orderNumber}</h3>
              <button type="button" onClick={() => setComandaModal(null)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <ul className="text-sm space-y-3">
                {comandaModal.comandas.map((c) => (
                  <li key={c.id} className="border-b border-stone-100 pb-3 last:border-0">
                    <ComandaLineDisplay comanda={c} />
                    <ComandaNoteEditor comanda={c} onUpdated={patchComandaNote} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 border-t border-stone-200 flex gap-2">
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
                  className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
                >
                  Reimprimir
                </button>
              )}
              <button
                type="button"
                onClick={() => setComandaModal(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium hover:bg-stone-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </PortalModal>

      <PortalModal open={precuentaOpen && !!precuentaData} onClose={() => setPrecuentaOpen(false)} className="max-w-md">
        {precuentaData && (
          <div className={clsx('relative bg-white rounded-2xl shadow-xl w-full overflow-y-auto p-5', MAX_H_PANEL_85)}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-stone-800">Precuenta</h3>
                <p className="text-xs text-stone-500">{precuentaData.order_code}</p>
              </div>
              <button type="button" onClick={() => setPrecuentaOpen(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-stone-500 mb-2">
              {ORDER_TYPE_LABELS[precuentaData.order_type] ?? precuentaData.order_type}
            </p>
            {precuentaData.customer_name && (
              <p className="text-sm text-stone-600 mb-1">Cliente: {precuentaData.customer_name}</p>
            )}
            {precuentaData.customer_phone && (
              <p className="text-sm text-stone-600 mb-1">Tel.: {precuentaData.customer_phone}</p>
            )}
            {precuentaData.delivery_address && (
              <p className="text-sm text-stone-600 mb-1">Dirección: {precuentaData.delivery_address}</p>
            )}
            {precuentaData.delivery_reference && (
              <p className="text-sm text-stone-600 mb-1">Ref.: {precuentaData.delivery_reference}</p>
            )}
            {precuentaData.driver_name && (
              <p className="text-sm text-stone-600 mb-2">Repartidor: {precuentaData.driver_name}</p>
            )}
            {precuentaData.notes && (
              <p className="text-sm text-stone-600 mb-2">Notas: {precuentaData.notes}</p>
            )}
            <ul className="text-sm space-y-1 mb-3 border-t border-stone-100 pt-2">
              <li className="grid grid-cols-[2.5rem_1fr_4rem_4.5rem] gap-1 text-xs text-stone-500 font-medium pb-1 border-b border-stone-100">
                <span className="text-center">Cant.</span>
                <span>Descripción</span>
                <span className="text-right">P.U.</span>
                <span className="text-right">Importe</span>
              </li>
              {precuentaData.lines.map((l, i) => (
                <li key={i} className="grid grid-cols-[2.5rem_1fr_4rem_4.5rem] gap-1 text-sm py-1 border-b border-stone-50">
                  <span className="text-center tabular-nums text-stone-700">{l.quantity}</span>
                  <span className="text-stone-700 min-w-0">
                    <span>{l.product_name}</span>
                    {formatModifierLines(parseStoredModifiers(l.modifiers_json)).map((line) => (
                      <span key={line} className="block text-xs text-stone-500 pl-1">
                        {line}
                      </span>
                    ))}
                    {l.notes?.trim() ? (
                      <span className="block text-xs text-amber-700 italic pl-1">Obs: {l.notes.trim()}</span>
                    ) : null}
                  </span>
                  <span className="text-right tabular-nums text-stone-600">{formatSoles(Number(l.unit_price))}</span>
                  <span className="text-right tabular-nums font-medium text-stone-800">
                    {formatSoles(Number(l.line_total))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-bold text-stone-800 border-t border-stone-200 pt-2">
              <span>Total a pagar</span>
              <span className="text-rest-600 tabular-nums">{formatSoles(Number(precuentaData.total))}</span>
            </div>
            <p className="mt-4 text-sm text-stone-600 border-b border-stone-400 pb-1">
              Documento:{' '}
              <span className="inline-block min-w-[12rem] border-b border-stone-400">&nbsp;</span>
            </p>
            {isNativePrintAvailable() && getConfiguredPrinter('precuenta') && (
              <button
                type="button"
                onClick={() => void reprintPrecuenta()}
                className="mt-4 w-full py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
              >
                Reimprimir
              </button>
            )}
          </div>
        )}
      </PortalModal>

      <KitchenRoundHistoryModal
        open={kitchenHistoryOpen}
        onClose={() => setKitchenHistoryOpen(false)}
        rounds={kitchenRoundHistory}
        orderCode={orderCode}
        onReprint={(round) => void reprintKitchenRound(round)}
        onReprintAll={() => void reprintAllKitchenRounds()}
        showReprintAll={printableKitchenRounds.length > 0}
      />

      <ReceiptPrintModal
        open={receiptModalOpen}
        onClose={() => { setReceiptModalOpen(false); setPrintData(null); setLastSale(null) }}
        printData={printData}
        saleId={lastSale?.id}
        saleNumber={lastSale?.number}
        total={lastSale?.total}
        defaultEmail={lastSale?.clientEmail}
        openInReceiptView
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

      <PosBarcodeScannerModal
        open={cameraScannerOpen}
        onClose={setScannerModeOff}
        onScan={handleBarcodeScan}
        busy={scanProcessing}
      />
    </div>
  )
}
