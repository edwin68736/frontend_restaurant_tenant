import api from './api'

export interface InvoiceInfo {
  id: number
  sale_id: number
  xml_url: string
  pdf_url: string
  cdr_url: string
  sunat_response?: string
  sunat_message?: string
  sunat_status: string
  sunat_cdr_code?: string
  sunat_cdr_notes?: string
  pipeline_status?: string
  sunat_hash?: string
}

export interface BillingStatusResponse {
  status: string
  sunat_code: string
  cdr_received: boolean
  sunat_message: string
  xml_signed: boolean
  safe_to_print: boolean
  last_attempt_at: string
  retry_count: number
  job_status: string
  billing_status: string
  pipeline_status: string
  async_in_progress: boolean
}

export type ManualBillingStatus =
  | 'accepted'
  | 'rejected'
  | 'error'
  | 'processing'
  | 'already_accepted'
  | 'queued'

export interface BillingResult {
  status?: ManualBillingStatus
  success: boolean
  async?: boolean
  safe_to_print?: boolean
  billing_status?: string
  sunat_message?: string
  status_detail?: BillingStatusResponse
  invoice?: unknown
  message?: string
}

/** Envío manual síncrono: el backend puede esperar hasta ~90s la respuesta SUNAT. */
const MANUAL_BILLING_TIMEOUT_MS = 120_000

export const billingService = {
  getInvoice: (saleId: number): Promise<InvoiceInfo> =>
    api.get(`/api/billing/invoice/${saleId}`).then((r) => r.data),

  getStatus: (saleId: number): Promise<BillingStatusResponse> =>
    api.get(`/api/billing/status/${saleId}`).then((r) => r.data),

  send: (saleId: number): Promise<BillingResult> =>
    api.post(`/api/billing/send/${saleId}`, undefined, { timeout: MANUAL_BILLING_TIMEOUT_MS }).then((r) => r.data),

  resend: (saleId: number): Promise<BillingResult & { invoice?: unknown }> =>
    api.post(`/api/billing/resend/${saleId}`, undefined, { timeout: MANUAL_BILLING_TIMEOUT_MS }).then((r) => r.data),

  downloadDocument: async (saleId: number, kind: 'xml' | 'xml-generated' | 'cdr' | 'pdf'): Promise<void> => {
    const res = await api.get(`/api/billing/invoice/${saleId}/document/${kind}`, { responseType: 'blob' })
    const contentDisp = res.headers?.['content-disposition'] as string | undefined
    let name = 'comprobante'
    if (kind === 'cdr') name = 'comprobante.cdr.zip'
    else if (kind === 'pdf') name = 'comprobante.pdf'
    else if (kind === 'xml-generated') name = 'comprobante-generado.xml'
    else name = 'comprobante-enviado.xml'
    if (contentDisp) {
      const match = contentDisp.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i)
      if (match?.[1]) name = match[1].trim().replace(/^"|"$/g, '')
    }
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  },

  viewPdf: async (saleId: number): Promise<void> => {
    const res = await api.get(`/api/billing/invoice/${saleId}/document/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },

  getPdfObjectUrl: async (saleId: number): Promise<string> => {
    try {
      const res = await api.get(`/api/billing/invoice/${saleId}/document/pdf`, { responseType: 'blob' })
      if (!(res.data instanceof Blob) || res.data.size === 0) throw new Error('PDF no disponible')
      return URL.createObjectURL(res.data)
    } catch (e: any) {
      if (e?.response?.status === 404) throw new Error('PDF no disponible')
      throw e
    }
  },

  getXmlText: async (saleId: number, kind: 'xml' | 'xml-generated'): Promise<string> => {
    try {
      const res = await api.get(`/api/billing/invoice/${saleId}/document/${kind}`, { responseType: 'blob' })
      if (!(res.data instanceof Blob) || res.data.size === 0) throw new Error('XML no disponible')
      return await (res.data as Blob).text()
    } catch (e: any) {
      if (e?.response?.status === 404) throw new Error('XML no disponible')
      throw e
    }
  },

  voidWithCreditNote: (saleId: number, reason: string): Promise<{ success: boolean; message?: string; nc_sale?: unknown }> =>
    api.post(`/api/billing/void-with-credit-note/${saleId}`, { reason }).then((r) => r.data),
}
