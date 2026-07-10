/**
 * Plan → optimizer bridge + orchestration (roadmap V8, PR 1).
 *
 * Turns a whole Plan into the optimizer's linearised `OptimizerInput`, runs the
 * MILP (strategies/optimizer.ts), and writes the result back as an `optimized`
 * Roth-conversion strategy. The pure solver stays UI- and ledger-agnostic; this
 * module is where it meets the real engine.
 *
 * The bridge derives each year's exogenous inputs from a single BASELINE
 * projection (conversions stripped) via `captureOptimizerInputs` — so spending,
 * healthcare/IRMAA/ACA, Social Security, and RMDs are taken at their
 * no-conversion levels and held fixed for the LP (V8 §3.1: the LP is a
 * linearisation; re-running `simulate` with the emitted schedule reports exact
 * numbers and any gap). Balances, growth, and inflation come straight from the
 * plan.
 */

import { packForYear } from '../params'
import { stateParamsFor } from '../params/state'
import type { FilingStatus } from '../params/types'
import type { Account, Plan } from '../model/plan'
import {
  DECISION_MINIMUM_REQUESTED_CONVERSION_DOLLARS,
  DECISION_NEUTRAL_TOLERANCE_DOLLARS,
  attachStochasticMetrics,
  dedupeCandidates,
  evaluateCandidate,
  lastsThroughYear,
  rankEvaluations,
  refineConversionSchedule,
  simpleRothConversionGenerator,
  socialSecurityClaimGenerator,
  type DecisionContext,
  type ExactDecisionEvaluation,
  type ObjectivePolicy,
  type ObjectivePolicyId,
} from '../decisions'
import { applyScenarioPatch } from '../scenarios/scenarios'
import {
  optimizeSchedule,
  type OptimizedSchedule,
  type OptimizerInput,
  type OptimizerYear,
} from '../strategies/optimizer'
import { expectedAccountReturnPct } from '../allocation/assetClasses'
import { buildLognormalModelConfigForPlan } from '../montecarlo/marketModels'
import { summarizeProjection, type ProjectionSummary } from './compare'
import { simulatePlan, type SimulateOptions } from './simulate'
import type { OptimizerYearProbe, ProjectionResult } from './types'

const OTHER_TYPES = new Set(['cash', 'taxable', 'equityComp', 'roth', 'hsa'])

/**
 * Single preferential LTCG rate the optimizer uses to price taxable-bucket gains
 * inside the solve (Step 2). 15% is the modal federal preferential bracket for
 * retirees; a single rate linearizes the 0/15/20% stack and the exact ledger
 * refines it. State capital-gains treatment is not added inside the solve.
 */
const LP_LTCG_RATE = 0.15

/**
 * Convex state income-tax bracket PWL for a year (Step 3), mirroring the
 * federal `bracketSegments`: ascending segment widths + rates over the state's
 * brackets for the filing status. Returns undefined for no-income-tax states,
 * unknown codes, or a missing state — those keep the flat state term only.
 */
function stateBracketSegmentsFor(
  state: string | undefined,
  year: number,
  status: FilingStatus,
): { width: number | null; rate: number }[] | undefined {
  if (!state) return undefined
  const params = stateParamsFor(state, year)
  if (!params || !params.hasIncomeTax) return undefined
  const brackets = params.brackets[status]
  if (!brackets || brackets.length === 0) return undefined
  return brackets.map((b, i) => ({
    width: i + 1 < brackets.length ? brackets[i + 1]!.lowerBound - b.lowerBound : null,
    rate: b.ratePct / 100,
  }))
}

function isInvestable(a: Account): a is Extract<Account, { balance: number; annualReturnPct: number | null }> {
  return a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp' || a.type === 'traditional' || a.type === 'roth' || a.type === 'hsa'
}

export interface OptimizePlanOptions {
  startYear: number
  /** Same calculator the baseline/comparison run uses (federal ± state). */
  taxCalculator: SimulateOptions['taxCalculator']
  /**
   * Haircut on leftover traditional in the objective. Defaults to the plan's
   * `heirTaxRatePct` so the optimizer's objective matches the after-tax-estate
   * metric (`summarizeProjection`). Fraction is `pct / 100`.
   */
  liquidationRatePct?: number
  solver?: OptimizerInput['options']
  /**
   * Coordinate-descent refinement of a winning candidate schedule over the
   * exact ledger (decision-engine Phase 4). Off by default — the worker path
   * enables it with a bounded simulation budget.
   */
  search?: ExactLedgerSearchOptions | false
  /**
   * Objective policy the tournament ranks by (sustainable-spending plan,
   * Step 5). Omitted or `max-after-tax-estate` keeps the original tournament
   * behavior; any other policy re-ranks the same exact-ledger evaluations
   * through the shared `rankEvaluations` under that policy's constraints.
   */
  policy?: ObjectivePolicy
  /**
   * Exact-ledger convergence loop (optimizer-exact-ledger-convergence Track 1,
   * Step 1). Off/undefined
   * or `maxIterations ≤ 1` reproduces the single-solve schedule byte-for-byte.
   * When enabled, the MILP is re-solved against exogenous inputs recaptured from
   * the exact-ledger run of the incumbent schedule (taxable-SS phase-in and
   * IRMAA/ACA-priced spending become exact at the incumbent), iterating to a
   * fixed point so the recommendation is *optimal on the exact ledger to
   * tolerance* rather than "best found within a single linearization".
   */
  convergence?: ExactLedgerConvergenceOptions | false
}

export interface ExactLedgerSearchOptions {
  /** Hard cap on extra exact-ledger simulations spent refining the winner. */
  maxSimulations?: number
}

export interface ExactLedgerConvergenceOptions {
  /**
   * Hard cap on outer solve+sim iterations, including the first solve. `≤ 1`
   * disables the loop (single solve = today's schedule). Default
   * `DEFAULT_CONVERGENCE_ITERATIONS`.
   */
  maxIterations?: number
  /**
   * Stop once no year's conversion moves more than this between iterations
   * (nominal dollars). Default `DEFAULT_CONVERGENCE_SCHEDULE_TOLERANCE_DOLLARS`.
   */
  scheduleToleranceDollars?: number
  /**
   * Stop once the exact-ledger after-tax estate improves by less than this over
   * the previous iteration (nominal dollars). Default
   * `DEFAULT_CONVERGENCE_OBJECTIVE_TOLERANCE_DOLLARS`.
   */
  objectiveToleranceDollars?: number
  /**
   * Trust-region step limit: the largest per-year conversion change adopted in a
   * single iteration (nominal dollars), damping SLP oscillation. Default
   * `DEFAULT_CONVERGENCE_MAX_YEAR_STEP_DOLLARS`.
   */
  maxYearStepDollars?: number
  /**
   * Relaxation factor in `(0, 1]`: fraction of the solved step taken each
   * iteration before the trust-region clamp. `1` (default) takes the full step;
   * lower values damp harder.
   */
  dampingFactor?: number
}

export interface ExactLedgerConvergenceDiagnostics {
  /** True when the loop actually ran (enabled and `maxIterations > 1`). */
  enabled: boolean
  /** Outer solves performed (1 = first solve only). */
  iterations: number
  /** True when the schedule/objective settled within tolerance before the cap. */
  converged: boolean
  /** Exact after-tax estate at the final schedule minus at the first solve (nominal). */
  estateGainOverFirstSolveDollars: number
  /** Largest per-year conversion move on the final adopted iteration (nominal). */
  finalMaxYearMoveDollars: number
  /**
   * Which schedule the pipeline kept after post-processing both: the converged
   * schedule, or the first solve when its post-processed (trim + estate-prune)
   * form priced higher on the exact ledger — SLP converges to a local optimum,
   * and the post-processor can rescue a raw first solve into a better cleaned
   * schedule. Absent when the loop never adopted a step.
   */
  keptSchedule?: 'converged' | 'first-solve'
}

/** Blended nominal growth across investable accounts, weighted by balance. */
function blendedGrowth(plan: Plan, startYear: number): number {
  let weighted = 0
  let total = 0
  for (const a of plan.accounts) {
    if (!isInvestable(a)) continue
    const rate = expectedAccountReturnPct(a, plan.assumptions, startYear) / 100
    weighted += a.balance * rate
    total += a.balance
  }
  return total > 0 ? weighted / total : plan.assumptions.defaultReturnPct / 100
}

/**
 * Build the optimizer input from a probe projection.
 *
 * By default the probe is a conversion-free baseline, so the LP's exogenous
 * inputs (taxable SS, RMD divisors, spending, healthcare/IRMAA) are taken at
 * their no-conversion levels and held fixed for the solve. The exact-ledger
 * convergence loop (Step 1) passes the *incumbent* schedule as `probeSourcePlan`
 * so those same inputs are recaptured at the schedule the solver last emitted —
 * the SLP re-linearization that turns the solver's optimum into the exact-ledger
 * optimum by iteration (see `optimizePlan`).
 */
export function buildOptimizerInput(plan: Plan, opts: OptimizePlanOptions, probeSourcePlan?: Plan): OptimizerInput {
  // Strip conversions so the probe reflects no-conversion income/RMD/spending,
  // unless the caller supplies an incumbent-schedule plan to re-linearize around.
  const probeSource: Plan = probeSourcePlan ?? { ...plan, strategies: { ...plan.strategies, rothConversion: { mode: 'none' } } }
  const probes: OptimizerYearProbe[] = []
  simulatePlan(probeSource, {
    startYear: opts.startYear,
    taxCalculator: opts.taxCalculator,
    captureOptimizerInputs: (p) => probes.push(p),
  })

  let openingTrad = 0
  let openingInheritedTrad = 0
  let openingOther = 0 // tax-free bucket: cash + roth + hsa
  let openingTaxable = 0 // taxable brokerage + equity-comp
  let openingTaxableBasis = 0
  for (const a of plan.accounts) {
    if (a.type === 'traditional') {
      if (!a.inherited) openingTrad += a.balance
      else openingInheritedTrad += a.balance
    } else if (a.type === 'taxable' || a.type === 'equityComp') {
      // Step 2: the taxable bucket is split out so its withdrawals realize LTCG.
      openingTaxable += a.balance
      openingTaxableBasis += (a as { costBasis?: number }).costBasis ?? a.balance
    } else if (OTHER_TYPES.has(a.type)) {
      openingOther += (a as { balance: number }).balance
    }
  }
  // Aggregate opening basis fraction; gain fraction = 1 − this. A single opening
  // ratio is the v1 linearization (the exact ledger prices true depletion).
  const taxableBasisRatio = openingTaxable > 0 ? Math.min(1, Math.max(0, openingTaxableBasis / openingTaxable)) : 1

  const growth = blendedGrowth(plan, opts.startYear)
  const infl = plan.assumptions.inflationPct / 100
  const filingStatus = plan.household.filingStatus
  // Step 3: a flat `stateEffectiveTaxPct` override carries the whole state tax;
  // otherwise the flat term is local-only and the state's progressive brackets
  // are modeled as a PWL (`stateBrackets`). Retirement-income exclusions are
  // left to the exact ledger to refine.
  const stateOverridePct = plan.assumptions.stateEffectiveTaxPct
  const localPct = plan.assumptions.localIncomeTaxPct
  const stateRate = (stateOverridePct > 0 ? stateOverridePct + localPct : localPct) / 100
  const useStateBrackets = stateOverridePct <= 0

  const years: OptimizerYear[] = probes.map((p) => {
    const { pack } = packForYear(p.year)
    return {
      year: p.year,
      pack,
      filingStatus,
      stateBrackets: useStateBrackets ? stateBracketSegmentsFor(plan.household.state, p.year, filingStatus) : undefined,
      ordinaryIncomeBase: p.ordinaryIncomeBase,
      spendingNeed: p.spendingNeed,
      exogenousCash: p.exogenousCash,
      // Recover the divisor from the baseline ratio (startTrad / RMD) so the LP's
      // floor (trad ÷ divisor) reproduces the baseline RMD on the baseline balance.
      rmdDivisor: p.rmd > 0 && p.startTraditional > 0 ? p.startTraditional / p.rmd : null,
      // Baseline forced RMD, so saturation skips (senior deduction) see the
      // year's true no-conversion MAGI, not just the non-withdrawal base.
      baselineRmd: p.rmd,
      inheritedDistribution: p.inheritedDistribution,
      inheritedDistributionDivisor:
        p.inheritedDistribution > 0 && p.startInheritedTraditional > 0
          ? p.startInheritedTraditional / p.inheritedDistribution
          : null,
      peopleAged65Plus: p.peopleAged65Plus,
      inflationScale: Math.pow(1 + infl, p.year - pack.year),
      growth,
      stateRate,
      tradInflow: p.traditionalInflow,
      otherInflow: p.otherInflow,
      taxableInflow: p.taxableInflow,
      // Step 3: in-solve taxable-SS PWL so the solver sees the marginal tax
      // torpedo instead of the probe-time constant; baseline gains/dividends
      // feed provisional income and the IRMAA MAGI base.
      ssTaxability: p.ssBenefits > 0 ? { ssBenefits: p.ssBenefits, taxableSsBase: p.taxableSsBase } : undefined,
      capitalGainsBase: p.capitalGainsBase,
      // SSA-44 (opt-in): shift this premium year's IRMAA trigger to (t−1)'s
      // MAGI so the solve prices the redetermination the exact ledger applies.
      ssa44Redetermination: p.ssa44IrmaaRedetermination || undefined,
    }
  })

  const liquidationRate = (opts.liquidationRatePct ?? plan.assumptions.heirTaxRatePct) / 100
  return {
    years,
    openingTrad,
    openingInheritedTrad,
    openingOther,
    openingTaxable,
    taxableBasisRatio,
    // Single preferential LTCG rate for the solve — the modal 15% bracket. A
    // single rate linearizes the 0/15/20% stack; the exact ledger refines it.
    ltcgRate: openingTaxable > 0 ? LP_LTCG_RATE : 0,
    // Step 4: price IRMAA on the exact ledger's 2-year MAGI lookback in-solve.
    irmaaLookback: true,
    // Ground-truth 2026 law sync Step 2: price the OBBBA senior deduction and
    // its 6% MAGI phase-out in-solve so 65+ conversions see the marginal-rate
    // spike the exact ledger charges.
    seniorDeduction: true,
    liquidationRate,
    realDollarFactor: 1 / Math.pow(1 + infl, years.length),
    options: opts.solver,
  }
}

export interface OptimizePlanResult {
  schedule: OptimizedSchedule
  input: OptimizerInput
  postProcessed: ExactLedgerPostProcessing | null
  tournament: ExactLedgerTournament
  /**
   * Convergence-loop diagnostics (Step 1). Always present: reports `enabled:
   * false` on the default single-solve path so callers can render it uniformly.
   */
  convergence: ExactLedgerConvergenceDiagnostics
}

export interface SimpleCandidateEvaluation {
  id: string
  label: string
  /** Total conversions the exact ledger executed under this candidate strategy. */
  executedConversionTotal: number
  afterTaxEstateDelta: number
  lifetimeTaxDelta: number
  moneyLastsYearsDelta: number
}

export interface ExactLedgerTournament {
  /** Objective policy that ranked this tournament (default `max-after-tax-estate`). */
  policyId: ObjectivePolicyId
  /** All simple-candidate evaluations, in fixed generation order. */
  candidates: SimpleCandidateEvaluation[]
  /**
   * Who supplies the recommended schedule: the post-processed MILP, a simple
   * candidate, the plan's own already-applied conversion strategy
   * ('incumbent': nothing evaluated beat the current plan, so no change is
   * recommended), or nobody.
   */
  winnerSource: 'milp' | 'candidate' | 'incumbent' | 'none'
  winnerCandidateId: string | null
  winnerLabel: string | null
  /**
   * The recommended per-year schedule (exact-ledger executed amounts; empty
   * when winnerSource is 'none'; the plan's current executed conversions when
   * winnerSource is 'incumbent').
   */
  winnerConversions: { year: number; amount: number }[]
  /** Exact comparison for the winner; null for 'incumbent' (a plan's delta vs itself is zero) and 'none'. */
  winnerValidation: ExactLedgerValidation | null
  /** Candidate's exact estate delta over the displaced MILP schedule; 0 when no MILP comparison was made. */
  marginOverMilpDollars: number
  /** True when Phase 4 local search improved the winning candidate schedule. */
  searchRefined: boolean
  /** Exact-ledger simulations spent by local search (0 when search was off or skipped). */
  searchSimulations: number
}

/** A candidate only replaces the MILP schedule when it wins by more than this. */
const DEFAULT_TOURNAMENT_SWITCH_MARGIN_DOLLARS = 1_000

/**
 * The plan's currently-installed conversion strategy as exact-ledger executed
 * amounts, or null when the plan doesn't convert. When neither the MILP nor
 * any candidate beats the baseline — which *includes* these conversions — the
 * incumbent is the best known schedule and the tournament reports it as the
 * holder instead of a scary "nothing recommended" diagnostic (the common case
 * right after applying a winning schedule and re-running the optimizer).
 */
function incumbentExecutedConversions(plan: Plan, baselineResult: ProjectionResult): { year: number; amount: number }[] | null {
  if (plan.strategies.rothConversion.mode === 'none') return null
  const conversions = baselineResult.years
    .filter((year) => year.rothConversion > 1)
    .map((year) => ({ year: year.year, amount: roundDollars(year.rothConversion) }))
  return conversions.length > 0 ? conversions : null
}

function incumbentLabel(plan: Plan): string {
  switch (plan.strategies.rothConversion.mode) {
    case 'optimized':
      return 'your applied optimizer schedule'
    case 'manual':
      return 'your manual conversion schedule'
    default:
      return 'your current conversion strategy'
  }
}

interface RichCandidate {
  evaluation: SimpleCandidateEvaluation
  /** The full exact-ledger evaluation, kept for policy-based ranking. */
  fullEvaluation: ExactDecisionEvaluation
  conversions: { year: number; amount: number }[]
  result: ProjectionResult
}

function decisionContext(plan: Plan, baselineResult: ProjectionResult, simulateOptions: SimulateOptions): DecisionContext {
  return {
    plan,
    baselineResult,
    baselineSummary: summarizeProjection(plan, baselineResult),
    simulateOptions,
  }
}

function buildRichCandidates(plan: Plan, baselineResult: ProjectionResult, simulateOptions: SimulateOptions): RichCandidate[] {
  const ctx = decisionContext(plan, baselineResult, simulateOptions)
  return dedupeCandidates(simpleRothConversionGenerator.generate(ctx)).map((candidate) => {
    const evaluation = evaluateCandidate(ctx, candidate)
    return {
      evaluation: {
        id: candidate.id,
        label: candidate.label,
        executedConversionTotal: evaluation.candidateResult.years.reduce((sum, year) => sum + year.rothConversion, 0),
        afterTaxEstateDelta: evaluation.deltas.endingAfterTaxEstate,
        lifetimeTaxDelta: evaluation.deltas.lifetimeTax,
        moneyLastsYearsDelta: evaluation.deltas.moneyLastsYears,
      },
      fullEvaluation: evaluation,
      conversions: evaluation.candidateResult.years
        .filter((year) => year.rothConversion > 1)
        .map((year) => ({ year: year.year, amount: roundDollars(year.rothConversion) })),
      result: evaluation.candidateResult,
    }
  })
}

/**
 * Exact-ledger evaluations of a small fixed set of simple conversion
 * strategies (post-processor plan Phase 5; validation plan "candidate strategy
 * comparisons"). Each candidate is one deterministic `simulatePlan` run of the
 * plan with a fill-to-target Roth strategy over the whole horizon, priced with
 * the same summary metrics the recommendation gate uses.
 */
export function evaluateSimpleConversionCandidates(
  plan: Plan,
  baselineResult: ProjectionResult,
  simulateOptions: SimulateOptions,
): SimpleCandidateEvaluation[] {
  return buildRichCandidates(plan, baselineResult, simulateOptions).map((candidate) => candidate.evaluation)
}

/**
 * The bounded exact-ledger tournament (post-processor plan Phase 5): compare
 * the post-processed MILP schedule against the simple candidates and recommend
 * whichever wins on the exact after-tax estate. The MILP's linearisation can
 * over-convert past its own objective's break-even (its bracket, IRMAA, and
 * liquidity approximations diverge over long horizons), and on trad-heavy
 * fixtures a plain bracket fill beats the cleaned schedule by 2× — so the
 * winner, not the solver, supplies the recommendation. A candidate must beat
 * a recommendable MILP by a material margin (default $1k) to avoid churn on
 * ties, must never shorten money-lasts relative to the schedule it would
 * replace, and its schedule is exact-ledger executed amounts by construction.
 * Cost: six extra deterministic `simulatePlan` runs.
 */
export function runExactLedgerTournament(
  plan: Plan,
  baselineResult: ProjectionResult,
  postProcessed: ExactLedgerPostProcessing | null,
  simulateOptions: SimulateOptions,
  options: {
    switchMarginDollars?: number
    search?: ExactLedgerSearchOptions | false
    policy?: ObjectivePolicy
  } = {},
): ExactLedgerTournament {
  // A non-default objective re-ranks the same evaluations through the shared
  // ranker instead of the estate-delta arbitration below.
  if (options.policy && options.policy.id !== 'max-after-tax-estate') {
    return runPolicyRankedTournament(plan, baselineResult, postProcessed, simulateOptions, options.policy)
  }
  const margin = options.switchMarginDollars ?? DEFAULT_TOURNAMENT_SWITCH_MARGIN_DOLLARS
  const rich = buildRichCandidates(plan, baselineResult, simulateOptions)
  const candidates = rich.map((candidate) => candidate.evaluation)
  const milpRecommended = postProcessed !== null && postProcessed.recommendationSchedule === 'cleaned' ? postProcessed : null
  const milpDelta = milpRecommended ? milpRecommended.cleanedValidation.afterTaxEstateDelta : 0
  const guardrailResult = milpRecommended?.cleanedResult ?? baselineResult
  const guardrailLastsThroughYear = lastsThroughYear(guardrailResult)

  // Rank guardrail-passing candidates by exact estate delta. Search refines the
  // top two (not just the winner): the runner-up can sit in a different basin —
  // e.g. a lower bracket fill whose refined taper beats the raw winner — and
  // coordinate descent cannot cross basins from the winner alone.
  const eligible = rich
    .filter((candidate) => lastsThroughYear(candidate.result) >= guardrailLastsThroughYear)
    .sort((a, b) => b.evaluation.afterTaxEstateDelta - a.evaluation.afterTaxEstateDelta)
  const best = eligible[0] ?? null
  if (best !== null && best.conversions.length > 0) {
    const winnerValidation = evaluateExactLedgerSchedule(plan, best.conversions, baselineResult, best.result)
    const clearsMilpComparison = milpRecommended
      ? best.evaluation.afterTaxEstateDelta > milpDelta + margin
      : winnerValidation.recommendationState === 'beneficial'
    if (winnerValidation.recommendationState === 'beneficial' && clearsMilpComparison) {
      let winner = {
        candidate: best,
        conversions: best.conversions,
        validation: winnerValidation,
        estateDelta: best.evaluation.afterTaxEstateDelta,
      }
      let searchRefined = false
      let searchSimulations = 0
      // Phase 4 refinement: coordinate descent from the top candidates,
      // adopting a result only when the exact ledger prices it beneficial,
      // it improves the winner's estate delta, and the money-lasts guardrail
      // still holds against whatever the winner displaced.
      if (options.search) {
        const ctx = decisionContext(plan, baselineResult, simulateOptions)
        const seeds = eligible.slice(0, 2).filter((candidate) => candidate.conversions.length > 0)
        for (const seed of seeds) {
          const refined = refineConversionSchedule(ctx, seed.conversions, {
            maxSimulations: options.search.maxSimulations,
          })
          searchSimulations += refined.simulationCount
          if (!refined.improved || lastsThroughYear(refined.bestEvaluation.candidateResult) < guardrailLastsThroughYear) continue
          // Snap to exact-ledger executed amounts so the recommended schedule
          // stays executable-by-construction, like every other winner.
          const executed = refined.bestEvaluation.conversionExecution?.executedByYear ?? refined.bestConversions
          const refinedValidation = evaluateExactLedgerSchedule(
            plan,
            executed,
            baselineResult,
            refined.bestEvaluation.candidateResult,
          )
          if (
            refinedValidation.recommendationState === 'beneficial' &&
            refinedValidation.afterTaxEstateDelta > winner.estateDelta
          ) {
            winner = {
              candidate: seed,
              conversions: executed,
              validation: refinedValidation,
              estateDelta: refinedValidation.afterTaxEstateDelta,
            }
            searchRefined = true
          }
        }
      }
      // Keep the candidate table consistent with the recommendation: after
      // refinement the winner's row shows the delta its refined schedule
      // actually delivers — otherwise a refined runner-up can display a LOWER
      // delta than a row it beat (the rows are raw evaluations, the winner is
      // post-search).
      const displayCandidates = searchRefined
        ? candidates.map((row) =>
            row.id === winner.candidate.evaluation.id ? { ...row, afterTaxEstateDelta: winner.estateDelta } : row,
          )
        : candidates
      return {
        policyId: 'max-after-tax-estate',
        candidates: displayCandidates,
        winnerSource: 'candidate',
        winnerCandidateId: winner.candidate.evaluation.id,
        winnerLabel: winner.candidate.evaluation.label,
        winnerConversions: winner.conversions,
        winnerValidation: winner.validation,
        marginOverMilpDollars: milpRecommended ? winner.estateDelta - milpDelta : 0,
        searchRefined,
        searchSimulations,
      }
    }
  }
  if (milpRecommended) {
    // Phase 4 refinement for a MILP winner too (previously only candidate
    // winners were search-polished): coordinate descent from the cleaned
    // schedule, adopted under the same rules — exact-ledger beneficial, a real
    // estate-delta improvement, and the money-lasts guardrail intact.
    let winnerConversions = milpRecommended.cleanedSchedule.conversions
    let winnerValidation: ExactLedgerValidation = milpRecommended.cleanedValidation
    let searchRefined = false
    let searchSimulations = 0
    if (options.search && winnerConversions.length > 0) {
      const ctx = decisionContext(plan, baselineResult, simulateOptions)
      const refined = refineConversionSchedule(ctx, winnerConversions, {
        maxSimulations: options.search.maxSimulations,
      })
      searchSimulations = refined.simulationCount
      if (refined.improved && lastsThroughYear(refined.bestEvaluation.candidateResult) >= guardrailLastsThroughYear) {
        const executed = refined.bestEvaluation.conversionExecution?.executedByYear ?? refined.bestConversions
        const refinedValidation = evaluateExactLedgerSchedule(
          plan,
          executed,
          baselineResult,
          refined.bestEvaluation.candidateResult,
        )
        if (
          refinedValidation.recommendationState === 'beneficial' &&
          refinedValidation.afterTaxEstateDelta > milpRecommended.cleanedValidation.afterTaxEstateDelta
        ) {
          winnerConversions = executed
          winnerValidation = refinedValidation
          searchRefined = true
        }
      }
    }
    return {
      policyId: 'max-after-tax-estate',
      candidates,
      winnerSource: 'milp',
      winnerCandidateId: null,
      winnerLabel: null,
      winnerConversions,
      winnerValidation,
      marginOverMilpDollars: 0,
      searchRefined,
      searchSimulations,
    }
  }
  return fallbackTournament(plan, baselineResult, candidates, 'max-after-tax-estate')
}

/** Shared incumbent/none fallback when nothing evaluated beats the current plan. */
function fallbackTournament(
  plan: Plan,
  baselineResult: ProjectionResult,
  candidates: SimpleCandidateEvaluation[],
  policyId: ObjectivePolicyId,
): ExactLedgerTournament {
  const incumbent = incumbentExecutedConversions(plan, baselineResult)
  if (incumbent) {
    return {
      policyId,
      candidates,
      winnerSource: 'incumbent',
      winnerCandidateId: null,
      winnerLabel: incumbentLabel(plan),
      winnerConversions: incumbent,
      winnerValidation: null,
      marginOverMilpDollars: 0,
      searchRefined: false,
      searchSimulations: 0,
    }
  }
  return {
    policyId,
    candidates,
    winnerSource: 'none',
    winnerCandidateId: null,
    winnerLabel: null,
    winnerConversions: [],
    winnerValidation: null,
    marginOverMilpDollars: 0,
    searchRefined: false,
    searchSimulations: 0,
  }
}

/**
 * Policy-ranked tournament variant (sustainable-spending plan, Step 5): under
 * a non-default objective, the simple candidates and the post-processed MILP
 * schedule are ranked *together* by the shared `rankEvaluations` — the same
 * ranker every other decision surface uses — under the policy's own primary
 * metric and hard constraints, instead of the default estate-delta
 * arbitration. No new simulations: every evaluation being ranked was already
 * produced by the exact ledger. Phase 4 search refinement is skipped here —
 * it climbs the estate objective specifically.
 */
function runPolicyRankedTournament(
  plan: Plan,
  baselineResult: ProjectionResult,
  postProcessed: ExactLedgerPostProcessing | null,
  simulateOptions: SimulateOptions,
  policy: ObjectivePolicy,
): ExactLedgerTournament {
  const ctx = decisionContext(plan, baselineResult, simulateOptions)
  const rich = buildRichCandidates(plan, baselineResult, simulateOptions)
  const candidates = rich.map((candidate) => candidate.evaluation)
  const milpRecommended = postProcessed !== null && postProcessed.recommendationSchedule === 'cleaned' ? postProcessed : null

  const evaluations = rich.map((candidate) => candidate.fullEvaluation)
  let milpEvaluation: ExactDecisionEvaluation | null = null
  if (milpRecommended) {
    // Synthesize the MILP schedule's evaluation from post-processing artifacts
    // (its exact run and deltas already exist) so it competes in the same
    // ranking rather than holding a privileged slot.
    milpEvaluation = {
      candidate: {
        id: 'milp-cleaned-schedule',
        source: 'milp',
        category: 'roth',
        label: "the solver's cleaned schedule",
        explanation: 'Post-processed MILP schedule re-ranked under the selected objective.',
        conversions: milpRecommended.cleanedSchedule.conversions,
      },
      baselineSummary: ctx.baselineSummary,
      candidateSummary: summarizeProjection(plan, milpRecommended.cleanedResult),
      candidateResult: milpRecommended.cleanedResult,
      deltas: {
        endingAfterTaxEstate: milpRecommended.cleanedValidation.afterTaxEstateDelta,
        endingNetWorth: milpRecommended.cleanedValidation.endingNetWorthDelta,
        lifetimeTax: milpRecommended.cleanedValidation.lifetimeTaxDelta,
        moneyLastsYears: milpRecommended.cleanedValidation.moneyLastsYearsDelta,
      },
      conversionExecution: null,
      traditionalDepletionYear: null,
      diagnostics: [],
      recommendationState: milpRecommended.cleanedValidation.recommendationState === 'beneficial' ? 'beneficial' : 'neutral',
    }
    evaluations.push(milpEvaluation)
  }

  if (policy.id === 'max-downside-resilience') {
    attachStochasticMetrics(ctx, evaluations, {
      startYear: simulateOptions.startYear,
      taxCalculator: simulateOptions.taxCalculator,
      model: buildLognormalModelConfigForPlan(plan, 12),
      seed: 0x5eeded,
      pathCount: 200,
    })
  }

  // Dollar-scale metrics keep the $1 default bar; the years-scale durability
  // metric clears at any whole-year improvement.
  const minimumImprovement = policy.id === 'max-spending-durability' ? 0.5 : 1
  const { winner } = rankEvaluations(evaluations, ctx, policy, minimumImprovement)

  if (winner && milpEvaluation && winner.evaluation === milpEvaluation && milpRecommended) {
    return {
      policyId: policy.id,
      candidates,
      winnerSource: 'milp',
      winnerCandidateId: null,
      winnerLabel: null,
      winnerConversions: milpRecommended.cleanedSchedule.conversions,
      winnerValidation: milpRecommended.cleanedValidation,
      marginOverMilpDollars: 0,
      searchRefined: false,
      searchSimulations: 0,
    }
  }
  if (winner) {
    const richWinner = rich.find((candidate) => candidate.fullEvaluation === winner.evaluation)
    if (richWinner && richWinner.conversions.length > 0) {
      const winnerValidation = evaluateExactLedgerSchedule(plan, richWinner.conversions, baselineResult, richWinner.result)
      return {
        policyId: policy.id,
        candidates,
        winnerSource: 'candidate',
        winnerCandidateId: richWinner.evaluation.id,
        winnerLabel: richWinner.evaluation.label,
        winnerConversions: richWinner.conversions,
        winnerValidation,
        marginOverMilpDollars: milpRecommended
          ? richWinner.evaluation.afterTaxEstateDelta - milpRecommended.cleanedValidation.afterTaxEstateDelta
          : 0,
        searchRefined: false,
        searchSimulations: 0,
      }
    }
  }
  return fallbackTournament(plan, baselineResult, candidates, policy.id)
}

export type ExactLedgerRecommendationState = 'beneficial' | 'neutral' | 'rejected' | 'unexecutable'
export type ExactLedgerRecommendationSchedule = 'cleaned' | 'none'

export interface ExactLedgerValidationOptions {
  /** Dollars around zero treated as matching the current exact plan. */
  neutralToleranceDollars?: number
  /** Minimum total requested conversions before execution-ratio diagnostics matter. */
  minimumRequestedConversionDollars?: number
  /** Absolute shortfall before requested-vs-executed mismatch is material. */
  materialConversionShortfallDollars?: number
  /** Percent shortfall before requested-vs-executed mismatch is material. */
  materialConversionShortfallPct?: number
}

export interface ExactLedgerValidation {
  baseline: ProjectionSummary
  candidate: ProjectionSummary
  afterTaxEstateDelta: number
  endingNetWorthDelta: number
  lifetimeTaxDelta: number
  moneyLastsYearsDelta: number
  requestedConversionTotal: number
  executedConversionTotal: number
  executedConversionRatio: number
  firstMateriallyUnexecutedYear: number | null
  traditionalDepletionYear: number | null
  recommendationState: ExactLedgerRecommendationState
}

export interface ExactLedgerScheduleAdjustment {
  year: number
  requested: number
  executed: number
  cleaned: number
  reason: 'ledger-capped' | 'dropped-zero' | 'estate-pruned' | 'rounding'
}

export interface ExactLedgerPostProcessingOptions extends ExactLedgerValidationOptions {
  /** Maximum raw -> executed -> rerun stabilization passes. */
  maxIterations?: number
  /** Maximum trailing-year prune candidates evaluated (one exact simulation each). */
  maxPruneIterations?: number
}

export interface ExactLedgerPostProcessing {
  rawSchedule: OptimizedSchedule
  cleanedSchedule: OptimizedSchedule
  rawValidation: ExactLedgerValidation
  cleanedValidation: ExactLedgerValidation
  rawResult: ProjectionResult
  cleanedResult: ProjectionResult
  adjustments: ExactLedgerScheduleAdjustment[]
  stabilized: boolean
  iterationCount: number
  /** Trailing-year prune candidates evaluated (0 when the prune pass did not run). */
  pruneIterationCount: number
  recommendationSchedule: ExactLedgerRecommendationSchedule
}

// Shared with the decision engine so every surface classifies schedules identically.
const DEFAULT_NEUTRAL_TOLERANCE_DOLLARS = DECISION_NEUTRAL_TOLERANCE_DOLLARS
const DEFAULT_MINIMUM_REQUESTED_CONVERSION_DOLLARS = DECISION_MINIMUM_REQUESTED_CONVERSION_DOLLARS
const DEFAULT_MAX_POST_PROCESSING_ITERATIONS = 3
// Each prune candidate costs one exact simulatePlan run (single-digit ms on
// test plans, low tens of ms on long-horizon plans), so the default bound keeps
// worst-case prune overhead in the same ballpark as the solver itself.
const DEFAULT_MAX_PRUNE_ITERATIONS = 24

function aggregateConversions(conversions: { year: number; amount: number }[]): Map<number, number> {
  const byYear = new Map<number, number>()
  for (const conversion of conversions) {
    byYear.set(conversion.year, (byYear.get(conversion.year) ?? 0) + conversion.amount)
  }
  return byYear
}

function roundDollars(amount: number): number {
  return Math.round(amount * 100) / 100
}

function conversionsFromYearMap(byYear: Map<number, number>, toleranceDollars: number): { year: number; amount: number }[] {
  return [...byYear.entries()]
    .filter(([, amount]) => amount > toleranceDollars)
    .sort(([a], [b]) => a - b)
    .map(([year, amount]) => ({ year, amount: roundDollars(amount) }))
}

function scheduleWithConversions(schedule: OptimizedSchedule, conversions: { year: number; amount: number }[]): OptimizedSchedule {
  const byYear = aggregateConversions(conversions)
  return {
    ...schedule,
    conversions,
    schedule: schedule.schedule.map((year) => ({
      ...year,
      conversion: roundDollars(byYear.get(year.year) ?? 0),
    })),
  }
}

/**
 * Compare a proposed conversion schedule with the exact projection ledger.
 *
 * The solver can request conversions that the ledger later caps because
 * spending, RMDs, or prior conversions drained the own traditional balance.
 * Since the decision engine landed this is a thin adapter over the shared
 * `evaluateCandidate` core (Phase 1): the exact candidate run stays
 * authoritative, classified by after-tax estate first, with execution mismatch
 * as a separate blocking state ('diagnostic' in engine terms, 'unexecutable'
 * here for the optimizer UI contract).
 */
export function evaluateExactLedgerSchedule(
  plan: Plan,
  requestedConversions: { year: number; amount: number }[],
  baselineResult: ProjectionResult,
  candidateResult: ProjectionResult,
  options: ExactLedgerValidationOptions = {},
): ExactLedgerValidation {
  // Both projections are precomputed, so the context never simulates; the
  // throwing calculator makes any accidental re-simulation loud.
  const ctx: DecisionContext = {
    plan,
    baselineResult,
    baselineSummary: summarizeProjection(plan, baselineResult),
    simulateOptions: {
      startYear: baselineResult.startYear,
      taxCalculator: () => {
        throw new Error('evaluateExactLedgerSchedule reuses precomputed projections and never simulates')
      },
    } as unknown as SimulateOptions,
  }
  const evaluation = evaluateCandidate(
    ctx,
    {
      id: 'exact-ledger-schedule',
      source: 'milp',
      category: 'roth',
      label: 'Conversion schedule validation',
      explanation: 'Requested conversion schedule compared with the exact ledger.',
      conversions: requestedConversions,
    },
    { ...options, candidateResult },
  )
  const execution = evaluation.conversionExecution!
  return {
    baseline: evaluation.baselineSummary,
    candidate: evaluation.candidateSummary,
    afterTaxEstateDelta: evaluation.deltas.endingAfterTaxEstate,
    endingNetWorthDelta: evaluation.deltas.endingNetWorth,
    lifetimeTaxDelta: evaluation.deltas.lifetimeTax,
    moneyLastsYearsDelta: evaluation.deltas.moneyLastsYears,
    requestedConversionTotal: execution.requestedTotal,
    executedConversionTotal: execution.executedTotal,
    executedConversionRatio: execution.executedRatio,
    firstMateriallyUnexecutedYear: execution.firstMateriallyUnexecutedYear,
    traditionalDepletionYear: evaluation.traditionalDepletionYear,
    recommendationState:
      evaluation.recommendationState === 'diagnostic' ? 'unexecutable' : evaluation.recommendationState,
  }
}

function conversionsMatch(
  requested: { year: number; amount: number }[],
  executedByYear: Map<number, number>,
  toleranceDollars: number,
): boolean {
  const requestedByYear = aggregateConversions(requested)
  const years = new Set([...requestedByYear.keys(), ...executedByYear.keys()])
  for (const year of years) {
    const requestedAmount = requestedByYear.get(year) ?? 0
    const executedAmount = executedByYear.get(year) ?? 0
    if (Math.abs(requestedAmount - executedAmount) > toleranceDollars) return false
  }
  return true
}

function buildCleanedConversionsFromExecution(
  requestedConversions: { year: number; amount: number }[],
  candidateResult: ProjectionResult,
  toleranceDollars: number,
): { conversions: { year: number; amount: number }[]; adjustments: ExactLedgerScheduleAdjustment[] } {
  const requestedByYear = aggregateConversions(requestedConversions)
  const executedByYear = new Map(candidateResult.years.map((year) => [year.year, year.rothConversion]))
  const cleanedByYear = new Map<number, number>()
  const adjustments: ExactLedgerScheduleAdjustment[] = []

  for (const [year, requested] of [...requestedByYear.entries()].sort(([a], [b]) => a - b)) {
    const executed = Math.max(0, executedByYear.get(year) ?? 0)
    const cleaned = executed > toleranceDollars ? Math.min(requested, executed) : 0
    if (cleaned > toleranceDollars) cleanedByYear.set(year, cleaned)

    const roundedRequested = roundDollars(requested)
    const roundedExecuted = roundDollars(executed)
    const roundedCleaned = roundDollars(cleaned)
    const hasMaterialDifference = Math.abs(roundedRequested - roundedCleaned) > toleranceDollars
    if (!hasMaterialDifference) continue

    adjustments.push({
      year,
      requested: roundedRequested,
      executed: roundedExecuted,
      cleaned: roundedCleaned,
      reason: roundedCleaned <= toleranceDollars ? 'dropped-zero' : 'ledger-capped',
    })
  }

  return { conversions: conversionsFromYearMap(cleanedByYear, toleranceDollars), adjustments }
}

/**
 * Turn a raw optimizer schedule into the schedule the exact ledger can execute.
 *
 * The MILP is useful as a candidate generator, but only the ledger knows the
 * real account balances, withdrawals, taxes, ACA/IRMAA effects, and conversion
 * caps. This pass trims raw requested conversions to exact execution, reruns the
 * ledger, and returns the cleaned schedule plus diagnostics.
 */
export function postProcessExactLedgerSchedule(
  plan: Plan,
  rawSchedule: OptimizedSchedule,
  baselineResult: ProjectionResult,
  simulateOptions: SimulateOptions,
  options: ExactLedgerPostProcessingOptions = {},
): ExactLedgerPostProcessing {
  const neutralToleranceDollars = options.neutralToleranceDollars ?? DEFAULT_NEUTRAL_TOLERANCE_DOLLARS
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_POST_PROCESSING_ITERATIONS

  const rawPlan = withOptimizedConversions(plan, rawSchedule.conversions)
  const rawResult = simulatePlan(rawPlan, simulateOptions)
  const rawValidation = evaluateExactLedgerSchedule(plan, rawSchedule.conversions, baselineResult, rawResult, options)

  let currentConversions = rawSchedule.conversions
  let currentResult = rawResult
  const adjustmentsByYear = new Map<number, ExactLedgerScheduleAdjustment>()
  let stabilized = false
  let iterationCount = 0

  for (let i = 0; i < maxIterations; i++) {
    iterationCount = i + 1
    const { conversions, adjustments } = buildCleanedConversionsFromExecution(
      currentConversions,
      currentResult,
      neutralToleranceDollars,
    )
    for (const adjustment of adjustments) adjustmentsByYear.set(adjustment.year, adjustment)

    const executedByYear = new Map(currentResult.years.map((year) => [year.year, year.rothConversion]))
    if (conversionsMatch(currentConversions, executedByYear, neutralToleranceDollars)) {
      currentConversions = conversions
      stabilized = true
      break
    }

    currentConversions = conversions
    const cleanedPlan = withOptimizedConversions(plan, currentConversions)
    currentResult = simulatePlan(cleanedPlan, simulateOptions)
  }

  let cleanedSchedule = scheduleWithConversions(rawSchedule, currentConversions)
  let cleanedResult = simulatePlan(withOptimizedConversions(plan, cleanedSchedule.conversions), simulateOptions)
  let cleanedValidation = evaluateExactLedgerSchedule(
    plan,
    cleanedSchedule.conversions,
    baselineResult,
    cleanedResult,
    options,
  )

  // Pass 3 – estate-preserving prune. A schedule can be fully executable yet
  // still lower the exact after-tax estate because its late conversions land in
  // years where they only add tax (RMD relief already gone, brackets already
  // full, IRMAA triggered). Dropping trailing years never changes earlier
  // years' execution — flows are chronological — so each candidate stays
  // executable by construction and costs exactly one exact-ledger run. The
  // best candidate is adopted only when the exact ledger prices it beneficial;
  // otherwise the original cleaned schedule and its rejected/neutral state
  // stand, per the plan rule that pruning repairs overshoot but never rescues
  // a schedule the ledger says is harmful throughout.
  let pruneIterationCount = 0
  if (
    stabilized &&
    cleanedSchedule.conversions.length > 1 &&
    (cleanedValidation.recommendationState === 'rejected' || cleanedValidation.recommendationState === 'neutral')
  ) {
    const maxPruneIterations = options.maxPruneIterations ?? DEFAULT_MAX_PRUNE_ITERATIONS
    const rawRequestedByYear = aggregateConversions(rawSchedule.conversions)
    let best: {
      conversions: { year: number; amount: number }[]
      result: ProjectionResult
      validation: ExactLedgerValidation
    } | null = null
    let candidate = cleanedSchedule.conversions
    while (candidate.length > 1 && pruneIterationCount < maxPruneIterations) {
      candidate = candidate.slice(0, -1)
      pruneIterationCount++
      const prunedResult = simulatePlan(withOptimizedConversions(plan, candidate), simulateOptions)
      const prunedValidation = evaluateExactLedgerSchedule(plan, candidate, baselineResult, prunedResult, options)
      const bestDelta = best?.validation.afterTaxEstateDelta ?? cleanedValidation.afterTaxEstateDelta
      if (prunedValidation.afterTaxEstateDelta > bestDelta) {
        best = { conversions: candidate, result: prunedResult, validation: prunedValidation }
      }
    }
    if (best !== null && best.validation.recommendationState === 'beneficial') {
      const keptYears = new Set(best.conversions.map((conversion) => conversion.year))
      for (const conversion of cleanedSchedule.conversions) {
        if (keptYears.has(conversion.year)) continue
        adjustmentsByYear.set(conversion.year, {
          year: conversion.year,
          requested: roundDollars(rawRequestedByYear.get(conversion.year) ?? conversion.amount),
          executed: roundDollars(conversion.amount),
          cleaned: 0,
          reason: 'estate-pruned',
        })
      }
      cleanedSchedule = scheduleWithConversions(rawSchedule, best.conversions)
      cleanedResult = best.result
      cleanedValidation = best.validation
    }
  }

  const minimumRequestedConversionDollars =
    options.minimumRequestedConversionDollars ?? DEFAULT_MINIMUM_REQUESTED_CONVERSION_DOLLARS
  const cleanedConversionTotal = cleanedSchedule.conversions.reduce((sum, conversion) => sum + conversion.amount, 0)
  const recommendationSchedule =
    stabilized &&
    cleanedConversionTotal >= minimumRequestedConversionDollars &&
    cleanedValidation.recommendationState !== 'rejected' &&
    cleanedValidation.recommendationState !== 'unexecutable'
      ? 'cleaned'
      : 'none'

  return {
    rawSchedule,
    cleanedSchedule,
    rawValidation,
    cleanedValidation,
    rawResult,
    cleanedResult,
    adjustments: [...adjustmentsByYear.values()].sort((a, b) => a.year - b.year),
    stabilized,
    iterationCount,
    pruneIterationCount,
    recommendationSchedule,
  }
}

// Exact-ledger convergence loop defaults (Step 1). The cap bounds worst-case
// runtime at cap × (solve + a couple of sims); 4 outer solves is ample on the
// fixture matrix (taxable-SS/IRMAA feedback settles in 2–3 re-linearizations).
const DEFAULT_CONVERGENCE_ITERATIONS = 4
const DEFAULT_CONVERGENCE_SCHEDULE_TOLERANCE_DOLLARS = 250
const DEFAULT_CONVERGENCE_OBJECTIVE_TOLERANCE_DOLLARS = 100
const DEFAULT_CONVERGENCE_MAX_YEAR_STEP_DOLLARS = 250_000

/**
 * Effective outer-iteration cap: the configured value floored to an integer and
 * bounded below at 1. Shared by the enable guard and the loop so a fractional
 * cap (e.g. 1.5 → 1) can't pass the guard yet run zero iterations.
 */
function normalizedConvergenceIterations(cfg: ExactLedgerConvergenceOptions): number {
  const raw = cfg.maxIterations ?? DEFAULT_CONVERGENCE_ITERATIONS
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : DEFAULT_CONVERGENCE_ITERATIONS
}

/**
 * Price a requested conversion schedule on the exact ledger and snap it to the
 * amounts the ledger actually executed. The ledger silently caps requests that
 * exceed the available traditional balance, so a raw request and its executed
 * schedule can differ wildly while pricing identically — any loop that adopts
 * raw requests can therefore inflate them for free and drift into
 * unexecutable-junk schedules (they price fine, then post-process terribly).
 * Snapping keeps every adopted step executable-by-construction, the same
 * discipline the post-processor and tournament use.
 */
function priceExecutedSchedule(
  plan: Plan,
  requestedConversions: { year: number; amount: number }[],
  simulateOptions: SimulateOptions,
): { estate: number; executed: { year: number; amount: number }[] } {
  const withConversions = withOptimizedConversions(plan, requestedConversions)
  const result = simulatePlan(withConversions, simulateOptions)
  return {
    estate: summarizeProjection(withConversions, result).endingAfterTaxEstate,
    executed: result.years
      .filter((year) => year.rothConversion > 1)
      .map((year) => ({ year: year.year, amount: roundDollars(year.rothConversion) })),
  }
}

/** Largest absolute per-year conversion difference between two schedules. */
function maxYearConversionMove(
  a: { year: number; amount: number }[],
  b: { year: number; amount: number }[],
): number {
  const byYearA = aggregateConversions(a)
  const byYearB = aggregateConversions(b)
  let max = 0
  for (const year of new Set([...byYearA.keys(), ...byYearB.keys()])) {
    max = Math.max(max, Math.abs((byYearA.get(year) ?? 0) - (byYearB.get(year) ?? 0)))
  }
  return max
}

/**
 * SLP trust-region step: move each year's conversion toward the freshly-solved
 * value by `dampingFactor`, then clamp the change to `maxYearStepDollars`. This
 * damps the oscillation SLP can otherwise show when a big conversion swings the
 * next iteration's taxable-SS/IRMAA recapture the other way.
 */
function dampConvergenceStep(
  previous: { year: number; amount: number }[],
  solved: { year: number; amount: number }[],
  cfg: ExactLedgerConvergenceOptions,
): { year: number; amount: number }[] {
  // Sanitize the tuning knobs: they can arrive over the worker boundary, and a
  // NaN/Infinity/negative value would break the clamp (a negative step limit
  // flips it and forces movement). Damping is a fraction in [0, 1]; the step
  // limit is a finite non-negative dollar bound.
  const rawDamping = cfg.dampingFactor ?? 1
  const damping = Number.isFinite(rawDamping) ? Math.min(1, Math.max(0, rawDamping)) : 1
  const rawStepLimit = cfg.maxYearStepDollars ?? DEFAULT_CONVERGENCE_MAX_YEAR_STEP_DOLLARS
  const stepLimit = Number.isFinite(rawStepLimit) && rawStepLimit >= 0 ? rawStepLimit : DEFAULT_CONVERGENCE_MAX_YEAR_STEP_DOLLARS
  const previousByYear = aggregateConversions(previous)
  const solvedByYear = aggregateConversions(solved)
  const out: { year: number; amount: number }[] = []
  for (const year of [...new Set([...previousByYear.keys(), ...solvedByYear.keys()])].sort((x, y) => x - y)) {
    const prev = previousByYear.get(year) ?? 0
    const target = solvedByYear.get(year) ?? 0
    const dampedDelta = damping * (target - prev)
    const clampedDelta = Math.max(-stepLimit, Math.min(stepLimit, dampedDelta))
    const next = roundDollars(Math.max(0, prev + clampedDelta))
    if (next > 0) out.push({ year, amount: next })
  }
  return out
}

/**
 * Exact-ledger convergence loop (optimizer-exact-ledger-convergence Track 1,
 * Step 1). Re-solve the MILP
 * against exogenous inputs recaptured from the exact-ledger run of the incumbent
 * schedule, iterating until the schedule and its exact after-tax estate settle
 * within tolerance (or a hard iteration cap). Each accepted step must not lower
 * the exact-ledger estate — the real ledger, not the LP's own number, is the
 * monotone guard — so the loop can only sharpen the recommendation, never
 * degrade it, and the tournament still prices/gates whatever it produces.
 */
async function convergeSchedule(
  plan: Plan,
  opts: OptimizePlanOptions,
  firstSolve: OptimizedSchedule,
  firstInput: OptimizerInput,
  cfg: ExactLedgerConvergenceOptions,
  simulateOptions: SimulateOptions,
): Promise<{ schedule: OptimizedSchedule; input: OptimizerInput; diagnostics: ExactLedgerConvergenceDiagnostics }> {
  const maxIterations = normalizedConvergenceIterations(cfg)
  const scheduleTolerance = cfg.scheduleToleranceDollars ?? DEFAULT_CONVERGENCE_SCHEDULE_TOLERANCE_DOLLARS
  const objectiveTolerance = cfg.objectiveToleranceDollars ?? DEFAULT_CONVERGENCE_OBJECTIVE_TOLERANCE_DOLLARS

  // Snap the incumbent to executed amounts up front: the loop's internal state
  // must live in executed space, or the LP can inflate raw requests for free
  // (the ledger caps them silently) and drift into schedules that price fine
  // but post-process terribly. The *returned* schedule stays the untouched
  // first solve until a step is actually adopted.
  const first = priceExecutedSchedule(plan, firstSolve.conversions, simulateOptions)
  const firstEstate = first.estate
  let schedule = firstSolve
  let input = firstInput // anchors to the first solve until the loop adopts a better step
  let currentConversions = first.executed
  let currentEstate = firstEstate
  let iterations = 1
  let converged = false
  let finalMove = 0

  for (let i = 1; i < maxIterations; i++) {
    // Re-linearize around the incumbent schedule: recapture taxable SS, IRMAA/
    // ACA-priced spending, and RMD divisors at the schedule the ledger actually
    // executes, then re-solve.
    const incumbentPlan = withOptimizedConversions(plan, currentConversions)
    const reInput = buildOptimizerInput(plan, opts, incumbentPlan)
    const solved = await optimizeSchedule(reInput)
    iterations = i + 1
    if (solved.status === 'infeasible') break

    const damped = dampConvergenceStep(currentConversions, solved.conversions, cfg)
    const candidate = priceExecutedSchedule(plan, damped, simulateOptions)
    // Monotone guard: never adopt a step the exact ledger prices worse than the
    // incumbent. A regression means the linearization overshot; stop and keep
    // the best schedule so far (bounded, deterministic, never harmful).
    if (candidate.estate + 0.01 < currentEstate) break

    const move = maxYearConversionMove(currentConversions, candidate.executed)
    const improvement = candidate.estate - currentEstate
    schedule = scheduleWithConversions(solved, candidate.executed)
    input = reInput
    currentConversions = candidate.executed
    currentEstate = candidate.estate
    finalMove = move
    if (move <= scheduleTolerance || improvement <= objectiveTolerance) {
      converged = true
      break
    }
  }

  return {
    schedule,
    input,
    diagnostics: {
      enabled: true,
      iterations,
      converged,
      estateGainOverFirstSolveDollars: roundDollars(currentEstate - firstEstate),
      finalMaxYearMoveDollars: roundDollars(finalMove),
    },
  }
}

const DISABLED_CONVERGENCE: ExactLedgerConvergenceDiagnostics = {
  enabled: false,
  iterations: 1,
  converged: false,
  estateGainOverFirstSolveDollars: 0,
  finalMaxYearMoveDollars: 0,
}

/** Run the optimizer end-to-end on a plan: MILP → (convergence loop) → post-processing → tournament. */
export async function optimizePlan(plan: Plan, opts: OptimizePlanOptions): Promise<OptimizePlanResult> {
  const simulateOptions = { startYear: opts.startYear, taxCalculator: opts.taxCalculator }
  let input = buildOptimizerInput(plan, opts)
  let schedule = await optimizeSchedule(input)

  // Exact-ledger convergence loop (Step 1). Only runs when explicitly enabled
  // with a cap above 1 and the first solve produced an actionable schedule; the
  // default path is a single solve, byte-identical to the pre-loop behavior.
  //
  // Gated to the after-tax-estate objective: the loop's monotone guard adopts
  // steps by exact after-tax estate (the MILP's own objective), so under a
  // non-default policy — where the tournament re-ranks candidates by lifetime
  // tax, durability, etc. — an estate-improving re-linearization could displace
  // the schedule that policy would have preferred (the policy-ranked tournament
  // only sees the converged MILP schedule, not the first solve). Co-optimizing
  // the loop against non-estate policies is Step 5 work; until then, non-estate
  // objectives keep today's single-solve behavior exactly.
  const policyIsEstateObjective = !opts.policy || opts.policy.id === 'max-after-tax-estate'
  const convergenceCfg = opts.convergence && policyIsEstateObjective ? opts.convergence : null
  let convergence: ExactLedgerConvergenceDiagnostics = DISABLED_CONVERGENCE
  const firstSchedule = schedule
  const firstInput = input
  if (
    convergenceCfg &&
    normalizedConvergenceIterations(convergenceCfg) > 1 &&
    schedule.status !== 'infeasible' &&
    schedule.conversions.length > 0
  ) {
    const converged = await convergeSchedule(plan, opts, schedule, input, convergenceCfg, simulateOptions)
    schedule = converged.schedule
    input = converged.input
    convergence = converged.diagnostics
  }

  const baselineResult = simulatePlan(plan, simulateOptions)
  let postProcessed =
    schedule.status !== 'infeasible' && schedule.conversions.length > 0
      ? postProcessExactLedgerSchedule(plan, schedule, baselineResult, simulateOptions)
      : null

  // Pipeline-level monotone guard: the loop's step guard is raw-schedule-vs-
  // raw-schedule, but the pipeline's true incumbent is the *post-processed*
  // first solve — trim + estate-prune can rescue a bad raw schedule into a
  // better cleaned one than the converged raw schedule cleans to (SLP converges
  // to a local optimum; the post-processor explores a different neighborhood).
  // Post-process both and keep whichever cleaned schedule the exact ledger
  // prices higher, so convergence-enabled can never do worse than disabled.
  if (convergence.enabled && schedule !== firstSchedule) {
    const firstPostProcessed = postProcessExactLedgerSchedule(plan, firstSchedule, baselineResult, simulateOptions)
    const convergedDelta =
      postProcessed && postProcessed.recommendationSchedule === 'cleaned'
        ? postProcessed.cleanedValidation.afterTaxEstateDelta
        : -Infinity
    const firstDelta =
      firstPostProcessed.recommendationSchedule === 'cleaned'
        ? firstPostProcessed.cleanedValidation.afterTaxEstateDelta
        : -Infinity
    if (firstDelta > convergedDelta) {
      schedule = firstSchedule
      input = firstInput
      postProcessed = firstPostProcessed
      convergence = { ...convergence, keptSchedule: 'first-solve' }
    } else {
      convergence = { ...convergence, keptSchedule: 'converged' }
    }
  }
  // The tournament runs even when the MILP is infeasible or empty — simple
  // candidates can still surface a beneficial exact-ledger schedule there.
  const tournament = runExactLedgerTournament(plan, baselineResult, postProcessed, simulateOptions, {
    search: opts.search ?? false,
    policy: opts.policy,
  })
  return { schedule, input, postProcessed, tournament, convergence }
}

/** A claim candidate must beat the current-claim optimum by this to switch. */
const DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS = 1_000

export interface ClaimAgeCoOptimization {
  /** True when claim-age co-optimization actually ran. */
  enabled: boolean
  /** Claim combinations optimized, including the current claim (1 when off). */
  combinationsEvaluated: number
  /** Label of the winning claim change, or null when the current claim won. */
  winningClaimLabel: string | null
  /**
   * The plan patch (new incomes array) that produced the joint optimum, or null
   * when the current claim ages won. Callers apply this to recommend the claim
   * change alongside the returned conversion schedule.
   */
  winningClaimPatch: { incomes: Plan['incomes'] } | null
  /** Exact after-tax estate of the joint (claim, schedule) optimum. */
  jointExactEstate: number
  /** Exact after-tax estate of the current-claim optimum (the comparison floor). */
  currentClaimExactEstate: number
}

export interface OptimizePlanWithClaimResult extends OptimizePlanResult {
  /** The plan whose optimum is returned — the current plan, or a claim-patched copy. */
  optimizedPlan: Plan
  claimAge: ClaimAgeCoOptimization
}

/** Exact after-tax estate of a plan run with its tournament-recommended conversions installed. */
function winnerExactEstate(plan: Plan, tournament: ExactLedgerTournament, simulateOptions: SimulateOptions): number {
  return priceExecutedSchedule(plan, tournament.winnerConversions, simulateOptions).estate
}

/**
 * Co-optimized SS claim age (Step 5). Alternate-minimize: run the full
 * conversion optimum (convergence loop + tournament) at the current claim ages
 * and at each bounded claim candidate from `socialSecurityClaimGenerator`, then
 * keep the (claim, schedule) pair with the best *absolute* exact-ledger after-tax
 * estate. A claim switch must clear a small margin to avoid churn. The grid is
 * bounded (≤ 2 streams × 3 canonical ages), so the cost is a small multiple of a
 * single optimize; the exact ledger prices every pair, so the tournament remains
 * the guardrail for each. Returns the winning plan (current or claim-patched) and
 * its optimizer result plus a diagnostic of the joint decision.
 */
export async function optimizePlanCoOptimizingClaimAge(
  plan: Plan,
  opts: OptimizePlanOptions,
): Promise<OptimizePlanWithClaimResult> {
  const simulateOptions = { startYear: opts.startYear, taxCalculator: opts.taxCalculator }
  const switchMargin = DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS

  // Current-claim optimum is the floor every claim candidate must beat.
  const baseResult = await optimizePlan(plan, opts)
  const baseEstate = winnerExactEstate(plan, baseResult.tournament, simulateOptions)

  const ctx = decisionContext(plan, simulatePlan(plan, simulateOptions), simulateOptions)
  const candidates = socialSecurityClaimGenerator.generate(ctx)

  let bestPlan = plan
  let bestResult = baseResult
  let bestEstate = baseEstate
  let winningLabel: string | null = null
  let winningPatch: { incomes: Plan['incomes'] } | null = null
  let evaluated = 1

  for (const candidate of candidates) {
    if (!candidate.planPatch) continue
    const applied = applyScenarioPatch(plan, candidate.planPatch)
    if (!applied.ok) continue
    const patchedPlan = applied.plan
    const result = await optimizePlan(patchedPlan, opts)
    const estate = winnerExactEstate(patchedPlan, result.tournament, simulateOptions)
    evaluated++
    // The churn margin is charged against the FIXED current-claim floor, not
    // the running best — otherwise the winner is generator-order-dependent (a
    // slightly-worse candidate adopted first could lock out the true optimum
    // by raising the bar). Among margin-clearing candidates, strictly best wins.
    if (estate > baseEstate + switchMargin && estate > bestEstate) {
      bestPlan = patchedPlan
      bestResult = result
      bestEstate = estate
      winningLabel = candidate.label
      winningPatch = { incomes: patchedPlan.incomes }
    }
  }

  return {
    ...bestResult,
    optimizedPlan: bestPlan,
    claimAge: {
      enabled: true,
      combinationsEvaluated: evaluated,
      winningClaimLabel: winningLabel,
      winningClaimPatch: winningPatch,
      jointExactEstate: bestEstate,
      currentClaimExactEstate: baseEstate,
    },
  }
}

/**
 * Return a copy of the plan with the optimizer's conversions installed as an
 * `optimized` strategy. The UI's "accept as manual" simply rewrites the same
 * conversions under the `manual` mode.
 */
export function withOptimizedConversions(
  plan: Plan,
  conversions: { year: number; amount: number }[],
  optimizedAtIso?: string,
): Plan {
  return {
    ...plan,
    strategies: { ...plan.strategies, rothConversion: { mode: 'optimized', conversions, optimizedAtIso } },
  }
}
