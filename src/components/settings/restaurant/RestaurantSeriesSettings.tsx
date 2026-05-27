import { useEffect, useState } from 'react'
import { FileText, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { companyService, type SeriesRow } from '@/services/company.service'
import { useBranchCheckoutSeries } from '@/contexts/BranchCheckoutSeriesContext'
import { REST_PAGE_MODAL_Z } from '@/utils/restaurantUiLayers'

const CATEGORIES = ['venta', 'compra', 'nota_credito', 'nota_debito', 'guia_remision'] as const
const DOC_TYPES = ['FACTURA', 'BOLETA', 'NOTA DE VENTA', 'NOTA DE CRÉDITO', 'NOTA DE DÉBITO', 'GUÍA DE REMISIÓN']
const SUNAT_CODES = [
  { code: '00', label: '00 - Nota de venta (no SUNAT)' },
  { code: '01', label: '01 - Factura' },
  { code: '03', label: '03 - Boleta' },
  { code: '07', label: '07 - Nota de Crédito' },
  { code: '08', label: '08 - Nota de Débito' },
  { code: '09', label: '09 - Guía de Remisión' },
]

const CATEGORY_LABELS: Record<string, string> = {
  venta: 'Venta',
  compra: 'Compra',
  nota_credito: 'Nota crédito',
  nota_debito: 'Nota débito',
  guia_remision: 'Guía',
}

type FormState = {
  branch_id: number
  doc_type: string
  series: string
  current_number: number
  category: string
  sunat_code: string
}

const emptyForm = (branchId = 0): FormState => ({
  branch_id: branchId,
  doc_type: 'NOTA DE VENTA',
  series: '',
  current_number: 0,
  category: 'venta',
  sunat_code: '00',
})

function normalizeSeries(list: SeriesRow[], branches: { id: number; name: string }[]): SeriesRow[] {
  return (list ?? []).map((s) => ({
    ...s,
    current_number: s.current_number ?? s.correlative ?? 0,
    branch_name: s.branch_name ?? branches.find((b) => b.id === s.branch_id)?.name,
    category: s.category ?? 'venta',
  }))
}

export function RestaurantSeriesSettings() {
  const { invalidateCheckoutSeries } = useBranchCheckoutSeries()
  const [sunatEnabled, setSunatEnabled] = useState(false)
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SeriesRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () =>
    Promise.all([
      companyService.listSeries({ category: filterCategory || undefined }),
      companyService.listBranches(),
      companyService.getSunat(),
    ])
      .then(([s, b, sunat]) => {
        const branchList = b ?? []
        setBranches(branchList)
        setSeries(normalizeSeries(s ?? [], branchList))
        setSunatEnabled(sunat.sunat_enabled ?? false)
      })
      .catch(() => toast.error('Error cargando series'))
      .finally(() => setLoading(false))

  useEffect(() => {
    setLoading(true)
    load()
  }, [filterCategory])

  const sunatOptions = sunatEnabled ? SUNAT_CODES : SUNAT_CODES.filter((o) => o.code === '00')

  const openNew = () => {
    const main = branches.find((b) => b.id) ?? branches[0]
    setEditing(null)
    setForm(sunatEnabled ? emptyForm(main?.id ?? 0) : { ...emptyForm(main?.id ?? 0), sunat_code: '00' })
    setModalOpen(true)
  }

  const openEdit = (s: SeriesRow) => {
    if (!sunatEnabled && (s.sunat_code ?? '01') !== '00') {
      toast.error('Solo puede editar series de nota de venta (00) sin facturación electrónica')
      return
    }
    setEditing(s)
    setForm({
      branch_id: s.branch_id,
      doc_type: s.doc_type,
      series: s.series,
      current_number: s.current_number ?? 0,
      category: s.category,
      sunat_code: (s.sunat_code ?? '01') === '00' || !sunatEnabled ? '00' : (s.sunat_code ?? '01'),
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.series.trim()) {
      toast.error('Serie requerida')
      return
    }
    if (!form.branch_id) {
      toast.error('Selecciona una sucursal')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await companyService.updateSeries(editing.id, {
          series: form.series,
          active: editing.active ?? true,
          doc_type: form.doc_type,
          sunat_code: form.sunat_code || '01',
          category: form.category,
          correlative: form.current_number,
        })
      } else {
        await companyService.createSeries({
          branch_id: form.branch_id,
          doc_type: form.doc_type,
          series: form.series,
          category: form.category,
          sunat_code: form.sunat_code || '01',
        })
      }
      toast.success(editing ? 'Serie actualizada' : 'Serie creada')
      invalidateCheckoutSeries(form.branch_id)
      setModalOpen(false)
      setLoading(true)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rest-50 text-rest-700 flex items-center justify-center">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="font-bold text-stone-900">Series y numeración</h2>
            <p className="text-sm text-stone-600">Comprobantes por sucursal y tipo de documento.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={branches.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
        >
          <Plus size={15} />
          Nueva serie
        </button>
      </div>

      {!sunatEnabled && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Sin facturación electrónica: solo series con código SUNAT 00 (nota de venta).
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {['', ...CATEGORIES].map((c) => (
          <button
            key={c || 'all'}
            type="button"
            onClick={() => setFilterCategory(c)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
              filterCategory === c
                ? 'bg-rest-600 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {c === '' ? 'Todas' : CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50/80 text-left text-xs text-stone-500 uppercase">
                  <th className="px-4 py-2.5">Sucursal</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Serie</th>
                  <th className="px-4 py-2.5">Número</th>
                  <th className="px-4 py-2.5">SUNAT</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {series.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-stone-700">{s.branch_name ?? s.branch_id}</td>
                    <td className="px-4 py-3 text-stone-700">{s.doc_type}</td>
                    <td className="px-4 py-3 font-mono font-medium text-stone-900">{s.series}</td>
                    <td className="px-4 py-3 tabular-nums text-stone-600">{s.current_number}</td>
                    <td className="px-4 py-3 text-stone-600">{s.sunat_code ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-stone-500 hover:text-rest-700 hover:bg-rest-50 rounded-lg"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {series.length === 0 && (
              <p className="text-center py-10 text-stone-400 text-sm">No hay series con este filtro</p>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={`fixed inset-0 ${REST_PAGE_MODAL_Z} flex items-center justify-center bg-black/50 p-4`}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-stone-800">{editing ? 'Editar serie' : 'Nueva serie'}</h3>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Sucursal</label>
              <select
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                value={form.branch_id}
                onChange={(e) => setForm((f) => ({ ...f, branch_id: Number(e.target.value) }))}
                disabled={!!editing}
              >
                <option value={0}>Selecciona...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Categoría</label>
                <select
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Código SUNAT</label>
                <select
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  value={form.sunat_code}
                  onChange={(e) => setForm((f) => ({ ...f, sunat_code: e.target.value }))}
                >
                  {sunatOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Tipo documento</label>
              <select
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                value={form.doc_type}
                onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))}
              >
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Serie *</label>
                <input
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono uppercase"
                  value={form.series}
                  onChange={(e) => setForm((f) => ({ ...f, series: e.target.value.toUpperCase() }))}
                />
              </div>
              {editing && (
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Correlativo actual</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    value={form.current_number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, current_number: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                    }
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
