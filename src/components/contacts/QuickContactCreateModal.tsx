import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { PortalModal } from '@/components/ui/PortalModal'
import { SearchableSelect } from '@/components/SearchableSelect'
import { contactsService, type Contact, type CreateContactInput } from '@/services/contacts.service'
import { companyService } from '@/services/company.service'
import { consultaService } from '@/services/consulta.service'
import {
  contactDocConsultMinLength,
  contactDocNumberPlaceholder,
  contactDocSelectOptions,
  contactDocSupportsConsulta,
  sanitizeContactDocNumber,
  toContactDocCode,
} from '@/utils/contactDocTypes'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (contact: Contact) => void
  /** Tipo de documento inicial (p. ej. "6" para factura). */
  defaultDocType?: string
}

const emptyForm = (docType = '6') => ({
  doc_type: toContactDocCode(docType),
  doc_number: '',
  business_name: '',
  address: '',
})

export function QuickContactCreateModal({ open, onClose, onCreated, defaultDocType = '6' }: Props) {
  const [form, setForm] = useState(() => emptyForm(defaultDocType))
  const [consultaLoading, setConsultaLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    if (open) setForm(emptyForm(defaultDocType))
  }, [open, defaultDocType])

  const handleConsulta = async () => {
    const ruc = (await companyService.getConfig()).ruc
    if (!ruc) {
      toast.error('No se pudo obtener RUC de la empresa')
      return
    }
    setConsultaLoading(true)
    try {
      const docCode = toContactDocCode(form.doc_type)
      if (docCode === '6') {
        const res = await consultaService.ruc(ruc, form.doc_number)
        if (res.success) {
          setForm((q) => ({
            ...q,
            business_name: res.razon_social ?? '',
            address: res.direccion_completa ?? res.direccion ?? '',
          }))
          toast.success('Datos obtenidos')
        } else toast.error('RUC no encontrado')
      } else {
        const res = await consultaService.dni(ruc, form.doc_number)
        if (res.success) {
          setForm((q) => ({
            ...q,
            business_name: res.nombre_completo ?? '',
            address: '',
          }))
          toast.success('Datos obtenidos')
        } else toast.error('DNI no encontrado')
      }
    } catch {
      toast.error('Error al consultar')
    } finally {
      setConsultaLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!form.business_name.trim() || !form.doc_number.trim()) return
    setCreateLoading(true)
    try {
      const data: CreateContactInput = {
        type: 'customer',
        doc_type: toContactDocCode(form.doc_type),
        doc_number: form.doc_number.trim(),
        business_name: form.business_name.trim(),
        address: form.address || undefined,
      }
      const created = await contactsService.create(data)
      toast.success('Cliente registrado')
      onCreated(created)
      onClose()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <PortalModal open={open} onClose={onClose} className="max-w-md" stacked>
      <div className="bg-white rounded-2xl shadow-xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-800">Registrar cliente</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[9.5rem] shrink-0">
              <SearchableSelect
                value={toContactDocCode(form.doc_type)}
                onChange={(v) =>
                  setForm((q) => ({
                    ...q,
                    doc_type: String(v ?? '6'),
                    doc_number: '',
                  }))
                }
                options={contactDocSelectOptions()}
                searchable={false}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
              />
            </div>
            <input
              type="text"
              value={form.doc_number}
              onChange={(e) =>
                setForm((q) => ({
                  ...q,
                  doc_number: sanitizeContactDocNumber(q.doc_type, e.target.value),
                }))
              }
              placeholder={contactDocNumberPlaceholder(form.doc_type)}
              className="flex-1 min-w-[6rem] border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
            {contactDocSupportsConsulta(form.doc_type) && (
              <button
                type="button"
                onClick={() => void handleConsulta()}
                disabled={consultaLoading || form.doc_number.length < contactDocConsultMinLength(form.doc_type)}
                className="px-3 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 disabled:opacity-50"
              >
                {consultaLoading ? '...' : 'Consultar'}
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Razón social / Nombre</label>
            <input
              value={form.business_name}
              onChange={(e) => setForm((q) => ({ ...q, business_name: e.target.value }))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Obligatorio"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Dirección (opcional)</label>
            <input
              value={form.address}
              onChange={(e) => setForm((q) => ({ ...q, address: e.target.value }))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={createLoading || !form.business_name.trim() || !form.doc_number.trim()}
            onClick={() => void handleCreate()}
            className="flex-1 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {createLoading ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
