import { useNavigate } from 'react-router-dom'
import { Lock, Sparkles, UtensilsCrossed } from 'lucide-react'
import { LOADING_SCREEN_SAFE } from '@/utils/safeAreaClasses'

/**
 * Pantalla de "mejora tu plan" cuando el tenant NO tiene el módulo `restaurant` en su plan.
 * tukichef (app de restaurante) requiere ese módulo; sin él, el tenant solo puede ir a la
 * suscripción para adquirirlo.
 */
export default function RestaurantModuleUpsell() {
  const navigate = useNavigate()
  return (
    <div className={`${LOADING_SCREEN_SAFE} flex items-center justify-center bg-stone-100 px-4`}>
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
        <div className="relative mx-auto mb-5 w-16 h-16">
          <div className="w-16 h-16 rounded-2xl bg-rest-50 flex items-center justify-center">
            <UtensilsCrossed size={30} className="text-rest-600" />
          </div>
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rest-600 text-white flex items-center justify-center">
            <Lock size={14} />
          </span>
        </div>
        <h1 className="text-lg font-bold text-stone-800">Tu plan no incluye Restaurante</h1>
        <p className="text-sm text-stone-600 mt-2">
          La app de restaurante (mesas, comandas, mozos y cocina) requiere el módulo
          <strong> Restaurante</strong>, que tu plan actual no tiene.
        </p>
        <button
          type="button"
          onClick={() => navigate('/suscripcion')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-rest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rest-700"
        >
          <Sparkles size={16} /> Mejorar mi plan
        </button>
        <p className="text-stone-400 text-xs mt-3">
          Podrás usar la app suscribiéndote a un plan que incluya Restaurante.
        </p>
      </div>
    </div>
  )
}
