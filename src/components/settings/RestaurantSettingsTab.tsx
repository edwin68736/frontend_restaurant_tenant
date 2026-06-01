import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RestaurantBranchesSettings } from './restaurant/RestaurantBranchesSettings'
import { RestaurantCompanySettings } from './restaurant/RestaurantCompanySettings'
import { RestaurantOperationSettings } from './restaurant/RestaurantOperationSettings'
import { RestaurantReceiptWalletSettings } from './restaurant/RestaurantReceiptWalletSettings'
import { RestaurantSeriesSettings } from './restaurant/RestaurantSeriesSettings'
import { RestaurantTaxSettings } from './restaurant/RestaurantTaxSettings'

type RestTab = 'operacion' | 'empresa' | 'impuestos' | 'sucursales' | 'series' | 'comprobantes'

const TABS: { id: RestTab; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'comprobantes', label: 'Comprobantes' },
  { id: 'impuestos', label: 'Impuestos' },
  { id: 'sucursales', label: 'Sucursales' },
  { id: 'series', label: 'Series' },
]

export function RestaurantSettingsTab() {
  const location = useLocation()
  const navTab = (location.state as { restaurantSettingsTab?: RestTab } | null)?.restaurantSettingsTab
  const [tab, setTab] = useState<RestTab>(navTab ?? 'operacion')

  useEffect(() => {
    if (navTab) setTab(navTab)
  }, [navTab])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
              tab === t.id
                ? 'bg-rest-600 text-white'
                : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'operacion' && <RestaurantOperationSettings />}
      {tab === 'empresa' && <RestaurantCompanySettings />}
      {tab === 'impuestos' && <RestaurantTaxSettings />}
      {tab === 'sucursales' && <RestaurantBranchesSettings />}
      {tab === 'series' && <RestaurantSeriesSettings />}
      {tab === 'comprobantes' && <RestaurantReceiptWalletSettings />}
    </div>
  )
}
