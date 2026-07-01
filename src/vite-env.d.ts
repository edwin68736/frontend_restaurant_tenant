/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend Go central (sin /api). El slug del tenant va por RUC + header X-Tenant-Slug. */
  readonly VITE_API_URL?: string
  /** Muestra panel flotante con insets y viewport (diagnóstico WebView Android). */
  readonly VITE_DEBUG_SAFE_AREA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.mp3' {
  const src: string
  export default src
}
