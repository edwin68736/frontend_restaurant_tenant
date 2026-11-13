import { readXlsx, writeXlsx, type CellValue } from 'hucre'
import { downloadXlsxBytes } from '@/utils/downloadXlsx'
import {
  IMPORT_COLUMNS,
  validateRestaurantProductRows,
  type ParsedImportRow,
} from '@/utils/restaurantProductImport'
import { productsService } from '@/services/products.service'
import type {
  BulkImportAdvancedItemPayload,
  BulkImportAdvancedResultPayload,
} from '@/services/products.service'

/**
 * Importación avanzada de platos (Tukichef): Excel con varias hojas
 *   Productos · Presentaciones · Grupos de extras · Extras · Combos
 * Las hojas hijas se enlazan con Productos por «codigo» (obligatorio en este modo).
 * Tukichef no usa unidades de venta, precios por sucursal ni stock por sucursal: no hay hojas para eso.
 * Las reglas de negocio las aplica el backend (internal/products/service/bulk_import_advanced*.go);
 * aquí solo se valida la estructura para avisar antes de enviar.
 */

export const ADVANCED_BATCH_SIZE = 50
/** Tope del backend para simular (dry_run) el archivo completo en una sola transacción. */
export const ADVANCED_MAX_PRODUCTS = 2000

export const SHEET_PRODUCTS = 'Productos'
export const SHEET_PRESENTATIONS = 'Presentaciones'
export const SHEET_MOD_GROUPS = 'Grupos de extras'
export const SHEET_EXTRAS = 'Extras'
export const SHEET_COMBOS = 'Combos'
const SHEET_INSTRUCTIONS = 'Instrucciones'

export type AdvancedIssue = { sheet: string; row: number; message: string }

export type AdvancedParseResult = {
  items: BulkImportAdvancedItemPayload[]
  errors: AdvancedIssue[]
  warnings: string[]
  counts: { products: number; presentations: number; extraLinks: number; extraOptions: number; comboRows: number }
}

// ── Plantilla ────────────────────────────────────────────────────────────────────────────────────

const PRODUCT_HEADERS = [...IMPORT_COLUMNS, 'stock_minimo']
const PRESENTATION_HEADERS = ['codigo', 'nombre', 'precio', 'stock_inicial', 'orden']
const MOD_GROUP_HEADERS = ['grupo', 'obligatorio', 'multiple', 'opcion', 'precio_extra']
const EXTRA_HEADERS = ['codigo', 'grupo']
const COMBO_HEADERS = [
  'codigo', 'grupo', 'tipo', 'minimo', 'maximo', 'permite_cantidad', 'producto', 'cantidad', 'cantidad_max',
  'sobreprecio', 'por_defecto', 'orden',
]

const INSTRUCTIONS: string[] = [
  'IMPORTACIÓN AVANZADA DE PLATOS (TUKICHEF)',
  '',
  'Cada hoja se enlaza con «Productos» por la columna codigo. En este modo el codigo es OBLIGATORIO y único. Todos los productos se crean como platos de la sucursal destino.',
  'Productos: igual que la plantilla básica (más stock_minimo, opcional: vacío no cambia el actual). Es la única hoja obligatoria.',
  'Presentaciones: tamaños de un plato con su propio precio (Personal / Familiar). stock_inicial solo aplica a presentaciones nuevas y si el plato tiene control_stock = si.',
  'Grupos de extras: define grupos de opciones con precio extra (Sin ají, Extra queso…). Una fila por opción; obligatorio y multiple (si/no) se leen de la primera fila de cada grupo. Los grupos son GLOBALES: si el grupo ya existe en el sistema, esta hoja actualiza su definición para todos los platos que lo usan (las opciones que ya no aparezcan se desactivan, no se borran).',
  'Extras: qué grupos tiene cada plato (codigo + grupo). La lista de un plato es la lista final: los grupos que tenía y no aparecen se desvinculan. Un grupo que no está en «Grupos de extras» debe existir ya en el sistema.',
  'Combos: un plato es combo si aparece en esta hoja. Una fila por producto componente: codigo (del combo), grupo (sección: Entrada, Fondo…), tipo (fijo = siempre incluido, 1 producto · unica = el cliente elige una · multiple = elige entre minimo y maximo), producto (codigo del componente), cantidad, cantidad_max, sobreprecio, por_defecto. Los datos del grupo (tipo, minimo, maximo, permite_cantidad, orden) se leen de la primera fila del grupo.',
  'Reglas de combos: los componentes deben existir en la hoja Productos o en la sucursal; un combo no puede contener otro combo ni a sí mismo; un combo no tiene presentaciones ni extras.',
  '',
  'PLATOS QUE YA EXISTEN (mismo codigo): lo que aparece en una hoja hija es la lista FINAL de ese plato; lo que falte se desactiva o desvincula (nada se borra). Si el plato no aparece en una hoja, o la hoja está vacía, esa parte no se toca.',
  'Antes de importar verá un resumen de lo que se creará, modificará y desactivará. Los números admiten coma decimal (0,50).',
  'Las filas de ejemplo usan los códigos LOMO-01, CEV-01, SOPA-01, GAS-01 y MENU-01: bórrelas o reemplácelas por sus platos.',
]

function productRow(v: Partial<Record<string, CellValue>>): CellValue[] {
  return PRODUCT_HEADERS.map((c) => v[c] ?? '')
}

export async function downloadAdvancedRestaurantTemplate(): Promise<void> {
  const base = { unidad: 'NIU', afectacion_igv: '10', precio_incluye_igv: 'si', control_stock: 'no', stock_inicial: 0 }
  const productos: CellValue[][] = [
    PRODUCT_HEADERS,
    productRow({ ...base, nombre: 'Lomo saltado', codigo: 'LOMO-01', descripcion: 'Plato de fondo', precio_venta: 28.5, categoria: 'Platos de fondo', area_preparacion: 'cocina' }),
    productRow({ ...base, nombre: 'Ceviche', codigo: 'CEV-01', precio_venta: 32, categoria: 'Entradas', area_preparacion: 'cocina' }),
    productRow({ ...base, nombre: 'Sopa del día', codigo: 'SOPA-01', precio_venta: 8, categoria: 'Entradas', area_preparacion: 'cocina' }),
    productRow({ ...base, nombre: 'Gaseosa 500ml', codigo: 'GAS-01', precio_venta: 4, categoria: 'Bebidas', area_preparacion: 'bar', control_stock: 'si', stock_inicial: 24, stock_minimo: 6 }),
    productRow({ ...base, nombre: 'Menú del día', codigo: 'MENU-01', precio_venta: 25, categoria: 'Menús', area_preparacion: 'cocina' }),
  ]
  const presentaciones: CellValue[][] = [
    PRESENTATION_HEADERS,
    ['LOMO-01', 'Personal', 28.5, '', 1],
    ['LOMO-01', 'Familiar', 48, '', 2],
  ]
  const grupos: CellValue[][] = [
    MOD_GROUP_HEADERS,
    ['Personaliza', 'no', 'si', 'Sin ají', 0],
    ['Personaliza', '', '', 'Extra queso', 3],
    ['Personaliza', '', '', 'Extra huevo', 2],
    ['Punto de cocción', 'si', 'no', 'Jugoso', 0],
    ['Punto de cocción', '', '', 'Término medio', 0],
    ['Punto de cocción', '', '', 'Bien cocido', 0],
  ]
  const extras: CellValue[][] = [
    EXTRA_HEADERS,
    ['LOMO-01', 'Personaliza'],
    ['LOMO-01', 'Punto de cocción'],
    ['CEV-01', 'Personaliza'],
  ]
  const combos: CellValue[][] = [
    COMBO_HEADERS,
    ['MENU-01', 'Entrada', 'fijo', '', '', 'no', 'SOPA-01', 1, 1, 0, 'si', 1],
    ['MENU-01', 'Fondo', 'unica', '', '', 'no', 'LOMO-01', 1, 1, 0, 'si', 2],
    ['MENU-01', 'Fondo', '', '', '', '', 'CEV-01', 1, 1, 5, 'no', ''],
    ['MENU-01', 'Bebida', 'unica', '', '', 'no', 'GAS-01', 1, 1, 0, 'si', 3],
  ]
  const bytes = await writeXlsx({
    sheets: [
      { name: SHEET_PRODUCTS, rows: productos },
      { name: SHEET_PRESENTATIONS, rows: presentaciones },
      { name: SHEET_MOD_GROUPS, rows: grupos },
      { name: SHEET_EXTRAS, rows: extras },
      { name: SHEET_COMBOS, rows: combos },
      { name: SHEET_INSTRUCTIONS, rows: INSTRUCTIONS.map((t) => [t]) },
    ],
  })
  await downloadXlsxBytes(bytes, 'plantilla-platos-avanzada.xlsx')
}

// ── Lectura y validación ─────────────────────────────────────────────────────────────────────────

function sheetKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '')
}

function canonicalHeader(raw: unknown): string {
  const n = String(raw ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '_')
  const alias: Record<string, string> = {
    code: 'codigo', sku: 'codigo', name: 'nombre', price: 'precio', precio_venta: 'precio', stock: 'stock_inicial',
    order: 'orden', required: 'obligatorio', multi: 'multiple', multi_select: 'multiple', option: 'opcion',
    opciones: 'opcion', extra_price: 'precio_extra', precio_adicional: 'precio_extra', group: 'grupo',
    type: 'tipo', min: 'minimo', max: 'maximo', min_select: 'minimo', max_select: 'maximo',
    allow_quantity: 'permite_cantidad', product: 'producto', producto_codigo: 'producto', codigo_producto: 'producto',
    quantity: 'cantidad', default_quantity: 'cantidad', max_quantity: 'cantidad_max', extra: 'sobreprecio',
    is_default: 'por_defecto', default: 'por_defecto',
  }
  return alias[n] ?? n
}

type Rec = { row: number; cell: Record<string, CellValue> }

function readRecords(rows: CellValue[][] | undefined): { headers: string[]; records: Rec[] } {
  if (!rows || rows.length === 0) return { headers: [], records: [] }
  const headers = (rows[0] ?? []).map(canonicalHeader)
  const records: Rec[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    if (r.every((c) => c == null || String(c).trim() === '')) continue
    const cell: Record<string, CellValue> = {}
    headers.forEach((h, idx) => {
      if (h && !(h in cell)) cell[h] = r[idx] ?? null
    })
    records.push({ row: i + 1, cell })
  }
  return { headers, records }
}

const isBlank = (v: CellValue | undefined) => v == null || String(v).trim() === ''
const str = (v: CellValue | undefined) => String(v ?? '').trim()

/** Coma decimal en formato español («0,50», «1.234,56»); mismo criterio que la importación de Tukifac. */
function normalizeDecimalComma(value: CellValue): CellValue {
  if (typeof value !== 'string') return value
  const raw = value.trim()
  if (raw === '' || !raw.includes(',')) return value
  if (raw.includes('.')) {
    return raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
  }
  if (raw.indexOf(',') === raw.lastIndexOf(',')) return raw.replace(',', '.')
  return raw.replace(/,/g, '')
}

/** undefined = vacío; NaN = no es número. */
function parseNum(v: CellValue | undefined): number | undefined {
  if (isBlank(v)) return undefined
  if (typeof v === 'number') return v
  return Number(normalizeDecimalComma(String(v).trim() as CellValue))
}

function parseBool(v: CellValue | undefined): boolean | undefined {
  if (isBlank(v)) return undefined
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (['1', 'si', 'yes', 'true', 'verdadero', 's', 'y'].includes(s)) return true
  if (['0', 'no', 'false', 'falso', 'n'].includes(s)) return false
  return undefined
}

function parseSelectionType(v: CellValue | undefined): 'fixed' | 'single' | 'multiple' | null | undefined {
  if (isBlank(v)) return undefined
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (['fijo', 'fija', 'fixed'].includes(s)) return 'fixed'
  if (['unica', 'unico', 'una', 'single', 'elige una', 'elige uno'].includes(s)) return 'single'
  if (['multiple', 'multiples', 'varias', 'varios', 'elige varias'].includes(s)) return 'multiple'
  return null
}

export async function validateAdvancedRestaurantExcel(file: File): Promise<AdvancedParseResult> {
  const buf = await file.arrayBuffer()
  const wb = await readXlsx(new Uint8Array(buf))
  const byKey = new Map<string, CellValue[][]>()
  for (const s of wb.sheets) byKey.set(sheetKey(s.name), (s.rows ?? []) as CellValue[][])

  const errors: AdvancedIssue[] = []
  const warnings: string[] = []
  const counts = { products: 0, presentations: 0, extraLinks: 0, extraOptions: 0, comboRows: 0 }
  const fail = (): AdvancedParseResult => ({ items: [], errors, warnings, counts })

  const productRows = byKey.get(sheetKey(SHEET_PRODUCTS))
  if (!productRows || productRows.length < 2) {
    errors.push({ sheet: SHEET_PRODUCTS, row: 0, message: 'No se encontró la hoja «Productos» con datos. Descargue la plantilla avanzada.' })
    return fail()
  }

  // Hoja Productos: mismo parser que la básica, con el nº de fila real de Excel y coma decimal.
  const headers = productRows[0].map((c) => String(c ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '_'))
  const numericCols = headers.map((h, i) => (['precio_venta', 'precio', 'stock_inicial', 'stock_minimo'].includes(h) ? i : -1)).filter((i) => i >= 0)
  const minIdx = headers.indexOf('stock_minimo')
  const dataRowNumbers: number[] = []
  const rowsForParser = productRows.map((r, i) => {
    if (i === 0) return r
    const copy = [...r]
    for (const ci of numericCols) copy[ci] = normalizeDecimalComma(copy[ci])
    return copy
  })
  for (let i = 1; i < productRows.length; i++) {
    if ((productRows[i] ?? []).some((c) => c != null && String(c).trim() !== '')) dataRowNumbers.push(i + 1)
  }
  const v = validateRestaurantProductRows(rowsForParser, dataRowNumbers)
  for (const e of v.errors) {
    errors.push({ sheet: SHEET_PRODUCTS, row: e.row, message: `${String(e.field || e.column)}: ${e.message}` })
  }

  const items: BulkImportAdvancedItemPayload[] = []
  const byCode = new Map<string, BulkImportAdvancedItemPayload>()
  const firstRowOfCode = new Map<string, number>()
  for (const p of v.rows as ParsedImportRow[]) {
    if (!p.codigo) {
      errors.push({ sheet: SHEET_PRODUCTS, row: p.rowNumber, message: 'codigo: es obligatorio en la importación avanzada' })
      continue
    }
    const key = p.codigo.toLowerCase()
    if (firstRowOfCode.has(key)) {
      errors.push({ sheet: SHEET_PRODUCTS, row: p.rowNumber, message: `codigo: «${p.codigo}» ya aparece en la fila ${firstRowOfCode.get(key)}` })
      continue
    }
    firstRowOfCode.set(key, p.rowNumber)
    let minStock: number | undefined
    if (minIdx >= 0) {
      const n = parseNum(rowsForParser[p.rowNumber - 1]?.[minIdx])
      if (n != null) {
        if (Number.isNaN(n) || n < 0) {
          errors.push({ sheet: SHEET_PRODUCTS, row: p.rowNumber, message: 'stock_minimo: debe ser un número mayor o igual a 0 (o vacío)' })
          continue
        }
        minStock = n
      }
    }
    const item: BulkImportAdvancedItemPayload = {
      row_number: p.rowNumber,
      name: p.nombre,
      code: p.codigo,
      description: p.descripcion || undefined,
      sale_price: p.precio_venta,
      unit: p.unidad,
      category_name: p.categoria || undefined,
      igv_affectation_type: p.afectacion_igv,
      price_includes_igv: p.precio_incluye_igv,
      manage_stock: p.control_stock,
      initial_stock: p.stock_inicial > 0 ? p.stock_inicial : undefined,
      preparation_area: p.area_preparacion || undefined,
      ...(minStock != null ? { min_stock: minStock } : {}),
    }
    byCode.set(key, item)
    items.push(item)
  }
  counts.products = items.length

  const owner = (sheet: string, rec: Rec): BulkImportAdvancedItemPayload | null => {
    const code = str(rec.cell.codigo)
    if (!code) {
      errors.push({ sheet, row: rec.row, message: 'codigo: es obligatorio' })
      return null
    }
    const it = byCode.get(code.toLowerCase())
    if (!it) {
      errors.push({ sheet, row: rec.row, message: `El código «${code}» no existe en la hoja Productos (fila huérfana)` })
      return null
    }
    return it
  }
  const requireHeaders = (sheet: string, hs: string[], required: string[]): boolean => {
    const missing = required.filter((h) => !hs.includes(h))
    if (missing.length > 0) errors.push({ sheet, row: 1, message: `Faltan columnas obligatorias: ${missing.join(', ')}` })
    return missing.length === 0
  }

  // Presentaciones
  {
    const { headers: hs, records } = readRecords(byKey.get(sheetKey(SHEET_PRESENTATIONS)))
    if (records.length > 0 && requireHeaders(SHEET_PRESENTATIONS, hs, ['codigo', 'nombre', 'precio'])) {
      for (const rec of records) {
        counts.presentations++
        const it = owner(SHEET_PRESENTATIONS, rec)
        if (!it) continue
        const issue = (message: string) => errors.push({ sheet: SHEET_PRESENTATIONS, row: rec.row, message })
        const name = str(rec.cell.nombre)
        const price = parseNum(rec.cell.precio)
        const stock = parseNum(rec.cell.stock_inicial)
        const order = parseNum(rec.cell.orden)
        if (!name) { issue('nombre: es obligatorio'); continue }
        if (price == null || Number.isNaN(price) || price <= 0) { issue('precio: debe ser un número mayor a 0'); continue }
        if (stock != null && (Number.isNaN(stock) || stock < 0)) { issue('stock_inicial: debe ser un número mayor o igual a 0'); continue }
        if (order != null && Number.isNaN(order)) { issue('orden: debe ser un número'); continue }
        const list = (it.presentations ??= [])
        if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
          issue(`La presentación «${name}» está repetida para el plato «${str(rec.cell.codigo)}»`)
          continue
        }
        if (stock != null && stock > 0 && !it.manage_stock) {
          issue('stock_inicial requiere control_stock = si en la hoja Productos')
          continue
        }
        list.push({ row_number: rec.row, name, sale_price: price, ...(stock ? { initial_stock: stock } : {}), ...(order ? { sort_order: order } : {}) })
      }
    }
  }

  // Grupos de extras (definiciones): una fila por opción; obligatorio/multiple de la primera fila.
  type GroupDef = { name: string; row: number; required: boolean; multi: boolean; options: { row_number: number; name: string; extra_price: number }[] }
  const defs = new Map<string, GroupDef>()
  {
    const { headers: hs, records } = readRecords(byKey.get(sheetKey(SHEET_MOD_GROUPS)))
    if (records.length > 0 && requireHeaders(SHEET_MOD_GROUPS, hs, ['grupo', 'opcion'])) {
      for (const rec of records) {
        counts.extraOptions++
        const issue = (message: string) => errors.push({ sheet: SHEET_MOD_GROUPS, row: rec.row, message })
        const gname = str(rec.cell.grupo)
        const oname = str(rec.cell.opcion)
        const price = parseNum(rec.cell.precio_extra)
        const req = parseBool(rec.cell.obligatorio)
        const multi = parseBool(rec.cell.multiple)
        if (!gname) { issue('grupo: es obligatorio'); continue }
        if (!oname) { issue('opcion: es obligatoria'); continue }
        if (price != null && (Number.isNaN(price) || price < 0)) { issue('precio_extra: debe ser un número mayor o igual a 0 (o vacío)'); continue }
        if (!isBlank(rec.cell.obligatorio) && req === undefined) { issue('obligatorio: use si o no'); continue }
        if (!isBlank(rec.cell.multiple) && multi === undefined) { issue('multiple: use si o no'); continue }
        const key = gname.toLowerCase()
        let g = defs.get(key)
        if (!g) {
          g = { name: gname, row: rec.row, required: req ?? false, multi: multi ?? false, options: [] }
          defs.set(key, g)
        } else {
          if (req !== undefined && req !== g.required) { issue(`obligatorio: no coincide con la primera fila del grupo «${gname}» (fila ${g.row})`); continue }
          if (multi !== undefined && multi !== g.multi) { issue(`multiple: no coincide con la primera fila del grupo «${gname}» (fila ${g.row})`); continue }
        }
        if (g.options.some((o) => o.name.toLowerCase() === oname.toLowerCase())) {
          issue(`La opción «${oname}» está repetida en el grupo «${gname}»`)
          continue
        }
        g.options.push({ row_number: rec.row, name: oname, extra_price: price ?? 0 })
      }
    }
  }

  // Extras (vínculos plato → grupo)
  const linked = new Set<string>()
  {
    const { headers: hs, records } = readRecords(byKey.get(sheetKey(SHEET_EXTRAS)))
    if (records.length > 0 && requireHeaders(SHEET_EXTRAS, hs, ['codigo', 'grupo'])) {
      for (const rec of records) {
        counts.extraLinks++
        const it = owner(SHEET_EXTRAS, rec)
        if (!it) continue
        const gname = str(rec.cell.grupo)
        if (!gname) { errors.push({ sheet: SHEET_EXTRAS, row: rec.row, message: 'grupo: es obligatorio' }); continue }
        const list = (it.modifier_groups ??= [])
        if (list.some((x) => x.name.toLowerCase() === gname.toLowerCase())) {
          errors.push({ sheet: SHEET_EXTRAS, row: rec.row, message: `El grupo «${gname}» está repetido para el plato «${str(rec.cell.codigo)}»` })
          continue
        }
        const def = defs.get(gname.toLowerCase())
        linked.add(gname.toLowerCase())
        list.push({
          row_number: rec.row,
          name: gname,
          define: !!def,
          ...(def ? { def_row_number: def.row, required: def.required, multi_select: def.multi, options: def.options } : {}),
        })
      }
    }
  }
  for (const [k, g] of defs) {
    if (!linked.has(k)) warnings.push(`El grupo de extras «${g.name}» (hoja Grupos de extras, fila ${g.row}) no está vinculado a ningún plato en la hoja Extras: se ignora.`)
  }

  // Combos: una fila por componente; los datos del grupo salen de su primera fila.
  {
    const { headers: hs, records } = readRecords(byKey.get(sheetKey(SHEET_COMBOS)))
    if (records.length > 0 && requireHeaders(SHEET_COMBOS, hs, ['codigo', 'grupo', 'producto'])) {
      for (const rec of records) {
        counts.comboRows++
        const it = owner(SHEET_COMBOS, rec)
        if (!it) continue
        const issue = (message: string) => errors.push({ sheet: SHEET_COMBOS, row: rec.row, message })
        const gname = str(rec.cell.grupo)
        const pcode = str(rec.cell.producto)
        if (!gname) { issue('grupo: es obligatorio'); continue }
        if (!pcode) { issue('producto: es obligatorio (código del componente)'); continue }
        const tipo = parseSelectionType(rec.cell.tipo)
        if (tipo === null) { issue('tipo: use fijo, unica o multiple'); continue }
        const nums: Record<string, number | undefined> = {}
        let bad = false
        for (const col of ['minimo', 'maximo', 'cantidad', 'cantidad_max', 'sobreprecio', 'orden']) {
          const n = parseNum(rec.cell[col])
          if (n != null && (Number.isNaN(n) || n < 0)) { issue(`${col}: debe ser un número mayor o igual a 0`); bad = true; break }
          nums[col] = n
        }
        if (bad) continue
        const allowQty = parseBool(rec.cell.permite_cantidad)
        const isDefault = parseBool(rec.cell.por_defecto)
        if (!isBlank(rec.cell.permite_cantidad) && allowQty === undefined) { issue('permite_cantidad: use si o no'); continue }
        if (!isBlank(rec.cell.por_defecto) && isDefault === undefined) { issue('por_defecto: use si o no'); continue }
        const groups = (it.combo_groups ??= [])
        let g = groups.find((x) => x.name.toLowerCase() === gname.toLowerCase())
        if (!g) {
          g = {
            row_number: rec.row, name: gname, selection_type: tipo ?? 'fixed',
            ...(nums.minimo != null ? { min_select: nums.minimo } : {}),
            ...(nums.maximo != null ? { max_select: nums.maximo } : {}),
            allow_quantity: allowQty ?? false,
            ...(nums.orden ? { sort_order: nums.orden } : {}),
            items: [],
          }
          groups.push(g)
        } else if (tipo !== undefined && tipo !== g.selection_type) {
          issue(`tipo: no coincide con la primera fila del grupo «${gname}» (fila ${g.row_number})`)
          continue
        }
        if (g.items.some((x) => x.product_code.toLowerCase() === pcode.toLowerCase())) {
          issue(`El producto «${pcode}» está repetido en el grupo «${gname}»`)
          continue
        }
        g.items.push({
          row_number: rec.row, product_code: pcode,
          ...(nums.cantidad != null ? { default_quantity: nums.cantidad } : {}),
          ...(nums.cantidad_max != null ? { max_quantity: nums.cantidad_max } : {}),
          ...(nums.sobreprecio != null ? { extra_price: nums.sobreprecio } : {}),
          is_default: isDefault ?? false,
        })
      }
    }
  }

  // Reglas entre hojas.
  const comboCodes = new Set<string>()
  for (const it of items) if ((it.combo_groups ?? []).length > 0) comboCodes.add((it.code ?? '').toLowerCase())
  for (const it of items) {
    const code = it.code ?? ''
    const groups = it.combo_groups ?? []
    if (groups.length === 0) continue
    if ((it.presentations ?? []).length > 0) {
      errors.push({ sheet: SHEET_PRESENTATIONS, row: it.presentations![0].row_number, message: `«${code}» es un combo: un combo no tiene presentaciones` })
    }
    if ((it.modifier_groups ?? []).length > 0) {
      errors.push({ sheet: SHEET_EXTRAS, row: it.modifier_groups![0].row_number, message: `«${code}» es un combo: un combo no tiene extras` })
    }
    for (const g of groups) {
      if (g.selection_type === 'fixed' && g.items.length !== 1) {
        errors.push({ sheet: SHEET_COMBOS, row: g.row_number, message: `El grupo «${g.name}» es de tipo fijo: debe tener exactamente un producto` })
      }
      for (const ci of g.items) {
        const c = ci.product_code.toLowerCase()
        if (c === code.toLowerCase()) errors.push({ sheet: SHEET_COMBOS, row: ci.row_number, message: 'Un combo no puede contenerse a sí mismo' })
        else if (comboCodes.has(c)) errors.push({ sheet: SHEET_COMBOS, row: ci.row_number, message: `«${ci.product_code}» también es un combo: un combo no puede contener otro combo` })
      }
    }
  }

  if (items.length > ADVANCED_MAX_PRODUCTS) {
    errors.push({ sheet: SHEET_PRODUCTS, row: 0, message: `Máximo ${ADVANCED_MAX_PRODUCTS} productos por archivo (tiene ${items.length}). Divida el Excel.` })
  }

  errors.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row)
  // Los combos van al final: sus componentes deben existir cuando se arma el combo (el backend también lo garantiza por lote).
  items.sort((a, b) => Number((a.combo_groups ?? []).length > 0) - Number((b.combo_groups ?? []).length > 0))
  return { items, errors, warnings, counts }
}

// ── Envío por lotes ──────────────────────────────────────────────────────────────────────────────

export type AdvancedTotals = {
  created: number
  updated: number
  stockRegistered: number
  presentations: { created: number; updated: number; deactivated: number }
  modGroups: { created: number; updated: number }
  modOptions: { created: number; updated: number; deactivated: number }
  modLinks: { created: number; removed: number }
  comboGroups: { created: number; updated: number; deactivated: number }
  failed: { row: number; name: string; error: string }[]
  /** Platos nuevos omitidos porque el plan llegó a su tope de productos. */
  limitSkipped: number
}

export type AdvancedProgress = { done: number; total: number; current?: string }

function emptyTotals(): AdvancedTotals {
  return {
    created: 0, updated: 0, stockRegistered: 0,
    presentations: { created: 0, updated: 0, deactivated: 0 },
    modGroups: { created: 0, updated: 0 },
    modOptions: { created: 0, updated: 0, deactivated: 0 },
    modLinks: { created: 0, removed: 0 },
    comboGroups: { created: 0, updated: 0, deactivated: 0 },
    failed: [],
    limitSkipped: 0,
  }
}

function addResult(t: AdvancedTotals, r: BulkImportAdvancedResultPayload) {
  t.created += r.created ?? 0
  t.updated += r.updated ?? 0
  t.stockRegistered += r.stock_registered ?? 0
  t.presentations.created += r.presentations_created ?? 0
  t.presentations.updated += r.presentations_updated ?? 0
  t.presentations.deactivated += r.presentations_deactivated ?? 0
  t.modGroups.created += r.modifier_groups_created ?? 0
  t.modGroups.updated += r.modifier_groups_updated ?? 0
  t.modOptions.created += r.modifier_options_created ?? 0
  t.modOptions.updated += r.modifier_options_updated ?? 0
  t.modOptions.deactivated += r.modifier_options_deactivated ?? 0
  t.modLinks.created += r.modifier_links_created ?? 0
  t.modLinks.removed += r.modifier_links_removed ?? 0
  t.comboGroups.created += r.combo_groups_created ?? 0
  t.comboGroups.updated += r.combo_groups_updated ?? 0
  t.comboGroups.deactivated += r.combo_groups_deactivated ?? 0
  t.limitSkipped += r.limit_skipped ?? 0
  t.failed.push(...(r.failed ?? []))
}

/**
 * Envía los platos al backend. Con dryRun=true el servidor simula TODO el archivo en una sola
 * transacción que se revierte (los combos referencian platos de otros lotes); sirve para el resumen
 * previo. La importación real va por lotes de ADVANCED_BATCH_SIZE, con los combos al final.
 */
export async function runAdvancedBatches(
  items: BulkImportAdvancedItemPayload[],
  branchId: number,
  dryRun: boolean,
  onProgress?: (p: AdvancedProgress) => void,
): Promise<AdvancedTotals> {
  const totals = emptyTotals()
  const size = dryRun ? Math.max(items.length, 1) : ADVANCED_BATCH_SIZE
  for (let offset = 0; offset < items.length; offset += size) {
    const chunk = items.slice(offset, offset + size)
    onProgress?.({ done: offset, total: items.length, current: chunk[0]?.name })
    try {
      addResult(totals, await productsService.bulkImportRestaurantAdvanced(chunk, branchId, dryRun))
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Error al enviar el lote')
      for (const it of chunk) totals.failed.push({ row: it.row_number, name: it.name, error: msg })
    }
    onProgress?.({ done: offset + chunk.length, total: items.length })
  }
  return totals
}
