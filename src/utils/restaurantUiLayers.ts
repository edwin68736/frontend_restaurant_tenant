/**
 * Capas UI del panel restaurante.
 * Header sticky: z-[100], FAB carrito: z-[105], menú inferior: z-[110], drawer carrito: z-[115].
 * Menú hamburguesa (portal): z-[300].
 */
export const REST_PAGE_MODAL_Z = 'z-[120]'
export const REST_PORTAL_MODAL_Z = 'z-[300]'
/** Encima de Procesar pago u otros portales (ej. nuevo cliente). */
export const REST_PORTAL_MODAL_STACK_Z = 'z-[350]'
/** Escáner POS con cámara (encima de modales de cobro). */
export const REST_CAMERA_SCANNER_Z = 'z-[380]'
export const REST_DROPDOWN_Z = 'z-[450]'
/** Para estilos inline en portales (createPortal). Por encima del aviso de conexión. */
export const REST_DROPDOWN_Z_INDEX = 450
export const REST_OFFLINE_OVERLAY_Z = 'z-[400]'
/** Modales que se abren DESDE SubscriptionBlockedScreen (bloqueo de suscripción, z-400): deben
 * quedar por encima de ese overlay, no debajo. */
export const REST_SUBSCRIPTION_BLOCKED_MODAL_Z = 'z-[410]'
/** Lightbox de QR (zoom/descargar/compartir): siempre el elemento más al frente posible, sin
 * importar desde qué modal se abra (pago, paquete, picker de plan sobre el bloqueo, etc.). */
export const REST_LIGHTBOX_Z = 'z-[420]'
