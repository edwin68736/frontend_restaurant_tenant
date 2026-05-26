import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, FileText, Loader2, MessageCircle, Printer, Receipt, X } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import type { PrintData } from '@/types/printData'
import { PortalModal } from '@/components/ui/PortalModal'
import { formatMoney } from '@/utils/format'
import { salePaymentMethodLabelEs } from '@/utils/paymentMethodLabels'
import { pdfEmbedSrc } from '@/utils/pdfEmbedSrc'
import { printDataToPdfBlob, type ReceiptPdfOptions } from '@/utils/receiptPdf'
import { shareReceiptPdf } from '@/utils/receiptShare'
import {
  getConfiguredPrinter,
  isNativePrintAvailable,
  printDocumentAuto,
} from '@/services/printers.service'

type PanelView = 'details' | 'receipt'
type PdfFormat = 'ticket' | 'a4'

interface ReceiptPrintModalProps {
  open: boolean
  onClose: () => void
  printData: PrintData | null
  saleNumber?: string
  total?: number
}

export function ReceiptPrintModal({
  open,
  onClose,
  printData,
  saleNumber,
  total,
}: ReceiptPrintModalProps) {
  const [panelView, setPanelView] = useState<PanelView>('details')
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>('ticket')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)
  const loadedFormatRef = useRef<PdfFormat | null>(null)

  const printerCfg = getConfiguredPrinter('documentos')
  const hasDirectPrinter = isNativePrintAvailable() && Boolean(printerCfg)

  const ticketPdfOptions = useCallback((): ReceiptPdfOptions => {
    const mm = printerCfg?.paperWidthMm === 58 ? 58 : 80
    return { paperWidthMm: mm }
  }, [printerCfg?.paperWidthMm])

  const displayNumber = saleNumber || printData?.number || '—'
  const displayTotal = total ?? printData?.total ?? 0

  const paidTotal = useMemo(() => {
    if (!printData?.payments?.length) return displayTotal
    return printData.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }, [printData, displayTotal])

  const change = Math.max(0, paidTotal - displayTotal)

  const revokePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = null
    }
    setPdfUrl(null)
    loadedFormatRef.current = null
  }, [])

  const loadPdf = useCallback(
    async (format: PdfFormat) => {
      if (!printData) return
      if (loadedFormatRef.current === format && pdfUrlRef.current) {
        setPdfFormat(format)
        return
      }
      setPdfLoading(true)
      revokePdfUrl()
      try {
        const pdfOpts = format === 'ticket' ? ticketPdfOptions() : undefined
        const blob = await printDataToPdfBlob(printData, format, pdfOpts)
        const url = URL.createObjectURL(blob)
        pdfUrlRef.current = url
        loadedFormatRef.current = format
        setPdfUrl(url)
        setPdfFormat(format)
      } catch (e) {
        console.error(e)
        toast.error('No se pudo generar el PDF')
        setPanelView('details')
      } finally {
        setPdfLoading(false)
      }
    },
    [printData, revokePdfUrl, ticketPdfOptions],
  )

  const showReceipt = useCallback(async () => {
    if (!printData) return
    setPanelView('receipt')
    await loadPdf('ticket')
  }, [printData, loadPdf])

  const showDetails = useCallback(() => {
    setPanelView('details')
  }, [])

  const switchPdfFormat = useCallback(
    (format: PdfFormat) => {
      if (format === pdfFormat && pdfUrl) return
      void loadPdf(format)
    },
    [loadPdf, pdfFormat, pdfUrl],
  )

  useEffect(() => {
    if (!open) {
      revokePdfUrl()
      setPanelView('details')
      setPdfFormat('ticket')
      setBusy(null)
      return
    }
    setPanelView('details')
    setPdfFormat('ticket')
    revokePdfUrl()
  }, [open, revokePdfUrl])

  const handleClose = () => {
    revokePdfUrl()
    onClose()
  }

  const handleDirectPrint = async () => {
    if (!printData) return
    if (!hasDirectPrinter) {
      toast.error('Configura la impresora de documentos en Ajustes')
      return
    }
    setBusy('print')
    try {
      const msg = await printDocumentAuto(printData)
      toast.success(msg || 'Comprobante enviado a la impresora')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo imprimir')
    } finally {
      setBusy(null)
    }
  }

  const handleShareWhatsApp = async () => {
    if (!printData) return
    setBusy('share')
    try {
      await shareReceiptPdf(printData, 'ticket')
    } catch (e) {
      console.error(e)
      toast.error((e as Error)?.message ?? 'No se pudo compartir el PDF')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  const client = printData?.client
  const showReceiptPanel = panelView === 'receipt'

  return (
    <PortalModal
      open={open}
      onClose={handleClose}
      className="max-w-5xl"
      overlayClassName="items-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 md:p-6"
    >
      <div className="relative flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 rounded-full border border-stone-200 bg-white p-2 shadow-md hover:bg-stone-50 sm:right-4 sm:top-4"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4 text-stone-600 sm:h-5 sm:w-5" />
        </button>

        <div className="scrollbar-checkout min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mb-4 flex items-center gap-2 pr-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 md:h-10 md:w-10">
              <Receipt className="h-5 w-5 text-green-600 md:h-6 md:w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-800 md:text-lg">Recibo de venta</h2>
              <p className="text-xs text-stone-500 md:text-sm">Comprobante generado correctamente</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
            {/* Panel izquierdo: resumen y acciones */}
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-xl border border-green-200/80 bg-green-50/60 p-3 md:p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                  <span className="text-green-600">●</span> Resumen de pago
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-stone-200/80 py-2">
                    <span className="font-semibold text-stone-800">Total</span>
                    <span className="text-lg font-bold text-green-700">
                      {formatMoney(displayTotal, printData?.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-stone-600">
                    <span>Pagado</span>
                    <span className="font-semibold text-stone-800">
                      {formatMoney(paidTotal, printData?.currency)}
                    </span>
                  </div>
                  {change > 0.009 && (
                    <div className="flex justify-between rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                      <span className="font-semibold text-amber-900">Vuelto</span>
                      <span className="font-bold text-amber-700">
                        {formatMoney(change, printData?.currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-stone-700">Acciones</h3>

                {hasDirectPrinter && (
                  <button
                    type="button"
                    disabled={!!busy || !printData}
                    onClick={() => void handleDirectPrint()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-100 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-200 disabled:opacity-50"
                  >
                    {busy === 'print' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    Volver a imprimir
                  </button>
                )}

                {showReceiptPanel ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={showDetails}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Ver detalles
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy || !printData || pdfLoading}
                    onClick={() => void showReceipt()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-950 disabled:opacity-50"
                  >
                    {pdfLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Ver Comprobante
                  </button>
                )}

                <button
                  type="button"
                  disabled={!!busy || !printData}
                  onClick={() => void handleShareWhatsApp()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-medium text-white shadow hover:bg-[#1ebe5a] disabled:opacity-50"
                >
                  {busy === 'share' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                  Enviar por Whatsapp
                </button>
              </div>
            </div>

            {/* Panel derecho: detalle o PDF */}
            <div className="lg:col-span-3">
              {showReceiptPanel ? (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  <div className="flex flex-wrap items-center justify-center gap-2 border-b border-stone-200 bg-white px-3 py-3">
                    <button
                      type="button"
                      disabled={pdfLoading}
                      onClick={() => switchPdfFormat('ticket')}
                      className={clsx(
                        'min-w-[5.5rem] rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
                        pdfFormat === 'ticket'
                          ? 'border-blue-700 bg-blue-700 text-white shadow-md'
                          : 'border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-200/80',
                      )}
                    >
                      Ticket
                    </button>
                    <button
                      type="button"
                      disabled={pdfLoading}
                      onClick={() => switchPdfFormat('a4')}
                      className={clsx(
                        'min-w-[5.5rem] rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
                        pdfFormat === 'a4'
                          ? 'border-red-700 bg-red-600 text-white shadow-md'
                          : 'border-red-200 bg-red-100 text-red-700 hover:bg-red-200/80',
                      )}
                    >
                      A4
                    </button>
                  </div>
                  {pdfLoading || !pdfUrl ? (
                    <div className="flex min-h-[280px] items-center justify-center md:min-h-[360px]">
                      <Loader2 className="h-8 w-8 animate-spin text-rest-600" />
                    </div>
                  ) : (
                    <div className="bg-stone-100 p-1">
                      <iframe
                        src={pdfEmbedSrc(pdfUrl)}
                        title="Comprobante PDF"
                        className="h-[min(70vh,520px)] min-h-[320px] w-full border-0 bg-white"
                      />
                    </div>
                  )}
                </div>
              ) : printData ? (
                <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 md:p-4">
                  {client && (
                    <div className="mb-4 rounded-lg border border-stone-200 bg-white p-3">
                      <h4 className="mb-2 text-xs font-semibold text-stone-700">Datos del cliente</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-stone-500">Nombre</span>
                          <p className="font-medium text-stone-900">{client.business_name}</p>
                        </div>
                        <div>
                          <span className="text-stone-500">Documento</span>
                          <p className="font-medium text-stone-900">{client.doc_number}</p>
                        </div>
                        {client.address && (
                          <div className="col-span-2">
                            <span className="text-stone-500">Dirección</span>
                            <p className="font-medium text-stone-900">{client.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                    <table className="w-full text-xs md:text-sm">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Producto</th>
                          <th className="w-14 px-2 py-2 text-center font-semibold">Cant.</th>
                          <th className="w-24 px-3 py-2 text-right font-semibold">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {printData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/80">
                            <td className="px-3 py-2 font-medium text-stone-800">{item.description}</td>
                            <td className="px-2 py-2 text-center">
                              <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-green-100 px-1.5 text-xs font-semibold text-green-800">
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-stone-800">
                              {formatMoney(item.total, printData.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-1 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                    <div className="flex justify-between font-bold text-stone-900">
                      <span>Total</span>
                      <span className="text-green-700">
                        {formatMoney(printData.total, printData.currency)}
                      </span>
                    </div>
                    {printData.payments.length > 0 && (
                      <div className="border-t border-dashed border-stone-200 pt-2 text-xs text-stone-600">
                        {printData.payments.map((p, i) => (
                          <div key={i} className="flex justify-between py-0.5">
                            <span>{salePaymentMethodLabelEs(p.method)}</span>
                            <span>{formatMoney(p.amount, printData.currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-500">No hay datos del comprobante.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/80 px-4 py-3 md:px-6">
          <p className="hidden text-xs text-green-700 sm:block">
            <span className="font-medium">✓</span> Venta registrada · {displayNumber}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="ml-auto rounded-xl bg-rest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rest-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
