import { forwardRef, type KeyboardEvent, type ReactNode } from 'react'
import { Loader2, Search } from 'lucide-react'

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Muestra spinner pequeño mientras debounce o petición en curso. */
  isSearching?: boolean
  /** Clases del contenedor (layout: flex-1, max-w-xs, etc.). Siempre incluye `relative`. */
  className?: string
  /** Clases extra del input (borde, tamaño de texto, etc.). */
  inputClassName?: string
  disabled?: boolean
  id?: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  /** Icono izquierdo (por defecto lupa). */
  leadingIcon?: ReactNode
}

const INPUT_BASE =
  'w-full pl-10 pr-10 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rest-500/30 disabled:bg-stone-50 [appearance:textfield] [&::-webkit-search-cancel-button]:appearance-none'

/**
 * Input de búsqueda con icono izquierdo y spinner derecho dentro del campo.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onChange,
    placeholder = 'Buscar...',
    isSearching = false,
    className,
    inputClassName,
    disabled,
    id,
    onKeyDown,
    leadingIcon,
  },
  ref,
) {
  const wrapperClass = className
    ? `relative w-full min-w-0 ${className}`
    : 'relative w-full min-w-0 flex-1 min-w-[200px]'

  return (
    <div className={wrapperClass}>
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-stone-400">
        {leadingIcon ?? <Search size={18} aria-hidden />}
      </span>
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={inputClassName ? `${INPUT_BASE} ${inputClassName}` : INPUT_BASE}
      />
      {isSearching && (
        <Loader2
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 animate-spin text-stone-400"
          aria-label="Buscando"
        />
      )}
    </div>
  )
})
