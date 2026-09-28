/**
 * The retirement earnings test, as the ledger applies it once a year
 * (42 U.S.C. 403(f)(3) and 403(b)): benefits paid before full retirement age
 * are withheld by half of the year's wages above the lower exempt amount, and
 * in the year full retirement age is reached by a third of the wages above the
 * higher one, never more than the year's benefit. The projection's Social
 * Security phase (projection/internal/annualSocialSecurity.ts) calls it for
 * every working claimant, and the Social Security analysis page calls the same
 * function to say when the plan's wages would withhold a benefit its
 * benefits-only models count as paid.
 *
 * @see usc-42-403-f-3-retirement-earnings-test in rules/records/socialSecurity.ts
 */

export interface EarningsTestInput {
  /** The age the person reaches in the year. */
  readonly ageAttained: number
  /** The whole years of the person's full retirement age: the test runs before that age's year and in it. */
  readonly fraYears: number
  /** The person's wages for the year. */
  readonly wages: number
  /** The year's benefit the test withholds from. */
  readonly benefit: number
  /** The year's exempt amount before the full-retirement-age year. */
  readonly belowFraExemptAnnual: number
  /** The year's exempt amount in the full-retirement-age year. */
  readonly fraYearExemptAnnual: number
}

/**
 * The benefits the earnings test withholds for the year: (wages − the lower
 * exempt amount) / 2 before the full-retirement-age year, (wages − the higher
 * exempt amount) / 3 in it, and nothing from the year after; never below 0 or
 * above the year's benefit.
 */
export function earningsTestWithheldAnnual(input: EarningsTestInput): number {
  const { ageAttained, fraYears, wages, benefit, belowFraExemptAnnual, fraYearExemptAnnual } = input
  let withheld = 0
  if (ageAttained < fraYears) {
    withheld = Math.max(0, (wages - belowFraExemptAnnual) / 2)
  } else if (ageAttained === fraYears) {
    withheld = Math.max(0, (wages - fraYearExemptAnnual) / 3)
  }
  return Math.min(withheld, benefit)
}
