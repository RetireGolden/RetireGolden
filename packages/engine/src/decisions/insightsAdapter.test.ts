/**
 * Insights ↔ decision engine alignment (decision engine Phases 1 & 6): an
 * Insights preview and the optimizer-side evaluation of the same change must
 * report identical exact numbers and recommendation states, because both run
 * through the shared evaluator.
 */

import { describe, expect, it } from 'vitest'

import { spendingHeadroom } from '../insights/detectors/spendingHeadroom.js'
import type { InsightAction, InsightCard } from '../insights/types.js'
import { simOptions, tradHeavyPlan } from '../testing/decisionFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { simpleRothConversionGenerator } from './generators.js'
import { candidateFromInsight, evaluateInsightAction } from './insightsAdapter.js'

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

  it('previews the spending-headroom card on a plan with an unpriced ACA year; other cards still refuse', () => {
    // Marketplace in 2026 (priced) and 2027 (a stand-in year past the latest
    // parameter pack, unpriced: the ledger budgets its full premium).
    const plan = singlePersonPlan({ dob: '1964-06-15', planningAge: 63 })
    plan.accounts = [cashAccount('cash', 300_000)]
    plan.incomes = [recurringOrdinaryIncome('wages', 30_000, 2026)]
    plan.expenses.baseAnnual = 40_000
    setAcaYearContract(plan, { year: 2026 })
    setAcaYearContract(plan, { year: 2027 })
    const ctx = createDecisionContext(validatePlan(plan), { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
    const action: InsightAction = {
      kind: 'preview-scenario',
      scenarioName: 'Spend $50,000/yr (max sustainable)',
      patch: { expenses: { baseAnnual: 50_000 } },
    }
    // The detector's own id and category, so the adapter's disclose default
    // and the real detector cannot drift apart: if the adapter's constant ever
    // named another id, this card would be refused and the test would fail.
    const headroomCard = { ...card, id: spendingHeadroom.id, category: spendingHeadroom.category }

    const headroom = evaluateInsightAction(ctx, headroomCard, action)
    expect(headroom.evaluation.recommendationState).not.toBe('diagnostic')
    expect(headroom.evaluation.diagnostics).toContain(
      'ACA premium tax credit is not priced in the candidate for 2027; the ledger budgets the full Marketplace premium in those years.',
    )

    // An explicit option wins over the card default, and every other card
    // keeps the evaluator's refusal.
    expect(evaluateInsightAction(ctx, headroomCard, action, { nonActionableAca: 'refuse' }).evaluation.recommendationState)
      .toBe('diagnostic')
    const other = evaluateInsightAction(ctx, card, action)
    expect(other.evaluation.recommendationState).toBe('diagnostic')
    expect(other.impact).toEqual(headroom.impact)
  })
})
