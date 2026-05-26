import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { BranchProvider } from '@/contexts/BranchContext'
import { CashSessionProvider } from '@/contexts/CashSessionContext'
import { FeatureProvider } from '@/contexts/FeatureContext'
import { NativeShellProvider } from '@/providers/NativeShellProvider'
import { TenantBindingProvider } from '@/contexts/TenantBindingContext'
import './index.css'
import App from './App'

/** HashRouter: rutas estables en Tauri (file://) y Capacitor (WebView local). */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NativeShellProvider>
      <TenantBindingProvider>
      <HashRouter>
        <AuthProvider>
          <FeatureProvider>
            <BranchProvider>
              <CashSessionProvider>
                <App />
              </CashSessionProvider>
            </BranchProvider>
          </FeatureProvider>
        </AuthProvider>
      </HashRouter>
      </TenantBindingProvider>
    </NativeShellProvider>
  </StrictMode>,
)
