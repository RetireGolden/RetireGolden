/**
 * Risk-based guardrail threshold solver (risk-based-guardrails plan, step 2).
 *
 * Translates a target probability-of-success band into dollar-denominated
 * portfolio thresholds: "if the portfolio falls below $X, cut spending; above
 * $Z, raise it." For a candidate balance level the solver re-evaluates the
 * plan's Monte Carlo success probability with every investable balance scaled
 * to that level — always on the same seeded market paths, so each probe sees
 * identical market histories and the search is deterministic. Bisection over
 * the balance scale finds where success crosses each band edge; a second
 * bisection over the spending level sizes the adjustment that would bring
 * success back to the middle of the band.
 *
 * The evaluated variant is the plan's *fixed-target* spending (any guardrail
 * policy stripped): the question each threshold answers is "what is the chance
 * the current spending plan succeeds with no future adjustments" — the public
 * risk-based guardrail methodology (Kitces 2025; Guyton–Klinger critiques by
 * Pfau/Jeske motivate the balance-based trigger). Nested full re-simulation
 * per probe is the budgeted cost; callers keep pathCount modest and run this
 * in a worker.
 */

import type { Account, Plan } from '../model/plan.js'
import type { TaxCalculator } from '../projection/types.js'
import type { LtcShockParams } from './ltcShock.js'
import type { MarketModelConfig } from './marketModels.js'
import { createMarketModel } from './marketModels.js'
import { runMonteCarloPaths } from './run.js'
import { DEFAULT_MONTE_CARLO_SEED } from './rng.js'

export const DEFAULT_TARGET_SUCCESS_LOWER_PCT = 70
export const DEFAULT_TARGET_SUCCESS_UPPER_PCT = 95

/** Balance-scale search bracket: 2% to 400% of today's portfolio. */
const MIN_BALANCE_FRAC = 0.02
const MAX_BALANCE_FRAC = 4
/** Bisection iterations: balance resolution ~0.4% of the bracket, spending ~0.3%. */
const BALANCE_BISECTION_ITERATIONS = 10
const SPENDING_BISECTION_ITERATIONS = 8

const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash'])

export interface RiskBasedGuardrailSolveOptions {
  startYear: number
  taxCalculator: TaxCalculator
  model: MarketModelConfig
  pathCount: number
  seed: number
  stochasticLongevity?: boolean
  ltcShock?: LtcShockParams | null
  /** Success-band edges as percents; default to the policy on the plan, then 70/95. */
  lowerBandPct?: number
  upperBandPct?: number
  /** Called after each completed Monte Carlo probe (drives progress UI). */
  onProbeDone?: (completed: number, total: number) => void
  /**
   * Test seam (D-SOLVER-SEAM). When set, every success evaluation calls this
   * instead of re-running the plan's Monte Carlo: `balanceFrac` is the scale
   * applied to every investable balance and `spendingMultiplier` the scale
   * applied to target spending (1 during the band-edge search and for
   * successAtCurrent). It must return a finite probability in [0, 1] and be
   * nondecreasing in balanceFrac and nonincreasing in spendingMultiplier, as
   * shared-path Monte Carlo success is; the solver refuses a value outside
   * [0, 1] and does not check monotonicity. Omitted (the default): unchanged.
   */
  successProbe?: (balanceFrac: number, spendingMultiplier: number) => number
}

export interface RiskBasedThreshold {
  /** Balance level as a fraction of today's investable portfolio (a lattice point of the search). */
  balanceFrac: number
  /**
   * The same level as the percent the planner persists on the policy
   * (`lowerBalanceThresholdPct` / `upperBalanceThresholdPct`):
   * `balanceThresholdPct(balanceFrac)`, two decimals. The ledger acts on this
   * percent, never on `balanceFrac`; `guardrailThresholdDollars` gives it in
   * dollars.
   */
  balancePct: number
  /** Success probability re-evaluated at the threshold (0..1). */
  successAtThreshold: number
}

/** Decimal places of a persisted threshold percent (0.01 percent). */
export const BALANCE_THRESHOLD_PCT_DECIMALS = 2

/**
 * The percent the planner persists for a solved balance fraction:
 * Math.round(balanceFrac × 10^(2 + BALANCE_THRESHOLD_PCT_DECIMALS)) / 10^BALANCE_THRESHOLD_PCT_DECIMALS,
 * that is Math.round(balanceFrac × 10,000) / 100 at two decimals, in floating
 * point. At three of the solver's 1,024 lattice points the product lands a
 * hair below a half and rounds down (76.62 where the exact 76.625 rounds half
 * up to 76.63): at most 0.01 percent of the balance, about a fortieth of the
 * solver's own step. Refuses (RangeError) a fraction that is not a positive
 * finite number.
 */
export function balanceThresholdPct(balanceFrac: number): number {
  if (!Number.isFinite(balanceFrac) || balanceFrac <= 0) {
    throw new RangeError(`A balance threshold must be a positive finite fraction of the portfolio; got ${balanceFrac}.`)
  }
  const scale = 10 ** BALANCE_THRESHOLD_PCT_DECIMALS
  return Math.round(balanceFrac * (100 * scale)) / scale
}

/**
 * Why a band edge has no threshold. 'always-above-band': success stays at or
 * above the edge even at the bottom of the search bracket — the plan is safe
 * at any realistic balance and needs no trigger. 'never-reaches-band': success
 * stays below the edge even at the top of the bracket — the plan is underfunded
 * for this band at any realistic balance, which is the opposite of safe.
 */
export type RiskBasedThresholdOutcome = 'solved' | 'always-above-band' | 'never-reaches-band'

export interface RiskBasedAdjustment {
  /** Spending multiplier that restores success to the recovery target at the threshold. */
  spendingMultiplier: number
  /** Adjustment size in today's dollars per year (positive for both cut and raise). */
  annualDollars: number
  /** The same per month. */
  monthlyDollars: number
  /** Success probability after the adjustment, evaluated at the threshold balance (0..1). */
  successAfter: number
}

export interface RiskBasedGuardrailSolution {
  /** Sum of investable balances today — the base the fractions apply to. */
  startingInvestable: number
  /** Success probability of the fixed-target plan at today's balances (0..1). */
  successAtCurrent: number
  lowerBandPct: number
  upperBandPct: number
  /**
   * Balance below which success falls under the lower band edge. Null when no
   * crossing exists inside the search bracket; `lowerOutcome` says which way —
   * always safe vs underfunded (the two must not be conflated).
   */
  lower: RiskBasedThreshold | null
  lowerOutcome: RiskBasedThresholdOutcome
  /** Balance above which success clears the upper band edge; null when no crossing exists. */
  upper: RiskBasedThreshold | null
  upperOutcome: RiskBasedThresholdOutcome
  /** Spending cut at the lower threshold that restores success to the band midpoint. */
  suggestedCut: RiskBasedAdjustment | null
  /** Spending raise at the upper threshold that brings success back down to the band midpoint. */
  suggestedRaise: RiskBasedAdjustment | null
  pathCount: number
  seed: number
}

function isInvestable(account: Account): boolean {
  return INVESTABLE_ACCOUNT_TYPES.has(account.type)
}

/**
 * Today's investable balances: the entered balance of every cash, taxable,
 * equityComp, traditional, Roth and HSA account, added in plan order. Property,
 * annuities and other rows are excluded by type. This is the ledger's own
 * first-year real portfolio (the same rows in the same order, at an inflation
 * factor of exactly 1), which is why the risk-based guardrail thresholds in
 * dollars are this sum times the persisted percents.
 */
export function startingInvestableOf(plan: Plan): number {
  let total = 0
  for (const account of plan.accounts) {
    if (isInvestable(account) && 'balance' in account) total += account.balance
  }
  return total
}

/**
 * Scale every investable balance (and its basis fields proportionally, so the
 * tax character of the portfolio is unchanged) to `frac` of today's level.
 */
function scaleInvestableBalances(plan: Plan, frac: number): Plan {
  return {
    ...plan,
    accounts: plan.accounts.map((account): Account => {
      if (!isInvestable(account) || !('balance' in account)) return account
      const scaled = { ...account, balance: account.balance * frac }
      if ('costBasis' in scaled) scaled.costBasis = scaled.costBasis * frac
      if ('contributionBasis' in scaled && scaled.contributionBasis !== undefined) {
        scaled.contributionBasis = scaled.contributionBasis * frac
      }
      if ('nondeductibleBasis' in scaled && scaled.nondeductibleBasis !== undefined) {
        scaled.nondeductibleBasis = scaled.nondeductibleBasis * frac
      }
      return scaled
    }),
  }
}

function scaleTargetSpending(plan: Plan, multiplier: number): Plan {
  return {
    ...plan,
    expenses: { ...plan.expenses, baseAnnual: Math.max(0, plan.expenses.baseAnnual * multiplier) },
  }
}

export function solveRiskBasedGuardrails(plan: Plan, opts: RiskBasedGuardrailSolveOptions): RiskBasedGuardrailSolution {
  const policy = plan.expenses.spendingPolicy
  const lowerBandPct = opts.lowerBandPct ?? policy?.targetSuccessLowerPct ?? DEFAULT_TARGET_SUCCESS_LOWER_PCT
  const upperBandPct = opts.upperBandPct ?? policy?.targetSuccessUpperPct ?? DEFAULT_TARGET_SUCCESS_UPPER_PCT
  if (!(lowerBandPct < upperBandPct)) {
    throw new Error(
      `The success band is inverted (${lowerBandPct}–${upperBandPct}%): the cut edge must be below the raise edge.`,
    )
  }
  const recoveryTarget = (lowerBandPct + upperBandPct) / 2 / 100

  // The evaluated variant keeps spending fixed: thresholds describe the chance
  // the *current* plan succeeds without future adjustments.
  const fixedTargetPlan: Plan = { ...plan, expenses: { ...plan.expenses, spendingPolicy: undefined } }
  const startingInvestable = startingInvestableOf(plan)

  const totalProbes =
    1 + 2 * BALANCE_BISECTION_ITERATIONS + 2 + 2 * (SPENDING_BISECTION_ITERATIONS + 1)
  let completedProbes = 0
  const successOf = (balanceFrac: number, spendingMultiplier: number, variant: () => Plan): number => {
    if (opts.successProbe) {
      const probed = opts.successProbe(balanceFrac, spendingMultiplier)
      if (!(Number.isFinite(probed) && probed >= 0 && probed <= 1)) {
        throw new RangeError(
          `successProbe returned ${probed} at balanceFrac ${balanceFrac}, spendingMultiplier ${spendingMultiplier}; a success probability must be a finite number from 0 to 1.`,
        )
      }
      completedProbes++
      opts.onProbeDone?.(completedProbes, totalProbes)
      return probed
    }
    const result = runMonteCarloPaths(variant(), {
      startYear: opts.startYear,
      taxCalculator: opts.taxCalculator,
      model: createMarketModel(opts.model),
      seed: opts.seed,
      pathCount: opts.pathCount,
      stochasticLongevity: opts.stochasticLongevity,
      ltcShock: opts.ltcShock,
    })
    completedProbes++
    opts.onProbeDone?.(completedProbes, totalProbes)
    if (result.paths.length === 0) return 0
    let successes = 0
    for (const p of result.paths) if (p.depletionYear === null) successes++
    return successes / result.paths.length
  }

  const successByFrac = new Map<number, number>()
  const successAtFrac = (frac: number): number => {
    const key = Math.round(frac * 1e6)
    const cached = successByFrac.get(key)
    if (cached !== undefined) return cached
    const success = successOf(frac, 1, () => scaleInvestableBalances(fixedTargetPlan, frac))
    successByFrac.set(key, success)
    return success
  }

  const successAtCurrent = successAtFrac(1)

  // Success is monotone nondecreasing in the balance scale on shared paths, so
  // each band edge is a single crossing findable by bisection. The solved frac
  // is the *lowest* balance still inside the band for the lower edge, and the
  // lowest balance above the band for the upper edge. A missing crossing keeps
  // its reason: staying above the edge everywhere (safe) is the opposite of
  // never reaching it (underfunded), and callers must not conflate them.
  const solveCrossing = (
    targetPct: number,
  ): { threshold: RiskBasedThreshold | null; outcome: RiskBasedThresholdOutcome } => {
    const target = targetPct / 100
    if (successAtFrac(MIN_BALANCE_FRAC) >= target) return { threshold: null, outcome: 'always-above-band' }
    if (successAtFrac(MAX_BALANCE_FRAC) < target) return { threshold: null, outcome: 'never-reaches-band' }
    let lo = MIN_BALANCE_FRAC
    let hi = MAX_BALANCE_FRAC
    for (let i = 0; i < BALANCE_BISECTION_ITERATIONS; i++) {
      const mid = (lo + hi) / 2
      if (successAtFrac(mid) >= target) hi = mid
      else lo = mid
    }
    return {
      threshold: { balanceFrac: hi, balancePct: balanceThresholdPct(hi), successAtThreshold: successAtFrac(hi) },
      outcome: 'solved',
    }
  }

  const lowerCrossing = solveCrossing(lowerBandPct)
  const upperCrossing = solveCrossing(upperBandPct)
  const lower = lowerCrossing.threshold
  const upper = upperCrossing.threshold

  // Size the adjustment: at the threshold balance, bisect the target-spending
  // multiplier until success returns to the middle of the band. The floor of
  // the cut search respects the plan's required spending floor.
  const solveAdjustment = (
    threshold: RiskBasedThreshold | null,
    direction: 'cut' | 'raise',
  ): RiskBasedAdjustment | null => {
    if (!threshold || plan.expenses.baseAnnual <= 0) return null
    const atThreshold = scaleInvestableBalances(fixedTargetPlan, threshold.balanceFrac)
    const requiredFloorMultiplier = Math.min(1, (plan.expenses.requiredAnnual ?? 0) / plan.expenses.baseAnnual)
    const minMultiplier = direction === 'cut' ? Math.max(0.3, requiredFloorMultiplier) : 1
    const maxMultiplier = direction === 'cut' ? 1 : 2
    const successAtSpend = (m: number) => successOf(threshold.balanceFrac, m, () => scaleTargetSpending(atThreshold, m))
    // Success falls as spending rises: check the target is reachable inside the bracket.
    const bestCase = successAtSpend(direction === 'cut' ? minMultiplier : maxMultiplier)
    if (direction === 'cut' && bestCase < recoveryTarget) return null
    if (direction === 'raise' && bestCase > recoveryTarget) {
      // Even a 2× raise keeps success above the midpoint; report the bracket max.
      const annual = plan.expenses.baseAnnual * (maxMultiplier - 1)
      return { spendingMultiplier: maxMultiplier, annualDollars: annual, monthlyDollars: annual / 12, successAfter: bestCase }
    }
    let lo = minMultiplier
    let hi = maxMultiplier
    for (let i = 0; i < SPENDING_BISECTION_ITERATIONS; i++) {
      const mid = (lo + hi) / 2
      if (successAtSpend(mid) >= recoveryTarget) lo = mid
      else hi = mid
    }
    const multiplier = lo
    const annual = Math.abs(1 - multiplier) * plan.expenses.baseAnnual
    return {
      spendingMultiplier: multiplier,
      annualDollars: annual,
      monthlyDollars: annual / 12,
      successAfter: successAtSpend(multiplier),
    }
  }

  return {
    startingInvestable,
    successAtCurrent,
    lowerBandPct,
    upperBandPct,
    lower,
    lowerOutcome: lowerCrossing.outcome,
    upper,
    upperOutcome: upperCrossing.outcome,
    suggestedCut: solveAdjustment(lower, 'cut'),
    suggestedRaise: solveAdjustment(upper, 'raise'),
    pathCount: opts.pathCount,
    seed: opts.seed,
  }
}

/**
 * A risk-based guardrail policy's thresholds as the planner shows them.
 * 'unsolved': no percent is persisted yet, so the policy adjusts nothing.
 * 'anchored': today's investable balance `base` is positive, and `lower` and
 * `upper` are (percent / 100) × base in today's dollars, null where no percent
 * is persisted; `acts` is false when both exist and lower ≥ upper, where the
 * ledger holds spending every year. 'no-starting-portfolio': today's
 * investable balance is zero, so the ledger anchors on the first year the
 * portfolio has a balance, which only a simulation knows (and which varies by
 * path in Monte Carlo); the percents are published, no dollars.
 */
export type GuardrailThresholdDollars =
  | { readonly status: 'unsolved' }
  | {
      readonly status: 'anchored'
      readonly base: number
      readonly lower: number | null
      readonly upper: number | null
      readonly acts: boolean
    }
  | { readonly status: 'no-starting-portfolio'; readonly lowerPct: number | null; readonly upperPct: number | null }

/**
 * The cut and raise thresholds of a risk-based guardrail policy in today's
 * dollars, on the base the ledger acts on: (lowerBalanceThresholdPct / 100) × B
 * and (upperBalanceThresholdPct / 100) × B in that association, with
 * B = startingInvestableOf(plan), the ledger's first-year real portfolio. Null
 * unless the plan's spending policy is risk-based guardrails.
 */
export function guardrailThresholdDollars(plan: Plan): GuardrailThresholdDollars | null {
  const policy = plan.expenses.spendingPolicy
  if (policy?.mode !== 'riskBasedGuardrails') return null
  const lowerPct = policy.lowerBalanceThresholdPct ?? null
  const upperPct = policy.upperBalanceThresholdPct ?? null
  if (lowerPct === null && upperPct === null) return { status: 'unsolved' }
  const base = startingInvestableOf(plan)
  if (!(base > 0)) return { status: 'no-starting-portfolio', lowerPct, upperPct }
  const lower = lowerPct === null ? null : (lowerPct / 100) * base
  const upper = upperPct === null ? null : (upperPct / 100) * base
  return { status: 'anchored', base, lower, upper, acts: !(lower !== null && upper !== null && lower >= upper) }
}

/**
 * Which Monte Carlo draw a risk-based policy's saved thresholds were solved
 * on (decision D-MC-DEFAULT-SEED, 2026-09-28), read from the seed the solve
 * stores beside them (`balanceThresholdSeed`):
 * - 'default': the engine's default seed, the draw every host now uses;
 * - 'plan-id': thresholds with no stored seed, solved before plan schema v6
 *   on a seed the planner took from the plan's id, which Duplicate, Save to
 *   My Plans and an import change;
 * - 'other': another stored seed (a document written by hand or by a tool).
 * Null unless the policy is risk-based with a threshold saved. The projection
 * does not read the seed: a saved threshold acts the same whichever draw
 * solved it.
 */
export type GuardrailThresholdSeedBasis =
  | { readonly basis: 'default' }
  | { readonly basis: 'plan-id' }
  | { readonly basis: 'other'; readonly seed: number }

export function guardrailThresholdSeedBasis(plan: Plan): GuardrailThresholdSeedBasis | null {
  const policy = plan.expenses.spendingPolicy
  if (policy?.mode !== 'riskBasedGuardrails') return null
  if (policy.lowerBalanceThresholdPct === undefined && policy.upperBalanceThresholdPct === undefined) return null
  const seed = policy.balanceThresholdSeed
  if (seed === undefined) return { basis: 'plan-id' }
  return seed === DEFAULT_MONTE_CARLO_SEED ? { basis: 'default' } : { basis: 'other', seed }
}
