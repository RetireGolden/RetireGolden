/**
 * The projection view the insight cards read, built from the engine's own
 * dollar basis rather than a converter handed in by the page.
 *
 * `deflate` expresses a nominal amount of a projection year in the
 * projection's start-year dollars by that run's own published
 * `YearResult.inflationScale` (projection/dollarBasis.ts), so a card's
 * today's-dollar figure divides by the same factor the ledger grew the year's
 * amounts with. The basis is built once per call, not per conversion.
 */
import type { ProjectionSummary } from '../projection/compare.js'
import { projectionDollarBasis, toTodayDollars } from '../projection/dollarBasis.js'
import type { ProjectionResult } from '../projection/types.js'
import type { DetectorProjection } from './types.js'

/** The `DetectorProjection` for one run, with `deflate` bound to the run's own inflation factors. */
export function detectorProjection(result: ProjectionResult, summary: ProjectionSummary): DetectorProjection {
  const basis = projectionDollarBasis(result)
  return {
    result,
    summary,
    startYear: result.startYear,
    deflate: (year, amount) => toTodayDollars(basis, year, amount),
  }
}
