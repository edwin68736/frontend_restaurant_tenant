export type ModifierOptionDraft = { name: string; extra_price: number }

export function createEmptyOptionDraft(): ModifierOptionDraft {
  return { name: '', extra_price: 0 }
}

export function draftsFromApiOptions(
  options: { name: string; extra_price?: number }[] | undefined,
): ModifierOptionDraft[] {
  const list = (options ?? []).map((o) => ({
    name: o.name ?? '',
    extra_price: Number(o.extra_price) || 0,
  }))
  return list.length > 0 ? list : [createEmptyOptionDraft()]
}

export function validateOptionDrafts(drafts: ModifierOptionDraft[]): string | null {
  const filled = drafts.filter((d) => d.name.trim())
  if (filled.length === 0) return 'Agrega al menos una opción con nombre'
  for (const d of filled) {
    const price = Number(d.extra_price)
    if (Number.isNaN(price) || price < 0) return 'El precio adicional no puede ser negativo'
  }
  return null
}

/** Convierte líneas "Nombre" o "Nombre|4.50" (importación / legacy). */
export function parseModifierOptionsFromText(text: string): ModifierOptionDraft[] {
  return text
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes('|') ? '|' : line.includes('\t') ? '\t' : null
      if (!sep) return { name: line, extra_price: 0 }
      const parts = line.split(sep).map((p) => p.trim()).filter(Boolean)
      if (parts.length < 2) return { name: line, extra_price: 0 }
      const name = parts.slice(0, -1).join(' ').trim() || parts[0]
      const raw = parts[parts.length - 1].replace(/[^\d.,-]/g, '').replace(',', '.')
      const extra_price = Math.max(0, Number(raw) || 0)
      return { name, extra_price: Math.round(extra_price * 100) / 100 }
    })
}

export function formatModifierOptionsToText(options: ModifierOptionDraft[]): string {
  return options
    .map((o) => {
      const name = o.name.trim()
      const price = Number(o.extra_price) || 0
      return price > 0 ? `${name}|${price.toFixed(2)}` : name
    })
    .join('\n')
}

export function formatOptionPriceLabel(extra_price?: number): string {
  const p = Number(extra_price) || 0
  return p > 0 ? ` (+S/ ${p.toFixed(2)})` : ''
}
