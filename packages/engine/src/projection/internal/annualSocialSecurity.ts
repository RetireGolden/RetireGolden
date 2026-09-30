/**
 * Annual Social Security phase extracted from `simulatePlan`.
 *
 * Since 2026-09-29 (decision D-SS-ANALYSIS-EARNINGS-TEST) the year is priced by
 * socialSecurity/householdYear.ts#socialSecurityYear, the one year function the
 * Social Security analysis page's models call for each year of each path they
 * weight. This phase is the ledger's adapter: it hands the year function the
 * projection's state for the year and returns the published stream rows and
 * the crediting-month writes the caller applies immediately after the phase.
 * The phase keeps plan-order iteration, last-write stream gates and the
 * per-person insertion order of the benefit fold.
 */
import {
  socialSecurityYear,
  type SocialSecurityYearInput,
  type SocialSecurityYearResult,
} from '../../socialSecurity/householdYear.js'

export {
  annualSocialSecurityPayableMonths,
  auxiliaryBenefitSourceKey,
  EARNINGS_TEST_WITHHELD_WARNING,
  SGA_SUSPENDED_WARNING,
  ssdiNotPayableBeforeFraNeverClaimedWarning,
  ssdiNotPayableBeforeFraWarning,
} from '../../socialSecurity/householdYear.js'

export type AnnualSocialSecurityInput = SocialSecurityYearInput

export interface AnnualSocialSecurityResult {
  readonly socialSecurity: number
  readonly socialSecurityStreams: SocialSecurityYearResult['socialSecurityStreams']
  readonly ssEarningsTestWithheld: number
  readonly ssdiPaid: number
  /** New running totals of `withheldMonthsByPerson`, applied by the caller. */
  readonly withheldMonthWrites: SocialSecurityYearResult['withheldMonthWrites']
  /** New running totals of `withheldSurvivorMonthsBySource`, applied by the caller. */
  readonly withheldSurvivorMonthWrites: SocialSecurityYearResult['withheldSurvivorMonthWrites']
  /** New running totals of `withheldSpouseMonthsBySource`, applied by the caller. */
  readonly withheldSpouseMonthWrites: SocialSecurityYearResult['withheldSpouseMonthWrites']
  readonly warnings: readonly string[]
}

export function annualSocialSecurity(
  input: AnnualSocialSecurityInput,
): AnnualSocialSecurityResult {
  const year = socialSecurityYear(input)
  return {
    socialSecurity: year.socialSecurity,
    socialSecurityStreams: year.socialSecurityStreams,
    ssEarningsTestWithheld: year.ssEarningsTestWithheld,
    ssdiPaid: year.ssdiPaid,
    withheldMonthWrites: year.withheldMonthWrites,
    withheldSurvivorMonthWrites: year.withheldSurvivorMonthWrites,
    withheldSpouseMonthWrites: year.withheldSpouseMonthWrites,
    warnings: year.warnings,
  }
}
