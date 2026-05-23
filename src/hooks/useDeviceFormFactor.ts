import { useEffect, useState } from 'react'
import { getDeviceFormFactor, measureScreenEdges, allowsLandscapeOrientation } from '@/lib/platform/formFactor'
import type { DeviceFormFactor } from '@/lib/platform/types'

export function useDeviceFormFactor() {
  const [formFactor, setFormFactor] = useState<DeviceFormFactor>(() => getDeviceFormFactor())
  const [landscapeAllowed, setLandscapeAllowed] = useState(() => allowsLandscapeOrientation())

  useEffect(() => {
    const update = () => {
      const edges = measureScreenEdges()
      setFormFactor(getDeviceFormFactor(edges))
      setLandscapeAllowed(allowsLandscapeOrientation(edges))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return { formFactor, landscapeAllowed, isPhone: formFactor === 'phone', isTablet: formFactor === 'tablet' }
}
