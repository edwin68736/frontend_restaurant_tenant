import { useState, type InputHTMLAttributes } from 'react'
import { formatAmountDisplay, parseMoneyInput, roundDisplay } from '@/utils/money'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number
  onChange: (value: number) => void
  /** Si true, muestra vacío cuando el valor es 0 y el campo no tiene foco. */
  emptyWhenZero?: boolean
}

/**
 * Input monetario: muestra 2 decimales al usuario; persiste con precisión interna (6 dec).
 */
export function MoneyAmountInput({
  value,
  onChange,
  emptyWhenZero = false,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const blurredDisplay =
    emptyWhenZero && roundDisplay(value) === 0 ? '' : formatAmountDisplay(value)

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={focused ? draft : blurredDisplay}
      onFocus={(e) => {
        setFocused(true)
        setDraft(emptyWhenZero && value === 0 ? '' : formatAmountDisplay(value))
        onFocus?.(e)
      }}
      onBlur={(e) => {
        onChange(parseMoneyInput(draft))
        setFocused(false)
        onBlur?.(e)
      }}
      onChange={(e) => setDraft(e.target.value)}
    />
  )
}
