import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { PageShell } from '@/components/layout/PageShell'
import { useBranch } from '@/contexts/BranchContext'
import { supplyPurchasesService, type SupplyPurchase } from '@/services/supplyPurchases.service'
import { apiError, formatCost, formatQty } from '@/utils/supplies'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SupplyModalShell } from '@/components/supplies/SupplyModalShell'
import { SupplyPurchaseModal } from '@/components/supplies/SupplyPurchaseModal'

const PAGE_SIZE = 30

export default function ComprasInsumosPage() {
  const { activeBranchId } = useBranch()
  const [rows, setRows] = useState<SupplyPurchase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<SupplyPurchase | null>(null)
  const [voiding, setVoiding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    supplyPurchasesService
      .list(page)
      .then((r) => {
        setRows(r.data)
        setTotal(r.total)
      })
      .catch((e) => {
        setRows([])
        setTotal(0)
        toast.error(apiError(e, 'No se pudieron cargar las compras'))
      })
      .finally(() => setLoading(false))
  }, [page, activeBranchId])

  useEffect(load, [load])

  const open = (p: SupplyPurchase) =>
    supplyPurchasesService
      .get(p.id)
      .then(setDetail)
      .catch((e) => toast.error(apiError(e, 'No se pudo abrir la compra')))

  const voidPurchase = async () => {
    if (!detail || !window.confirm('¿Anular esta compra? Se revierte el stock y el pago.')) return
    setVoiding(true)
    try {
      await supplyPurchasesService.void(detail.id)
      toast.success('Compra anulada')
      setDetail(null)
      load()
    } catch (e) {
      toast.error(apiError(e, 'No se pudo anular la compra'))
    } finally {
      setVoiding(false)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const cancelled = (p: SupplyPurchase) => p.status === 'cancelled'

  return (
    <PageShell
      title="Compras de insumos"
      subtitle="Lo que compras para tu cocina y barra. Cada compra suma stock y actualiza el costo."
      actions={
        <button type="button" className={clsx(SUPPLY_BTN_PRIMARY, 'flex items-center gap-1.5')} onClick={() => setCreating(true)}>
          <Plus size={16} /> Nueva compra
        </button>
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-stone-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">Todavía no hay compras en esta sucursal.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {rows.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-50" onClick={() => open(p)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{p.supplier || 'Sin proveedor'}</p>
                  <p className="text-xs text-stone-500">{p.issue_date} · {p.series}-{p.number}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={clsx('text-sm font-semibold', cancelled(p) ? 'text-stone-400 line-through' : 'text-stone-800')}>{formatCost(p.total)}</p>
                  {cancelled(p) && <span className="text-[11px] text-red-600">Anulada</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" className={SUPPLY_BTN_GHOST} disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Anterior</button>
          <span className="text-xs text-stone-500">{page} / {pages}</span>
          <button type="button" className={SUPPLY_BTN_GHOST} disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>Siguiente</button>
        </div>
      )}

      {creating && (
        <SupplyPurchaseModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setPage(1)
            load()
          }}
        />
      )}

      {detail && (
        <SupplyModalShell
          title={`${detail.series}-${detail.number}`}
          subtitle={`${detail.supplier} · ${detail.issue_date}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              <span className="mr-auto self-center text-sm font-semibold text-stone-800">Total {formatCost(detail.total)}</span>
              {!cancelled(detail) && (
                <button type="button" className={clsx(SUPPLY_BTN_GHOST, '!text-red-700')} disabled={voiding} onClick={voidPurchase}>
                  {voiding ? 'Anulando…' : 'Anular compra'}
                </button>
              )}
            </>
          }
        >
          <ul className="divide-y divide-stone-100">
            {(detail.lines ?? []).map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-stone-800">{l.name}</p>
                  <p className="text-xs text-stone-500">{formatQty(l.quantity)} {l.unit}</p>
                </div>
                <p className="shrink-0 text-sm font-medium text-stone-800">{formatCost(l.line_total)}</p>
              </li>
            ))}
          </ul>
          {cancelled(detail) && <p className="mt-2 text-sm text-red-600">Esta compra está anulada.</p>}
        </SupplyModalShell>
      )}
    </PageShell>
  )
}
