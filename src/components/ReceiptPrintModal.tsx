import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Loader2, Mail, MessageCircle, Printer, Receipt, RefreshCw, X } from 'lucide-react'
import { ReceiptEmailModal } from '@/components/ReceiptEmailModal'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import type { PrintData } from '@/types/printData'
import { PortalModal } from '@/components/ui/PortalModal'
import { MAX_H_CHECKOUT_PANEL, MODAL_FOOTER_SAFE } from '@/utils/safeAreaClasses'
import { formatMoney } from '@/utils/format'
import { receiptChangeAmount } from '@/utils/receiptChange'
import { PdfBlobViewer } from '@/components/PdfBlobViewer'
import { downloadReceiptPdf, printDataToPdfBlob, type ReceiptPdfOptions } from '@/utils/receiptPdf'
import { shareReceiptPdf } from '@/utils/receiptShare'
import {
  getConfiguredPrinter,
  isNativePrintAvailable,
  printDocumentAuto,
} from '@/services/printers.service'

type PdfFormat = 'ticket' | 'a4'

/**
 * Botón de acción: icono + texto, color sólido (grid 2 columnas).
 * Compacto en móvil (Tauri y Android), donde el modal va en una sola columna y el espacio
 * se reparte con el PDF; a partir de sm recupera los 44px táctiles.
 */
const ACTION_ICON_BTN =
  'flex w-full min-w-0 min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-white touch-manipulation select-none active:scale-[0.98] transition-transform hover:opacity-95 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 sm:min-h-[44px] sm:py-2'

const ACTION_ICON = 'h-4 w-4 sm:h-5 sm:w-5 shrink-0'

const ACTION_LABEL =
  'min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs sm:tracking-wider'

interface ReceiptPrintModalProps {
  open: boolean
  onClose: () => void
  printData: PrintData | null
  saleId?: number
  saleNumber?: string
  total?: number
  defaultEmail?: string
}

export function ReceiptPrintModal({
  open,
  onClose,
  printData,
  saleId,
  saleNumber,
  total,
  defaultEmail = '',
}: ReceiptPrintModalProps) {
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>('ticket')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  // Un PDF por formato, generado una sola vez por apertura del modal: al alternar Ticket/A4 no se
  // vuelve a ejecutar jsPDF (lo caro en un teléfono). `pdfJobsRef` guarda las generaciones en curso
  // para no duplicarlas; `epochRef` invalida las que terminan después de cerrar el modal.
  const pdfCacheRef = useRef<Partial<Record<PdfFormat, string>>>({})
  const pdfJobsRef = useRef<Partial<Record<PdfFormat, Promise<string>>>>({})
  const epochRef = useRef(0)
  const wantedFormatRef = useRef<PdfFormat>('ticket')

  const printerCfg = getConfiguredPrinter('documentos')
  const canNativePrint = isNativePrintAvailable()

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

  const change = receiptChangeAmount({
    total: displayTotal,
    payments: printData?.payments ?? [],
    change_amount: printData?.change_amount,
  })

  // Se pinta dentro del resumen (desktop) y suelto (móvil), donde el resumen no se muestra.
  const changeRow =
    change > 0.009 ? (
      <div className="flex justify-between rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
        <span className="font-semibold text-amber-900">Vuelto</span>
        <span className="font-bold text-amber-700">{formatMoney(change, printData?.currency)}</span>
      </div>
    ) : null

  const revokeAllPdfs = useCallback(() => {
    epochRef.current += 1
    for (const url of Object.values(pdfCacheRef.current)) {
      if (url) URL.revokeObjectURL(url)
    }
    pdfCacheRef.current = {}
    pdfJobsRef.current = {}
    setPdfUrl(null)
  }, [])

  /** Genera (o reutiliza) el PDF de un formato. Resuelve con la URL del blob. */
  const ensurePdf = useCallback(
    (format: PdfFormat): Promise<string> => {
      const cached = pdfCacheRef.current[format]
      if (cached) return Promise.resolve(cached)
      const running = pdfJobsRef.current[format]
      if (running) return running
      if (!printData) return Promise.reject(new Error('Sin datos del comprobante'))
      const epoch = epochRef.current
      const job = (async () => {
        const pdfOpts = format === 'ticket' ? ticketPdfOptions() : undefined
        const blob = await printDataToPdfBlob(printData, format, pdfOpts)
        const url = URL.createObjectURL(blob)
        if (epoch !== epochRef.current) {
          // El modal se cerró (o cambió el documento) mientras se generaba: no se guarda.
          URL.revokeObjectURL(url)
          throw new Error('cancelado')
        }
        pdfCacheRef.current[format] = url
        return url
      })()
      pdfJobsRef.current[format] = job
      const clear = () => {
        if (pdfJobsRef.current[format] === job) delete pdfJobsRef.current[format]
      }
      job.then(clear, clear)
      return job
    },
    [printData, ticketPdfOptions],
  )

  const loadPdf = useCallback(
    async (format: PdfFormat) => {
      if (!printData) return
      wantedFormatRef.current = format
      setPdfFormat(format)
      setPdfError(false)
      const cached = pdfCacheRef.current[format]
      if (cached) {
        setPdfUrl(cached)
        return
      }
      setPdfLoading(true)
      try {
        const url = await ensurePdf(format)
        // Si el usuario alternó de formato mientras se generaba, solo se pinta el último pedido.
        if (wantedFormatRef.current === format) setPdfUrl(url)
        // El otro formato se prepara en segundo plano (con un respiro para no competir con el
        // primer pintado): alternar Ticket/A4 queda instantáneo en cuanto a generación.
        const other: PdfFormat = format === 'ticket' ? 'a4' : 'ticket'
        window.setTimeout(() => {
          void ensurePdf(other).catch(() => undefined)
        }, 1200)
      } catch (e) {
        if ((e as Error)?.message === 'cancelado') return
        console.error(e)
        if (wantedFormatRef.current === format) setPdfError(true)
      } finally {
        setPdfLoading(false)
      }
    },
    [printData, ensurePdf],
  )

  const switchPdfFormat = useCallback(
    (format: PdfFormat) => {
      if (format === pdfFormat && pdfUrl && !pdfError) return
      void loadPdf(format)
    },
    [loadPdf, pdfFormat, pdfUrl, pdfError],
  )

  // El comprobante (PDF) se muestra siempre y directamente: ya no hay una vista de "detalles".
  useEffect(() => {
    if (!open) {
      revokeAllPdfs()
      setPdfFormat('ticket')
      setPdfError(false)
      setBusy(null)
      setEmailModalOpen(false)
      return
    }
    revokeAllPdfs()
    setPdfFormat('ticket')
    if (printData) void loadPdf('ticket')
  }, [open, revokeAllPdfs, printData, loadPdf])

  const handleClose = () => {
    revokeAllPdfs()
    onClose()
  }

  const handleDirectPrint = async () => {
    if (!printData) return
    if (!canNativePrint) {
      toast.error('Impresión directa no disponible en este dispositivo')
      return
    }
    if (!printerCfg) {
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

  const handleDownloadPdf = async (format: PdfFormat) => {
    if (!printData) return
    const busyKey = format === 'ticket' ? 'download-ticket' : 'download-a4'
    setBusy(busyKey)
    try {
      const pdfOpts = format === 'ticket' ? ticketPdfOptions() : undefined
      await downloadReceiptPdf(printData, format, pdfOpts)
      toast.success(format === 'ticket' ? 'PDF ticket descargado' : 'PDF A4 descargado')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo descargar el PDF')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <PortalModal
      open={open}
      onClose={handleClose}
      className="max-w-5xl"
      overlayClassName="items-center bg-black/40 backdrop-blur-sm"
    >
      <div className={clsx('relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl', MAX_H_CHECKOUT_PANEL)}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 rounded-full border border-stone-200 bg-white p-2 shadow-md hover:bg-stone-50 sm:right-4 sm:top-4"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4 text-stone-600 sm:h-5 sm:w-5" />
        </button>

        <div className="scrollbar-checkout min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
          {/* En móvil el header cede altura al comprobante: sin subtítulo (el pie ya confirma
              la venta y su número) y en una sola línea. */}
          <div className="mb-2 flex items-center gap-2 pr-10 md:mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-100 md:h-10 md:w-10">
              <Receipt className="h-4 w-4 text-green-600 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-stone-800 md:text-lg">Recibo de venta</h2>
              <p className="hidden text-xs text-stone-500 md:block md:text-sm">
                Comprobante generado correctamente
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
            {/* Panel izquierdo: resumen y acciones */}
            <div className="min-w-0 space-y-4 lg:col-span-2">
              {/* En móvil el resumen se oculta: el PDF ya muestra los totales y el espacio
                  se necesita para las acciones. El vuelto se conserva aparte. */}
              <div className="hidden rounded-xl border border-green-200/80 bg-green-50/60 p-3 md:p-4 lg:block">
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
                  {changeRow}
                </div>
              </div>

              {/* Vuelto en móvil: es plata que hay que devolver, tiene que verse aunque el
                  resto del resumen no esté. */}
              {changeRow ? <div className="lg:hidden">{changeRow}</div> : null}

              <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-2 md:p-3">
                <h3 className="mb-2.5 hidden text-xs font-semibold text-stone-700 lg:block">Acciones</h3>
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  {canNativePrint && (
                    <button
                      type="button"
                      disabled={!!busy || !printData}
                      onClick={() => void handleDirectPrint()}
                      title="Volver a imprimir"
                      aria-label="Volver a imprimir"
                      className={clsx(ACTION_ICON_BTN, 'col-span-2 bg-stone-700')}
                    >
                      {busy === 'print' ? (
                        <Loader2 className={clsx(ACTION_ICON, 'animate-spin')} />
                      ) : (
                        <Printer className={ACTION_ICON} strokeWidth={2.25} />
                      )}
                      <span className={ACTION_LABEL}>Reimprimir</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!!busy || !printData}
                    onClick={() => void handleShareWhatsApp()}
                    title="Enviar por WhatsApp"
                    aria-label="Enviar por WhatsApp"
                    className={clsx(ACTION_ICON_BTN, 'bg-[#25D366]')}
                  >
                    {busy === 'share' ? (
                      <Loader2 className={clsx(ACTION_ICON, 'animate-spin')} />
                    ) : (
                      <MessageCircle className={ACTION_ICON} strokeWidth={2.25} />
                    )}
                    <span className={ACTION_LABEL}>Whatsapp</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!busy || !printData || !saleId}
                    onClick={() => setEmailModalOpen(true)}
                    title="Enviar por correo"
                    aria-label="Enviar por correo"
                    className={clsx(ACTION_ICON_BTN, 'bg-orange-500 hover:bg-orange-600')}
                  >
                    <Mail className={ACTION_ICON} strokeWidth={2.25} />
                    <span className={ACTION_LABEL}>Correo</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!busy || !printData}
                    onClick={() => void handleDownloadPdf('ticket')}
                    title="Descargar PDF ticket"
                    aria-label="Descargar PDF ticket"
                    className={clsx(ACTION_ICON_BTN, 'bg-amber-600 text-white')}
                  >
                    {busy === 'download-ticket' ? (
                      <Loader2 className={clsx(ACTION_ICON, 'animate-spin')} />
                    ) : (
                      <Download className={ACTION_ICON} strokeWidth={2.25} />
                    )}
                    <span className={ACTION_LABEL}>Ticket</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!busy || !printData}
                    onClick={() => void handleDownloadPdf('a4')}
                    title="Descargar PDF A4"
                    aria-label="Descargar PDF A4"
                    className={clsx(ACTION_ICON_BTN, 'bg-[#E4002B]')}
                  >
                    {busy === 'download-a4' ? (
                      <Loader2 className={clsx(ACTION_ICON, 'animate-spin')} />
                    ) : (
                      <Download className={ACTION_ICON} strokeWidth={2.25} />
                    )}
                    <span className={ACTION_LABEL}>PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Panel derecho: el comprobante en PDF */}
            <div className="lg:col-span-3">
              {printData ? (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  {/* Selector Ticket / A4: control segmentado compacto (antes dos botones de 44 px). */}
                  <div className="flex justify-center border-b border-stone-200 bg-stone-50 px-3 py-1.5">
                    <div
                      role="group"
                      aria-label="Formato del comprobante"
                      className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5"
                    >
                      {(
                        [
                          { id: 'ticket', label: 'Ticket', icon: Receipt, active: 'bg-amber-600' },
                          { id: 'a4', label: 'A4', icon: FileText, active: 'bg-[#E4002B]' },
                        ] as const
                      ).map(({ id, label, icon: Icon, active }) => (
                        <button
                          key={id}
                          type="button"
                          disabled={pdfLoading}
                          onClick={() => switchPdfFormat(id)}
                          title={`Vista ${label}`}
                          aria-label={`Vista ${label}`}
                          aria-pressed={pdfFormat === id}
                          className={clsx(
                            'inline-flex h-7 min-w-[4.25rem] items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors touch-manipulation',
                            pdfFormat === id ? `${active} text-white shadow-sm` : 'text-stone-600 hover:bg-stone-100',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {pdfError ? (
                    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center md:min-h-[360px]">
                      <FileText className="h-10 w-10 text-stone-300" aria-hidden />
                      <p className="text-sm text-stone-600">No se pudo generar el comprobante.</p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void loadPdf(pdfFormat)}
                          className="inline-flex items-center gap-2 rounded-xl bg-rest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rest-700"
                        >
                          <RefreshCw size={16} aria-hidden />
                          Reintentar
                        </button>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => void handleDownloadPdf(pdfFormat)}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                        >
                          <Download size={16} aria-hidden />
                          Descargar
                        </button>
                      </div>
                    </div>
                  ) : pdfLoading || !pdfUrl ? (
                    <div className="flex min-h-[280px] items-center justify-center md:min-h-[360px]">
                      <Loader2 className="h-8 w-8 animate-spin text-rest-600" />
                    </div>
                  ) : (
                    <PdfBlobViewer url={pdfUrl} title="Comprobante PDF" />
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-500">No hay datos del comprobante.</p>
              )}
            </div>
          </div>
        </div>

        <div className={clsx('flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/80 px-4 py-3 md:px-6', MODAL_FOOTER_SAFE)}>
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

      {printData && saleId ? (
        <ReceiptEmailModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          saleId={saleId}
          printData={printData}
          defaultEmail={defaultEmail}
          ticketPdfOptions={ticketPdfOptions()}
        />
      ) : null}
    </PortalModal>
  )
}
