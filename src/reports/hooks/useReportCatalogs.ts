import { useEffect, useState } from 'react'
import { companyService } from '@/services/company.service'
import { cashbankService } from '@/services/cashbank.service'
import { productsService } from '@/services/products.service'
import { restaurantService } from '@/services/restaurant.service'
import type { ReportCatalogs } from '@/reports/types'

const emptyCatalogs = (): ReportCatalogs => ({
  branches: [],
  categories: [],
  paymentMethods: [],
  staffUsers: [],
})

export function useReportCatalogs(loadStaff = true) {
  const [catalogs, setCatalogs] = useState<ReportCatalogs>(emptyCatalogs)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const staffPromise = loadStaff
      ? restaurantService.listStaff().then((list) =>
          (list ?? []).map((s) => ({
            user_id: s.user_id,
            name: s.display_name || `#${s.user_id}`,
          })),
        )
      : Promise.resolve([])

    Promise.all([
      companyService.listBranches().then((b) => b ?? []),
      productsService.listCategories().then((c) => c ?? []),
      cashbankService.listPaymentMethods(true).then((m) => m ?? []),
      staffPromise,
    ])
      .then(([branches, categories, paymentMethods, staffUsers]) => {
        if (cancelled) return
        setCatalogs({
          branches: branches.map((b) => ({ id: b.id, name: b.name })),
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
          paymentMethods,
          staffUsers,
        })
      })
      .catch(() => {
        if (!cancelled) setCatalogs(emptyCatalogs())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadStaff])

  return { catalogs, loading }
}
