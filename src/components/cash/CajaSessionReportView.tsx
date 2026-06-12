import type { CashSessionReport, PaymentMethodRecord } from '@/services/cashbank.service'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'
import { formatSoles } from '@/utils/cashMovementChannels'
import { parseSessionNotesBlock } from '@/utils/cajaSessionReportPdf'

type Props = {
  report: CashSessionReport
  paymentMethods?: PaymentMethodRecord[]
  compact?: boolean
}

function DetailIncomeTable({
  rows,
  paymentLabel,
  emptyText,
}: {
  rows: CashSessionReport['income_detail']
  paymentLabel: (c: string) => string
  emptyText: string
}) {
  if (!rows?.length) {
    return <p className="text-sm text-stone-400 py-4 text-center">{emptyText}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-stone-50">
          <tr>
            {['Fecha', 'Doc', 'Método', 'Monto'].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-stone-500 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`in-${i}`} className="border-b border-stone-100">
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {r.date ? new Date(r.date).toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2 text-stone-700">{r.doc_number || r.reference || '—'}</td>
              <td className="px-3 py-2 text-stone-600">{paymentLabel(r.payment_method)}</td>
              <td className="px-3 py-2 font-semibold text-green-700 tabular-nums">
                {formatSoles(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailExpenseTable({
  rows,
  paymentLabel,
  emptyText,
}: {
  rows: CashSessionReport['expense_detail']
  paymentLabel: (c: string) => string
  emptyText: string
}) {
  if (!rows?.length) {
    return <p className="text-sm text-stone-400 py-4 text-center">{emptyText}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-stone-50">
          <tr>
            {['Fecha', 'Tipo', 'Doc', 'Método', 'Monto'].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-stone-500 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`ex-${i}`} className="border-b border-stone-100">
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {r.date ? new Date(r.date).toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2 text-stone-700">{r.type}</td>
              <td className="px-3 py-2 text-stone-600">{r.doc_number || r.reference || '—'}</td>
              <td className="px-3 py-2 text-stone-600">{paymentLabel(r.payment_method)}</td>
              <td className="px-3 py-2 font-semibold text-red-700 tabular-nums">
                {formatSoles(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CajaSessionReportView({ report, paymentMethods = [], compact = false }: Props) {
  const pmLabel = (code: string) => paymentMethodDisplayLabel(code, paymentMethods)
  const cash = report.cash_physical
  const electronic = report.electronic
  const notes = parseSessionNotesBlock(report.session.notes)

  return (
    <div className="space-y-6">
      {/* KPIs consolidados */}
      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-5'} gap-3`}>
        <div className="rounded-xl border border-stone-200 p-3 bg-stone-50/50">
          <p className="text-xs text-stone-500">Saldo físico en caja</p>
          <p className="text-xl font-bold text-stone-900">
            {formatSoles(cash?.physical_balance ?? report.totals.final_balance)}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Inicial {formatSoles(cash?.opening_balance ?? report.session.opening_balance)}</p>
        </div>
        <div className="rounded-xl border border-green-200 p-3 bg-green-50/40">
          <p className="text-xs text-stone-600">Ingresos efectivo (caja)</p>
          <p className="text-xl font-bold text-green-700">
            {formatSoles(cash?.total_income ?? report.totals.total_income)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 p-3 bg-red-50/30">
          <p className="text-xs text-stone-600">Egresos de caja</p>
          <p className="text-xl font-bold text-red-700">
            {formatSoles(cash?.total_expense ?? report.totals.total_expense)}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 p-3 bg-blue-50/40">
          <p className="text-xs text-stone-600">Ventas medios electrónicos</p>
          <p className="text-xl font-bold text-blue-800">
            {formatSoles(electronic?.total_sales ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 p-3">
          <p className="text-xs text-stone-500">Total ventas sesión</p>
          <p className="text-xl font-bold text-stone-900">{formatSoles(report.totals.total_sales)}</p>
        </div>
      </div>

      {!compact && (notes.opening || notes.closing) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Notas de la sesión</p>
          {notes.opening ? (
            <div>
              <p className="text-xs text-stone-500">Apertura</p>
              <p className="text-sm text-stone-800 whitespace-pre-wrap">{notes.opening}</p>
            </div>
          ) : null}
          {notes.closing ? (
            <div>
              <p className="text-xs text-stone-500">Cierre</p>
              <p className="text-sm text-stone-800 whitespace-pre-wrap">{notes.closing}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Resumen por método */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-stone-200 p-4">
          <p className="text-sm font-semibold text-stone-800 mb-2">Caja física — ventas en efectivo</p>
          <p className="text-lg font-bold text-stone-900 mb-2">{formatSoles(cash?.sales_total ?? 0)}</p>
          {(report.totals_by_method.sales ?? []).filter((x) => pmLabel(x.method) === 'Efectivo' || x.method === 'efectivo' || x.method === 'cash').length === 0 &&
          (cash?.sales_total ?? 0) === 0 ? (
            <p className="text-sm text-stone-400">Sin ventas en efectivo</p>
          ) : (
            <ul className="space-y-1">
              {(report.totals_by_method.sales ?? [])
                .filter((x) => ['efectivo', 'cash'].includes(String(x.method).toLowerCase()))
                .map((x) => (
                  <li key={x.method} className="flex justify-between text-sm">
                    <span>{pmLabel(x.method)}</span>
                    <span className="font-semibold">{formatSoles(x.total)}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-blue-200 p-4 bg-blue-50/20">
          <p className="text-sm font-semibold text-blue-900 mb-2">Medios electrónicos</p>
          <p className="text-lg font-bold text-blue-800 mb-2">{formatSoles(electronic?.total_sales ?? 0)}</p>
          {(electronic?.sales_by_method ?? []).length === 0 ? (
            <p className="text-sm text-stone-400">Sin ventas electrónicas</p>
          ) : (
            <ul className="space-y-1">
              {electronic!.sales_by_method.map((x) => (
                <li key={x.method} className="flex justify-between text-sm">
                  <span>{pmLabel(x.method)}</span>
                  <span className="font-semibold">{formatSoles(x.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Tablas detalladas */}
      <div className="space-y-4">
        <div className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <p className="text-sm font-semibold text-stone-800">Ventas en efectivo (caja física)</p>
          </div>
          <div className="p-2">
            <DetailIncomeTable
              rows={cash?.cash_sales ?? []}
              paymentLabel={pmLabel}
              emptyText="Sin ventas en efectivo en esta sesión"
            />
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/50">
            <p className="text-sm font-semibold text-blue-900">Ventas por medios electrónicos</p>
          </div>
          <div className="p-2">
            <DetailIncomeTable
              rows={electronic?.sales ?? []}
              paymentLabel={pmLabel}
              emptyText="Sin ventas por Yape, Plin, tarjeta u otros medios"
            />
          </div>
        </div>

        {(cash?.manual_income?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              <p className="text-sm font-semibold text-stone-800">Ingresos manuales (caja)</p>
            </div>
            <div className="p-2">
              <DetailIncomeTable rows={cash!.manual_income} paymentLabel={pmLabel} emptyText="" />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <p className="text-sm font-semibold text-stone-800">Gastos y egresos (caja física)</p>
          </div>
          <div className="p-2">
            <DetailExpenseTable
              rows={cash?.expenses ?? report.expense_detail}
              paymentLabel={pmLabel}
              emptyText="Sin egresos en esta sesión"
            />
          </div>
        </div>

        {(report.totals_by_method.purchases ?? []).length > 0 && (
          <div className="rounded-xl border border-stone-200 p-4">
            <p className="text-sm font-semibold text-stone-800 mb-2">Compras por método</p>
            <ul className="space-y-1">
              {report.totals_by_method.purchases.map((x) => (
                <li key={x.method} className="flex justify-between text-sm">
                  <span>{pmLabel(x.method)}</span>
                  <span className="font-semibold">{formatSoles(x.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(report.cancelled_sales_detail?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-red-200 overflow-hidden bg-red-50/20">
            <div className="px-4 py-3 border-b border-red-100">
              <p className="text-sm font-semibold text-red-900">Ventas anuladas</p>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-stone-500">
                    {['Fecha', 'Doc', 'Método', 'Monto', 'Motivo'].map((h) => (
                      <th key={h} className="text-left px-3 py-1.5 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.cancelled_sales_detail!.map((r, i) => (
                    <tr key={i} className="border-t border-red-100">
                      <td className="px-3 py-2 text-xs">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2">{r.doc_number}</td>
                      <td className="px-3 py-2">{pmLabel(r.payment_method)}</td>
                      <td className="px-3 py-2 font-semibold text-red-700">{formatSoles(r.amount)}</td>
                      <td className="px-3 py-2 text-xs text-stone-600">{r.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
