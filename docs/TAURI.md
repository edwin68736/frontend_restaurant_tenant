# Tukichef — Tauri (Windows) y URL del backend

## Qué va en `.env` y qué no

| Variable | Dónde | Qué es |
|----------|--------|--------|
| `VITE_API_URL` | Archivo `.env.*` | URL del **backend central** (Go), fija al compilar |
| Tenant (empresa) | Pantalla **RUC** en la app | Variable por cliente; se guarda en `localStorage` y va en `X-Tenant-Slug` |

No mezcles el RUC ni el slug del tenant en `.env`. Solo la URL del API.

Formato correcto:

```env
VITE_API_URL=https://api.tukifac.com
```

Incorrecto:

```env
VITE_API_URL=https://api.tukifac.com/api
VITE_TENANT_SLUG=mi-empresa   # en Tukichef no se usa; el RUC define el tenant
```

## Archivos por comando

| Comando | Modo Vite | Archivos cargados (orden) |
|---------|-----------|---------------------------|
| `npm run dev` | `development` | `.env`, `.env.local`, `.env.development`, `.env.development.local` |
| `npm run tauri:dev` | `development` | Igual que arriba |
| `npm run build` | `production` | `.env`, `.env.local`, `.env.production`, `.env.production.local` |
| `npm run tauri:build` | `production` | Igual (ejecuta `npm run build` antes) |
| `npm run build:android` | `capacitor` | `.env`, `.env.capacitor`, `.env.capacitor.local` |

Copia `.env.example` y crea los que necesites. **`.env.local`** y **`*.local`** no se suben a git (secretos locales).

## Iconos de Windows

Desde `public/logo-tukichef.png`:

```bash
npm run icons:generate
```

Actualiza `src-tauri/icons/icon.ico`, `icon.png` y el resto de tamaños que usa el instalador. Luego `npm run tauri:build`.

## Configuración rápida

**Desarrollo contra backend local:**

```bash
# .env.development (ya incluido en el repo)
VITE_API_URL=http://localhost:3000
```

```bash
npm run tauri:dev
```

**Instalador Windows (producción):**

```bash
# .env.production
VITE_API_URL=https://api.tukifac.com
```

```bash
npm run tauri:build
```

El instalador queda en `src-tauri/target/release/bundle/`.

## CORS (errores al conectar)

| Escenario | Solución |
|-----------|----------|
| `npm run dev` / `tauri:dev` con API remota | Deja `VITE_API_URL=https://api.tukifac.com` en `.env.development`: Vite **proxifica** `/api` y no hay CORS en el navegador. |
| Instalador Tauri o APK Capacitor | El backend en producción debe permitir orígenes `https://tauri.localhost`, `tauri://localhost`, `https://localhost` (Capacitor). Están en `backend_go/pkg/corspolicy` — **recompila y despliega el backend** tras actualizar. |
| Sigue fallando en servidor | En el `.env` del servidor: `CORS_ALLOWED_ORIGINS=http://localhost:5175` solo para pruebas puntuales. |

## Si cambias la URL después de compilar

`VITE_API_URL` se **incrusta en el bundle** en tiempo de build. Si cambias el `.env`, debes volver a compilar:

```bash
npm run build
npm run tauri:build
```

## Fallback sin `.env`

Si no hay `VITE_API_URL`, `src/services/api.ts` usa:

1. `http://localhost:3000` si el host es localhost (solo navegador dev)
2. Si no, `https://api.tukifac.cloud`

Para Tauri en producción conviene definir siempre `.env.production`.

## Código de referencia

```typescript
// src/services/api.ts
getApiBaseUrl() // lee import.meta.env.VITE_API_URL

// src/services/public.service.ts — tenant por RUC
getTenantSlug() // localStorage tras pantalla RUC
```
