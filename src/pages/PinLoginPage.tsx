import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Delete } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { restaurantAuthService, type PinLoginPayload } from '@/services/restaurantAuth.service'
import { defaultRouteForPermissions, featureAllowed } from '@/utils/restaurantPermissions'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { pinStationCharacter } from '@/config/branding'

const STATION_LABEL: Record<string, string> = {
  waiter: 'Mozo',
  cashier: 'Cajero',
  kitchen: 'Cocina',
  delivery: 'Delivery',
  admin: 'Administración',
}

export default function PinLoginPage() {
  const { station = 'waiter' } = useParams<{ station: string }>()
  const navigate = useNavigate()
  const { applySession } = useAuth()
  const { setFromLogin } = useBranch()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const label = STATION_LABEL[station] ?? 'Operación'
  const illustrationSrc = pinStationCharacter(station)

  const appendDigit = (d: string) => {
    if (pin.length >= 6) return
    setPin((p) => p + d)
  }

  const backspace = () => setPin((p) => p.slice(0, -1))

  const submit = async () => {
    if (pin.length < 4) {
      toast.error('Ingresa al menos 4 dígitos')
      return
    }
    setLoading(true)
    try {
      const data = await restaurantAuthService.pinLogin({
        pin,
        station: station as PinLoginPayload['station'],
      })
      applySession(data)
      setFromLogin(data.active_branch ?? null, !!data.can_switch_branch, data.allowed_branches)
      const employeeType = (data.user as { employee_type?: string } | undefined)?.employee_type
      const route = defaultRouteForPermissions(data.restaurant_permissions, employeeType)
      if (station === 'kitchen') {
        navigate('/comandas', { replace: true })
      } else if (station === 'admin') {
        navigate(featureAllowed(data.restaurant_permissions ?? [], 'dashboard') ? '/dashboard' : route, {
          replace: true,
        })
      } else {
        navigate(route, { replace: true })
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'PIN incorrecto'
      toast.error(msg)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      illustrationSrc={illustrationSrc ?? undefined}
      compactMobile
      backTo="/home"
      footer={<>Copyright © {new Date().getFullYear()} TukiChef Pro</>}
    >
      <div className="w-full max-w-xs mx-auto flex flex-col min-h-0 max-md:max-w-[min(100%,17.5rem)]">
        <h1 className="text-lg md:text-2xl font-bold text-[#1a365d] mb-0.5 text-center md:text-left">{label}</h1>
        <p className="text-xs md:text-sm text-stone-500 mb-3 md:mb-5 text-center md:text-left">
          Ingresa tu PIN de operación
        </p>

        <div className="flex justify-center gap-2 md:gap-2.5 mb-3 md:mb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full border-2 transition-colors max-md:w-[clamp(0.65rem,2.5vw,0.875rem)] max-md:h-[clamp(0.65rem,2.5vw,0.875rem)] w-3.5 h-3.5 ${
                i < pin.length ? 'bg-green-600 border-green-600' : 'border-stone-300 bg-white'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-[clamp(0.375rem,2vw,0.625rem)] md:gap-2.5 mb-3 md:mb-4 w-full mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
            if (key === '') return <div key="empty" className="h-[clamp(2.5rem,11vw,3.25rem)] md:h-[52px]" />
            if (key === 'del') {
              return (
                <button
                  key="del"
                  type="button"
                  onClick={backspace}
                  aria-label="Borrar"
                  className="h-[clamp(2.5rem,11vw,3.25rem)] md:h-[52px] rounded-lg md:rounded-xl bg-white text-stone-600 flex items-center justify-center hover:bg-stone-50 active:bg-stone-100 shadow-sm border border-stone-100 touch-manipulation"
                >
                  <Delete className="w-[clamp(1rem,4vw,1.25rem)] h-[clamp(1rem,4vw,1.25rem)] md:w-5 md:h-5" />
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => appendDigit(key)}
                className="h-[clamp(2.5rem,11vw,3.25rem)] md:h-[52px] rounded-lg md:rounded-xl bg-white text-stone-800 font-semibold text-[clamp(1rem,4.5vw,1.25rem)] md:text-xl hover:bg-stone-50 active:scale-95 active:bg-stone-100 shadow-sm border border-stone-100 touch-manipulation"
              >
                {key}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled={loading || pin.length < 4}
          onClick={() => void submit()}
          className="w-full py-[clamp(0.625rem,2.5vw,0.875rem)] md:py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm md:text-base disabled:opacity-50 shadow-md touch-manipulation shrink-0"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <Link
          to="/home"
          className="block w-full mt-2.5 sm:mt-4 text-center text-xs text-stone-500 hover:text-rest-600 py-1 touch-manipulation"
        >
          Volver al inicio
        </Link>
      </div>
    </AuthSplitLayout>
  )
}
