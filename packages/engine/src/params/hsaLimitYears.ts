/**
 * HSA contribution limits by calendar year: the IRC 223(b)(2) self-only and
 * family amounts as the IRS publishes them, resolved on their own rather than
 * through the income-tax pack.
 *
 * They run on an earlier calendar than the income-tax figures. IRC 223(g)(1)
 * indexes the (b)(2) amounts from the section 1(f)(3) cost-of-living
 * adjustment, and the IRS publishes the next calendar year's amounts in a
 * revenue procedure each May, months before the October revenue procedure
 * carrying the brackets. So a year's HSA limits can be published while its
 * income-tax figures are still projected from an earlier year: 2027's are Rev.
 * Proc. 2026-24 section 3.01(1), published May 2026, while only the 2026
 * income-tax figures are published.
 *
 * A year with its own block is read as published, at a scale of exactly 1. A
 * later year stands in on the latest block and grows at the plan's inflation
 * from that block's year, the same approximation the other contribution limits
 * make (the plan's inflation rather than the C-CPI-U, and no rounding to a
 * multiple of 50 dollars). The age-55 catch-up of IRC 223(b)(3)(B) is a flat
 * 1,000 dollars that 223(g) does not index and no revenue procedure restates,
 * so it stays in the pack (`contributionLimits.hsaCatchUp55`).
 *
 * The 2026 income-tax pack references the 2026 block for its
 * `contributionLimits.hsaSelfOnly` and `hsaFamily`, and a test holds it there,
 * so the figures have one home.
 *
 * @see DOCS/calculations/cash-flow-and-summary/hsa-contribution-limit-years.md
 */

/** The IRC 223(b)(2) base limits published for one calendar year. */
export interface HsaLimitYearParameters {
  /** The calendar year the limits apply to. */
  readonly year: number
  /** The revenue procedure that publishes them, as a provenance row names it. */
  readonly source: string
  /** IRC 223(b)(2)(A): self-only coverage under a high deductible health plan. */
  readonly selfOnly: number
  /** IRC 223(b)(2)(B): family coverage under a high deductible health plan. */
  readonly family: number
}

/** 2026. Rev. Proc. 2025-19 section 2.01(1): $4,400 self-only, $8,750 family. */
export const hsaLimitYear2026: HsaLimitYearParameters = {
  year: 2026,
  source: 'Rev. Proc. 2025-19',
  selfOnly: 4_400,
  family: 8_750,
}

/** 2027. Rev. Proc. 2026-24 section 3.01(1): $4,500 self-only, $9,000 family. */
const hsaLimitYear2027: HsaLimitYearParameters = {
  year: 2027,
  source: 'Rev. Proc. 2026-24',
  selfOnly: 4_500,
  family: 9_000,
}

// Keep sorted ascending by year as each May's revenue procedure is added.
const limitYears: readonly HsaLimitYearParameters[] = [hsaLimitYear2026, hsaLimitYear2027]

/** Every year with published HSA limits, ascending. */
export const HSA_LIMIT_YEARS: readonly HsaLimitYearParameters[] = limitYears

export const EARLIEST_HSA_LIMIT_YEAR = limitYears[0]!.year
export const LATEST_HSA_LIMIT_YEAR = limitYears[limitYears.length - 1]!.year

export interface HsaLimitYearLookup {
  params: HsaLimitYearParameters
  /**
   * True when `year` has no published limits and a neighbouring year stands
   * in. A stand-in after the latest published year is grown at the plan's
   * inflation from that year; one before the earliest is read as published.
   */
  isStandIn: boolean
}

/**
 * The HSA base limits for `year`: the exact published block when there is one,
 * otherwise the latest block for a later year and the earliest for an earlier
 * one, flagged as a stand-in (the resolution `packForYear` and
 * `acaParametersForCoverageYear` use).
 */
export function hsaLimitsForYear(year: number): HsaLimitYearLookup {
  const exact = limitYears.find((block) => block.year === year)
  if (exact) return { params: exact, isStandIn: false }
  if (year > LATEST_HSA_LIMIT_YEAR) return { params: limitYears[limitYears.length - 1]!, isStandIn: true }
  return { params: limitYears[0]!, isStandIn: true }
}
