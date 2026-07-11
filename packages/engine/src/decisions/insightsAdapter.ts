/**
 * Thin adapter between Insights detector actions and the shared exact-ledger
 * evaluator (ledger-native decision engine, Phases 1 & 6).
 *
 * Preview-scenario and apply-toggle actions are already scenario-style plan
 * patches, so an InsightCard maps 1:1 onto a `DecisionCandidate`. Evaluating
 * it here — instead of through a separate compare path — keeps an Insights
 * card's exact numbers and recommendation state identical to what the Roth &
 * Tax Optimizer (or any other tournament surface) would report for the same
 * change.
 */

import type { InsightAction, InsightCard, InsightImpact } from '../insights/types.js'
import { evaluateCandidate, type EvaluateCandidateOptions } from './evaluateCandidate.js'
import type { DecisionCandidate, DecisionContext, ExactDecisionEvaluation } from './types.js'

const CATEGORY_BY_INSIGHT: Record<InsightCard['category'], DecisionCandidate['category']> = {
  'tax-brackets': 'roth',
  'accounts-contributions': 'spending',
  'withdrawals-charitable': 'withdrawal',
  'sequence-risk': 'spending',
  'social-security': 'social-security',
  'longevity-insurance-geography': 'insurance',
}

/** Convert a modelable insight action into a decision candidate; null for advisory actions. */
export function candidateFromInsight(
  card: Pick<InsightCard, 'id' | 'category' | 'title' | 'rationale'>,
  action: InsightAction,
): DecisionCandidate | null {
  if (action.kind === 'advisory') return null
  return {
    id: `insight-${card.id}`,
    source: 'detector',
    category: CATEGORY_BY_INSIGHT[card.category],
    label: action.kind === 'preview-scenario' ? action.scenarioName : card.title,
    explanation: card.rationale,
    planPatch: action.patch,
  }
}

export interface InsightExactEvaluation {
  evaluation: ExactDecisionEvaluation
  /** Exact impact in the shape InsightCard UI already renders. */
  impact: InsightImpact
}

/**
 * Evaluate an insight action on the exact ledger. Throws for advisory actions
 * (nothing to model) and surfaces invalid patches as a diagnostic evaluation,
 * mirroring every other decision surface.
 */
export function evaluateInsightAction(
  ctx: DecisionContext,
  card: Pick<InsightCard, 'id' | 'category' | 'title' | 'rationale'>,
  action: InsightAction,
  options?: EvaluateCandidateOptions,
): InsightExactEvaluation {
  const candidate = candidateFromInsight(card, action)
  if (!candidate) throw new Error('Advisory insights have no modelable action to evaluate.')
  const evaluation = evaluateCandidate(ctx, candidate, options)
  return {
    evaluation,
    impact: {
      endingAfterTaxEstateDelta: evaluation.deltas.endingAfterTaxEstate,
      lifetimeTaxDelta: evaluation.deltas.lifetimeTax,
    },
  }
}
