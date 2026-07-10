import { describe, expect, it } from 'vitest'

import type { AllocationWeights, Plan } from '../model/plan'
import { ASSET_CLASS_IDS } from '../model/plan'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate'
import {
  assetLocationGenerator,
  probabilityBandSpendingGuardrailGenerator,
  socialSecurityClaimGridGenerator,
} from './generators'
import { assetLocationPlan, noTraditionalPlan, simOptions } from './decisionFixtures'

describe('probabilityBandSpendingGuardrailGenerator', () => {
  it('emits a ledger-native guardrail patch with probability-band metadata', () => {
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = 50_000
    const ctx = createDecisionContext(plan, simOptions())

    const candidates = probabilityBandSpendingGuardrailGenerator({ lowerSuccessPct: 75, upperSuccessPct: 95 }).generate(ctx)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.category).toBe('spending')
    expect(candidates[0]!.metadata).toMatchObject({
      decisionRule: 'probabilityBandSafeSpend',
      lowerSuccessPct: 75,
      upperSuccessPct: 95,
    })
    expect(candidates[0]!.planPatch).toMatchObject({
      expenses: {
        requiredAnnual: 40_000,
        spendingPolicy: { mode: 'withdrawalRateGuardrails' },
      },
    })
  })

  it('does not duplicate an already active guardrail policy', () => {
    const plan = noTraditionalPlan()
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    const ctx = createDecisionContext(plan, simOptions())

    expect(probabilityBandSpendingGuardrailGenerator().generate(ctx)).toEqual([])
  })
})

describe('assetLocationGenerator', () => {
  /** Household dollars per class across all statically allocated accounts. */
  function householdClassDollars(plan: Plan): Record<string, number> {
    const totals: Record<string, number> = { usStocks: 0, intlStocks: 0, bonds: 0, cash: 0 }
    for (const account of plan.accounts) {
      if (!('allocation' in account) || account.allocation?.mode !== 'static') continue
      const weights = account.allocation.weights as AllocationWeights
      for (const id of ASSET_CLASS_IDS) totals[id] = totals[id]! + (weights[id] / 100) * account.balance
    }
    return totals
  }

  it('emits a bounded set of location-swap patches that preserve the household class mix', () => {
    const plan = assetLocationPlan()
    const ctx = createDecisionContext(plan, simOptions())
    const candidates = assetLocationGenerator.generate(ctx)

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThanOrEqual(3)
    const before = householdClassDollars(plan)
    for (const candidate of candidates) {
      expect(candidate.category).toBe('asset-location')
      const patched = { ...plan, accounts: (candidate.planPatch as { accounts: Plan['accounts'] }).accounts }
      const after = householdClassDollars(patched)
      for (const id of ASSET_CLASS_IDS) expect(after[id]).toBeCloseTo(before[id]!, 4)
    }
  })

  it('produces nothing when no account opts into a static allocation', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    expect(assetLocationGenerator.generate(ctx)).toEqual([])
  })

  it('exact evaluation prices the location change (bonds→traditional improves the after-tax estate)', () => {
    const plan = assetLocationPlan()
    const ctx = createDecisionContext(plan, simOptions())
    const candidate = assetLocationGenerator
      .generate(ctx)
      .find((c) => c.id === 'asset-location-bonds-to-traditional')!
    const evaluation = evaluateCandidate(ctx, candidate)

    expect(evaluation.recommendationState).toBe('beneficial')
    expect(evaluation.deltas.endingAfterTaxEstate).toBeGreaterThan(0)
  })
})

describe('socialSecurityClaimGridGenerator', () => {
  it('emits the full whole-year grid including the current claim age', () => {
    const plan = noTraditionalPlan()
    plan.household.people[0] = { ...plan.household.people[0]!, dob: '1964-06-15' } // 62 in 2026
    plan.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    const ctx = createDecisionContext(plan, simOptions())

    const candidates = socialSecurityClaimGridGenerator.generate(ctx)

    expect(candidates).toHaveLength(9)
    expect(candidates.some((candidate) => candidate.id === 'ss-claim-grid-p1-70')).toBe(true)
    expect(candidates[0]!.metadata).toMatchObject({ decisionRule: 'socialSecurityClaimGrid' })
    expect(candidates.map((candidate) => (candidate.metadata?.['claimByPersonId'] as Record<string, number>)['p1'])).toEqual([
      62, 63, 64, 65, 66, 67, 68, 69, 70,
    ])
  })

  it('excludes a zero-PIA spouse so the grid stays a single-person sweep', () => {
    const plan = noTraditionalPlan()
    plan.household.people[0] = { ...plan.household.people[0]!, dob: '1964-06-15' } // 62 in 2026
    plan.household.people = [
      plan.household.people[0]!,
      { id: 'p2', name: 'Spouse', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 70, months: 0 } },
      // Default record the planner creates for the spouse: PIA 0, no earnings.
      { type: 'socialSecurity', id: 'ss2', personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    const ctx = createDecisionContext(plan, simOptions())

    const candidates = socialSecurityClaimGridGenerator.generate(ctx)

    // Only p1 is a real claiming stream, so 9 candidates (not 81) and no p2 ages.
    expect(candidates).toHaveLength(9)
    for (const candidate of candidates) {
      expect((candidate.metadata?.['claimByPersonId'] as Record<string, number>)['p2']).toBeUndefined()
    }
  })
})
