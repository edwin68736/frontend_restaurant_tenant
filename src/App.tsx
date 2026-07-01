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
import { canAccessAppSettings } from '@/utils/restaurantPermissions'
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
import ReportsLayout from '@/pages/reportes/ReportsLayout'
import ReportRunnerPage from '@/pages/reportes/ReportRunnerPage'
import DashboardPage from '@/pages/DashboardPage'
import { SubscriptionStatusProvider } from '@/contexts/SubscriptionStatusContext'
import { DEFAULT_REPORT_PATH } from '@/reports/registry'
import { LOADING_SCREEN_SAFE } from '@/utils/safeAreaClasses'
import SafeAreaDebugPanel from '@/components/debug/SafeAreaDebugPanel'
import { isSafeAreaDebugEnabled } from '@/utils/safeAreaDebugEnabled'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isBound } = useTenantBinding()
  const { isAuthenticated, isLoading, restaurantPermissions } = useAuth()
  if (!isBound) return <Navigate to="/ruc" replace />
  if (isLoading) {
    return (
      <div className={`${LOADING_SCREEN_SAFE} flex items-center justify-center bg-stone-100`}>
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
  const { restaurantPermissions, employeeType } = useAuth()
  const route = defaultRouteForPermissions(restaurantPermissions, employeeType)
  return <Navigate to={route} replace />
}

function DefaultEntryRedirect() {
  const { isBound } = useTenantBinding()
  return <Navigate to={isBound ? '/home' : '/ruc'} replace />
}

function RequireFeature({ feature, children }: { feature: 'productos' | 'modificadores' | 'mesas' | 'pos' | 'salas' | 'mesa' | 'comandas' | 'ventas' | 'caja' | 'reportes' | 'dashboard' | 'clientes' | 'repartidores'; children: React.ReactNode }) {
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
  const { restaurantPermissions, employeeType } = useAuth()
  if (!canAccessAppSettings(restaurantPermissions, employeeType)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function RequireTenant({ children }: { children: React.ReactNode }) {
  const { isBound } = useTenantBinding()
  if (!isBound) return <Navigate to="/ruc" replace />
  return <>{children}</>
}

const showSafeAreaDebug = isSafeAreaDebugEnabled()

export default function App() {
  return (
    <>
      {showSafeAreaDebug ? <SafeAreaDebugPanel /> : null}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { marginTop: 'var(--safe-top)' } }}
      />
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
          <Route path="dashboard" element={<RequireFeature feature="dashboard"><DashboardPage /></RequireFeature>} />
          <Route path="ventas" element={<RequireFeature feature="ventas"><VentasPage /></RequireFeature>} />
          <Route path="caja" element={<RequireFeature feature="caja"><CajaPage /></RequireFeature>} />
          <Route
            path="reportes"
            element={
              <RequireFeature feature="reportes">
                <ReportsLayout />
              </RequireFeature>
            }
          >
            <Route index element={<Navigate to={`/reportes/${DEFAULT_REPORT_PATH}`} replace />} />
            <Route path=":reportId" element={<ReportRunnerPage />} />
          </Route>
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
