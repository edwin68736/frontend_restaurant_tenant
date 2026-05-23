import api from './api'

export interface OpenCashSessionRow {
  id: number
  branch_id: number
  user_id: number
  user_name: string
  opening_balance: number
  current_balance: number
  opened_at: string
  register_code?: string | null
  register_name?: string | null
}

export interface CashSession {
  id: number
  branch_id: number
  branch_name?: string
  register_code?: string | null
  register_name?: string | null
  opened_by: number
  opening_balance: number
  closing_balance: number | null
  expected_balance: number | null
  difference: number | null
  arqueo_json?: string | null
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
  notes?: string
}

export interface CashMovement {
  id: number
  session_id?: number
  cash_session_id?: number
  type: 'income' | 'expense'
  category: string
  reference: string
  payment_method?: string
  amount: number
  notes?: string
  created_at: string
}

export interface BankAccount {
  id: number
  name: string
  bank_name: string
  account_number: string
  currency: string
  balance: number
  type: string
  payment_method: string
  active: boolean
}

export interface BankMovement {
  id: number
  account_id?: number
  bank_account_id?: number
  type: 'credit' | 'debit'
  description: string
  reference: string
  amount: number
  date: string
  created_at: string
}

export interface PaymentMethodRecord {
  id: number
  name: string
  code: string
  destination_type: 'cash' | 'bank_account'
  bank_account_id: number | null
  is_system: boolean
  sort_order: number
  active: boolean
}

export interface CashSessionReportSession {
  id: number
  branch_id: number
  branch_name: string
  opened_by_user_id: number
  opened_by_user_name: string
  opened_at: string
  closed_at: string | null
  opening_balance: number
  closing_balance: number | null
  status: string
  /** Notas de apertura y, si aplica, de cierre (separador interno `\n\n[Notas de cierre]\n`) */
  notes?: string
}

export interface IncomeDetailRow {
  date: string
  type: string
  doc_number: string
  reference: string
  amount: number
  payment_method: string
}

export interface ExpenseDetailRow {
  date: string
  type: string
  doc_number: string
  reference: string
  amount: number
  payment_method: string
}

export interface MethodTotal {
  method: string
  total: number
}

export interface CashSessionReport {
  session: CashSessionReportSession
  income_detail: IncomeDetailRow[]
  expense_detail: ExpenseDetailRow[]
  totals_by_method: {
    sales: MethodTotal[]
    purchases: MethodTotal[]
    movements: MethodTotal[]
  }
  totals: {
    total_income: number
    total_expense: number
    total_sales: number
    total_purchases: number
    final_balance: number
  }
}

export const cashbankService = {
  listSessions: (branch_id?: number): Promise<CashSession[]> =>
    api.get('/api/cashbank/sessions', { params: { branch_id } }).then((r) => r.data.data ?? []),

  getOpenSession: async (branch_id?: number): Promise<CashSession | null> => {
    try {
      const r = await api.get<{ data: CashSession | null; open?: boolean }>('/api/cashbank/sessions/open', {
        params: branch_id && branch_id > 0 ? { branch_id } : undefined,
      })
      return r.data?.data != null ? r.data.data : null
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 403 || status === 401) throw e
      return null
    }
  },

  listOpenSessionsInBranch: (branch_id: number): Promise<OpenCashSessionRow[]> =>
    api
      .get('/api/cashbank/sessions/open/list', { params: { branch_id } })
      .then((r) => r.data.data ?? []),

  openSession: (data: { branch_id: number; opening_balance: number; notes?: string }): Promise<CashSession> =>
    api.post('/api/cashbank/sessions', data).then((r) => r.data.data ?? r.data),

  closeSession: (
    id: number,
    data?: { closing_balance?: number; notes?: string; arqueo?: Record<string, number> }
  ): Promise<CashSession> =>
    api.post(`/api/cashbank/sessions/${id}/close`, data ?? {}).then((r) => r.data.data ?? r.data),

  getSession: (id: number): Promise<CashSession> =>
    api.get(`/api/cashbank/sessions/${id}`).then((r) => r.data.data ?? r.data),

  saveArqueo: (id: number, arqueo: Record<string, number>): Promise<{ sum: number }> =>
    api.post(`/api/cashbank/sessions/${id}/arqueo`, { arqueo }).then((r) => r.data),

  listMovements: (sessionId: number): Promise<CashMovement[]> =>
    api.get(`/api/cashbank/sessions/${sessionId}/movements`).then((r) => r.data.data ?? r.data ?? []),

  addMovement: (
    sessionId: number,
    data: {
      type: 'income' | 'expense'
      category: string
      reference?: string
      payment_method?: string
      amount: number
      notes?: string
    }
  ): Promise<CashMovement> => api.post(`/api/cashbank/sessions/${sessionId}/movements`, data).then((r) => r.data.data ?? r.data),

  getSessionReport: (sessionId: number): Promise<CashSessionReport> =>
    api.get(`/api/cashbank/sessions/${sessionId}/report`).then((r) => r.data.data ?? r.data),

  listBankAccounts: (all?: boolean): Promise<BankAccount[]> =>
    api.get('/api/cashbank/bank-accounts', { params: all ? { all: '1' } : {} }).then((r) => r.data.data ?? []),

  getBankAccount: (id: number): Promise<BankAccount> =>
    api.get(`/api/cashbank/bank-accounts/${id}`).then((r) => r.data.data ?? r.data),

  createBankAccount: (data: {
    name: string
    bank_name: string
    account_number: string
    currency: string
    type: string
    payment_method: string
    initial_balance: number
  }): Promise<BankAccount> => api.post('/api/cashbank/bank-accounts', data).then((r) => r.data.data ?? r.data),

  updateBankAccount: (
    id: number,
    data: {
      name: string
      bank_name: string
      account_number: string
      type: string
      payment_method: string
      active: boolean
    }
  ): Promise<{ success: boolean }> => api.put(`/api/cashbank/bank-accounts/${id}`, data).then((r) => r.data),

  listBankMovements: (accountId: number): Promise<BankMovement[]> =>
    api.get(`/api/cashbank/bank-accounts/${accountId}/movements`).then((r) => r.data.data ?? r.data ?? []),

  addBankMovement: (
    accountId: number,
    data: { type: 'credit' | 'debit'; description: string; reference?: string; amount: number; date: string }
  ): Promise<{ success: boolean }> => api.post(`/api/cashbank/bank-accounts/${accountId}/movements`, data).then((r) => r.data),

  listPaymentMethods: (all?: boolean): Promise<PaymentMethodRecord[]> =>
    api
      .get('/api/cashbank/payment-methods', { params: all ? { all: '1' } : {} })
      .then((r) => r.data.data ?? [])
      .catch(() => []),

  getPaymentMethod: (id: number): Promise<PaymentMethodRecord> =>
    api.get(`/api/cashbank/payment-methods/${id}`).then((r) => r.data.data ?? r.data),

  createPaymentMethod: (data: {
    name: string
    code: string
    destination_type: 'cash' | 'bank_account'
    bank_account_id?: number | null
  }): Promise<PaymentMethodRecord> => api.post('/api/cashbank/payment-methods', data).then((r) => r.data.data ?? r.data),

  updatePaymentMethod: (
    id: number,
    data: {
      name: string
      code: string
      destination_type: 'cash' | 'bank_account'
      bank_account_id?: number | null
      active: boolean
    }
  ): Promise<{ success: boolean }> => api.put(`/api/cashbank/payment-methods/${id}`, data).then((r) => r.data),

  deletePaymentMethod: (id: number): Promise<{ success: boolean }> =>
    api.delete(`/api/cashbank/payment-methods/${id}`).then((r) => r.data),
}
