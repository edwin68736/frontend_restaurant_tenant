import api from './api'

export interface Contact {
  id: number
  type: 'customer' | 'supplier' | 'both'
  doc_type: string
  doc_number: string
  business_name: string
  trade_name: string
  address: string
  ubigeo?: string
  phone: string
  email: string
  active: boolean
}

export interface CreateContactInput {
  type: 'customer' | 'supplier' | 'both'
  doc_type: string
  doc_number: string
  business_name: string
  trade_name?: string
  address?: string
  ubigeo?: string
  phone?: string
  email?: string
}

export type ApiRequestOptions = { signal?: AbortSignal }

export const contactsService = {
  list: (
    q = '',
    type = 'customer',
    status: 'active' | 'inactive' | 'all' = 'active',
    options?: ApiRequestOptions,
  ) =>
    api
      .get<{ data?: Contact[] }>('/api/contacts', {
        params: {
          q,
          type: type || undefined,
          status: status === 'active' ? undefined : status,
        },
        signal: options?.signal,
      })
      .then((r) => {
      const raw = r.data
      return Array.isArray(raw) ? raw : (raw?.data ?? [])
    }),
  get: (id: number) =>
    api.get<{ data: Contact }>(`/api/contacts/${id}`).then((r) => r.data?.data ?? r.data),
  create: (data: CreateContactInput) =>
    api.post<{ data: Contact }>('/api/contacts', data).then((r) => r.data.data ?? r.data),
  update: (id: number, data: Partial<CreateContactInput>) =>
    api.put<{ data: Contact }>(`/api/contacts/${id}`, data).then((r) => r.data),
  delete: (id: number) =>
    api.delete(`/api/contacts/${id}`).then((r) => r.data),
  toggle: (id: number) =>
    api.patch(`/api/contacts/${id}/toggle`).then((r) => r.data),
}
