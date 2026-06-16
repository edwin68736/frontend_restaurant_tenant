import {
  readXlsx,
  validateWithSchema,
  writeXlsx,
  type CellValue,
  type SchemaDefinition,
} from 'hucre'

/** Error de fila devuelto por validateWithSchema (hucre). */
type HucreRowError = {
  row: number
  column: string | number
  message: string
  value: unknown
  field: string
}
import type { BulkImportItemPayload, Category, CreateProductInput } from '@/services/products.service'
import { productsService } from '@/services/products.service'
import { INITIAL_STOCK_REQUIRES_MANAGE_STOCK } from '@/constants/productStockRules'

const IGV_CODES = ['10', '20', '30', '40'] as const

export const IMPORT_COLUMNS = [
  'nombre',
  'codigo',
  'descripcion',
  'precio_venta',
  'unidad',
  'categoria',
  'area_preparacion',
  'afectacion_igv',
  'precio_incluye_igv',
  'control_stock',
  'stock_inicial',
] as const

const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = {
  nombre: 'nombre',
  name: 'nombre',
  producto: 'nombre',
  plato: 'nombre',
  codigo: 'codigo',
  code: 'codigo',
  sku: 'codigo',
  descripcion: 'descripcion',
  description: 'descripcion',
  precio_venta: 'precio_venta',
  precio_de_venta: 'precio_venta',
  precio: 'precio_venta',
  price: 'precio_venta',
  sale_price: 'precio_venta',
  precio_venta_soles: 'precio_venta',
  unidad: 'unidad',
  unit: 'unidad',
  categoria: 'categoria',
  category: 'categoria',
  area_preparacion: 'area_preparacion',
  area: 'area_preparacion',
  preparation_area: 'area_preparacion',
  afectacion_igv: 'afectacion_igv',
  igv: 'afectacion_igv',
  igv_affectation_type: 'afectacion_igv',
  precio_incluye_igv: 'precio_incluye_igv',
  incluye_igv: 'precio_incluye_igv',
  control_stock: 'control_stock',
  manage_stock: 'control_stock',
  stock_inicial: 'stock_inicial',
  stock_inicial_: 'stock_inicial',
  cantidad_inicial: 'stock_inicial',
  inventario_inicial: 'stock_inicial',
  initial_stock: 'stock_inicial',
}

export const RESTAURANT_PRODUCT_IMPORT_SCHEMA: SchemaDefinition = {
  nombre: { column: 'nombre', type: 'string', required: true, min: 1, max: 255 },
  codigo: { column: 'codigo', type: 'string', max: 64 },
  descripcion: { column: 'descripcion', type: 'string', max: 500 },
  precio_venta: { column: 'precio_venta', type: 'number', required: true, min: 0.01 },
  unidad: {
    column: 'unidad',
    type: 'string',
    default: 'NIU',
    max: 10,
    transform: (v) => String(v ?? 'NIU').trim().toUpperCase() || 'NIU',
  },
  categoria: { column: 'categoria', type: 'string', max: 120 },
  area_preparacion: {
    column: 'area_preparacion',
    type: 'string',
    max: 50,
    transform: (v) => String(v ?? '').trim().toLowerCase(),
  },
  afectacion_igv: {
    column: 'afectacion_igv',
    type: 'string',
    default: '10',
    transform: (v) => String(v ?? '10').trim(),
    enum: [...IGV_CODES],
  },
  // type string: hucre coerce boolean antes del transform y rechaza "si"/"no" del Excel.
  precio_incluye_igv: {
    column: 'precio_incluye_igv',
    type: 'string',
    default: 'si',
    transform: parseExcelBoolean,
  },
  control_stock: {
    column: 'control_stock',
    type: 'string',
    default: 'no',
    transform: parseExcelBoolean,
  },
  stock_inicial: {
    column: 'stock_inicial',
    type: 'number',
    default: 0,
    min: 0,
  },
}

export type ParsedImportRow = {
  rowNumber: number
  nombre: string
  codigo: string
  descripcion: string
  precio_venta: number
  unidad: string
  categoria: string
  area_preparacion: string
  afectacion_igv: string
  precio_incluye_igv: boolean
  control_stock: boolean
  stock_inicial: number
}

export type ImportRowIssue = {
  row: number
  column: string | number
  message: string
  value: unknown
  field: string
}

function toImportIssue(err: HucreRowError): ImportRowIssue {
  return {
    row: err.row,
    column: err.column,
    message: err.message,
    value: err.value,
    field: err.field,
  }
}

export type ImportValidationResult = {
  rows: ParsedImportRow[]
  errors: ImportRowIssue[]
  totalRows: number
}

function normalizeHeader(raw: string): string {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
  return HEADER_ALIASES[key] ?? key
}

function parseExcelBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (['1', 'si', 'yes', 'true', 'verdadero', 's', 'y'].includes(s)) return true
  if (['0', 'no', 'false', 'falso', 'n'].includes(s)) return false
  return Boolean(value)
}

function generateEan13(): string {
  const raw = `${Date.now()}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
  const base12 = raw.slice(-12).replace(/\D/g, '').padStart(12, '0').slice(0, 12)
  let sum = 0
  for (let i = 0; i < base12.length; i++) {
    const digit = Number(base12[i])
    sum += (i % 2 === 0 ? 1 : 3) * digit
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return `${base12}${checkDigit}`
}

function downloadXlsx(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadRestaurantProductTemplate(): Promise<void> {
  const headerRow: CellValue[] = [...IMPORT_COLUMNS]
  const exampleRow: CellValue[] = [
    'Lomo saltado',
    '7750123456789',
    'Plato de fondo',
    28.5,
    'NIU',
    'Platos de fondo',
    'cocina',
    '10',
    'si',
    'no',
    0,
  ]
  const bytes = await writeXlsx({
    sheets: [{ name: 'Productos', rows: [headerRow, exampleRow] }],
  })
  downloadXlsx(bytes, 'plantilla-productos-restaurante.xlsx')
}

export async function validateRestaurantProductExcel(file: File): Promise<ImportValidationResult> {
  const buf = await file.arrayBuffer()
  const wb = await readXlsx(new Uint8Array(buf))
  const sheet = wb.sheets[0]
  if (!sheet?.rows?.length) {
    return { rows: [], errors: [{ row: 0, column: '', field: '', message: 'El archivo está vacío', value: null }], totalRows: 0 }
  }

  const rawRows = sheet.rows as CellValue[][]
  const headerCells = rawRows[0] ?? []
  const normalizedHeaders = headerCells.map((c) => normalizeHeader(String(c ?? '')))
  const missingRequired = ['nombre', 'precio_venta'].filter((col) => !normalizedHeaders.includes(col))
  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          column: 'encabezados',
          field: 'encabezados',
          message: `Faltan columnas obligatorias: ${missingRequired.join(', ')}`,
          value: normalizedHeaders.join(', '),
        },
      ],
      totalRows: 0,
    }
  }

  const rowsForSchema: CellValue[][] = [normalizedHeaders, ...rawRows.slice(1)]
  // hucre usa headerRow 1-based: 1 = primera fila del array (encabezados ya normalizados arriba).
  const { data, errors: schemaErrors } = validateWithSchema<Record<string, unknown>>(
    rowsForSchema,
    RESTAURANT_PRODUCT_IMPORT_SCHEMA,
    { headerRow: 1, skipEmptyRows: true, errorMode: 'collect' }
  )

  const parsed: ParsedImportRow[] = []
  const extraErrors: ImportRowIssue[] = (schemaErrors as HucreRowError[]).map(toImportIssue)
  const codesInFile = new Map<string, number>()

  data.forEach((row, index) => {
    const rowNumber = index + 2
    const nombre = String(row.nombre ?? '').trim()
    const codigoRaw = String(row.codigo ?? '').trim()
    const codigo = codigoRaw || ''
    if (codigo) {
      codesInFile.set(codigo, rowNumber)
    }
    const stockInicial = Math.max(0, Number(row.stock_inicial ?? 0) || 0)
    const controlStock = parseExcelBoolean(row.control_stock)
    if (!controlStock && stockInicial > 0) {
      extraErrors.push({
        row: rowNumber,
        column: 'stock_inicial',
        field: 'stock_inicial',
        message: INITIAL_STOCK_REQUIRES_MANAGE_STOCK,
        value: stockInicial,
      })
      return
    }
    parsed.push({
      rowNumber,
      nombre,
      codigo,
      descripcion: String(row.descripcion ?? '').trim(),
      precio_venta: Number(row.precio_venta),
      unidad: String(row.unidad ?? 'NIU').trim().toUpperCase() || 'NIU',
      categoria: String(row.categoria ?? '').trim(),
      area_preparacion: String(row.area_preparacion ?? '').trim().toLowerCase(),
      afectacion_igv: String(row.afectacion_igv ?? '10').trim(),
      precio_incluye_igv: parseExcelBoolean(row.precio_incluye_igv),
      control_stock: controlStock,
      stock_inicial: stockInicial,
    })
  })

  return {
    rows: parsed,
    errors: extraErrors,
    totalRows: parsed.length,
  }
}

export function resolveCategoryId(name: string, categories: Category[]): number | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  const found = categories.find((c) => c.name.trim().toLowerCase() === n)
  return found?.id ?? null
}

export function buildCreateInput(
  row: ParsedImportRow,
  categories: Category[],
  usedCodes: Set<string>
): { input: CreateProductInput; warnings: string[] } {
  const warnings: string[] = []
  let categoryId: number | null = null
  if (row.categoria) {
    categoryId = resolveCategoryId(row.categoria, categories)
    if (categoryId == null) {
      warnings.push(`Categoría "${row.categoria}" no existe; se importará sin categoría`)
    }
  }

  let code = row.codigo
  if (!code) {
    do {
      code = generateEan13()
    } while (usedCodes.has(code))
  }
  usedCodes.add(code)

  return {
    input: {
      name: row.nombre,
      code,
      description: row.descripcion,
      sale_price: row.precio_venta,
      unit: row.unidad,
      category_id: categoryId,
      preparation_area: row.area_preparacion || '',
      igv_affectation_type: row.afectacion_igv,
      price_includes_igv: row.precio_incluye_igv,
      manage_stock: row.control_stock,
      initial_stock: row.stock_inicial > 0 ? row.stock_inicial : undefined,
      has_modifiers: false,
      is_restaurant: true,
      active: true,
    },
    warnings,
  }
}

export type ImportProgress = { done: number; total: number; current?: string }

/** Lotes pequeños para que la barra de progreso avance de forma visible entre peticiones. */
const BULK_CHUNK_SIZE = 25

/** Permite que React pinte la barra antes del siguiente await (petición HTTP). */
async function reportImportProgress(
  onProgress: ((p: ImportProgress) => void) | undefined,
  p: ImportProgress,
): Promise<void> {
  if (!onProgress) return
  onProgress(p)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export function importProgressPercent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)))
}

function rowToBulkPayload(row: ParsedImportRow): BulkImportItemPayload {
  return {
    row_number: row.rowNumber,
    name: row.nombre,
    code: row.codigo || undefined,
    description: row.descripcion || undefined,
    sale_price: row.precio_venta,
    unit: row.unidad,
    category_name: row.categoria || undefined,
    igv_affectation_type: row.afectacion_igv,
    price_includes_igv: row.precio_incluye_igv,
    manage_stock: row.control_stock,
    initial_stock: row.stock_inicial > 0 ? row.stock_inicial : undefined,
    preparation_area: row.area_preparacion || undefined,
  }
}

export async function importRestaurantProducts(
  rows: ParsedImportRow[],
  branchId: number,
  _categories: Category[],
  onProgress?: (p: ImportProgress) => void
): Promise<{
  created: number
  updated: number
  stockRegistered: number
  failed: { row: number; name: string; error: string }[]
}> {
  const failed: { row: number; name: string; error: string }[] = []
  let created = 0
  let updated = 0
  let stockRegistered = 0
  const total = rows.length

  if (total === 0) {
    await reportImportProgress(onProgress, { done: 0, total: 0 })
    return { created: 0, updated: 0, stockRegistered: 0, failed }
  }

  await reportImportProgress(onProgress, { done: 0, total, current: 'Preparando envío…' })

  for (let offset = 0; offset < rows.length; offset += BULK_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + BULK_CHUNK_SIZE)
    const chunkEnd = offset + chunk.length
    await reportImportProgress(onProgress, {
      done: offset,
      total,
      current: chunk[0]?.nombre,
    })
    try {
      const res = await productsService.bulkImportRestaurant(chunk.map(rowToBulkPayload), branchId)
      created += res.created
      updated += res.updated ?? 0
      stockRegistered += res.stock_registered
      failed.push(...res.failed)
      await reportImportProgress(onProgress, {
        done: chunkEnd,
        total,
        current: chunk[chunk.length - 1]?.nombre,
      })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Error al importar lote')
      for (const row of chunk) {
        failed.push({ row: row.rowNumber, name: row.nombre, error: msg })
      }
      await reportImportProgress(onProgress, { done: chunkEnd, total })
    }
  }

  await reportImportProgress(onProgress, { done: total, total })
  return { created, updated, stockRegistered, failed }
}
