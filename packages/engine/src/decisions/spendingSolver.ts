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
 * its own cash-flow approximation. A Marketplace year whose premium tax credit
 * the ledger cannot price counts its full premium, as the ledger already funds
 * it, and the result names those years. Deterministic under a hard simulation
 * cap: fixed probe sequence, integer-dollar midpoints, no randomness.
 */

import { formatGroupedNumber, formatWholeUsd } from '../internal/evidenceFormat.js'
import { evaluateCandidate, planForCandidate, type EvaluateCandidateOptions } from './evaluateCandidate.js'
import { nominalDollarsAtPlanEnd } from './objectives.js'
import { ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD } from './spendingSolverDiagnostics.js'
import type { AcaSupportCode } from '../projection/types.js'
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
  evaluation?: Omit<EvaluateCandidateOptions, 'candidateResult' | 'nonActionableAca'>
}

export interface SustainableSpendingResult {
  /**
   * Highest feasible annual base spending found (today's dollars), or null
   * when even the lowest valid level (the required spending floor, 0 when
   * the plan has none) depletes or breaks the estate floor, or when the solve
   * bailed out on a diagnostic evaluation. Under guardrails feasibility is not
   * monotone in the base amount, so a higher feasible level can exist.
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
  /**
   * Number of full-projection probes the solve ran: one seed probe at the
   * plan's base spending (rounded to a whole dollar, and raised to the
   * required spending floor rounded up when it would fall below it); when
   * feasible, doubling probes from max(2 × seed,
   * MINIMUM_BRACKET_PROBE_DOLLARS) until one fails or the budget or the
   * unbounded ceiling is reached; when infeasible and above the required
   * spending floor (`expenses.requiredAnnual` rounded up, 0 when none), one
   * probe at that floor; then one bisection probe per halving while the
   * bracket exceeds the resolution and the budget (maxSimulations) is not
   * spent.
   */
  simulationCount: number
  /**
   * True when the solve ran a probe at a base of 0 (a plan with no required
   * spending floor) and that run depleted: spending nothing still runs out of
   * money, so costs outside base spending exceed what the plan can fund.
   * False otherwise, including when the budget ran out before 0 was probed.
   */
  zeroSpendingDepletes: boolean
  /**
   * Years whose ACA premium tax credit the ledger could not price
   * (`aca.readiness === 'nonActionable'`) in the evaluation the result rests
   * on: the best feasible probe; with no answer, the probe the failure
   * diagnostic describes (the floor probe when it ran, else the seed). The
   * ledger budgets the full Marketplace premium in each; the credit lies
   * between 0 and that premium (26 U.S.C. 36B(b)(2)). Which way a credit
   * there would move the answer is `acaGrossPremiumDirection`. Empty when
   * every Marketplace year is priced, the plan has none, or the solve bailed
   * out on a diagnostic evaluation.
   */
  acaGrossPremiumYears: number[]
  /**
   * The support codes that blocked pricing in those years, distinct, in
   * first-seen order: every code the ledger treats as blocking, which is all
   * but the two informational tax-exempt-interest codes.
   */
  acaGrossPremiumReasons: AcaSupportCode[]
  /**
   * How a credit in `acaGrossPremiumYears` would move the answer; null when
   * there are no such years. 'conservative' on a fixed-target plan: at fixed
   * spending a lower premium lowers what that year must withdraw, so a credit
   * would likely leave room to spend more. That is measured on the
   * fixed-target examples, not proven for every plan. 'uncertain' under an
   * adaptive spending policy (guardrails): a lower cost changes when the
   * guardrails cut or raise, and a ledger that priced the credit has been
   * measured to solve lower.
   */
  acaGrossPremiumDirection: 'conservative' | 'uncertain' | null
  /**
   * Why the solve stopped where it did, in order. When `acaGrossPremiumYears`
   * is non-empty the last entry is the sentence naming them.
   */
  diagnostics: string[]
}

/**
 * Support codes the ledger publishes on a year without blocking it
 * (`projection/internal/annualAcaResultPublication.ts` prices a year only when
 * every other code is absent), so they are never a reason a year is unpriced.
 */
const INFORMATIONAL_ACA_SUPPORT_CODES: ReadonlySet<AcaSupportCode> = new Set([
  'tax-exempt-interest-plan-derived',
  'tax-exempt-interest-contract-contradicted',
])

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
    label: `Base spending ${formatWholeUsd(baseAnnual)}/yr`,
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
  // A year whose ACA credit cannot be priced is already funded at its full
  // premium by the ledger, so a probe stays a valid feasibility test on that
  // ledger; the solve discloses those years instead of refusing every probe.
  // Always 'disclose': the option type leaves callers no way to ask for 'refuse'.
  const evaluationOptions: EvaluateCandidateOptions = { ...options.evaluation, nonActionableAca: 'disclose' }
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
      zeroSpendingDepletes: false,
      acaGrossPremiumYears: [],
      acaGrossPremiumReasons: [],
      acaGrossPremiumDirection: null,
      diagnostics: [
        'This plan uses amortized spending (ABW), which recomputes annual spending from the portfolio each year, so there is no fixed base-spending level to solve for. Switch the spending policy to fixed target or guardrails to use this solver.',
      ],
    }
  }

  const diagnostics: string[] = []
  let simulationCount = 0
  let bestFeasible: { amount: number; evaluation: ExactDecisionEvaluation } | null = null
  // The seed probe's evaluation, and the floor probe's once it runs: a solve
  // with no feasible level reports on the one its failure diagnostic names.
  let seedEvaluation: ExactDecisionEvaluation | null = null
  let floorEvaluation: ExactDecisionEvaluation | null = null
  let zeroSpendingDepletes = false
  // Reason the current upper (infeasible) bracket bound failed; tightening the
  // bracket keeps this in sync with the bound the answer finally rests against.
  let limitingConstraint: 'depletion' | 'estate-floor' | null = null

  const probe = (baseAnnual: number): { feasible: boolean; evaluation: ExactDecisionEvaluation } => {
    simulationCount++
    const evaluation = evaluateCandidate(ctx, spendingCandidate(options.basePatch, baseAnnual), evaluationOptions)
    seedEvaluation ??= evaluation
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
    if (baseAnnual === 0 && depleted && evaluation.recommendationState !== 'diagnostic') zeroSpendingDepletes = true
    return { feasible, evaluation }
  }

  const finish = (lower: number | null, upper: number | null): SustainableSpendingResult => {
    const converged = lower !== null && upper !== null && upper - lower <= resolutionDollars
    // Unpriced ACA years of the run the result rests on (the best feasible
    // probe; with no answer, the floor probe when it ran, else the seed); a
    // diagnostic run is no basis and reports none.
    const reported = bestFeasible?.evaluation ?? floorEvaluation ?? seedEvaluation
    const grossPremiumYears =
      reported === null || reported.recommendationState === 'diagnostic'
        ? []
        : reported.candidateResult.years.filter((year) => year.aca?.readiness === 'nonActionable')
    const acaGrossPremiumYears = grossPremiumYears.map((year) => year.year)
    const acaGrossPremiumReasons = [
      ...new Set(grossPremiumYears.flatMap((year) => year.aca?.supportCodes ?? [])),
    ].filter((code) => !INFORMATIONAL_ACA_SUPPORT_CODES.has(code))
    const acaGrossPremiumDirection =
      acaGrossPremiumYears.length === 0
        ? null
        : (effectivePlan.expenses.spendingPolicy?.mode ?? 'fixedTarget') === 'fixedTarget'
          ? 'conservative'
          : 'uncertain'
    // The codes are merged across years, so with several years and several
    // codes the sentence says each year has at least one of them.
    const acaReasonsText =
      acaGrossPremiumReasons.length === 0
        ? ''
        : acaGrossPremiumYears.length === 1 || acaGrossPremiumReasons.length === 1
          ? ` (${acaGrossPremiumReasons.join(', ')})`
          : ` (in each of those years, at least one of these applies: ${acaGrossPremiumReasons.join(', ')})`
    const acaLead =
      `${ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD}${acaGrossPremiumYears.join(', ')}${acaReasonsText}; ` +
      'the ledger budgets the full Marketplace premium in those years'
    const acaDisclosure =
      acaGrossPremiumDirection === null
        ? null
        : bestFeasible === null
          ? `${acaLead}, and a credit there would lower that cost.`
          : acaGrossPremiumDirection === 'conservative'
            ? `${acaLead}, so a household that receives a credit there would likely be able to spend somewhat more than this answer.`
            : `${acaLead}, and a credit there could move this answer up or down because the spending guardrails respond to healthcare costs.`
    if (!converged && lower !== null) {
      diagnostics.push(
        `Stopped before converging to $${formatGroupedNumber(resolutionDollars)}; the result is a feasible lower bound.`,
      )
    }
    return {
      maxBaseAnnual: bestFeasible?.amount ?? null,
      spendingSlackDollars: bestFeasible ? bestFeasible.amount - currentBaseAnnual : null,
      bestEvaluation: bestFeasible?.evaluation ?? null,
      converged,
      limitingConstraint,
      simulationCount,
      zeroSpendingDepletes,
      acaGrossPremiumYears,
      acaGrossPremiumReasons,
      acaGrossPremiumDirection,
      diagnostics: acaDisclosure === null ? diagnostics : [...diagnostics, acaDisclosure],
    }
  }

  // Bracket the answer starting from the current base spending, rounded to a
  // whole dollar but never below the required floor rounded up: the plan
  // checks refuse a base below that floor, so a probe there would only come
  // back as an invalid-plan diagnostic.
  const seedAmount = Math.max(0, Math.round(currentBaseAnnual), Math.ceil(effectivePlan.expenses.requiredAnnual ?? 0))
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
          'Spending appears unbounded at the probed range: guaranteed income outruns spending at every tested level.',
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
    // The plan checks refuse a base below the required spending floor, so the
    // lowest valid probe is that floor, not 0: a probe at 0 would come back as
    // an invalid-plan diagnostic and read as "even zero spending depletes".
    const floorAmount = Math.min(seedAmount, Math.max(0, Math.ceil(effectivePlan.expenses.requiredAnnual ?? 0)))
    // Names the constraint the lowest level failed (read when it has failed):
    // running out of money, or the ending estate falling short of the target;
    // with no target, only a negative estate can fail it.
    const floorFails = (): string =>
      `${
        floorAmount === 0
          ? 'Even zero base spending'
          : `Even the required spending floor (${formatWholeUsd(floorAmount)}/yr)`
      } ${
        limitingConstraint !== 'estate-floor'
          ? 'depletes the portfolio before the plan ends.'
          : estateFloorTodayDollars > 0
            ? `leaves an ending after-tax estate below the ${formatWholeUsd(estateFloorTodayDollars)} target (today's dollars).`
            : 'leaves a negative ending after-tax estate.'
      }`
    if (upper === floorAmount) {
      diagnostics.push(floorFails())
      return finish(null, upper)
    }
    if (simulationCount >= maxSimulations) {
      diagnostics.push('Simulation budget exhausted before any feasible spending level was found.')
      return finish(null, upper)
    }
    const floorProbe = probe(floorAmount)
    floorEvaluation = floorProbe.evaluation
    if (floorProbe.feasible) {
      lower = floorAmount
    } else {
      if (floorProbe.evaluation.recommendationState === 'diagnostic') diagnostics.push(...floorProbe.evaluation.diagnostics)
      else diagnostics.push(floorFails())
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
