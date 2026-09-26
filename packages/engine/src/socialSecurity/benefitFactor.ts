import type { FraComponents } from './nra.js'
import { fraTotalMonths, ageToTotalMonths } from './nra.js'

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

/**
 * Delayed retirement credit per month, in percent of PIA, by effective birth
 * year (a January 1 birth counts in the prior year), from the table in 20 CFR
 * 404.313(b)(2): 2/3 of 1 percent for births after January 1, 1943, and less
 * for earlier births.
 */
export function delayedCreditMonthlyPct(effectiveBirthYear: number): number {
  const y = effectiveBirthYear
  if (y >= 1943) return 2 / 3
  if (y >= 1941) return 5 / 8
  if (y >= 1939) return 7 / 12
  if (y >= 1937) return 13 / 24
  if (y >= 1935) return 1 / 2
  if (y >= 1933) return 11 / 24
  if (y >= 1931) return 5 / 12
  if (y >= 1929) return 3 / 8
  if (y >= 1927) return 1 / 3
  if (y >= 1925) return 7 / 24
  if (y >= 1917) return 1 / 4
  return 1 / 12
}

/**
 * DRC: `monthlyPct` of PIA per month after FRA, up to age 70 (no further
 * increase). The default is the 2/3 of 1 percent that applies to births after
 * January 1, 1943; pass `delayedCreditMonthlyPct(effectiveBirthYear)` for an
 * earlier birth.
 */
export function delayedRetirementFactor(
  monthsAfterFra: number,
  maxMonthsAfterFraToAge70: number,
  monthlyPct = 2 / 3,
): number {
  if (monthsAfterFra <= 0) return 1
  const d = Math.min(monthsAfterFra, Math.max(0, maxMonthsAfterFraToAge70))
  return 1 + (d * monthlyPct) / 100
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
