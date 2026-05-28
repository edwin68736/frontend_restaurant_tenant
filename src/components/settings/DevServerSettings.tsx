import { useState } from 'react'
import { toast } from 'sonner'
import { Server } from 'lucide-react'
import { getDisplayedTenantApiUrl } from '@/services/api'
import { updateDevTenantApiUrl } from '@/lib/tenantBinding/store'
import { useTenantBinding } from '@/contexts/TenantBindingContext'
import { connectivityManager } from '@/lib/connectivity/connectivityManager'

/**
 * Solo visible en `import.meta.env.DEV`: permite apuntar a localhost o IP LAN sin bloquear por prod.
 */
export function DevServerSettings() {
  const { stored, reload } = useTenantBinding()
  const [url, setUrl] = useState(stored?.apiUrl ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDevTenantApiUrl(url)
      await reload()
      await connectivityManager.probe({ userInitiated: true })
      toast.success('Servidor de desarrollo actualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la URL')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Server className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" aria-hidden />
        <div>
          <h2 className="text-sm font-bold text-amber-950">Servidor (desarrollo)</h2>
          <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
            En modo desarrollo las peticiones usan el proxy de Vite. Indique la URL del tenant que debe
            recibir el encabezado <code className="font-mono text-[11px]">X-Tenant-Api-Origin</code>.
          </p>
          <p className="text-xs text-stone-600 mt-2">
            Activo: <span className="font-mono break-all">{getDisplayedTenantApiUrl()}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:8080 o http://192.168.1.10:8080"
          className="flex-1 border border-amber-200 rounded-xl px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-rest-500"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !url.trim()}
          className="shrink-0 px-4 py-2 rounded-xl bg-rest-600 text-white text-sm font-semibold hover:bg-rest-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Aplicar URL'}
        </button>
      </div>
    </section>
  )
}
