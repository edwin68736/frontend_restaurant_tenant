# Módulo Frontend Restaurante (`restaurant-frontend-react`) — Lógica de negocio y funcionamiento

Documentación a detalle del frontend del módulo de restaurante: vistas, permisos, flujos (RUC → login → salas/mesas/comandas/POS) y cómo se generan comandas, precuentas y ventas.

---

## 1. Resumen del módulo

- **Propósito:** App para operación diaria del restaurante: identificar empresa por RUC, login por rol, gestión de salas/mesas, toma de pedidos en mesa, comandas a cocina, POS rápido (para llevar/mostrador) y cierre con comprobante.
- **Tecnología:** React + TypeScript + Vite. Consume la API del tenant con header `X-Tenant-Slug` y JWT.
- **Roles:** Admin, Vendedor, Mozo, Cocinero. Cada rol ve solo las pantallas que tiene permitidas.

---

## 2. Flujo de entrada (RUC → Login → App)

### 2.1 Sin tenant en almacenamiento

1. **Ruta:** `/ruc` — **RucPage**
2. **Proceso:**
   - Usuario ingresa RUC (solo dígitos, mínimo 8).
   - Al enviar: `GET /api/public/tenant-by-ruc?ruc=XXXXXXXXX` (API pública, sin token).
   - Backend responde con `{ slug, name, token_consulta_datos }` si existe empresa activa con ese RUC.
   - Se guarda en `localStorage`: `tenantSlug`, `tenantName`, `tokenConsultaDatos`.
   - Redirección a `/login`.
3. **Movimientos permitidos:** Solo consultar por RUC y continuar a login.

### 2.2 Login

1. **Ruta:** `/login` — **LoginPage**
2. **Proceso:**
   - Si no hay tenant en almacenamiento → redirección a `/ruc` (RequireTenant).
   - Se muestra nombre de empresa (tenant) y campos email y contraseña.
   - Al enviar: `POST /api/login` con body `{ email, password, slug }` y header `X-Tenant-Slug: <slug>`.
   - Backend devuelve `token`, `user` (incluye `restaurant_role`: admin, vendedor, mozo, cocinero).
   - Se guarda token y user en `localStorage`; redirección a `/`.
3. **Movimientos:** Iniciar sesión, o “Cambiar empresa” (borra tenant del storage y vuelve a `/ruc`).

### 2.3 Tras el login

1. **Ruta:** `/` — **DefaultRedirect** (dentro de RequireAuth + RestaurantLayout).
2. **Proceso:**
   - Si el usuario no tiene rol de restaurante (admin, vendedor, mozo, cocinero) → **NoAccessPage** (sin acceso al módulo).
   - Si tiene rol, redirección según el primer permiso disponible: `salas` → `/salas`, si no `comandas` → `/comandas`, si no `pos` → `/pos`, por defecto `/comandas`.

---

## 3. Permisos por rol (qué puede hacer cada uno)

| Rol        | productos | modificadores | mesas | pos | salas | mesa | comandas | cerrar_mesa |
|-----------|-----------|----------------|-------|-----|-------|------|----------|-------------|
| **admin** | Sí        | Sí             | Sí    | Sí  | Sí    | Sí   | Sí       | Sí          |
| **vendedor** | No    | No             | No    | Sí  | Sí    | Sí   | Sí       | Sí          |
| **mozo**  | No        | No             | No    | No  | Sí    | Sí   | No       | No          |
| **cocinero** | No     | No             | No    | No  | No    | No   | Sí       | No          |

- **productos:** CRUD productos para restaurante (carta, área de preparación, modificadores, stock).
- **modificadores:** CRUD grupos de modificadores (ej. Tamaño, Cocción).
- **mesas:** CRUD mesas por piso (nombre, capacidad, piso).
- **pos:** POS rápido (venta para llevar/mostrador sin mesa).
- **salas:** Ver pisos y mesas; abrir mesa libre (asignar mozo, comensales, notas).
- **mesa:** Ver una sesión abierta; carrito, enviar comanda, precuenta, generar venta, cerrar mesa, anular comanda (admin).
- **comandas:** Vista cocina: listar comandas, cambiar estado (pendiente → preparación → listo → entregado), anular con PIN.
- **cerrar_mesa:** Poder cerrar mesa sin generar venta (mesa ya pagada) y poder usar “Generar venta” en MesaPage.

---

## 4. Vistas (páginas) y procesos en cada una

### 4.1 RucPage (`/ruc`)

- **Acceso:** Público (no requiere login).
- **Proceso:**
  - Input RUC (solo números, máx. 11).
  - Submit → `GET /api/public/tenant-by-ruc?ruc=...` → guardar slug, name, token_consulta_datos → ir a `/login`.
- **Movimientos:** Solo “Continuar” (consultar RUC y guardar tenant).

---

### 4.2 LoginPage (`/login`)

- **Acceso:** Requiere tenant en storage (si no, redirige a `/ruc`).
- **Proceso:**
  - Email, contraseña; opción “Cambiar empresa”.
  - Submit → `POST /api/login` con `{ email, password, slug }` y header `X-Tenant-Slug` → guardar token y user → ir a `/`.
- **Movimientos:** Entrar, Cambiar empresa.

---

### 4.3 NoAccessPage

- **Cuándo:** Usuario autenticado pero sin rol de restaurante (o rol no en admin/vendedor/mozo/cocinero).
- **Proceso:** Mensaje “Sin acceso al módulo restaurante” y botón Cerrar sesión.

---

### 4.4 SalasPage (`/salas`)

- **Acceso:** Requiere permiso `salas`.
- **Proceso:**
  - Carga pisos: `GET /api/restaurant/floors`.
  - Carga mesas: `GET /api/restaurant/tables` (opcional `floor_id`).
  - Carga mozos: `GET /api/restaurant/waiters`.
  - Filtro horizontal por piso (“Todos” + un botón por piso).
  - Cada mesa se muestra como tarjeta: nombre, capacidad, piso, estado (libre/ocupada), si está ocupada: mozo, total en mesa.
- **Movimientos:**
  - **Mesa libre:** clic → modal “Abrir mesa” (mozo opcional, número de comensales, notas) → `POST /api/restaurant/sessions` con `table_id`, `waiter_id`, `guests`, `notes` → redirección a `/mesa/:sessionId`.
  - **Mesa ocupada:** clic → ir a `/mesa/:sessionId` (sesión ya abierta).

---

### 4.5 MesaPage (`/mesa/:sessionId`) — Vista principal de una mesa abierta

- **Acceso:** Requiere permiso `mesa`.
- **Proceso:**
  - Carga sesión: `GET /api/restaurant/sessions/:sessionId` (detalle con órdenes y comandas).
  - Carga productos (carta): `GET /api/products` (restaurant), categorías, series de venta, clientes (contactos).
  - Filtros: categoría, área de preparación, búsqueda por nombre/código.
  - Carrito local (productos a añadir a la mesa).
- **Movimientos:**
  1. **Agregar al carrito:** clic en producto → se suma al carrito (misma línea si mismo producto).
  2. **Cambiar cantidades en carrito:** + / − por ítem; si llega a 0 se quita.
  3. **Enviar comanda:** botón “Comanda” → `POST /api/restaurant/sessions/:id/orders` con `items` del carrito → carrito se vacía; comandas aparecen en “Pedidos en mesa” y en vista cocina.
  4. **Precuenta:** botón “Precuenta” → modal con tabla de todo lo ya enviado en comandas + lo que está en carrito; total a pagar; solo lectura (no genera documento).
  5. **Generar venta:** botón “Generar venta” (solo si permiso `cerrar_mesa`) → modal Checkout:
     - Tipo de comprobante (serie): lista de `GET /api/company/series` categoría venta.
     - Cliente opcional (lista de contactos tipo cliente).
     - Pagos: método (efectivo, yape, plin, tarjeta, transferencia) y monto; se puede añadir más líneas de pago.
     - Si hay ítems en carrito: primero se envía otra comanda con esos ítems, luego se factura la sesión.
     - `POST /api/restaurant/sessions/:id/bill` con `series_id`, `doc_type`, `currency`, `contact_id`, `close_session: true`, `payments` → se genera la venta/comprobante y se cierra la sesión → redirección a `/salas`.
  6. **Cerrar mesa (sin cobro):** Si la mesa está abierta, no hay total pendiente y no hay ítems en carrito → botón “Cerrar mesa” (requiere `cerrar_mesa`) → `POST /api/restaurant/sessions/:id/close` → redirección a `/salas`.
  7. **Anular comanda:** Solo rol admin. Por cada ítem de comanda, botón “Anular” → modal con motivo y PIN de ajustes → `DELETE /api/restaurant/comandas/:id` con `reason` y `pin`.
- **Tipos de documento:** Los que devuelve la API de series (ej. Nota de venta, Boleta, Factura); se elige una serie en el modal de checkout y se envía `doc_type` y `series_id` al facturar.

---

### 4.6 ComandasPage (`/comandas`) — Vista cocina

- **Acceso:** Requiere permiso `comandas`.
- **Proceso:**
  - Carga: `GET /api/restaurant/kitchen` → lista de comandas (todas las que no estén entregadas o anuladas).
  - Filtro por estado: Todas, Pendiente, En preparación, Listo, Entregado.
- **Movimientos:**
  - **Cambiar estado por comanda:**
    - Pendiente → “En preparación” → `PUT /api/restaurant/comandas/:id/status` con `status: preparacion`.
    - En preparación → “Listo” → `status: lista`.
    - Listo → “Entregado” → `status: entregada`.
  - **Anular:** Botón “Anular” → modal motivo + PIN → `DELETE /api/restaurant/comandas/:id` con `reason` y `pin`.

---

### 4.7 POSPage (`/pos`) — Venta rápida (para llevar / mostrador)

- **Acceso:** Requiere permiso `pos`.
- **Proceso:**
  - Carga productos, categorías, áreas de preparación, series de venta, clientes (contactos).
  - Filtros por categoría y área.
  - Carrito: agregar producto (clic), ajustar cantidades con + / −.
- **Movimientos:**
  - **Cobrar:** Abre modal Checkout (mismo concepto que en MesaPage): tipo de comprobante, cliente opcional, pagos.
  - Al confirmar:
    1. `POST /api/restaurant/sessions` con `table_id: null`, `notes: 'POS rápido'` → se crea una sesión “virtual”.
    2. `POST /api/restaurant/sessions/:id/orders` con los ítems del carrito.
    3. `POST /api/restaurant/sessions/:id/bill` con serie, doc_type, cliente, pagos y `close_session: true`.
  - Se genera la venta en una sola operación; no hay mesa física. Carrito se vacía y se cierra el modal.

---

### 4.8 MesasPage (`/mesas`) — Configuración de mesas

- **Acceso:** Requiere permiso `mesas`.
- **Proceso:**
  - Carga pisos y mesas (con filtro opcional por piso).
  - Paginación (12 mesas por página).
- **Movimientos:**
  - **Nueva mesa:** Modal con piso, nombre/número, capacidad → `POST /api/restaurant/tables`.
  - **Editar mesa:** Mismo modal con datos actuales → `PUT /api/restaurant/tables/:id`.
  - **Eliminar mesa:** Confirmación → `DELETE /api/restaurant/tables/:id`.

---

### 4.9 ProductosPage (`/productos`) — Carta y productos para restaurante

- **Acceso:** Requiere permiso `productos`.
- **Proceso:**
  - Listado paginado con búsqueda, filtro por categoría y por área de preparación.
  - Carga categorías, grupos de modificadores y resumen de stock (si aplica).
- **Movimientos:**
  - **Crear producto:** Modal con nombre, código, descripción, categoría, área de preparación (cocina, bar, barra, postres, otro), precio, control de stock, modificadores (checkbox y grupos asignados), imagen (opcional).
  - **Crear categoría** desde el mismo flujo (campo “Nueva categoría” + botón Crear).
  - **Editar producto:** Mismo modal con datos cargados.
  - **Eliminar producto:** Confirmación.
  - Imagen: en crear se sube al guardar; en editar se puede subir nueva (opcional).

---

### 4.10 ModificadoresPage (`/modificadores`)

- **Acceso:** Requiere permiso `modificadores`.
- **Proceso:**
  - Listado de grupos de modificadores: nombre, obligatorio (sí/no), opciones (nombres).
- **Movimientos:**
  - **Nuevo grupo:** Modal con nombre, checkbox “El cliente debe elegir una opción”, y opciones (texto: una por línea o separadas por coma/punto y coma) → `POST /api/modifier-groups` (o equivalente en products.service). Los grupos se asignan luego en ProductosPage a cada producto.

---

## 5. Cómo se genera una comanda

1. Usuario está en **MesaPage** (`/mesa/:sessionId`) con una sesión abierta.
2. Elige productos (filtros por categoría/área/búsqueda) y los agrega al carrito (cantidad y precio por ítem).
3. Pulsa **“Comanda”**.
4. Frontend envía `POST /api/restaurant/sessions/:sessionId/orders` con body:
   - `items`: array de `{ product_id, product_code, product_name, quantity, unit_price, notes }`.
5. Backend crea una orden (order) y las líneas de comanda asociadas; las comandas quedan en estado “pendiente”.
6. El carrito en frontend se vacía y se recarga la sesión; las comandas aparecen en “Pedidos en mesa” y en la vista **ComandasPage** (cocina).

---

## 6. Cómo se genera la precuenta

- En **MesaPage**, botón **“Precuenta”**.
- Se abre un modal de solo lectura que muestra:
  - Todas las comandas ya enviadas en esa sesión (producto, cantidad, precio unitario, subtotal por línea).
  - Los ítems que aún están en el carrito (no enviados).
  - **Total a pagar** (suma de todo).
- No se llama a ningún endpoint; es un resumen para que el cliente revise antes de pagar. El cobro real se hace con “Generar venta”.

---

## 7. Cómo se genera la venta (comprobante) desde una mesa

1. En **MesaPage**, con sesión abierta y (opcionalmente) comandas ya enviadas y/o ítems en carrito.
2. Usuario pulsa **“Generar venta”** (requiere permiso `cerrar_mesa`).
3. Si hay ítems en carrito, primero se envía una comanda con esos ítems (`POST .../orders`).
4. Se abre el modal **Checkout**:
   - **Tipo de comprobante:** lista de series de venta del tenant (`GET /api/company/series` categoría venta): ej. Nota de venta, Boleta, Factura (según lo configurado en el panel tenant).
   - **Cliente (opcional):** lista de contactos tipo cliente (`GET /api/contacts?type=customer`); se envía `contact_id` si se elige uno.
   - **Pagos:** una o más líneas (método + monto). Métodos: efectivo, yape, plin, tarjeta, transferencia. El total pagado debe ser ≥ total a pagar.
5. Al confirmar: `POST /api/restaurant/sessions/:sessionId/bill` con:
   - `series_id`, `doc_type`, `currency` (PEN), `contact_id` (opcional), `close_session: true`, `payments`.
6. Backend genera la venta/comprobante, registra pagos y cierra la sesión. Frontend redirige a `/salas`.

---

## 8. Listado de clientes y tipos de documento

- **Clientes:** Se obtienen con `GET /api/contacts?type=customer` (contacts.service). Se muestran en el Checkout (MesaPage y POSPage) como selector opcional “Cliente”; se usa el nombre/razón social para mostrar en el desplegable.
- **Tipos de documento:** Se obtienen con `GET /api/company/series` filtrado por categoría `venta` (company.service). Cada serie tiene `id`, `doc_type` (ej. Nota de venta, Boleta, Factura), `series` (código). En el Checkout se elige una serie y se envían `series_id` y `doc_type` al endpoint de facturación de la sesión.

---

## 9. Resumen de rutas y permisos

| Ruta | Vista | Permiso | Descripción |
|------|--------|---------|-------------|
| `/ruc` | RucPage | — | Ingreso de RUC y resolución de tenant |
| `/login` | LoginPage | RequireTenant | Login con email/password |
| `/` | DefaultRedirect / NoAccessPage | RequireAuth + rol restaurante | Redirección por permiso o “sin acceso” |
| `/productos` | ProductosPage | productos | CRUD productos (carta, áreas, modificadores) |
| `/modificadores` | ModificadoresPage | modificadores | CRUD grupos de modificadores |
| `/mesas` | MesasPage | mesas | CRUD mesas por piso |
| `/pos` | POSPage | pos | Venta rápida sin mesa |
| `/salas` | SalasPage | salas | Pisos y mesas; abrir mesa / ir a mesa |
| `/mesa/:sessionId` | MesaPage | mesa | Pedidos, comanda, precuenta, venta, cerrar mesa |
| `/comandas` | ComandasPage | comandas | Vista cocina: estados y anulación |

---

## 10. Servicios y API utilizados

- **public.service:** `getTenantByRuc(ruc)`, `storeTenant`, `getStoredTenant` (RUC y almacenamiento del tenant).
- **auth.service:** `login(payload)` con `email`, `password`, `slug` opcional.
- **api (axios):** Base URL configurable; interceptor añade `Authorization: Bearer <token>` y `X-Tenant-Slug` en todas las peticiones autenticadas.
- **restaurant.service:** floors, tables, waiters, sessions (open, get, close), orders (add), bill, comandas (status, cancel), kitchen.
- **products.service:** list (con filtros restaurant), categories, modifier groups, create/update/delete product, upload image, stock summary.
- **company.service:** listSeries (categoría venta).
- **contacts.service:** list (tipo customer) para selector de cliente en Checkout.

Con esta documentación se tiene el detalle de la lógica de negocio, movimientos permitidos por vista, generación de comandas, precuentas y ventas, listado de clientes y tipos de documento del módulo `restaurant-frontend-react`.
