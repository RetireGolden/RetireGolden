/**
 * Withdrawal-rate spending guardrails (planning-depth roadmap §4, Guyton–Klinger
 * style). A path-level decision rule that rations the *discretionary* spending
 * layer year by year: when the current withdrawal rate runs too far above the
 * plan's starting rate the discretionary layer is cut, and when it falls back
 * below the starting rate it is restored — the required floor is never touched.
 *
 * These functions are pure and deterministic. The ledger owns the per-year state
 * (the running discretionary multiplier) and applies the funded spending through
 * the same tax/withdrawal/estate mechanics as every other expense; nothing here
 * builds its own cash-flow model.
 *
 * The withdrawal-rate signal is `targetSpending / startOfYearPortfolio`, compared
 * to the same ratio in the first projection year. This is a documented
 * simplification: it uses gross target spending (not net-of-guaranteed-income
 * portfolio draws) as the withdrawal proxy, so it is well defined before the
 * tax/withdrawal fixed point runs and cannot become circular with the very
 * spending it is deciding.
 */

export interface GuardrailPolicy {
  /**
   * Which signal triggers adjustments. 'withdrawal-rate' (or absent) compares
   * the current withdrawal rate to the starting rate (Guyton–Klinger style);
   * 'risk-based' compares the real portfolio balance to solver-derived dollar
   * thresholds that correspond to a target probability-of-success band.
   */
  mode?: 'withdrawal-rate' | 'risk-based'
  /** Cut when current rate exceeds this % of the starting rate. Absent ⇒ 120. */
  upperGuardrailPct?: number
  /** Raise when current rate falls below this % of the starting rate. Absent ⇒ 80. */
  lowerGuardrailPct?: number
  /** Risk-based: cut when the real balance falls below this % of the starting portfolio. */
  lowerBalanceThresholdPct?: number
  /** Risk-based: raise when the real balance rises above this % of the starting portfolio. */
  upperBalanceThresholdPct?: number
  /** Each cut/raise moves the discretionary layer by this % of its full size. Absent ⇒ 10. */
  adjustmentPct?: number
  /** Permit raises above the target lifestyle into ideal/excess layers. */
  allowRaisesAboveTarget?: boolean
}

export const DEFAULT_UPPER_GUARDRAIL_PCT = 120
export const DEFAULT_LOWER_GUARDRAIL_PCT = 80
export const DEFAULT_ADJUSTMENT_PCT = 10

export type GuardrailAction = 'hold' | 'cut' | 'raise'

export interface GuardrailDecision {
  /** Discretionary multiplier in [0, 1] after this year's decision. */
  multiplier: number
  action: GuardrailAction
}

function clampRange(x: number, max: number): number {
  const hi = Math.max(0, Number.isFinite(max) ? max : 1)
  if (!Number.isFinite(x)) return Math.min(1, hi)
  return Math.min(hi, Math.max(0, x))
}

/**
 * One year's guardrail decision. `startingRate` and `currentRate` are the
 * target-spending / start-of-year-portfolio ratios for the first projection year
 * and this year respectively.
 *
 * - ratio above the upper band ⇒ cut the discretionary layer by `adjustmentPct`,
 * - ratio below the lower band ⇒ restore it by `adjustmentPct`,
 * - otherwise hold.
 *
 * The multiplier is clamped to [0, 1] so a cut never reaches below the required
 * floor and a raise never overshoots full discretionary spending. `action` is
 * reported as 'hold' when the multiplier does not actually move (already at a
 * bound), so downstream counts reflect real adjustments only.
 */
export function nextGuardrailMultiplier(
  prevMultiplier: number,
  currentRate: number,
  startingRate: number,
  policy: GuardrailPolicy = {},
  maxMultiplier = 1,
): GuardrailDecision {
  const upper = (policy.upperGuardrailPct ?? DEFAULT_UPPER_GUARDRAIL_PCT) / 100
  const lower = (policy.lowerGuardrailPct ?? DEFAULT_LOWER_GUARDRAIL_PCT) / 100
  const adj = (policy.adjustmentPct ?? DEFAULT_ADJUSTMENT_PCT) / 100
  const prev = clampRange(prevMultiplier, maxMultiplier)

  // An undefined signal (no starting portfolio, non-finite current rate) holds:
  // there is nothing to compare against, so spending is left where it is.
  if (!(startingRate > 0) || !Number.isFinite(currentRate) || currentRate < 0) {
    return { multiplier: prev, action: 'hold' }
  }

  const ratio = currentRate / startingRate
  if (ratio > upper) {
    const multiplier = clampRange(prev - adj, maxMultiplier)
    return { multiplier, action: multiplier < prev - 1e-9 ? 'cut' : 'hold' }
  }
  if (ratio < lower) {
    const multiplier = clampRange(prev + adj, maxMultiplier)
    return { multiplier, action: multiplier > prev + 1e-9 ? 'raise' : 'hold' }
  }
  return { multiplier: prev, action: 'hold' }
}

/**
 * One year's risk-based guardrail decision. The signal is the real (deflated)
 * start-of-year portfolio balance against dollar thresholds expressed as a
 * percent of the starting portfolio. The thresholds come from the shared-path
 * probability solver (engine/montecarlo/riskBasedGuardrails.ts): the balance
 * levels at which the plan's probability of success leaves the user's target
 * band. Below the lower threshold ⇒ cut the discretionary layer one
 * `adjustmentPct` step; above the upper threshold ⇒ restore/raise one step.
 *
 * Missing or degenerate thresholds hold: a risk-based policy whose thresholds
 * have not been solved yet adjusts nothing (it behaves like fixed target), so
 * the mode can never act on made-up numbers.
 */
export function nextBalanceGuardrailMultiplier(
  prevMultiplier: number,
  currentRealBalance: number,
  startingBalance: number,
  policy: GuardrailPolicy = {},
  maxMultiplier = 1,
): GuardrailDecision {
  const adj = (policy.adjustmentPct ?? DEFAULT_ADJUSTMENT_PCT) / 100
  const prev = clampRange(prevMultiplier, maxMultiplier)
  const lowerPct = policy.lowerBalanceThresholdPct
  const upperPct = policy.upperBalanceThresholdPct
  if (!(startingBalance > 0) || !Number.isFinite(currentRealBalance) || currentRealBalance < 0) {
    return { multiplier: prev, action: 'hold' }
  }
  const lower = lowerPct !== undefined && lowerPct > 0 ? (lowerPct / 100) * startingBalance : null
  const upper = upperPct !== undefined && upperPct > 0 ? (upperPct / 100) * startingBalance : null
  // An inverted pair (lower ≥ upper) is degenerate; hold rather than oscillate.
  if (lower !== null && upper !== null && lower >= upper) {
    return { multiplier: prev, action: 'hold' }
  }
  if (lower !== null && currentRealBalance < lower) {
    const multiplier = clampRange(prev - adj, maxMultiplier)
    return { multiplier, action: multiplier < prev - 1e-9 ? 'cut' : 'hold' }
  }
  if (upper !== null && currentRealBalance > upper) {
    const multiplier = clampRange(prev + adj, maxMultiplier)
    return { multiplier, action: multiplier > prev + 1e-9 ? 'raise' : 'hold' }
  }
  return { multiplier: prev, action: 'hold' }
}
