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
} from '../montecarlo/sharedPaths'
import type { MonteCarloSummary } from '../montecarlo/run'
import { planForCandidate } from './evaluateCandidate'
import type {
  DecisionContext,
  ExactDecisionEvaluation,
  StochasticDecisionAttachment,
  StochasticDecisionMetrics,
} from './types'

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

function attachment(
  baseline: StochasticDecisionMetrics,
  candidate: StochasticDecisionMetrics,
): StochasticDecisionAttachment {
  return {
    baseline,
    candidate,
    deltas: {
      successRate: candidate.successRate - baseline.successRate,
      requiredFloorSuccessRate: candidate.requiredFloorSuccessRate - baseline.requiredFloorSuccessRate,
      targetLifestyleSuccessRate: candidate.targetLifestyleSuccessRate - baseline.targetLifestyleSuccessRate,
      p10EndingAfterTaxEstate: candidate.p10EndingAfterTaxEstate - baseline.p10EndingAfterTaxEstate,
      medianEndingAfterTaxEstate: candidate.medianEndingAfterTaxEstate - baseline.medianEndingAfterTaxEstate,
      expectedShortfallDollars: candidate.expectedShortfallDollars - baseline.expectedShortfallDollars,
      averageTargetShortfallDollars: candidate.averageTargetShortfallDollars - baseline.averageTargetShortfallDollars,
    },
  }
}

export function attachStochasticMetrics(
  ctx: DecisionContext,
  evaluations: ExactDecisionEvaluation[],
  opts: AttachStochasticMetricsOptions,
): ExactDecisionEvaluation[] {
  const materialized: Array<{ evaluation: ExactDecisionEvaluation | null; entry: SharedPathPlan }> = [
    { evaluation: null, entry: { id: 'baseline', label: 'Current plan', plan: ctx.plan } },
  ]

  for (const evaluation of evaluations) {
    const built = planForCandidate(ctx.plan, evaluation.candidate)
    if (!built.ok) continue
    materialized.push({
      evaluation,
      entry: { id: evaluation.candidate.id, label: evaluation.candidate.label, plan: built.plan },
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
