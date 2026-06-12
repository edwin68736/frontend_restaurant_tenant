import { EyeOff } from 'lucide-react'

type Props = {
  currency?: string
  balance: number
  visible: boolean
  className?: string
}

export function MaskedAccountBalance({ currency = 'PEN', balance, visible, className = '' }: Props) {
  if (visible) {
    return (
      <span className={`font-bold text-stone-900 whitespace-nowrap tabular-nums ${className}`.trim()}>
        {currency} {Number(balance).toFixed(2)}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center justify-center text-stone-400 ${className}`.trim()}
      title="Saldo visible solo para el administrador"
      aria-label="Saldo oculto"
    >
      <EyeOff size={18} strokeWidth={2} aria-hidden />
    </span>
  )
}
