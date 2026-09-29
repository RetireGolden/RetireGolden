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
 * How far to project a publication's indexed figures for a projection year.
 *
 * `packYear` is the year of the figures pricing `year`, and `latestPackYear`
 * the latest year that publication is loaded for. Every caller names both
 * from the publication it reads (decision D-2027-ROLLOVER): `componentScale`
 * passes a component's own year for both, the HSA and state readers their
 * own tables' latest years. There is no default: a default of the base pack's
 * year (LATEST_PACK_YEAR) was how a reader could scale a publisher's figures
 * from a year that publisher had moved past (PR #768 review issue 1).
 */
export function indexingScaleFor(
  packYear: number,
  year: number,
  inflationPath: InflationPath,
  latestPackYear: number,
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
