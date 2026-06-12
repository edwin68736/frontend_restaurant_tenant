import { useState } from 'react'
import { FileSpreadsheet, FileText, Package } from 'lucide-react'
import { toast } from 'sonner'
import {
  cashbankService,
  type CashSessionReport,
  type SessionProductSoldRow,
} from '@/services/cashbank.service'
import { downloadCajaSessionReportPdf } from '@/utils/cajaSessionReportPdf'
import { exportTableToExcel } from '@/utils/exportExcel'
import { PortalModal } from '@/components/ui/PortalModal'
import { CajaSessionReportView } from '@/components/cash/CajaSessionReportView'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'

type Props = {
  sessionId: number
  sessionLabel: string
  onClose: () => void
}

export function CajaSessionReportsModal({ sessionId, sessionLabel, onClose }: Props) {
  const [tab, setTab] = useState<'movements' | 'products'>('movements')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CashSessionReport | null>(null)
  const [products, setProducts] = useState<SessionProductSoldRow[]>([])

  const loadMovements = async () => {
    setLoading(true)
    try {
      const r = await cashbankService.getSessionReport(sessionId)
      setReport(r)
      setTab('movements')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al cargar reporte')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    try {
      const rows = await cashbankService.getSessionProductsReport(sessionId)
      setProducts(rows ?? [])
      setTab('products')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const exportProductsExcel = async () => {
    try {
      const rows = products.length > 0 ? products : await cashbankService.getSessionProductsReport(sessionId)
      await exportTableToExcel(
        `Productos vendidos — ${sessionLabel}`,
        [
          { key: 'code', label: 'Código' },
          { key: 'description', label: 'Producto' },
          { key: 'quantity', label: 'Cantidad' },
          { key: 'total', label: 'Total' },
        ],
        rows.map((r) => ({
          ...r,
          quantity: Number(r.quantity).toFixed(2),
          total: Number(r.total).toFixed(2),
        })),
        `productos-sesion-${sessionId}.xlsx`,
      )
      toast.success('Excel exportado')
    } catch {
      toast.error('No se pudo exportar')
    }
  }

  const exportMovementsExcel = async () => {
    try {
      const r = report ?? (await cashbankService.getSessionReport(sessionId))
      const pmLabel = (code: string) => paymentMethodDisplayLabel(code)
      const rows = [
        ...(r.cash_physical?.cash_sales ?? []).map((x) => ({ ...x, canal: 'Efectivo', kind: 'Venta' })),
        ...(r.cash_physical?.manual_income ?? []).map((x) => ({ ...x, canal: 'Efectivo', kind: 'Manual' })),
        ...(r.electronic?.sales ?? []).map((x) => ({ ...x, canal: 'Electrónico', kind: 'Venta' })),
        ...(r.cash_physical?.expenses ?? []).map((x) => ({
          date: x.date,
          canal: 'Efectivo',
          kind: x.type,
          doc_number: x.doc_number,
          payment_method: x.payment_method,
          amount: -x.amount,
        })),
      ]
      await exportTableToExcel(
        `Reporte sesión — ${sessionLabel}`,
        [
          { key: 'date', label: 'Fecha' },
          { key: 'canal', label: 'Canal' },
          { key: 'kind', label: 'Tipo' },
          { key: 'doc_number', label: 'Documento' },
          { key: 'payment_method', label: 'Método' },
          { key: 'amount', label: 'Monto' },
        ],
        rows.map((x) => ({
          date: x.date ? new Date(x.date).toLocaleString() : '',
          canal: (x as { canal: string }).canal,
          kind: (x as { kind: string }).kind,
          doc_number: x.doc_number || (x as { reference?: string }).reference,
          payment_method: pmLabel(x.payment_method),
          amount: Number(x.amount).toFixed(2),
        })),
        `reporte-sesion-${sessionId}.xlsx`,
      )
      toast.success('Excel exportado')
    } catch {
      toast.error('No se pudo exportar')
    }
  }

  return (
    <PortalModal open onClose={onClose} className="max-w-4xl">
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[min(92dvh,900px)]">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
          <h3 className="font-bold text-stone-900">Reportes — {sessionLabel}</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm">
            Cerrar
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadMovements()}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-stone-200 hover:bg-stone-50 flex items-center gap-2"
            >
              <FileText size={15} />
              Resumen de sesión
            </button>
            <button
              type="button"
              onClick={() => void loadProducts()}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-stone-200 hover:bg-stone-50 flex items-center gap-2"
            >
              <Package size={15} />
              Productos vendidos
            </button>
          </div>

          {loading && (
            <div className="py-8 flex justify-center">
              <div className="w-7 h-7 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && tab === 'movements' && report && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadCajaSessionReportPdf(report)}
                  className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => void exportMovementsExcel()}
                  className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center gap-1"
                >
                  <FileSpreadsheet size={13} />
                  Excel
                </button>
              </div>
              <CajaSessionReportView report={report} compact />
            </div>
          )}

          {!loading && tab === 'products' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void exportProductsExcel()}
                  className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center gap-1"
                >
                  <FileSpreadsheet size={13} />
                  Excel
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      {['Código', 'Producto', 'Cant.', 'Total'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-stone-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-stone-400">
                          Sin productos vendidos en esta sesión
                        </td>
                      </tr>
                    ) : (
                      products.map((p, i) => (
                        <tr key={`${p.code}-${i}`} className="border-t border-stone-100">
                          <td className="px-3 py-2 font-mono text-xs">{p.code || '—'}</td>
                          <td className="px-3 py-2">{p.description}</td>
                          <td className="px-3 py-2 tabular-nums">{Number(p.quantity).toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold tabular-nums">S/ {Number(p.total).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && !report && products.length === 0 && (
            <p className="text-sm text-stone-500 text-center py-6">
              Seleccione un tipo de reporte para visualizar los datos de esta sesión.
            </p>
          )}
        </div>
      </div>
    </PortalModal>
  )
}
