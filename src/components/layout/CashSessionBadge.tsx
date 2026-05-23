import { Clock, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCashSession } from '@/contexts/CashSessionContext'

function formatSoles(amount: number): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

function formatOpenedTime(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function CashSessionBadge() {
  const { session, loading, canOperateCash } = useCashSession()

  if (!canOperateCash) return null

  if (loading) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-teal-600 px-2.5 py-1.5 rounded-xl bg-teal-50/80 border border-teal-100">
        <Wallet size={12} className="opacity-60" />
        Caja…
      </span>
    )
  }

  if (!session) {
    return (
      <Link
        to="/caja"
        className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold text-orange-900 px-2.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100/80 transition-colors"
      >
        <Wallet size={12} className="shrink-0 text-orange-600" />
        Sin caja abierta
      </Link>
    )
  }

  const opened = formatOpenedTime(session.opened_at)
  const amount = formatSoles(session.opening_balance)

  return (
    <Link
      to="/caja"
      title={opened ? `Caja abierta desde las ${opened} · Saldo inicial S/ ${amount}` : `Saldo inicial S/ ${amount}`}
      className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50/90 px-2.5 py-1.5 hover:shadow-md hover:border-teal-300 transition-all shrink-0 max-w-[168px]"
    >
      <div className="flex flex-col leading-none min-w-0">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-teal-800">
          <Wallet size={11} className="shrink-0 text-teal-600" />
          Mi caja
        </span>
        <span className="mt-0.5 text-xs font-bold text-teal-950 tabular-nums">S/ {amount}</span>
      </div>
      {opened ? (
        <>
          <span className="w-px h-7 bg-teal-200/80 shrink-0" aria-hidden />
          <div className="flex flex-col items-end leading-none shrink-0">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase text-teal-600">
              <Clock size={10} className="shrink-0" aria-hidden />
              Apertura
            </span>
            <span className="mt-0.5 text-[11px] font-bold text-teal-900 tabular-nums whitespace-nowrap">{opened}</span>
          </div>
        </>
      ) : null}
    </Link>
  )
}
