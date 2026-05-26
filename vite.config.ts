import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/** Rutas relativas para Tauri (file) y Capacitor (asset en WebView). */
function useRelativeBase(mode: string): boolean {
  return Boolean(process.env.TAURI_PLATFORM) || mode === 'capacitor'
}

function normalizeApiOrigin(raw: string | undefined): string {
  const fallback = 'http://localhost:3000'
  if (!raw?.trim()) return fallback
  let base = raw.trim().replace(/\/+$/, '')
  if (base.endsWith('/api')) base = base.slice(0, -4)
  return base
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = normalizeApiOrigin(env.VITE_API_URL || env.VITE_CENTRAL_API_URL)

  return {
    base: useRelativeBase(mode) ? './' : '/',
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    optimizeDeps: {
      include: ['@tauri-apps/api/core', '@capacitor/core'],
    },
    server: {
      port: 5175,
      strictPort: true,
      proxy: {
        '/api': { target: apiProxyTarget, changeOrigin: true, secure: apiProxyTarget.startsWith('https://') },
        '/uploads': { target: apiProxyTarget, changeOrigin: true, secure: apiProxyTarget.startsWith('https://') },
        '/storage': { target: apiProxyTarget, changeOrigin: true, secure: apiProxyTarget.startsWith('https://') },
      },
    },
  }
})
