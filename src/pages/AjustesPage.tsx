import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isNativePrintAvailable } from '@/services/printers.service'
import { PrintersSettingsTab } from '@/components/settings/PrintersSettingsTab'
import { RestaurantSettingsTab } from '@/components/settings/RestaurantSettingsTab'

type SettingsTab = 'restaurante' | 'impresoras'

export default function AjustesPage() {
  const { hasPerm } = useAuth()
  const canManageRestaurant = hasPerm('s.m')
  const canPrinters = isNativePrintAvailable()

  const defaultTab = useMemo((): SettingsTab => {
    if (canManageRestaurant) return 'restaurante'
    if (canPrinters) return 'impresoras'
    return 'restaurante'
  }, [canManageRestaurant, canPrinters])

  const [tab, setTab] = useState<SettingsTab>(defaultTab)
  const activeTab: SettingsTab =
    canManageRestaurant && canPrinters ? tab : canManageRestaurant ? 'restaurante' : 'impresoras'

  if (!canManageRestaurant && !canPrinters) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-6xl mx-auto pb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Ajustes</h1>
          <p className="mt-1 text-sm text-stone-600">
            Configuración del restaurante y del equipo local.
          </p>
        </div>

        {(canManageRestaurant && canPrinters) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {canManageRestaurant && (
              <button
                type="button"
                onClick={() => setTab('restaurante')}
                className={`px-3 py-2 rounded-xl text-sm font-semibold ${
                  tab === 'restaurante'
                    ? 'bg-rest-600 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                Restaurante
              </button>
            )}
            {canPrinters && (
              <button
                type="button"
                onClick={() => setTab('impresoras')}
                className={`px-3 py-2 rounded-xl text-sm font-semibold ${
                  tab === 'impresoras'
                    ? 'bg-rest-600 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                Impresoras
              </button>
            )}
          </div>
        )}

        <div className="mt-5">
          {activeTab === 'restaurante' && <RestaurantSettingsTab />}
          {activeTab === 'impresoras' && <PrintersSettingsTab />}
        </div>
      </div>
    </div>
  )
}
