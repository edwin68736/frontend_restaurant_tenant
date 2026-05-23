import { App } from '@capacitor/app'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isCapacitorNative, isCapacitorAndroid } from './detect'
import { applyOrientationPolicy, startOrientationPolicyWatcher } from './orientationPolicy'

let bootstrapped = false
let stopOrientationWatcher: (() => void) | null = null

function setPlatformHtmlClass(): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.classList.remove('platform-web', 'platform-tauri', 'platform-capacitor', 'platform-android', 'platform-ios')
  if (!isCapacitorNative()) {
    html.classList.add('platform-web')
    return
  }
  html.classList.add('platform-capacitor')
  if (isCapacitorAndroid()) html.classList.add('platform-android')
  else html.classList.add('platform-ios')
}

/**
 * Inicialización única de plugins Capacitor (safe area edge-to-edge, status bar, teclado, orientación).
 */
export async function bootstrapCapacitor(): Promise<void> {
  if (!isCapacitorNative() || bootstrapped) return
  bootstrapped = true

  setPlatformHtmlClass()

  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Light })
    if (isCapacitorAndroid()) {
      await StatusBar.setBackgroundColor({ color: '#00000000' })
    }
  } catch (e) {
    console.warn('[Tukichef] StatusBar', e)
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
    await Keyboard.setScroll({ isDisabled: false })
  } catch (e) {
    console.warn('[Tukichef] Keyboard', e)
  }

  stopOrientationWatcher = startOrientationPolicyWatcher()

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void applyOrientationPolicy()
  }).catch(() => {})
}

export function teardownCapacitor(): void {
  stopOrientationWatcher?.()
  stopOrientationWatcher = null
}
