/**
 * The sweep and its month refinement rank with a margin of 0 (the claim-age
 * sweep record): a row that improves the objective by any amount wins. No
 * plan's winner lands between 0 and a dollar, so the margin itself is read off
 * the ranking call.
 */
import { describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { refineClaimAgeMonthly, sweepClaimAges } from './claimAgeSweep.js'
import { rankEvaluations } from './tournament.js'

vi.mock('./tournament.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tournament.js')>()
  return { ...actual, rankEvaluations: vi.fn(actual.rankEvaluations) }
})

function plan(): Plan {
  let n = 0
  const draft = createEmptyPlan({ newId: () => `margin-${++n}` })
  draft.household.people[0] = { id: 'p1', name: 'Pat', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } }
  draft.assumptions.inflationPct = 2
  draft.assumptions.defaultReturnPct = 5
  draft.expenses.baseAnnual = 45_000
  draft.accounts = [{ type: 'taxable', id: 'brokerage', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 900_000, costBasis: 900_000, annualContribution: 0 }]
  draft.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } }]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('the claim-age sweep ranks with a margin of 0', () => {
  it('passes 0 to every ranking call of the sweep and of the refinement', () => {
    const ranked = vi.mocked(rankEvaluations)
    ranked.mockClear()
    const options = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const sweep = sweepClaimAges(plan(), { ...options, objectivePolicyId: 'max-after-tax-estate' })
    expect(ranked).toHaveBeenCalledTimes(1)
    expect(ranked.mock.calls[0]![3]).toBe(0)
    ranked.mockClear()
    expect(refineClaimAgeMonthly(plan(), sweep, options)).not.toBeNull()
    expect(ranked.mock.calls.length).toBeGreaterThan(0)
    expect(ranked.mock.calls.every((call) => call[3] === 0)).toBe(true)
  })
})
