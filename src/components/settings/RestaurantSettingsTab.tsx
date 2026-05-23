import { useState } from 'react'
import { RestaurantBranchesSettings } from './restaurant/RestaurantBranchesSettings'
import { RestaurantCompanySettings } from './restaurant/RestaurantCompanySettings'
import { RestaurantOperationSettings } from './restaurant/RestaurantOperationSettings'
import { RestaurantSeriesSettings } from './restaurant/RestaurantSeriesSettings'
import { RestaurantTaxSettings } from './restaurant/RestaurantTaxSettings'

type RestTab = 'operacion' | 'empresa' | 'impuestos' | 'sucursales' | 'series'

const TABS: { id: RestTab; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'impuestos', label: 'Impuestos' },
  { id: 'sucursales', label: 'Sucursales' },
  { id: 'series', label: 'Series' },
]

export function RestaurantSettingsTab() {
  const [tab, setTab] = useState<RestTab>('operacion')

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
    </div>
  )
}
