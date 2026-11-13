import { SearchCheck } from 'lucide-react'

/**
 * Botón «Consultar» del N° de documento (RUC/DNI). Va en color primario para que se note que es la acción que trae los datos;
 * en pantallas chicas muestra solo el icono (el texto queda para lectores de pantalla y tooltip).
 */
export function ConsultaButton({
  onClick,
  disabled,
  loading,
  title = 'Consultar DNI o RUC en SUNAT',
  className = '',
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap bg-rest-600 text-white hover:bg-rest-700 disabled:opacity-50 ${className}`}
      title={title}
      aria-label="Consultar"
    >
      <SearchCheck size={15} className={loading ? 'animate-pulse' : ''} />
      <span className="hidden sm:inline">{loading ? '...' : 'Consultar'}</span>
    </button>
  )
}

/**
 * Interruptor «Escribir manualmente» de la razón social. Con RUC/DNI el nombre viene de la consulta (bloqueado) para evitar
 * errores de tipeo; activarlo permite escribirlo a mano.
 */
export function ManualNameToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-stone-500 select-none">
      <input type="checkbox" className="h-3.5 w-3.5 accent-green-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Escribir manualmente
    </label>
  )
}

/** Clases del campo de razón social según esté bloqueado (viene de la consulta) o editable. */
export function nameInputClass(locked: boolean, base = 'w-full border rounded-xl px-3 py-2 text-sm'): string {
  return locked
    ? `${base} border-stone-200 bg-stone-50 text-stone-700 cursor-not-allowed focus:outline-none`
    : `${base} border-stone-200 focus:outline-none focus:ring-2 focus:ring-rest-500 focus:border-rest-500`
}
