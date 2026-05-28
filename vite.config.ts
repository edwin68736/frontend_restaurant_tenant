import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import httpProxy from 'http-proxy'

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

/**
 * En DEV (npm run dev / tauri dev) enruta /api al central o al tenant según header X-Tenant-Api-Origin.
 * Evita CORS cuando la WebView usa http://localhost:5175.
 */
function dynamicApiProxyPlugin(defaultTarget: string): Plugin {
  const secure = defaultTarget.startsWith('https://')
  const proxy = httpProxy.createProxyServer({ changeOrigin: true, secure })

  return {
    name: 'tukichef-dynamic-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!/^\/(api|uploads|storage|health)(\/|$)/.test(url)) {
          next()
          return
        }

        const raw = req.headers['x-tenant-api-origin']
        const target =
          typeof raw === 'string' && raw.trim()
            ? normalizeApiOrigin(raw.trim())
            : defaultTarget

        delete req.headers['x-tenant-api-origin']

        proxy.web(req, res, { target }, (err: Error | null | undefined) => {
          if (err) {
            console.error('[tukichef proxy]', target, err.message)
            if (!res.headersSent) {
              res.statusCode = 502
              res.end('Proxy error')
            }
            return
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const centralTarget = normalizeApiOrigin(env.VITE_CENTRAL_API_URL || env.VITE_API_URL)

  return {
    base: useRelativeBase(mode) ? './' : '/',
    plugins: [react(), dynamicApiProxyPlugin(centralTarget)],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    optimizeDeps: {
      include: ['@tauri-apps/api/core', '@capacitor/core'],
    },
    server: {
      port: 5175,
      strictPort: true,
    },
  }
})
