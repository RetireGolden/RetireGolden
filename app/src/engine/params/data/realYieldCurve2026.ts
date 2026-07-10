import type { RealYieldCurve } from '../types'

/**
 * Embedded TIPS real-yield curve snapshot (par real yields, percent per year).
 *
 * Source: U.S. Treasury "Daily Treasury Par Real Yield Curve Rates"
 * (https://home.treasury.gov/resource-center/data-chart-center/interest-rates),
 * end-of-June 2026 readings rounded to 5bp. The Treasury publishes 5-, 7-, 10-,
 * 20-, and 30-year par real yields; the ladder engine interpolates between
 * points and holds the endpoints flat outside them.
 *
 * This snapshot is the app's offline posture: every ladder quote and funded
 * ratio works without a network call. Refresh cadence: annually with the
 * parameter packs (see DOCS/maintenance-schedule.md), or opt-in per-session
 * via the FedInvest live-price fetch (engine/ladder/fedInvest.ts), which
 * never replaces this embedded default.
 */
export const REAL_YIELD_CURVE_2026: RealYieldCurve = {
  asOfIso: '2026-06-30',
  source: 'U.S. Treasury Daily Par Real Yield Curve Rates',
  points: [
    { maturityYears: 5, realYieldPct: 1.85 },
    { maturityYears: 7, realYieldPct: 2.05 },
    { maturityYears: 10, realYieldPct: 2.25 },
    { maturityYears: 20, realYieldPct: 2.55 },
    { maturityYears: 30, realYieldPct: 2.7 },
  ],
}
