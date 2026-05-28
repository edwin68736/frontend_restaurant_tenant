import { isDevelopmentMode } from '@/lib/runtime/environment'
import { getResolvedTenantApiUrl } from '@/lib/tenantBinding/store'
import { normalizeBindingApiUrl } from '@/lib/tenantBinding/types'
import { classifyProbeError } from './classifyError'
import { CONNECTIVITY_DEFAULTS, CONNECTIVITY_PROBE_PATH } from './types'

export type ProbeResult =
  | { ok: true }
  | { ok: false; kind: ReturnType<typeof classifyProbeError>['kind']; message: string }

function buildProbeUrl(): string {
  if (isDevelopmentMode()) {
    return CONNECTIVITY_PROBE_PATH
  }
  const base = getResolvedTenantApiUrl()
  if (!base) return CONNECTIVITY_PROBE_PATH
  return `${normalizeBindingApiUrl(base)}${CONNECTIVITY_PROBE_PATH}`
}

function buildProbeHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (isDevelopmentMode()) {
    const tenant = getResolvedTenantApiUrl()
    if (tenant) {
      headers['X-Tenant-Api-Origin'] = normalizeBindingApiUrl(tenant)
    }
  }
  return headers
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  return false
}

/**
 * Probe liviano sin Authorization (el health es público).
 * En dev pasa por el proxy Vite con X-Tenant-Api-Origin.
 */
export async function probeBackendHealth(
  timeoutMs = CONNECTIVITY_DEFAULTS.probeTimeoutMs,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  const abortProbe = () => controller.abort()
  signal?.addEventListener('abort', abortProbe)
  if (signal?.aborted) controller.abort()

  try {
    const res = await fetch(buildProbeUrl(), {
      method: 'GET',
      headers: buildProbeHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (res.status >= 200 && res.status < 500) {
      return { ok: true }
    }
    return {
      ok: false,
      kind: 'server_error',
      message: 'El servidor respondió con un error interno.',
    }
  } catch (err) {
    if (isAbortError(err)) return { ok: true }
    const { kind, message } = classifyProbeError(err)
    if (kind === 'none') return { ok: true }
    return { ok: false, kind, message }
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortProbe)
  }
}
