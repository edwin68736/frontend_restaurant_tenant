import { useEffect, useMemo, useState } from 'react'
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH } from '@/lib/searchDefaults'

export type UseDebouncedSearchOptions = {
  /** Valor inicial del input. */
  initialValue?: string
  /** Retraso en ms antes de aplicar el valor debounced (700–1200). */
  delayMs?: number
  /** Mínimo de caracteres para considerar búsqueda activa; vacío siempre es válido. */
  minLength?: number
}

/**
 * Separa valor del input (inmediato) del valor debounced (para API).
 * `effectiveQuery`: cadena lista para enviar al backend; `null` si aún no cumple minLength.
 */
export function useDebouncedSearch(options: UseDebouncedSearchOptions = {}) {
  const { initialValue = '', delayMs = SEARCH_DEBOUNCE_MS, minLength = SEARCH_MIN_LENGTH } = options

  const [inputValue, setInputValue] = useState(initialValue)
  const [debouncedValue, setDebouncedValue] = useState(initialValue.trim())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(inputValue.trim())
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [inputValue, delayMs])

  const isDebouncing = inputValue.trim() !== debouncedValue

  const effectiveQuery = useMemo((): string | null => {
    if (debouncedValue === '') return ''
    if (debouncedValue.length < minLength) return null
    return debouncedValue
  }, [debouncedValue, minLength])

  const meetsMinLength = debouncedValue === '' || debouncedValue.length >= minLength

  return {
    inputValue,
    setInputValue,
    debouncedValue,
    effectiveQuery,
    isDebouncing,
    meetsMinLength,
  }
}
