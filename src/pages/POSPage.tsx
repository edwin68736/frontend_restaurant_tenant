import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import {
  UtensilsCrossed,
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
} from 'lucide-react'
import { SearchInput } from '@/components/SearchInput'
import { usePosInfiniteProducts } from '@/hooks/usePosInfiniteProducts'
import { restaurantService } from '@/services/restaurant.service'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'
import type { PrintData } from '@/types/printData'
import { productsService, type Product, type Category, getProductImageUrl } from '@/services/products.service'
import { companyService, pickDefaultNotaVentaSeries, sortSeriesNotaVentaFirst, type SeriesRow } from '@/services/company.service'
import { contactsService, type Contact, type CreateContactInput } from '@/services/contacts.service'
import { cashbankService, type BankAccount, type PaymentMethodRecord } from '@/services/cashbank.service'
import { consultaService } from '@/services/consulta.service'
import { calcItem, getAfectacionGroup, type SunatAfectacionGroup } from '@/utils/taxCalc'
import { SearchableSelect } from '@/components/SearchableSelect'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'
import { useCashSession } from '@/contexts/CashSessionContext'
import { getConfiguredPrinter, isAutoPrintEnabled, isWindowsDesktop, printDocumentAuto, printPrecuentaAuto } from '@/services/printers.service'
import { findPaymentMethodRecord, isPaymentMethodLinkedForSale, normalizePaymentMethodCodeForLookup } from '@/utils/paymentMethodCheckout'
import { ORDER_TYPE_LABELS, ORDER_STATUS_LABELS, type DeliveryDriver, type PrecuentaPayload, type RestaurantOrderSummary } from '@/types/restaurantOrder'
import { VoidOrderPinModal } from '@/components/restaurant/VoidOrderPinModal'
import { FloatingCartButton } from '@/components/restaurant/FloatingCartButton'
import { useFlyToCart } from '@/hooks/useFlyToCart'
import { cartToOrderItems, sessionDetailToCart } from '@/utils/posOrderHelpers'
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

/** Ítem del carrito con producto completo para cálculo IGV por tipo de afectación. */
interface CartItem {
  product: Product
  quantity: number
}

const DEFAULT_POS_CONTACT = { doc_type: '0', doc_number: '99999999' }
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
  const { activeBranchId, resetEpoch } = useBranch()
  const { session: myCashSession, canChargeCash } = useCashSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [preparationAreaFilter, setPreparationAreaFilter] = useState<string | null>(null)
  const productsScrollRef = useRef<HTMLDivElement>(null)
  const productsSentinelRef = useRef<HTMLDivElement>(null)
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [sunat, setSunat] = useState<{ tax_rate?: number; igv_regime?: string; tax_benefit_zone?: boolean } | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [seriesId, setSeriesId] = useState(0)
  const [docType, setDocType] = useState('NOTA DE VENTA')
  const [contactId, setContactId] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([{ method: 'cash', amount: 0 }])
  const [printData, setPrintData] = useState<PrintData | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [lastSale, setLastSale] = useState<{ number: string; total: number } | null>(null)
  const [clientQuickAddOpen, setClientQuickAddOpen] = useState(false)
  const [clientQuickAdd, setClientQuickAdd] = useState({ doc_type: '6', doc_number: '', business_name: '', address: '' })
  const [consultaLoading, setConsultaLoading] = useState(false)
  const [createContactLoading, setCreateContactLoading] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const cartBtnRef = useRef<HTMLButtonElement>(null)
  const { flyToCart, FlyToCartLayer } = useFlyToCart(cartBtnRef)
  const [posOrderType, setPosOrderType] = useState<PosOrderType>('quick_sale')
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
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
  const [scannerMode, setScannerMode] = useState(readScannerModePreference)
  const [scanProcessing, setScanProcessing] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const loadSession = useCallback(
    async (sessionId: number) => {
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
      const catalog = await productsService.list('', true, 1, 500, undefined, undefined, activeBranchId ?? undefined)
      setCart(sessionDetailToCart(detail, catalog.data))
    },
    [activeBranchId],
  )

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

  useEffect(() => {
    void loadPendingOrders({ silent: true })
  }, [activeBranchId, resetEpoch, loadPendingOrders])

  useEffect(() => {
    if (!ordersOpen) return
    void loadPendingOrders({ silent: true, modal: true })
  }, [ordersOpen, loadPendingOrders])

  const loadPosMeta = useCallback(() => {
    if (!activeBranchId) return
    productsService.listCategories().then(setCategories)
    companyService.getSunat().then(setSunat).catch(() => setSunat(null))
    companyService.listSeries({ branch_id: activeBranchId, category: 'venta' }).then((s) => {
      const ordered = sortSeriesNotaVentaFirst(s)
      setSeries(ordered)
      const def = pickDefaultNotaVentaSeries(ordered)
      if (def) {
        setSeriesId(def.id)
        setDocType(String(def.doc_type || '').trim() || 'NOTA DE VENTA')
      }
    })
    contactsService
      .list('', 'customer')
      .then((list) => {
        setContacts(list)
        const def = list.find(
          (c) => String(c.doc_type).trim() === DEFAULT_POS_CONTACT.doc_type && String(c.doc_number).trim() === DEFAULT_POS_CONTACT.doc_number
        )
        if (def) setContactId((prev) => prev ?? def.id)
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
  }, [loadPosMeta, resetEpoch])

  const {
    products,
    hasMore,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    isSearching: productsSearching,
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

  useOnBranchChange(() => {
    setCart([])
    setCheckoutOpen(false)
    setActiveSessionId(null)
    setOrderCode('')
    setSessionTotal(0)
    loadPosMeta()
    refreshProducts()
    void loadPendingOrders({ silent: true })
  })

  const defaultContactId = useMemo(() => {
    const def = contacts.find(
      (c) => String(c.doc_type).trim() === DEFAULT_POS_CONTACT.doc_type && String(c.doc_number).trim() === DEFAULT_POS_CONTACT.doc_number
    )
    return def?.id ?? null
  }, [contacts])

  const effectiveContactId = contactId ?? defaultContactId

  const categoriesWithProducts = useMemo(() => {
    return categories
  }, [categories])

  const preparationAreas = useMemo(() => {
    const areas = new Set(products.map((p) => p.preparation_area || '').filter(Boolean))
    return Array.from(areas).sort((a, b) => a.localeCompare(b))
  }, [products])

  const taxRate = sunat?.tax_rate ?? 18
  const taxConfig = { taxRate, igvRegime: sunat?.igv_regime, taxBenefitZone: sunat?.tax_benefit_zone }

  const getCartItemTotals = (item: CartItem) => {
    const p = item.product
    return calcItem(
      p.sale_price,
      item.quantity,
      0,
      p.igv_affectation_type ?? '10',
      p.price_includes_igv ?? false,
      taxRate,
      taxConfig
    )
  }

  const cartTotal = useMemo(
    () => cart.reduce((s, i) => s + getCartItemTotals(i).total, 0),
    [cart, taxRate, taxConfig.igvRegime, taxConfig.taxBenefitZone]
  )
  const total = cartTotal + sessionTotal

  const totalsByAfectacion = useMemo(
    () =>
      cart.reduce(
        (acc, i) => {
          const { subtotal, taxAmount, total: t } = getCartItemTotals(i)
          const group = getAfectacionGroup(i.product.igv_affectation_type ?? '10')
          acc[group].subtotal += subtotal
          acc[group].taxAmount += taxAmount
          acc[group].total += t
          return acc
        },
        {
          gravado: { subtotal: 0, taxAmount: 0, total: 0 },
          exonerado: { subtotal: 0, taxAmount: 0, total: 0 },
          inafecto: { subtotal: 0, taxAmount: 0, total: 0 },
          exportacion: { subtotal: 0, taxAmount: 0, total: 0 },
        } as Record<SunatAfectacionGroup, { subtotal: number; taxAmount: number; total: number }>
      ),
    [cart, taxRate, taxConfig.igvRegime, taxConfig.taxBenefitZone]
  )

  const cartQty = cart.reduce((s, i) => s + i.quantity, 0)
  const pendingOrdersCount = openOrdersList.length
  const hasPendingOrders = pendingOrdersCount > 0
  const isDirectSale = posOrderType === 'quick_sale'
  const isRestaurantOrder = !isDirectSale
  const takeawayHasDetails = !!(customerName.trim() || customerPhone.trim() || orderNotes.trim())
  const deliveryHasDetails = !!(deliveryAddress.trim() || deliveryReference.trim() || deliveryDriverId)

  const applyPosOrderType = (next: PosOrderType) => {
    if (activeSessionId && posOrderType !== next) {
      setActiveSessionId(null)
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
                  {sessionTotal > 0 && <span>S/ {sessionTotal.toFixed(2)}</span>}
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
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Cliente (comprobante)</label>
        <div className="flex gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={effectiveContactId ?? null}
              onChange={(v) => {
                const id = v == null || String(v) === '' ? null : Number(v)
                setContactId(id)
                const c = contacts.find((x) => x.id === id)
                if (c && !customerName.trim()) setCustomerName(c.business_name)
              }}
              options={contacts.map((c) => ({ value: c.id, label: c.business_name }))}
              placeholder="Selecciona cliente"
              searchable
              className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-xs bg-white text-left flex items-center justify-between gap-1"
            />
          </div>
          <button
            type="button"
            onClick={() => setClientQuickAddOpen(true)}
            className="shrink-0 px-2 py-1.5 border border-rest-500 text-rest-600 rounded-lg text-xs font-medium hover:bg-rest-50"
          >
            Nuevo
          </button>
        </div>
      </div>
    </div>
  )

  const renderCartActions = (onCobrar?: () => void) => {
    if (isDirectSale) {
      return (
        <div className="px-2 pb-3 pt-1 shrink-0">
          <button
            type="button"
            onClick={onCobrar ?? openCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-rest-500 text-white rounded-xl text-sm font-semibold hover:bg-rest-600 disabled:opacity-50 shadow-md shadow-rest-500/20"
          >
            Cobrar venta directa
          </button>
        </div>
      )
    }
    return (
      <div className="px-2 pb-3 pt-1 shrink-0 grid grid-cols-2 gap-1.5">
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
          disabled={cart.length === 0 && sessionTotal <= 0}
          className="inline-flex items-center justify-center gap-1 py-2 bg-rest-500 text-white rounded-xl text-xs font-semibold hover:bg-rest-600 disabled:opacity-50"
        >
          Cobrar
        </button>
      </div>
    )
  }

  const addProduct = useCallback(
    (p: Product, sourceEl?: HTMLElement) => {
      setCart((c) => {
        const i = c.findIndex((x) => x.product.id === p.id)
        if (i >= 0) return c.map((x, j) => (j === i ? { ...x, quantity: x.quantity + 1 } : x))
        return [...c, { product: p, quantity: 1 }]
      })
      if (sourceEl) flyToCart(sourceEl, getProductImageUrl(p.image_url))
    },
    [flyToCart],
  )

  useEffect(() => {
    try {
      localStorage.setItem(POS_SCANNER_STORAGE_KEY, scannerMode ? 'true' : 'false')
    } catch {
      /* ignore */
    }
    if (scannerMode) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [scannerMode])

  const handleBarcodeScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim()
      if (!code || scanProcessing) return
      setScanProcessing(true)
      try {
        const { data } = await productsService.list(code, true, 1, 50, undefined, undefined, activeBranchId ?? undefined)
        const norm = (s: string) => s.trim().toLowerCase()
        const exact = data.find((p) => norm(p.code) === norm(code))
        const product = exact ?? (data.length === 1 ? data[0] : undefined)
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
    [addProduct, scanProcessing, setSearch, activeBranchId],
  )
  const setQty = (index: number, qty: number) => {
    if (qty <= 0) setCart((c) => c.filter((_, i) => i !== index))
    else setCart((c) => c.map((x, i) => (i === index ? { ...x, quantity: qty } : x)))
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
      await restaurantService.addOrder(sid, { items: cartToOrderItems(cart) })
      toast.success('Comanda enviada a cocina')
      setCart([])
      await loadSession(sid)
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
        await restaurantService.addOrder(sid, { items: cartToOrderItems(cart) })
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
        await restaurantService.addOrder(sid, { items: cartToOrderItems(cart) })
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
      if (isWindowsDesktop() && isAutoPrintEnabled('precuenta') && getConfiguredPrinter('precuenta')) {
        await printPrecuentaAuto({
          tableName: data.table_name || null,
          items: data.lines.map((l) => ({
            productName: l.product_name,
            quantity: l.quantity,
            unitPrice: l.unit_price,
          })),
          total: data.total,
        })
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const openCheckout = () => {
    if (cart.length === 0 && sessionTotal <= 0) return
    if (!effectiveContactId) {
      toast.error('Selecciona un cliente en el carrito')
      return
    }
    const def = pickDefaultNotaVentaSeries(series)
    if (def) {
      setSeriesId(def.id)
      setDocType(String(def.doc_type || '').trim() || 'NOTA DE VENTA')
    }
    setPayments([{ method: paymentMethods.find((m) => m.code === 'cash')?.code ?? paymentMethods[0]?.code ?? 'cash', amount: total }])
    setCheckoutOpen(true)
  }

  const doCheckout = async () => {
    const paid = payments.reduce((s, p) => s + p.amount, 0)
    if (paid < total) { toast.error('El monto pagado debe ser al menos el total'); return }
    if (!seriesId) { toast.error('Selecciona una serie'); return }
    const selectedContactId = effectiveContactId
    if (!selectedContactId) { toast.error('Selecciona un cliente'); return }

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

    setLoading(true)
    try {
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
        await restaurantService.addOrder(sid!, { items: cartToOrderItems(cart) })
      }
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
      const billRes = await restaurantService.billSession(sid, {
        series_id: seriesId,
        doc_type: docType,
        currency: 'PEN',
        contact_id: selectedContactId,
        cash_session_id: needsCashSession ? myCashSession?.id ?? null : null,
        close_session: true,
        payments: payments.map((p) => ({ method: p.method, amount: p.amount, reference: '', notes: '' })),
      })
      toast.success('Venta registrada')
      setCart([])
      setActiveSessionId(null)
      setOrderCode('')
      setSessionTotal(0)
      setSearchParams({})
      setCheckoutOpen(false)
      setPayments([{ method: paymentMethods.find((m) => m.code === 'cash')?.code ?? paymentMethods[0]?.code ?? 'cash', amount: 0 }])
      setPrintData(billRes.print_data ?? null)
      setLastSale(billRes.data ? { number: billRes.data.number, total: billRes.data.total } : null)
      setReceiptModalOpen(true)
      void loadPendingOrders({ silent: true })
      if (isWindowsDesktop() && isAutoPrintEnabled('documentos') && billRes.print_data) {
        const cfg = getConfiguredPrinter('documentos')
        if (!cfg) {
          toast.error('Configura la impresora de documentos en Ajustes')
        } else {
          try {
            const msg = await printDocumentAuto(billRes.print_data)
            toast.success(msg || 'Comprobante enviado a la impresora')
          } catch (e) {
            console.error('[document print error]', e)
            toast.error('No se pudo imprimir el comprobante. Revisa la consola de Tauri (cargo).')
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
    <div className="flex-1 min-h-0 flex flex-col bg-stone-50/80 overflow-hidden w-full max-w-full h-full lg:-mx-5 lg:-my-3">
      <main className="flex-1 min-h-0 flex flex-col w-full max-w-full mx-auto px-0 pt-1 pb-2 sm:pt-1.5 lg:pl-2 lg:pr-0 lg:pb-2">
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 lg:gap-3 w-full min-w-0 max-w-full mx-auto">
          {/* Productos — ancho completo en móvil */}
          <div className="flex w-full min-w-0 max-w-full flex-1 flex-col min-h-0 mx-auto">
            {/* Filtro categorías */}
            <div className="flex w-full gap-1.5 overflow-x-auto pb-1.5 min-w-0 shrink-0">
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
              <div className="flex w-full gap-1.5 overflow-x-auto pb-1.5 min-w-0 shrink-0">
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

            <div className="flex w-full max-w-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-sm sm:rounded-2xl">
              <div className="px-2 py-1.5 sm:px-3 sm:py-2 border-b border-stone-100 shrink-0 flex items-center gap-2">
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
                      ? 'Modo escáner activo: Enter agrega al carrito'
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
                    onClick={() => setScannerMode((on) => !on)}
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
              </div>
              <div ref={productsScrollRef} className="flex-1 min-h-0 w-full overflow-y-auto p-1.5 sm:p-3">
                <div className="grid w-full max-w-full grid-cols-3 gap-1.5 sm:gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 justify-items-stretch">
                {products.map((p) => {
                  const imgUrl = getProductImageUrl(p.image_url)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        const visual = (e.currentTarget as HTMLElement).querySelector(
                          '[data-product-visual]',
                        ) as HTMLElement | null
                        addProduct(p, visual ?? e.currentTarget)
                      }}
                      className="group rounded-xl border border-stone-200 bg-stone-50/50 overflow-hidden text-left transition-all duration-200 hover:border-rest-400 hover:shadow-md hover:shadow-rest-100/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-rest-400/50"
                    >
                      <div data-product-visual className="aspect-square bg-stone-200/80 relative overflow-hidden">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <UtensilsCrossed className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="font-medium text-stone-800 text-xs leading-tight line-clamp-2 min-h-[2rem]">
                          {p.name}
                        </p>
                        <p className="text-rest-600 font-semibold text-xs mt-1">
                          S/ {Number(p.sale_price).toFixed(2)}
                        </p>
                      </div>
                    </button>
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
          <div className="hidden lg:flex shrink-0 flex-col min-h-0 w-[min(100%,24rem)] xl:w-[28rem] 2xl:w-[32rem]">
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-l-xl xl:rounded-l-2xl border border-stone-200/80 border-r-0 shadow-sm overflow-hidden">
              {renderCartHeader()}
              <ul className="px-2 py-2 space-y-0.5 text-sm overflow-y-auto flex-1 min-h-0">
                {cart.map((item, i) => (
                  <li key={i} className="flex justify-between items-center gap-2 py-2 border-b border-stone-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-700 truncate">{item.product.name}</span>
                        <span className="text-xs font-semibold text-rest-600 shrink-0">
                          S/ {Number(item.product.sale_price).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-stone-400">
                        x{item.quantity} · Subtotal: S/ {(Number(item.product.sale_price) * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(i, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQty(i, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-rest-600 text-white hover:bg-rest-700 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/30 shrink-0">
                <div className="flex justify-between items-baseline font-bold text-stone-800 text-base">
                  <span>Total</span>
                  <span className="text-rest-600">S/ {total.toFixed(2)}</span>
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

      {cartDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[115]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingCart size={18} className="text-stone-700" />
                  <h3 className="font-bold text-stone-800 truncate">Carrito</h3>
                  {cartQty > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-rest-600 text-white text-sm font-bold">
                      {cartQty}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(false)}
                  className="p-2 rounded-xl hover:bg-stone-100 text-stone-600"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="border-b border-stone-100">{renderCartHeader()}</div>
              <div className="p-4 flex-1 min-h-0 overflow-y-auto">
                <ul className="space-y-1 text-sm mb-4">
                  {cart.map((item, i) => (
                    <li key={i} className="flex justify-between items-center gap-2 py-2 border-b border-stone-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-stone-700 truncate">{item.product.name}</span>
                          <span className="text-xs font-semibold text-rest-600 shrink-0">
                            S/ {Number(item.product.sale_price).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400">
                          x{item.quantity} · Subtotal: S/ {(Number(item.product.sale_price) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(i, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQty(i, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-rest-600 text-white hover:bg-rest-700 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-stone-200 pt-3">
                  <div className="flex justify-between items-baseline font-bold text-stone-800 text-lg">
                    <span>Total</span>
                    <span className="text-rest-600">S/ {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-stone-200 bg-stone-50/30">
                {renderCartActions(() => { setCartDrawerOpen(false); openCheckout() })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para llevar — datos opcionales */}
      {orderDetailsModal === 'takeaway' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
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
        </div>
      )}

      {/* Modal delivery */}
      {orderDetailsModal === 'delivery' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
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
        </div>
      )}

      {/* Modal checkout — solo comprobante y pagos */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-800">Cobrar</h3>
              <button onClick={() => setCheckoutOpen(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de comprobante</label>
                <SearchableSelect
                  value={seriesId || null}
                  onChange={(v) => {
                    const id = Number(v)
                    const s = series.find((x) => x.id === id)
                    setSeriesId(id)
                    if (s) setDocType(String(s.doc_type || '').trim() || 'NOTA DE VENTA')
                  }}
                  options={series.map((s) => ({ value: s.id, label: `${s.doc_type} ${s.series}` }))}
                  placeholder="Selecciona serie"
                  searchable={series.length > 8}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Pagos</label>
                <div className="space-y-2">
                  {payments.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          value={p.method}
                          onChange={(v) =>
                            setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: String(v ?? '') } : x)))
                          }
                          options={(paymentMethods.length > 0
                            ? paymentMethods
                            : [
                                { id: 0, code: 'cash', name: 'Efectivo' },
                                { id: 0, code: 'yape', name: 'Yape' },
                                { id: 0, code: 'plin', name: 'Plin' },
                                { id: 0, code: 'tarjeta', name: 'Tarjeta' },
                                { id: 0, code: 'transferencia', name: 'Transferencia' },
                              ]
                          ).map((pm) => ({ value: pm.code, label: pm.name }))}
                          searchable={paymentMethods.length > 8}
                          className="w-full border border-stone-200 rounded-lg px-2 py-1 text-sm bg-white text-left flex items-center justify-between gap-2"
                        />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={p.amount}
                        onChange={(e) => setPayments((ps) => ps.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))}
                        className="w-28 border border-stone-200 rounded-lg px-2 py-1 text-sm shrink-0"
                      />
                      {payments.length > 1 && (
                        <button
                          type="button"
                          title="Quitar pago"
                          onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}
                          className="p-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setPayments((prev) => [
                        ...prev,
                        {
                          method: paymentMethods.find((m) => m.code === 'cash')?.code ?? paymentMethods[0]?.code ?? 'cash',
                          amount: 0,
                        },
                      ])
                    }
                    className="text-xs text-rest-600 hover:underline"
                  >
                    + Otro pago
                  </button>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Total: S/ {total.toFixed(2)} · Pagado: S/ {payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
                </p>
                {totalsByAfectacion.gravado.taxAmount > 0 && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    Op. gravada – IGV: S/ {totalsByAfectacion.gravado.taxAmount.toFixed(2)}
                  </p>
                )}
              </div>

              <button
                onClick={doCheckout}
                disabled={loading || !effectiveContactId || payments.reduce((s, p) => s + p.amount, 0) < total - 0.01}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-green-700"
              >
                {loading ? 'Procesando...' : 'Confirmar venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo cliente rápido */}
      {clientQuickAddOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">Registrar cliente</h3>
              <button type="button" onClick={() => setClientQuickAddOpen(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-24">
                  <SearchableSelect
                    value={clientQuickAdd.doc_type}
                    onChange={(v) => setClientQuickAdd((q) => ({ ...q, doc_type: String(v) }))}
                    options={[
                      { value: '1', label: 'DNI' },
                      { value: '6', label: 'RUC' },
                    ]}
                    searchable={false}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
                <input
                  type="text"
                  value={clientQuickAdd.doc_number}
                  onChange={(e) => setClientQuickAdd((q) => ({ ...q, doc_number: e.target.value.replace(/\D/g, '').slice(0, clientQuickAdd.doc_type === '6' ? 11 : 8) }))}
                  placeholder={clientQuickAdd.doc_type === '6' ? 'RUC' : 'DNI'}
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const ruc = (await companyService.getConfig()).ruc
                    if (!ruc) { toast.error('No se pudo obtener RUC de la empresa'); return }
                    setConsultaLoading(true)
                    try {
                      if (clientQuickAdd.doc_type === '6') {
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
                  disabled={consultaLoading || clientQuickAdd.doc_number.length < (clientQuickAdd.doc_type === '6' ? 11 : 8)}
                  className="px-3 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 disabled:opacity-50"
                >
                  {consultaLoading ? '...' : 'Consultar'}
                </button>
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
                disabled={createContactLoading || !clientQuickAdd.business_name.trim()}
                onClick={async () => {
                  setCreateContactLoading(true)
                  try {
                    const data: CreateContactInput = {
                      type: 'customer',
                      doc_type: clientQuickAdd.doc_type,
                      doc_number: clientQuickAdd.doc_number,
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
        </div>
      )}

      {ordersOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOrdersOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
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
                      <span className="text-sm font-medium text-stone-800">S/ {Number(o.total_amount).toFixed(2)}</span>
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
                  </button>
                  <button
                    type="button"
                    title="Anular pedido"
                    onClick={() => void requestVoidOrder(o)}
                    className="shrink-0 self-center p-2 rounded-lg text-red-600 hover:bg-red-50 border border-red-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {precuentaOpen && precuentaData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPrecuentaOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-stone-800">Precuenta</h3>
                <p className="text-xs text-stone-500">{precuentaData.order_code}</p>
              </div>
              <button type="button" onClick={() => setPrecuentaOpen(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <X size={18} />
              </button>
            </div>
            {precuentaData.customer_name && (
              <p className="text-sm text-stone-600 mb-2">Cliente: {precuentaData.customer_name}</p>
            )}
            <ul className="text-sm space-y-1 mb-3 border-t border-stone-100 pt-2">
              {precuentaData.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-stone-700">
                    {l.quantity}x {l.product_name}
                  </span>
                  <span className="shrink-0">S/ {Number(l.line_total).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-bold text-stone-800 border-t border-stone-200 pt-2">
              <span>Total</span>
              <span className="text-rest-600">S/ {Number(precuentaData.total).toFixed(2)}</span>
            </div>
            <button
              type="button"
              onClick={() => void openPrecuenta()}
              className="mt-4 w-full py-2 border border-stone-200 rounded-xl text-sm hover:bg-stone-50"
            >
              Reimprimir
            </button>
          </div>
        </div>
      )}

      <ReceiptPrintModal
        open={receiptModalOpen}
        onClose={() => { setReceiptModalOpen(false); setPrintData(null); setLastSale(null) }}
        printData={printData}
        saleNumber={lastSale?.number}
        total={lastSale?.total}
      />
    </div>
  )
}
