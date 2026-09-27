/**
 * Optional stochastic attachments for exact-ledger decision evaluations.
 *
 * Deterministic evaluation remains the default authority. Callers opt into this
 * helper when a policy explicitly ranks candidates by same-path Monte Carlo
 * resilience.
 */

import {
  comparePlansOnSharedMarketPaths,
  type SharedPathComparisonOptions,
  type SharedPathPlan,
} from '../montecarlo/sharedPaths.js'
import type { MonteCarloSummary } from '../montecarlo/run.js'
import { compareScalars, type ScalarComparison } from '../scenarios/scalarComparison.js'
import { planForCandidate } from './evaluateCandidate.js'
import type {
  DecisionContext,
  ExactDecisionEvaluation,
  StochasticDecisionAttachment,
  StochasticDecisionMetrics,
} from './types.js'

export type AttachStochasticMetricsOptions = SharedPathComparisonOptions

function metricsFromSummary(summary: MonteCarloSummary, seed: number): StochasticDecisionMetrics {
  return {
    pathCount: summary.pathCount,
    seed,
    successRate: summary.successRate,
    requiredFloorSuccessRate: summary.requiredFloorSuccessRate,
    targetLifestyleSuccessRate: summary.targetLifestyleSuccessRate,
    p10EndingAfterTaxEstate: summary.endingAfterTaxEstate.percentiles.p10,
    medianEndingAfterTaxEstate: summary.endingAfterTaxEstate.percentiles.p50,
    expectedShortfallDollars: summary.downsideRisk.expectedShortfallDollars,
    averageTargetShortfallDollars: summary.spendingShortfall.averageTargetShortfallDollars,
  }
}

/**
 * The change in Monte Carlo success rate from a baseline run to a proposal run
 * on the same market paths: compareScalars(baseline.successRate,
 * proposal.successRate), a fraction of paths, proposal minus baseline.
 * Refuses (RangeError) two runs with different path counts: a change from a
 * rate on N paths to a rate on M paths is not a change on shared paths, and
 * the baseline would not be the rate the reader was shown.
 *
 * @see DOCS/calculations/insights/insight-monte-carlo-success-delta.md
 */
export function compareMonteCarloSuccessRates(
  baseline: Pick<MonteCarloSummary, 'successRate' | 'pathCount'>,
  proposal: Pick<MonteCarloSummary, 'successRate' | 'pathCount'>,
): ScalarComparison {
  if (baseline.pathCount !== proposal.pathCount) {
    throw new RangeError(
      `Success rates are compared only on the same number of paths; the baseline ran ${baseline.pathCount} and the proposal ${proposal.pathCount}`,
    )
  }
  return compareScalars(baseline.successRate, proposal.successRate)
}

/** Each stochastic metric, candidate minus baseline (compareScalars). */
export function stochasticDeltas(
  baseline: StochasticDecisionMetrics,
  candidate: StochasticDecisionMetrics,
): StochasticDecisionAttachment['deltas'] {
  const delta = (read: (metrics: StochasticDecisionMetrics) => number): number =>
    compareScalars(read(baseline), read(candidate)).delta
  return {
    successRate: delta((m) => m.successRate),
    requiredFloorSuccessRate: delta((m) => m.requiredFloorSuccessRate),
    targetLifestyleSuccessRate: delta((m) => m.targetLifestyleSuccessRate),
    p10EndingAfterTaxEstate: delta((m) => m.p10EndingAfterTaxEstate),
    medianEndingAfterTaxEstate: delta((m) => m.medianEndingAfterTaxEstate),
    expectedShortfallDollars: delta((m) => m.expectedShortfallDollars),
    averageTargetShortfallDollars: delta((m) => m.averageTargetShortfallDollars),
  }
}

function attachment(
  baseline: StochasticDecisionMetrics,
  candidate: StochasticDecisionMetrics,
): StochasticDecisionAttachment {
  return { baseline, candidate, deltas: stochasticDeltas(baseline, candidate) }
}

/**
 * Run the baseline and every evaluation's candidate plan on the same market
 * paths and attach each candidate's metrics and deltas. When the context has
 * a per-plan tax stack (`ctx.taxCalculatorForPlan`), every entry, the baseline
 * included, is priced with its own plan's stack, as the deterministic
 * evaluation prices it; otherwise every entry uses `opts.taxCalculator`.
 */
export function attachStochasticMetrics(
  ctx: DecisionContext,
  evaluations: ExactDecisionEvaluation[],
  opts: AttachStochasticMetricsOptions,
): ExactDecisionEvaluation[] {
  const ownTaxStack = (plan: DecisionContext['plan']): Pick<SharedPathPlan, 'taxCalculator'> =>
    ctx.taxCalculatorForPlan ? { taxCalculator: ctx.taxCalculatorForPlan(plan) } : {}
  const materialized: Array<{ evaluation: ExactDecisionEvaluation | null; entry: SharedPathPlan }> = [
    { evaluation: null, entry: { id: 'baseline', label: 'Current plan', plan: ctx.plan, ...ownTaxStack(ctx.plan) } },
  ]

  for (const evaluation of evaluations) {
    const built = planForCandidate(ctx.plan, evaluation.candidate)
    if (!built.ok) continue
    materialized.push({
      evaluation,
      entry: {
        id: evaluation.candidate.id,
        label: evaluation.candidate.label,
        plan: built.plan,
        ...ownTaxStack(built.plan),
      },
    })
  }

  const comparison = comparePlansOnSharedMarketPaths(
    materialized.map((item) => item.entry),
    opts,
  )
  const baselineSummary = comparison.rows.find((row) => row.id === 'baseline')?.summary
  if (!baselineSummary) return evaluations
  const baseline = metricsFromSummary(baselineSummary, opts.seed)
  const rowById = new Map(comparison.rows.map((row) => [row.id, row.summary]))

  for (const item of materialized) {
    if (!item.evaluation) continue
    const summary = rowById.get(item.entry.id)
    if (!summary) continue
    item.evaluation.stochastic = attachment(baseline, metricsFromSummary(summary, opts.seed))
  }

  return evaluations
}
