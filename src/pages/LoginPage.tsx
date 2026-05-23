import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { toast } from 'sonner'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { BRAND_WAITER } from '@/config/branding'
import { getStoredTenant } from '@/services/public.service'

export default function LoginPage() {
  const { login } = useAuth()
  const { setFromLogin } = useBranch()
  const navigate = useNavigate()
  const tenant = getStoredTenant()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await login({ email, password, slug: tenant?.slug })
      setFromLogin(data.active_branch ?? null, !!data.can_switch_branch)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      illustrationSrc={BRAND_WAITER}
      compactMobile
      backTo="/home"
      footer={<>Copyright © {new Date().getFullYear()} TukiChef Pro</>}
    >
      <div className="w-full max-w-sm mx-auto flex flex-col min-h-0 max-md:max-w-[min(100%,20rem)]">
        <h1 className="text-lg md:text-2xl font-bold text-[#1a365d] mb-0.5 text-center">
          Bienvenido de nuevo
        </h1>
        <p className="text-xs md:text-sm text-stone-500 mb-3 md:mb-5 text-center">
          Inicia sesión en tu cuenta para continuar
        </p>

        {/*{tenant?.name && (
          <p className="text-sm text-rest-700 font-medium mb-0.5 truncate text-center md:text-left">
            {tenant.name}
          </p>
        )}*/}
        {/*{tenant?.ruc && (
          <p className="text-xs text-stone-400 font-mono mb-3 md:mb-4 text-center md:text-left">RUC {tenant.ruc}</p>
        )}*/}

        <form onSubmit={handleSubmit} className="space-y-[clamp(0.625rem,2.5vw,1rem)]">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none w-4 h-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="correo@empresa.com"
                className="w-full border-0 bg-white rounded-xl pl-10 pr-3 py-[clamp(0.625rem,2.5vw,0.75rem)] text-base sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none w-4 h-4" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border-0 bg-white rounded-xl pl-10 pr-3 py-[clamp(0.625rem,2.5vw,0.75rem)] text-base sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-[clamp(0.75rem,2.5vw,0.875rem)] bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 shadow-md touch-manipulation"
          >
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>

        <Link
          to="/home"
          className="block w-full mt-2.5 sm:mt-4 text-center text-xs text-stone-500 hover:text-rest-600 py-1 touch-manipulation"
        >
          Volver al inicio
        </Link>
        {/*<button
          type="button"
          onClick={handleChangeCompany}
          className="w-full mt-1 text-xs text-stone-500 hover:text-rest-600 py-1 touch-manipulation text-center"
        >
          Cambiar empresa (ingresar otro RUC)
        </button>*/}
      </div>
    </AuthSplitLayout>
  )
}
