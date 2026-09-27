import type { RealYieldCurve } from '../types.js'

/**
 * Embedded TIPS real-yield curve snapshot (par real yields, percent per year).
 *
 * Source: U.S. Treasury "Daily Treasury Par Real Yield Curve Rates"
 * (https://home.treasury.gov/resource-center/data-chart-center/interest-rates),
 * the row dated 06/30/2026 exactly as published, in percent to the hundredth,
 * with no further rounding (decision D-TREASURY, 2026-09-25). The Treasury
 * publishes 5-, 7-, 10-, 20-, and 30-year par real yields; the ladder engine
 * interpolates between points and holds the endpoints flat outside them.
 *
 * This snapshot is the app's offline posture: every ladder quote and funded
 * ratio works without a network call. Refresh cadence: annually with the
 * parameter packs (see DOCS/maintenance-schedule.md), or through the opt-in,
 * per-day-cached FedInvest live-price fetch in
 * `packages/planner-ui/src/data/fedInvestClient.ts`, which never replaces
 * this embedded default.
 */
export const REAL_YIELD_CURVE_2026: RealYieldCurve = {
  asOfIso: '2026-06-30',
  source: 'U.S. Treasury Daily Par Real Yield Curve Rates',
  points: [
    { maturityYears: 5, realYieldPct: 1.93 },
    { maturityYears: 7, realYieldPct: 2.06 },
    { maturityYears: 10, realYieldPct: 2.2 },
    { maturityYears: 20, realYieldPct: 2.54 },
    { maturityYears: 30, realYieldPct: 2.73 },
  ],
}
