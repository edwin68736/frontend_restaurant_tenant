import type { PrintData } from '@/types/printData'
import { getAffectedDocSunatLabel, isCreditOrDebitNote } from '@/constants/sunat'

export interface CreditNoteReferenceLines {
  docTypeLabel: string
  docNumber: string
  reason?: string
}

export function getCreditNoteReference(data: PrintData): CreditNoteReferenceLines | null {
  if (!isCreditOrDebitNote(data.sunat_code, data.doc_type)) return null
  const docNumber = String(data.affected_doc_number ?? '').trim()
  if (!docNumber) return null
  const docTypeLabel = getAffectedDocSunatLabel(String(data.affected_doc_sunat_code ?? '').trim())
  const reason = String(data.credit_note_reason ?? '').trim()
  return { docTypeLabel, docNumber, reason: reason || undefined }
}
