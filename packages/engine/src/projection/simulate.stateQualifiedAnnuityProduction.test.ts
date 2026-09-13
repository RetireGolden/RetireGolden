import { expect, it } from 'vitest'
import type { Account } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { simulatePlan } from './simulate.js'

function employer401kFunding(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'traditional' }> {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    employerPlanType: '401k',
    balance,
    annualContribution: 0,
  }
}

function employerFundingWithoutSubtype(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'traditional' }> {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance,
    annualContribution: 0,
  }
}

it('retains Kentucky retirement exclusion for actual qualified annuity payments with capture off', () => {
  // KRS 141.010 pension/retirement exclusion: $12,000 zero-basis IRA-annuity
  // income is below the $31,110 exclusion. The source fact must reach actual
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

it('preserves qualified annuity gross while carrying the accepted Form 8606 basis return', () => {
  // IRC 408(d)(2) annual owner pool: $60,000 basis / ($188,000 year-end IRA+
  // contract value + $12,000 distribution) = 30%; $12,000 payment returns $3,600 basis.
  const plan = singlePersonPlan({ dob: '1960-01-02', planningAge: 90, state: 'KY' })
  plan.accounts = [{ ...traditionalAccount('ira', 200000, 'p1', 'ira'), nondeductibleBasis: 60000 }, {
    type: 'annuity', id: 'annuity', name: 'Qualified annuity', ownerPersonId: 'p1', annualReturnPct: 0,
    startAge: 67, monthlyAmount: 1000, colaPct: 0, taxablePct: 100,
    purchase: { year: 2026, premium: 100000, fundingAccountId: 'ira', taxQualification: 'qualified' },
  }] as Account[]
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2027,
    taxCalculator: createStateTaxCalculator() })
  const input = result.years.find((row) => row.year === 2027)!.acceptedTaxInput!
  expect(input.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', grossDistribution: 12000, federallyIncludedAmount: 8400,
  }))
  expect(input.ordinaryIncome).toBeCloseTo(8400, 6)
})

it('applies Arkansas IRA age gate only to IRA-funded qualified annuities at age 55', () => {
  // A.C.A. §26-51-307(a): employer-plan distributions share the $6,000
  // ordinary exclusion with no IRA age gate; the IRA path requires age 59½
  // (stateArkansasRetirement.ts). Age-55 recipient (DOB 1971-01-02).
  const run = (funding: Account) => {
    const plan = singlePersonPlan({ dob: '1971-01-02', planningAge: 90, state: 'AR' })
    plan.accounts = [funding, {
      type: 'annuity', id: 'annuity', name: 'Qualified annuity', ownerPersonId: 'p1',
      annualReturnPct: 0, startAge: 55, monthlyAmount: 1000, colaPct: 0, taxablePct: 100,
      purchase: { year: 2026, premium: 100000, fundingAccountId: funding.id, taxQualification: 'qualified' },
    } as Account]
    return simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
      taxCalculator: createStateTaxCalculator() }).years[0]!
  }
  const iraFunded = run(traditionalAccount('ira', 200000, 'p1', 'ira'))
  const employerFunded = run(employer401kFunding('401k', 200000, 'p1'))
  expect(iraFunded.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', sourceKind: 'ira', grossDistribution: 12000, recipientAgeYears: 55,
  }))
  expect(employerFunded.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', sourceKind: 'employerPlan', qualifiedPlanType: '401k',
    grossDistribution: 12000, recipientAgeYears: 55,
  }))
  expect(iraFunded.taxComputation?.status).toBe('incomplete')
  expect(employerFunded.taxComputation?.status).toBe('complete')
})

it('proves Delaware Jan-1 age clearance for qualified annuity and withholds crossing-year control', () => {
  // Delaware Code tit. 30 §1106(b)(3): qualifying retirement income is
  // excluded up to the age-60 cap; the early-distribution gate must be known.
  const run = (dob: string, startAge: number) => {
    const plan = singlePersonPlan({ dob, planningAge: 90, state: 'DE' })
    plan.accounts = [employer401kFunding('employer', 200_000), {
      type: 'annuity', id: 'annuity', name: 'Qualified annuity', ownerPersonId: 'p1',
      annualReturnPct: 0, startAge, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'employer', taxQualification: 'qualified' },
    } as Account]
    return simulatePlan(validatePlan(plan), {
      startYear: 2026, horizonEndYear: 2026,
      taxCalculator: createStateTaxCalculator(),
    }).years[0]!
  }
  const known = run('1966-01-01', 60)
  const crossing = run('1967-01-01', 59)
  expect(known.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', sourceKind: 'employerPlan', qualifiedPlanType: '401k', minimumAgeAtDistributionYears: 60,
    earlyDistributionDisqualifier: 'false', grossDistribution: 12_000,
  }))
  expect(known.taxComputation?.status).toBe('complete')
  expect(crossing.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', sourceKind: 'employerPlan', qualifiedPlanType: '401k', minimumAgeAtDistributionYears: 59,
    earlyDistributionDisqualifier: 'unknown', grossDistribution: 12_000,
  }))
  expect(crossing.taxComputation?.status).toBe('incomplete')
})

it('keeps an omitted employer-plan subtype as employer source in a validated plan', () => {
  const plan = singlePersonPlan({ dob: '1971-01-02', planningAge: 90, state: 'AR' })
  plan.accounts = [employerFundingWithoutSubtype('employer', 200_000), {
    type: 'annuity', id: 'annuity', name: 'Qualified annuity', ownerPersonId: 'p1',
    annualReturnPct: 0, startAge: 55, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
    purchase: { year: 2026, premium: 100_000, fundingAccountId: 'employer', taxQualification: 'qualified' },
  } as Account]
  const year = simulatePlan(validatePlan(plan), {
    startYear: 2026, horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator(),
  }).years[0]!
  expect(year.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'annuity', sourceKind: 'employerPlan', accountTaxTreatment: 'traditional',
    grossDistribution: 12_000,
  }))
  const fact = year.acceptedTaxInput?.stateRetirementDistributions?.find((row) => row.accountId === 'annuity')
  expect(fact).not.toHaveProperty('qualifiedPlanType')
  expect(year.taxComputation?.status).toBe('complete')
})
