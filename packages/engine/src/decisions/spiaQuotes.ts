/**
 * Sourced default SPIA payout-rate table (annuity-pension-and-home-equity
 * decisions, step 2).
 *
 * Approximate single-life immediate-annuity annual payout rates (fraction of
 * premium per year, life-only) by start age — compiled from public quote
 * aggregators (Blueprint-Income-style annuity marketplaces and insurer
 * calculators, mid-2026 rates). Planning defaults only: RetireGolden never
 * fetches live quotes; a user-entered quote always wins. Linear interpolation
 * between anchors; clamped outside the table.
 *
 * Refresh with the annual parameter packs (DOCS/maintenance-schedule.md).
 */

const SPIA_PAYOUT_POINTS: ReadonlyArray<readonly [age: number, rate: number]> = [
  [60, 0.055],
  [65, 0.061],
  [70, 0.069],
  [75, 0.079],
  [80, 0.093],
  [85, 0.11],
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
 * above immediate rates. Same public-quote provenance as the SPIA table.
 */
export const QLAC_DEFERRED_PAYOUT_RATE = 0.16
