/**
 * Covers the Optimize page's claim-age helpers, especially the load-bearing
 * apply contract: a schedule co-optimized with a claim change must never be
 * installed without that claim change (it was computed against the patched
 * plan, so conversions alone would be applied to the wrong plan).
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../engine/model/plan'
import type { ClaimAgeCoOptimization } from '../engine/projection/optimizePlan'
import { socialSecurityIncome } from '../testSupport/planFixtures'
import { applyOptimizeRecommendation, claimEstateGain, planWithWinningClaim } from './optimizePageClaim'

let counter = 0
const ids = () => `opc-${++counter}`

function ssPlan(): Plan {
  const p = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1964-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 88, source: 'manual' },
  }
  p.incomes = [socialSecurityIncome('ss', 2_400, 62)]
  const r = parsePlan(p)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

/** A claim-age result whose winning patch moves the claim from 62 to 70. */
function claimAgeWithPatch(plan: Plan): ClaimAgeCoOptimization {
  const incomes = plan.incomes.map((s) =>
    s.type === 'socialSecurity' ? { ...s, claimAge: { years: 70, months: 0 } } : s,
  )
  return {
    enabled: true,
    combinationsEvaluated: 3,
    winningClaimLabel: 'Pat claims Social Security at 70',
    winningClaimPatch: { incomes },
    jointExactEstate: 1_118_000,
    currentClaimExactEstate: 1_000_000,
  }
}

const noChange: ClaimAgeCoOptimization = {
  enabled: true,
  combinationsEvaluated: 3,
  winningClaimLabel: null,
  winningClaimPatch: null,
  jointExactEstate: 1_000_000,
  currentClaimExactEstate: 1_000_000,
}

describe('claimEstateGain', () => {
  it('is the joint-over-current improvement when a claim change won, else zero', () => {
    expect(claimEstateGain(claimAgeWithPatch(ssPlan()))).toBe(118_000)
    expect(claimEstateGain(noChange)).toBe(0)
    expect(claimEstateGain(null)).toBe(0)
  })
})

describe('planWithWinningClaim', () => {
  it('returns the claim-patched plan without mutating the original', () => {
    const plan = ssPlan()
    const claimAge = claimAgeWithPatch(plan)
    const patched = planWithWinningClaim(plan, claimAge)
    expect(patched).not.toBe(plan)
    expect(patched.incomes).toBe(claimAge.winningClaimPatch!.incomes)
    expect(plan.incomes[0]!.type === 'socialSecurity' && plan.incomes[0]!.claimAge.years).toBe(62)
  })

  it('returns the plan unchanged when no claim change won or co-optimization did not run', () => {
    const plan = ssPlan()
    expect(planWithWinningClaim(plan, noChange)).toBe(plan)
    expect(planWithWinningClaim(plan, null)).toBe(plan)
  })
})

describe('applyOptimizeRecommendation', () => {
  const conversions = [
    { year: 2026, amount: 40_000 },
    { year: 2027, amount: 35_000 },
  ]

  it('installs the claim change and the conversion schedule together', () => {
    const draft = ssPlan()
    const claimAge = claimAgeWithPatch(draft)
    applyOptimizeRecommendation(draft, { claimAge, conversions, mode: 'optimized', nowIso: '2026-07-08T00:00:00.000Z' })

    // BOTH halves of the joint recommendation land — never the schedule alone.
    expect(draft.incomes).toBe(claimAge.winningClaimPatch!.incomes)
    expect(draft.strategies.rothConversion).toEqual({
      mode: 'optimized',
      conversions,
      optimizedAtIso: '2026-07-08T00:00:00.000Z',
    })
  })

  it('touches only incomes and the conversion strategy — every other plan field is left alone', () => {
    const draft = ssPlan()
    const claimAge = claimAgeWithPatch(draft)
    const before = {
      household: draft.household,
      accounts: draft.accounts,
      expenses: draft.expenses,
      assumptions: draft.assumptions,
      withdrawalOrder: draft.strategies.withdrawalOrder,
    }
    applyOptimizeRecommendation(draft, { claimAge, conversions, mode: 'optimized' })

    // The claim patch's documented scope is the incomes array; nothing else
    // may move (same references, not just deep equality).
    expect(draft.household).toBe(before.household)
    expect(draft.accounts).toBe(before.accounts)
    expect(draft.expenses).toBe(before.expenses)
    expect(draft.assumptions).toBe(before.assumptions)
    expect(draft.strategies.withdrawalOrder).toBe(before.withdrawalOrder)
  })

  it('writes a manual schedule with the same joint semantics', () => {
    const draft = ssPlan()
    const claimAge = claimAgeWithPatch(draft)
    applyOptimizeRecommendation(draft, { claimAge, conversions, mode: 'manual' })

    expect(draft.incomes).toBe(claimAge.winningClaimPatch!.incomes)
    expect(draft.strategies.rothConversion).toEqual({ mode: 'manual', conversions })
  })

  it('applies only the claim change when the incumbent schedule holds (empty conversions)', () => {
    const draft = ssPlan()
    const before = draft.strategies.rothConversion
    const claimAge = claimAgeWithPatch(draft)
    applyOptimizeRecommendation(draft, { claimAge, conversions: [], mode: 'optimized' })

    expect(draft.incomes).toBe(claimAge.winningClaimPatch!.incomes)
    expect(draft.strategies.rothConversion).toBe(before)
  })

  it('applies only the schedule when no claim change won', () => {
    const draft = ssPlan()
    const incomesBefore = draft.incomes
    applyOptimizeRecommendation(draft, { claimAge: noChange, conversions, mode: 'manual' })
    expect(draft.incomes).toBe(incomesBefore)
    expect(draft.strategies.rothConversion).toEqual({ mode: 'manual', conversions })

    const draft2 = ssPlan()
    applyOptimizeRecommendation(draft2, { claimAge: null, conversions, mode: 'manual' })
    expect(draft2.strategies.rothConversion).toEqual({ mode: 'manual', conversions })
  })
})
