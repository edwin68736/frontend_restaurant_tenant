import { useState } from 'react'
import { FileText, Printer, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { downloadReceiptPdf, openReceiptPdfInNewTab } from '@/utils/receiptPdf'
import { formatMoney } from '@/utils/format'
import type { PrintData } from '@/types/printData'
import { PortalModal } from '@/components/ui/PortalModal'
import { SearchableSelect } from '@/components/SearchableSelect'
import { getConfiguredPrinter, isWindowsDesktop, printDocumentAuto } from '@/services/printers.service'

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
  const [loading, setLoading] = useState(false)
  const [format, setFormat] = useState<'a4' | 'ticket'>('a4')
  const isDirectMode = isWindowsDesktop()
  const hasDirectPrinter = isDirectMode && Boolean(getConfiguredPrinter('documentos'))

  const handleView = async () => {
    if (!printData) return
    setLoading(true)
    try {
      await openReceiptPdfInNewTab(printData, format)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!printData) return
    setLoading(true)
    try {
      await downloadReceiptPdf(printData, format)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    if (!printData) return
    setLoading(true)
    try {
      await openReceiptPdfInNewTab(printData, format)
    } finally {
      setLoading(false)
    }
  }

  const handleDirectPrint = async () => {
    if (!printData) return
    if (!hasDirectPrinter) {
      toast.error('Configura la impresora de documentos en Ajustes')
      return
    }
    setLoading(true)
    try {
      const msg = await printDocumentAuto(printData)
      toast.success(msg || 'Enviado a la impresora')
    } catch (e) {
      console.error('[direct print error]', e)
      toast.error('No se pudo imprimir. Revisa la consola de Tauri (cargo).')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <PortalModal open={open} onClose={onClose} className="max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-stone-800">Comprobante registrado</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100">
            <X size={20} />
          </button>
        </div>
        {printData && (
          <>
            <p className="text-sm text-stone-600 mb-3">
              {saleNumber || printData.number} — Total: {formatMoney(total ?? printData.total)}
            </p>
            {!isDirectMode && (
              <div className="flex gap-2 items-center mb-4">
                <label className="text-sm text-stone-600">Formato:</label>
                <div className="w-56">
                  <SearchableSelect
                    value={format}
                    onChange={(v) => setFormat(String(v) as 'a4' | 'ticket')}
                    options={[
                      { value: 'a4', label: 'A4' },
                      { value: 'ticket', label: 'Ticket (80mm)' },
                    ]}
                    searchable={false}
                    className="border border-stone-200 rounded-lg px-2 py-1 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {isDirectMode ? (
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
                >
                  <Printer size={16} />
                  Imprimir
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleView}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    Ver PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 disabled:opacity-50"
                  >
                    <Download size={16} />
                    Descargar
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 disabled:opacity-50"
                  >
                    <Printer size={16} />
                    Imprimir
                  </button>
                  {hasDirectPrinter && (
                    <button
                      type="button"
                      onClick={handleDirectPrint}
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
                    >
                      <Printer size={16} />
                      Imprimir directo
                    </button>
                  )}
                </>
              )}
            </div>
            {!isDirectMode && (
              <p className="text-xs text-stone-500 mt-3">
                Use Ctrl+P en la nueva pestaña para imprimir desde el navegador.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-3 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
            >
              Cerrar
            </button>
          </>
        )}
        {!printData && (
          <p className="text-sm text-stone-500">No hay datos de impresión disponibles.</p>
        )}
      </div>
    </PortalModal>
  )
}
