# Tukichef — Frontend restaurante (Tauri)

Aplicación de escritorio para restaurante. **No hay versión web**: se ejecuta con Tauri (`npm run tauri:dev`).

## Arranque (flujo obligatorio)

1. **RUC** — Primera pantalla: `GET /api/public/tenant-by-ruc?ruc=...` vincula la empresa.
2. Se guarda en `localStorage`: `tenantSlug`, `tenantRuc`, `tenantName` (persistente en el equipo).
3. **Login** — Todas las peticiones autenticadas envían `X-Tenant-Slug` con el slug guardado.
4. **Operación** — POS, mesas, suscripción, etc.

Para cambiar de empresa: en login → «Cambiar empresa» (borra el vínculo RUC y vuelve al paso 1).

Frontend dedicado a la gestión de restaurantes: mesas, pedidos, comandas y cobro. Misma autenticación que el panel tenant (Bearer token).

## Backend central (`.env`)

La URL del API **no** es el tenant. El tenant se elige en la app con el **RUC** (`X-Tenant-Slug`).

| Archivo | Uso |
|---------|-----|
| `.env.development` | `npm run tauri:dev` → típico `http://localhost:3000` |
| `.env.production` | `npm run tauri:build` → API de producción |
| `.env.capacitor` | `npm run build:android` |
| `.env.example` | Plantilla |

```env
VITE_API_URL=https://api.tukifac.com
```

Sin `/api` al final. Detalle: [docs/TAURI.md](docs/TAURI.md).

## Desarrollo

```bash
npm install
npm run tauri:dev
```

O solo Vite: `npm run dev` → http://localhost:5175 (proxy `/api` → backend 3000).

## Iconos (Tauri + Android)

```bash
npm run icons:generate   # desde public/logo-tukichef.png
```

## Build Tauri (Windows)

```bash
# Revisa .env.production antes de compilar
npm run tauri:build
```

## Vistas

- **Productos** — Lista de productos para restaurante (con modificadores si aplica).
- **Mesas** — CRUD de mesas por piso.
- **POS** — Venta rápida (nota de venta, boleta, factura) sin mesa.
- **Salas / Mesas** — Pisos con tarjetas de mesas; clic en mesa libre → abrir; clic en ocupada → ver sesión.
- **Mesa (sesión)** — Agregar productos, enviar a cocina, cobrar y cerrar (genera comprobante).
- **Comandas** — Vista cocina: pendiente → en preparación → listo → entregado; anular con PIN.

## Seguridad

La anulación de comandas requiere el **PIN de operación** configurado en el panel tenant: Mi empresa → Módulos → Restaurante → Ajustes.

## API

Ver `docs/api-restaurant.md` en la raíz del proyecto.
