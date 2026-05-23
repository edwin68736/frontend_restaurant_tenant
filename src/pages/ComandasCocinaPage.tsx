import { Navigate } from 'react-router-dom'

/** Ruta legacy: redirige a comandas con vista por ítem (defecto). */
export default function ComandasCocinaPage() {
  return <Navigate to="/comandas" replace />
}
