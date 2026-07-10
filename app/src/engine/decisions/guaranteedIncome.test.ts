/**
 * Decision-engine coverage for the guaranteed-income and estate-depth plan:
 * the annuity-purchase candidate generator (bounded SPIA/QLAC candidates that
 * evaluate on the exact ledger) and the survivor reserve target as a hard
 * constraint on the protect-survivor-liquidity policy.
 */
import { describe, expect, it } from 'vitest'

import { simOptions, survivorPlan } from './decisionFixtures'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate'
import { annuityPurchaseGenerator } from './generators'
import { makeProtectSurvivorLiquidity, objectivePolicyForPlan, protectSurvivorLiquidity } from './objectives'
import { runDecisionTournament } from './tournament'

describe('annuity purchase candidate generator', () => {
  it('emits bounded SPIA and QLAC candidates that evaluate on the exact ledger', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const candidates = annuityPurchaseGenerator.generate(ctx)
    // No existing purchase → no "buy none" candidate; SPIA (cash) + its
    // laddered alternative + QLAC (IRA).
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    expect(candidates.length).toBeLessThanOrEqual(4)
    const ids = candidates.map((c) => c.id)
    expect(ids).toContain('annuity-spia')
    expect(ids).toContain('annuity-spia-ladder')
    expect(ids).toContain('annuity-qlac')
    for (const candidate of candidates) {
      const evaluation = evaluateCandidate(ctx, candidate)
      // A valid, executable patch is never diagnostic — the ledger priced it.
      expect(evaluation.recommendationState).not.toBe('diagnostic')
      expect(Number.isFinite(evaluation.candidateSummary.endingAfterTaxEstate)).toBe(true)
    }
  })

  it('ranks annuity candidates through the shared tournament', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const result = runDecisionTournament(ctx, [annuityPurchaseGenerator], { policy: protectSurvivorLiquidity })
    expect(result.ranked.length).toBeGreaterThanOrEqual(2)
    for (const row of result.ranked) expect(Number.isFinite(row.primaryValue)).toBe(true)
  })
})

describe('survivor reserve target constraint', () => {
  it('disqualifies a candidate whose survivor-year investable falls below the target', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const policy = makeProtectSurvivorLiquidity(2_000_000)
    const evaluation = evaluateCandidate(ctx, {
      id: 'noop',
      source: 'heuristic',
      category: 'spending',
      label: 'noop',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 40_000 } },
    })
    expect(policy.constraintViolations(evaluation, ctx).some((v) => v.includes('reserve target'))).toBe(true)
  })

  it('does not fire the reserve constraint for a comfortably-met target', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    const policy = makeProtectSurvivorLiquidity(1)
    const evaluation = evaluateCandidate(ctx, {
      id: 'noop',
      source: 'heuristic',
      category: 'spending',
      label: 'noop',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 40_000 } },
    })
    expect(policy.constraintViolations(evaluation, ctx).some((v) => v.includes('reserve target'))).toBe(false)
  })

  it('objectivePolicyForPlan wires the plan strategy target into the policy', () => {
    const plan = survivorPlan()
    plan.strategies.survivorReserveTarget = 500_000
    const resolved = objectivePolicyForPlan('protect-survivor-liquidity', plan)
    expect(resolved.description).toContain('500,000')
  })
})
