/**
 * Per-year stochastic market conditions driving one simulation path.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
import type { AssetClassId } from '../../../model/plan.js'

/**
 * Per-year stochastic market conditions for one simulation path (roadmap V4).
 * Index 0 = the projection's startYear. Years past the end of a series fall
 * back to the deterministic assumptions, so a short series degrades gracefully.
 */
export interface MarketSeries {
  /**
   * Additive percentage-point shock applied each year to every non-cash
   * investable account's expected return (single-factor market model). For
   * allocated accounts it applies to the non-cash share of the blend unless
   * per-class shocks are supplied below.
   */
  returnShockPct?: number[]
  /** Realized inflation rate (percent) per year, replacing assumptions.inflationPct from startYear on. */
  inflationPct?: number[]
  /**
   * Per-class additive shocks for accounts with an opt-in allocation
   * (asset-allocation-and-return-model-v2, step 6). A class without a series
   * falls back to `returnShockPct` (cash: no shock). Unallocated accounts
   * always use `returnShockPct`, so single-return plans are unaffected.
   */
  classReturnShockPct?: Partial<Record<AssetClassId, number[]>>
}
