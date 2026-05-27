import { TUKICHEF_VERSION, TUKICHEF_VERSION_LABEL } from '@/lib/appVersion'

type Props = {
  className?: string
  /** En menú compacto solo muestra "v1.0.0". */
  compact?: boolean
}

export function AppVersionBadge({ className = '', compact = false }: Props) {
  return (
    <p
      className={`text-xs text-green-600 tabular-nums ${className}`}
      title={TUKICHEF_VERSION_LABEL}
    >
      {compact ? `v${TUKICHEF_VERSION}` : TUKICHEF_VERSION_LABEL}
    </p>
  )
}
