import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

export function PayDot({ kind, size = 11 }: { kind: 'ok' | 'warn' | 'danger'; size?: number }) {
  if (kind === 'ok') return <CheckCircle2 size={size} className="text-emerald-600 shrink-0" />
  if (kind === 'danger') return <XCircle size={size} className="text-red-600 shrink-0" />
  return <AlertTriangle size={size} className="text-amber-600 shrink-0" />
}
