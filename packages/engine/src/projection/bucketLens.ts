/**
 * Bucket reporting lens (spending-paths & SWR-lenses plan, Goal 5): each
 * projection year's investable total read as time-segmented buckets, "the
 * next N years of net spending", then the rest.
 *
 * A reporting convention only: nothing here feeds back into the projection,
 * and the bucket literature (Estrada; Kitces) finds no systematic benefit
 * from managing money as buckets over a rebalanced total-return portfolio.
 *
 * For year i with investable total T_i and published net portfolio needs n_j
 * (`YearResult.netPortfolioNeed`: spending with taxes and penalties, less that
 * year's income, floored at 0), bucket k claims the needs of the next
 * spans[k] years, starting with year i and continuing after the earlier
 * buckets' years, capped by what is left; the last bucket is the remainder.
 * Needs past the horizon count 0, so the leading buckets drain near the end
 * of the plan. The needs are nominal and summed undiscounted across years.
 * The buckets add to T_i to within one unit in the last place.
 *
 * Moved from planner-ui in B2-P1 slice 2 (the UI never recomputes dollars).
 *
 * @see DOCS/calculations/cash-flow-and-summary/bucket-lens-allocation.md
 */
import type { ProjectionResult } from './types.js'

/** Year spans of the leading buckets for the two constructions the planner offers; the growth bucket is the remainder. */
export const BUCKET_LENS_SPANS = Object.freeze({
  three: Object.freeze([2, 8] as const),
  two: Object.freeze([3] as const),
})

export interface BucketYearRow {
  year: number
  /** This year's published `netPortfolioNeed` (nominal dollars, >= 0). */
  need: number
  /**
   * One balance per bucket, spans.length + 1 of them, nominal dollars of this
   * year; they add to `investableTotal` to within one unit in the last place.
   */
  buckets: number[]
  investableTotal: number
}

/**
 * Partition every year's investable total into `spans.length + 1` buckets.
 * Refuses (RangeError) a span that is not a positive whole number and a row
 * whose `netPortfolioNeed` is not a finite number (named by its year), rather
 * than reading a missing need as 0.
 */
export function bucketLens(result: Pick<ProjectionResult, 'years'>, spans: readonly number[]): BucketYearRow[] {
  for (const span of spans) {
    if (!Number.isInteger(span) || span <= 0) {
      throw new RangeError(`A bucket span must be a positive whole number of years; got ${span}.`)
    }
  }
  const years = result.years
  const needs = years.map((y) => {
    if (typeof y.netPortfolioNeed !== 'number' || !Number.isFinite(y.netPortfolioNeed)) {
      throw new RangeError(`Projection year ${y.year} publishes no finite netPortfolioNeed, so it cannot be read as buckets.`)
    }
    return y.netPortfolioNeed
  })
  return years.map((y, i) => {
    let remaining = y.investableTotal
    const buckets: number[] = []
    let cursor = i
    for (const span of spans) {
      let bucketNeed = 0
      for (let k = 0; k < span; k++) {
        if (cursor + k >= needs.length) break
        bucketNeed += needs[cursor + k]!
      }
      cursor += span
      const claimed = Math.min(remaining, bucketNeed)
      buckets.push(claimed)
      remaining -= claimed
    }
    buckets.push(remaining)
    return { year: y.year, need: needs[i]!, buckets, investableTotal: y.investableTotal }
  })
}
