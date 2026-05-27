import manifest from '../../tukichef.version.json'

/** Nombre visible de la app (Tukichef). */
export const TUKICHEF_APP_NAME = manifest.name

/** Versión semver mostrada al usuario (ej. 1.0.0). */
export const TUKICHEF_VERSION = manifest.version

/** Código entero para Android (Play Store / APK). */
export const TUKICHEF_VERSION_CODE = manifest.versionCode

/** Etiqueta lista para UI: "Tukichef 1.0.0". */
export const TUKICHEF_VERSION_LABEL = `${TUKICHEF_APP_NAME} ${TUKICHEF_VERSION}`
