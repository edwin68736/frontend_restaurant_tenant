import { useMemo } from 'react'
import { CheckCircle2, Clock, History } from 'lucide-react'
import type { BillingHub } from '@/services/subscription.service'
import { formatDate, formatMoney } from './subscriptionUx'

type Props = { hub: BillingHub }

type TimelineItem = {
  id: string
  date: string
  label: string
  detail?: string
  kind: 'payment' | 'event'
}

export default function HistoryTab({ hub }: Props) {
  const items = useMemo(() => {
    const rows: TimelineItem[] = []
    for (const p of hub.payments) {
      rows.push({
        id: `pay-${p.id}`,
        date: p.payment_date || p.created_at,
        label:
          p.status === 'approved'
            ? 'Pago recibido'
            : p.status === 'rejected'
              ? 'Pago rechazado'
              : 'Comprobante enviado',
        detail: `${formatMoney(p.amount)} · ${p.payment_method}${p.reference ? ` · ${p.reference}` : ''}`,
        kind: 'payment',
      })
    }
    for (const ev of hub.events) {
      rows.push({
        id: `ev-${ev.id}`,
        date: ev.created_at,
        label: ev.label,
        detail: ev.reason || undefined,
        kind: 'event',
      })
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [hub.payments, hub.events])

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white p-8 text-center">
        <History className="mx-auto text-stone-300 mb-2" size={32} />
        <p className="text-sm text-stone-500">Sin historial registrado.</p>
      </div>
    )
  }

  const monthKey = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es-PE', {
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Lima',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  let lastMonth = ''

  return (
    <div className="rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-50">
        <h3 className="text-sm font-semibold text-stone-800">Línea de tiempo</h3>
        <p className="text-xs text-stone-500 mt-0.5">Pagos, renovaciones y cambios de plan</p>
      </div>
      <ul className="p-4 space-y-0">
        {items.map(item => {
          const mk = monthKey(item.date)
          const showMonth = mk !== lastMonth
          if (showMonth) lastMonth = mk
          return (
            <li key={item.id}>
              {showMonth ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-4 mb-2 first:mt-0">
                  {mk}
                </p>
              ) : null}
              <div className="flex gap-3 pb-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  {item.kind === 'payment' && item.label.includes('recibido') ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <Clock size={16} className="text-stone-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 border-l border-stone-100 pl-3 -ml-3">
                  <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                  <p className="text-xs text-stone-500">{formatDate(item.date)}</p>
                  {item.detail ? <p className="text-xs text-stone-600 mt-0.5">{item.detail}</p> : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
