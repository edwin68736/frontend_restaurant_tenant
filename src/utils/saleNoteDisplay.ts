import type { PrintData } from '@/types/printData'

/** Nota de venta = código SUNAT 00 (documento interno). Los ajustes de «Notas de venta» no afectan a boleta ni factura. */
export function isSaleNotePrint(data: Pick<PrintData, 'sunat_code'>): boolean {
  return String(data.sunat_code ?? '').trim() === '00'
}

/**
 * ¿Se oculta el desglose (Op. gravadas / IGV)? Dos motivos distintos:
 *  - régimen tributario (Nuevo RUS): no discrimina IGV en ningún comprobante;
 *  - ajuste propio de la empresa para notas de venta (Ajustes → Comprobantes → Notas de venta).
 * `bySaleNoteOnly`: solo por el ajuste de nota de venta; en ese caso el descuento (si lo hay) sigue visible para que el total cuadre.
 */
export function receiptBreakdownVisibility(data: Pick<PrintData, 'sunat_code' | 'company'>): {
  hide: boolean
  bySaleNoteOnly: boolean
} {
  const byRegime = data.company?.show_igv_breakdown === false
  const bySaleNote = isSaleNotePrint(data) && data.company?.show_igv_breakdown_on_sale_note === false
  return { hide: byRegime || bySaleNote, bySaleNoteOnly: bySaleNote && !byRegime }
}

/**
 * En una nota de venta con «Mostrar razón social» apagado se imprime solo el nombre comercial. Sin nombre comercial no hay con qué
 * reemplazarla, así que la razón social se sigue mostrando.
 */
export function hideBusinessNameOnSaleNote(
  data: Pick<PrintData, 'sunat_code' | 'company'>,
  tradeName: string | undefined | null,
): boolean {
  return isSaleNotePrint(data) && data.company?.show_business_name_on_sale_note === false && Boolean(String(tradeName ?? '').trim())
}
