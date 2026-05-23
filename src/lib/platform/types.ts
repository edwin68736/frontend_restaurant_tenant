/** Entorno de ejecución de Tukichef (web, escritorio Tauri, móvil Capacitor). */
export type AppRuntime = 'web' | 'tauri' | 'capacitor'

export type CapacitorPlatform = 'android' | 'ios' | 'unknown'

/** Clasificación de dispositivo para política de orientación y layout. */
export type DeviceFormFactor = 'phone' | 'tablet'
