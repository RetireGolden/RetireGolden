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
  return acaYears.length > 0 && acaYears.every((year) => year.readiness === 'actionable')
    ? ', ACA credit modeled for evidenced years'
    : ', ACA credit requested; annual evidence required'
}
