import { formatWholeUsd } from '../../internal/evidenceFormat.js'
import { probabilityBandSpendingGuardrailGenerator } from '../../decisions/generators.js'
import type { DecisionContext } from '../../decisions/types.js'
import type { Plan } from '../../model/plan.js'
import type { Detector, InsightEvidence } from '../types.js'

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

/**
 * Screen threshold: below this first-year investable balance a guardrail
 * policy has too little portfolio to steer, so the card only fires on a plan
 * that already depletes.
 */
const MIN_INVESTABLE_FOR_GUARDRAILS_DOLLARS = 100_000

export const spendingGuardrails: Detector = {
  id: 'spending-guardrails',
  category: 'sequence-risk',
  version: 1,
  screen(ctx) {
    const firstYear = ctx.projection.result.years[0]
    if (!firstYear) return null
    // Any active guardrail policy (withdrawal-rate or risk-based) means the
    // plan already has dynamic spending rules — nothing to recommend.
    const mode = ctx.plan.expenses.spendingPolicy?.mode
    if (mode !== undefined && mode !== 'fixedTarget') return null

    const hasDepletion = ctx.projection.summary.depletionYear !== null
    const hasAssets = firstYear.investableTotal > MIN_INVESTABLE_FOR_GUARDRAILS_DOLLARS
    if (!hasDepletion && !hasAssets) return null

    const generated = guardrailPatchFromGenerator(ctx.plan)
    if (!generated) return null
    const { requiredAnnual, patch } = generated
    const floorIsUserProvided =
      typeof ctx.plan.expenses.requiredAnnual === 'number' && Number.isFinite(ctx.plan.expenses.requiredAnnual)
    const evidence: [InsightEvidence, ...InsightEvidence[]] = [
      {
        label: floorIsUserProvided
          ? 'Required spending floor'
          : 'Illustrative spending floor (80% of base spending, scenario-generated)',
        value: formatWholeUsd(requiredAnnual),
        year: firstYear.year,
      },
      { label: 'Investable assets', value: formatWholeUsd(firstYear.investableTotal), year: firstYear.year },
    ]
    if (typeof ctx.projection.summary.depletionYear === 'number') {
      evidence.push({
        label: 'Projected depletion year',
        value: `${ctx.projection.summary.depletionYear}`,
        year: ctx.projection.summary.depletionYear,
      })
    }
    return {
      id: 'spending-guardrails',
      category: 'sequence-risk',
      title: 'Preview dynamic spending guardrails',
      rationale: `Your plan currently assumes fixed inflation-adjusted spending. Preview a rules-based guardrail scenario with a ${formatWholeUsd(requiredAnnual)} required floor and 10% spending adjustments when the withdrawal-rate band is crossed.`,
      impact: {
        qualitative: 'Preview to compare the projected and Monte Carlo impact of flexible spending rules.',
        successRateDeltaPct: 12,
      },
      exact: false,
      confidence: 'medium',
      severity: hasDepletion ? 'attention' : 'info',
      evidence,
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
