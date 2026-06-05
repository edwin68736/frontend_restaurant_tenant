import { ExternalLink, Layers, Package, Sparkles } from 'lucide-react'
import type { BillingHub, DocumentPackageCatalog } from '@/services/subscription.service'
import {
  billingCycleLabel,
  docProgressColor,
  formatDate,
  formatMoney,
  portalUrl,
  statusBadgeClass,
  STATUS_LABELS,
} from './subscriptionUx'

const MODULE_CATALOG = [
  { id: 'pos', name: 'POS', desc: 'Punto de venta y cobro' },
  { id: 'delivery', name: 'Delivery', desc: 'Reparto y pedidos externos' },
  { id: 'production', name: 'Producción', desc: 'Comandas y cocina' },
  { id: 'inventory', name: 'Inventario avanzado', desc: 'Stock y movimientos' },
] as const

type Props = {
  hub: BillingHub
  onBuyPackage: (pkg: DocumentPackageCatalog) => void
  onRenew: () => void
}

export default function PlansPackagesTab({ hub, onBuyPackage, onRenew }: Props) {
  const sub = hub.subscription
  const portal = portalUrl(hub)
  const docs = hub.documents
  const packages = hub.document_packages ?? []

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Tu plan actual</h3>
        <div className="rounded-2xl border-2 border-rest-200 bg-rest-50/50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-stone-900">{sub.plan_name || 'Sin plan'}</p>
              <p className="text-sm text-stone-600 mt-0.5">Ciclo {billingCycleLabel(sub.billing_cycle).toLowerCase()}</p>
              <span
                className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass(sub.status)}`}
              >
                {STATUS_LABELS[sub.status] ?? sub.status}
              </span>
            </div>
            <button
              type="button"
              onClick={onRenew}
              className="px-4 py-2 rounded-xl bg-rest-600 text-white text-sm font-semibold hover:bg-rest-700"
            >
              Renovar
            </button>
          </div>
        </div>
        {portal ? (
          <a
            href={portal}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-rest-700 hover:underline"
          >
            <ExternalLink size={14} />
            Cambiar de plan en portal Tukifac
          </a>
        ) : (
          <p className="mt-2 text-xs text-stone-500">
            Para cambiar de plan contacte a soporte o a la central Tukifac.
          </p>
        )}
      </section>

      {docs && !docs.is_unlimited ? (
        <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-rest-600" />
            Uso de documentos
          </h3>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full ${docProgressColor(docs.usage_percent, docs.warning_level)}`}
              style={{ width: `${Math.min(100, docs.usage_percent)}%` }}
            />
          </div>
          <p className="text-sm text-stone-600">
            <span className="font-bold text-stone-900">{docs.total_available}</span> disponibles ·{' '}
            {docs.usage_percent}% usado
          </p>
          {docs.billing_cycle_end ? (
            <p className="text-xs text-stone-500 mt-1">Ciclo hasta {formatDate(docs.billing_cycle_end)}</p>
          ) : null}
        </section>
      ) : null}

      {packages.length > 0 ? (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Paquetes adicionales</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map(p => (
              <div
                key={p.id}
                className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm flex flex-col"
              >
                <Package size={18} className="text-rest-600 mb-2" />
                <p className="font-bold text-stone-900">{p.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">{p.documents_qty} documentos</p>
                <p className="text-lg font-bold text-rest-700 mt-2">{formatMoney(p.price, p.currency)}</p>
                <button
                  type="button"
                  onClick={() => onBuyPackage(p)}
                  className="mt-auto pt-3 w-full py-2 rounded-xl border border-rest-200 text-rest-700 text-sm font-semibold hover:bg-rest-50"
                >
                  Comprar
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Módulos adicionales</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODULE_CATALOG.map(mod => (
            <div key={mod.id} className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <Layers size={16} className="text-stone-400 mb-2" />
              <p className="font-semibold text-stone-900 text-sm">{mod.name}</p>
              <p className="text-xs text-stone-500 mt-0.5">{mod.desc}</p>
              {portal ? (
                <a
                  href={portal}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-rest-700 hover:underline"
                >
                  Solicitar en portal →
                </a>
              ) : (
                <p className="mt-3 text-xs text-stone-400">Consultar con soporte</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
