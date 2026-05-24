import { billingService, type BillingStatusResponse } from '@/services/billing.service'

const TERMINAL = new Set([
  'SUNAT_ACCEPTED',
  'SUNAT_REJECTED',
  'OBSERVED',
  'FAILED',
  'DEAD_LETTER',
  'UNKNOWN',
])

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000]
const MAX_WAIT_MS = 60_000

export function isBillingTerminal(status: string): boolean {
  return TERMINAL.has(status)
}

export function billingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING_QUEUE: 'En cola',
    PROCESSING: 'Procesando',
    SENDING_TO_FACTURADOR: 'Enviando al facturador',
    SENDING_TO_SUNAT: 'Enviando a SUNAT',
    SUNAT_ACCEPTED: 'Aceptada por SUNAT',
    SUNAT_REJECTED: 'Rechazada',
    FAILED: 'Error',
  }
  return labels[status] ?? 'En proceso…'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Polling cancelado', 'AbortError'))
      return
    }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Polling cancelado', 'AbortError'))
    }, { once: true })
  })
}

function isDone(st: BillingStatusResponse): boolean {
  if (st.safe_to_print || st.status === 'SUNAT_ACCEPTED') return true
  if (isBillingTerminal(st.status)) return true
  return !st.async_in_progress && st.status !== 'PENDING_QUEUE'
}

export async function pollBillingStatus(
  saleId: number,
  opts?: { signal?: AbortSignal; onTick?: (s: BillingStatusResponse) => void },
): Promise<BillingStatusResponse> {
  const start = Date.now()
  let attempt = 0
  for (;;) {
    if (opts?.signal?.aborted) throw new DOMException('Polling cancelado', 'AbortError')
    const st = await billingService.getStatus(saleId)
    opts?.onTick?.(st)
    if (isDone(st)) return st
    if (Date.now() - start >= MAX_WAIT_MS) {
      throw new Error('Tiempo de espera agotado')
    }
    await sleep(BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)], opts?.signal)
  }
}
