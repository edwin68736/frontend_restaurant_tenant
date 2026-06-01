import { useEffect, useRef, useState } from 'react'
import { Building2, ImagePlus, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { companyService, type CompanyConfig } from '@/services/company.service'
import { RestaurantReceiptWalletSettings } from './RestaurantReceiptWalletSettings'

const CURRENCIES = ['PEN', 'USD', 'EUR']

export function RestaurantCompanySettings() {
  const [form, setForm] = useState<Partial<CompanyConfig>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    companyService
      .getConfig()
      .then(setForm)
      .catch(() => toast.error('Error cargando datos de empresa'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k: keyof CompanyConfig, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen (PNG, JPG, etc.)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('logo_url', reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearLogo = () => {
    set('logo_url', '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const current = await companyService.getConfig()
      await companyService.updateConfig({
        trade_name: form.trade_name ?? '',
        address: form.address ?? '',
        ubigeo: form.ubigeo ?? '',
        phone: form.phone ?? '',
        email: form.email ?? '',
        currency: form.currency ?? 'PEN',
        logo_url: form.logo_url ?? '',
        additional_notes: form.additional_notes ?? '',
        color_theme: current.color_theme,
      })
      toast.success('Datos de empresa guardados')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">Datos de la empresa</h2>
            <p className="text-sm text-stone-600">Logo, contacto y dirección en comprobantes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Razón social</label>
            <input
              readOnly
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-stone-50 text-stone-600"
              value={form.business_name ?? ''}
            />
            <p className="text-[11px] text-stone-400 mt-0.5">Definida en el panel central</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nombre comercial</label>
            <input
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.trade_name ?? ''}
              onChange={(e) => set('trade_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">RUC</label>
            <input
              readOnly
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-stone-50 text-stone-600"
              value={form.ruc ?? ''}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Moneda</label>
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.currency ?? 'PEN'}
              onChange={(e) => set('currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-stone-600 mb-1">Dirección</label>
            <input
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Ubigeo (6 dígitos)</label>
            <input
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono"
              value={form.ubigeo ?? ''}
              onChange={(e) => set('ubigeo', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="150101"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Teléfono</label>
            <input
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-stone-600 mb-1">Correo</label>
            <input
              type="email"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-stone-600 mb-1">Información adicional</label>
            <textarea
              rows={4}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm resize-y min-h-[96px]"
              value={form.additional_notes ?? ''}
              onChange={(e) => set('additional_notes', e.target.value)}
              placeholder="Notas internas de la empresa: horarios, leyendas en tickets, datos bancarios, políticas, etc."
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Texto libre sobre la empresa. Puede usarse en documentos o consultas internas según la configuración del negocio.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
          <ImagePlus size={16} className="text-stone-500" />
          Logo
        </h3>
        <p className="text-xs text-stone-500">Se muestra en tickets y comprobantes impresos.</p>
        <div className="flex flex-wrap items-start gap-4">
          {form.logo_url ? (
            <div className="relative">
              <img
                src={form.logo_url}
                alt="Logo"
                className="h-24 w-auto max-w-[200px] object-contain border border-stone-200 rounded-xl bg-stone-50 p-2"
              />
              <button
                type="button"
                onClick={clearLogo}
                className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" id="rest-logo" />
            <label
              htmlFor="rest-logo"
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 hover:bg-stone-50"
            >
              <ImagePlus size={16} />
              {form.logo_url ? 'Cambiar logo' : 'Cargar logo'}
            </label>
          </div>
        </div>
      </section>

      <RestaurantReceiptWalletSettings embedded />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar empresa'}
        </button>
      </div>
    </div>
  )
}
