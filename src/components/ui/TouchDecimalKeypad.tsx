import { Delete } from 'lucide-react'
import { clsx } from 'clsx'

const MAX_INTEGER_DIGITS = 8
const MAX_DECIMAL_DIGITS = 2

/** Texto visible del monto (enteros primero; decimales solo si el usuario los ingresó). */
export function formatAmountDisplay(input: string): string {
  const s = input.trim().replace(',', '.')
  if (!s) return '0'
  if (s === '.') return '0.'
  return s
}

/** Convierte la entrada del teclado a número (máx. 2 decimales). */
export function parseAmountInput(input: string): number {
  let s = input.trim().replace(',', '.')
  if (!s || s === '.') return 0
  if (s.endsWith('.')) s = s.slice(0, -1)
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
  size?: 'default' | 'large'
}

/**
 * Teclado táctil: prioriza soles enteros (1 → 1, 0 → 10). Tecla "." para centavos (10.50).
 */
export function TouchDecimalKeypad({ value, onChange, className, size = 'large' }: Props) {
  const keyH = size === 'large' ? 'h-[clamp(2.75rem,12vw,3.5rem)] md:h-14' : 'h-11'
  const keyText = size === 'large' ? 'text-[clamp(1.125rem,5vw,1.5rem)] md:text-2xl' : 'text-lg'

  const appendDigit = (d: string) => {
    const hasDot = value.includes('.')
    if (hasDot) {
      const [, dec = ''] = value.split('.')
      if (dec.length >= MAX_DECIMAL_DIGITS) return
      onChange(value + d)
      return
    }
    const intPart = value === '0' ? '' : value
    const next = (intPart + d).replace(/^0+(?=\d)/, '')
    if (next.length > MAX_INTEGER_DIGITS) return
    onChange(next || '0')
  }

  const appendDecimal = () => {
    if (value.includes('.')) return
    onChange(value ? `${value}.` : '0.')
  }

  const backspace = () => {
    if (!value) return
    onChange(value.slice(0, -1))
  }

  const clear = () => onChange('')

  type Key = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | '.' | 'del'
  const keys: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

  return (
    <div className={clsx('space-y-2 md:space-y-2.5', className)}>
      <div className="grid grid-cols-3 gap-2 md:gap-2.5">
      {keys.map((key) => {
        if (key === '.') {
          return (
            <button
              key={key}
              type="button"
              onClick={appendDecimal}
              disabled={value.includes('.')}
              className={clsx(
                keyH,
                keyText,
                'rounded-xl bg-stone-100 text-stone-800 font-bold border border-stone-200',
                'hover:bg-stone-200 active:scale-[0.98] touch-manipulation shadow-sm',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              .
            </button>
          )
        }
        if (key === 'del') {
          return (
            <button
              key={key}
              type="button"
              onClick={backspace}
              aria-label="Borrar"
              className={clsx(
                keyH,
                'rounded-xl bg-white text-stone-600 flex items-center justify-center',
                'border border-stone-100 hover:bg-stone-50 active:scale-[0.98] touch-manipulation shadow-sm',
              )}
            >
              <Delete className={size === 'large' ? 'w-6 h-6 md:w-7 md:h-7' : 'w-5 h-5'} />
            </button>
          )
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => appendDigit(key)}
            className={clsx(
              keyH,
              keyText,
              'rounded-xl bg-white text-stone-800 font-semibold border border-stone-100',
              'hover:bg-stone-50 active:scale-[0.98] touch-manipulation shadow-sm',
            )}
          >
            {key}
          </button>
        )
      })}
      </div>
      <button
        type="button"
        onClick={clear}
        className={clsx(
          'w-full h-10 md:h-11 rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold border border-amber-100',
          'hover:bg-amber-100 active:scale-[0.99] touch-manipulation',
        )}
      >
        Limpiar (C)
      </button>
    </div>
  )
}
