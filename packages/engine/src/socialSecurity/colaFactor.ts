/**
 * The ledger's two yearly scalings of a Social Security benefit: the
 * cost-of-living factor since the projection's first year and the
 * trust-fund haircut. `simulatePlan` multiplies every benefit by both, and the
 * Social Security analysis models (the break-even chart and the expected-value
 * ranking) call the same two functions, so their dollars are the plan's.
 *
 * @see DOCS/calculations/social-security/social-security-cola-factor.md
 */
import type { Assumptions } from '../model/plan.js'

/**
 * The cost-of-living factor for `year`, exactly 1 in `startYear`: the plan's
 * inflation factor from the start year when the COLA matches inflation, read
 * from `inflationFactorFrom` (the ledger passes its own, which follows a
 * Monte Carlo path's inflation series when one is supplied), or the fixed
 * annual COLA compounded from the start year.
 */
export function socialSecurityColaFactor(
  ssCola: Assumptions['ssCola'],
  inflationFactorFrom: (fromYear: number, toYear: number) => number,
  startYear: number,
  year: number,
): number {
  return ssCola.mode === 'matchInflation'
    ? inflationFactorFrom(startYear, year)
    : Math.pow(1 + ssCola.annualPct / 100, year - startYear)
}

/** The trust-fund haircut for `year`: 1 − cutPct/100 from `fromYear` on, and 1 before it or with no haircut. */
export function socialSecurityHaircutFactor(ssHaircut: Assumptions['ssHaircut'], year: number): number {
  return ssHaircut && year >= ssHaircut.fromYear ? 1 - ssHaircut.cutPct / 100 : 1
}
