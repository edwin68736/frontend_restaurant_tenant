import { toast } from 'sonner'
import type { Comanda, SessionDetail } from '@/services/restaurant.service'
import { restaurantService } from '@/services/restaurant.service'
import { normalizePreparationAreaKey } from '@/constants/preparationAreas'
import type { KitchenRound } from '@/utils/posOrderHelpers'
import {
  getConfiguredComandaDefaultPrinter,
  getConfiguredComandaPrinter,
  isAutoPrintEnabled,
  isNativePrintAvailable,
  printComandaAuto,
} from '@/services/printers.service'
import { sessionComandaPrintLabels } from '@/utils/posOrderHelpers'
import { formatModifierLines, parseStoredModifiers } from '@/utils/productModifiers'

export type KitchenPrintLine = {
  productName: string
  quantity: number
  notes?: string | null
  modifierLines?: string[]
  preparationArea?: string
}

/** Agrupa líneas por área de preparación para tickets separados (cocina, bar, etc.). */
export function groupLinesByPreparationArea(lines: KitchenPrintLine[]): Map<string, KitchenPrintLine[]> {
  const groups = new Map<string, KitchenPrintLine[]>()
  for (const line of lines) {
    const key = normalizePreparationAreaKey(line.preparationArea) || '__default__'
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
    modifierLines: formatModifierLines(parseStoredModifiers(c.modifiers_json)),
    preparationArea: (c as Comanda & { preparation_area?: string }).preparation_area,
  }))
}

function areaTicketLabel(baseTableName: string, areaKey: string): string {
  if (!areaKey || areaKey === '__default__') return baseTableName
  return `${baseTableName} - ${areaKey.toUpperCase()}`
}

/**
 * Imprime SOLO las líneas de la ronda indicada (nunca recalcula desde el pedido completo).
 * Cada área va a su impresora configurada; sin área o sin impresora de área → impresora por defecto.
 */
export async function printKitchenRound(params: {
  sessionDetail: SessionDetail | null
  orderCode: string
  orderNumber: number
  tableOrderId: number
  comandas: Comanda[]
  /** true = botón Reimprimir / impresión explícita (ignora «impresión automática» desactivada). */
  manual?: boolean
  silentConfigError?: boolean
  markPrinted?: boolean
  /** Sin toasts de éxito (p. ej. impresión masiva). */
  quiet?: boolean
}): Promise<boolean> {
  const { sessionDetail, orderCode, orderNumber, tableOrderId, comandas } = params
  if (comandas.length === 0) {
    toast.error('No hay ítems para imprimir en esta comanda')
    return false
  }

  if (!isNativePrintAvailable()) {
    return false
  }
  if (!params.manual && !isAutoPrintEnabled('comandas')) {
    return false
  }

  if (!getConfiguredComandaDefaultPrinter()) {
    if (!params.silentConfigError) {
      toast.error('Configura la impresora de comandas por defecto en Ajustes')
    }
    return false
  }

  const labels = sessionComandaPrintLabels(sessionDetail, orderCode)
  const lines = comandasToPrintLines(comandas)
  const groups = groupLinesByPreparationArea(lines)

  let printedCount = 0
  const errors: string[] = []

  try {
    for (const [areaKey, areaLines] of groups) {
      const prepArea = areaKey === '__default__' ? null : areaKey
      const cfg = getConfiguredComandaPrinter(prepArea)
      if (!cfg) {
        errors.push(areaKey === '__default__' ? 'sin impresora por defecto' : areaKey)
        continue
      }

      await printComandaAuto(
        {
          tableName: areaTicketLabel(labels.tableName ?? orderCode, areaKey),
          orderNumber,
          waiterName: labels.waiterName,
          items: areaLines.map((l) => ({
            productName: l.productName,
            quantity: l.quantity,
            notes: l.notes,
            modifierLines: l.modifierLines,
          })),
        },
        { preparationArea: prepArea, printerConfig: cfg },
      )
      printedCount += 1
    }

    if (printedCount === 0) {
      if (!params.silentConfigError) {
        toast.error('No se pudo imprimir: revisa impresoras de comandas en Ajustes')
      }
      return false
    }

    if (params.markPrinted !== false) {
      await restaurantService.markTableOrderPrinted(tableOrderId)
    }

    if (!params.quiet) {
      if (groups.size > 1) {
        toast.success(`Comanda #${orderNumber} enviada (${printedCount} ticket(s) por área)`)
      } else if (printedCount === 1) {
        toast.success(`Comanda #${orderNumber} enviada a impresora`)
      }
    }

    if (errors.length > 0 && !params.silentConfigError && !params.quiet) {
      toast.message(`Algunas áreas no imprimieron: ${errors.join(', ')}`)
    }

    return true
  } catch (e) {
    console.error('[kitchen print error]', e)
    toast.error(e instanceof Error ? e.message : 'No se pudo imprimir la comanda')
    return false
  }
}

/** Imprime cada ronda por separado (misma lógica que Reimprimir individual). */
export async function printAllKitchenRounds(params: {
  sessionDetail: SessionDetail | null
  orderCode: string
  rounds: KitchenRound[]
  manual?: boolean
  markPrinted?: boolean
}): Promise<boolean> {
  const rounds = params.rounds.filter((r) => r.comandas.length > 0)
  if (rounds.length === 0) {
    toast.error('No hay comandas para imprimir')
    return false
  }

  if (!isNativePrintAvailable()) return false
  if (!(params.manual ?? true) && !isAutoPrintEnabled('comandas')) return false

  if (!getConfiguredComandaDefaultPrinter()) {
    toast.error('Configura la impresora de comandas por defecto en Ajustes')
    return false
  }

  let okCount = 0
  for (const round of rounds) {
    const printed = await printKitchenRound({
      sessionDetail: params.sessionDetail,
      orderCode: params.orderCode,
      orderNumber: round.orderNumber,
      tableOrderId: round.orderId,
      comandas: round.comandas,
      manual: params.manual ?? true,
      silentConfigError: true,
      markPrinted: false,
      quiet: true,
    })
    if (printed) okCount += 1
  }

  if (okCount === 0) return false

  if (params.markPrinted !== false) {
    const orderIds = [...new Set(rounds.map((r) => r.orderId))]
    for (const orderId of orderIds) {
      await restaurantService.markTableOrderPrinted(orderId)
    }
  }

  if (okCount === rounds.length) {
    toast.success(
      okCount === 1 ? 'Comanda enviada a impresora' : `Se imprimieron ${okCount} comandas`,
    )
  } else {
    toast.message(`Se imprimieron ${okCount} de ${rounds.length} comandas`)
  }

  return true
}
