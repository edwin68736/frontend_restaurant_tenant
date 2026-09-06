import type { CashSessionReport, PaymentMethodRecord } from '@/services/cashbank.service'
import { paymentMethodDisplayLabel } from '@/utils/paymentMethodLabels'
import { formatSoles } from '@/utils/cashMovementChannels'
import { parseSessionNotesBlock } from '@/utils/cajaSessionReportPdf'

type Props = {
  report: CashSessionReport
  paymentMethods?: PaymentMethodRecord[]
  compact?: boolean
}

// incomeTypeLabel — 'venta' (contado, misma Caja que el registro) y 'cobro_cxc' (cobro posterior
// de una venta a crédito registrada en OTRA Caja) son ambos "dinero recibido" pero conceptualmente
// distintos — mismo criterio que ya usa Tukifac. Un tipo desconocido muestra el texto crudo.
function incomeTypeLabel(type: string): string {
  switch (type) {
    case 'venta':
      return 'Venta'
    case 'cobro_cxc':
      return 'Cobro CxC'
    case 'ingreso_manual':
      return 'Ingreso manual'
    default:
      return type || 'Ingreso'
  }
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
  // "Caja origen" solo aporta algo cuando hay al menos un cobro_cxc — evita una columna vacía en
  // las tablas que nunca la necesitan (ventas al contado, ingresos manuales).
  const showOrigin = rows.some((r) => r.type === 'cobro_cxc')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-stone-50">
          <tr>
            {['Fecha', 'Tipo', 'Doc', 'Método', ...(showOrigin ? ['Caja origen'] : []), 'Monto'].map((h) => (
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
              <td className="px-3 py-2 text-stone-600">{incomeTypeLabel(r.type)}</td>
              <td className="px-3 py-2 text-stone-700">{r.doc_number || r.reference || '—'}</td>
              <td className="px-3 py-2 text-stone-600">{paymentLabel(r.payment_method)}</td>
              {showOrigin && (
                <td className="px-3 py-2 text-xs text-stone-500">
                  {r.type === 'cobro_cxc' && r.sale_cash_session_id ? `#${r.sale_cash_session_id}` : '—'}
                </td>
              )}
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

const AMOUNT_TABLE_TONE = {
  amber: { head: 'bg-amber-100/50', text: 'text-amber-900', border: 'border-amber-100' },
  blue: { head: 'bg-blue-100/50', text: 'text-blue-900', border: 'border-blue-100' },
  orange: { head: 'bg-orange-100/50', text: 'text-orange-900', border: 'border-orange-100' },
} as const

/** Tabla simple Fecha/Comprobante/Monto — usada por los paneles de SPOT/crédito CxC/CxP
 *  generados (no llevan método de pago propio, a diferencia de DetailIncomeTable). */
function DetailAmountTable({
  rows,
  tone,
}: {
  rows: { date: string; doc_number: string; amount: number }[]
  tone: keyof typeof AMOUNT_TABLE_TONE
}) {
  const c = AMOUNT_TABLE_TONE[tone]
  if (!rows?.length) return null
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={`${c.head} sticky top-0`}>
          <tr>
            {['Fecha', 'Comprobante', 'Monto'].map((h) => (
              <th key={h} className={`text-left px-3 py-2 text-xs font-semibold ${c.text}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b ${c.border}`}>
              <td className="px-3 py-2 text-xs">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
              <td className="px-3 py-2">{r.doc_number || '—'}</td>
              <td className={`px-3 py-2 font-semibold ${c.text}`}>{formatSoles(r.amount)}</td>
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

      {/* Detracción BN (SPOT), crédito y CxP generados — el backend ya los calcula (mismo
          GetSessionReport que usa Tukifac); antes esta vista no los mostraba en absoluto. Cada
          uno se oculta si no aplica a esta sesión (total 0). */}
      {(report.detraction?.total_spot ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-sm font-semibold text-amber-900 mb-1">Detracción BN (SPOT)</p>
          <p className="text-xs text-amber-800 mb-3">
            Montos de detracción registrados en ventas 1001. No entran al arqueo de caja ni a ingresos bancarios.
          </p>
          <p className="text-lg font-bold text-amber-900 mb-2">{formatSoles(report.detraction?.total_spot ?? 0)}</p>
          <DetailAmountTable rows={report.detraction?.sales ?? []} tone="amber" />
        </div>
      )}

      {(report.credit_generated?.total ?? 0) > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
          <p className="text-sm font-semibold text-blue-900 mb-1">Crédito generado (CxC)</p>
          <p className="text-xs text-blue-800 mb-3">
            Ventas a crédito registradas en esta sesión, todavía sin cobrar. No es dinero recibido: no entra a
            "Total ventas sesión" ni al arqueo. El saldo pendiente se cobra desde Cuentas por cobrar.
          </p>
          <p className="text-lg font-bold text-blue-900 mb-2">{formatSoles(report.credit_generated?.total ?? 0)}</p>
          <DetailAmountTable rows={report.credit_generated?.sales ?? []} tone="blue" />
        </div>
      )}

      {(report.payable_generated?.total ?? 0) > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
          <p className="text-sm font-semibold text-orange-900 mb-1">Cuenta por pagar generada (CxP)</p>
          <p className="text-xs text-orange-800 mb-3">
            Compras a crédito registradas en esta sesión, todavía sin pagar al proveedor. No es dinero pagado: no
            entra a "Egresos de caja" ni al arqueo. El saldo pendiente se paga desde Cuentas por pagar.
          </p>
          <p className="text-lg font-bold text-orange-900 mb-2">{formatSoles(report.payable_generated?.total ?? 0)}</p>
          <DetailAmountTable rows={report.payable_generated?.purchases ?? []} tone="orange" />
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
