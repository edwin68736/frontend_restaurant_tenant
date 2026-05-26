import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Send,
  FileText,
  FileCode,
  Archive,
  Eye,
  FileSearch,
  RefreshCw,
  X,
  Download,
  FileOutput,
  Ticket,
  ChevronDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { salesService, formatSaleDocumentNumber, type Sale, type SaleDetail, type SaleItem } from '@/services/sales.service'
import { billingService } from '@/services/billing.service'
import { companyService } from '@/services/company.service'
import { PageShell } from '@/components/layout/PageShell'
import { PortalModal } from '@/components/ui/PortalModal'
import { AnchoredDropdown } from '@/components/ui/AnchoredDropdown'
import SunatRequiredMessage from '@/components/SunatRequiredMessage'
import { SearchInput } from '@/components/SearchInput'
import { SearchableSelect } from '@/components/SearchableSelect'
import { useDebouncedApiSearch } from '@/hooks/useDebouncedApiSearch'
import type { PrintData } from '@/types/printData'
import { getConfiguredPrinter } from '@/services/printers.service'
import { pdfEmbedSrc } from '@/utils/pdfEmbedSrc'
import {
  downloadReceiptPdf,
  generateReceiptPdf,
  openReceiptPdfInNewTab,
  type ReceiptPdfOptions,
} from '@/utils/receiptPdf'
import { salePaymentMethodLabelEs } from '@/utils/paymentMethodLabels'
import { useBillingEvents } from '@/hooks/useBillingEvents'
import {
  billingStatusForUI,
  manualBillingMessage,
  normalizeBillingStatus,
  resolveManualBillingStatus,
} from '@/utils/manualBilling'
import {
  BILLING_STATUS,
  BILLING_STATUS_COLORS,
  BILLING_STATUS_LABELS,
  canShowCdr,
  canShowSunatOfficialPdf,
  canShowXmlGenerated,
  canShowXmlSent,
} from '@/constants/billingStatus'

const STATUS_COLORS = BILLING_STATUS_COLORS
const STATUS_LABELS = BILLING_STATUS_LABELS

const ROW_DROPDOWN_ITEM =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50'

const ICON_BTN = 'p-1.5 rounded-lg disabled:opacity-40 disabled:pointer-events-none shrink-0'
const PDF_A4_BTN = `${ICON_BTN} text-red-600 hover:bg-red-50`
const PDF_TICKET_BTN = `${ICON_BTN} text-orange-700 hover:bg-orange-50`
const DETAIL_BTN = `${ICON_BTN} text-stone-600 hover:bg-stone-100`
const SUNAT_SEND_BTN =
  'inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0'
const SUNAT_RESEND_BTN =
  'inline-flex items-center justify-center p-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 shrink-0'
const DOWNLOAD_DROPDOWN_TRIGGER =
  'inline-flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50'

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

const BILLING_FILTER_STATUSES = ['pending', 'sent', 'accepted', 'rejected', 'error'] as const

type Tab = 'notas' | 'facturacion'

export default function VentasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sunatEnabled, setSunatEnabled] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'facturacion' ? 'facturacion' : 'notas'))
  const [sales, setSales] = useState<Sale[]>([])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [sending, setSending] = useState<number | null>(null)
  const [resending, setResending] = useState<number | null>(null)
  const [downloading, setDownloading] = useState<{ saleId: number; kind: string } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)
  const pdfViewerUrlRef = useRef<string | null>(null)
  const [viewingPdfSaleId, setViewingPdfSaleId] = useState<number | null>(null)
  const [pdfViewerSource, setPdfViewerSource] = useState<'local' | 'sunat'>('local')
  const [localPdfViewerFormat, setLocalPdfViewerFormat] = useState<'a4' | 'ticket'>('a4')
  const [localPdfFormatBarVisible, setLocalPdfFormatBarVisible] = useState(false)
  const localPdfPreviewDataRef = useRef<PrintData | null>(null)
  const [localPdfPreviewBusy, setLocalPdfPreviewBusy] = useState<{ saleId: number; format: 'a4' | 'ticket' } | null>(null)
  const [localTicketTabBusyId, setLocalTicketTabBusyId] = useState<number | null>(null)
  const [localPdfDownloadBusy, setLocalPdfDownloadBusy] = useState<{ saleId: number; format: 'a4' | 'ticket' } | null>(null)
  const [xmlViewerOpen, setXmlViewerOpen] = useState(false)
  const [xmlViewerText, setXmlViewerText] = useState<string | null>(null)
  const [xmlViewerTitle, setXmlViewerTitle] = useState<string>('XML')
  const [viewingXmlSaleId, setViewingXmlSaleId] = useState<number | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  useEffect(() => {
    companyService.getSunat().then((d) => setSunatEnabled(d.sunat_enabled ?? false)).catch(() => setSunatEnabled(false))
  }, [])

  useEffect(() => {
    return () => {
      if (pdfViewerUrlRef.current) {
        URL.revokeObjectURL(pdfViewerUrlRef.current)
        pdfViewerUrlRef.current = null
      }
    }
  }, [])

  const billingStatus = searchParams.get('status') || undefined

  const setBillingStatusFilter = (status: string) => {
    setSearchParams((p) => {
      p.set('tab', 'facturacion')
      if (status) p.set('status', status)
      else p.delete('status')
      return p
    })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    loading,
    isSearching,
    refresh,
  } = useDebouncedApiSearch<{ data: Sale[]; total: number }>({
    cacheScope: 'restaurant-ventas',
    enabled: !(tab === 'facturacion' && sunatEnabled === false),
    deps: [tab, page, perPage, sunatEnabled, billingStatus],
    fetcher: (query, signal) => {
      const params: Parameters<typeof salesService.list>[0] = {
        page,
        per_page: perPage,
      }
      if (query) params.q = query
      if (tab === 'notas') {
        params.sunat_code = '00'
      } else {
        params.sunat_code = '01,03'
        params.billing_status = billingStatus
      }
      return salesService.list(params, { signal })
    },
    onSuccess: ({ data, total: t }) => {
      setSales((data ?? []).map((s) => ({ ...s, billing_status: normalizeBillingStatus(s.billing_status) })))
      setTotal(t ?? 0)
    },
    onError: () => toast.error('Error al cargar'),
  })

  const applyBillingEvent = useCallback((evt: { sale_id: number; status: string }) => {
    const billingStatus = normalizeBillingStatus(evt.status)
    setSales((prev) => prev.map((s) => (s.id === evt.sale_id ? { ...s, billing_status: billingStatus } : s)))
    setDetail((d) => (d && d.sale.id === evt.sale_id
      ? { ...d, sale: { ...d.sale, billing_status: billingStatus } }
      : d))
  }, [])

  useBillingEvents(applyBillingEvent, tab === 'facturacion' && sunatEnabled === true)

  const setTabAndUrl = (t: Tab) => {
    setTab(t)
    setSearchParams(t === 'facturacion' ? { tab: 'facturacion' } : {})
    setPage(1)
  }

  const handleSend = async (saleId: number) => {
    setSending(saleId)
    const tid = toast.loading('Enviando a SUNAT…')
    try {
      const res = await billingService.send(saleId)
      const status = resolveManualBillingStatus(res)
      const msg = manualBillingMessage(res)
      const uiStatus = billingStatusForUI(res)
      if (status === 'accepted' || status === 'already_accepted' || uiStatus === BILLING_STATUS.observed) {
        toast.success(msg, { id: tid })
      } else if (status === 'rejected' || status === 'error') toast.error(msg, { id: tid })
      else toast.info(msg, { id: tid })
      applyBillingEvent({ sale_id: saleId, status: uiStatus })
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (e as Error).message ?? 'Error', { id: tid })
    } finally {
      setSending(null)
    }
  }

  const handleResend = async (saleId: number) => {
    setResending(saleId)
    const tid = toast.loading('Reenviando a SUNAT…')
    try {
      const res = await billingService.resend(saleId)
      const status = resolveManualBillingStatus(res)
      const msg = manualBillingMessage(res)
      const uiStatus = billingStatusForUI(res)
      if (status === 'accepted' || status === 'already_accepted' || uiStatus === BILLING_STATUS.observed) {
        toast.success(msg, { id: tid })
      } else if (status === 'rejected' || status === 'error') toast.error(msg, { id: tid })
      else toast.info(msg, { id: tid })
      applyBillingEvent({ sale_id: saleId, status: uiStatus })
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (e as Error).message ?? 'Error', { id: tid })
    } finally {
      setResending(null)
    }
  }

  const handleDownload = async (saleId: number, kind: 'xml' | 'xml-generated' | 'cdr' | 'pdf') => {
    setDownloading({ saleId, kind })
    try {
      await billingService.downloadDocument(saleId, kind)
      toast.success('Descargado')
    } catch {
      toast.error('No disponible')
    } finally {
      setDownloading(null)
    }
  }

  const openDetail = async (saleId: number) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const d = await salesService.get(saleId)
      setDetail(d)
    } catch {
      toast.error('Error al cargar detalle')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    setOpenDropdownId(null)
  }

  const closeDropdown = () => setOpenDropdownId(null)

  const requirePrintData = async (saleId: number): Promise<PrintData> => {
    const d = await salesService.get(saleId)
    if (!d.print_data) {
      throw new Error('No hay datos para generar el PDF del comprobante.')
    }
    return d.print_data as PrintData
  }

  const localTicketPdfOptions = (): ReceiptPdfOptions => {
    const cfg = getConfiguredPrinter('documentos')
    return { paperWidthMm: cfg?.paperWidthMm === 58 ? 58 : 80 }
  }

  /** Misma información que la impresión (print_data). Ticket usa ancho 58/80 mm de configuración. */
  const openLocalPdfViewer = async (saleId: number, format: 'a4' | 'ticket' = 'a4') => {
    if (pdfViewerUrlRef.current) {
      URL.revokeObjectURL(pdfViewerUrlRef.current)
      pdfViewerUrlRef.current = null
    }
    setPdfViewerSource('local')
    setLocalPdfViewerFormat(format)
    setPdfViewerOpen(true)
    setPdfViewerUrl(null)
    setLocalPdfFormatBarVisible(false)
    localPdfPreviewDataRef.current = null
    setLocalPdfPreviewBusy({ saleId, format })
    try {
      const pd = await requirePrintData(saleId)
      localPdfPreviewDataRef.current = pd
      setLocalPdfFormatBarVisible(true)
      const doc = await generateReceiptPdf(pd, format, format === 'ticket' ? localTicketPdfOptions() : undefined)
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      pdfViewerUrlRef.current = url
      setPdfViewerUrl(url)
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'No se pudo generar el PDF local')
      setPdfViewerOpen(false)
      localPdfPreviewDataRef.current = null
      setLocalPdfFormatBarVisible(false)
    } finally {
      setLocalPdfPreviewBusy(null)
    }
  }

  const switchLocalPdfPreviewFormat = async (format: 'a4' | 'ticket') => {
    const pd = localPdfPreviewDataRef.current
    if (!pd || pdfViewerSource !== 'local') return
    if (format === localPdfViewerFormat && pdfViewerUrl) return
    if (pdfViewerUrlRef.current) {
      URL.revokeObjectURL(pdfViewerUrlRef.current)
      pdfViewerUrlRef.current = null
    }
    setPdfViewerUrl(null)
    setLocalPdfViewerFormat(format)
    try {
      const doc = await generateReceiptPdf(pd, format, format === 'ticket' ? localTicketPdfOptions() : undefined)
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      pdfViewerUrlRef.current = url
      setPdfViewerUrl(url)
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'No se pudo cambiar el formato del PDF')
    }
  }

  const downloadLocalPdf = async (saleId: number, format: 'a4' | 'ticket' = 'a4') => {
    setLocalPdfDownloadBusy({ saleId, format })
    try {
      const pd = await requirePrintData(saleId)
      await downloadReceiptPdf(pd, format, format === 'ticket' ? localTicketPdfOptions() : undefined)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'No se pudo descargar el PDF')
    } finally {
      setLocalPdfDownloadBusy(null)
    }
  }

  const openLocalPdfTicketTab = async (saleId: number) => {
    setLocalTicketTabBusyId(saleId)
    try {
      const pd = await requirePrintData(saleId)
      await openReceiptPdfInNewTab(pd, 'ticket', localTicketPdfOptions())
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'No se pudo abrir el PDF ticket')
    } finally {
      setLocalTicketTabBusyId(null)
    }
  }

  /** PDF devuelto por el PSE / almacenado tras envío a SUNAT (puede no existir si aún está pendiente). */
  const openSunatPdfViewer = async (saleId: number) => {
    if (pdfViewerUrlRef.current) {
      URL.revokeObjectURL(pdfViewerUrlRef.current)
      pdfViewerUrlRef.current = null
    }
    localPdfPreviewDataRef.current = null
    setLocalPdfFormatBarVisible(false)
    setPdfViewerSource('sunat')
    setPdfViewerOpen(true)
    setPdfViewerUrl(null)
    setViewingPdfSaleId(saleId)
    try {
      const url = await billingService.getPdfObjectUrl(saleId)
      pdfViewerUrlRef.current = url
      setPdfViewerUrl(url)
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? 'PDF oficial no disponible')
      setPdfViewerOpen(false)
    } finally {
      setViewingPdfSaleId(null)
    }
  }

  const closePdfViewer = () => {
    if (pdfViewerUrlRef.current) {
      URL.revokeObjectURL(pdfViewerUrlRef.current)
      pdfViewerUrlRef.current = null
    }
    localPdfPreviewDataRef.current = null
    setLocalPdfFormatBarVisible(false)
    setLocalPdfViewerFormat('a4')
    setPdfViewerUrl(null)
    setPdfViewerOpen(false)
  }

  const openXmlViewer = async (saleId: number, kind: 'xml' | 'xml-generated') => {
    setXmlViewerOpen(true)
    setXmlViewerText(null)
    setXmlViewerTitle(kind === 'xml' ? 'XML enviado' : 'XML generado')
    setViewingXmlSaleId(saleId)
    try {
      const text = await billingService.getXmlText(saleId, kind)
      setXmlViewerText(text)
    } catch (e: any) {
      toast.error(e?.message ?? 'XML no disponible')
      setXmlViewerOpen(false)
    } finally {
      setViewingXmlSaleId(null)
    }
  }

  const closeXmlViewer = () => {
    setXmlViewerOpen(false)
    setXmlViewerText(null)
  }

  const formatMoney = (value: unknown) => `S/ ${Number(value ?? 0).toFixed(2)}`
  const formatQty = (value: unknown) => {
    const n = Number(value ?? 0)
    if (Number.isNaN(n)) return '0'
    const s = n.toFixed(3).replace(/\.?0+$/, '')
    return s
  }
  const saleNumber = (s: Sale) => formatSaleDocumentNumber(s)
  const itemLineTotal = (it: SaleItem) => Number(it.total ?? 0)

  const renderLocalPdfActions = (saleId: number, menuKey: string) => (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        type="button"
        className={PDF_TICKET_BTN}
        title="Ver ticket en modal"
        disabled={localPdfPreviewBusy?.saleId === saleId && localPdfPreviewBusy?.format === 'ticket'}
        onClick={() => void openLocalPdfViewer(saleId, 'ticket')}
      >
        {localPdfPreviewBusy?.saleId === saleId && localPdfPreviewBusy?.format === 'ticket' ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Ticket size={14} />
        )}
      </button>
      <button
        type="button"
        className={PDF_A4_BTN}
        title="Ver A4 en modal"
        disabled={localPdfPreviewBusy?.saleId === saleId && localPdfPreviewBusy?.format === 'a4'}
        onClick={() => void openLocalPdfViewer(saleId, 'a4')}
      >
        {localPdfPreviewBusy?.saleId === saleId && localPdfPreviewBusy?.format === 'a4' ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <FileOutput size={14} />
        )}
      </button>
      <button
        type="button"
        className={DETAIL_BTN}
        title="Abrir ticket en pestaña"
        disabled={localTicketTabBusyId === saleId}
        onClick={() => void openLocalPdfTicketTab(saleId)}
      >
        {localTicketTabBusyId === saleId ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <ExternalLink size={14} />
        )}
      </button>
      <AnchoredDropdown
        menuId={`${menuKey}-pdf-dl-${saleId}`}
        openId={openDropdownId}
        onOpenChange={setOpenDropdownId}
        triggerClassName={DOWNLOAD_DROPDOWN_TRIGGER}
        trigger={
          <>
            <Download size={14} className="shrink-0" />
            <ChevronDown size={14} className="shrink-0 opacity-60" />
          </>
        }
      >
        <button
          type="button"
          className={ROW_DROPDOWN_ITEM}
          disabled={localPdfDownloadBusy?.saleId === saleId && localPdfDownloadBusy?.format === 'ticket'}
          onClick={() => {
            closeDropdown()
            void downloadLocalPdf(saleId, 'ticket')
          }}
        >
          <Download size={14} />
          Descargar ticket
        </button>
        <button
          type="button"
          className={ROW_DROPDOWN_ITEM}
          disabled={localPdfDownloadBusy?.saleId === saleId && localPdfDownloadBusy?.format === 'a4'}
          onClick={() => {
            closeDropdown()
            void downloadLocalPdf(saleId, 'a4')
          }}
        >
          <Download size={14} />
          Descargar A4
        </button>
      </AnchoredDropdown>
    </div>
  )

  const renderSunatPseActions = (
    sale: Sale,
    menuKey: string,
    options?: { showXmlViewers?: boolean; hideDetailButton?: boolean },
  ) => {
    const bs = sale.billing_status
    const showXmlViewers = options?.showXmlViewers ?? false
    const hideDetailButton = options?.hideDetailButton ?? false
    const hasSunatDownloads =
      canShowSunatOfficialPdf(bs) || canShowXmlSent(bs) || canShowXmlGenerated(bs) || canShowCdr(bs)
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {!hideDetailButton && (
          <button
            type="button"
            className={DETAIL_BTN}
            title="Ver detalle"
            onClick={() => openDetail(sale.id)}
          >
            <Eye size={14} />
          </button>
        )}
        {bs === 'pending' && (
          <button
            type="button"
            className={SUNAT_SEND_BTN}
            title="Enviar a SUNAT"
            disabled={sending === sale.id}
            onClick={() => void handleSend(sale.id)}
          >
            {sending === sale.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        )}
        {(bs === 'error' || bs === 'sent') && (
          <button
            type="button"
            className={SUNAT_RESEND_BTN}
            title="Reenviar a SUNAT"
            disabled={resending === sale.id}
            onClick={() => void handleResend(sale.id)}
          >
            {resending === sale.id ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        )}
        {hasSunatDownloads && (
        <AnchoredDropdown
          menuId={`${menuKey}-sunat-dl-${sale.id}`}
          openId={openDropdownId}
          onOpenChange={setOpenDropdownId}
          triggerClassName={DOWNLOAD_DROPDOWN_TRIGGER}
          trigger={
            <>
              <Download size={14} className="shrink-0" />
              <ChevronDown size={14} className="shrink-0 opacity-60" />
            </>
          }
        >
          {canShowSunatOfficialPdf(bs) && (
            <>
              <button
                type="button"
                className={ROW_DROPDOWN_ITEM}
                disabled={viewingPdfSaleId === sale.id}
                onClick={() => {
                  closeDropdown()
                  void openSunatPdfViewer(sale.id)
                }}
              >
                <FileSearch size={14} />
                Ver PDF oficial
              </button>
              <button
                type="button"
                className={ROW_DROPDOWN_ITEM}
                disabled={downloading?.saleId === sale.id && downloading?.kind === 'pdf'}
                onClick={() => {
                  closeDropdown()
                  void handleDownload(sale.id, 'pdf')
                }}
              >
                <FileText size={14} />
                Descargar PDF oficial
              </button>
            </>
          )}
          {canShowXmlSent(bs) && (
            <>
              {showXmlViewers && (
                <button
                  type="button"
                  className={ROW_DROPDOWN_ITEM}
                  disabled={viewingXmlSaleId === sale.id}
                  onClick={() => {
                    closeDropdown()
                    void openXmlViewer(sale.id, 'xml')
                  }}
                >
                  <FileCode size={14} />
                  Ver XML enviado
                </button>
              )}
              <button
                type="button"
                className={ROW_DROPDOWN_ITEM}
                disabled={downloading?.saleId === sale.id && downloading?.kind === 'xml'}
                onClick={() => {
                  closeDropdown()
                  void handleDownload(sale.id, 'xml')
                }}
              >
                <FileCode size={14} />
                Descargar XML enviado
              </button>
            </>
          )}
          {canShowXmlGenerated(bs) && (
            <>
              {showXmlViewers && (
                <button
                  type="button"
                  className={ROW_DROPDOWN_ITEM}
                  disabled={viewingXmlSaleId === sale.id}
                  onClick={() => {
                    closeDropdown()
                    void openXmlViewer(sale.id, 'xml-generated')
                  }}
                >
                  <FileCode size={14} />
                  Ver XML generado
                </button>
              )}
              <button
                type="button"
                className={ROW_DROPDOWN_ITEM}
                disabled={downloading?.saleId === sale.id && downloading?.kind === 'xml-generated'}
                onClick={() => {
                  closeDropdown()
                  void handleDownload(sale.id, 'xml-generated')
                }}
              >
                <FileCode size={14} />
                Descargar XML generado
              </button>
            </>
          )}
          {canShowCdr(bs) && (
            <button
              type="button"
              className={ROW_DROPDOWN_ITEM}
              disabled={downloading?.saleId === sale.id && downloading?.kind === 'cdr'}
              onClick={() => {
                closeDropdown()
                void handleDownload(sale.id, 'cdr')
              }}
            >
              <Archive size={14} />
              Descargar CDR
            </button>
          )}
        </AnchoredDropdown>
        )}
      </div>
    )
  }

  if (sunatEnabled === null) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <PageShell
      className="flex-1 min-h-0"
      title="Ventas"
      subtitle="Notas de venta y facturación electrónica"
      actions={
        <>
          <button
            type="button"
            onClick={() => setTabAndUrl('notas')}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
              tab === 'notas'
                ? 'bg-rest-600 text-white border-rest-600'
                : 'bg-white text-stone-600 border-stone-200 hover:border-rest-300'
            }`}
          >
            Notas de venta
          </button>
          <button
            type="button"
            onClick={() => setTabAndUrl('facturacion')}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
              tab === 'facturacion'
                ? 'bg-rest-600 text-white border-rest-600'
                : 'bg-white text-stone-600 border-stone-200 hover:border-rest-300'
            }`}
          >
            Facturación
          </button>
          {tab === 'facturacion' && sunatEnabled && (
            <div className="w-full sm:w-auto sm:min-w-[11rem]">
              <SearchableSelect
                value={searchParams.get('status') ?? ''}
                onChange={(v) => setBillingStatusFilter(String(v ?? ''))}
                options={[
                  { value: '', label: 'Todos los estados' },
                  ...BILLING_FILTER_STATUSES.map((status) => ({
                    value: status,
                    label: STATUS_LABELS[status],
                  })),
                ]}
                placeholder="Estado SUNAT"
                searchable={false}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
              />
            </div>
          )}
        </>
      }
    >
      {tab === 'facturacion' && !sunatEnabled && <SunatRequiredMessage />}

      {(tab === 'notas' || sunatEnabled) && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 mb-4 sm:mb-5">
            <SearchInput
              value={searchInput}
              onChange={(v) => {
                setSearchInput(v)
                setPage(1)
              }}
              isSearching={isSearching}
              placeholder="Buscar por número..."
              className="w-full sm:flex-1 sm:min-w-[260px] order-first"
              inputClassName="bg-white text-sm"
            />
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 bg-white shrink-0"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Comprobante</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Total</th>
                      {tab === 'facturacion' && (
                        <>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Estado SUNAT</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">PDF local</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">SUNAT / PSE</th>
                        </>
                      )}
                      {tab === 'notas' && (
                        <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-4 py-3 text-stone-500 text-xs">
                          {s.issue_date ? new Date(s.issue_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-stone-700">{s.doc_type}</span>
                          <span className="font-bold text-stone-800 ml-1">{formatSaleDocumentNumber(s)}</span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{s.contact_name ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold text-stone-800">
                          S/ {Number(s.total).toFixed(2)}
                        </td>
                        {tab === 'facturacion' && (
                          <>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  STATUS_COLORS[s.billing_status] ?? 'bg-stone-100 text-stone-600'
                                }`}
                              >
                                {STATUS_LABELS[s.billing_status] ?? s.billing_status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{renderLocalPdfActions(s.id, 'fact')}</td>
                            <td className="px-4 py-3">{renderSunatPseActions(s, 'fact')}</td>
                          </>
                        )}
                        {tab === 'notas' && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openDetail(s.id)}
                                className={DETAIL_BTN}
                                title="Ver detalle"
                              >
                                <Eye size={14} />
                              </button>
                              {renderLocalPdfActions(s.id, 'nota')}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sales.length === 0 && !loading && (
                  <div className="px-4 py-12 text-center text-stone-500 text-sm">
                    No hay comprobantes en esta sección.
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-stone-200 bg-stone-50/90 px-3 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-stone-600">
                  <label className="flex items-center gap-1.5">
                    <span className="text-stone-500">Mostrar</span>
                    <div className="w-[4.5rem]">
                      <SearchableSelect
                        value={perPage}
                        onChange={(v) => {
                          setPerPage(Number(v))
                          setPage(1)
                        }}
                        options={PER_PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
                        searchable={false}
                        className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white text-left flex items-center justify-between gap-1 min-h-0"
                      />
                    </div>
                    <span className="text-stone-500">por página</span>
                  </label>
                  {total > 0 ? (
                    <span className="text-stone-500">
                      Mostrando <span className="font-medium text-stone-700">{from}-{to}</span> de{' '}
                      <span className="font-medium text-stone-700">{total}</span> registros
                    </span>
                  ) : (
                    <span className="text-stone-400">Sin registros</span>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                      title="Anterior"
                    >
                      <ChevronLeft size={15} />
                      <span className="hidden sm:inline">Ant.</span>
                    </button>
                    <span className="text-xs text-stone-600 tabular-nums px-1 min-w-[4.5rem] text-center">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                      title="Siguiente"
                    >
                      <span className="hidden sm:inline">Sig.</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
          </div>
        </>
      )}

      <PortalModal open={detailOpen} onClose={closeDetail} className="max-w-5xl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-h-[min(92dvh,900px)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Detalle</h3>
                {detail?.sale ? (
                  <p className="text-xs text-stone-500">
                    {detail.sale.doc_type} · {saleNumber(detail.sale)}
                  </p>
                ) : (
                  <p className="text-xs text-stone-500">Comprobante</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-600"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detail ? (
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                    <div className="text-xs text-stone-500">Cliente</div>
                    <div className="text-sm font-semibold text-stone-800">{detail.sale.contact_name ?? '—'}</div>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                    <div className="text-xs text-stone-500">Fecha</div>
                    <div className="text-sm font-semibold text-stone-800">
                      {detail.sale.issue_date ? new Date(detail.sale.issue_date).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>

                {((detail.payments?.length ?? 0) > 0 ||
                  Boolean(detail.sale.payment_method && String(detail.sale.payment_method).trim())) && (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Pagos</div>
                    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                      <table className="w-full text-sm min-w-[280px]">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold text-stone-500">
                            <th className="px-3 py-2">Método</th>
                            <th className="px-3 py-2 text-right">Monto</th>
                            <th className="px-3 py-2">Referencia / notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.payments ?? []).map((p) => (
                            <tr key={p.id} className="border-b border-stone-100 last:border-0">
                              <td className="px-3 py-2 font-medium text-stone-800">
                                {salePaymentMethodLabelEs(p.method)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-stone-800">
                                {formatMoney(p.amount)}
                              </td>
                              <td className="px-3 py-2 text-stone-600 text-xs break-words">
                                {[p.reference, p.notes].filter(Boolean).join(' · ') || '—'}
                              </td>
                            </tr>
                          ))}
                          {(detail.payments ?? []).length === 0 &&
                            detail.sale.payment_method &&
                            String(detail.sale.payment_method).trim() && (
                              <tr>
                                <td className="px-3 py-2 font-medium text-stone-800">
                                  {salePaymentMethodLabelEs(detail.sale.payment_method)}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-stone-800">
                                  {formatMoney(detail.sale.total)}
                                </td>
                                <td className="px-3 py-2 text-xs text-stone-500">—</td>
                              </tr>
                            )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-stone-800">Items</div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {renderLocalPdfActions(detail.sale.id, 'detail')}
                      {tab === 'facturacion' &&
                        renderSunatPseActions(detail.sale, 'detail', {
                          showXmlViewers: true,
                          hideDetailButton: true,
                        })}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Descripción</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">Cant.</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">P. Unit</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">Subtotal</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">IGV</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.items ?? []).map((it) => (
                          <tr key={it.id} className="border-b border-stone-100">
                            <td className="px-4 py-2">
                              <div className="text-sm font-medium text-stone-800">{it.description}</div>
                              {it.code ? <div className="text-xs text-stone-500 font-mono">{it.code}</div> : null}
                            </td>
                            <td className="px-4 py-2 text-right text-stone-700">{formatQty(it.quantity)}</td>
                            <td className="px-4 py-2 text-right text-stone-700">{formatMoney(it.unit_price)}</td>
                            <td className="px-4 py-2 text-right text-stone-700">{formatMoney(it.subtotal)}</td>
                            <td className="px-4 py-2 text-right text-stone-700">{formatMoney(it.tax_amount)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-stone-800">{formatMoney(itemLineTotal(it))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-end sm:justify-end gap-2">
                    <div className="text-xs text-stone-500 sm:text-right">
                      <div>Subtotal: <span className="font-semibold text-stone-700">{formatMoney(detail.sale.subtotal)}</span></div>
                      <div>IGV: <span className="font-semibold text-stone-700">{formatMoney(detail.sale.tax_amount)}</span></div>
                      <div className="text-sm">Total: <span className="font-bold text-stone-900">{formatMoney(detail.sale.total)}</span></div>
                    </div>
                  </div>
                </div>

                {tab === 'facturacion' && (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-stone-800">SUNAT</div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[detail.sale.billing_status] ?? 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {STATUS_LABELS[detail.sale.billing_status] ?? detail.sale.billing_status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-stone-600">
                      {detail.invoice?.sunat_message ? detail.invoice.sunat_message : '—'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-sm text-stone-500">No se pudo cargar el detalle.</div>
            )}
          </div>
      </PortalModal>

      <PortalModal open={pdfViewerOpen} onClose={closePdfViewer} className="max-w-5xl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-h-[min(92dvh,900px)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-800">
                {pdfViewerSource === 'local'
                  ? localPdfViewerFormat === 'ticket'
                    ? 'PDF local (ticket · representación impresa)'
                    : 'PDF local (A4 · representación impresa)'
                  : 'PDF oficial SUNAT / PSE'}
              </h3>
              <button
                type="button"
                onClick={closePdfViewer}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-600"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            {pdfViewerSource === 'local' && localPdfFormatBarVisible && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stone-200 bg-stone-50">
                <span className="text-xs font-medium text-stone-500">Vista previa</span>
                <button
                  type="button"
                  onClick={() => void switchLocalPdfPreviewFormat('a4')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                    localPdfViewerFormat === 'a4'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => void switchLocalPdfPreviewFormat('ticket')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                    localPdfViewerFormat === 'ticket'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Ticket
                </button>
              </div>
            )}
            {pdfViewerUrl ? (
              <div className="bg-stone-100 p-1">
                <iframe
                  src={pdfEmbedSrc(pdfViewerUrl)}
                  title="Comprobante PDF"
                  className="h-[75vh] min-h-[320px] w-full border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
      </PortalModal>

      <PortalModal open={xmlViewerOpen} onClose={closeXmlViewer} className="max-w-5xl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-h-[min(92dvh,900px)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-800">{xmlViewerTitle}</h3>
              <button
                type="button"
                onClick={closeXmlViewer}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-600"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            {xmlViewerText != null ? (
              <pre className="p-4 text-xs overflow-auto max-h-[75vh] bg-stone-50 text-stone-700 whitespace-pre-wrap break-words">
                {xmlViewerText}
              </pre>
            ) : (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
      </PortalModal>
    </PageShell>
  )
}
