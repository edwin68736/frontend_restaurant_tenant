Analiza profundamente TODO el backend y frontend del módulo restaurante, especialmente:

* POS
* Salas y Mesas
* Comandas
* Cocina
* Pedidos
* Ventas
* Delivery
* Precuenta
* Flujo actual de carrito
* Estados de pedido
* Modelos, migraciones, APIs y relaciones

Tu objetivo es diseñar e implementar una arquitectura robusta de **gestión de pedidos del restaurante**, permitiendo manejar:

1. Consumo en local (mesas)
2. Para llevar
3. Delivery

SIN romper el funcionamiento actual de mesas y pedidos existentes.

---

# CONTEXTO ACTUAL

Actualmente el sistema funciona así:

### Local / Mesas

* El restaurante tiene salas y mesas.
* Desde la vista de salas se selecciona una mesa.
* La mesa tiene pedidos/comandas vinculadas.
* Se agrega productos y luego se cobra.

Ese flujo YA funciona y NO debe romperse.

---

# NUEVA NECESIDAD

Ahora el restaurante debe poder gestionar también:

### 1. DELIVERY

Pedidos enviados a domicilio.

### 2. PARA LLEVAR

Cliente recoge el pedido.

### 3. PEDIDO DIRECTO EN POS

Venta rápida sin mesa.

### 4. COMANDAS SIN COBRO

Poder generar comandas antes de cobrar para que cocina prepare.

### 5. RECUPERAR PEDIDOS PENDIENTES

Volver a abrir un pedido desde comandas/POS y continuar editándolo.

### 6. PRECUENTA

Imprimir resumen antes del cobro.

---

# PROBLEMA A RESOLVER

Hoy el POS parece estar orientado solo a venta inmediata.

Necesito convertirlo en un sistema de pedidos real para restaurante, donde:

**pedido ≠ venta**

Primero existe el pedido.

Después se puede cobrar.

La venta final se genera al cobrar.

---

# NUEVA ARQUITECTURA REQUERIDA

Implementa una arquitectura limpia basada en entidades reales del negocio.

## 1. SEPARAR PEDIDO DE VENTA

Actualmente parece que carrito → venta.

Eso debe evolucionar a:

Pedido → Comanda → Cocina → Cobro → Venta

Modelo recomendado:

### RestaurantOrder (Pedido)

Representa el pedido temporal.

Campos sugeridos:

* id
* tenant_id
* code
* customer_id nullable
* table_id nullable
* waiter_id nullable
* delivery_driver_id nullable
* order_type
* status
* subtotal
* tax
* total
* notes
* estimated_time
* delivery_address nullable
* delivery_reference nullable
* created_by
* created_at

---

### OrderItems

Detalle del pedido.

* order_id
* product_id
* quantity
* unit_price
* notes
* kitchen_status
* subtotal

---

### DeliveryDriver

Gestión de repartidores desde restaurante.

Debe administrarse desde el tenant restaurante.

Campos sugeridos:

* name
* phone
* vehicle_type
* plate
* active
* notes

---

## 2. TIPOS DE PEDIDO

Crear enum o sistema robusto.

### DINE_IN

Consumo en local

* usa mesa
* funciona igual que hoy
* NO romper flujo actual

---

### TAKEAWAY

Para llevar

* NO usa mesa
* se genera comanda
* cliente recoge

---

### DELIVERY

Delivery

* NO usa mesa
* permite asignar repartidor
* dirección
* referencia
* teléfono cliente
* tiempo estimado

---

### QUICK_SALE

Venta directa rápida

* sin comanda
* cobro inmediato

---

## 3. ESTADOS DE PEDIDO

No usar estados improvisados.

Implementar flujo profesional:

### Draft

Carrito temporal

### Pending

Pedido creado

### SentToKitchen

Comanda enviada

### Preparing

Cocina preparando

### Ready

Pedido listo

### OnTheWay

Delivery en camino

### Delivered

Entregado

### Paid

Cobrado

### Cancelled

Cancelado

---

# POS — CAMBIOS NECESARIOS

Analiza profundamente la vista POS.

Actualmente existe botón:

### "Cobrar"

Eso debe evolucionar.

---

## NUEVO FLUJO DEL POS

Cuando haya productos en carrito:

Botón cobrar debe abrir opciones o split button:

### 1. Generar Comanda

NO cobrar aún.

Solo crear pedido.

Enviar a cocina.

Debe funcionar para:

* mesa
* delivery
* para llevar

Resultado:

Pedido pendiente.

Estado:

`SentToKitchen`

---

### 2. Cobrar Pedido

Cobro normal.

Genera venta final.

Estado:

`Paid`

---

### 3. Guardar Pedido

Guardar temporalmente sin enviar cocina.

Estado:

`Draft`

---

### 4. Precuenta

Generar ticket de precuenta.

Solo mostrar:

* productos
* cantidades
* subtotal
* total
* impuestos
* observaciones

NO generar venta.

NO descontar stock definitivo.

---

# DELIVERY EN POS

Agregar soporte delivery dentro del POS.

Cuando el usuario está en POS:

Debe poder indicar:

### Tipo de pedido

* Delivery
* Para llevar

(NO incluir local con mesa aquí porque eso ya se maneja desde salas/mesas)

---

## SI ES DELIVERY

Mostrar:

* cliente
* teléfono
* dirección
* referencia
* repartidor
* tiempo estimado
* notas

Debe poder crear pedido delivery SIN cobrar.

Ejemplo:

Cliente pide por WhatsApp.

Se registra pedido.

Se envía cocina.

Cocina prepara.

Luego recién se cobra o marca entregado.

---

## SI ES PARA LLEVAR

Solo:

* cliente opcional
* nombre cliente
* teléfono opcional
* observaciones

Genera comanda sin mesa.

---

# COMANDAS — REFACTOR

La vista comandas actualmente parece orientada a mesas.

Debe evolucionar.

Debe mostrar tabs o filtros:

### Mesas

Pedidos dine-in

### Delivery

Pedidos delivery

### Para llevar

Takeaway

### Todos

---

Cada card de pedido debe mostrar:

* código pedido
* hora
* cliente
* tipo
* tiempo transcurrido
* estado cocina
* total
* repartidor (si aplica)

---

## MUY IMPORTANTE

Desde comandas debe poder:

### Reabrir pedido

Click en pedido →

abrir POS →

cargar TODO el carrito del pedido

Permitir:

* agregar productos
* quitar productos
* cambiar cantidades
* cambiar delivery
* cambiar notas
* volver a enviar cocina
* cobrar

Esto es CRÍTICO.

No perder el carrito.

Debe reconstruirse exactamente.

---

# COCINA

Comandas deben ir a cocina.

Cocina puede cambiar estado:

* preparando
* listo

Sin tocar cobro.

---

# COBRO

La venta solo debe generarse cuando:

### realmente se cobra

NO antes.

Separar completamente pedido de venta.

---

# STOCK

No romper stock.

Analiza si stock hoy descuenta en venta.

Mantener lógica correcta.

Ideal:

* stock reservado al enviar cocina
  o
* stock descontado al cobrar

Analiza qué es mejor según arquitectura actual.

---

# PRECUENTA

Crear ticket de precuenta.

No es comprobante fiscal.

Debe ser imprimible.

Solo resumen del pedido.

---

# RETROCOMPATIBILIDAD

MUY IMPORTANTE:

NO romper:

* mesas
* salas
* pedidos actuales
* flujo POS existente
* ventas
* cocina
* impresión
* stock
* caja

Todo debe seguir funcionando.

Solo extender arquitectura correctamente.

---

# LO QUE DEBES HACER

1. Analiza backend completo.
2. Analiza frontend POS.
3. Analiza comandas.
4. Analiza cocina.
5. Analiza modelos actuales.
6. Analiza migraciones.
7. Detecta limitaciones actuales.
8. Propón arquitectura final antes de implementar.
9. Refactoriza limpiamente.
10. Crear migraciones necesarias.
11. Mantener compatibilidad con tenants restaurante.

---

# ENTREGABLE

Antes de programar:

Entrega un análisis técnico detallado mostrando:

### Arquitectura actual

### Problemas encontrados

### Riesgos

### Arquitectura propuesta

### Nuevas tablas

### Relaciones

### Estados de pedido

### Flujo de negocio completo

### Cambios POS

### Cambios comandas

### Cambios cocina

### Flujo delivery

### Flujo para llevar

### Flujo mesas

### Cómo evitar romper lo existente

### Plan de migración segura

Y luego recién implementar de forma profesional lista para producción SaaS multi-tenant.
