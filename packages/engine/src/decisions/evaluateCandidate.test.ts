/**
 * Shared exact-ledger evaluator tests (decision engine Phase 1). The theme of
 * every case: candidate logic never re-prices tax effects — ordinary income,
 * capital gains basis, Social Security taxability, contributions, and
 * inherited-IRA rules are all priced by running the candidate through the
 * exact ledger.
 */

import { describe, expect, it } from 'vitest'

import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import {
  accumulatorPlan,
  inheritedOnlyPlan,
  mixedTraditionalPlan,
  oneTimeIncomePlan,
  simOptions,
  ssTaxabilityPlan,
  taxableBridgePlan,
  tradHeavyPlan,
} from './decisionFixtures.js'
import { createDecisionContext, evaluateCandidate, planForCandidate } from './evaluateCandidate.js'
import type { DecisionCandidate } from './types.js'

function rothCandidate(overrides: Partial<DecisionCandidate>): DecisionCandidate {
  return {
    id: 'test-candidate',
    source: 'heuristic',
    category: 'roth',
    label: 'Test candidate',
    explanation: 'test',
    ...overrides,
  }
}

describe('evaluateCandidate', () => {
  it('evaluates plan patch candidates through the exact ledger', () => {
    const plan = tradHeavyPlan()
    const opts = simOptions()
    const ctx = createDecisionContext(plan, opts)
    const patch = {
      strategies: {
        rothConversion: {
          mode: 'fillToTarget',
          target: 'topOfBracket',
          targetValue: 12,
          startYear: ctx.baselineResult.startYear,
          endYear: ctx.baselineResult.endYear,
        },
      },
    }

    const evaluation = evaluateCandidate(ctx, rothCandidate({ planPatch: patch }))

    // The deltas must equal an independent exact simulate of the same patch.
    const built = planForCandidate(plan, { planPatch: patch })
    if (!built.ok) throw new Error(built.error)
    const expected = summarizeProjection(built.plan, simulatePlan(built.plan, opts))
    expect(evaluation.candidateSummary.endingAfterTaxEstate).toBeCloseTo(expected.endingAfterTaxEstate, 6)
    expect(evaluation.deltas.endingAfterTaxEstate).toBeCloseTo(
      expected.endingAfterTaxEstate - ctx.baselineSummary.endingAfterTaxEstate,
      6,
    )
    // Trad-heavy at flat spending: a 12%-bracket fill is exact-ledger beneficial.
    expect(evaluation.recommendationState).toBe('beneficial')
    expect(evaluation.deltas.endingAfterTaxEstate).toBeGreaterThan(0)
  })

  it('marks candidates with invalid patches diagnostic instead of recommending them', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ planPatch: { assumptions: { inflationPct: 'not-a-number' } } }),
    )
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnostics[0]).toMatch(/invalid/i)
    expect(evaluation.deltas.endingAfterTaxEstate).toBe(0)
  })

  it('evaluates roth schedule candidates through the exact ledger', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ conversions: [{ year: 2027, amount: 30_000 }, { year: 2028, amount: 30_000 }] }),
    )
    expect(evaluation.conversionExecution).not.toBeNull()
    expect(evaluation.conversionExecution!.requestedTotal).toBe(60_000)
    // Plenty of traditional balance: the ledger executes the schedule in full.
    expect(evaluation.conversionExecution!.executedRatio).toBeCloseTo(1, 6)
    expect(evaluation.conversionExecution!.firstMateriallyUnexecutedYear).toBeNull()
    // The candidate run itself carries the conversions.
    const y2027 = evaluation.candidateResult.years.find((y) => y.year === 2027)!
    expect(y2027.rothConversion).toBeCloseTo(30_000, 2)
  })

  it('respects inherited non-convertible traditional assets', () => {
    // Inherited-only: a requested schedule cannot execute at all → diagnostic.
    const inheritedCtx = createDecisionContext(inheritedOnlyPlan(), simOptions())
    const blocked = evaluateCandidate(
      inheritedCtx,
      rothCandidate({ conversions: [{ year: 2027, amount: 50_000 }] }),
    )
    expect(blocked.conversionExecution!.executedTotal).toBe(0)
    expect(blocked.recommendationState).toBe('diagnostic')

    // Mixed: execution is capped by the own balance, never the inherited one.
    const mixedCtx = createDecisionContext(mixedTraditionalPlan(), simOptions())
    const capped = evaluateCandidate(
      mixedCtx,
      rothCandidate({ conversions: [{ year: 2026, amount: 400_000 }] }),
    )
    expect(capped.conversionExecution!.executedTotal).toBeLessThanOrEqual(200_000 + 1)
    expect(capped.conversionExecution!.firstMateriallyUnexecutedYear).toBe(2026)
  })

  it('prices one-time taxable income in exact candidate evaluation', () => {
    const ctx = createDecisionContext(oneTimeIncomePlan(), simOptions())
    const quietYear = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2027, amount: 30_000 }] }))
    const incomeYear = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2028, amount: 30_000 }] }))

    // 2028 carries an $80k ordinary payout, so the same conversion stacks into
    // higher brackets there — only the exact ledger prices that.
    const incomeYearRow = incomeYear.candidateResult.years.find((y) => y.year === 2028)!
    expect(incomeYearRow.incomes.oneTime).toBeGreaterThan(0)
    expect(incomeYear.deltas.lifetimeTax).toBeGreaterThan(quietYear.deltas.lifetimeTax + 1_000)
  })

  it('prices taxable brokerage gains from withdrawal source', () => {
    const opts = simOptions()
    const candidate = rothCandidate({ conversions: [{ year: 2027, amount: 40_000 }, { year: 2028, amount: 40_000 }] })

    const highBasis = evaluateCandidate(createDecisionContext(taxableBridgePlan('high'), opts), candidate)
    const lowBasis = evaluateCandidate(createDecisionContext(taxableBridgePlan('low'), opts), candidate)

    // Spending and conversion taxes are funded by selling brokerage shares;
    // the low-basis household realizes far more gains for the same candidate.
    const gains = (evaluation: typeof lowBasis) =>
      evaluation.candidateResult.years.reduce((sum, year) => sum + year.realizedGains, 0)
    expect(gains(lowBasis)).toBeGreaterThan(gains(highBasis) + 10_000)
    expect(lowBasis.candidateSummary.lifetimeTaxesAndPenalties).toBeGreaterThan(
      highBasis.candidateSummary.lifetimeTaxesAndPenalties,
    )
  })

  it('prices social security taxability feedback', () => {
    const ctx = createDecisionContext(ssTaxabilityPlan(), simOptions())
    // SS starts in 2034 (claim at 70). Same conversion before vs during
    // benefit years: converting on top of benefits drags SS into taxability.
    const beforeBenefits = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2027, amount: 30_000 }] }))
    const duringBenefits = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2036, amount: 30_000 }] }))

    const ssYear = duringBenefits.candidateResult.years.find((y) => y.year === 2036)!
    expect(ssYear.incomes.socialSecurity).toBeGreaterThan(0)
    expect(duringBenefits.deltas.lifetimeTax).toBeGreaterThan(beforeBenefits.deltas.lifetimeTax + 500)
  })

  it('preserves scheduled contributions in exact candidate evaluation', () => {
    const ctx = createDecisionContext(accumulatorPlan(), simOptions())
    const evaluation = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2027, amount: 20_000 }] }))

    const total = (years: typeof ctx.baselineResult.years, field: 'contributions' | 'employerMatch') =>
      years.reduce((sum, year) => sum + year[field], 0)
    // Future deposits (employee contributions and employer match) survive the
    // candidate evaluation as account assets, exactly as in the baseline.
    expect(total(evaluation.candidateResult.years, 'contributions')).toBeCloseTo(
      total(ctx.baselineResult.years, 'contributions'),
      2,
    )
    expect(total(evaluation.candidateResult.years, 'employerMatch')).toBeCloseTo(
      total(ctx.baselineResult.years, 'employerMatch'),
      2,
    )
    expect(total(evaluation.candidateResult.years, 'employerMatch')).toBeGreaterThan(0)
  })
})
