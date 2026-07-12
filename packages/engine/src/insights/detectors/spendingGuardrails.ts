import { probabilityBandSpendingGuardrailGenerator } from '../../decisions/generators.js'
import type { DecisionContext } from '../../decisions/types.js'
import type { Plan } from '../../model/plan.js'
import type { Detector } from '../types.js'

function guardrailPatchFromGenerator(plan: Plan) {
  const ctx = { plan } as DecisionContext
  const candidates = probabilityBandSpendingGuardrailGenerator().generate(ctx)
  if (candidates.length === 0) return null
  const candidate = candidates[0]!
  const patch = candidate.planPatch
  if (!patch || typeof patch !== 'object') return null
  const expenses = (patch as Record<string, unknown>).expenses
  if (!expenses || typeof expenses !== 'object') return null
  const requiredAnnual = (expenses as Record<string, unknown>).requiredAnnual
  if (typeof requiredAnnual !== 'number' || !Number.isFinite(requiredAnnual)) return null
  const spendingPolicy = (expenses as Record<string, unknown>).spendingPolicy
  if (
    !spendingPolicy ||
    typeof spendingPolicy !== 'object' ||
    (spendingPolicy as Record<string, unknown>).mode !== 'withdrawalRateGuardrails'
  ) {
    return null
  }
  return { requiredAnnual, patch: patch as Record<string, unknown> }
}

export const spendingGuardrails: Detector = {
  id: 'spending-guardrails',
  category: 'sequence-risk',
  screen(ctx) {
    const firstYear = ctx.projection.result.years[0]
    if (!firstYear) return null
    // Any active guardrail policy (withdrawal-rate or risk-based) means the
    // plan already has dynamic spending rules — nothing to recommend.
    const mode = ctx.plan.expenses.spendingPolicy?.mode
    if (mode !== undefined && mode !== 'fixedTarget') return null

    const hasDepletion = ctx.projection.summary.depletionYear !== null
    const hasAssets = firstYear.investableTotal > 100_000
    if (!hasDepletion && !hasAssets) return null

    const generated = guardrailPatchFromGenerator(ctx.plan)
    if (!generated) return null
    const { requiredAnnual, patch } = generated
    return {
      id: 'spending-guardrails',
      category: 'sequence-risk',
      title: 'Preview dynamic spending guardrails',
      rationale: `Your plan currently assumes fixed inflation-adjusted spending. Preview a rules-based guardrail scenario with a $${Math.round(requiredAnnual).toLocaleString()} required floor and 10% spending adjustments when the withdrawal-rate band is crossed.`,
      impact: {
        qualitative: 'Preview to compare the projected and Monte Carlo impact of flexible spending rules.',
        successRateDeltaPct: 12,
      },
      exact: false,
      confidence: 'medium',
      learnSlug: 'dynamic-spending-guardrails',
      plannerRoute: 'spending',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Dynamic spending guardrails',
        patch,
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card || card.action.kind !== 'preview-scenario') throw new Error('Spending guardrails not eligible')
    return {
      action: card.action,
      impact: {
        qualitative: 'Exact preview applies the guardrail policy inside the same annual ledger used by Results and Monte Carlo.',
        successRateDeltaPct: card.impact.successRateDeltaPct,
      },
    }
  },
}