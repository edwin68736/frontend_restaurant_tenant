import axios from 'axios'

import { getApiBaseUrl } from './api'

export interface TenantByRucResponse {
  slug: string
  name: string
  token_consulta_datos: string
}

export type StoredTenant = {
  slug: string
  name: string
  ruc: string
  tokenConsultaDatos: string
}

/** Cliente sin JWT — solo endpoints públicos (tenant-by-ruc). */
const publicApi = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

publicApi.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

export const RESTAURANT_STORAGE_KEYS = {
  tenantSlug: 'tenantSlug',
  tenantName: 'tenantName',
  tenantRuc: 'tenantRuc',
  tokenConsultaDatos: 'tokenConsultaDatos',
} as const

export function getStoredTenant(): StoredTenant | null {
  const slug = localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantSlug)?.trim()
  if (!slug) return null
  return {
    slug,
    name: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantName) || '',
    ruc: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantRuc) || '',
    tokenConsultaDatos: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tokenConsultaDatos) || '',
  }
}

/** Persiste tenant tras validar RUC (obligatorio antes de login y API autenticada). */
export function storeTenant(data: TenantByRucResponse, ruc: string) {
  const rucNorm = ruc.replace(/\D/g, '').trim()
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantSlug, data.slug.trim())
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantName, data.name)
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantRuc, rucNorm)
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tokenConsultaDatos, data.token_consulta_datos || '')
}

export function clearStoredTenant() {
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantSlug)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantName)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantRuc)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tokenConsultaDatos)
}

export const publicService = {
  getTenantByRuc: (ruc: string) =>
    publicApi
      .get<TenantByRucResponse>('/api/public/tenant-by-ruc', { params: { ruc: ruc.replace(/\D/g, '').trim() } })
      .then((r) => r.data),
}
