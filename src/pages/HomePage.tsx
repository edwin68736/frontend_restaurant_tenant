import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, UserRound, Wallet, ChefHat, Bike } from 'lucide-react'
import { useTenantBinding } from '@/contexts/TenantBindingContext'
import { restaurantAuthService } from '@/services/restaurantAuth.service'
import { BRAND_BG } from '@/config/branding'

type StationCard = {
  station: 'waiter' | 'cashier' | 'kitchen' | 'delivery'
  title: string
  subtitle: string
  icon: typeof UserRound
  color: string
}

const STATIONS: StationCard[] = [
  { station: 'waiter', title: 'Soy mozo', subtitle: 'Mesas y pedidos', icon: UserRound, color: 'from-emerald-500 to-teal-600' },
  { station: 'cashier', title: 'Soy cajero', subtitle: 'POS y cobros', icon: Wallet, color: 'from-blue-500 to-indigo-600' },
  { station: 'kitchen', title: 'Cocina', subtitle: 'Comandas', icon: ChefHat, color: 'from-orange-500 to-amber-600' },
  { station: 'delivery', title: 'Delivery', subtitle: 'Repartos', icon: Bike, color: 'from-violet-500 to-purple-600' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { isBound, stored: tenant } = useTenantBinding()
  const [pinEnabled, setPinEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isBound) {
      navigate('/ruc', { replace: true })
      return
    }
    restaurantAuthService
      .getConfig()
      .then((c) => setPinEnabled(c.pin_login_enabled))
      .catch(() => setPinEnabled(false))
      .finally(() => setLoading(false))
  }, [isBound, navigate])

  if (!isBound || !tenant) return null

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-y-auto flex flex-col"
      style={{
        backgroundImage: `url(${BRAND_BG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
<div className="absolute inset-0 bg-gradient-to-b from-stone-950/15 via-stone-900/10 to-stone-950/20 pointer-events-none" aria-hidden />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-full max-w-2xl mx-auto px-[clamp(0.75rem,4vw,2.5rem)] py-[max(1.25rem,env(safe-area-inset-top))] pb-4 min-h-0">
        <div className="w-full text-center bg-slate-700/50 p-2 rounded-2xl mb-[clamp(1rem,4vw,2rem)] shrink-0">
          {/*<img
            src={BRAND_LOGO}
            alt="Tukichef"
            className="w-[clamp(4rem,18vw,7rem)] h-[clamp(4rem,18vw,7rem)] mx-auto mb-3 sm:mb-4 object-contain drop-shadow-lg"
          />*/}
          <h1 className="text-[clamp(1.25rem,5vw,1.875rem)] font-bold text-gray-200 tracking-tight drop-shadow-md px-2">
            {tenant.name || 'Restaurante'}
          </h1>
          {/*<p className="text-white/90 text-xs sm:text-sm mt-1 drop-shadow">Tukichef · Operación en sala</p>*/}
          {tenant.ruc && (
            <p className="text-gray-200 text-[10px] sm:text-xs font-mono mt-1.5 sm:mt-2">RUC {tenant.ruc}</p>
          )}
        </div>

        {loading ? (
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
        ) : (
          <div className="w-full space-y-3 sm:space-y-4 min-h-0">
            <Link
              to="/login"
              className="flex items-center gap-3 sm:gap-4 w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/95 hover:bg-white shadow-lg transition-all border border-white/20 touch-manipulation"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-white shrink-0">
                <Shield className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="font-semibold text-stone-800 text-sm sm:text-base">Iniciar sesión administrativa</p>
                <p className="text-[10px] sm:text-xs text-stone-500 leading-snug">
                  Email y contraseña · configuración y supervisión
                </p>
              </div>
            </Link>

            {pinEnabled ? (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3">
                {STATIONS.map((s) => {
                  const Icon = s.icon
                  return (
                    <Link
                      key={s.station}
                      to={`/pin/${s.station}`}
                      className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-700/65 hover:bg-stone-700/25 border border-white/20 backdrop-blur-sm transition-all shadow-lg touch-manipulation min-h-[3.5rem]"
                    >
                      <div
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shrink-0`}
                      >
                        <Icon className="w-5 h-5 sm:w-5 sm:h-5" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm">{s.title}</p>
                        <p className="text-[10px] sm:text-xs text-stone-200 leading-snug">{s.subtitle}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-xs sm:text-sm text-stone-200 px-3 sm:px-4 py-2.5 sm:py-3 bg-black/30 rounded-xl backdrop-blur-sm leading-snug">
                Configure PIN de operación en Usuarios (panel tenant) para habilitar acceso rápido por estación.
              </p>
            )}
          </div>
        )}
      </div>

      {/*<div className="relative z-10 shrink-0 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={() => navigate('/ruc')}
          className="inline-flex items-center gap-2 text-xs text-stone-300 hover:text-white py-2 touch-manipulation"
        >
          <Building2 size={14} />
          Cambiar empresa
        </button>
      </div>*/}
    </div>
  )
}
