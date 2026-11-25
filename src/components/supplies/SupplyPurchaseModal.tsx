import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useCashSession } from '@/contexts/CashSessionContext'
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch'
import { paymentCatalogService } from '@/services/paymentCatalog.service'
import { suppliesService, type Supply } from '@/services/supplies.service'
import { supplyPurchasesService, type Supplier } from '@/services/supplyPurchases.service'
import { filterOperationalPaymentMethods } from '@/utils/operationalPaymentMethods'
import { idempotencyKeyFor, releaseIdempotencyKey } from '@/utils/idempotencyKey'
import { apiError, formatCost } from '@/utils/supplies'
import { buildPurchaseBody, emptyPurchaseForm, lineBaseCost, purchaseTotal, type PurchaseForm, type PurchaseLineForm } from '@/utils/supplyPurchases'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT, SUPPLY_LABEL, SupplyModalShell } from './SupplyModalShell'
import { SupplierPicker } from './SupplierPicker'

const KEY_SCOPE = 'supply-purchase'

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

type Props = { onClose: () => void; onSaved: () => void }

export function SupplyPurchaseModal({ onClose, onSaved }: Props) {
  const { session, setOpenModal } = useCashSession()
  const [form, setForm] = useState<PurchaseForm>(() => emptyPurchaseForm(today()))
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [methods, setMethods] = useState<{ code: string; name: string }[]>([{ code: 'cash', name: 'Efectivo' }])
  const [saving, setSaving] = useState(false)
  const search = useDebouncedSearch()
  const [found, setFound] = useState<Supply[]>([])
  const set = (patch: Partial<PurchaseForm>) => setForm((f) => ({ ...f, ...patch }))
  const setLine = (index: number, patch: Partial<PurchaseLineForm>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))

  useEffect(() => {
    paymentCatalogService
      .listPaymentMethods()
      .then((list) => {
        const usable = filterOperationalPaymentMethods(list, 'expense')
        if (usable.length > 0) setMethods(usable.map((m) => ({ code: m.code, name: m.name })))
      })
      .catch(() => {})
  }, [])

  const q = search.effectiveQuery
  useEffect(() => {
    if (!q) {
      setFound([])
      return
    }
    let cancelled = false
    suppliesService
      .list({ q, page: 1, per_page: 8, status: 'active' })
      .then((r) => {
        if (!cancelled) setFound(r.data)
      })
      .catch((e) => toast.error(apiError(e, 'No se pudieron buscar insumos')))
    return () => {
      cancelled = true
    }
  }, [q])

  const addSupply = async (s: Supply) => {
    search.setInputValue('')
    setFound([])
    if (form.lines.some((l) => l.supply_id === s.id)) return
    let units: PurchaseLineForm['units'] = []
    try {
      units = (await suppliesService.listUnits(s.id)).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, factor: u.conversion_factor }))
    } catch {
      // sin unidades de compra se compra en la unidad base
    }
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { supply_id: s.id, name: s.name, base_unit: s.unit, sale_unit_id: units[0]?.id ?? 0, units, quantity: '1', total: '' }],
    }))
  }

  const save = async () => {
    const body = buildPurchaseBody({ ...form, supplier_id: supplier?.id ?? 0 })
    if (typeof body === 'string') {
      toast.error(body)
      return
    }
    setSaving(true)
    try {
      await supplyPurchasesService.create(body, idempotencyKeyFor(KEY_SCOPE, body))
      releaseIdempotencyKey(KEY_SCOPE)
      toast.success('Compra registrada')
      onSaved()
    } catch (e) {
      toast.error(apiError(e, 'No se pudo registrar la compra. Si la red falló, vuelve a pulsar: no se duplicará.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SupplyModalShell
      wide
      title="Comprar insumos"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm font-semibold text-stone-800">Total {formatCost(purchaseTotal(form.lines))}</span>
          <button type="button" className={SUPPLY_BTN_GHOST} onClick={onClose}>Cancelar</button>
          <button type="button" className={SUPPLY_BTN_PRIMARY} disabled={saving || session === null} onClick={save}>
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {session === null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>Para registrar una compra necesitas tu caja abierta.</span>
            <button type="button" className="font-semibold underline" onClick={() => setOpenModal(true)}>Abrir caja</button>
          </div>
        )}
        <SupplierPicker selected={supplier} onSelect={setSupplier} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label>
            <span className={SUPPLY_LABEL}>Comprobante</span>
            <select className={SUPPLY_INPUT} value={form.doc_type} onChange={(e) => set({ doc_type: e.target.value })}>
              <option value="FACTURA">Factura</option>
              <option value="BOLETA">Boleta</option>
              <option value="TICKET">Ticket</option>
            </select>
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Serie</span>
            <input className={SUPPLY_INPUT} value={form.series} placeholder="F001" maxLength={10} onChange={(e) => set({ series: e.target.value })} />
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Número</span>
            <input className={SUPPLY_INPUT} value={form.number} inputMode="numeric" maxLength={20} onChange={(e) => set({ number: e.target.value })} />
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Fecha</span>
            <input type="date" className={SUPPLY_INPUT} value={form.issue_date} onChange={(e) => set({ issue_date: e.target.value })} />
          </label>
          <label>
            <span className={SUPPLY_LABEL}>Pago</span>
            <select className={SUPPLY_INPUT} value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value })}>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>{m.name}</option>
              ))}
              <option value="credit">Crédito (por pagar)</option>
            </select>
          </label>
          {form.payment_method === 'credit' && (
            <label>
              <span className={SUPPLY_LABEL}>Vence</span>
              <input type="date" className={SUPPLY_INPUT} value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} />
            </label>
          )}
          <label className="col-span-2 flex items-center gap-2 self-end py-2 text-sm text-stone-700">
            <input type="checkbox" className="h-4 w-4 accent-rest-600" checked={form.price_includes_igv} onChange={(e) => set({ price_includes_igv: e.target.checked })} />
            Los importes incluyen IGV
          </label>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <span className={SUPPLY_LABEL}>Insumos</span>
          <input className={SUPPLY_INPUT} placeholder="Buscar insumo para agregar" value={search.inputValue} onChange={(e) => search.setInputValue(e.target.value)} />
          {found.length > 0 && (
            <ul className="mt-1 divide-y divide-stone-100 rounded-xl border border-stone-200 px-3">
              {found.map((s) => (
                <li key={s.id}>
                  <button type="button" className="w-full py-2 text-left text-sm text-stone-700 hover:text-rest-700" onClick={() => addSupply(s)}>
                    {s.name} <span className="text-xs text-stone-400">{s.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="mt-2 space-y-2">
            {form.lines.map((l, i) => {
              const cost = lineBaseCost(l)
              return (
                <li key={l.supply_id} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-stone-800">{l.name}</p>
                    <button type="button" aria-label={`Quitar ${l.name}`} className="text-red-600" onClick={() => set({ lines: form.lines.filter((_, j) => j !== i) })}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <label className="col-span-2 sm:col-span-1">
                      <span className={SUPPLY_LABEL}>Unidad</span>
                      <select className={SUPPLY_INPUT} value={l.sale_unit_id} onChange={(e) => setLine(i, { sale_unit_id: Number(e.target.value) })}>
                        <option value={0}>{l.base_unit}</option>
                        {l.units.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className={SUPPLY_LABEL}>Cantidad</span>
                      <input className={SUPPLY_INPUT} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                    </label>
                    <label>
                      <span className={SUPPLY_LABEL}>Importe total (S/)</span>
                      <input className={SUPPLY_INPUT} inputMode="decimal" value={l.total} placeholder="0.00" onChange={(e) => setLine(i, { total: e.target.value })} />
                    </label>
                  </div>
                  {cost != null && <p className="mt-1 text-[11px] text-stone-500">{formatCost(cost)} por {l.base_unit}{form.price_includes_igv ? ' (con IGV)' : ''}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </SupplyModalShell>
  )
}
