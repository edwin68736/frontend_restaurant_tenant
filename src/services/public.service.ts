import axios from 'axios'

import { getCentralApiBaseUrl } from './api'

export interface TenantByRucResponse {
  slug: string
  tenant_slug?: string
  name: string
  subdomain?: string
  api_url?: string
  tenant_version?: number
  token_consulta_datos: string
}

export type StoredTenant = {
  slug: string
  name: string
  ruc: string
  apiUrl: string
  tokenConsultaDatos: string
}

/** Cliente sin JWT — solo endpoints públicos en API central (tenant-by-ruc). */
const publicApi = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

publicApi.interceptors.request.use((config) => {
  config.baseURL = getCentralApiBaseUrl()
  return config
})

export const RESTAURANT_STORAGE_KEYS = {
  tenantSlug: 'tenantSlug',
  tenantName: 'tenantName',
  tenantRuc: 'tenantRuc',
  tenantApiUrl: 'tenantApiUrl',
  tokenConsultaDatos: 'tokenConsultaDatos',
} as const

export function getStoredTenant(): StoredTenant | null {
  const slug = localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantSlug)?.trim()
  if (!slug) return null
  return {
    slug,
    name: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantName) || '',
    ruc: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantRuc) || '',
    apiUrl: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tenantApiUrl) || '',
    tokenConsultaDatos: localStorage.getItem(RESTAURANT_STORAGE_KEYS.tokenConsultaDatos) || '',
  }
}

/** Persiste tenant tras validar RUC. Guarda URL del subdominio para todas las peticiones API. */
export function storeTenant(data: TenantByRucResponse, ruc: string) {
  const rucNorm = ruc.replace(/\D/g, '').trim()
  const slug = (data.tenant_slug || data.slug).trim()
  const apiUrl = (data.api_url || '').trim()

  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantSlug, slug)
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantName, data.name)
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantRuc, rucNorm)
  localStorage.setItem(RESTAURANT_STORAGE_KEYS.tokenConsultaDatos, data.token_consulta_datos || '')
  if (apiUrl) {
    localStorage.setItem(RESTAURANT_STORAGE_KEYS.tenantApiUrl, apiUrl)
  }
}

export function clearStoredTenant() {
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantSlug)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantName)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantRuc)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tenantApiUrl)
  localStorage.removeItem(RESTAURANT_STORAGE_KEYS.tokenConsultaDatos)
}

export const publicService = {
  getTenantByRuc: (ruc: string) =>
    publicApi
      .get<TenantByRucResponse>('/api/public/tenant-by-ruc', { params: { ruc: ruc.replace(/\D/g, '').trim() } })
      .then((r) => r.data),
}
