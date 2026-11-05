import { describe, expect, it } from 'vitest'
import { createEmptyPlan, type Plan } from '../model/plan.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

/**
 * #841 through the real yearly settlement: a Massachusetts IRA with $20,000
 * of basis already taxed by MA, drawn in 2026 and 2028 (one-time goals) and
 * not at all in 2027. Basis is recovered only against distributions (Mass.
 * Gen. Laws ch.62 §2(a)(2)(F)), so 2028 opens at 2026's closing.
 */
function massachusettsIraPlan(): Plan {
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.household.state = 'MA'
  plan.household.filingStatus = 'single'
  plan.household.people[0]!.dob = '1966-03-01'
  plan.accounts = [{
    type: 'traditional', kind: 'ira', id: 'ira', name: 'IRA', ownerPersonId: 'p1',
    annualReturnPct: 0, balance: 200_000, annualContribution: 0,
  }]
  plan.expenses.oneTimeGoals = [
    { id: 'g2026', label: 'Roof', year: 2026, amount: 5_000 },
    { id: 'g2028', label: 'Car', year: 2028, amount: 10_000 },
  ]
  // The plan characterizes each year's IRA withdrawal with the basis it knew
  // when it was written; the lifecycle replaces it with the carried closing.
  plan.stateTaxFacts.retirementDistributionEvidence = [2026, 2028].map((taxYear) => ({
    eventId: `voluntary:${taxYear}:ira`, taxYear, accountId: 'ira', sourceOwnerPersonId: 'p1', recipientPersonId: 'p1',
    source: 'ira' as const, federallyIncludedAmount: 0, eligibility: { knownPreviouslyTaxedBasis: 20_000 },
    provenance: { source: 'test', asOf: '2026-01-01' },
  }))
  return plan
}

describe('state pension basis through a projected year with no distribution (#841)', () => {
  it('opens the 2028 Massachusetts pool at the 2026 closing', () => {
    const result = simulatePlan(validatePlan(massachusettsIraPlan()), {
      startYear: 2026, horizonEndYear: 2028, taxCalculator: createStateTaxCalculator(),
    })
    const year = (calendarYear: number) => result.years.find((entry) => entry.year === calendarYear)!
    const iraRows = (calendarYear: number) => year(calendarYear).acceptedTaxInput?.stateRetirementDistributions
      ?.filter((row) => row.accountId === 'ira') ?? []
    const iraPool = (calendarYear: number) => year(calendarYear).taxComputation?.pensionBasisPools
      ?.find((row) => row.accountId === 'ira')

    const first = iraPool(2026)
    expect(first).toMatchObject({ state: 'MA', status: 'complete', openingBasis: 20_000 })
    expect(first!.basisConsumed).toBeGreaterThan(5_000 - 1)
    expect(first!.closingBasis).toBe(20_000 - first!.basisConsumed!)

    // 2027 has no IRA distribution, so no transition of its own.
    expect(iraRows(2027)).toEqual([])
    expect(iraPool(2027)).toBeUndefined()

    const later = iraPool(2028)
    const drawn = iraRows(2028).reduce((sum, row) => sum + row.federallyIncludedAmount, 0)
    expect(drawn).toBeGreaterThan(0)
    expect(later).toMatchObject({ state: 'MA', status: 'complete', openingBasis: first!.closingBasis })
    expect(later!.basisConsumed).toBe(Math.min(first!.closingBasis!, drawn))
    expect(later!.closingBasis).toBe(first!.closingBasis! - later!.basisConsumed!)
  })
})
