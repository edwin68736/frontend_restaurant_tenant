import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Boxes, History, Pencil, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { PageShell } from '@/components/layout/PageShell'
import { SearchInput } from '@/components/SearchInput'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch'
import { suppliesService, type MeasureUnit, type Supply } from '@/services/supplies.service'
import { apiError, formatCost, formatQty, isLowStock } from '@/utils/supplies'
import { SupplyFormModal } from '@/components/supplies/SupplyFormModal'
import { SupplyUnitsModal } from '@/components/supplies/SupplyUnitsModal'
import { SupplyMovementsModal } from '@/components/supplies/SupplyMovementsModal'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SUPPLY_INPUT } from '@/components/supplies/SupplyModalShell'

const PAGE_SIZE = 30

type ModalState = { kind: 'form'; supply: Supply | null } | { kind: 'units'; supply: Supply } | { kind: 'movements'; supply: Supply }

export default function InsumosPage() {
  const { hasPerm } = useAuth()
  const { activeBranchId } = useBranch()
  const canManage = hasPerm('sp.m')
  const canViewCost = hasPerm('rc.c')

  const search = useDebouncedSearch()
  // null = aún no llega al mínimo de letras: se mantiene la lista sin filtrar.
  const q = search.effectiveQuery ?? ''
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Supply[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<MeasureUnit[]>([])
  const [modal, setModal] = useState<ModalState | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    suppliesService
      .list({ q, page, per_page: PAGE_SIZE, status, branch_id: activeBranchId })
      .then((r) => {
        setRows(r.data)
        setTotal(r.total)
      })
      .catch((e) => {
        setRows([])
        setTotal(0)
        toast.error(apiError(e, 'No se pudieron cargar los insumos'))
      })
      .finally(() => setLoading(false))
  }, [q, page, status, activeBranchId])

  useEffect(load, [load])
  useEffect(() => setPage(1), [q, status, activeBranchId])
  useEffect(() => {
    suppliesService
      .unitCatalog()
      // ZZ es la unidad de los servicios: un insumo es un bien.
      .then((list) => setUnits(list.filter((u) => u.code !== 'ZZ')))
      .catch(() => {})
  }, [])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <PageShell
      title="Insumos"
      subtitle="Materia prima de tu cocina y barra. No aparece en la carta ni se vende."
      actions={
        canManage ? (
          <button type="button" className={clsx(SUPPLY_BTN_PRIMARY, 'flex items-center gap-1.5')} onClick={() => setModal({ kind: 'form', supply: null })}>
            <Plus size={16} /> Nuevo insumo
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <SearchInput value={search.inputValue} onChange={search.setInputValue} isSearching={search.isDebouncing} placeholder="Buscar por nombre o código" />
        </div>
        <select aria-label="Estado" className={clsx(SUPPLY_INPUT, 'sm:w-40')} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-stone-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">{q ? 'Sin resultados.' : 'Todavía no hay insumos.'}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-800">{s.name}</p>
                  <p className="truncate text-xs text-stone-500">{s.code} · {s.unit}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={clsx('text-lg font-bold leading-tight', isLowStock(s) ? 'text-red-600' : 'text-stone-800')}>{formatQty(s.stock_total)}</p>
                  <p className="text-[11px] text-stone-500">{s.unit} en stock</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                <span>Mínimo {formatQty(s.min_stock)}</span>
                {s.unit_cost != null && (
                  <>
                    <span>Promedio {s.avg_cost != null ? formatCost(s.avg_cost) : '—'}</span>
                    <span>Último {formatCost(s.unit_cost)}</span>
                  </>
                )}
                {isLowStock(s) && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">Stock bajo</span>}
                {!s.active && <span className="rounded-full bg-stone-100 px-2 py-0.5">Inactivo</span>}
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {canManage && (
                  <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'flex items-center gap-1 !px-2.5 !py-1.5 text-xs')} onClick={() => setModal({ kind: 'form', supply: s })}>
                    <Pencil size={13} /> Editar
                  </button>
                )}
                <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'flex items-center gap-1 !px-2.5 !py-1.5 text-xs')} onClick={() => setModal({ kind: 'units', supply: s })}>
                  <Boxes size={13} /> Unidades
                </button>
                <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'flex items-center gap-1 !px-2.5 !py-1.5 text-xs')} onClick={() => setModal({ kind: 'movements', supply: s })}>
                  <History size={13} /> Movimientos
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" className={SUPPLY_BTN_GHOST} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-xs text-stone-500">{page} / {pages} · {total} insumos</span>
          <button type="button" className={SUPPLY_BTN_GHOST} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
        </div>
      )}

      {modal?.kind === 'form' && (
        <SupplyFormModal
          supply={modal.supply}
          units={units}
          canViewCost={canViewCost}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}
      {modal?.kind === 'units' && <SupplyUnitsModal supply={modal.supply} units={units} canManage={canManage} onClose={() => setModal(null)} />}
      {modal?.kind === 'movements' && <SupplyMovementsModal supply={modal.supply} branchId={activeBranchId} onClose={() => setModal(null)} />}
    </PageShell>
  )
}
