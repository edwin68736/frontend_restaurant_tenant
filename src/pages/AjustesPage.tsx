import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { canConfigureDevicePrinters } from '@/utils/restaurantPermissions'
import { PrintersSettingsTab } from '@/components/settings/PrintersSettingsTab'
import { RestaurantSettingsTab } from '@/components/settings/RestaurantSettingsTab'
import { AppVersionBadge } from '@/components/layout/AppVersionBadge'
import { isDevelopmentMode } from '@/lib/runtime/environment'
import { DevServerSettings } from '@/components/settings/DevServerSettings'

type SettingsTab = 'restaurante' | 'impresoras'

export default function AjustesPage() {
  const { hasPerm, restaurantPermissions, employeeType } = useAuth()
  const canManageRestaurant = hasPerm('s.m')
  const canPrinters = canConfigureDevicePrinters(restaurantPermissions, employeeType)

  const defaultTab = useMemo((): SettingsTab => {
    if (canManageRestaurant) return 'restaurante'
    if (canPrinters) return 'impresoras'
    return 'restaurante'
  }, [canManageRestaurant, canPrinters])

  const [tab, setTab] = useState<SettingsTab>(defaultTab)
  const activeTab: SettingsTab =
    canManageRestaurant && canPrinters ? tab : canManageRestaurant ? 'restaurante' : 'impresoras'
  const printersOnly = canPrinters && !canManageRestaurant

  if (!canManageRestaurant && !canPrinters) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-6xl mx-auto pb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-stone-900">
              {printersOnly ? 'Impresoras del equipo' : 'Ajustes'}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {printersOnly
                ? 'Configure comandas, precuenta y documentos en este dispositivo (Android / Windows).'
                : 'Configuración del restaurante y del equipo local.'}
            </p>
          </div>
          <AppVersionBadge className="shrink-0 pt-1" />
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

        {isDevelopmentMode() && (
          <div className="mt-5">
            <DevServerSettings />
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
