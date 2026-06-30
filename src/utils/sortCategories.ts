import type { Category } from '@/services/products.service'

/** Orden de categorías: sort_order ASC, luego nombre. */
export function sortCategories<T extends Pick<Category, 'sort_order' | 'name'>>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const oa = a.sort_order ?? 0
    const ob = b.sort_order ?? 0
    if (oa !== ob) return oa - ob
    return a.name.localeCompare(b.name, 'es')
  })
}
