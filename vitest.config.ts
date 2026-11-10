import { defineConfig } from 'vitest/config'
import path from 'path'

/** Config mínima de pruebas (separada de vite.config.ts para no cargar el proxy de desarrollo). */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
