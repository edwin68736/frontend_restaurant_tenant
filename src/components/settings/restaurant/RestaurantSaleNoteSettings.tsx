import { useEffect, useState } from 'react'
import { FileText, Save } from 'lucide-react'
import { toast } from 'sonner'
import { companyService } from '@/services/company.service'

/**
 * Ajustes de la nota de venta (documento interno, SUNAT 00): mostrar o no la razón social y el desglose del IGV al imprimir.
 * Misma configuración que en Tukifac (Ajustes → Comprobantes → Notas de venta); no afecta a boleta ni a factura.
 */
export function RestaurantSaleNoteSettings() {
  const [tradeName, setTradeName] = useState('')
  const [showBusinessName, setShowBusinessName] = useState(true)
  const [showIgvBreakdown, setShowIgvBreakdown] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    companyService
      .getConfig()
      .then((cfg) => {
        setTradeName(String(cfg.trade_name ?? '').trim())
        setShowBusinessName(cfg.show_business_name_on_sale_note !== false)
        setShowIgvBreakdown(cfg.show_igv_breakdown_on_sale_note !== false)
      })
      .catch(() => toast.error('Error cargando configuración de notas de venta'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await companyService.updateConfig({
        show_business_name_on_sale_note: showBusinessName,
        show_igv_breakdown_on_sale_note: showIgvBreakdown,
      })
      toast.success('Notas de venta actualizadas')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-transparent" />
      </div>
    )
  }

  return (
    <section className="max-w-3xl space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <FileText size={18} />
        </div>
        <div>
          <h2 className="font-bold text-stone-900">Notas de venta</h2>
          <p className="text-sm text-stone-500">Solo aplica a nota de venta, no a factura/boleta.</p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={showBusinessName}
          onChange={(e) => setShowBusinessName(e.target.checked)}
          className="rounded accent-green-600"
        />
        <span className="text-sm text-stone-700">Mostrar razón social en las notas de venta</span>
      </label>
      <p className="text-xs text-stone-500">
        {showBusinessName
          ? 'Se muestra la razón social tal como hoy.'
          : tradeName
            ? `Se ocultará la razón social; se mostrará el nombre comercial ("${tradeName}") en su lugar.`
            : 'No tiene nombre comercial configurado (Empresa → Datos generales), así que la razón social se seguirá mostrando aunque esta opción esté desactivada.'}
      </p>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={showIgvBreakdown}
          onChange={(e) => setShowIgvBreakdown(e.target.checked)}
          className="rounded accent-green-600"
        />
        <span className="text-sm text-stone-700">Mostrar desglose del IGV en las notas de venta</span>
      </label>
      <p className="text-xs text-stone-500">
        {showIgvBreakdown
          ? 'Se muestran Op. gravadas, IGV y el total, como hoy.'
          : 'Solo se mostrará el total a pagar (y el descuento, si lo hay). Aplica al ticket, al PDF A4, a la vista previa y a la impresión directa.'}
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-rest-600 px-4 py-2 text-sm font-medium text-white hover:bg-rest-700 disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}
