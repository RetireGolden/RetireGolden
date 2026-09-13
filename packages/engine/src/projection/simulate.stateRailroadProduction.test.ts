import { describe, expect, it } from 'vitest'
import type { Account } from '../model/plan.js'
import { singlePersonPlan, socialSecurityIncome, validatePlan } from '../testing/planFixtures.js'
import { stateParamsFor } from '../params/state/index.js'
import { computeStateTaxDetailResult, createStateTaxCalculator } from '../tax/stateTax.js'
import { simulatePlan } from './simulate.js'

describe('actual railroad gross in Maryland pension exclusion', () => {
  it('offsets the 40600 pension maximum by SS20000 plus RRB5000 without optional cash-flow capture', () => {
    // Maryland pension exclusion worksheet: min(50000,40600-20000-5000)=15600.
    // Source: Maryland Comptroller pension exclusion worksheet, the TY2026
    // parameter pack's published maximum. Gross RRB, including TierII, offsets it.
    const plan = singlePersonPlan({ dob: '1958-01-02', planningAge: 85, state: 'MD' })
    // January2 avoids the SSA January1 prior-birth-year rule;1958 FRA is66y8m.
    const ss = socialSecurityIncome('ss', 20000 / 12, 66)
    if (ss.type !== 'socialSecurity') throw new Error('Expected SS fixture')
    ss.claimAge = { years: 66, months: 8 }
    plan.incomes = [ss]
    plan.accounts = [
      { type: 'pension', id: 'qualified', name: 'Qualified pension', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 65, monthlyAmount: 50000 / 12, colaPct: 0,
        survivorPct: 0, source: 'employerPlan' },
      { type: 'pension', id: 'rrb', name: 'Railroad TierII', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 65, monthlyAmount: 5000 / 12, colaPct: 0,
        survivorPct: 0, source: 'railroadTier2' },
    ] as Account[]
    const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
      taxCalculator: createStateTaxCalculator() })
    const input = result.years[0]!.acceptedTaxInput!
    expect(input.stateHouseholdFacts).toMatchObject({ householdGrossSocialSecurity: 20000,
      householdGrossRailroadBenefits: 5000 })
    const params = stateParamsFor('MD', 2026)!
    const options = { householdFacts: input.stateHouseholdFacts,
      retirementDistributions: input.stateRetirementDistributions }
    const actual = computeStateTaxDetailResult(params, input, options)
    const withoutPensionExclusion = computeStateTaxDetailResult({ ...params,
      retirementPrivate: { ...params.retirementPrivate, capPerPerson: 0 } }, input, options)
    expect(withoutPensionExclusion.taxableIncome - actual.taxableIncome).toBeCloseTo(15600, 6)
    expect(actual.warnings.some((warning) => warning.code === 'md-pension-benefit-offset-unknown')).toBe(false)
  })
})
