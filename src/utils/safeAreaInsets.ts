/** Lee los insets seguros desde las variables CSS (--safe-*). */
export function readSafeInsets(): { top: number; bottom: number; left: number; right: number } {
  if (typeof document === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }
  const style = getComputedStyle(document.documentElement)
  return {
    top: parseFloat(style.getPropertyValue('--safe-top')) || 0,
    bottom: parseFloat(style.getPropertyValue('--safe-bottom')) || 0,
    left: parseFloat(style.getPropertyValue('--safe-left')) || 0,
    right: parseFloat(style.getPropertyValue('--safe-right')) || 0,
  }
}
