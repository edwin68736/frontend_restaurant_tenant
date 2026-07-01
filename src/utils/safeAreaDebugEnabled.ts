/** Panel de diagnóstico de safe areas (solo dev o build con VITE_DEBUG_SAFE_AREA=true). */
export function isSafeAreaDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEBUG_SAFE_AREA === 'true'
}
