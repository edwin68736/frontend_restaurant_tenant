export function isAbortError(err: unknown): boolean {
  if (err == null) return false
  if (typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ERR_CANCELED') return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'CanceledError') return true
  return false
}
