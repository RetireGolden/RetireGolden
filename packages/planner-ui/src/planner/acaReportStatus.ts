import type { Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'

export interface AcaLedgerSummaryRow {
  year: number
  grossEnrollmentPremium: number
  applicableSlcspPremium: number | null
  modeledAllowablePtc: number | null
  economicNetPremium: number
  readiness: 'actionable' | 'nonActionable'
}

/** Report-facing facts copied from the exact annual ACA ledger, never the legacy input. */
export function acaLedgerSummary(years: YearResult[]): AcaLedgerSummaryRow[] {
  return years.flatMap((year) =>
    year.aca
      ? [{
          year: year.year,
          grossEnrollmentPremium: year.aca.grossEnrollmentPremium,
          applicableSlcspPremium: year.aca.applicableSlcspPremium,
          modeledAllowablePtc: year.aca.modeledAllowablePtc,
          economicNetPremium: year.aca.economicNetPremium,
          readiness: year.aca.readiness,
        }]
      : [],
  )
}

export function acaReportStatus(plan: Plan, years: YearResult[]): string {
  if (!plan.expenses.healthcare.applyAcaCredit) return ''
  const acaYears = acaLedgerSummary(years)
  if (acaYears.length === 0) return ', ACA credit requested; annual evidence required'
  const actionableYears = acaYears.filter((year) => year.readiness === 'actionable').length
  if (actionableYears === acaYears.length) return ', ACA credit modeled for evidenced years'
  if (actionableYears > 0) {
    return ', ACA credit modeled for supported years; unsupported years use gross premium'
  }
  return ', ACA credit not modeled; unsupported years use gross premium'
}
