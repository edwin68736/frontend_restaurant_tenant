/** Ingreso o egreso de caja según el tipo devuelto por el reporte de movimientos. */
export function movementFlowLabel(type?: string | null): 'Ingreso' | 'Egreso' {
  const t = (type ?? '').trim().toLowerCase()
  if (
    t === 'income' ||
    t === 'ingreso' ||
    t === 'ingreso_manual' ||
    t === 'venta'
  ) {
    return 'Ingreso'
  }
  return 'Egreso'
}

export function movementFlowBadgeClass(type?: string | null): string {
  return movementFlowLabel(type) === 'Ingreso'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'
}

/** Etiqueta legible del subtipo (venta, compra, manual…). */
export function movementSubtypeLabel(type?: string | null): string {
  const t = (type ?? '').trim().toLowerCase()
  const map: Record<string, string> = {
    venta: 'Venta',
    compra: 'Compra',
    anulacion_venta: 'Anulación venta',
    ingreso: 'Ingreso manual',
    ingreso_manual: 'Ingreso manual',
    egreso: 'Egreso manual',
    egreso_manual: 'Egreso manual',
    gasto: 'Gasto',
    income: 'Ingreso',
    expense: 'Egreso',
  }
  return map[t] ?? (type || '—')
}
