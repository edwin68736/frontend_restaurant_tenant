/** Selección estructurada de variante o extra (persistida en comanda y venta). */
export type CartModifierEntry = {
  group_id: number
  group_name: string
  type: 'variant' | 'modifier'
  option_id: number
  option_name: string
  extra_price: number
}

/**
 * Snapshot histórico en comanda/venta (modifiers_json).
 * La UI y la impresión deben usar solo estos campos, nunca el catálogo vivo.
 */
export type StoredModifierEntry = {
  group_id?: number
  group_name?: string
  type?: 'variant' | 'modifier'
  group_type?: 'variant' | 'modifier'
  group_required?: boolean
  option_id?: number
  option_name?: string
  /** Alias legacy (retail). */
  name?: string
  extra_price: number
  snapshot?: boolean
}
