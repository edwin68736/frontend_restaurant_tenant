# Tukichef — Android (Capacitor)

Aplicación híbrida **React + Vite + Capacitor** para Android, conviviendo con **Tauri Windows** sin romper builds existentes.

## Runtimes soportados

| Entorno | Detección | Build |
|---------|-----------|--------|
| Web | `platform-web` | `npm run build:web` |
| Tauri Windows | `platform-tauri` | `npm run tauri:build` |
| Capacitor Android | `platform-capacitor` | `npm run build:android` + `cap sync` |

Package ID: `com.tukifac.tukichef` (igual que Tauri).

## Requisitos

- Node.js 20+
- Android Studio (Ladybug o superior)
- JDK 17
- Android SDK 35, **minSdk 29** (Android 10+)

## Configuración API

Edita `.env.capacitor` antes del build de producción:

```env
VITE_API_URL=https://api.tukifac.com
```

El WebView de Capacitor envía `Origin: https://localhost`. El backend Go debe incluir ese origen en CORS (ver `backend_go/pkg/corspolicy/nativeShellOrigins`). **Despliega el backend actualizado** si ves errores CORS en el APK.

Para desarrollo contra backend local (emulador):

```env
VITE_API_URL=http://10.0.2.2:3000
```

`10.0.2.2` es el alias del host en el emulador Android.

## Iconos de la app

Desde `public/logo-tukichef.png` (se convierte a cuadrado con fondo `#fafaf9`):

```bash
npm run icons:generate
```

Genera:

- **Tauri Windows:** `src-tauri/icons/icon.ico`, `icon.png`, tamaños Store/Appx, etc.
- **Android:** `android/app/src/main/res/mipmap-*` (launcher + adaptive foreground)
- **Splash Android:** `drawable*/splash.png`

Si cambias el logo, vuelve a ejecutar el comando y luego `npm run cap:sync`.

## Comandos

```bash
# Instalar dependencias (una vez)
npm install

# Build web para Capacitor (base relativa ./)
npm run build:android

# Copiar assets + plugins nativos
npm run cap:sync

# Abrir Android Studio
npm run cap:open:android

# Build + ejecutar en dispositivo/emulador (CLI)
npm run cap:run:android
```

Flujo habitual tras cambios en el frontend:

```bash
npm run cap:sync
```

## APK / AAB (producción)

En Android Studio:

1. **Build → Generate Signed Bundle / APK**
2. Elegir **Android App Bundle (AAB)** para Play Store o **APK** para distribución directa
3. Keystore de release (guardar fuera del repo)

Por línea de comandos (con Gradle configurado):

```bash
cd android
./gradlew assembleRelease          # APK en app/build/outputs/apk/release/
./gradlew bundleRelease            # AAB en app/build/outputs/bundle/release/
```

Firma con tu keystore según [documentación Android](https://developer.android.com/studio/publish/app-signing).

## Safe area y UI móvil

- `viewport-fit=cover` en `index.html`
- Variables CSS `--safe-*` y utilidades `.pt-safe`, `.pb-safe`
- Status bar en overlay (`@capacitor/status-bar`)
- `MainActivity` con `WindowCompat.setDecorFitsSystemWindows(false)`
- Layout restaurante: `pt-safe` en panel, bottom nav con `env(safe-area-inset-bottom)`

## Orientación

Política en `src/lib/platform/orientationPolicy.ts`:

- **Teléfono** (lado corto &lt; 600px, salvo pantalla muy alargada tipo tablet): solo **portrait**
- **Tablet / pantalla grande**: portrait y landscape

Usa `@capacitor/screen-orientation` y se reevalúa al rotar o redimensionar.

## Tauri (Windows)

No se modifica el flujo Tauri. Impresión térmica y ajustes de impresoras siguen gated con `isWindowsDesktop()` / `isTauriDesktop()`.

En Android esas funciones retornan `false` (comportamiento esperado).

## Estructura relevante

```
capacitor.config.ts
android/                          # Proyecto nativo (commitear)
src/lib/platform/                 # detect, formFactor, orientation, bootstrap
src/providers/NativeShellProvider.tsx
.env.capacitor                    # VITE_API_URL producción
```

## Pendiente antes de Play Store

- [ ] Iconos y splash definitivos (mipmap en `android/app/src/main/res`)
- [ ] Keystore de firma release
- [ ] Probar en dispositivos físicos (notch, gesture nav, teclado en POS)
- [ ] Política de privacidad y permisos Play Console
- [ ] Push notifications (Firebase) si se requiere — no incluido en esta fase
- [ ] iOS: `npx cap add ios` cuando se requiera (misma base `platform/`)

## Solución de problemas

| Problema | Acción |
|----------|--------|
| Pantalla en blanco | `npm run cap:sync`, revisar `dist/` y Logcat |
| API no responde en emulador | Usar `10.0.2.2` en `VITE_API_URL` |
| Orientación no bloquea | Verificar plugin Screen Orientation en Logcat |
| Contenido bajo notch | Confirmar clase `platform-capacitor` en `<html>` |
