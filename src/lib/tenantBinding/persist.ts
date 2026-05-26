import { Preferences } from '@capacitor/preferences'
import { invoke } from '@tauri-apps/api/core'
import { isCapacitorNative, isTauriDesktop } from '@/lib/platform/detect'
import { parseTenantBinding, TENANT_BINDING_VERSION, type TenantBinding } from './types'

const PREFS_KEY = 'tukichef_tenant_binding_v1'

/** Lee vinculación desde almacenamiento nativo (Capacitor / Tauri). */
export async function readTenantBindingFromDevice(): Promise<TenantBinding | null> {
  if (isTauriDesktop()) {
    try {
      const raw = await invoke<string | null>('tenant_binding_read')
      return parseTenantBinding(raw ?? undefined)
    } catch (e) {
      console.error('[tenant-binding] tauri read failed', e)
      return null
    }
  }
  if (isCapacitorNative()) {
    try {
      const { value } = await Preferences.get({ key: PREFS_KEY })
      return parseTenantBinding(value)
    } catch (e) {
      console.error('[tenant-binding] preferences read failed', e)
      return null
    }
  }
  return null
}

/** Persiste en disco nativo. Una vez guardado, la app no permite otra empresa. */
export async function writeTenantBindingToDevice(binding: TenantBinding): Promise<void> {
  const payload = JSON.stringify(binding)
  if (isTauriDesktop()) {
    await invoke('tenant_binding_write', { payload })
    return
  }
  if (isCapacitorNative()) {
    await Preferences.set({ key: PREFS_KEY, value: payload })
    return
  }
}

export async function clearTenantBindingOnDevice(): Promise<void> {
  if (isTauriDesktop()) {
    try {
      await invoke('tenant_binding_clear')
    } catch {
      /* ignore */
    }
    return
  }
  if (isCapacitorNative()) {
    try {
      await Preferences.remove({ key: PREFS_KEY })
    } catch {
      /* ignore */
    }
  }
}

/** Migra datos legacy de localStorage (versiones anteriores). */
export function readLegacyLocalStorageBinding(): TenantBinding | null {
  if (typeof localStorage === 'undefined') return null
  const slug = localStorage.getItem('tenantSlug')?.trim()
  const apiUrl = localStorage.getItem('tenantApiUrl')?.trim()
  if (!slug || !apiUrl) return null
  return {
    version: TENANT_BINDING_VERSION,
    slug,
    apiUrl,
    name: localStorage.getItem('tenantName')?.trim() ?? '',
    ruc: localStorage.getItem('tenantRuc')?.trim() ?? '',
    tokenConsultaDatos: localStorage.getItem('tokenConsultaDatos')?.trim() ?? '',
    boundAt: new Date().toISOString(),
  }
}

export function clearLegacyLocalStorageBinding(): void {
  if (typeof localStorage === 'undefined') return
  for (const key of ['tenantSlug', 'tenantName', 'tenantRuc', 'tenantApiUrl', 'tokenConsultaDatos']) {
    localStorage.removeItem(key)
  }
}
