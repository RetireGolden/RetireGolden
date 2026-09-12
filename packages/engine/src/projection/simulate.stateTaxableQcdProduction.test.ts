import { describe, expect, it } from 'vitest'
import { retirementActionEligibilityFactsSchema, type Account, type Plan } from '../model/plan.js'
import { persistedRetirementActionRequestSchema } from '../actions/contract.js'
import { singlePersonPlan, traditionalAccount, cashAccount, validatePlan } from '../testing/planFixtures.js'
import { wages } from './simulate.test-support.js'
import { simulatePlan } from './simulate.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'

function check(plan: Plan, expectedTaxable: number, expectedGross: number) {
  const row = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator() }).years[0]!
  const input = row.acceptedTaxInput!
  const qcd = input.stateQcdEventFacts![0]!
  expect(qcd.federalTaxableAmount).toBeCloseTo(expectedTaxable, 6)
  expect(qcd.grossIraDistribution).toBeCloseTo(expectedGross, 6)
  const matched = input.stateRetirementDistributions!.filter((event) => event.eventId === qcd.eventId)
  expect(matched).toHaveLength(1)
  expect(matched[0]).toMatchObject({ grossDistribution: expectedGross, federallyIncludedAmount: expectedTaxable })
  expect(input.stateRetirementDistributions!.reduce((sum, event) => sum + event.federallyIncludedAmount, 0))
    .toBeLessThanOrEqual(input.ordinaryIncome + 0.000001)
  return { row, input, qcd }
}

describe('taxable QCD state retirement source emission', () => {
  it('keeps grouped IRA basis and section219 offset in one actual $50000 event', () => {
    // CorpusY2:100000 IRA +6000 deductible contribution;60000 basis.
    // Gross50000, federal exclusion40000, basis4000, taxable6000.
    const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 95, retirementAge: null, state: 'KY' })
    plan.incomes = [wages(10000)]
    plan.accounts = [cashAccount('cash',10000),
      { ...traditionalAccount('ira',60000), annualContribution:6000, nondeductibleBasis:36000 },
      { ...traditionalAccount('ira',40000), nondeductibleBasis:24000 },
    ] as Account[]
    plan.strategies.qcdAnnual = 50000
    const { qcd, input } = check(plan,6000,50000)
    expect(qcd.federalExcludedAmount).toBe(40000)
    expect(qcd.federalBasisAllocated).toBe(4000)
    expect(input.ordinaryIncome).toBe(10000) //10000wages-6000deduction+6000taxableQCD.
  })
  it('includes a $6000 section219-offset QCD as retirement income exactly once', () => {
    const plan = singlePersonPlan({ dob:'1953-03-15',planningAge:95,state:'KY' })
    plan.accounts = [cashAccount('cash',0),traditionalAccount('ira',265000)]
    plan.strategies.qcdAnnual = 6000
    plan.retirementActionEligibilityFacts = retirementActionEligibilityFactsSchema.parse({ iraClassifications:[],sepSimpleActivities:[],
      deductibleIraContributions:[2024,2025].map((taxYear) => ({ donorPersonId:'p1',taxYear,amountCents:500000,
        evidenceId:`section219-${taxYear}`,provenance:{source:'manual'} })) })
    check(plan,6000,6000)
  })
  it('retains the $6500 gift when unprovable prior offsets refuse the federal exclusion', () => {
    const plan = singlePersonPlan({dob:'1953-03-15',planningAge:95,state:'KY'})
    plan.accounts = [cashAccount('cash',0),traditionalAccount('ira',265000)]
    plan.strategies.qcdAnnual = 6500
    plan.strategies.retirementActions = [persistedRetirementActionRequestSchema.parse({ actionId:'prior-qcd',kind:'qcd',year:2025,executionDate:'2025-08-01',
      executionSequence:1,requestedAmount:600000,provenance:{source:'manual'},donorPersonId:'p1',
      allocation:{allocationId:'prior-allocation',sourceAccountId:'ira',requestedAmount:600000},
      charity:{designationId:'charity',name:'Public charity',designationKind:'eligiblePublicCharity',
        directFromCustodianAttested:true,eligibleOrganizationAttested:true,
        notDonorAdvisedFundOrSupportingOrganizationAttested:true,notSplitInterestEntityAttested:true,
        entireDistributionOtherwiseDeductibleAttested:true} })]
    plan.retirementActionEligibilityFacts = retirementActionEligibilityFactsSchema.parse({iraClassifications:[{sourceAccountId:'ira',subtype:'traditional',
      evidenceId:'classification',provenance:{source:'manual'}}],sepSimpleActivities:[],
      deductibleIraContributions:[{donorPersonId:'p1',taxYear:2025,amountCents:300000,
        evidenceId:'section219',provenance:{source:'manual'}}]})
    check(plan,6500,6500)
  })
})
