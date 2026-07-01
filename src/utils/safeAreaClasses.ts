/**
 * Clases CSS para safe areas (definidas en index.css).
 * Punto único de referencia — no duplicar env(safe-area-inset-*) inline salvo casos excepcionales.
 */
export const FIXED_OVERLAY_SAFE = 'fixed-overlay-safe'
export const FIXED_OVERLAY_SHEET = 'fixed-overlay-sheet'
export const MODAL_FOOTER_SAFE = 'modal-footer-safe'
export const DRAWER_BOTTOM_SAFE = 'pb-drawer-bottom'
export const DRAWER_BOTTOM_SAFE_LG = 'pb-drawer-bottom-lg'
export const LOADING_SCREEN_SAFE = 'min-h-[100dvh] pt-safe pb-safe'
export const SHELL_SAFE_TOP = 'shell-safe-top'
export const SHELL_SAFE_TOP_REST = 'shell-safe-top-rest'
export const TOP_SAFE_GUTTER = 'top-safe-gutter'
export const LEFT_SAFE_GUTTER = 'left-safe-gutter'
export const RIGHT_SAFE_GUTTER = 'right-safe-gutter'
export const DRAWER_BOTTOM_WRAP_X = 'drawer-bottom-wrap-x'
export const DRAWER_BOTTOM_WRAP_X_LG = 'drawer-bottom-wrap-x-lg'
export const DRAWER_BOTTOM_WRAP_X_RESP = 'drawer-bottom-wrap-x-responsive'
export const FIXED_BOTTOM_NAV_SAFE = 'fixed-bottom-nav-safe'
export const FIXED_DRAWER_LEFT_SAFE = 'fixed-drawer-left-safe'
export const FIXED_DRAWER_RIGHT_SAFE = 'fixed-drawer-right-safe'
export const AUTH_SCREEN_PADDING_Y = 'auth-screen-padding-y'
export const MAX_H_MODAL_PANEL = 'max-h-modal-panel'
export const MAX_H_SHEET_PANEL = 'max-h-sheet-panel'
export const MAX_H_PANEL_85 = 'max-h-panel-85'
export const MAX_H_PANEL_80 = 'max-h-panel-80'
export const MAX_H_CHECKOUT_PANEL = 'max-h-checkout-panel'
export const MAX_H_CART_DRAWER_PANEL = 'max-h-cart-drawer-panel'
export const FAB_CART_BOTTOM = 'fab-cart-bottom'
/** Valor CSS para `bottom` / `style.bottom` del drawer sidebar móvil (encima del bottom nav). */
export const MOBILE_NAV_BOTTOM_OFFSET = 'calc(3.5rem + var(--safe-bottom))'
/** Altura del drawer sidebar móvil descontando safe top y bottom nav. */
export const MOBILE_DRAWER_HEIGHT = 'calc(100dvh - var(--safe-top) - var(--app-bottom-nav-offset))'
