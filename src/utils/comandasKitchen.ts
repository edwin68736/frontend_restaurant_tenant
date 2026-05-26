import type { KitchenComanda } from '@/services/restaurant.service'
import { ORDER_TYPE_LABELS } from '@/types/restaurantOrder'

export type ComandaStatus = 'pendiente' | 'preparacion' | 'lista' | 'entregada'

export const COMANDA_STATUS_ORDER: ComandaStatus[] = ['pendiente', 'preparacion', 'lista', 'entregada']

export const COMANDA_STATUS_LABEL: Record<ComandaStatus, string> = {
  pendiente: 'Pendiente',
  preparacion: 'En preparación',
  lista: 'Listo',
  entregada: 'Entregado',
}

export const NEXT_COMANDA_STATUS: Partial<Record<ComandaStatus, ComandaStatus>> = {
  pendiente: 'preparacion',
  preparacion: 'lista',
  lista: 'entregada',
}

const STATUS_RANK: Record<ComandaStatus, number> = {
  pendiente: 0,
  preparacion: 1,
  lista: 2,
  entregada: 3,
}

export function normalizeComandaStatus(status: string): ComandaStatus {
  if (status === 'preparacion' || status === 'lista' || status === 'entregada') return status
  return 'pendiente'
}

export function comandaStatusRank(status: string): number {
  return STATUS_RANK[normalizeComandaStatus(status)]
}

/** Solo avance: no retroceder ni repetir el mismo estado. */
export function canAdvanceComandaStatus(current: string, target: string): boolean {
  const cur = normalizeComandaStatus(current)
  const next = normalizeComandaStatus(target)
  return STATUS_RANK[next] > STATUS_RANK[cur]
}

export function getNextComandaStatus(current: string): ComandaStatus | null {
  const cur = normalizeComandaStatus(current)
  return NEXT_COMANDA_STATUS[cur] ?? null
}

export type KitchenRoundGroup = {
  orderId: number
  orderNumber: number
  items: KitchenComanda[]
}

export type KitchenSessionGroup = {
  sessionId: number
  meta: {
    orderCode: string
    orderType: string
    orderStatus: string
    tableId: number | null
    tableName: string
    floorName: string
    customerName: string
    customerPhone: string
    deliveryAddress: string
    waiterName: string
    driverName: string
    openedAt: string
  }
  rounds: KitchenRoundGroup[]
  /** Ítems activos (no entregados) para badges */
  activeCount: number
  pendingCount: number
}

export function kitchenSessionTitle(g: KitchenSessionGroup): string {
  const m = g.meta
  if (m.orderType === 'dine_in' && m.tableName) {
    return m.floorName ? `${m.tableName} · ${m.floorName}` : m.tableName
  }
  if (m.orderType === 'delivery') {
    return `Delivery ${m.orderCode || ''}`.trim()
  }
  if (m.orderType === 'takeaway') {
    return `Para llevar ${m.orderCode || ''}`.trim()
  }
  return m.orderCode || `Pedido #${g.sessionId}`
}

export function kitchenSessionSubtitle(g: KitchenSessionGroup): string | null {
  const parts: string[] = []
  const m = g.meta
  if (m.orderType === 'delivery') {
    if (m.deliveryAddress) parts.push(m.deliveryAddress)
    if (m.driverName) parts.push(`Rep.: ${m.driverName}`)
  }
  if (m.customerName) parts.push(m.customerName)
  if (m.customerPhone) parts.push(m.customerPhone)
  if (m.orderType === 'dine_in' && m.waiterName) parts.push(`Mozo: ${m.waiterName}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function groupKitchenComandas(comandas: KitchenComanda[]): KitchenSessionGroup[] {
  const bySession = new Map<number, KitchenComanda[]>()
  for (const c of comandas) {
    const list = bySession.get(c.session_id) ?? []
    list.push(c)
    bySession.set(c.session_id, list)
  }

  const groups: KitchenSessionGroup[] = []
  for (const [sessionId, lines] of bySession) {
    const first = lines[0]
    const meta = {
      orderCode: first.order_code ?? '',
      orderType: first.order_type ?? 'dine_in',
      orderStatus: first.order_status ?? '',
      tableId: first.table_id ?? null,
      tableName: first.table_name ?? '',
      floorName: first.floor_name ?? '',
      customerName: first.customer_name ?? '',
      customerPhone: first.customer_phone ?? '',
      deliveryAddress: first.delivery_address ?? '',
      waiterName: first.waiter_name ?? '',
      driverName: first.driver_name ?? '',
      openedAt: first.session_opened_at ?? first.created_at ?? '',
    }

    const byRound = new Map<number, KitchenComanda[]>()
    for (const line of lines) {
      const bucket = byRound.get(line.order_id) ?? []
      bucket.push(line)
      byRound.set(line.order_id, bucket)
    }
    const rounds: KitchenRoundGroup[] = Array.from(byRound.entries())
      .map(([orderId, items]) => ({
        orderId,
        orderNumber: items[0]?.order_number ?? 0,
        items: items.sort((a, b) => a.id - b.id),
      }))
      .sort((a, b) => a.orderNumber - b.orderNumber)

    const activeCount = lines.filter((l) => l.status !== 'entregada').length
    const pendingCount = lines.filter((l) => l.status === 'pendiente').length

    groups.push({ sessionId, meta, rounds, activeCount, pendingCount })
  }

  return groups.sort((a, b) => {
    const ta = a.meta.openedAt ? new Date(a.meta.openedAt).getTime() : 0
    const tb = b.meta.openedAt ? new Date(b.meta.openedAt).getTime() : 0
    return ta - tb
  })
}

export function tableFilterOptions(groups: KitchenSessionGroup[]): { id: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const g of groups) {
    if (g.meta.orderType !== 'dine_in' || !g.meta.tableName) continue
    const key = g.meta.tableId != null ? `t-${g.meta.tableId}` : g.meta.tableName
    const label = g.meta.floorName ? `${g.meta.tableName} (${g.meta.floorName})` : g.meta.tableName
    const prev = map.get(key)
    map.set(key, { label, count: (prev?.count ?? 0) + g.activeCount })
  }
  return Array.from(map.entries())
    .map(([id, v]) => ({ id, label: v.label, count: v.count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export function orderTypeLabel(orderType: string): string {
  return ORDER_TYPE_LABELS[orderType] ?? orderType
}
