import type { FraComponents } from './nra'
import { fraTotalMonths, ageToTotalMonths } from './nra'

/**
 * Retirement benefit as a fraction of PIA for claiming at **completed** age
 * `claimAgeYears` (62–70), vs FRA. Uses SSA monthly reduction / delayed credit rules
 * (same formula for all NRAs once expressed in months early / late).
 *
 * @see https://www.ssa.gov/benefits/retirement/planner/agereduction.html
 */

/** Months before FRA: first 36 at 5/9% per month, beyond 36 at 5/12% per month. */
export function earlyRetirementFactor(monthsBeforeFra: number): number {
  if (monthsBeforeFra <= 0) return 1
  const m = monthsBeforeFra
  const first = Math.min(36, m)
  const second = Math.max(0, m - 36)
  const reductionPct = first * (5 / 9) + second * (5 / 12)
  return 1 - reductionPct / 100
}

/** DRC: 2/3% of PIA per month after FRA, up to age 70 (no further increase). */
export function delayedRetirementFactor(
  monthsAfterFra: number,
  maxMonthsAfterFraToAge70: number,
): number {
  if (monthsAfterFra <= 0) return 1
  const d = Math.min(monthsAfterFra, Math.max(0, maxMonthsAfterFraToAge70))
  return 1 + (d * (2 / 3)) / 100
}

export function retirementBenefitPiaFactor(
  claimAgeYears: number,
  fra: FraComponents,
): number {
  if (claimAgeYears < 62 || claimAgeYears > 70) {
    throw new RangeError('claimAgeYears must be between 62 and 70 inclusive')
  }
  const claimM = ageToTotalMonths(claimAgeYears)
  const fraM = fraTotalMonths(fra)
  const maxDrcMonths = Math.max(0, ageToTotalMonths(70) - fraM)

  if (claimM < fraM) {
    return earlyRetirementFactor(fraM - claimM)
  }
  if (claimM > fraM) {
    return delayedRetirementFactor(claimM - fraM, maxDrcMonths)
  }
  return 1
}
