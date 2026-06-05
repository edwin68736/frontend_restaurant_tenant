import { useEffect, useState } from 'react'
import { companyService } from '@/services/company.service'
import { getStoredTenant } from '@/services/public.service'

/** Razón social y RUC para sidebar expandido o header con sidebar mini. */
export function useTenantDisplay() {
  const storedTenant = getStoredTenant()
  const [companyName, setCompanyName] = useState('')
  const [companyRuc, setCompanyRuc] = useState('')

  useEffect(() => {
    companyService
      .getConfig()
      .then((cfg) => {
        setCompanyName((cfg.business_name || cfg.trade_name || storedTenant?.name || '').trim())
        setCompanyRuc((cfg.ruc || storedTenant?.ruc || '').trim())
      })
      .catch(() => {
        setCompanyName((storedTenant?.name || '').trim())
        setCompanyRuc((storedTenant?.ruc || '').trim())
      })
  }, [storedTenant?.name, storedTenant?.ruc])

  return {
    title: companyName || storedTenant?.name || 'Restaurante',
    ruc: companyRuc || storedTenant?.ruc || '',
  }
}
