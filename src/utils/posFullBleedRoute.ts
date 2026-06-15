/** Rutas POS/mesa que en móvil usan ancho completo (sin márgenes del layout). */
export function isPosFullBleedRoute(pathname: string): boolean {
  return pathname === '/pos' || /^\/mesa\/[^/]+$/.test(pathname)
}
