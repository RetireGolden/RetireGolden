/**
 * Insights ↔ decision engine alignment (decision engine Phases 1 & 6): an
 * Insights preview and the optimizer-side evaluation of the same change must
 * report identical exact numbers and recommendation states, because both run
 * through the shared evaluator.
 */

import { describe, expect, it } from 'vitest'

import type { InsightAction, InsightCard } from '../insights/types'
import { simOptions, tradHeavyPlan } from './decisionFixtures'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate'
import { simpleRothConversionGenerator } from './generators'
import { candidateFromInsight, evaluateInsightAction } from './insightsAdapter'

const card: Pick<InsightCard, 'id' | 'category' | 'title' | 'rationale'> = {
  id: 'roth-bridge-headroom',
  category: 'tax-brackets',
  title: 'Test Roth conversion bridge years',
  rationale: 'Low-income years before RMDs begin.',
}

describe('insights adapter', () => {
  it('keeps roth insight and roth optimizer recommendation states aligned', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())

    // The optimizer tournament's bracket-12 candidate…
    const bracket12 = simpleRothConversionGenerator.generate(ctx).find((candidate) => candidate.id === 'bracket-12')!
    const optimizerView = evaluateCandidate(ctx, bracket12)

    // …and an Insights card previewing the identical patch.
    const action: InsightAction = {
      kind: 'preview-scenario',
      scenarioName: 'Convert to top of 12% bracket',
      patch: bracket12.planPatch!,
    }
    const insightView = evaluateInsightAction(ctx, card, action)

    expect(insightView.evaluation.recommendationState).toBe(optimizerView.recommendationState)
    expect(insightView.impact.endingAfterTaxEstateDelta).toBeCloseTo(optimizerView.deltas.endingAfterTaxEstate, 6)
    expect(insightView.impact.lifetimeTaxDelta).toBeCloseTo(optimizerView.deltas.lifetimeTax, 6)
  })

  it('maps advisory actions to null candidates and refuses to evaluate them', () => {
    expect(candidateFromInsight(card, { kind: 'advisory' })).toBeNull()
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    expect(() => evaluateInsightAction(ctx, card, { kind: 'advisory' })).toThrow(/advisory/i)
  })

  it('surfaces invalid insight patches as diagnostics instead of numbers', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const { evaluation } = evaluateInsightAction(ctx, card, {
      kind: 'preview-scenario',
      scenarioName: 'Broken',
      patch: { household: { filingStatus: 'not-a-status' } },
    })
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnostics[0]).toMatch(/invalid/i)
  })
})
