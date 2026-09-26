/**
 * How long the money lasts: one convention for every surface (owner decision
 * R15, 2026-09-25).
 *
 * `depletionYear` is the first year the portfolio could not fund, after any
 * HECM backstop (`ProjectionResult.depletionYear`). Every year before it was
 * funded, so the money lasts through the year before it: the last fully
 * funded year is `depletionYear - 1`, or the plan's last year when it never
 * depletes. "Through" always names a funded year and "in" always names the
 * first short year.
 *
 * The plan asks the money to last through `endYear` inclusive, so it falls
 * `endYear - lastFundedYear` years short of the plan's end: 0 when it never
 * depletes, `endYear - depletionYear + 1` when it does, which is 1 (not 0) for
 * a plan short only in its final year. That count is a distance to the plan's
 * end, not a count of years with a shortfall: income that resumes after the
 * depletion year can fund a later year again.
 *
 * @see DOCS/calculations/longevity/display-years-before-plan-end.md
 */
import type { ProjectionResult } from './types.js'

export interface MoneyLasts {
  /** First year short of money (`ProjectionResult.depletionYear`), or null. */
  readonly depletionYear: number | null
  /**
   * Last fully funded plan year: `depletionYear - 1`, or `endYear` when the
   * plan never depletes. It is `startYear - 1` when the first year is short.
   */
  readonly lastFundedYear: number
  /** The plan's inclusive last year (`ProjectionResult.endYear`). */
  readonly endYear: number
  /** `endYear - lastFundedYear`: 0 when the plan never depletes, else `endYear - depletionYear + 1`. */
  readonly yearsShortOfPlanEnd: number
}

/**
 * The last fully funded year: `depletionYear - 1`, or `endYear` when the
 * result never depletes. Differences between two results' last funded years
 * are what the decision and optimizer comparisons read.
 */
export function lastFundedYear(result: Pick<ProjectionResult, 'depletionYear' | 'endYear'>): number {
  return result.depletionYear === null ? result.endYear : result.depletionYear - 1
}

/**
 * The published "money lasts" figures for one projection. Refuses a
 * depletion year that is not a whole year inside `[startYear, endYear]`,
 * since the ledger only reports depletion in one of its own years.
 */
export function moneyLasts(result: Pick<ProjectionResult, 'startYear' | 'depletionYear' | 'endYear'>): MoneyLasts {
  const { startYear, depletionYear, endYear } = result
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new RangeError(`A projection's start and end years must be whole years; got ${startYear} and ${endYear}`)
  }
  if (depletionYear !== null && (!Number.isInteger(depletionYear) || depletionYear < startYear || depletionYear > endYear)) {
    throw new RangeError(
      `Depletion year ${depletionYear} is not one of the projection's years ${startYear} to ${endYear}`,
    )
  }
  const last = lastFundedYear(result)
  return Object.freeze({
    depletionYear,
    lastFundedYear: last,
    endYear,
    yearsShortOfPlanEnd: endYear - last,
  })
}
