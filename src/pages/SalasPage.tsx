import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { restaurantService, type Floor, type RestaurantTable, type StaffOption } from '@/services/restaurant.service'
import { SearchableSelect } from '@/components/SearchableSelect'
import { TableCardFooter, TableWithChairsVisual } from '@/components/restaurant/TableWithChairsVisual'
import { useOnBranchChange } from '@/contexts/BranchContext'
import { useAuth } from '@/contexts/AuthContext'
import { tableStatusLabel, tableStatusStyles } from '@/utils/tableStatusStyles'
import { PortalModal } from '@/components/ui/PortalModal'

export default function SalasPage() {
  const navigate = useNavigate()
  const { hasPerm } = useAuth()
  const canReassign = hasPerm('s.m')
  const [floors, setFloors] = useState<Floor[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [floorId, setFloorId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState<RestaurantTable | null>(null)
  const [openForm, setOpenForm] = useState({ staff_id: '', guests: 2, notes: '' })
  const [search, setSearch] = useState('')

  const loadSalas = useCallback((fid: number | '' = floorId) => {
    setLoading(true)
    const promises: Promise<unknown>[] = [
      restaurantService.listFloors(),
      restaurantService.listTables(fid === '' ? undefined : Number(fid)),
    ]
    if (canReassign) {
      promises.push(restaurantService.listStaff().then(setStaffList))
    }
    Promise.all(promises)
      .then(([f, t]) => {
        setFloors(f as Floor[])
        setTables(t as RestaurantTable[])
      })
      .catch((e: unknown) => {
        setFloors([])
        setTables([])
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(msg ?? 'No se pudieron cargar salas y mesas')
      })
      .finally(() => setLoading(false))
  }, [floorId, canReassign])

  useEffect(() => {
    loadSalas(floorId)
  }, [floorId, loadSalas])

  useOnBranchChange(() => {
    setFloorId('')
    setSearch('')
    loadSalas('')
  })

  const handleOpenTable = async () => {
    if (!openModal) return
    try {
      const payload: Parameters<typeof restaurantService.openSession>[0] = {
        table_id: openModal.id,
        guests: openForm.guests || 1,
        notes: openForm.notes,
      }
      if (canReassign && openForm.staff_id) {
        payload.staff_id = Number(openForm.staff_id)
      }
      const res = await restaurantService.openSession(payload)
      toast.success('Mesa abierta')
      setOpenModal(null)
      if (floorId === '') {
        restaurantService.listTables(undefined).then(setTables)
      } else {
        restaurantService.listTables(Number(floorId)).then(setTables)
      }
      navigate(`/mesa/${(res as { data: { id: number } }).data.id}`)
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const filteredTables = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tables
    return tables.filter((t) => t.name.toLowerCase().includes(term))
  }, [tables, search])

  const stats = useMemo(() => {
    let libre = 0
    let ocupada = 0
    for (const t of filteredTables) {
      if (t.status === 'libre') libre += 1
      else if (t.status === 'ocupada') ocupada += 1
    }
    return { libre, ocupada, total: filteredTables.length }
  }, [filteredTables])

  const waiterStaff = useMemo(
    () => staffList.filter((s) => ['waiter', 'cashier', 'admin', 'supervisor'].includes(s.employee_type)),
    [staffList],
  )

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      {/*<div className="mb-3 shrink-0">
        <h2 className="text-lg font-bold text-stone-800">Mesas</h2>
        <p className="text-sm text-stone-500">Elige un piso y abre una mesa. El mozo se asigna automáticamente a quien inicia sesión.</p>
      </div>*/}

      <div className="mb-3 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory">
          <button
            type="button"
            onClick={() => setFloorId('')}
            className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              floorId === ''
                ? 'bg-rest-600 text-white border-rest-600'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            Todos
          </button>
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFloorId(f.id)}
              className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                floorId === f.id
                  ? 'bg-rest-600 text-white border-rest-600'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="w-full sm:max-w-lg relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mesa..."
            className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-sm bg-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200 bg-stone-100 text-stone-700 font-medium">
            Total <span className="text-stone-900">{stats.total}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
            Libres <span className="text-emerald-900">{stats.libre}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 font-medium">
            Ocupadas <span className="text-amber-950">{stats.ocupada}</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : floors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500">
          <p>No hay pisos o salas configurados.</p>
          <p className="text-sm mt-2">Crea pisos desde el panel tenant (Módulos → Restaurante → Pisos).</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {filteredTables.map((t) => {
              const st = tableStatusStyles(t.status)
              const clickable =
                (t.status === 'ocupada' && !!t.session_id) || t.status === 'libre'
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (t.status === 'ocupada' && t.session_id) {
                      navigate(`/mesa/${t.session_id}`)
                    } else if (t.status === 'libre') {
                      setOpenModal(t)
                      setOpenForm({ staff_id: '', guests: 2, notes: '' })
                    }
                  }}
                  className={`group relative flex min-w-0 flex-col rounded-xl sm:rounded-2xl border-2 p-2 pt-2.5 pb-2 sm:p-3 sm:pt-3.5 sm:pb-3 transition-all duration-200 text-left ${
                    clickable ? 'cursor-pointer' : 'cursor-default opacity-80'
                  } ${st.card}`}
                >
                  <span
                    className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 sm:px-2 rounded-full ${st.statusChip}`}
                  >
                    {tableStatusLabel(t.status)}
                  </span>

                  <TableWithChairsVisual
                    name={t.name}
                    capacity={t.capacity}
                    status={t.status}
                    size="md"
                    className="my-0.5 sm:my-1"
                  />

                  <p className="text-center font-semibold text-stone-900 text-xs sm:text-sm truncate mt-0.5 sm:mt-1">
                    {t.name}
                  </p>

                  <TableCardFooter
                    floorName={t.floor_name}
                    waiterName={t.status === 'ocupada' ? t.waiter_name : undefined}
                    totalAmount={t.status === 'ocupada' ? t.total_amount : undefined}
                    amountClassName={st.amount}
                  />
                </button>
              )
            })}
          </div>
          {filteredTables.length === 0 && (
            <div className="text-center py-12 text-stone-500">
              <p className="font-medium">No hay mesas</p>
            </div>
          )}
        </>
      )}

      <PortalModal open={!!openModal} onClose={() => setOpenModal(null)} className="max-w-sm">
        {openModal && (
          <div className="bg-white rounded-2xl shadow-xl w-full p-6">
            <h3 className="font-bold text-stone-800 mb-4">Abrir mesa: {openModal.name}</h3>
            <div className="space-y-4">
              {canReassign && (
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Reasignar a otro empleado (opcional)</label>
                  <SearchableSelect
                    value={openForm.staff_id}
                    onChange={(v) => setOpenForm((f) => ({ ...f, staff_id: String(v ?? '') }))}
                    options={[
                      { value: '', label: 'Yo (automático)' },
                      ...waiterStaff.map((w) => ({ value: w.id, label: w.display_name })),
                    ]}
                    searchable={waiterStaff.length > 8}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Comensales</label>
                <input
                  type="number"
                  min={1}
                  value={openForm.guests}
                  onChange={(e) => setOpenForm((f) => ({ ...f, guests: Number(e.target.value) || 1 }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notas</label>
                <input
                  value={openForm.notes}
                  onChange={(e) => setOpenForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Cliente VIP, etc."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setOpenModal(null)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button onClick={handleOpenTable} className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium">
                Abrir mesa
              </button>
            </div>
          </div>
        )}
      </PortalModal>
    </div>
  )
}
