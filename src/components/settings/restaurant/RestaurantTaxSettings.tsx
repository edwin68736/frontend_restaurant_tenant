import { useEffect, useState } from 'react'
import { Save, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { companyService, type SunatConfig } from '@/services/company.service'
import { DEFAULT_TAX_RATE_PERCENT, resolveTaxRatePercent } from '@/constants/tax'

export function RestaurantTaxSettings() {
  const [sunatEnabled, setSunatEnabled] = useState(false)
  const [form, setForm] = useState<Pick<SunatConfig, 'tax_rate' | 'igv_regime' | 'tax_benefit_zone'>>({
    tax_rate: DEFAULT_TAX_RATE_PERCENT,
    igv_regime: 'standard',
    tax_benefit_zone: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    companyService
      .getSunat()
      .then((data) => {
        setSunatEnabled(data.sunat_enabled ?? false)
        setForm({
          tax_rate: resolveTaxRatePercent(data.tax_rate),
          igv_regime: data.igv_regime || 'standard',
          tax_benefit_zone: data.tax_benefit_zone ?? false,
        })
      })
      .catch(() => toast.error('Error cargando configuración de impuestos'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await companyService.updateSunat(form)
      toast.success('Configuración de impuestos guardada')
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
    <div className="space-y-5 max-w-2xl">
      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">Impuestos (IGV)</h2>
            <p className="text-sm text-stone-600">Tasa, régimen y zona tributaria para ventas y comprobantes.</p>
          </div>
        </div>

        <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2 text-xs text-stone-600">
          Facturación electrónica SUNAT:{' '}
          <span className={sunatEnabled ? 'text-rest-700 font-medium' : 'text-amber-700 font-medium'}>
            {sunatEnabled ? 'Habilitada (panel central)' : 'No habilitada'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Tasa IGV (%)</label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.01}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.tax_rate ?? DEFAULT_TAX_RATE_PERCENT}
              onChange={(e) => setForm((f) => ({ ...f, tax_rate: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Régimen IGV</label>
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.igv_regime ?? 'standard'}
              onChange={(e) => setForm((f) => ({ ...f, igv_regime: e.target.value }))}
            >
              <option value="standard">Régimen general</option>
              <option value="simplified">Régimen simplificado</option>
              <option value="exempt">Exonerado</option>
            </select>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer rounded-xl border border-stone-200 px-3 py-3">
          <div>
            <p className="text-sm font-medium text-stone-800">Zona de beneficio tributario</p>
            <p className="text-xs text-stone-500">Selva u otras zonas con beneficios especiales</p>
          </div>
          <input
            type="checkbox"
            checked={form.tax_benefit_zone ?? false}
            onChange={(e) => setForm((f) => ({ ...f, tax_benefit_zone: e.target.checked }))}
            className="h-5 w-5 accent-rest-600"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar impuestos'}
        </button>
      </div>
    </div>
  )
}
