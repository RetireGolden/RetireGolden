import { acaContractRemovalFor, type AcaContractRemovalEdit } from '@retiregolden/engine/model/acaContractRemovals'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'
import { formatYearList } from './acaVetoCopy'

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

/**
 * Priced ACA years whose household income was computed on projected tax
 * brackets: the credit reads the year's published Marketplace figures, but the
 * year's income-tax figures are not published yet (engine support code
 * income-tax-parameters-projected).
 */
export function acaProjectedIncomeTaxYears(years: YearResult[]): number[] {
  return years
    .filter(
      (year) =>
        year.aca?.readiness === 'actionable' &&
        year.aca.supportCodes.includes('income-tax-parameters-projected'),
    )
    .map((year) => year.year)
}

/** What both ACA status surfaces say about the years acaProjectedIncomeTaxYears names. */
const PROJECTED_INCOME_TAX_PHRASE = 'priced on published Marketplace figures, with income from projected tax brackets'

/**
 * The downloadable report's sentence for the priced ACA years whose income
 * rests on projected tax brackets ("2027 is priced on published Marketplace
 * figures, with income from projected tax brackets."), or null when there are
 * none. The on-screen status line (acaReportStatus) carries the same phrase.
 */
export function acaProjectedIncomeTaxNote(years: YearResult[]): string | null {
  const projected = acaProjectedIncomeTaxYears(years)
  if (projected.length === 0) return null
  return `${formatYearList(projected)} ${projected.length === 1 ? 'is' : 'are'} ${PROJECTED_INCOME_TAX_PHRASE}.`
}

/** The report's clause for an edit that removed the credit's details (review finding M2). */
const REMOVED_BY_PHRASE: Record<AcaContractRemovalEdit, string> = {
  partnerAdded: 'adding a partner',
  partnerRemoved: 'removing a partner',
  peopleChanged: 'changing the people in the household',
  filingStatusChanged: 'changing the filing status',
  householdChanged: "changing the household's details",
  premiumChanged: 'changing the pre-65 premium',
}

/**
 * "; details removed by adding a partner" when the plan's unpriced years had
 * their contracts removed by a recorded edit, naming each such edit once; ''
 * otherwise.
 */
function removedDetailsClause(plan: Plan, years: YearResult[]): string {
  const edits = [
    ...new Set(
      years
        .filter((year) => year.aca?.supportCodes.includes('missing-year-contract'))
        .map((year) => acaContractRemovalFor(plan.expenses.healthcare, year.year))
        .filter((edit): edit is AcaContractRemovalEdit => edit !== null),
    ),
  ]
  return edits.length === 0 ? '' : `; the credit details were removed by ${edits.map((edit) => REMOVED_BY_PHRASE[edit]).join(' and ')}`
}

export function acaReportStatus(plan: Plan, years: YearResult[]): string {
  if (!plan.expenses.healthcare.applyAcaCredit) return ''
  const removed = removedDetailsClause(plan, years)
  const acaYears = acaLedgerSummary(years)
  if (acaYears.length === 0) return ', ACA credit requested; annual evidence required'
  const actionableYears = acaYears.filter((year) => year.readiness === 'actionable').length
  const projected = acaProjectedIncomeTaxYears(years)
  const projectedNote =
    projected.length === 0
      ? ''
      : `; ${formatYearList(projected)} ${PROJECTED_INCOME_TAX_PHRASE}`
  if (actionableYears === acaYears.length) return `, ACA credit modeled for evidenced years${projectedNote}`
  if (actionableYears > 0) {
    return `, ACA credit modeled for supported years; unsupported years use gross premium${projectedNote}${removed}`
  }
  return `, ACA credit not modeled; unsupported years use gross premium${removed}`
}
