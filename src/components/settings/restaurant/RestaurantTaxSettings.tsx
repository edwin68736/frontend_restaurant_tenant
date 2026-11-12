import { useEffect, useState } from 'react'
import { Percent, Save, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { companyService, type SunatConfig } from '@/services/company.service'
import { invalidateServiceChargeSettings } from '@/hooks/useServiceChargeSettings'
import { MAX_SERVICE_CHARGE_RATE } from '@/utils/serviceCharge'
import {
  DEFAULT_TAX_RATE_PERCENT,
  IGV_RATE_OPTIONS,
  normalizeIgvRateForSelect,
  type IgvRateOption,
} from '@/constants/tax'

export function RestaurantTaxSettings() {
  const [sunatEnabled, setSunatEnabled] = useState(false)
  const [form, setForm] = useState<Pick<SunatConfig, 'tax_rate' | 'igv_regime' | 'tax_benefit_zone'>>({
    tax_rate: DEFAULT_TAX_RATE_PERCENT,
    igv_regime: 'standard',
    tax_benefit_zone: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scEnabled, setScEnabled] = useState(false)
  const [scRate, setScRate] = useState('10')
  const [scSaving, setScSaving] = useState(false)

  useEffect(() => {
    companyService
      .getSunat()
      .then((data) => {
        setSunatEnabled(data.sunat_enabled ?? false)
        setForm({
          tax_rate: normalizeIgvRateForSelect(data.tax_rate),
          igv_regime: data.igv_regime || 'standard',
          tax_benefit_zone: data.tax_benefit_zone ?? false,
        })
      })
      .catch(() => toast.error('Error cargando configuración de impuestos'))
      .finally(() => setLoading(false))
    companyService
      .getConfig()
      .then((cfg) => {
        setScEnabled(cfg.service_charge_enabled === true)
        if (Number(cfg.service_charge_rate) > 0) setScRate(String(cfg.service_charge_rate))
      })
      .catch(() => {})
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

  const scRateNum = Number(scRate.replace(',', '.'))
  const scRateValid = Number.isFinite(scRateNum) && scRateNum >= 0.01 && scRateNum <= MAX_SERVICE_CHARGE_RATE

  const handleSaveServiceCharge = async () => {
    if (scEnabled && !scRateValid) {
      toast.error(`El recargo debe estar entre 0.01 % y ${MAX_SERVICE_CHARGE_RATE} %`)
      return
    }
    setScSaving(true)
    try {
      await companyService.updateConfig({
        service_charge_enabled: scEnabled,
        ...(scRateValid ? { service_charge_rate: scRateNum } : {}),
      })
      invalidateServiceChargeSettings()
      toast.success('Recargo al consumo guardado')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar')
    } finally {
      setScSaving(false)
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
            <select
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              value={form.tax_rate ?? DEFAULT_TAX_RATE_PERCENT}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tax_rate: Number(e.target.value) as IgvRateOption,
                }))
              }
            >
              {IGV_RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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

      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center">
            <Percent size={18} />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">Recargo al consumo</h2>
            <p className="text-sm text-stone-600">
              Hasta {MAX_SERVICE_CHARGE_RATE} % del valor de venta sin IGV. No lleva IGV.
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer rounded-xl border border-stone-200 px-3 py-3">
          <div>
            <p className="text-sm font-medium text-stone-800">Cobrar recargo al consumo</p>
            <p className="text-xs text-stone-500">El cajero podrá quitarlo en cada cobro si el cliente lo rechaza</p>
          </div>
          <input
            type="checkbox"
            checked={scEnabled}
            onChange={(e) => setScEnabled(e.target.checked)}
            className="h-5 w-5 accent-rest-600"
          />
        </label>

        {scEnabled && (
          <div className="max-w-[12rem]">
            <label className="block text-xs font-medium text-stone-600 mb-1">Porcentaje (%)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              max={MAX_SERVICE_CHARGE_RATE}
              step={0.01}
              value={scRate}
              onChange={(e) => setScRate(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-sm ${
                scRateValid ? 'border-stone-200' : 'border-red-300 bg-red-50'
              }`}
            />
            {!scRateValid && (
              <p className="mt-1 text-[11px] text-red-600">Entre 0.01 y {MAX_SERVICE_CHARGE_RATE}.</p>
            )}
          </div>
        )}

        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Por ley (DL 25988) el recargo al consumo pertenece a los trabajadores: repártalo entre su personal y
          avíselo en la carta.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveServiceCharge()}
            disabled={scSaving || (scEnabled && !scRateValid)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
          >
            <Save size={16} />
            {scSaving ? 'Guardando...' : 'Guardar recargo'}
          </button>
        </div>
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
