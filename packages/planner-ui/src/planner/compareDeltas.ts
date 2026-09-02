/**
 * Plan B − Plan A delta formatting for the Compare plans table (#499). Money
 * deltas come from the engine's summaries; the year, age, and percentage-point
 * differences here are presentation arithmetic on those already-computed
 * figures (a year minus a year), never dollars.
 */

import { fmtMoneyCompact } from './format'

export type DeltaUnit = 'money' | 'years' | 'pp'

/** The engine's deterministic success reading of a summary: 100 with no depletion year, else 0. */
export function deterministicSuccessPct(depletionYear: number | null): number {
  return depletionYear === null ? 100 : 0
}

/**
 * The last year a plan is fully funded. The engine's `depletionYear` is the
 * first year with any shortfall, so a plan that "Depletes in 2054" was funded
 * through 2053; a plan that never depletes is funded through its end year.
 */
export function lastFundedYear(plan: { depletionYear: number | null; endYear: number }): number {
  return plan.depletionYear === null ? plan.endYear : plan.depletionYear - 1
}

/**
 * Money-lasts delta in years, B − A, on last funded years. Always a number:
 * "Depletes in 2054" vs "Full plan through 2054" is one year, and two full
 * plans with different horizons differ by the horizon gap.
 */
export function moneyLastsDeltaYears(
  a: { depletionYear: number | null; endYear: number },
  b: { depletionYear: number | null; endYear: number },
): number {
  return lastFundedYear(b) - lastFundedYear(a)
}

/** Age delta, B − A; null when either side has no depletion age to compare. */
export function ageDelta(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return b - a
}

function signed(value: number, text: string): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}`
}

/** The delta cell text; a zero non-money delta says so instead of hiding behind a dash. */
export function formatDelta(value: number, unit: DeltaUnit): string {
  if (unit === 'money') return `${value > 0 ? '+' : ''}${fmtMoneyCompact(value)}`
  const magnitude = Math.abs(Math.round(value))
  if (unit === 'pp') return signed(value, `${magnitude} pp`)
  if (magnitude === 0) return 'same'
  return signed(value, `${magnitude} ${magnitude === 1 ? 'yr' : 'yrs'}`)
}
