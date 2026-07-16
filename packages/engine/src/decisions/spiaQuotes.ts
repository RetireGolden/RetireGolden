/**
 * Sourced default SPIA payout-rate table (annuity-pension-and-home-equity
 * decisions, step 2).
 *
 * Approximate single-life immediate-annuity annual payout rates (fraction of
 * premium per year, life-only) by start age. Re-anchored 2026-07-15 against
 * published April-2026 life-only quote sheets (annuity.org $100k monthly
 * payout table by age/sex; spot-corroborated against marketplace and insurer
 * calculators): the anchors below take the FEMALE column — the conservative
 * side of a unisex planning default — rounded down to 0.1%. An independent
 * actuarial cross-check (SSA period life expectancy at a ~5% nominal discount,
 * consistent with the embedded 2026-06-30 real-yield curve plus breakeven
 * inflation, less a ~10% insurer loading) lands on the same levels.
 *
 * The age-85 anchor is EXTRAPOLATED (the published table stops at 80): the
 * actuarial cross-check gives ~15.3% at 85, below the source table's own
 * 75->80 mortality-credit slope. Replace it with a quoted rate at the next
 * refresh.
 *
 * Planning defaults only: RetireGolden never fetches live quotes; a
 * user-entered quote always wins. Linear interpolation between anchors;
 * clamped outside the table.
 *
 * Refresh with the annual parameter packs (DOCS/maintenance-schedule.md).
 * Source: https://www.annuity.org/annuities/how-much-does-a-100000-annuity-pay-per-month/
 * (April 2026 rates; accessed 2026-07-15).
 */

const SPIA_PAYOUT_POINTS: ReadonlyArray<readonly [age: number, rate: number]> = [
  [60, 0.06],
  [65, 0.07],
  [70, 0.084],
  [75, 0.103],
  [80, 0.129],
  [85, 0.153],
]

/** Annual life-only SPIA payout rate (fraction of premium) at `startAge`. */
export function spiaPayoutRate(startAge: number): number {
  const points = SPIA_PAYOUT_POINTS
  if (startAge <= points[0]![0]) return points[0]![1]
  const last = points[points.length - 1]!
  if (startAge >= last[0]) return last[1]
  for (let i = 0; i < points.length - 1; i++) {
    const [a0, r0] = points[i]!
    const [a1, r1] = points[i + 1]!
    if (startAge >= a0 && startAge <= a1) return r0 + ((r1 - r0) * (startAge - a0)) / (a1 - a0)
  }
  return last[1]
}

/**
 * Approximate deferred-QLAC annual payout rate (fraction of premium) for a
 * purchase today starting at 80–85: deferral compounds mortality credits well
 * above immediate rates. Not re-anchored on 2026-07-15 (no direct published
 * quote obtained); with the refreshed immediate anchors above it now reads
 * conservative — source a quoted deferred rate at the next refresh.
 */
export const QLAC_DEFERRED_PAYOUT_RATE = 0.16
