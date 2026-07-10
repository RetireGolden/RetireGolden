/**
 * Shared exact-ledger candidate evaluator (ledger-native decision engine,
 * Phase 1).
 *
 * One evaluation = one deterministic `simulatePlan` run of the candidate plan,
 * compared against a shared baseline run. All recommendation surfaces (Roth &
 * Tax Optimizer validation, tournaments, Insights previews, local search) go
 * through here so income, capital gains, Social Security taxability, ACA,
 * IRMAA, RMD, and inherited-IRA effects are priced by the ledger exactly once
 * — never re-derived in candidate logic.
 */

import type { Plan } from '../model/plan'
import { applyScenarioPatch } from '../scenarios/scenarios'
import { summarizeProjection, type ProjectionSummary } from '../projection/compare'
import { simulatePlan } from '../projection/simulate'
import type { ProjectionResult } from '../projection/types'
import type {
  ConversionExecution,
  DecisionCandidate,
  DecisionContext,
  DecisionRecommendationState,
  ExactDecisionEvaluation,
} from './types'

export interface EvaluateCandidateOptions {
  /** Dollars around zero treated as matching the baseline. */
  neutralToleranceDollars?: number
  /** Minimum total requested conversions before execution-ratio diagnostics matter. */
  minimumRequestedConversionDollars?: number
  /** Absolute shortfall before requested-vs-executed mismatch is material. */
  materialConversionShortfallDollars?: number
  /** Percent shortfall before requested-vs-executed mismatch is material. */
  materialConversionShortfallPct?: number
  /**
   * Reuse an already-simulated candidate result instead of re-running the
   * ledger (e.g. the optimizer post-processor simulates schedules itself).
   * The caller is responsible for it matching the candidate exactly.
   */
  candidateResult?: ProjectionResult
}

export const DECISION_NEUTRAL_TOLERANCE_DOLLARS = 1
export const DECISION_MINIMUM_REQUESTED_CONVERSION_DOLLARS = 1
export const DECISION_MATERIAL_SHORTFALL_DOLLARS = 1_000
export const DECISION_MATERIAL_SHORTFALL_PCT = 0.05

/** Years the money lasts: depletion year, or one past the horizon when it never depletes. */
export function lastsThroughYear(result: ProjectionResult): number {
  return result.depletionYear ?? result.endYear + 1
}

/** Build a fresh decision context, running the shared baseline once (or reusing a caller's run). */
export function createDecisionContext(
  plan: Plan,
  simulateOptions: DecisionContext['simulateOptions'],
  baseline?: { result: ProjectionResult; summary?: ProjectionSummary },
  taxCalculatorForPlan?: DecisionContext['taxCalculatorForPlan'],
): DecisionContext {
  const baselineResult = baseline?.result ?? simulatePlan(plan, simulateOptions)
  return {
    plan,
    baselineResult,
    baselineSummary: baseline?.summary ?? summarizeProjection(plan, baselineResult),
    simulateOptions,
    taxCalculatorForPlan,
  }
}

/**
 * Materialize the concrete plan a candidate describes: scenario patch first
 * (validated through the plan schema), then any explicit conversion schedule
 * installed as an `optimized` Roth strategy.
 */
export function planForCandidate(
  plan: Plan,
  candidate: Pick<DecisionCandidate, 'planPatch' | 'conversions'>,
): { ok: true; plan: Plan } | { ok: false; error: string } {
  let candidatePlan = plan
  if (candidate.planPatch) {
    const applied = applyScenarioPatch(plan, candidate.planPatch)
    if (!applied.ok) return { ok: false, error: `This candidate can't be applied to the plan: ${applied.issues.join('; ')}` }
    candidatePlan = applied.plan
  }
  if (candidate.conversions) {
    candidatePlan = {
      ...candidatePlan,
      strategies: {
        ...candidatePlan.strategies,
        rothConversion: { mode: 'optimized', conversions: candidate.conversions },
      },
    }
  }
  return { ok: true, plan: candidatePlan }
}

function aggregateByYear(conversions: Array<{ year: number; amount: number }>): Map<number, number> {
  const byYear = new Map<number, number>()
  for (const conversion of conversions) {
    byYear.set(conversion.year, (byYear.get(conversion.year) ?? 0) + conversion.amount)
  }
  return byYear
}

function buildConversionExecution(
  requested: Array<{ year: number; amount: number }>,
  candidateResult: ProjectionResult,
  options: Required<Pick<EvaluateCandidateOptions, 'materialConversionShortfallDollars' | 'materialConversionShortfallPct'>>,
): ConversionExecution {
  const requestedByYear = aggregateByYear(requested)
  const requestedTotal = requested.reduce((sum, conversion) => sum + conversion.amount, 0)
  const executedTotal = candidateResult.years.reduce((sum, year) => sum + year.rothConversion, 0)

  let firstMateriallyUnexecutedYear: number | null = null
  for (const year of [...requestedByYear.keys()].sort((a, b) => a - b)) {
    const requestedAmount = requestedByYear.get(year) ?? 0
    const executedAmount = candidateResult.years.find((y) => y.year === year)?.rothConversion ?? 0
    const materialShortfall = Math.max(
      options.materialConversionShortfallDollars,
      requestedAmount * options.materialConversionShortfallPct,
    )
    if (requestedAmount - executedAmount > materialShortfall) {
      firstMateriallyUnexecutedYear = year
      break
    }
  }

  return {
    requestedTotal,
    executedTotal,
    executedRatio: requestedTotal > 0 ? Math.min(1, executedTotal / requestedTotal) : 1,
    firstMateriallyUnexecutedYear,
    executedByYear: candidateResult.years
      .filter((year) => year.rothConversion > 1)
      .map((year) => ({ year: year.year, amount: Math.round(year.rothConversion * 100) / 100 })),
  }
}

/** First year the plan's own (non-inherited) traditional balance is exhausted, or null. */
export function findTraditionalDepletionYear(
  plan: Plan,
  result: ProjectionResult,
  toleranceDollars: number,
): number | null {
  const ownTraditionalIds = new Set(
    plan.accounts.filter((account) => account.type === 'traditional' && !account.inherited).map((account) => account.id),
  )
  if (ownTraditionalIds.size === 0) return null
  for (const year of result.years) {
    let balance = 0
    for (const accountId of ownTraditionalIds) balance += year.balances[accountId] ?? 0
    if (balance <= toleranceDollars) return year.year
  }
  return null
}

function classifyRecommendationState(args: {
  afterTaxEstateDelta: number
  conversionExecution: ConversionExecution | null
  neutralToleranceDollars: number
  minimumRequestedConversionDollars: number
  materialConversionShortfallDollars: number
  materialConversionShortfallPct: number
}): DecisionRecommendationState {
  if (args.afterTaxEstateDelta > args.neutralToleranceDollars) return 'beneficial'
  if (args.conversionExecution) {
    const { requestedTotal, executedTotal } = args.conversionExecution
    const materialShortfall = Math.max(
      args.materialConversionShortfallDollars,
      requestedTotal * args.materialConversionShortfallPct,
    )
    if (requestedTotal >= args.minimumRequestedConversionDollars && requestedTotal - executedTotal > materialShortfall) {
      return 'diagnostic'
    }
  }
  if (args.afterTaxEstateDelta < -args.neutralToleranceDollars) return 'rejected'
  return 'neutral'
}

/** Diagnostic-only evaluation for a candidate whose patch failed plan validation. */
function invalidCandidateEvaluation(
  ctx: DecisionContext,
  candidate: DecisionCandidate,
  error: string,
): ExactDecisionEvaluation {
  return {
    candidate,
    baselineSummary: ctx.baselineSummary,
    candidateSummary: ctx.baselineSummary,
    candidateResult: ctx.baselineResult,
    deltas: { endingAfterTaxEstate: 0, endingNetWorth: 0, lifetimeTax: 0, moneyLastsYears: 0 },
    conversionExecution: null,
    traditionalDepletionYear: null,
    diagnostics: [error],
    recommendationState: 'diagnostic',
  }
}

/**
 * Run one candidate through the exact ledger and compare it with the shared
 * baseline. Deterministic: same plan + candidate + options ⇒ same evaluation.
 */
export function evaluateCandidate(
  ctx: DecisionContext,
  candidate: DecisionCandidate,
  options: EvaluateCandidateOptions = {},
): ExactDecisionEvaluation {
  const neutralToleranceDollars = options.neutralToleranceDollars ?? DECISION_NEUTRAL_TOLERANCE_DOLLARS
  const minimumRequestedConversionDollars =
    options.minimumRequestedConversionDollars ?? DECISION_MINIMUM_REQUESTED_CONVERSION_DOLLARS
  const materialConversionShortfallDollars =
    options.materialConversionShortfallDollars ?? DECISION_MATERIAL_SHORTFALL_DOLLARS
  const materialConversionShortfallPct =
    options.materialConversionShortfallPct ?? DECISION_MATERIAL_SHORTFALL_PCT

  const built = planForCandidate(ctx.plan, candidate)
  if (!built.ok) return invalidCandidateEvaluation(ctx, candidate, built.error)

  // A patch may change tax assumptions (e.g. a relocation candidate clearing
  // the flat state-rate override); when the context carries a per-plan tax
  // stack factory, price the candidate with its own stack.
  const candidateSimulateOptions = ctx.taxCalculatorForPlan
    ? { ...ctx.simulateOptions, taxCalculator: ctx.taxCalculatorForPlan(built.plan) }
    : ctx.simulateOptions
  const candidateResult = options.candidateResult ?? simulatePlan(built.plan, candidateSimulateOptions)
  const candidateSummary = summarizeProjection(built.plan, candidateResult)

  const conversionExecution = candidate.conversions
    ? buildConversionExecution(candidate.conversions, candidateResult, {
        materialConversionShortfallDollars,
        materialConversionShortfallPct,
      })
    : null

  const deltas = {
    endingAfterTaxEstate: candidateSummary.endingAfterTaxEstate - ctx.baselineSummary.endingAfterTaxEstate,
    endingNetWorth: candidateSummary.endingNetWorth - ctx.baselineSummary.endingNetWorth,
    lifetimeTax: candidateSummary.lifetimeTaxesAndPenalties - ctx.baselineSummary.lifetimeTaxesAndPenalties,
    moneyLastsYears: lastsThroughYear(candidateResult) - lastsThroughYear(ctx.baselineResult),
  }

  const diagnostics: string[] = []
  if (conversionExecution && conversionExecution.firstMateriallyUnexecutedYear !== null) {
    diagnostics.push(
      `Your plan could not execute the requested conversion in ${conversionExecution.firstMateriallyUnexecutedYear}: ` +
        `requested $${Math.round(conversionExecution.requestedTotal).toLocaleString()} in total, ` +
        `executed $${Math.round(conversionExecution.executedTotal).toLocaleString()}.`,
    )
  }
  if (deltas.moneyLastsYears < 0) {
    diagnostics.push(`Money lasts ${-deltas.moneyLastsYears} year(s) less than the baseline.`)
  }
  if (candidateResult.depletionYear !== null && ctx.baselineResult.depletionYear === null) {
    diagnostics.push(`Introduces portfolio depletion in ${candidateResult.depletionYear}.`)
  }

  return {
    candidate,
    baselineSummary: ctx.baselineSummary,
    candidateSummary,
    candidateResult,
    deltas,
    conversionExecution,
    traditionalDepletionYear: findTraditionalDepletionYear(built.plan, candidateResult, neutralToleranceDollars),
    diagnostics,
    recommendationState: classifyRecommendationState({
      afterTaxEstateDelta: deltas.endingAfterTaxEstate,
      conversionExecution,
      neutralToleranceDollars,
      minimumRequestedConversionDollars,
      materialConversionShortfallDollars,
      materialConversionShortfallPct,
    }),
  }
}
