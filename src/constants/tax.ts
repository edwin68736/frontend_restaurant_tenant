/** Fallback alineado con backend `pkg/tax.DefaultConfig()` cuando el tenant no tiene tasa. */
export const DEFAULT_TAX_RATE_PERCENT = 18

/** Única fuente de verdad en frontend: tasa del tenant o fallback global. */
export function resolveTaxRatePercent(rate: number | null | undefined): number {
  if (rate != null && Number.isFinite(rate) && rate > 0) return rate
  return DEFAULT_TAX_RATE_PERCENT
}

export function buildTaxConfigFromSunat(sunat?: {
  tax_rate?: number
  igv_regime?: string
  tax_benefit_zone?: boolean
}) {
  return {
    taxRate: resolveTaxRatePercent(sunat?.tax_rate),
    igvRegime: sunat?.igv_regime ?? 'standard',
    taxBenefitZone: sunat?.tax_benefit_zone ?? false,
  }
}
