import { Coins, Receipt, ShoppingBag, Users, UtensilsCrossed } from 'lucide-react'
import type { DashboardSummary } from '@/services/restaurantDashboard.service'
import { formatSoles } from '@/utils/format'

type Props = {
  summary: DashboardSummary
}

export function DashboardKpiGrid({ summary }: Props) {
  const cards = [
    {
      key: 'sales',
      label: 'Total ventas',
      value: formatSoles(summary.total_sales),
      icon: Coins,
      accent: 'text-rest-700 bg-rest-50 border-rest-200',
    },
    {
      key: 'orders',
      label: 'Total pedidos',
      value: String(summary.total_orders),
      icon: Receipt,
      accent: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      key: 'ticket',
      label: 'Ticket promedio',
      value: formatSoles(summary.average_ticket),
      icon: ShoppingBag,
      accent: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      key: 'products',
      label: 'Productos vendidos',
      value: summary.products_sold.toLocaleString('es-PE', { maximumFractionDigits: 3 }),
      icon: UtensilsCrossed,
      accent: 'text-purple-700 bg-purple-50 border-purple-200',
    },
  ]

  if (summary.has_client_data) {
    cards.push({
      key: 'clients',
      label: 'Clientes atendidos',
      value: String(summary.clients_served),
      icon: Users,
      accent: 'text-teal-700 bg-teal-50 border-teal-200',
    })
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.key}
            className={`rounded-2xl border px-4 py-3 ${card.accent}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className="shrink-0 opacity-80" />
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums text-stone-900">{card.value}</p>
          </div>
        )
      })}
    </div>
  )
}
