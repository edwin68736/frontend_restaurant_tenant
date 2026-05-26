/** Etiquetas SUNAT para comprobantes impresos / PDF. */
export const SUNAT_TIPO_COMPROBANTE: Record<string, string> = {
  '00': 'NOTA DE VENTA',
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO',
  '08': 'NOTA DE DÉBITO',
}

export function getTipoComprobanteLabel(code: string, docType?: string): string {
  const c = String(code ?? '').trim()
  if (SUNAT_TIPO_COMPROBANTE[c]) return SUNAT_TIPO_COMPROBANTE[c]
  const dt = String(docType ?? '').toLowerCase()
  if (dt.includes('factura')) return 'FACTURA ELECTRÓNICA'
  if (dt.includes('boleta')) return 'BOLETA DE VENTA ELECTRÓNICA'
  if (dt.includes('nota') && dt.includes('venta')) return 'NOTA DE VENTA'
  return docType?.toUpperCase() || 'COMPROBANTE'
}

export function isElectronicSunatCode(code: string): boolean {
  const c = String(code ?? '').trim()
  return c === '01' || c === '03' || c === '07' || c === '08'
}
