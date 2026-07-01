import { useCallback, useEffect, useState } from 'react'
import { readSafeInsets } from '@/utils/safeAreaInsets'

export type SafeAreaDebugMetrics = {
  safeTop: number
  safeBottom: number
  safeLeft: number
  safeRight: number
  innerWidth: number
  innerHeight: number
  orientation: string
  visualViewportWidth: number | null
  visualViewportHeight: number | null
  updatedAt: number
}

function readOrientationLabel(): string {
  if (typeof screen !== 'undefined' && screen.orientation) {
    return `${screen.orientation.type} (${screen.orientation.angle}°)`
  }
  if (typeof window !== 'undefined' && 'orientation' in window) {
    return `${String(window.orientation)}° (legacy)`
  }
  return 'n/a'
}

function snapshotMetrics(): SafeAreaDebugMetrics {
  const { top, bottom, left, right } = readSafeInsets()
  const vv = typeof window !== 'undefined' ? window.visualViewport : null

  return {
    safeTop: top,
    safeBottom: bottom,
    safeLeft: left,
    safeRight: right,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    orientation: readOrientationLabel(),
    visualViewportWidth: vv?.width ?? null,
    visualViewportHeight: vv?.height ?? null,
    updatedAt: Date.now(),
  }
}

export function useSafeAreaDebugMetrics(): SafeAreaDebugMetrics {
  const [metrics, setMetrics] = useState<SafeAreaDebugMetrics>(() => snapshotMetrics())

  const refresh = useCallback(() => {
    setMetrics(snapshotMetrics())
  }, [])

  useEffect(() => {
    refresh()

    window.addEventListener('resize', refresh)
    window.addEventListener('orientationchange', refresh)

    const vv = window.visualViewport
    vv?.addEventListener('resize', refresh)

    return () => {
      window.removeEventListener('resize', refresh)
      window.removeEventListener('orientationchange', refresh)
      vv?.removeEventListener('resize', refresh)
    }
  }, [refresh])

  return metrics
}
