import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronLeft, FileUp, Loader2, Package, X } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'
import { subscriptionService, type BillingHub, type PublicPlan } from '@/services/subscription.service'
import { formatMoney } from './subscriptionUx'
import PaymentMethodsPanel from './PaymentMethodsPanel'
import { REST_SUBSCRIPTION_BLOCKED_MODAL_Z } from '@/utils/restaurantUiLayers'

const inputClass =
  'w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rest-300 bg-white'

type Props = {
  open: boolean
  onClose: () => void
  hub: BillingHub
  onSuccess: (hub?: BillingHub) => void
}

/**
 * Elegir plan (alta nueva o cambio) con comprobante OPCIONAL en el mismo paso — a diferencia de
 * PaymentModal, que exige billing_cycle_id + comprobante. Cierra un hueco real: "Renovar" en la
 * pestaña Planes y paquetes abría el formulario de pago de la deuda pendiente, no una lista de
 * planes para elegir.
 *
 * El ciclo (1/3/6/12 meses) se elige entre los que trae `plan.cycles` — ya no un número de meses
 * libre: cada plan solo permite los ciclos fijos que el panel central habilitó para él, con el
 * precio (bruto y neto tras descuento) que el backend ya calculó. Nunca se recalcula acá.
 */
export default function PlanPickerModal({ open, onClose, hub, onSuccess }: Props) {
  const cfg = hub.payment_config
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selected, setSelected] = useState<PublicPlan | null>(null)
  // true cuando el plan elegido es el MISMO que el tenant ya tiene activo: es un adelanto de
  // pago, no un cambio de plan — se salta el grid y cambia el copy para que quede claro.
  const [advancingCurrentPlan, setAdvancingCurrentPlan] = useState(false)
  const [months, setMonths] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [receipt, setReceipt] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const selectPlan = (plan: PublicPlan) => {
    setSelected(plan)
    setMonths(plan.cycles[0]?.months ?? 1)
    setAdvancingCurrentPlan(Boolean(hub.subscription.can_operate) && plan.name === hub.subscription.plan_name)
  }

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setAdvancingCurrentPlan(false)
    setMonths(1)
    setReceipt(null)
    setReference('')
    setPaymentMethod(cfg.methods[0]?.key ?? '')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setLoadingPlans(true)
    subscriptionService
      .listPlans()
      .then(list => {
        setPlans(list)
        // Suscripción activa (no bloqueada) + el mismo plan ya está en la lista: es un tenant
        // que quiere adelantar pago, no elegir plan — saltar directo al formulario.
        if (hub.subscription.can_operate && hub.subscription.plan_name) {
          const current = list.find(p => p.name === hub.subscription.plan_name)
          if (current) selectPlan(current)
        }
      })
      .catch(() => toast.error('No se pudieron cargar los planes'))
      .finally(() => setLoadingPlans(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cfg.methods, hub.subscription.can_operate, hub.subscription.plan_name])

  // Ciclos elegibles del plan: para "lifetime" (pago único) solo tiene sentido el de 1 — no se le
  // ofrece "3/6/12 meses" a un plan que no vence.
  const isLifetime = selected?.billing_cycle === 'lifetime'
  const availableCycles = (selected?.cycles ?? []).filter(c => !isLifetime || c.months === 1)
  const selectedCycle = availableCycles.find(c => c.months === months)
  const totalAmount = selectedCycle?.net_amount ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !selectedCycle) return
    const form = new FormData()
    form.append('plan_id', String(selected.id))
    form.append('period_months', String(months))
    form.append('amount', String(totalAmount))
    // El resto es opcional: el tenant puede pedir el plan sin adjuntar nada todavía.
    if (paymentMethod) form.append('payment_method', paymentMethod)
    if (paymentDate) form.append('payment_date', paymentDate)
    if (reference.trim()) form.append('reference', reference.trim())
    if (receipt) form.append('receipt', receipt)

    setSubmitting(true)
    try {
      const res = await subscriptionService.submitRenewalRequest(form)
      toast.success(res.message ?? 'Solicitud enviada')
      onSuccess(res.hub)
      onClose()
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      toast.error(apiErr?.response?.data?.error ?? 'Error al enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PortalModal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      overlayClassName="items-end sm:items-center"
      zClassName={REST_SUBSCRIPTION_BLOCKED_MODAL_Z}
    >
      <div className="w-full max-w-2xl max-h-[min(92dvh,900px)] overflow-y-auto rounded-2xl bg-white shadow-xl border border-stone-100">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-stone-100 bg-white px-4 py-3 rounded-t-2xl">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {advancingCurrentPlan ? 'Adelantar pago' : selected ? selected.name : 'Elegir plan'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {advancingCurrentPlan
                ? `Suma meses a tu plan actual (${selected?.name}) sin esperar a que venza`
                : selected
                  ? 'Confirma tu solicitud'
                  : 'Selecciona el plan que quieres contratar o al que quieres cambiarte'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {!selected ? (
            loadingPlans ? (
              <div className="flex items-center justify-center gap-2 py-10 text-stone-500">
                <Loader2 className="animate-spin" size={20} />
                Cargando planes…
              </div>
            ) : plans.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-500">No hay planes disponibles por ahora.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {plans.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPlan(p)}
                    className="text-left rounded-2xl border border-stone-200 p-4 hover:border-rest-400 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={16} className="text-rest-600" />
                      <span className="font-semibold text-stone-800">{p.name}</span>
                    </div>
                    <p className="text-2xl font-bold text-stone-900">
                      {formatMoney(p.price)}
                      <span className="text-xs font-normal text-stone-500"> /{billingCycleShort(p.billing_cycle)}</span>
                    </p>
                    {p.description && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{p.description}</p>}
                    <ul className="mt-3 space-y-1 text-xs text-stone-600">
                      <li className="flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-600 shrink-0" />
                        {p.is_unlimited_documents ? 'Documentos electrónicos ilimitados' : `${p.monthly_documents_limit} documentos/mes`}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-600 shrink-0" />
                        {p.max_users > 0 ? `Hasta ${p.max_users} usuarios` : 'Usuarios ilimitados'}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-600 shrink-0" />
                        {p.max_branches > 0 ? `Hasta ${p.max_branches} sucursales` : 'Sucursales ilimitadas'}
                      </li>
                    </ul>
                  </button>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <button
                type="button"
                onClick={() => { setSelected(null); setAdvancingCurrentPlan(false) }}
                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
              >
                <ChevronLeft size={14} /> Elegir otro plan
              </button>

              <div className="rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Plan elegido</span>
                  <span className="font-semibold text-stone-800">{selected.name} · {formatMoney(selected.price)}/mes</span>
                </div>
              </div>

              {!isLifetime && (
                <div>
                  <label className="text-xs font-medium text-stone-600">¿Por cuánto tiempo?</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {availableCycles.map(c => (
                      <button
                        key={c.months}
                        type="button"
                        onClick={() => setMonths(c.months)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border text-left ${
                          months === c.months
                            ? 'bg-rest-700 text-white border-rest-700'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div>{c.months} {c.months === 1 ? 'mes' : 'meses'}</div>
                        <div className={`text-[11px] font-normal ${months === c.months ? 'text-stone-200' : 'text-stone-500'}`}>
                          {c.net_amount !== c.gross_amount && (
                            <span className="line-through opacity-70 mr-1">{formatMoney(c.gross_amount)}</span>
                          )}
                          {formatMoney(c.net_amount)}
                        </div>
                      </button>
                    ))}
                  </div>
                  {availableCycles.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">Este plan no tiene ciclos disponibles por ahora — contacta a soporte.</p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-rest-200 bg-rest-50/60 px-3 py-2.5 text-sm flex items-center justify-between">
                <span className="text-stone-700">Total a depositar</span>
                <span className="text-lg font-bold text-stone-900">{formatMoney(totalAmount)}</span>
              </div>

              <p className="text-xs text-stone-500">
                Puedes adjuntar tu comprobante ahora para agilizar la aprobación, o enviar solo la
                solicitud y pagar después desde tu suscripción.
              </p>

              {cfg.methods.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-stone-600">Método de pago (opcional)</label>
                  <select className={`${inputClass} mt-1`} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="">Elige un método para ver cómo pagar…</option>
                    {cfg.methods.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMethod && <PaymentMethodsPanel cfg={cfg} selectedMethodKey={paymentMethod} />}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-600">Fecha de pago</label>
                  <input
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600">Referencia / Nº operación</label>
                  <input className={`${inputClass} mt-1`} value={reference} onChange={e => setReference(e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">Comprobante (opcional)</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.webp"
                  className="text-sm mt-1 block w-full"
                  onChange={e => setReceipt(e.target.files?.[0] ?? null)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedCycle}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rest-600 text-white text-sm font-semibold hover:bg-rest-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                Enviar solicitud
              </button>
            </form>
          )}
        </div>
      </div>
    </PortalModal>
  )
}

function billingCycleShort(cycle: string): string {
  if (cycle === 'yearly' || cycle === 'annual') return 'año'
  if (cycle === 'lifetime') return 'única vez'
  return 'mes'
}
