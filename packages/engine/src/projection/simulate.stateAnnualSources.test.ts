import { createStateTaxCalculator } from '../tax/stateTax.js'
import type { Account } from '../model/plan.js'
import { describe, expect, it } from 'vitest'
import { couplePlan, singlePersonPlan, traditionalAccount, validatePlan, recurringOrdinaryIncome, socialSecurityIncome } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput } from './types.js'

function run(qcd: number, spending = 0) {
  const plan = singlePersonPlan({ dob: qcd > 0 ? '1956-03-01' : '1966-03-01', planningAge: 90 })
  plan.accounts = [traditionalAccount('ira', 500000, 'p1', 'ira')]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.expenses.baseAnnual = spending
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.strategies.qcdAnnual = qcd
  const inputs: TaxYearInput[] = []
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(structuredClone(input)); return 0 } },
  })
  return { input: inputs.at(-1)!, result }
}

describe('actual annual state source facts', () => {
  it('derives Massachusetts age count from surviving claimants after the joint return ends', () => {
    const plan = couplePlan({
      p1Dob: '1950-01-01', p2Dob: '1945-01-01',
      p1PlanningAge: 76, p2PlanningAge: 90, state: 'MA',
    })
    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026, horizonEndYear: 2027, deathAgeByPersonId: { p1: 76, p2: 90 },
      taxCalculator: { compute: () => 0 },
    })
    const jointYear = result.years.find((row) => row.year === 2026)!
    const survivorYear = result.years.find((row) => row.year === 2027)!
    expect(jointYear.acceptedTaxInput?.stateHouseholdFacts).toMatchObject({
      claimantDatesOfBirth: ['1950-01-01', '1945-01-01'], age65EligibleCount: 2,
    })
    expect(survivorYear.acceptedTaxInput?.stateHouseholdFacts).toMatchObject({
      claimantDatesOfBirth: ['1945-01-01'], age65EligibleCount: 1,
    })
  })

  it('emits actual voluntary IRA taxable distributions rather than pension-only facts', () => {
    // IRC408(d)(1): no after-tax basis means the100 distribution is all taxable.
    const { input } = run(0, 100)
    const events = input.stateRetirementDistributions!.filter((row) => row.accountId === 'ira')
    expect(events.reduce((sum, row) => sum + row.federallyIncludedAmount, 0)).toBeCloseTo(100, 8)
    expect(events[0]).toMatchObject({ ownerPersonId: 'p1', sourceOwnerPersonId: 'p1', sourceKind: 'ira' })
  })
  it('emits pre-RMD QCD source and federal exclusion without depending on cash-flow capture', () => {
    // IRC408(d)(8): 70.5-year-old donor, direct10000 transfer from zero-basisIRA.
    const { input, result } = run(10000)
    expect(result.years[0]!.qcd).toBe(10000)
    expect(input.stateQcdEventFacts).toEqual([expect.objectContaining({
      accountId: 'ira', ownerPersonId: 'p1', directCharityTransfer: 10000,
      federalExcludedAmount: 10000, federalTaxableAmount: 0, federalBasisAllocated: 0,
    })])
  })
})


it('publishes known-empty runtime HSA and QCD facts for a feature-off CA plan', () => {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'CA' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  const inputs: TaxYearInput[] = []
  simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(input); return 0 } },
  })
  expect(inputs.at(-1)?.stateHsaAccountYearFacts).toEqual([])
  expect(inputs.at(-1)?.stateQcdEventFacts).toEqual([])
})


it('publishes conversion source gross and taxable dollars to final state computation', () => {
  // IRC408A(d)(3): a100 zero-basis conversion is100 ordinary income and
  // retains its source IRA identity for state retirement rules.
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80 })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira'), {
    type: 'roth', kind: 'ira', id: 'roth', name: 'Roth', ownerPersonId: 'p1',
    annualReturnPct: 0, balance: 0, annualContribution: 0, contributionBasis: 0,
  } as Account]
  plan.strategies.rothConversion = { mode: 'manual', conversions: [{year:2026, amount:100}] }
  const inputs: TaxYearInput[] = []
  const result = simulatePlan(validatePlan(plan), {startYear:2026, horizonEndYear:2026,
    taxCalculator: { compute(input) { inputs.push(input); return 0 } },
  })
  expect(result.years[0]!.rothConversion).toBe(100)
  expect(inputs.at(-1)?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId:'ira', sourceKind:'ira', grossDistribution:100, federallyIncludedAmount:100,
  }))
})


it('commits NJ Worksheet C basis once and carries closing basis to the next actual year', () => {
  // NJ GIT-2 Worksheet C:100 basis/(900 December31 +100 distributed)=10%.
  // First100 withdrawal recovers10, leaving90. Next year90/(800+100)
  // again recovers10; reloading the stale100 assertion would recover11.11.
  // Age62 makes this small IRA payment eligible for the NJ retirement
  // exclusion, so funding tax cannot increase the stipulated100 gross.
  const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 80, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.expenses.baseAnnual = 100
  plan.stateTaxFacts.iraBasisYearEvidence = [2026, 2027].map((taxYear) => ({
    taxYear, ownerPersonId:'p1', state:'NJ', accountId:'ira', unrecoveredStateBasis:100,
    annualDistributionsComplete:true, yearEndAccountValue:taxYear===2026?900:800,
    distributionsDuringYear:100, postYearContributionsThroughFilingDeadline:0,
    provenance:{source:'NJ Worksheet C annual account statement',asOf:`${taxYear}-12-31`},
  }))
  const result = simulatePlan(validatePlan(plan), {startYear:2026, horizonEndYear:2027,
    taxCalculator:createStateTaxCalculator({}),
  })
  expect(result.years[0]!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({status:'complete',openingBasis:100,basisConsumed:10,closingBasis:90})
  expect(result.years[1]!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({status:'complete',openingBasis:90,basisConsumed:10,closingBasis:80})
  expect(result.years[1]!.balances.ira).toBeCloseTo(800, 6)
  expect(plan.stateTaxFacts.iraBasisYearEvidence[1]!.unrecoveredStateBasis).toBe(100)
})


it('derives Utah included Social Security while preserving unknown statutory MAGI additions', () => {
  // IRC86:30000ordinary+10000SS gives5350 taxableSS. Utah1042 credits
  // only5350*.0445;35350*.0445 minus that credit leaves1335.
  const plan = singlePersonPlan({dob:'1958-01-02',planningAge:80,state:'UT'})
  const ss = socialSecurityIncome('ss',10000/12,66)
  if (ss.type !== 'socialSecurity') throw new Error('Expected SS fixture')
  ss.claimAge = {years:66,months:8}
  plan.incomes = [recurringOrdinaryIncome('ordinary',30000),ss]
  // Explicit reviewed assertion of no outside-engine section114 additions;
  // projected AGI/SS inputs are derived, not filled into this evidence row.
  plan.stateTaxFacts.householdYearFacts = [{year:2026,utahSection59_10_114Additions:0}]
  const calc = createStateTaxCalculator()
  const result = simulatePlan(validatePlan(plan),{startYear:2026,horizonEndYear:2026,taxCalculator:calc})
  const row = result.years[0]!
  expect(row.acceptedTaxInput?.stateHouseholdFacts).toMatchObject({
    federalAgi:35350,socialSecurityIncludedInUtahTaxableIncome:5350,
    railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome:0,
    utahSection59_10_114Additions:0,
  })
  expect(row.tax).toBeCloseTo(1335,6)
  expect(row.taxComputation?.status).toBe('complete')
  plan.stateTaxFacts.householdYearFacts = []
  const unknown = simulatePlan(validatePlan(plan),{startYear:2026,horizonEndYear:2026,taxCalculator:calc}).years[0]!
  expect(unknown.acceptedTaxInput?.stateHouseholdFacts?.utahSection59_10_114Additions).toBeUndefined()
  expect(unknown.taxComputation?.status).toBe('incomplete')
})


it('keeps undated Arkansas IRA withdrawals unknown in the year crossing59.5', () => {
  // Ark26-51-307 IRA exclusion uses distribution-day age. A1967Jan1
  // recipient reaches59.5 during2026; year-end age cannot establish every
  // annual withdrawal was eligible. A1966Jan1 recipient is60 onJan1, so
  // every possible2026 distribution satisfies that age gate.
  const runAge = (dob:string) => {
    const plan = singlePersonPlan({dob,planningAge:80,state:'AR'})
    plan.accounts = [traditionalAccount('ira',10000,'p1','ira')]
    plan.expenses.baseAnnual = 6000
    return simulatePlan(validatePlan(plan),{startYear:2026,horizonEndYear:2026,taxCalculator:createStateTaxCalculator()}).years[0]!
  }
  const crossing = runAge('1967-01-01')
  const known = runAge('1966-01-01')
  expect(crossing.acceptedTaxInput?.stateRetirementDistributions?.[0]).toMatchObject({minimumAgeAtDistributionYears:59})
  expect(crossing.acceptedTaxInput?.stateRetirementDistributions?.[0]?.ageAtDistributionYears).toBeUndefined()
  expect(crossing.taxComputation?.status).toBe('incomplete')
  expect(known.acceptedTaxInput?.stateRetirementDistributions?.[0]).toMatchObject({minimumAgeAtDistributionYears:60})
  expect(known.taxComputation?.status).toBe('complete')
})
