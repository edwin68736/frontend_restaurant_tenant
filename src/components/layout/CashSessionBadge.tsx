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

type Props = {
  /** Versión compacta para el centro del header en móvil. */
  compact?: boolean
}

export default function CashSessionBadge({ compact = false }: Props) {
  const { session, loading, canOperateCash } = useCashSession()

  if (!canOperateCash) return null

  const visibility = compact ? 'inline-flex' : 'hidden lg:inline-flex'

  if (loading) {
    return (
      <span
        className={`${visibility} items-center gap-1 text-[10px] text-teal-600 px-2 py-1 rounded-lg bg-teal-50/80 border border-teal-100 shrink-0`}
      >
        <Wallet size={compact ? 13 : 12} className="opacity-60 shrink-0" />
        Caja…
      </span>
    )
  }

  if (!session) {
    return (
      <Link
        to="/caja"
        className={`${visibility} items-center gap-1 text-[9px] xl:text-[10px] font-semibold text-orange-900 px-2 py-1 rounded-lg xl:rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100/80 transition-colors whitespace-nowrap shrink-0`}
      >
        <Wallet size={compact ? 13 : 12} className="shrink-0 text-orange-600" />
        {compact ? 'Abrir caja' : 'Sin caja abierta'}
      </Link>
    )
  }

  const opened = formatOpenedTime(session.opened_at)
  const amount = formatSoles(session.opening_balance)

  if (compact) {
    return (
      <Link
        to="/caja"
        title={opened ? `Caja abierta desde las ${opened} · Saldo inicial S/ ${amount}` : `Saldo inicial S/ ${amount}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50/90 px-2 py-1 hover:shadow-md hover:border-teal-300 transition-all shrink-0 max-w-[8.5rem] min-w-0"
      >
        <Wallet size={13} className="shrink-0 text-teal-600" />
        <div className="min-w-0 flex flex-col leading-none">
          <span className="text-[8px] font-bold uppercase tracking-wide text-teal-800">Mi caja</span>
          <span className="text-[11px] font-bold text-teal-950 tabular-nums truncate">S/ {amount}</span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to="/caja"
      title={opened ? `Caja abierta desde las ${opened} · Saldo inicial S/ ${amount}` : `Saldo inicial S/ ${amount}`}
      className="hidden lg:inline-flex items-center gap-1.5 xl:gap-2 rounded-lg xl:rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50/90 px-2 py-1 xl:px-2.5 xl:py-1.5 hover:shadow-md hover:border-teal-300 transition-all shrink-0 max-w-[7.25rem] xl:max-w-[168px]"
    >
      <div className="flex flex-col leading-none min-w-0">
        <span className="inline-flex items-center gap-0.5 xl:gap-1 text-[9px] xl:text-[10px] font-bold uppercase tracking-wide text-teal-800">
          <Wallet size={10} className="shrink-0 text-teal-600 xl:w-[11px] xl:h-[11px]" />
          Mi caja
        </span>
        <span className="mt-0.5 text-[11px] xl:text-xs font-bold text-teal-950 tabular-nums truncate">S/ {amount}</span>
      </div>
      {opened ? (
        <>
          <span className="hidden xl:block w-px h-7 bg-teal-200/80 shrink-0" aria-hidden />
          <div className="hidden xl:flex flex-col items-end leading-none shrink-0">
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
