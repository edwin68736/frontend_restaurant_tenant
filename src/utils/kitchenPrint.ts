import { toast } from 'sonner'
import type { Comanda, SessionDetail } from '@/services/restaurant.service'
import { restaurantService } from '@/services/restaurant.service'
import {
  getConfiguredPrinter,
  isAutoPrintEnabled,
  isWindowsDesktop,
  printComandaAuto,
} from '@/services/printers.service'
import { sessionComandaPrintLabels } from '@/utils/posOrderHelpers'

export type KitchenPrintLine = {
  productName: string
  quantity: number
  notes?: string | null
  preparationArea?: string
}

const DEFAULT_AREA = 'cocina'

/** Agrupa líneas por área de preparación para tickets separados (cocina, bar, etc.). */
export function groupLinesByPreparationArea(lines: KitchenPrintLine[]): Map<string, KitchenPrintLine[]> {
  const groups = new Map<string, KitchenPrintLine[]>()
  for (const line of lines) {
    const key = (line.preparationArea || DEFAULT_AREA).trim().toLowerCase() || DEFAULT_AREA
    const bucket = groups.get(key) ?? []
    bucket.push(line)
    groups.set(key, bucket)
  }
  return groups
}

export function comandasToPrintLines(comandas: Comanda[]): KitchenPrintLine[] {
  return comandas.map((c) => ({
    productName: c.product_name,
    quantity: c.quantity,
    notes: c.notes ?? null,
    preparationArea: (c as Comanda & { preparation_area?: string }).preparation_area,
  }))
}

function areaTicketLabel(baseTableName: string, area: string): string {
  const label = area.trim().toLowerCase()
  if (!label || label === DEFAULT_AREA) return baseTableName
  return `${baseTableName} · ${label.toUpperCase()}`
}

/**
 * Imprime SOLO las líneas de la ronda indicada (nunca recalcula desde el pedido completo).
 * Reimpresión: pasar las mismas comandas persistidas de esa ronda.
 */
export async function printKitchenRound(params: {
  sessionDetail: SessionDetail | null
  orderCode: string
  orderNumber: number
  tableOrderId: number
  /** Líneas exactas de esta ronda (respuesta de addOrder o comandas del order_id en sesión). */
  comandas: Comanda[]
  silentConfigError?: boolean
  /** false en reimpresión: no actualiza printed_at de nuevo */
  markPrinted?: boolean
}): Promise<boolean> {
  const { sessionDetail, orderCode, orderNumber, tableOrderId, comandas } = params
  if (comandas.length === 0) {
    toast.error('No hay ítems para imprimir en esta comanda')
    return false
  }

  const labels = sessionComandaPrintLabels(sessionDetail, orderCode)
  const lines = comandasToPrintLines(comandas)
  const groups = groupLinesByPreparationArea(lines)

  if (!isWindowsDesktop() || !isAutoPrintEnabled('comandas')) {
    return false
  }

  const cfg = getConfiguredPrinter('comandas')
  if (!cfg) {
    if (!params.silentConfigError) {
      toast.error('Configura la impresora de comandas en Ajustes')
    }
    return false
  }

  try {
    for (const [area, areaLines] of groups) {
      const msg = await printComandaAuto({
        tableName: areaTicketLabel(labels.tableName ?? orderCode, area),
        orderNumber,
        waiterName: labels.waiterName,
        items: areaLines.map((l) => ({
          productName: l.productName,
          quantity: l.quantity,
          notes: l.notes,
        })),
      })
      if (msg && groups.size === 1) {
        toast.success(msg)
      }
    }
    if (params.markPrinted !== false) {
      await restaurantService.markTableOrderPrinted(tableOrderId)
    }
    if (groups.size > 1) {
      toast.success(`Comanda #${orderNumber} enviada (${groups.size} tickets por área)`)
    }
    return true
  } catch (e) {
    console.error('[kitchen print error]', e)
    toast.error('No se pudo imprimir la comanda. Revisa la consola de Tauri (cargo).')
    return false
  }
}
