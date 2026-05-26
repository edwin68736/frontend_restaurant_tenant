Analiza primero la implementación actual de la aplicación y respeta completamente los patrones de diseño, arquitectura, componentes UI, estilos, spacing, responsive behavior, naming conventions, estructura de carpetas y flujo UX ya existentes. No crear una interfaz visual inconsistente ni introducir estilos nuevos innecesarios. Todo debe integrarse de forma nativa con el diseño actual del sistema.

Objetivo

Reorganizar y mejorar completamente la vista de Ajustes de Impresoras, haciendo que sea más intuitiva, moderna, ordenada y fácil de configurar, manteniendo compatibilidad con la funcionalidad actual y agregando nuevos métodos de conexión.

1. Reorganización de la Vista de Ajustes de Impresoras

La pantalla actual necesita una mejor organización UX/UI.

Requisitos de diseño
Mantener el design system actual de la aplicación.
Respetar componentes existentes, tamaños, cards, inputs, botones y espaciados.
La interfaz debe verse más profesional, intuitiva y moderna.
Debe estar optimizada para diferentes tamaños de pantalla, especialmente:
Windows Desktop
Tablets Android
Celulares Android
Capacitor Android
Reorganización UX esperada

Separar claramente la configuración por tipo de conexión mediante secciones o tabs intuitivos:

1. Impresión por Red (IP)

Configuración de impresoras TCP/IP:

Campos:

Nombre de impresora
Dirección IP
Puerto
Botón de prueba de impresión
Estado de conexión

Debe ser simple y visualmente clara.

2. Impresión Bluetooth (NUEVO)

Agregar nueva sección de configuración Bluetooth solo para Android (Capacitor).

Características:

Detectar impresoras Bluetooth disponibles.
Botón Buscar dispositivos Bluetooth.
Listado de impresoras encontradas.
Botón Conectar.
Mostrar:
nombre del dispositivo
MAC address
estado de conexión
Permitir guardar impresora predeterminada.

Debe ser extremadamente simple para usuarios no técnicos.

3. Configuración General de Ticket

Mantener la configuración existente del ticket.

MUY IMPORTANTE:
El diseño y contenido del ticket actual NO DEBE MODIFICARSE.

Debe mantenerse exactamente como ya funciona:

tamaño
alineación
formato
estructura visual
corte
logos
estilos

Solo reorganizar la vista de configuración.

2. Persistencia Local

Toda la configuración de impresoras debe almacenarse en:

localStorage

porque interactúa con impresoras físicas conectadas al dispositivo.

Crear una estructura limpia y escalable para persistencia.

Ejemplo conceptual:

{
  "windows": {
    "printerType": "ip",
    "ipPrinter": {
      "host": "",
      "port": ""
    }
  },
  "android": {
    "printerType": "bluetooth",
    "bluetoothPrinter": {
      "name": "",
      "mac": ""
    },
    "ipPrinter": {
      "host": "",
      "port": ""
    }
  }
}

No hardcodear valores.

Implementar sistema de migración para configuraciones viejas si ya existen datos en localStorage.

3. Compatibilidad por Plataforma
Windows/Desktop

Actualmente ya existe impresión:

A. Ticketera conectada al dispositivo

Mantener funcionando exactamente igual.

B. Impresión por IP

Mantener funcionamiento actual.

No romper nada existente.

Android con Capacitor (NUEVO)

Agregar soporte de impresión de dos formas:

A. Bluetooth

Impresora conectada mediante Bluetooth.

B. IP/TCP

Impresora por red local.

El usuario debe poder seleccionar qué tipo de impresora usar.

Ejemplo:

Método de impresión

( ) Bluetooth
( ) Red / IP
4. Plugin Nativo en Kotlin (Capacitor)

Crear un plugin nativo propio en Kotlin para Capacitor, evitando dependencias innecesarias si no son robustas.

El plugin debe encargarse de:

Bluetooth Permissions

Solicitar permisos automáticamente:

Android 12+:

BLUETOOTH_CONNECT
BLUETOOTH_SCAN

Versiones anteriores:

Bluetooth
Ubicación si aplica

Manejo correcto de permisos denegados.

Funciones del Plugin

Debe exponer métodos claros:

Inicialización Bluetooth

Verificar disponibilidad Bluetooth.

Ejemplo:

isBluetoothEnabled()
Solicitar activación

Si Bluetooth está apagado:

requestEnableBluetooth()
Obtener dispositivos vinculados
getPairedDevices()
Escaneo de dispositivos
scanDevices()
Conectar impresora
connectPrinter(macAddress)
Desconectar
disconnectPrinter()
Imprimir ticket ESC/POS
printTicket(payload)

El plugin debe soportar impresoras térmicas ESC/POS Bluetooth comunes.

5. Compatibilidad de Impresión

El motor de impresión debe funcionar con:

Bluetooth

ESC/POS Bluetooth

TCP/IP

ESC/POS por socket

Mantener el flujo actual de impresión existente.

No duplicar lógica innecesaria.

Crear una capa de abstracción:

Ejemplo conceptual:

PrinterService.print()

que internamente decida:

bluetooth
ip
usb/windows

según configuración guardada.

6. UX Importante

La experiencia debe sentirse simple.

Ejemplo de flujo ideal:

Abrir ajustes de impresora
Elegir método de conexión
Buscar impresora
Conectar
Probar impresión
Guardar

Todo en menos pasos y sin complejidad técnica.

Agregar:

estados de carga
feedback visual
mensajes claros
manejo de errores amigable
indicadores de conexión
7. Restricciones importantes

NO romper funcionalidades existentes.

Antes de modificar:

Auditar implementación actual.
Identificar dependencias.
Reutilizar lógica existente.
Refactorizar solo donde sea necesario.

Evitar:

código duplicado
hardcodeo
componentes gigantes
lógica mezclada UI + impresión

Aplicar buenas prácticas:

clean architecture
separation of concerns
reusable services
tipado fuerte
código mantenible
Resultado esperado

Una pantalla de configuración de impresoras mucho más organizada, moderna, intuitiva y responsive, con soporte multiplataforma para:

Windows → USB/Ticketera + IP
Android Capacitor → Bluetooth + IP

sin alterar el diseño del ticket actual ni romper el flujo existente de impresión.