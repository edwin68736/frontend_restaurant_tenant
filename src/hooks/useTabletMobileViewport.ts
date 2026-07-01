import { useEffect, useState } from 'react'
import { isTabletMobileViewport } from '@/lib/platform/detect'

/** Re-evalúa en resize / orientación (drawer carrito, FAB en tablets). */
export function useTabletMobileViewport(): boolean {
  const [tablet, setTablet] = useState(() => isTabletMobileViewport())

  useEffect(() => {
    const refresh = () => setTablet(isTabletMobileViewport())
    refresh()
    window.addEventListener('resize', refresh)
    window.addEventListener('orientationchange', refresh)
    window.visualViewport?.addEventListener('resize', refresh)
    return () => {
      window.removeEventListener('resize', refresh)
      window.removeEventListener('orientationchange', refresh)
      window.visualViewport?.removeEventListener('resize', refresh)
    }
  }, [])

  return tablet
}
