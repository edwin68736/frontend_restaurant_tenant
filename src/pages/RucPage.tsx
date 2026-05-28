import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'
import { publicService, storeTenant } from '@/services/public.service'
import { getCentralApiBaseUrl } from '@/services/api'
import { useTenantBinding } from '@/contexts/TenantBindingContext'
import { BRAND_LOGO_H } from '@/config/branding'
import { isDevelopmentMode } from '@/lib/runtime/environment'
import { DevServerSettings } from '@/components/settings/DevServerSettings'

/**
 * Vinculación única por instalación: RUC → slug + URL del tenant (persistido en disco).
 */
export default function RucPage() {
  const navigate = useNavigate()
  const { isBound, stored, reload } = useTenantBinding()
  const [ruc, setRuc] = useState(stored?.ruc ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isBound) {
      navigate('/home', { replace: true })
    }
  }, [isBound, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rucTrim = ruc.replace(/\D/g, '').trim()
    if (rucTrim.length < 8) {
      toast.error('Ingresa un RUC válido (mínimo 8 dígitos)')
      return
    }
    setLoading(true)
    try {
      const data = await publicService.getTenantByRuc(rucTrim)
      await storeTenant(data, rucTrim)
      await reload()
      toast.success(`Empresa vinculada: ${data.name}`)
      navigate('/home', { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } }; message?: string }
      const serverMsg = e?.response?.data?.error
      const localMsg = e?.message
      if (localMsg && !serverMsg) {
        toast.error(localMsg)
      } else if (serverMsg) {
        toast.error(serverMsg)
      } else if (e?.response?.status) {
        toast.error(`Error ${e.response.status} al consultar la empresa`)
      } else {
        toast.error(`No se pudo conectar con la API central (${getCentralApiBaseUrl()}). Verifica tu conexión.`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rest-900 via-rest-800 to-rest-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-3">
          <img src={BRAND_LOGO_H} alt="Tukichef" className="h-16 w-auto object-contain" />
        </div>
        <p className="text-sm text-stone-500 text-center mb-1">Gestión de restaurante</p>
        <p className="text-xs text-stone-400 text-center mb-6">
          Ingrese el RUC de su negocio. Esta vinculación queda guardada en el dispositivo y no se puede
          cambiar de empresa sin desinstalar la aplicación.
        </p>
        {isDevelopmentMode() && (
          <div className="mb-4">
            <DevServerSettings />
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">RUC del negocio</label>
            <input
              type="text"
              inputMode="numeric"
              value={ruc}
              onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
              placeholder="20123456789"
              maxLength={11}
              autoFocus
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rest-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-rest-600 hover:bg-rest-700 text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Building2 size={18} />
            {loading ? 'Buscando empresa...' : 'Validar negocio'}
          </button>
        </form>
      </div>
    </div>
  )
}
