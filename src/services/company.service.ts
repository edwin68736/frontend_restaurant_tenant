import api from './api'

export interface CompanyConfig {
  business_name: string
  trade_name: string
  ruc: string
  address: string
  ubigeo?: string
  phone: string
  email: string
  currency: string
  tax_rate?: number
  logo_url: string
  color_theme?: string
  additional_notes?: string
  wallet_provider?: string
  wallet_phone?: string
  wallet_qr_url?: string
  wallet_show_on_a4?: boolean
  wallet_show_on_ticket?: boolean
}

export interface SunatConfig {
  sunat_enabled: boolean
  tax_rate: number
  igv_regime: string
  tax_benefit_zone: boolean
}

export interface BranchRow {
  id: number
  name: string
  address: string
  phone: string
  fiscal_domicile_code?: string
  is_main: boolean
  active?: boolean
}

export interface SeriesRow {
  id: number
  branch_id: number
  branch_name?: string
  doc_type: string
  series: string
  current_number: number
  correlative?: number
  category: string
  active?: boolean
  sunat_code?: string
  locked?: boolean
  sales_count?: number
  can_delete?: boolean
}

export const companyService = {
  getConfig: (): Promise<CompanyConfig> =>
    api.get<CompanyConfig>('/api/company/config').then((r) => r.data),

  updateConfig: (data: Partial<CompanyConfig>) =>
    api.put<{ success: boolean; data: CompanyConfig }>('/api/company/config', data).then((r) => r.data),

  updateReceiptWallet: (data: {
    wallet_provider: string
    wallet_phone: string
    wallet_qr_url: string
    wallet_show_on_a4: boolean
    wallet_show_on_ticket: boolean
  }) => api.put<{ success: boolean; data: CompanyConfig }>('/api/company/receipt-wallet', data).then((r) => r.data),

  /** Sube QR a disco del tenant (VPS: volumen /app/uploads). Devuelve URL /uploads/... */
  uploadReceiptWalletQr: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api
      .post<{ success: boolean; wallet_qr_url: string }>('/api/company/receipt-wallet/qr', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  getSunat: (): Promise<SunatConfig> =>
    api.get<SunatConfig>('/api/company/sunat').then((r) => r.data),

  updateSunat: (data: Pick<SunatConfig, 'tax_rate' | 'igv_regime' | 'tax_benefit_zone'>) =>
    api.put('/api/company/sunat', data).then((r) => r.data),

  listBranches: (): Promise<BranchRow[]> =>
    api.get<{ data: BranchRow[] }>('/api/company/branches').then((r) => r.data.data ?? []),

  createBranch: (data: { name: string; address: string; phone: string; fiscal_domicile_code?: string; is_main: boolean }) =>
    api.post('/api/company/branches', data).then((r) => r.data),

  updateBranch: (id: number, data: Partial<BranchRow>) =>
    api.put(`/api/company/branches/${id}`, data).then((r) => r.data),

  deleteBranch: (id: number) => api.delete(`/api/company/branches/${id}`).then((r) => r.data),

  listSeries: (params?: { branch_id?: number; category?: string }) =>
    api.get<{ data: SeriesRow[] }>('/api/company/series', { params }).then((r) => r.data.data ?? []),

  createSeries: (data: {
    branch_id: number
    doc_type: string
    series: string
    category: string
    sunat_code: string
  }) => api.post('/api/company/series', data).then((r) => r.data),

  updateSeries: (
    id: number,
    data: {
      series: string
      active: boolean
      doc_type: string
      sunat_code: string
      category: string
      correlative?: number
    },
  ) => api.put(`/api/company/series/${id}`, data).then((r) => r.data),

  deleteSeries: (id: number) => api.delete(`/api/company/series/${id}`).then((r) => r.data),
}

/** Serie por defecto en POS/checkout: nota de venta (SUNAT 00). */
export function pickDefaultNotaVentaSeries<T extends { id: number; doc_type: string; sunat_code?: string }>(
  list: T[],
): T | null {
  if (!list.length) return null
  const bySunat = list.find((s) => {
    const code = String(s.sunat_code ?? '').trim()
    if (code === '00') return true
    if (code) return false
    const d = String(s.doc_type ?? '').toLowerCase().replace(/\s+/g, '')
    return (d.includes('nota') && d.includes('venta') && !d.includes('credito')) || d === 'notadeventa'
  })
  if (bySunat) return bySunat
  const byDoc = list.find((s) => {
    const d = String(s.doc_type ?? '').toLowerCase().replace(/\s+/g, '')
    return (d.includes('nota') && d.includes('venta') && !d.includes('credito')) || d === 'notadeventa'
  })
  if (byDoc) return byDoc
  return list[0] ?? null
}

export function sortSeriesNotaVentaFirst<T extends { doc_type: string; sunat_code?: string; series?: string }>(
  list: T[],
): T[] {
  const rank = (s: T) => {
    if (String(s.sunat_code ?? '').trim() === '00') return 0
    const d = String(s.doc_type ?? '').toLowerCase().replace(/\s+/g, '')
    if ((d.includes('nota') && d.includes('venta') && !d.includes('credito')) || d === 'notadeventa') return 1
    return 5
  }
  return [...list].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    return `${a.doc_type} ${a.series ?? ''}`.localeCompare(`${b.doc_type} ${b.series ?? ''}`)
  })
}
