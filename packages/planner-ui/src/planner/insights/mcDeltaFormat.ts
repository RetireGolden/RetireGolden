/**
 * The Insights preview's Monte Carlo line (#527). The delta arrives in
 * percentage points and is shown to one decimal, so anything that display
 * would print as 0.0 is "no change": the sign of a rounding remainder must
 * never pick a verdict color. A delta of 0.3 pts is small but real, and keeps
 * its sign and color.
 */

/** Below this the one-decimal display reads 0.0 (|d| < 0.05 rounds to 0.0). */
export const MC_DELTA_FLAT_PTS = 0.05

export type McDeltaLabel = { flat: true } | { flat: false; good: boolean; text: string }

export function formatMcDelta(deltaPts: number): McDeltaLabel {
  if (Math.abs(deltaPts) < MC_DELTA_FLAT_PTS) return { flat: true }
  return { flat: false, good: deltaPts > 0, text: `${deltaPts > 0 ? '+' : ''}${deltaPts.toFixed(1)} pts` }
}
