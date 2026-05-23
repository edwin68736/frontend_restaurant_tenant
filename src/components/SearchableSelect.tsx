import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export type SearchableSelectOption = {
  value: string | number
  label: string
  disabled?: boolean
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  menuClassName,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  allowClear = false,
}: {
  value: string | number | null | undefined
  onChange: (value: string | number | null) => void
  options: SearchableSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  menuClassName?: string
  searchable?: boolean
  searchPlaceholder?: string
  allowClear?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(() => {
    const v = value == null ? null : String(value)
    if (v == null) return null
    return options.find((o) => String(o.value) === v) ?? null
  }, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q))
  }, [options, query])

  const showSearch = searchable

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (showSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open, showSearch])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter' || e.key === ' ') setOpen(true)
          if (e.key === 'ArrowDown') setOpen(true)
        }}
        className={
          className ??
          'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2 disabled:bg-stone-50'
        }
      >
        <span className={selected ? 'text-stone-800 truncate' : 'text-stone-400 truncate'}>
          {selected?.label ?? placeholder ?? 'Selecciona'}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {allowClear && !disabled && selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChange(null)
                setOpen(false)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                e.stopPropagation()
                onChange(null)
                setOpen(false)
              }}
              className="p-1 rounded-lg hover:bg-stone-100"
            >
              <X size={16} className="text-stone-500" />
            </span>
          )}
          <ChevronDown size={18} className="text-stone-500" />
        </span>
      </button>

      {open && (
        <div
          className={
            menuClassName ??
            'absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden'
          }
        >
          {showSearch && (
            <div className="p-2 border-b border-stone-100">
              <div className="flex items-center gap-2 px-2 py-1.5 border border-stone-200 rounded-lg">
                <Search size={16} className="text-stone-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false)
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full text-sm outline-none"
                />
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-stone-500">Sin resultados</div>
            )}
            {filtered.map((opt) => {
              const isSelected = selected != null && String(selected.value) === String(opt.value)
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={!!opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                    opt.disabled ? 'text-stone-300 cursor-not-allowed' : 'hover:bg-stone-50'
                  } ${isSelected ? 'bg-rest-50 text-rest-700 font-semibold' : 'text-stone-700'}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <span className="text-xs text-rest-600">Seleccionado</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
