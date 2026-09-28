/**
 * The covered-work credit estimate the Social Security step shows beside an
 * earnings history: how many credits (quarters of coverage) the history earns,
 * against the 40 a worker generally needs for a retirement benefit. It feeds a
 * warning only; the plan's entered credit count, when there is one, wins.
 *
 * @see DOCS/calculations/social-security/covered-work-credit-estimate.md
 */
import type { YearEarning } from '../piaFromEarnings.js'
import { FIRST_WAGE_BASE_YEAR, quarterOfCoverageAmountForYearOrLatest } from '../ssaWageData.js'

/** Credits a worker generally needs to be fully insured for a retirement benefit. */
export const CREDITS_FOR_ELIGIBILITY = 40
/** At most four quarters of coverage in a calendar year (20 CFR 404.143(a)). */
export const MAX_CREDITS_PER_YEAR = 4
/** Before 1978 a quarter of coverage was a calendar quarter with $50 of wages (42 U.S.C. 413(a)(2)(A)(i)). */
export const PRE_1978_QUARTER_WAGES = 50

export interface CreditEstimate {
  readonly credits: number
  readonly eligible: boolean
  /** True when counted from the earnings history rather than taken from the plan's entered count. */
  readonly estimated: boolean
}

/**
 * The credits one calendar year's covered earnings earn: from 1978, one per
 * that year's quarter-of-coverage amount (SSA's table; the latest published
 * amount for a later year), at most four; before 1978, the most the year could
 * have earned, one per $50, at most four, since the history gives no quarterly
 * split; nothing before 1937, when no work was covered.
 */
export function creditsForYear(year: number, amount: number): number {
  if (!(amount > 0) || year < FIRST_WAGE_BASE_YEAR) return 0
  const quarterAmount = quarterOfCoverageAmountForYearOrLatest(year) ?? PRE_1978_QUARTER_WAGES
  return Math.min(MAX_CREDITS_PER_YEAR, Math.floor(amount / quarterAmount))
}

/**
 * Covered-work credits (at most 40): an entered `override` wins; otherwise the
 * sum over calendar years of #creditsForYear on each year's total earnings
 * (rows for one year are added first, so a year never earns more than four).
 */
export function estimateCredits(
  earnings: readonly YearEarning[],
  override: number | null | undefined,
): CreditEstimate {
  if (override != null) {
    return { credits: override, eligible: override >= CREDITS_FOR_ELIGIBILITY, estimated: false }
  }
  const byYear = new Map<number, number>()
  for (const row of earnings) {
    if (row.amount > 0) byYear.set(row.year, (byYear.get(row.year) ?? 0) + row.amount)
  }
  let credits = 0
  for (const [year, amount] of byYear) credits += creditsForYear(year, amount)
  credits = Math.min(CREDITS_FOR_ELIGIBILITY, credits)
  return { credits, eligible: credits >= CREDITS_FOR_ELIGIBILITY, estimated: true }
}
