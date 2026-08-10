import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronLeft, FileUp, Loader2, Package, X } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'
import { subscriptionService, type BillingHub, type PublicPlan } from '@/services/subscription.service'
import { formatMoney } from './subscriptionUx'
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
 */
export default function PlanPickerModal({ open, onClose, hub, onSuccess }: Props) {
  const cfg = hub.payment_config
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selected, setSelected] = useState<PublicPlan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [receipt, setReceipt] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setReceipt(null)
    setReference('')
    setPaymentMethod(cfg.methods[0]?.key ?? '')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setLoadingPlans(true)
    subscriptionService
      .listPlans()
      .then(setPlans)
      .catch(() => toast.error('No se pudieron cargar los planes'))
      .finally(() => setLoadingPlans(false))
  }, [open, cfg.methods])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    const form = new FormData()
    form.append('plan_id', String(selected.id))
    form.append('amount', String(selected.price))
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
            <h3 className="text-base font-bold text-stone-900">{selected ? selected.name : 'Elegir plan'}</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {selected ? 'Confirma tu solicitud' : 'Selecciona el plan que quieres contratar o al que quieres cambiarte'}
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
                    onClick={() => setSelected(p)}
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
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
              >
                <ChevronLeft size={14} /> Elegir otro plan
              </button>

              <div className="rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2.5 text-sm flex items-center justify-between">
                <span className="text-stone-600">Plan elegido</span>
                <span className="font-semibold text-stone-800">
                  {selected.name} · {formatMoney(selected.price)}
                </span>
              </div>

              <p className="text-xs text-stone-500">
                Puedes adjuntar tu comprobante ahora para agilizar la aprobación, o enviar solo la
                solicitud y pagar después desde tu suscripción.
              </p>

              <div>
                <label className="text-xs font-medium text-stone-600">Método (opcional)</label>
                <select className={`${inputClass} mt-1`} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {cfg.methods.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
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
                disabled={submitting}
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
