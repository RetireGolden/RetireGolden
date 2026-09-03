import { LATEST_PACK_YEAR } from './index.js'

/**
 * The statutory-indexing projection rule, in one place.
 *
 * Congress adjusts the federal figures every year, so a projection year past
 * the newest published pack has to price against projected tables rather than
 * frozen pack-year ones. Three call sites implemented that rule independently
 * -- the ledger (`simulate.ts`), the optimizer's LP (`optimizePlan.ts`) and the
 * widow's-penalty detector -- and two of them carried a comment asserting the
 * copy was exact when it was not: they used different base years, and only the
 * ledger followed a per-year inflation series. They agreed only because a single
 * pack is published and the optimizer runs without market overrides.
 *
 * What is shared is the rule: at or below the latest pack year the scale is
 * exactly 1, and above it the scale is the cumulative inflation factor from the
 * pack year. What is deliberately NOT shared is the inflation path, which is a
 * real difference: the ledger honours a Monte Carlo `market.inflationPct` path,
 * while the LP and the detector index at the plan's flat assumption. Each caller
 * passes its own.
 */

/** A cumulative general-inflation factor between two years. */
export type InflationPath = (fromYear: number, toYear: number) => number

/**
 * A constant-rate path: what a plan's flat inflation assumption alone implies.
 *
 * `annualRate` is a fraction, not a percentage. Compounding by `Math.pow` and
 * not by repeated multiplication is load-bearing to the last bits: the ledger's
 * per-year series accumulates a product, and the two do not agree exactly.
 */
export function flatInflationPath(annualRate: number): InflationPath {
  return (fromYear, toYear) =>
    toYear <= fromYear ? 1 : Math.pow(1 + annualRate, toYear - fromYear)
}

/**
 * How far to project a pack's indexed figures for a projection year.
 *
 * `packYear` is the year of the pack pricing `year`. Callers get it from
 * `packForYear(year)`, and above the latest pack that lookup always returns the
 * newest pack -- which is why a caller with no pack in hand may pass
 * `LATEST_PACK_YEAR` directly and still agree with the other two.
 *
 * `latestPackYear` exists so a second published pack, the case the three copies
 * disagreed about, is testable before it happens. Production callers omit it.
 */
export function indexingScaleFor(
  packYear: number,
  year: number,
  inflationPath: InflationPath,
  latestPackYear: number = LATEST_PACK_YEAR,
): number {
  // Below the newest pack the factor must be exactly 1, not a computed one: a
  // year earlier than every published pack resolves to the EARLIEST pack, so a
  // bare `year - packYear` goes negative there and would deflate thresholds for
  // a year that is priced at face value. Above it the factor must NOT be
  // floored at 1 -- it is the whole inflation path, and the LP scales the IRMAA
  // thresholds by it too, so a floor would freeze those under a deflation
  // assumption as a side effect of a change about the rate tables.
  return year <= latestPackYear ? 1 : inflationPath(packYear, year)
}
