import { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { salesService, formatSaleDocumentNumber, type Sale, type SaleDetail, type SaleItem } from '@/services/sales.service'
import { billingService } from '@/services/billing.service'
import { companyService } from '@/services/company.service'
import SunatRequiredMessage from '@/components/SunatRequiredMessage'
import { SearchInput } from '@/components/SearchInput'
import { useDebouncedApiSearch } from '@/hooks/useDebouncedApiSearch'
import type { PrintData } from '@/types/printData'
import { downloadReceiptPdf, generateReceiptPdf, openReceiptPdfInNewTab } from '@/utils/receiptPdf'
import { salePaymentMethodLabelEs } from '@/utils/paymentMethodLabels'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  error: 'bg-orange-100 text-orange-700',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  error: 'Error',
}

const ROW_DROPDOWN_PANEL =
  'absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-stone-200 bg-white py-1 shadow-lg text-left'
const ROW_DROPDOWN_ITEM =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50'

function closeDetailsFromClick(e: React.MouseEvent<HTMLElement>) {
  const d = e.currentTarget.closest('details')
  if (d) (d as HTMLDetailsElement).open = false
}

type Tab = 'notas' | 'facturacion'

export default function VentasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sunatEnabled, setSunatEnabled] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'facturacion' ? 'facturacion' : 'notas'))
  const [sales, setSales] = useState<Sale[]>([])
  const [page, setPage] = useState(1)
  const [perPage] = useState(25)
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
      setSales(data ?? [])
      setTotal(t ?? 0)
    },
    onError: () => toast.error('Error al cargar'),
  })

  const setTabAndUrl = (t: Tab) => {
    setTab(t)
    setSearchParams(t === 'facturacion' ? { tab: 'facturacion' } : {})
    setPage(1)
  }

  const handleSend = async (saleId: number) => {
    setSending(saleId)
    const tid = toast.loading('Factura en proceso…')
    try {
      const res = await billingService.send(saleId)
      if (res.async || !res.safe_to_print) {
        const poll = async () => {
          const deadline = Date.now() + 120_000
          while (Date.now() < deadline) {
            const st = await billingService.getStatus(saleId)
            const labels: Record<string, string> = {
              PENDING_QUEUE: 'En cola',
              PROCESSING: 'Procesando',
              SENDING_TO_FACTURADOR: 'Enviando al facturador',
              SENDING_TO_SUNAT: 'Enviando a SUNAT',
              SUNAT_ACCEPTED: 'Aceptada por SUNAT',
              SUNAT_REJECTED: 'Rechazada',
              FAILED: 'Error',
            }
            toast.loading(labels[st.status] ?? 'En proceso…', { id: tid })
            if (st.safe_to_print) {
              toast.success('Aceptada por SUNAT', { id: tid })
              return
            }
            if (['SUNAT_REJECTED', 'FAILED', 'DEAD_LETTER', 'UNKNOWN'].includes(st.status)) {
              toast.error(st.sunat_message || labels[st.status] || 'Error', { id: tid })
              return
            }
            if (!st.async_in_progress && st.status !== 'PENDING_QUEUE') break
            await new Promise((r) => setTimeout(r, 1500))
          }
          throw new Error('Tiempo de espera agotado')
        }
        await poll()
      } else if (res.safe_to_print) {
        toast.success('Aceptada por SUNAT', { id: tid })
      } else {
        toast.error(res.message ?? 'Sin confirmación SUNAT', { id: tid })
      }
      refresh()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (e as Error).message ?? 'Error', { id: tid })
    } finally {
      setSending(null)
    }
  }

  const handleResend = async (saleId: number) => {
    setResending(saleId)
    try {
      const res = await billingService.resend(saleId)
      toast[res.success ? 'success' : 'error'](res.message ?? (res.success ? 'Reenviado a SUNAT' : 'Error'))
      refresh()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
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
  }

  const requirePrintData = async (saleId: number): Promise<PrintData> => {
    const d = await salesService.get(saleId)
    if (!d.print_data) {
      throw new Error('No hay datos para generar el PDF del comprobante.')
    }
    return d.print_data as PrintData
  }

  /** Misma información que la impresión (print_data). `format`: vista previa A4 o ticket (80 mm). */
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
      const doc = await generateReceiptPdf(pd, format)
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
      const doc = await generateReceiptPdf(pd, format)
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
      await downloadReceiptPdf(pd, format)
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
      await openReceiptPdfInNewTab(pd, 'ticket')
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
  const canShowXmlSent = (status: Sale['billing_status']) => status === 'sent' || status === 'accepted' || status === 'rejected'
  const canShowXmlGenerated = (status: Sale['billing_status']) => status === 'pending' || status === 'error'
  const canShowCdr = (status: Sale['billing_status']) => status === 'accepted' || status === 'rejected'
  const canShowSunatOfficialPdf = (status: Sale['billing_status']) => status === 'sent' || status === 'accepted'

  if (sunatEnabled === null) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <div className="mb-3 shrink-0">
        <h2 className="text-lg font-bold text-stone-800">Ventas</h2>
        <p className="text-sm text-stone-500">Notas de venta y facturación electrónica</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTabAndUrl('notas')}
          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
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
          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
            tab === 'facturacion'
              ? 'bg-rest-600 text-white border-rest-600'
              : 'bg-white text-stone-600 border-stone-200 hover:border-rest-300'
          }`}
        >
          Facturación (boletas y facturas)
        </button>
      </div>

      {tab === 'facturacion' && !sunatEnabled && <SunatRequiredMessage />}

      {(tab === 'notas' || sunatEnabled) && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              isSearching={isSearching}
              placeholder="Buscar por número..."
              className="flex-1 min-w-[180px] max-w-xs"
          inputClassName="text-sm"
            />
            <button
              type="button"
              onClick={() => refresh()}
              className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {tab === 'facturacion' && (
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {(['pending', 'sent', 'accepted', 'rejected', 'error'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setSearchParams((p) => {
                      p.set('tab', 'facturacion')
                      p.set('status', status)
                      return p
                    })
                    setPage(1)
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    searchParams.get('status') === status
                      ? 'bg-rest-600 text-white border-rest-600'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-stone-50 border-b border-stone-200">
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
                            <td className="px-4 py-3 relative">
                              <details className="relative inline-block text-left">
                                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                                  <FileText size={14} className="shrink-0" />
                                  PDF
                                  <ChevronDown size={14} className="shrink-0 opacity-60" />
                                </summary>
                                <div className={ROW_DROPDOWN_PANEL}>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfPreviewBusy?.saleId === s.id && localPdfPreviewBusy?.format === 'ticket'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void openLocalPdfViewer(s.id, 'ticket')
                                    }}
                                  >
                                    <Ticket size={14} />
                                    Ver ticket
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfPreviewBusy?.saleId === s.id && localPdfPreviewBusy?.format === 'a4'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void openLocalPdfViewer(s.id, 'a4')
                                    }}
                                  >
                                    <FileOutput size={14} />
                                    Ver A4
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfDownloadBusy?.saleId === s.id &&
                                      localPdfDownloadBusy?.format === 'ticket'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void downloadLocalPdf(s.id, 'ticket')
                                    }}
                                  >
                                    <Download size={14} />
                                    Descargar ticket
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfDownloadBusy?.saleId === s.id && localPdfDownloadBusy?.format === 'a4'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void downloadLocalPdf(s.id, 'a4')
                                    }}
                                  >
                                    <Download size={14} />
                                    Descargar A4
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={localTicketTabBusyId === s.id}
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void openLocalPdfTicketTab(s.id)
                                    }}
                                  >
                                    <ExternalLink size={14} />
                                    Ticket en pestaña
                                  </button>
                                </div>
                              </details>
                            </td>
                            <td className="px-4 py-3 relative">
                              <details className="relative inline-block text-left">
                                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                                  Más
                                  <ChevronDown size={14} className="shrink-0 opacity-60" />
                                </summary>
                                <div className={ROW_DROPDOWN_PANEL}>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      openDetail(s.id)
                                    }}
                                  >
                                    <Eye size={14} />
                                    Ver detalle
                                  </button>
                                  {s.billing_status === 'pending' && (
                                    <button
                                      type="button"
                                      className={ROW_DROPDOWN_ITEM}
                                      disabled={sending === s.id}
                                      onClick={(e) => {
                                        closeDetailsFromClick(e)
                                        void handleSend(s.id)
                                      }}
                                    >
                                      {sending === s.id ? (
                                        <RefreshCw size={14} className="animate-spin" />
                                      ) : (
                                        <Send size={14} />
                                      )}
                                      Enviar a SUNAT
                                    </button>
                                  )}
                                  {(s.billing_status === 'error' || s.billing_status === 'sent') && (
                                    <button
                                      type="button"
                                      className={ROW_DROPDOWN_ITEM}
                                      disabled={resending === s.id}
                                      onClick={(e) => {
                                        closeDetailsFromClick(e)
                                        void handleResend(s.id)
                                      }}
                                    >
                                      {resending === s.id ? (
                                        <RefreshCw size={14} className="animate-spin" />
                                      ) : (
                                        <RefreshCw size={14} />
                                      )}
                                      Reenviar a SUNAT
                                    </button>
                                  )}
                                  {canShowSunatOfficialPdf(s.billing_status) && (
                                    <>
                                      <button
                                        type="button"
                                        className={ROW_DROPDOWN_ITEM}
                                        disabled={viewingPdfSaleId === s.id}
                                        onClick={(e) => {
                                          closeDetailsFromClick(e)
                                          void openSunatPdfViewer(s.id)
                                        }}
                                      >
                                        <FileSearch size={14} />
                                        Ver PDF oficial
                                      </button>
                                      <button
                                        type="button"
                                        className={ROW_DROPDOWN_ITEM}
                                        disabled={downloading?.saleId === s.id && downloading?.kind === 'pdf'}
                                        onClick={(e) => {
                                          closeDetailsFromClick(e)
                                          void handleDownload(s.id, 'pdf')
                                        }}
                                      >
                                        <FileText size={14} />
                                        Descargar PDF oficial
                                      </button>
                                    </>
                                  )}
                                  {canShowXmlSent(s.billing_status) && (
                                    <button
                                      type="button"
                                      className={ROW_DROPDOWN_ITEM}
                                      disabled={downloading?.saleId === s.id && downloading?.kind === 'xml'}
                                      onClick={(e) => {
                                        closeDetailsFromClick(e)
                                        void handleDownload(s.id, 'xml')
                                      }}
                                    >
                                      <FileCode size={14} />
                                      Descargar XML enviado
                                    </button>
                                  )}
                                  {canShowXmlGenerated(s.billing_status) && (
                                    <button
                                      type="button"
                                      className={ROW_DROPDOWN_ITEM}
                                      disabled={downloading?.saleId === s.id && downloading?.kind === 'xml-generated'}
                                      onClick={(e) => {
                                        closeDetailsFromClick(e)
                                        void handleDownload(s.id, 'xml-generated')
                                      }}
                                    >
                                      <FileCode size={14} />
                                      Descargar XML generado
                                    </button>
                                  )}
                                  {canShowCdr(s.billing_status) && (
                                    <button
                                      type="button"
                                      className={ROW_DROPDOWN_ITEM}
                                      disabled={downloading?.saleId === s.id && downloading?.kind === 'cdr'}
                                      onClick={(e) => {
                                        closeDetailsFromClick(e)
                                        void handleDownload(s.id, 'cdr')
                                      }}
                                    >
                                      <Archive size={14} />
                                      Descargar CDR
                                    </button>
                                  )}
                                </div>
                              </details>
                            </td>
                          </>
                        )}
                        {tab === 'notas' && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openDetail(s.id)}
                                className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100"
                                title="Ver detalle"
                              >
                                <Eye size={14} />
                              </button>
                              <details className="relative inline-block text-left">
                                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                                  <FileText size={14} className="shrink-0" />
                                  PDF
                                  <ChevronDown size={14} className="shrink-0 opacity-60" />
                                </summary>
                                <div className={ROW_DROPDOWN_PANEL}>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfPreviewBusy?.saleId === s.id && localPdfPreviewBusy?.format === 'ticket'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void openLocalPdfViewer(s.id, 'ticket')
                                    }}
                                  >
                                    <Ticket size={14} />
                                    Ver ticket
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfPreviewBusy?.saleId === s.id && localPdfPreviewBusy?.format === 'a4'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void openLocalPdfViewer(s.id, 'a4')
                                    }}
                                  >
                                    <FileOutput size={14} />
                                    Ver A4
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfDownloadBusy?.saleId === s.id &&
                                      localPdfDownloadBusy?.format === 'ticket'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void downloadLocalPdf(s.id, 'ticket')
                                    }}
                                  >
                                    <Download size={14} />
                                    Descargar ticket
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={
                                      localPdfDownloadBusy?.saleId === s.id && localPdfDownloadBusy?.format === 'a4'
                                    }
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void downloadLocalPdf(s.id, 'a4')
                                    }}
                                  >
                                    <Download size={14} />
                                    Descargar A4
                                  </button>
                                  <button
                                    type="button"
                                    className={ROW_DROPDOWN_ITEM}
                                    disabled={localTicketTabBusyId === s.id}
                                    onClick={(e) => {
                                      closeDetailsFromClick(e)
                                      void openLocalPdfTicketTab(s.id)
                                    }}
                                  >
                                    <ExternalLink size={14} />
                                    Ticket en pestaña
                                  </button>
                                </div>
                              </details>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sales.length === 0 && !loading && (
                <div className="px-4 py-12 text-center text-stone-500 text-sm">
                  No hay comprobantes en esta sección.
                </div>
              )}
              {total > perPage && (
                <div className="px-4 py-3 border-t border-stone-100 text-xs text-stone-500">
                  Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetail()
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
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
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-64px)]">
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
                      <details className="relative inline-block text-left">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                          <FileText size={14} className="shrink-0" />
                          PDF local
                          <ChevronDown size={14} className="shrink-0 opacity-60" />
                        </summary>
                        <div className={ROW_DROPDOWN_PANEL}>
                          <button
                            type="button"
                            className={ROW_DROPDOWN_ITEM}
                            disabled={
                              localPdfPreviewBusy?.saleId === detail.sale.id &&
                              localPdfPreviewBusy?.format === 'ticket'
                            }
                            onClick={(e) => {
                              closeDetailsFromClick(e)
                              void openLocalPdfViewer(detail.sale.id, 'ticket')
                            }}
                          >
                            <Ticket size={14} />
                            Ver ticket
                          </button>
                          <button
                            type="button"
                            className={ROW_DROPDOWN_ITEM}
                            disabled={
                              localPdfPreviewBusy?.saleId === detail.sale.id &&
                              localPdfPreviewBusy?.format === 'a4'
                            }
                            onClick={(e) => {
                              closeDetailsFromClick(e)
                              void openLocalPdfViewer(detail.sale.id, 'a4')
                            }}
                          >
                            <FileOutput size={14} />
                            Ver A4
                          </button>
                          <button
                            type="button"
                            className={ROW_DROPDOWN_ITEM}
                            disabled={
                              localPdfDownloadBusy?.saleId === detail.sale.id &&
                              localPdfDownloadBusy?.format === 'ticket'
                            }
                            onClick={(e) => {
                              closeDetailsFromClick(e)
                              void downloadLocalPdf(detail.sale.id, 'ticket')
                            }}
                          >
                            <Download size={14} />
                            Descargar ticket
                          </button>
                          <button
                            type="button"
                            className={ROW_DROPDOWN_ITEM}
                            disabled={
                              localPdfDownloadBusy?.saleId === detail.sale.id &&
                              localPdfDownloadBusy?.format === 'a4'
                            }
                            onClick={(e) => {
                              closeDetailsFromClick(e)
                              void downloadLocalPdf(detail.sale.id, 'a4')
                            }}
                          >
                            <Download size={14} />
                            Descargar A4
                          </button>
                          <button
                            type="button"
                            className={ROW_DROPDOWN_ITEM}
                            disabled={localTicketTabBusyId === detail.sale.id}
                            onClick={(e) => {
                              closeDetailsFromClick(e)
                              void openLocalPdfTicketTab(detail.sale.id)
                            }}
                          >
                            <ExternalLink size={14} />
                            Ticket en pestaña
                          </button>
                        </div>
                      </details>
                      {tab === 'facturacion' && (
                        <details className="relative inline-block text-left">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                            SUNAT / PSE
                            <ChevronDown size={14} className="shrink-0 opacity-60" />
                          </summary>
                          <div className={ROW_DROPDOWN_PANEL}>
                            {detail.sale.billing_status === 'pending' && (
                              <button
                                type="button"
                                className={ROW_DROPDOWN_ITEM}
                                disabled={sending === detail.sale.id}
                                onClick={(e) => {
                                  closeDetailsFromClick(e)
                                  void handleSend(detail.sale.id)
                                }}
                              >
                                {sending === detail.sale.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Send size={14} />
                                )}
                                Enviar a SUNAT
                              </button>
                            )}
                            {(detail.sale.billing_status === 'error' || detail.sale.billing_status === 'sent') && (
                              <button
                                type="button"
                                className={ROW_DROPDOWN_ITEM}
                                disabled={resending === detail.sale.id}
                                onClick={(e) => {
                                  closeDetailsFromClick(e)
                                  void handleResend(detail.sale.id)
                                }}
                              >
                                {resending === detail.sale.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={14} />
                                )}
                                Reenviar a SUNAT
                              </button>
                            )}
                            {canShowSunatOfficialPdf(detail.sale.billing_status) && (
                              <>
                                <button
                                  type="button"
                                  className={ROW_DROPDOWN_ITEM}
                                  disabled={viewingPdfSaleId === detail.sale.id}
                                  onClick={(e) => {
                                    closeDetailsFromClick(e)
                                    void openSunatPdfViewer(detail.sale.id)
                                  }}
                                >
                                  <FileSearch size={14} />
                                  Ver PDF oficial
                                </button>
                                <button
                                  type="button"
                                  className={ROW_DROPDOWN_ITEM}
                                  disabled={downloading?.saleId === detail.sale.id && downloading?.kind === 'pdf'}
                                  onClick={(e) => {
                                    closeDetailsFromClick(e)
                                    void handleDownload(detail.sale.id, 'pdf')
                                  }}
                                >
                                  <FileText size={14} />
                                  Descargar PDF oficial
                                </button>
                              </>
                            )}
                            {canShowXmlSent(detail.sale.billing_status) && (
                              <>
                                <button
                                  type="button"
                                  className={ROW_DROPDOWN_ITEM}
                                  disabled={viewingXmlSaleId === detail.sale.id}
                                  onClick={(e) => {
                                    closeDetailsFromClick(e)
                                    void openXmlViewer(detail.sale.id, 'xml')
                                  }}
                                >
                                  <FileCode size={14} />
                                  Ver XML enviado
                                </button>
                                <button
                                  type="button"
                                  className={ROW_DROPDOWN_ITEM}
                                  disabled={downloading?.saleId === detail.sale.id && downloading?.kind === 'xml'}
                                  onClick={(e) => {
                                    closeDetailsFromClick(e)
                                    void handleDownload(detail.sale.id, 'xml')
                                  }}
                                >
                                  <FileCode size={14} />
                                  Descargar XML enviado
                                </button>
                              </>
                            )}
                            {canShowXmlGenerated(detail.sale.billing_status) && (
                              <>
                                <button
                                  type="button"
                                  className={ROW_DROPDOWN_ITEM}
                                  disabled={viewingXmlSaleId === detail.sale.id}
                                  onClick={(e) => {
                                    closeDetailsFromClick(e)
                                    void openXmlViewer(detail.sale.id, 'xml-generated')
                                  }}
                                >
                                  <FileCode size={14} />
                                  Ver XML generado
                                </button>
                                <button
                                  type="button"
                                  className={ROW_DROPDOWN_ITEM}
                                  disabled={
                                    downloading?.saleId === detail.sale.id && downloading?.kind === 'xml-generated'
                                  }
                                  onClick={(e) => {
                                    closeDetailsFromClick(e)
                                    void handleDownload(detail.sale.id, 'xml-generated')
                                  }}
                                >
                                  <FileCode size={14} />
                                  Descargar XML generado
                                </button>
                              </>
                            )}
                            {canShowCdr(detail.sale.billing_status) && (
                              <button
                                type="button"
                                className={ROW_DROPDOWN_ITEM}
                                disabled={downloading?.saleId === detail.sale.id && downloading?.kind === 'cdr'}
                                onClick={(e) => {
                                  closeDetailsFromClick(e)
                                  void handleDownload(detail.sale.id, 'cdr')
                                }}
                              >
                                <Archive size={14} />
                                Descargar CDR
                              </button>
                            )}
                          </div>
                        </details>
                      )}
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
        </div>
      )}

      {pdfViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePdfViewer()
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
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
              <div
                className={`bg-stone-100 ${
                  pdfViewerSource === 'local' && localPdfViewerFormat === 'ticket'
                    ? 'flex justify-center overflow-x-auto'
                    : ''
                }`}
              >
                <iframe
                  src={pdfViewerUrl}
                  title="Comprobante PDF"
                  className={
                    pdfViewerSource === 'local' && localPdfViewerFormat === 'ticket'
                      ? 'w-[80mm] max-w-full h-[75vh] min-h-[320px] border-0 shadow-sm bg-white'
                      : 'w-full h-[75vh] min-h-[320px] border-0'
                  }
                />
              </div>
            ) : (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {xmlViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeXmlViewer()
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
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
        </div>
      )}
    </div>
  )
}
