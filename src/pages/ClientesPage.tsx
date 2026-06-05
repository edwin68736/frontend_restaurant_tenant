import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Eye, EyeOff, RefreshCw, SearchCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { contactsService, type Contact, type CreateContactInput } from '@/services/contacts.service'
import { companyService } from '@/services/company.service'
import { consultaService } from '@/services/consulta.service'
import { SearchableSelect } from '@/components/SearchableSelect'
import { SearchInput } from '@/components/SearchInput'
import { useDebouncedApiSearch } from '@/hooks/useDebouncedApiSearch'
import { PortalModal } from '@/components/ui/PortalModal'
import {
  CONTACT_DOC_TYPES,
  contactDocSelectOptions,
  contactDocSupportsConsulta,
  toContactDocCode,
} from '@/utils/contactDocTypes'

const BTN_ACTION_EDIT =
  'inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0'
const BTN_ACTION_DELETE =
  'inline-flex items-center justify-center p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 shrink-0'

const emptyForm = (): CreateContactInput => ({
  type: 'customer',
  doc_type: '6',
  doc_number: '',
  business_name: '',
  trade_name: '',
  address: '',
  phone: '',
  email: '',
})

export default function ClientesPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<CreateContactInput>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [consultando, setConsultando] = useState(false)
  const [tenantRuc, setTenantRuc] = useState('')
  const [showInactiveOnly, setShowInactiveOnly] = useState(false)
  const [togglingActiveId, setTogglingActiveId] = useState<number | null>(null)

  const { inputValue: searchInput, setInputValue: setSearchInput, loading, isSearching, refresh } =
    useDebouncedApiSearch<Contact[]>({
      cacheScope: 'restaurant-clientes',
      deps: [showInactiveOnly],
      fetcher: (query, signal) =>
        contactsService.list(query, 'customer', showInactiveOnly ? 'inactive' : 'active', { signal }),
      onSuccess: (d) => setContacts(d ?? []),
      onError: () => toast.error('Error al cargar clientes'),
    })

  useEffect(() => {
    companyService.getConfig().then((c) => setTenantRuc(c?.ruc ?? '')).catch(() => setTenantRuc(''))
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setShow(true)
  }

  const openEdit = (c: Contact) => {
    setEditing(c)
    setForm({
      type: 'customer',
      doc_type: toContactDocCode(c.doc_type),
      doc_number: c.doc_number,
      business_name: c.business_name,
      trade_name: c.trade_name ?? '',
      address: c.address ?? '',
      ubigeo: (c as Contact & { ubigeo?: string }).ubigeo ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
    })
    setShow(true)
  }

  const setF = (k: keyof CreateContactInput, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.business_name?.trim() || !form.doc_number?.trim()) {
      toast.error('Nombre o razón social y número de documento son requeridos')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        address: form.address ?? '',
        ubigeo: form.ubigeo || undefined,
        phone: form.phone ?? '',
        email: form.email ?? '',
      }
      if (editing) await contactsService.update(editing.id, payload)
      else await contactsService.create(payload)
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')
      setShow(false)
      refresh()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await contactsService.delete(id)
      toast.success('Cliente eliminado')
      refresh()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error ?? 'Error al eliminar')
    }
  }

  const handleToggle = async (c: Contact) => {
    setTogglingActiveId(c.id)
    try {
      await contactsService.toggle(c.id)
      toast.success(c.active ? 'Cliente desactivado' : 'Cliente activado')
      refresh()
    } catch {
      toast.error('Error al cambiar estado')
    } finally {
      setTogglingActiveId(null)
    }
  }

  const handleConsulta = async () => {
    const docType = toContactDocCode(form.doc_type)
    const num = (form.doc_number ?? '').trim().replace(/-/g, '')
    const isRUC = docType === '6'
    const isDNI = docType === '1'
    if (isRUC && num.length !== 11) {
      toast.error('Ingrese un RUC de 11 dígitos')
      return
    }
    if (isDNI && num.length !== 8) {
      toast.error('Ingrese un DNI de 8 dígitos')
      return
    }
    if (!isRUC && !isDNI) {
      toast.error('La consulta está disponible solo para DNI o RUC')
      return
    }
    if (!tenantRuc || tenantRuc.length !== 11) {
      toast.error('No se pudo obtener el RUC de la empresa')
      return
    }
    setConsultando(true)
    try {
      if (isRUC) {
        const res = await consultaService.ruc(tenantRuc, num)
        if (!res.success || !res.razon_social) {
          toast.error('No se encontró el RUC o el servicio no está disponible')
          return
        }
        setF('business_name', res.razon_social)
        setF('address', res.direccion ?? '')
        if (res.ubigeo && res.ubigeo.length >= 6) setF('ubigeo', res.ubigeo)
      } else {
        const res = await consultaService.dni(tenantRuc, num)
        if (!res.success || !res.nombre_completo) {
          toast.error('No se encontró el DNI o el servicio no está disponible')
          return
        }
        setF('business_name', res.nombre_completo)
      }
      toast.success('Datos obtenidos correctamente')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error ?? 'Error al consultar')
    } finally {
      setConsultando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <div className="mb-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Clientes</h2>
          <p className="text-sm text-stone-500">Gestión de clientes para facturación y ventas</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700"
        >
          <Plus size={18} />
          Nuevo cliente
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          isSearching={isSearching}
          placeholder="Buscar por nombre o documento..."
          className="flex-1 min-w-[180px] max-w-xs"
          inputClassName="text-sm"
        />
        <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none rounded-xl border border-stone-200 bg-white px-3 py-2">
          <span className="text-xs font-medium text-stone-700 whitespace-nowrap">Solo inactivos</span>
          <button
            type="button"
            role="switch"
            aria-checked={showInactiveOnly}
            aria-label="Mostrar solo clientes inactivos"
            onClick={() => setShowInactiveOnly((v) => !v)}
            className={clsx(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
              showInactiveOnly ? 'bg-amber-500' : 'bg-stone-300',
            )}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                showInactiveOnly ? 'translate-x-5' : 'translate-x-1',
              )}
            />
          </button>
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Doc.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Nombre / Razón social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className={clsx(
                    'border-b border-stone-100 hover:bg-stone-50/50',
                    !c.active && 'bg-stone-50/80 opacity-75',
                  )}
                >
                  <td className="px-4 py-3 text-stone-600 text-xs font-mono whitespace-nowrap">
                    {CONTACT_DOC_TYPES.find((d) => d.code === toContactDocCode(c.doc_type))?.label ?? c.doc_type}{' '}
                    {c.doc_number}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800 inline-flex items-center gap-1.5 flex-wrap">
                      {c.business_name}
                      {!c.active && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          Inactivo
                        </span>
                      )}
                    </p>
                    {c.trade_name && <p className="text-xs text-stone-400">{c.trade_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-stone-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-stone-500 truncate max-w-[160px]">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {c.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleToggle(c)}
                        disabled={togglingActiveId === c.id}
                        title={c.active ? 'Desactivar cliente' : 'Activar cliente'}
                        className={clsx(
                          'inline-flex items-center justify-center p-1.5 rounded-lg disabled:opacity-50 shrink-0',
                          c.active
                            ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200',
                        )}
                      >
                        {togglingActiveId === c.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : c.active ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className={BTN_ACTION_EDIT}
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className={BTN_ACTION_DELETE}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {contacts.length === 0 && (
          <div className="text-center py-12 text-stone-500 text-sm">
            {showInactiveOnly
              ? 'No hay clientes inactivos.'
              : 'No hay clientes activos. Agregue uno o active el switch «Solo inactivos» para ver desactivados.'}
          </div>
        )}
      </div>

      {/* Modal Nuevo / Editar cliente */}
      <PortalModal open={show} onClose={() => setShow(false)} className="max-w-lg">
          <div className="bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="text-lg font-bold text-stone-800">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h3>
              <button type="button" onClick={() => setShow(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <span className="sr-only">Cerrar</span>
                <span className="text-stone-500 text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de documento</label>
                  <SearchableSelect
                    value={toContactDocCode(form.doc_type)}
                    onChange={(v) => setF('doc_type', String(v ?? ''))}
                    options={contactDocSelectOptions()}
                    searchable={false}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">N° Documento *</label>
                  {contactDocSupportsConsulta(form.doc_type) ? (
                    <div className="flex border border-stone-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-rest-500">
                      <input
                        className="flex-1 min-w-0 px-3 py-2 border-0 text-sm"
                        value={form.doc_number}
                        onChange={(e) => setF('doc_number', e.target.value)}
                        placeholder={toContactDocCode(form.doc_type) === '6' ? 'RUC 11 dígitos' : 'DNI 8 dígitos'}
                      />
                      <button
                        type="button"
                        onClick={handleConsulta}
                        disabled={consultando || !form.doc_number?.trim()}
                        className="px-3 py-2 border-l border-stone-200 text-sm text-rest-600 hover:bg-rest-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <SearchCheck size={14} className={consultando ? 'animate-pulse' : ''} />
                        {consultando ? '...' : 'Consultar'}
                      </button>
                    </div>
                  ) : (
                    <input
                      className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                      value={form.doc_number}
                      onChange={(e) => setF('doc_number', e.target.value)}
                      placeholder="Número de documento"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Razón social / Nombre *</label>
                  <input
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    value={form.business_name}
                    onChange={(e) => setF('business_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Nombre comercial</label>
                  <input
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    value={form.trade_name ?? ''}
                    onChange={(e) => setF('trade_name', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Dirección</label>
                <input
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  value={form.address ?? ''}
                  onChange={(e) => setF('address', e.target.value)}
                  placeholder="Para facturación electrónica use dirección completa"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Código Ubigeo (6 dígitos, opcional)</label>
                <input
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  value={form.ubigeo ?? ''}
                  onChange={(e) => setF('ubigeo', e.target.value)}
                  placeholder="Ej: 150101"
                  maxLength={6}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Teléfono</label>
                  <input
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    value={form.phone ?? ''}
                    onChange={(e) => setF('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    value={form.email ?? ''}
                    onChange={(e) => setF('email', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-stone-200 flex gap-2 flex-col-reverse sm:flex-row">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
      </PortalModal>
    </div>
  )
}
