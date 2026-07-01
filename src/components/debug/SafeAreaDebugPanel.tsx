import { createPortal } from 'react-dom'
import { useSafeAreaDebugMetrics } from '@/hooks/useSafeAreaDebugMetrics'

function formatPx(value: number | null): string {
  if (value == null) return 'n/a'
  return `${value.toFixed(1)}px`
}

/**
 * Panel flotante de diagnóstico: valores reales de safe area y viewport en el WebView.
 * No altera el layout de la app (position: fixed + portal en body).
 */
export default function SafeAreaDebugPanel() {
  const metrics = useSafeAreaDebugMetrics()

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-2 left-2 z-[99999] max-w-[min(100vw-1rem,18rem)] rounded-md border border-emerald-500/40 bg-black/85 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-emerald-300 shadow-lg backdrop-blur-sm"
      aria-hidden
      data-safe-area-debug
    >
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90">
        Safe area debug
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-stone-400">safe-top</dt>
        <dd>{formatPx(metrics.safeTop)}</dd>
        <dt className="text-stone-400">safe-bottom</dt>
        <dd>{formatPx(metrics.safeBottom)}</dd>
        <dt className="text-stone-400">safe-left</dt>
        <dd>{formatPx(metrics.safeLeft)}</dd>
        <dt className="text-stone-400">safe-right</dt>
        <dd>{formatPx(metrics.safeRight)}</dd>
        <dt className="text-stone-400">innerWidth</dt>
        <dd>{metrics.innerWidth}px</dd>
        <dt className="text-stone-400">innerHeight</dt>
        <dd>{metrics.innerHeight}px</dd>
        <dt className="text-stone-400">orientation</dt>
        <dd className="break-all">{metrics.orientation}</dd>
        <dt className="text-stone-400">vv.width</dt>
        <dd>{formatPx(metrics.visualViewportWidth)}</dd>
        <dt className="text-stone-400">vv.height</dt>
        <dd>{formatPx(metrics.visualViewportHeight)}</dd>
      </dl>
      <div className="mt-1 text-[9px] text-stone-500">
        {new Date(metrics.updatedAt).toLocaleTimeString()}
      </div>
    </div>,
    document.body,
  )
}
