import { useCallback, useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Layers, X, Search, LayoutGrid } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { restaurantService, type Floor, type RestaurantTable } from '@/services/restaurant.service'
import { SearchableSelect } from '@/components/SearchableSelect'
import { tableStatusLabel, tableStatusStyles } from '@/utils/tableStatusStyles'
import { TableCardFooter, TableWithChairsVisual } from '@/components/restaurant/TableWithChairsVisual'
import { PortalModal } from '@/components/ui/PortalModal'

const PAGE_SIZE = 12

function tableDeleteBlockReason(t: RestaurantTable): string | null {
  if (t.session_id) {
    return 'Tiene un pedido abierto en esta mesa. Ciérrelo o anúlelo antes de eliminarla.'
  }
  if (t.status && t.status !== 'libre') {
    return `La mesa está ${tableStatusLabel(t.status).toLowerCase()}. Debe quedar libre para poder eliminarla.`
  }
  return null
}

export default function MesasPage() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [floorFilter, setFloorFilter] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<RestaurantTable | null>(null)
  const [form, setForm] = useState({ floor_id: 0, name: '', capacity: 4 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      restaurantService.listFloors().then(setFloors),
      restaurantService.listTables(floorFilter || undefined).then(setTables),
    ]).finally(() => setLoading(false))
  }, [floorFilter])

  const [floorsModalOpen, setFloorsModalOpen] = useState(false)
  const [floorForm, setFloorForm] = useState({ id: 0, name: '', sort_order: 0 })
  const [savingFloor, setSavingFloor] = useState(false)

  const openFloorsModal = () => {
    setFloorForm({ id: 0, name: '', sort_order: floors.length })
    setFloorsModalOpen(true)
  }
  const openEditFloor = (f: Floor) => {
    setFloorForm({ id: f.id, name: f.name, sort_order: f.sort_order ?? 0 })
    setFloorsModalOpen(true)
  }
  const saveFloor = async () => {
    if (!floorForm.name.trim()) return
    setSavingFloor(true)
    try {
      if (floorForm.id === 0) {
        await restaurantService.createFloor({ name: floorForm.name.trim(), sort_order: floorForm.sort_order })
        toast.success('Piso creado')
      } else {
        await restaurantService.updateFloor(floorForm.id, { name: floorForm.name.trim(), sort_order: floorForm.sort_order })
        toast.success('Piso actualizado')
      }
      setFloorForm({ id: 0, name: '', sort_order: 0 })
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setSavingFloor(false)
    }
  }
  const deleteFloor = async (id: number) => {
    if (!confirm('¿Eliminar este piso? Las mesas asignadas quedarán sin piso.')) return
    try {
      await restaurantService.deleteFloor(id)
      toast.success('Piso eliminado')
      load()
      if (floorFilter === id) setFloorFilter('')
      setFloorsModalOpen(false)
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => { setPage(1) }, [floorFilter, search])

  const filteredTables = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tables
    return tables.filter((t) => {
      const name = (t.name || '').toLowerCase()
      const floor = (t.floor_name || '').toLowerCase()
      return name.includes(term) || floor.includes(term)
    })
  }, [tables, search])

  const totalPages = Math.max(1, Math.ceil(filteredTables.length / PAGE_SIZE))
  const paginatedTables = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredTables.slice(start, start + PAGE_SIZE)
  }, [filteredTables, page])

  const openCreate = () => {
    setForm({ floor_id: floors[0]?.id ?? 0, name: '', capacity: 4 })
    setModal('create')
  }
  const openEdit = (t: RestaurantTable) => {
    setEditing(t)
    setForm({ floor_id: t.floor_id, name: t.name, capacity: t.capacity })
    setModal('edit')
  }
  const save = async () => {
    try {
      if (modal === 'create') {
        await restaurantService.createTable(form)
        toast.success('Mesa creada')
      } else if (editing) {
        await restaurantService.updateTable(editing.id, { name: form.name, capacity: form.capacity })
        toast.success('Mesa actualizada')
      }
      setModal(null)
      setEditing(null)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }
  const requestDelete = (t: RestaurantTable) => {
    const block = tableDeleteBlockReason(t)
    if (block) {
      toast.error(block)
      return
    }
    setDeleteTarget(t)
  }

  const confirmDeleteTable = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await restaurantService.deleteTable(deleteTarget.id)
      toast.success('Mesa eliminada')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo eliminar la mesa')
    } finally {
      setDeleting(false)
    }
  }

  const toolbar = (
    <>
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-sm bg-white w-[200px] max-w-full shadow-sm"
        />
      </div>
      <div className="min-w-[200px] max-w-full">
        <SearchableSelect
          value={floorFilter === '' ? '' : floorFilter}
          onChange={(v) => setFloorFilter(v == null || String(v) === '' ? '' : Number(v))}
          options={[
            { value: '', label: 'Todos los pisos' },
            ...floors.map((f) => ({ value: f.id, label: f.name })),
          ]}
          placeholder="Todos los pisos"
          searchable={floors.length > 8}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2 shadow-sm"
        />
      </div>
      <button
        type="button"
        onClick={openFloorsModal}
        className="flex items-center gap-2 px-4 py-2 border border-rest-300 text-rest-700 rounded-xl text-sm font-medium hover:bg-rest-50 bg-white shadow-sm"
      >
        <Layers size={16} /> Pisos
      </button>
      <button
        type="button"
        onClick={openCreate}
        className="flex items-center gap-2 px-4 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:bg-rest-700 shadow-md shadow-rest-600/20"
      >
        <Plus size={16} /> Nueva mesa
      </button>
    </>
  )

  return (
    <PageShell title="Mesas" subtitle="Configura las mesas por piso del restaurante" actions={toolbar}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-9 h-9 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTables.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No hay mesas"
          description={
            search.trim()
              ? 'No hay resultados para esta búsqueda. Prueba otro término o limpia el filtro.'
              : 'Crea un piso en el panel tenant y luego agrega mesas aquí para comenzar a operar.'
          }
          action={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-semibold hover:bg-rest-700 shadow-md"
            >
              <Plus size={16} /> Nueva mesa
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {paginatedTables.map((t) => {
              const st = tableStatusStyles(t.status)
              const blockReason = tableDeleteBlockReason(t)
              return (
                <article
                  key={t.id}
                  className={`group relative flex flex-col rounded-2xl border-2 bg-white/95 p-3 sm:p-4 shadow-sm transition-all duration-200 hover:shadow-md ${st.card}`}
                >
                  <span
                    className={`absolute top-2 right-2 z-10 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st.statusChip}`}
                  >
                    {tableStatusLabel(t.status)}
                  </span>

                  <TableWithChairsVisual
                    name={t.name}
                    capacity={t.capacity}
                    status={t.status}
                    size="md"
                    className="mt-1"
                  />

                  <p className="text-center font-semibold text-stone-800 text-sm truncate mt-1 px-1">
                    {t.name}
                  </p>

                  <TableCardFooter floorName={t.floor_name} />

                  <div className="mt-3 flex items-center justify-center gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="inline-flex items-center justify-center gap-1.5 min-w-[2.75rem] p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 hover:border-amber-400 shadow-sm transition-colors"
                      title="Editar mesa"
                      aria-label={`Editar ${t.name}`}
                    >
                      <Pencil size={18} strokeWidth={2.25} />
                      <span className="hidden sm:inline text-xs font-semibold">Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(t)}
                      disabled={!!blockReason}
                      className="inline-flex items-center justify-center gap-1.5 min-w-[2.75rem] p-2.5 rounded-xl bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 hover:border-red-400 shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-red-100"
                      title={blockReason ?? 'Eliminar mesa'}
                      aria-label={`Eliminar ${t.name}`}
                    >
                      <Trash2 size={18} strokeWidth={2.25} />
                      <span className="hidden sm:inline text-xs font-semibold">Eliminar</span>
                    </button>
                  </div>

                  <span className="sr-only">{t.capacity} personas, {tableStatusLabel(t.status)}</span>
                </article>
              )
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-stone-600 min-w-[80px] text-center">
                {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          <p className="text-center text-stone-400 text-sm mt-4">
            {filteredTables.length} mesa{filteredTables.length !== 1 ? 's' : ''}
            {floorFilter ? ` en este piso` : ' en total'}
          </p>
        </>
      )}

      <PortalModal open={floorsModalOpen} onClose={() => setFloorsModalOpen(false)} className="max-w-md">
        <div className="flex max-h-[min(90dvh,800px)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800">Registrar o editar piso</h3>
              <button type="button" onClick={() => setFloorsModalOpen(false)} className="p-1 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nombre del piso</label>
                <input
                  value={floorForm.name}
                  onChange={(e) => setFloorForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ej: Planta baja, Primer piso"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Orden</label>
                <input
                  type="number"
                  min={0}
                  value={floorForm.sort_order}
                  onChange={(e) => setFloorForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={saveFloor}
                disabled={savingFloor || !floorForm.name.trim()}
                className="w-full py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {savingFloor ? 'Guardando...' : floorForm.id ? 'Actualizar piso' : 'Crear piso'}
              </button>
            </div>
            <div className="border-t border-stone-200 pt-3 overflow-y-auto flex-1 min-h-0">
              <p className="text-xs font-medium text-stone-500 mb-2">Pisos existentes</p>
              <ul className="space-y-1">
                {floors.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 py-2 border-b border-stone-100 last:border-0">
                    <span className="text-sm text-stone-700">{f.name}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEditFloor(f)} className="p-1.5 rounded-lg text-stone-500 hover:text-rest-600 hover:bg-rest-50" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => deleteFloor(f.id)} className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
                {floors.length === 0 && <li className="text-sm text-stone-400">No hay pisos. Crea uno arriba.</li>}
              </ul>
            </div>
          </div>
      </PortalModal>

      <PortalModal open={!!deleteTarget} onClose={() => { if (!deleting) setDeleteTarget(null) }} className="max-w-sm">
        {deleteTarget && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <h3 className="font-bold text-stone-800">Eliminar mesa</h3>
            <p className="text-sm text-stone-600 mt-2">
              ¿Eliminar la mesa <span className="font-semibold text-stone-800">{deleteTarget.name}</span>
              {deleteTarget.floor_name ? ` (${deleteTarget.floor_name})` : ''}? Esta acción no se puede deshacer.
            </p>
            <p className="text-xs text-stone-500 mt-2">
              Solo se puede eliminar si está libre y sin pedidos ni operaciones abiertas.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2 border border-stone-200 rounded-xl text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTable()}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        )}
      </PortalModal>

      <PortalModal open={!!modal} onClose={() => { setModal(null); setEditing(null) }} className="max-w-sm">
        {modal && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <h3 className="font-bold text-stone-800 mb-4">{modal === 'create' ? 'Nueva mesa' : 'Editar mesa'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Piso</label>
                <SearchableSelect
                  value={form.floor_id}
                  onChange={(v) => setForm((f) => ({ ...f, floor_id: Number(v) }))}
                  options={floors.map((f) => ({ value: f.id, label: f.name }))}
                  placeholder="Selecciona piso"
                  searchable={floors.length > 8}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nombre / Número</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Mesa 01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Capacidad (sillas)</label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) || 1 }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setModal(null); setEditing(null) }} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">Cancelar</button>
              <button onClick={save} className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium">Guardar</button>
            </div>
          </div>
        )}
      </PortalModal>
    </PageShell>
  )
}
