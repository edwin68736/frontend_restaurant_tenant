import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useTenantBinding } from '@/contexts/TenantBindingContext'
import RestaurantLayout from '@/layouts/RestaurantLayout'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import PinLoginPage from '@/pages/PinLoginPage'
import RucPage from '@/pages/RucPage'
import { defaultRouteForPermissions } from '@/utils/restaurantPermissions'
import { isWindowsDesktop } from '@/services/printers.service'
import NoAccessPage from '@/pages/NoAccessPage'
import ProductosPage from '@/pages/ProductosPage'
import ModificadoresPage from '@/pages/ModificadoresPage'
import MesasPage from '@/pages/MesasPage'
import POSPage from '@/pages/POSPage'
import SalasPage from '@/pages/SalasPage'
import MesaPage from '@/pages/MesaPage'
import ComandasPage from '@/pages/ComandasPage'
import VentasPage from '@/pages/VentasPage'
import CajaPage from '@/pages/CajaPage'
import ClientesPage from '@/pages/ClientesPage'
import RepartidoresPage from '@/pages/RepartidoresPage'
import ComandasCocinaPage from '@/pages/ComandasCocinaPage'
import AjustesPage from '@/pages/AjustesPage'
import SubscriptionPage from '@/pages/subscription/SubscriptionPage'
import { SubscriptionStatusProvider } from '@/contexts/SubscriptionStatusContext'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isBound } = useTenantBinding()
  const { isAuthenticated, isLoading, restaurantPermissions } = useAuth()
  if (!isBound) return <Navigate to="/ruc" replace />
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="w-10 h-10 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/home" replace />
  if (!restaurantPermissions.length) {
    return <NoAccessPage />
  }
  return <>{children}</>
}

function DefaultRedirect() {
  const { restaurantPermissions } = useAuth()
  const route = defaultRouteForPermissions(restaurantPermissions)
  return <Navigate to={route} replace />
}

function DefaultEntryRedirect() {
  const { isBound } = useTenantBinding()
  return <Navigate to={isBound ? '/home' : '/ruc'} replace />
}

function RequireFeature({ feature, children }: { feature: 'productos' | 'modificadores' | 'mesas' | 'pos' | 'salas' | 'mesa' | 'comandas' | 'ventas' | 'caja' | 'clientes' | 'repartidores'; children: React.ReactNode }) {
  const { canAccess } = useAuth()
  if (!canAccess(feature)) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireRestaurantAdmin({ children }: { children: React.ReactNode }) {
  const { hasPerm } = useAuth()
  if (!hasPerm('s.m')) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireSettingsAccess({ children }: { children: React.ReactNode }) {
  const { hasPerm } = useAuth()
  if (!hasPerm('s.m') && !isWindowsDesktop()) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireTenant({ children }: { children: React.ReactNode }) {
  const { isBound } = useTenantBinding()
  if (!isBound) return <Navigate to="/ruc" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/" element={<DefaultEntryRedirect />} />
        <Route path="/ruc" element={<RucPage />} />
        <Route path="/home" element={<RequireTenant><HomePage /></RequireTenant>} />
        <Route path="/login" element={<RequireTenant><LoginPage /></RequireTenant>} />
        <Route path="/pin/:station" element={<RequireTenant><PinLoginPage /></RequireTenant>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <SubscriptionStatusProvider>
                <RestaurantLayout />
              </SubscriptionStatusProvider>
            </RequireAuth>
          }
        >
          <Route index element={<DefaultRedirect />} />
          <Route path="productos" element={<RequireFeature feature="productos"><ProductosPage /></RequireFeature>} />
          <Route path="modificadores" element={<RequireFeature feature="modificadores"><ModificadoresPage /></RequireFeature>} />
          <Route path="mesas" element={<RequireFeature feature="mesas"><MesasPage /></RequireFeature>} />
          <Route path="pos" element={<RequireFeature feature="pos"><POSPage /></RequireFeature>} />
          <Route path="salas" element={<RequireFeature feature="salas"><SalasPage /></RequireFeature>} />
          <Route path="mesa/:sessionId" element={<RequireFeature feature="mesa"><MesaPage /></RequireFeature>} />
          <Route path="comandas" element={<RequireFeature feature="comandas"><ComandasPage /></RequireFeature>} />
          <Route path="comandas/cocina" element={<RequireFeature feature="comandas"><ComandasCocinaPage /></RequireFeature>} />
          <Route path="repartidores" element={<RequireFeature feature="repartidores"><RepartidoresPage /></RequireFeature>} />
          <Route path="ventas" element={<RequireFeature feature="ventas"><VentasPage /></RequireFeature>} />
          <Route path="caja" element={<RequireFeature feature="caja"><CajaPage /></RequireFeature>} />
          <Route path="clientes" element={<RequireFeature feature="clientes"><ClientesPage /></RequireFeature>} />
          <Route
            path="ajustes"
            element={
              <RequireSettingsAccess>
                <AjustesPage />
              </RequireSettingsAccess>
            }
          />
          <Route path="suscripcion" element={<RequireRestaurantAdmin><SubscriptionPage /></RequireRestaurantAdmin>} />
          <Route path="*" element={<DefaultRedirect />} />
        </Route>
        <Route path="*" element={<DefaultEntryRedirect />} />
      </Routes>
    </>
  )
}
