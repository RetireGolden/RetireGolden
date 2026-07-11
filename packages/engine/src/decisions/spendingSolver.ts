/**
 * Sustainable-spending solver (planning-depth roadmap §4 / Phase 3).
 *
 * Answers "how much can this plan spend every year?" with the exact ledger:
 * bisection over `expenses.baseAnnual` (today's dollars), where a spending
 * level is feasible only when the full `simulatePlan` run never depletes and
 * the ending after-tax estate stays at or above the requested floor (the
 * bequest target, entered in today's dollars and inflated to nominal
 * end-of-plan dollars). Spending phases, one-time goals, healthcare, taxes, and
 * every other ledger cross-effect apply unchanged — the solver never builds
 * its own cash-flow approximation. Deterministic under a hard simulation cap:
 * fixed probe sequence, integer-dollar midpoints, no randomness.
 */

import { evaluateCandidate, planForCandidate, type EvaluateCandidateOptions } from './evaluateCandidate.js'
import { nominalDollarsAtPlanEnd } from './objectives.js'
import type { DecisionCandidate, DecisionContext, ExactDecisionEvaluation } from './types.js'

export interface SustainableSpendingOptions {
  /** Hard cap on exact-ledger simulations (bracketing probes + bisection). */
  maxSimulations?: number
  /** Stop when the feasible/infeasible bracket is at most this wide. */
  resolutionDollars?: number
  /**
   * Ending after-tax estate must stay at or above this (bequest target), in
   * today's dollars; the solver inflates it to nominal end-of-plan dollars
   * before comparing against the nominal ending estate.
   */
  estateFloorTodayDollars?: number
  /** Base plan patch applied under every probed spending level. */
  basePatch?: Record<string, unknown>
  /**
   * `candidateResult` is excluded: every probe must simulate its own spending
   * level, so a cached projection would poison the feasibility test.
   */
  evaluation?: Omit<EvaluateCandidateOptions, 'candidateResult'>
}

export interface SustainableSpendingResult {
  /**
   * Highest feasible annual base spending found (today's dollars), or null
   * when even zero base spending depletes or breaks the estate floor.
   */
  maxBaseAnnual: number | null
  /**
   * maxBaseAnnual minus the current base spending — the basePatch's override
   * when present, else the plan's own (negative ⇒ overspending today).
   */
  spendingSlackDollars: number | null
  /** Exact-ledger evaluation of the plan at `maxBaseAnnual`. */
  bestEvaluation: ExactDecisionEvaluation | null
  /** True when the bracket converged to `resolutionDollars` within the budget. */
  converged: boolean
  /**
   * Why the next-higher probed spending level failed — the constraint that
   * binds the answer. Null when no infeasible level was probed (unbounded
   * spending) or the solve bailed out on a diagnostic evaluation.
   */
  limitingConstraint: 'depletion' | 'estate-floor' | null
  simulationCount: number
  diagnostics: string[]
}

const DEFAULT_MAX_SIMULATIONS = 24
const DEFAULT_RESOLUTION_DOLLARS = 500
/**
 * Shared interactive-surface budget: the "How much can I spend?" page and the
 * Insights spending-headroom detector both solve with this bound so their
 * answers agree exactly (the solver is deterministic under a fixed budget).
 */
export const SPENDING_SOLVER_UI_BUDGET = 25
/** First doubling probe when the plan's own base spending is (near) zero. */
const MINIMUM_BRACKET_PROBE_DOLLARS = 20_000
/** Doubling stops here; past this the plan's income plainly outruns spending. */
const UNBOUNDED_SPENDING_DOLLARS = 100_000_000

function spendingCandidate(
  basePatch: Record<string, unknown> | undefined,
  baseAnnual: number,
): DecisionCandidate {
  const baseExpenses = basePatch?.['expenses']
  return {
    id: `sustainable-spending-${baseAnnual}`,
    source: 'search',
    category: 'spending',
    label: `Base spending $${Math.round(baseAnnual).toLocaleString()}/yr`,
    explanation:
      'Sustainable-spending probe: the exact ledger runs the whole plan at this base spending level.',
    planPatch: {
      ...basePatch,
      expenses: {
        ...(baseExpenses && typeof baseExpenses === 'object' ? (baseExpenses as Record<string, unknown>) : {}),
        baseAnnual,
      },
    },
  }
}

/**
 * Find the maximum sustainable annual base spending by exact-ledger bisection.
 * Returns a lower-bound answer (with `converged: false` and a diagnostic) when
 * the simulation budget runs out before the bracket tightens.
 */
export function solveMaxSustainableSpending(
  ctx: DecisionContext,
  options: SustainableSpendingOptions = {},
): SustainableSpendingResult {
  const maxSimulations = options.maxSimulations ?? DEFAULT_MAX_SIMULATIONS
  const resolutionDollars = options.resolutionDollars ?? DEFAULT_RESOLUTION_DOLLARS
  const estateFloorTodayDollars = options.estateFloorTodayDollars ?? 0

  // Runtime guard behind the Omit: a cached candidateResult from a JS caller
  // would make every probe reuse one projection instead of simulating its own.
  const evaluationOptions: EvaluateCandidateOptions = { ...options.evaluation }
  delete evaluationOptions.candidateResult

  // Every probe runs on the basePatch-applied plan, so both the "current"
  // spending reference (bracketing seed + slack basis) and the inflation used
  // to inflate the estate floor must come from that patched plan, not the
  // unpatched baseline. An invalid patch falls back to the plan; the first
  // probe then returns a diagnostic evaluation and the solve bails out.
  const patchedBase = options.basePatch ? planForCandidate(ctx.plan, { planPatch: options.basePatch }) : null
  const effectivePlan = patchedBase?.ok ? patchedBase.plan : ctx.plan
  const currentBaseAnnual = effectivePlan.expenses.baseAnnual

  // Amortized spending (ABW) computes the year's lifestyle target from the
  // portfolio itself and ignores `baseAnnual`, so bisecting baseAnnual would
  // simulate the identical plan at every probe — the "max fixed spending
  // level" question has no answer there. Bail out with a diagnostic instead
  // of burning the budget on indistinguishable probes.
  if (effectivePlan.expenses.spendingPolicy?.mode === 'abw') {
    return {
      maxBaseAnnual: null,
      spendingSlackDollars: null,
      bestEvaluation: null,
      converged: false,
      limitingConstraint: null,
      simulationCount: 0,
      diagnostics: [
        'This plan uses amortized spending (ABW), which recomputes annual spending from the portfolio each year — there is no fixed base-spending level to solve for. Switch the spending policy to fixed target or guardrails to use this solver.',
      ],
    }
  }

  const diagnostics: string[] = []
  let simulationCount = 0
  let bestFeasible: { amount: number; evaluation: ExactDecisionEvaluation } | null = null
  // Reason the current upper (infeasible) bracket bound failed; tightening the
  // bracket keeps this in sync with the bound the answer finally rests against.
  let limitingConstraint: 'depletion' | 'estate-floor' | null = null

  const probe = (baseAnnual: number): { feasible: boolean; evaluation: ExactDecisionEvaluation } => {
    simulationCount++
    const evaluation = evaluateCandidate(ctx, spendingCandidate(options.basePatch, baseAnnual), evaluationOptions)
    const depleted = evaluation.candidateResult.depletionYear !== null
    const breaksFloor =
      evaluation.candidateSummary.endingAfterTaxEstate <
      nominalDollarsAtPlanEnd(estateFloorTodayDollars, effectivePlan, evaluation.candidateResult)
    const feasible = evaluation.recommendationState !== 'diagnostic' && !depleted && !breaksFloor
    if (feasible && (bestFeasible === null || baseAnnual > bestFeasible.amount)) {
      bestFeasible = { amount: baseAnnual, evaluation }
    }
    if (!feasible && evaluation.recommendationState !== 'diagnostic') {
      limitingConstraint = depleted ? 'depletion' : 'estate-floor'
    }
    return { feasible, evaluation }
  }

  const finish = (lower: number | null, upper: number | null): SustainableSpendingResult => {
    const converged = lower !== null && upper !== null && upper - lower <= resolutionDollars
    if (!converged && lower !== null) {
      diagnostics.push(
        `Stopped before converging to $${resolutionDollars.toLocaleString()}; the result is a feasible lower bound.`,
      )
    }
    return {
      maxBaseAnnual: bestFeasible?.amount ?? null,
      spendingSlackDollars: bestFeasible ? bestFeasible.amount - currentBaseAnnual : null,
      bestEvaluation: bestFeasible?.evaluation ?? null,
      converged,
      limitingConstraint,
      simulationCount,
      diagnostics,
    }
  }

  // Bracket the answer starting from the current base spending.
  const seedAmount = Math.max(0, Math.round(currentBaseAnnual))
  const seed = probe(seedAmount)
  if (seed.evaluation.recommendationState === 'diagnostic') {
    diagnostics.push(...seed.evaluation.diagnostics)
    return finish(null, null)
  }

  let lower: number | null
  let upper: number | null
  if (seed.feasible) {
    lower = seedAmount
    upper = null
    let next = Math.max(seedAmount * 2, MINIMUM_BRACKET_PROBE_DOLLARS)
    while (simulationCount < maxSimulations) {
      if (next > UNBOUNDED_SPENDING_DOLLARS) {
        diagnostics.push(
          'Spending appears unbounded at the probed range — guaranteed income outruns spending at every tested level.',
        )
        return finish(lower, upper)
      }
      if (probe(next).feasible) {
        lower = next
        next *= 2
      } else {
        upper = next
        break
      }
    }
  } else {
    upper = seedAmount
    if (upper === 0) {
      diagnostics.push('Even zero base spending depletes the portfolio or breaks the estate floor.')
      return finish(null, upper)
    }
    if (simulationCount >= maxSimulations) {
      diagnostics.push('Simulation budget exhausted before any feasible spending level was found.')
      return finish(null, upper)
    }
    if (probe(0).feasible) {
      lower = 0
    } else {
      diagnostics.push('Even zero base spending depletes the portfolio or breaks the estate floor.')
      return finish(null, upper)
    }
  }

  // Bisect the bracket down to the requested resolution.
  while (
    lower !== null &&
    upper !== null &&
    upper - lower > resolutionDollars &&
    simulationCount < maxSimulations
  ) {
    const mid = Math.round((lower + upper) / 2)
    if (mid === lower || mid === upper) break
    if (probe(mid).feasible) lower = mid
    else upper = mid
  }

  return finish(lower, upper)
}
