import { expect, it } from 'vitest'
import type { Account } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { simulatePlan } from './simulate.js'

it('retains Kentucky retirement exclusion for actual qualified annuity payments with capture off', () => {
  // KRS141.010 pension/retirement exclusion:12000 zero-basis IRA-annuity
  // income is below the31410 exclusion. The source fact must reach actual
  // state calculation; ordinaryIncome is not increased a second time.
  const plan = singlePersonPlan({ dob: '1960-01-02', planningAge: 90, state: 'KY' })
  plan.accounts = [traditionalAccount('ira', 200000, 'p1', 'ira'), {
    type: 'annuity', id: 'annuity', name: 'Qualified annuity', ownerPersonId: 'p1',
    annualReturnPct: 0, startAge: 67, monthlyAmount: 1000, colaPct: 0, taxablePct: 100,
    purchase: { year: 2026, premium: 100000, fundingAccountId: 'ira', taxQualification: 'qualified' },
  } as Account]
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2027,
    taxCalculator: createStateTaxCalculator() })
  const year = result.years.find((row) => row.year === 2027)!
  expect(year.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', sourceKind: 'ira', grossDistribution: 12000, federallyIncludedAmount: 12000,
    recipientAgeYears: 67,
  }))
  expect(year.acceptedTaxInput?.ordinaryIncome).toBe(12000)
  expect(year.tax).toBe(0)
})


it('preserves qualified annuity gross while carrying the accepted Form8606 basis return', () => {
  // IRC408(d)(2) annual owner pool:60000 basis / (188000 year-end IRA+
  // contract value +12000 distribution)=30%;12000 payment returns3600basis.
  const plan = singlePersonPlan({dob:'1960-01-02',planningAge:90,state:'KY'})
  plan.accounts = [{...traditionalAccount('ira',200000,'p1','ira'),nondeductibleBasis:60000}, {
    type:'annuity',id:'annuity',name:'Qualified annuity',ownerPersonId:'p1',annualReturnPct:0,
    startAge:67,monthlyAmount:1000,colaPct:0,taxablePct:100,
    purchase:{year:2026,premium:100000,fundingAccountId:'ira',taxQualification:'qualified'},
  }] as Account[]
  const result = simulatePlan(validatePlan(plan),{startYear:2026,horizonEndYear:2027,taxCalculator:createStateTaxCalculator()})
  const input = result.years.find((row)=>row.year===2027)!.acceptedTaxInput!
  expect(input.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId:'annuity',grossDistribution:12000,federallyIncludedAmount:8400,
  }))
  expect(input.ordinaryIncome).toBeCloseTo(8400,6)
})
