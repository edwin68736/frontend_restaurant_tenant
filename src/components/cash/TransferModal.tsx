import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, ArrowRight } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'
import { cashbankService, type BankAccount } from '@/services/cashbank.service'
import { formatMoney } from '@/utils/format'
import { getTodayPeru } from '@/utils/datesPeru'

type Props = {
  open: boolean
  onClose: () => void
  accounts: BankAccount[]
  onDone: () => void
}

const CASH = 'cash'
const keyOf = (a: BankAccount) => `b:${a.id}`
const curOf = (a?: BankAccount) => (String(a?.currency || 'PEN').toUpperCase() === 'USD' ? 'USD' : 'PEN')
const INPUT = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm'

/** Transferencia entre la caja y una cuenta, o entre dos cuentas. Si las monedas difieren usa el tipo de cambio indicado o el del día. */
export function TransferModal({ open, onClose, accounts, onDone }: Props) {
  const active = useMemo(() => accounts.filter((a) => a.active !== false), [accounts])
  const [fromKey, setFromKey] = useState<string>(CASH)
  const [toKey, setToKey] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [date, setDate] = useState(getTodayPeru())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (!open) return
    setFromKey(CASH)
    setToKey('')
    setAmount('')
    setRate('')
    setNotes('')
    setDate(getTodayPeru())
  }, [open])

  const find = (k: string) => active.find((a) => keyOf(a) === k)
  const fromCur = fromKey === CASH ? 'PEN' : curOf(find(fromKey))
  const toCur = toKey === CASH ? 'PEN' : toKey ? curOf(find(toKey)) : fromCur
  const crossCurrency = !!toKey && fromCur !== toCur
  const amt = Number(amount) || 0
  const r = Number(rate) || 0
  const receives = crossCurrency && r > 0 && amt > 0 ? (fromCur === 'USD' ? amt * r : amt / r) : amt

  const endpoint = (k: string) =>
    k === CASH ? { kind: 'cash' as const, account_id: 0 } : { kind: 'bank' as const, account_id: Number(k.slice(2)) }

  const submit = async () => {
    if (!toKey) return toast.error('Elige el destino de la transferencia')
    if (amt <= 0) return toast.error('Indica el monto a transferir')
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    try {
      await cashbankService.createTransfer({
        from: endpoint(fromKey),
        to: endpoint(toKey),
        amount: amt,
        exchange_rate: crossCurrency && r > 0 ? r : undefined,
        date,
        notes: notes.trim() || undefined,
      })
      toast.success('Transferencia registrada')
      onDone()
      onClose()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo registrar la transferencia')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  const options = (exclude?: string) => (
    <>
      <option value={CASH} disabled={exclude === CASH}>Caja (efectivo de mi sesión)</option>
      {active.map((a) => (
        <option key={a.id} value={keyOf(a)} disabled={exclude === keyOf(a)}>
          {a.name} ({curOf(a)}) — saldo {formatMoney(Number(a.balance), curOf(a))}
        </option>
      ))}
    </>
  )

  return (
    <PortalModal open={open} onClose={onClose} className="max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-800">Transferir entre cuentas</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Desde</label>
              <select className={INPUT} value={fromKey} onChange={(e) => setFromKey(e.target.value)}>
                {options(toKey)}
              </select>
            </div>
            <ArrowRight size={16} className="hidden sm:block text-stone-400 mb-3" />
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Hacia</label>
              <select className={INPUT} value={toKey} onChange={(e) => setToKey(e.target.value)}>
                <option value="">Selecciona…</option>
                {options(fromKey)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Monto que sale ({fromCur === 'USD' ? 'US$' : 'S/'})</label>
              <input type="number" min={0} step={0.01} className={INPUT} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
              <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {crossCurrency && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
              <p className="text-xs text-amber-800">
                Las cuentas están en monedas distintas ({fromCur} → {toCur}). Indica el tipo de cambio de la operación o déjalo vacío para usar el oficial del día.
              </p>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de cambio (S/ por US$)</label>
                  <input type="number" min={0} step={0.001} className={INPUT + ' bg-white'} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="TC del día" />
                </div>
                <p className="text-sm text-stone-700 pb-2">
                  Recibe: <strong>{r > 0 && amt > 0 ? formatMoney(Math.round(receives * 100) / 100, toCur) : '—'}</strong>
                </p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
            <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional (ej. depósito de la recaudación del día)" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">Cancelar</button>
            <button type="button" onClick={submit} disabled={saving} className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? '...' : 'Transferir'}
            </button>
          </div>
        </div>
      </div>
    </PortalModal>
  )
}
