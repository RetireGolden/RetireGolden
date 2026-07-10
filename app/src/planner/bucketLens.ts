/**
 * Bucket reporting lens (spending-paths & SWR-lenses plan, Goal 5).
 *
 * Buckets are hugely popular and academically shaky: Estrada's bucket studies
 * and Kitces' reviews find no systematic benefit over a total-return portfolio
 * with rebalancing — the comfort is real, the mechanism mostly isn't. The
 * honest version this lens implements: keep investing (and simulating) total
 * return, and *report* the ledger's balances as buckets — "years 1–2 of net
 * spending", "years 3–10", "the rest" — purely as a reading of the same
 * numbers. Nothing here feeds back into the engine; it is presentation only.
 *
 * Mapping: for each projection year, the net portfolio need of a future year
 * is its total spending (including taxes and penalties) minus all income that
 * year, floored at 0 — the dollars that must come from the portfolio. Bucket k
 * claims the (projected, nominal) need of the next `spans[k]` years,
 * cumulatively, capped by what is actually left; the final bucket is the
 * remainder. Buckets therefore reconcile to the ledger's investable total by
 * construction, every year — the acceptance criterion.
 */

import type { ProjectionResult, YearResult } from '../engine/projection/types'

export interface BucketYearRow {
  year: number
  /** This year's net portfolio need (spending + tax + penalties − income, ≥ 0). */
  need: number
  /** One balance per bucket; sums exactly to `investableTotal`. */
  buckets: number[]
  investableTotal: number
}

/** Net dollars year `y` must draw from the portfolio (nominal, floored at 0). */
export function netPortfolioNeed(y: YearResult): number {
  return Math.max(0, y.expenses.total + y.tax + y.penalties - y.incomes.total)
}

/**
 * Partition every year's investable total into `spans.length + 1` buckets:
 * bucket k holds the projected need of the next `spans[k]` years (starting
 * with the current year, cumulatively after earlier buckets), the last bucket
 * holds the remainder. Needs beyond the projection horizon are unknown and
 * count as 0 — near the end of the plan the leading buckets naturally drain.
 */
export function bucketLens(result: ProjectionResult, spans: number[]): BucketYearRow[] {
  const years = result.years
  const needs = years.map(netPortfolioNeed)
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

export interface BucketPreset {
  id: 'three' | 'two'
  label: string
  /** Year spans of the leading buckets; the growth bucket is the remainder. */
  spans: number[]
  bucketLabels: string[]
}

/** The two classic constructions the community actually uses. */
export const BUCKET_PRESETS: readonly BucketPreset[] = [
  {
    id: 'three',
    label: '3 buckets (2 yrs / 8 yrs / growth)',
    spans: [2, 8],
    bucketLabels: ['Bucket 1 — next 2 years of net spending', 'Bucket 2 — years 3–10', 'Bucket 3 — growth (the rest)'],
  },
  {
    id: 'two',
    label: '2 buckets (3 yrs / growth)',
    spans: [3],
    bucketLabels: ['Bucket 1 — next 3 years of net spending', 'Bucket 2 — growth (the rest)'],
  },
]
