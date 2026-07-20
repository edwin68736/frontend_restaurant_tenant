/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend Go central (sin /api). El slug del tenant va por RUC + header X-Tenant-Slug. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.mp3' {
  const src: string
  export default src
}
