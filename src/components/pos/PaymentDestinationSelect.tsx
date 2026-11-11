import type { BankAccount, PaymentMethodRecord } from '@/services/cashbank.service'

type Props = {
  method: PaymentMethodRecord | undefined
  accounts: BankAccount[]
  /** '' = la cuenta que tiene vinculada el método de pago. */
  value: string
  onChange: (accountId: string) => void
  className?: string
}

export function eligibleDestinationAccounts(accounts: BankAccount[]): BankAccount[] {
  return (accounts ?? []).filter((a) => a.active !== false)
}

/** Solo los métodos que van a cuenta bancaria y con más de una cuenta posible permiten elegir destino. */
export function canChooseDestination(method: PaymentMethodRecord | undefined, accounts: BankAccount[]): boolean {
  return !!method && method.destination_type === 'bank_account' && eligibleDestinationAccounts(accounts).length > 1
}

const accLabel = (a: BankAccount) =>
  ([a.bank_name, a.name].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ') || `Cuenta ${a.id}`) +
  (String(a.currency || 'PEN').toUpperCase() === 'USD' ? ' (US$)' : '')

/** «¿A qué cuenta entró este dinero?». Por defecto, la cuenta vinculada al método. El efectivo va siempre a la caja. */
export function PaymentDestinationSelect({ method, accounts, value, onChange, className }: Props) {
  if (!canChooseDestination(method, accounts)) return null
  const eligible = eligibleDestinationAccounts(accounts)
  const def = eligible.find((a) => a.id === method?.bank_account_id)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Cuenta que recibe este pago"
      aria-label="Cuenta de destino del pago"
      className={className ?? 'col-span-2 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs'}
    >
      <option value="">{def ? `Destino: ${accLabel(def)}` : 'Destino: cuenta del método'}</option>
      {eligible
        .filter((a) => a.id !== def?.id)
        .map((a) => (
          <option key={a.id} value={String(a.id)}>
            {accLabel(a)}
          </option>
        ))}
    </select>
  )
}
