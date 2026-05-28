import { Trash2 } from 'lucide-react'

type Props = {
  disabled?: boolean
  onClear: () => void
  className?: string
}

/** Vacía solo ítems pendientes del carrito (no comandas ya enviadas). */
export function CartClearButton({ disabled, onClear, className = '' }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClear}
      title="Vaciar carrito (no afecta comandas enviadas)"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      <Trash2 size={13} />
      Vaciar
    </button>
  )
}
