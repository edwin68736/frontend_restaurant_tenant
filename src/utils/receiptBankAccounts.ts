/** Interpreta receipt_bank_account_ids del API (JSON string o array). null = sin filtro (todas). */
export function parseReceiptBankAccountIds(raw: unknown): number[] | null {
  if (raw == null || raw === '') return null
  if (Array.isArray(raw)) {
    const ids = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    return ids
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s) as unknown
      if (!Array.isArray(parsed)) return null
      return parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    } catch {
      return null
    }
  }
  return null
}
