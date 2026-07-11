/**
 * Decision-engine coverage for the SS bridge / TIPS ladder candidates
 * (social-security-bridge-and-tips-ladder, step 3): the generator emits a
 * bounded bridge-ladder patch that evaluates on the exact ledger, and the
 * remove-the-ladders alternative when the plan already holds some.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { bridgeLadderGenerator } from './generators.js'
import type { SimulateOptions } from '../projection/simulate.js'

let counter = 0
const testIds = () => `bl-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function simOptions(): SimulateOptions {
  return { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
}

/** Age 62 in 2026, claiming at 70, retired — the classic bridge-window shape. */
function bridgePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1964-06-15',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 900_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_400, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('bridgeLadderGenerator', () => {
  it('emits a bridge candidate covering the gap years, priced by the exact ledger', () => {
    const ctx = createDecisionContext(bridgePlan(), simOptions())
    const candidates = bridgeLadderGenerator.generate(ctx)
    expect(candidates.map((c) => c.id)).toContain('bridge-ladder')
    const bridge = candidates.find((c) => c.id === 'bridge-ladder')!
    const patch = bridge.planPatch as { incomeFloor: { ladders: Array<{ startYear: number; endYear: number; annualRealAmount: number }> } }
    expect(patch.incomeFloor.ladders).toHaveLength(1)
    const ladder = patch.incomeFloor.ladders[0]!
    // Gap window: 2027 (62 already attained mid-2026) through 2033 (claim at 70 in 2034).
    expect(ladder.startYear).toBe(2027)
    expect(ladder.endYear).toBe(2033)
    // Forgone age-62 benefit: 70% of PIA for an FRA-67 claimant.
    expect(ladder.annualRealAmount).toBeCloseTo(2_400 * 0.7 * 12, 4)

    const evaluation = evaluateCandidate(ctx, bridge)
    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(Number.isFinite(evaluation.candidateSummary.endingAfterTaxEstate)).toBe(true)
    // The candidate's ledger run actually pays the bridge in the gap years.
    const y2030 = evaluation.candidateResult.years.find((y) => y.year === 2030)!
    expect(y2030.incomes.tipsLadder).toBeCloseTo(ladder.annualRealAmount, 4)
  })

  it('offers the remove-the-ladders alternative when the plan already holds one', () => {
    const plan = bridgePlan()
    plan.incomeFloor = {
      ladders: [
        { id: 'lad1', name: 'Bridge', purpose: 'bridge', startYear: 2027, endYear: 2033, annualRealAmount: 20_000, purchase: { year: 2026, fundingAccountId: 'cash1' } },
      ],
    }
    const r = parsePlan(plan)
    if (!r.ok) throw new Error(r.issues.join('; '))
    const ctx = createDecisionContext(r.plan, simOptions())
    const ids = bridgeLadderGenerator.generate(ctx).map((c) => c.id)
    expect(ids).toContain('income-floor-none')
    // The existing ladder covers the window → no duplicate bridge candidate.
    expect(ids).not.toContain('bridge-ladder')
  })

  it('emits nothing without a gap (claiming at 62) or without liquid funding', () => {
    const claimEarly = bridgePlan()
    claimEarly.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_400, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    const r1 = parsePlan(claimEarly)
    if (!r1.ok) throw new Error(r1.issues.join('; '))
    expect(bridgeLadderGenerator.generate(createDecisionContext(r1.plan, simOptions()))).toHaveLength(0)

    const broke = bridgePlan()
    broke.accounts = []
    const r2 = parsePlan(broke)
    if (!r2.ok) throw new Error(r2.issues.join('; '))
    expect(bridgeLadderGenerator.generate(createDecisionContext(r2.plan, simOptions()))).toHaveLength(0)
  })
})
