import { californiaHsaAccountAdjustment } from '../tax/stateQcdHsa.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import type { Account } from '../model/plan.js'
import { describe, expect, it } from 'vitest'
import { couplePlan, singlePersonPlan, traditionalAccount, cashAccount, validatePlan, recurringOrdinaryIncome, socialSecurityIncome } from '../testing/planFixtures.js'
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
      transactionKind: 'directQcd',
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

it('withholds an evidence-only QCD and names the custodian row', () => {
  // IRC 408(d)(8)(A). The projection executed no QCD. The custodian row is
  // not priced as one, and the year is not a complete empty collection.
  const plan = singlePersonPlan({ dob: '1952-01-01', planningAge: 80, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.stateTaxFacts.qcdEventEvidence = [{
    eventId: 'custodian-2026-qcd', taxYear: 2026, accountId: 'ira', ownerPersonId: 'p1',
    transactionKind: 'directQcd', grossIraDistribution: 10_000, directCharityTransfer: 10_000,
    federalExcludedAmount: 10_000, federalTaxableAmount: 0, federalBasisAllocated: 0,
    residency: 'fullYearResident', directTransfer: true,
    provenance: { source: 'IRA custodian 1099-R', asOf: '2026-12-31' },
  }]
  const inputs: TaxYearInput[] = []
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(input); return 0 } },
  })
  expect(inputs.at(-1)?.stateQcdEventFacts).toBeUndefined()
  expect(result.warnings).toContain(
    'Custodian QCD evidence custodian-2026-qcd on account ira for 2026 has no executed distribution, so this year\'s state QCD collection is incomplete.',
  )
})

it('names a repeated custodian QCD identity when the collection is withheld', () => {
  const plan = singlePersonPlan({ dob: '1952-01-01', planningAge: 80, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  const row = {
    eventId: 'custodian-2026-qcd', taxYear: 2026, accountId: 'ira', ownerPersonId: 'p1',
    transactionKind: 'directQcd' as const, grossIraDistribution: 10_000, directCharityTransfer: 10_000,
    federalExcludedAmount: 10_000, federalTaxableAmount: 0, federalBasisAllocated: 0,
    residency: 'fullYearResident' as const, directTransfer: true,
    provenance: { source: 'IRA custodian 1099-R', asOf: '2026-12-31' },
  }
  plan.stateTaxFacts.qcdEventEvidence = [row, { ...row, grossIraDistribution: 4_000, directCharityTransfer: 4_000, federalExcludedAmount: 4_000 }]
  const inputs: TaxYearInput[] = []
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(input); return 0 } },
  })
  expect(inputs.at(-1)?.stateQcdEventFacts).toBeUndefined()
  expect(result.warnings).toContain(
    'Custodian QCD evidence custodian-2026-qcd on account ira for 2026 is repeated, so this year\'s state QCD collection is incomplete.',
  )
})

it('reaches the QCD completeness branch when the plan marks the year unknown', () => {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'NJ', qcd: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const inputs: TaxYearInput[] = []
  simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(input); return 0 } },
  })
  expect(inputs.at(-1)?.stateQcdEventFacts).toBeUndefined()
})

it('withholds the state QCD collection when a QCD was executed but the year is unknown', () => {
  const plan = singlePersonPlan({ dob: '1956-03-01', planningAge: 90, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 500000, 'p1', 'ira')]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.strategies.qcdAnnual = 10000
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'NJ', qcd: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const inputs: TaxYearInput[] = []
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(structuredClone(input)); return 0 } },
  })
  expect(result.years[0]!.qcd).toBe(10000)
  expect(inputs.at(-1)?.stateQcdEventFacts).toBeUndefined()
})

it('keeps a NJ QCD-unknown mark after a mid-year move to CA', () => {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.household.stateMoves = [{ fromYear: 2026, fromMonth: 7, state: 'CA' }]
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'NJ', qcd: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const inputs: TaxYearInput[] = []
  simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(input); return 0 } },
  })
  expect(inputs.at(-1)?.stateQcdEventFacts).toBeUndefined()
  expect(Object.prototype.hasOwnProperty.call(inputs.at(-1), 'stateQcdEventFacts')).toBe(true)
})

it('does not let a calculator-level QCD list fill a year the plan marked unknown', () => {
  // The configured event is a split-interest transfer. If the unknown year
  // fell back to it, the leaf would refuse that transfer instead of reporting
  // the collection unavailable. IRC 408(d)(8)(F).
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'CA' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'CA', qcd: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator({
      qcdEvents: [{
        eventId: 'configured', accountId: 'ira', ownerPersonId: 'p1',
        grossIraDistribution: 10_000, directCharityTransfer: 10_000,
        federalExcludedAmount: 10_000, federalTaxableAmount: 0, federalBasisAllocated: 0,
        residency: 'fullYearResident', splitInterest: true, directTransfer: true,
        transactionKind: 'splitInterest',
      }],
    }),
  })
  const codes = result.years[0]!.taxComputation?.issues.map((issue) => issue.code) ?? []
  expect(codes).toContain('state-qcd-annual-activity-unavailable')
  expect(codes).not.toContain('state-qcd-split-interest-refused')
})

it('does not let calculator-level legacy QCD facts fill a year the plan marked unknown', () => {
  // The configured fact is a split-interest transfer, as above, through the
  // legacy singular qcdFacts route. A withheld year reports the collection
  // unavailable and never prices or refuses that fact. IRC 408(d)(8)(F).
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'CA' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'CA', qcd: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator({
      qcdFacts: {
        ownerPersonId: 'p1', grossIraDistribution: 10_000, directCharityTransfer: 10_000,
        federalExcludedAmount: 10_000, federalTaxableAmount: 0, federalBasisAllocated: 0,
        stateBasisFactsKnown: true, stateBasisRecovery: 0, residency: 'fullYearResident',
        policy: { kind: 'conforms', citation: 'caller-should-be-ignored' }, splitInterest: true,
      },
    }),
  })
  const codes = result.years[0]!.taxComputation?.issues.map((issue) => issue.code) ?? []
  expect(codes).toContain('state-qcd-annual-activity-unavailable')
  expect(codes).not.toContain('state-qcd-split-interest-refused')
})

it('keeps a withheld QCD year incomplete in a state pack without a QCD policy', () => {
  // NC's pack states no direct-QCD policy. The QCD was executed but the year's
  // QCD evidence is explicitly unknown, so the collection is withheld and the
  // state result cannot be complete.
  const plan = singlePersonPlan({ dob: '1956-03-01', planningAge: 90, state: 'NC' })
  plan.accounts = [traditionalAccount('ira', 500000, 'p1', 'ira')]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.strategies.qcdAnnual = 10000
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'NC', qcd: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator(),
  })
  expect(result.years[0]!.qcd).toBe(10000)
  const codes = result.years[0]!.taxComputation?.issues.map((issue) => issue.code) ?? []
  expect(codes).toContain('state-qcd-annual-activity-unavailable')
})

it('keeps an asserted CA HSA deduction when candidate scoring supplies only zero defaults', () => {
  // Same Schedule CA worksheet as the adapter fixture: asserted federal HSA
  // deduction $4,300, every other category an explicit known zero, addition
  // $4,300. annualContribution is 0, so the candidate row's federal deduction
  // is the `?? 0` default (issue #803), not a modeled contribution.
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'CA' })
  plan.accounts = [{
    type: 'hsa',
    id: 'hsa1',
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 1_000,
    annualContribution: 0,
  }]
  plan.stateTaxFacts.hsaYearEvidence = [{
    taxYear: 2026,
    state: 'CA',
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 4_300,
    employerContributionExcludedFederally: 0,
    employerContributionAlreadyInStateWages: 0,
    interest: 0,
    dividends: 0,
    realizedGains: 0,
    unrealizedAppreciation: 0,
    qualifiedCashWithdrawals: 0,
    nonqualifiedDistributionFederalAmount: 0,
    stateBasisBeforeYear: 0,
    annualActivityComplete: true,
    provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
  }]
  const inputs: TaxYearInput[] = []
  simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(structuredClone(input)); return 0 } },
  })
  const scored = inputs.filter((input) => input.stateHsaAccountYearFacts !== undefined)
  expect(scored.length).toBeGreaterThan(0)
  for (const input of scored) {
    const fact = input.stateHsaAccountYearFacts?.[0]
    expect(fact?.federalHsaDeduction).toEqual({ known: true, amount: 4_300 })
    expect(fact?.annualActivityComplete).toBe(true)
    const addition = californiaHsaAccountAdjustment(fact!)
    expect(addition.warnings).toEqual([])
    expect(addition.taxableIncomeDelta).toBe(4_300)
  }
})

it('withholds the CA HSA collection for a year the plan marks hsa unknown, even with a complete asserted row', () => {
  // state-hsa-evidence-runtime-merge-and-completeness. The asserted row alone
  // would give a Schedule CA addition of $4,300 (deduction 4,300, every other
  // category a known zero), but the plan says the year's HSA activity is not
  // known, so no scored input carries a collection and the California leaf
  // reports the activity unavailable instead of pricing $4,300 as the year.
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, state: 'CA' })
  plan.accounts = [{
    type: 'hsa', id: 'hsa1', name: 'HSA', ownerPersonId: 'p1',
    annualReturnPct: null, balance: 1_000, annualContribution: 0,
  }]
  plan.stateTaxFacts.hsaYearEvidence = [{
    taxYear: 2026, state: 'CA', accountId: 'hsa1', ownerPersonId: 'p1',
    federalHsaDeduction: 4_300, employerContributionExcludedFederally: 0,
    employerContributionAlreadyInStateWages: 0, interest: 0, dividends: 0,
    realizedGains: 0, unrealizedAppreciation: 0, qualifiedCashWithdrawals: 0,
    nonqualifiedDistributionFederalAmount: 0, stateBasisBeforeYear: 0,
    annualActivityComplete: true,
    provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
  }]
  plan.stateTaxFacts.annualEvidenceCompleteness = [{
    taxYear: 2026, state: 'CA', hsa: 'unknown',
    provenance: { source: 'taxpayer', asOf: '2026-12-31' },
  }]
  const inputs: TaxYearInput[] = []
  simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: { compute(input) { inputs.push(structuredClone(input)); return 0 } },
  })
  expect(inputs.length).toBeGreaterThan(0)
  expect(inputs.every((input) => input.stateHsaAccountYearFacts === undefined)).toBe(true)
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator(),
  })
  const codes = result.years[0]!.taxComputation?.issues.map((issue) => issue.code) ?? []
  expect(codes).toContain('ca-hsa-activity-unavailable')
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


it('detects a projected 2027 New Jersey QCD and leaves unknown basis unpriced', () => {
  // Opening IRA 200,000, QCD 10,000, no basis evidence. The transfer is seen
  // and is not added to New Jersey income.
  const plan = singlePersonPlan({ dob: '1956-03-01', planningAge: 90, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 200_000, 'p1', 'ira'), cashAccount('cash', 50_000)]
  plan.incomes = [{ type: 'wages', id: 'wages', personId: 'p1', annualGross: 200_000, endAge: null, realGrowthPct: 0 }]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.expenses.baseAnnual = 0
  plan.strategies.qcdAnnual = 10_000
  const priced = simulatePlan(validatePlan(plan), {
    startYear: 2027, horizonEndYear: 2027,
    taxCalculator: createStateTaxCalculator({}),
  }).years[0]!
  expect(priced.acceptedTaxInput?.stateQcdEventFacts?.some((event) => event.grossIraDistribution === 10_000)).toBe(true)
  expect(priced.acceptedTaxInput?.stateNjIraOwnerPools).toBeUndefined()
  expect(priced.balances.ira).toBeCloseTo(190_000, 6)
  const tax = priced.taxComputation as unknown as { taxableIncome: number; status: string; issues: { code: string }[] }
  expect(tax.status).toBe('incomplete')
  expect(tax.issues.map((issue) => issue.code)).toContain('nj-qcd-basis-unknown')
  plan.strategies.qcdAnnual = 0
  const baseline = simulatePlan(validatePlan(plan), {
    startYear: 2027, horizonEndYear: 2027,
    taxCalculator: createStateTaxCalculator({}),
  }).years[0]!.taxComputation as unknown as { taxableIncome: number }
  expect(tax.taxableIncome).toBe(baseline.taxableIncome)
})

it('keeps a second projected New Jersey QCD year incomplete instead of assuming basis', () => {
  const plan = singlePersonPlan({ dob: '1956-03-01', planningAge: 90, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 200_000, 'p1', 'ira'), cashAccount('cash', 50_000)]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.expenses.baseAnnual = 0
  plan.strategies.qcdAnnual = 10_000
  const years = simulatePlan(validatePlan(plan), {
    startYear: 2027, horizonEndYear: 2028,
    taxCalculator: createStateTaxCalculator({}),
  }).years
  for (const year of years) {
    expect(year.acceptedTaxInput?.stateQcdEventFacts?.some((event) => event.grossIraDistribution === 10_000)).toBe(true)
    expect(year.acceptedTaxInput?.stateNjIraOwnerPools).toBeUndefined()
    expect(year.taxComputation?.status).toBe('incomplete')
    expect(year.taxComputation?.issues.map((issue) => issue.code)).toContain('nj-qcd-basis-unknown')
  }
})

it('does not let a projected year replace later evidenced New Jersey basis', () => {
  const plan = singlePersonPlan({ dob: '1956-03-01', planningAge: 90, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 200_000, 'p1', 'ira'), cashAccount('cash', 50_000)]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.expenses.baseAnnual = 0
  plan.strategies.qcdAnnual = 10_000
  plan.stateTaxFacts.iraBasisYearEvidence = [{
    taxYear: 2028, ownerPersonId: 'p1', state: 'NJ', accountId: 'ira', unrecoveredStateBasis: 50_000,
    annualDistributionsComplete: true, yearEndAccountValue: 180_000, distributionsDuringYear: 10_000,
    postYearContributionsThroughFilingDeadline: 0,
    provenance: { source: '2025 NJ-1040 Worksheet C', asOf: '2028-12-31' },
  }]
  const second = simulatePlan(validatePlan(plan), {
    startYear: 2027, horizonEndYear: 2028,
    taxCalculator: createStateTaxCalculator({}),
  }).years[1]!
  expect(second.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 50_000 })
})

it('carries lowercase nj basis evidence into the next year', () => {
  const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 80, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 1000, 'p1', 'ira')]
  plan.expenses.baseAnnual = 100
  plan.stateTaxFacts.iraBasisYearEvidence = [2026, 2027].map((taxYear) => ({
    taxYear, ownerPersonId: 'p1', state: 'nj', accountId: 'ira', unrecoveredStateBasis: 100,
    annualDistributionsComplete: true, yearEndAccountValue: taxYear === 2026 ? 900 : 800,
    distributionsDuringYear: 100, postYearContributionsThroughFilingDeadline: 0,
    provenance: { source: 'NJ Worksheet C annual account statement', asOf: `${taxYear}-12-31` },
  }))
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026, horizonEndYear: 2027, taxCalculator: createStateTaxCalculator({}),
  })
  expect(result.years[0]!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 100, basisConsumed: 10, closingBasis: 90 })
  expect(result.years[1]!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 90, basisConsumed: 10, closingBasis: 80 })
})

describe('projected New Jersey Worksheet C pool from the ledger and the Part II carry (#810 Case B, #818)', () => {
  // GIT-1 & 2 (January 2026) and the 2025 NJ-1040 Worksheet C:
  //   line 1 December 31 value, line 2 all distributions during the year,
  //   line 3 = 1 + 2, line 4b unrecovered contributions, line 5 = 3 - 4b,
  //   line 6 = 5 / 3, line 7 taxable = 2 x 6, line 8 excludable = 2 - 7.
  //   Part II: next year's line 4b = this year's 4b - line 8.
  const njBasisEvidence = (taxYear: number, unrecoveredStateBasis: number, yearEndAccountValue: number) => ({
    taxYear, ownerPersonId: 'p1', state: 'NJ', accountId: 'ira', unrecoveredStateBasis,
    annualDistributionsComplete: true, yearEndAccountValue, distributionsDuringYear: 0,
    postYearContributionsThroughFilingDeadline: 0,
    provenance: { source: 'NJ-1040 Worksheet C as filed', asOf: `${taxYear}-12-31` },
  })
  function njQcdPlan(qcdAnnual: number, iraAnnualReturnPct = 0) {
    // Born 1956-09-01: 70 1/2 on 2027-03-01 (IRC 408(d)(8)(B)(ii)), so no
    // 2026 QCD. RMDs start at 73 in 2029, so the QCD is the IRA's only
    // distribution in 2027 and 2028. NJ wages above $150,000 rule out the
    // NJ-1040 line 28a pension exclusion.
    const plan = singlePersonPlan({ dob: '1956-09-01', planningAge: 90, state: 'NJ' })
    plan.accounts = [{ ...traditionalAccount('ira', 200_000, 'p1', 'ira'), annualReturnPct: iraAnnualReturnPct }, cashAccount('cash', 50_000)]
    plan.incomes = [{ type: 'wages', id: 'wages', personId: 'p1', annualGross: 200_000, endAge: null, realGrowthPct: 0 }]
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.inflationPct = 0
    plan.expenses.baseAnnual = 0
    plan.strategies.qcdAnnual = qcdAnnual
    return plan
  }
  type StateComputation = { taxableIncome: number; status: string; issues: { code: string }[] }
  const run = (plan: ReturnType<typeof njQcdPlan>, startYear: number, horizonEndYear: number) =>
    simulatePlan(validatePlan(plan), { startYear, horizonEndYear, taxCalculator: createStateTaxCalculator({}) }).years

  it('prices a projected QCD from 2026 evidence carried through Part II: $7,500 of $10,000, then $7,500 again', () => {
    // 2026 evidence: line 4b 50,000, no 2026 distributions, so line 8 is 0
    // and 50,000 carries into 2027.
    // 2027: line 1 190,000 (200,000 less the 10,000 QCD, 0% return),
    //   line 2 10,000, line 3 200,000, line 5 150,000, line 6 0.75,
    //   line 7 7,500 taxable, line 8 2,500, so 47,500 carries into 2028.
    // 2028: line 1 180,000, line 2 10,000, line 3 190,000, line 5 142,500,
    //   line 6 0.75, line 7 7,500, line 8 2,500, leaving 45,000.
    // Without the 2027 recovery 2028 would be 10,000 x 140,000/190,000 =
    // 7,368.42; at a zero basis each year would tax 10,000.
    const plan = njQcdPlan(10_000)
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const years = run(plan, 2026, 2028)
    const baselinePlan = njQcdPlan(0)
    baselinePlan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const baseline = run(baselinePlan, 2026, 2028)
    expect(years[0]!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 50_000, basisConsumed: 0, closingBasis: 50_000 })
    for (const [index, line1, opening] of [[1, 190_000, 50_000], [2, 180_000, 47_500]] as const) {
      const year = years[index]!
      expect(year.acceptedTaxInput?.stateNjIraOwnerPools?.[0]).toMatchObject({
        december31IraValue: line1, allAnnualDistributions: 10_000,
        unrecoveredNjTaxedContributions: { known: true, amount: opening },
      })
      expect(year.balances.ira).toBeCloseTo(line1, 6)
      const tax = year.taxComputation as unknown as StateComputation
      expect(tax.status).toBe('complete')
      expect(tax.issues.map((issue) => issue.code)).not.toContain('nj-qcd-basis-unknown')
      const base = baseline[index]!.taxComputation as unknown as StateComputation
      expect(tax.taxableIncome - base.taxableIncome).toBeCloseTo(7_500, 6)
      expect(year.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: opening })
      expect(year.taxComputation?.njIraBasisPools?.[0]?.basisConsumed).toBeCloseTo(2_500, 6)
    }
    expect(years[2]!.taxComputation?.njIraBasisPools?.[0]?.closingBasis).toBeCloseTo(45_000, 6)
  })

  it('fills line 1 with the December 31 value after the year return: 202,000 and $7,641.51 taxable', () => {
    // #818. The projection starts in 2027; the filed 2026 Worksheet C opens
    // the carry at 50,000 (no 2026 distributions). The ledger debits the
    // 10,000 QCD and grows the 190,000 left by 120/19 % = 12,000.
    // Line 1 = 200,000 + 12,000 - 10,000 = 202,000; line 3 212,000;
    // line 5 162,000; line 7 = 10,000 x 162,000 / 212,000 = 7,641.509434.
    // The pre-return 190,000 would give 7,500.00.
    const plan = njQcdPlan(10_000, 120 / 19)
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const [year] = run(plan, 2027, 2027)
    const baselinePlan = njQcdPlan(0, 120 / 19)
    baselinePlan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const [baseline] = run(baselinePlan, 2027, 2027)
    expect(year!.balances.ira).toBeCloseTo(202_000, 6)
    const pool = year!.acceptedTaxInput?.stateNjIraOwnerPools?.[0]
    expect(pool?.december31IraValue).toBeCloseTo(202_000, 6)
    expect(pool).toMatchObject({ allAnnualDistributions: 10_000, unrecoveredNjTaxedContributions: { known: true, amount: 50_000 } })
    const tax = year!.taxComputation as unknown as StateComputation
    expect(tax.status).toBe('complete')
    const base = baseline!.taxComputation as unknown as StateComputation
    expect(tax.taxableIncome - base.taxableIncome).toBeCloseTo(7_641.51, 2)
    expect(year!.taxComputation?.njIraBasisPools?.[0]?.closingBasis).toBeCloseTo(50_000 - 2_358.490566, 5)
  })

  it('fills line 1 from a class-allocated IRA with per-class shocks: 206,150 and $7,686.79 taxable (#839 r1-9)', () => {
    // A 50/50 usStocks/bonds IRA with the default class returns (usStocks 7%,
    // bonds 4%) and 2027 class shocks of +10 and -4 grows by
    // 0.5 x (7 + 10) + 0.5 x (4 - 4) = 8.5%. The 190,000 left after the
    // 10,000 QCD grows to 190,000 x 1.085 = 206,150 = line 1.
    // Line 3 216,150; line 5 = 216,150 - 50,000 = 166,150;
    // line 7 = 10,000 x 166,150 / 216,150 = 7,686.79; line 8 = 2,313.21,
    // so 47,686.79 carries. The pre-return 190,000 would give 7,500.00, and
    // an unshocked 5.5% blend (line 1 200,450) 7,624.14.
    const market = { classReturnShockPct: { usStocks: [10], bonds: [-4] } }
    const build = (qcdAnnual: number) => {
      const plan = njQcdPlan(qcdAnnual)
      plan.accounts = [Object.assign(traditionalAccount('ira', 200_000, 'p1', 'ira'), {
        allocation: { mode: 'static' as const, rebalancing: 'annual' as const, weights: { usStocks: 50, intlStocks: 0, bonds: 50, cash: 0 } },
      }), cashAccount('cash', 50_000)]
      plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
      return validatePlan(plan)
    }
    const options = { startYear: 2027, horizonEndYear: 2027, taxCalculator: createStateTaxCalculator({}), market }
    const [year] = simulatePlan(build(10_000), options).years
    const [baseline] = simulatePlan(build(0), options).years
    expect(year!.balances.ira).toBeCloseTo(206_150, 6)
    const pool = year!.acceptedTaxInput?.stateNjIraOwnerPools?.[0]
    expect(pool?.december31IraValue).toBeCloseTo(206_150, 6)
    expect(pool).toMatchObject({ allAnnualDistributions: 10_000, unrecoveredNjTaxedContributions: { known: true, amount: 50_000 } })
    const tax = year!.taxComputation as unknown as StateComputation
    expect(tax.status).toBe('complete')
    const base = baseline!.taxComputation as unknown as StateComputation
    expect(tax.taxableIncome - base.taxableIncome).toBeCloseTo(7_686.79, 2)
    expect(year!.taxComputation?.njIraBasisPools?.[0]?.closingBasis).toBeCloseTo(47_686.79, 2)
  })

  it('keeps the carry known for one IRA held as two physical rows (#839 r1-3)', () => {
    // Two compatible rows of one IRA (80,000 and 120,000) and no
    // contributions: each row's contribution delta is 0, so line 4b is the
    // 50,000 carried. Keyed by account id, the first row read 80,000 - 120,000
    // = -40,000 and the carry turned unknown.
    const plan = njQcdPlan(10_000)
    plan.accounts = [traditionalAccount('ira', 80_000, 'p1', 'ira'), traditionalAccount('ira', 120_000, 'p1', 'ira'), cashAccount('cash', 50_000)]
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const [year] = run(plan, 2027, 2027)
    const pool = year!.acceptedTaxInput?.stateNjIraOwnerPools?.[0]
    expect(pool).toMatchObject({ december31IraValue: 190_000, allAnnualDistributions: 10_000,
      unrecoveredNjTaxedContributions: { known: true, amount: 50_000 } })
    expect(year!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 50_000 })
  })

  it('does not price a projected pool whose owner holds an IRA-funded annuity contract (#839 r1-2)', () => {
    // A qualified contract bought from the IRA stays in the owner's IRA
    // aggregate, but its value is on no ledger row. No New Jersey authority
    // found values it for Worksheet C line 1, so the year is not priced.
    const plan = njQcdPlan(10_000)
    plan.accounts = [...plan.accounts, {
      type: 'annuity', id: 'q', name: 'Qualified annuity', ownerPersonId: 'p1', annualReturnPct: null,
      startAge: 72, monthlyAmount: 300, colaPct: 0, taxablePct: 100,
      purchase: { year: 2027, premium: 50_000, fundingAccountId: 'ira', taxQualification: 'qualified' },
    }]
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const [year] = run(plan, 2027, 2027)
    expect(year!.acceptedTaxInput?.stateNjIraOwnerPools?.[0]?.unvaluedIraAnnuityContract).toBe(true)
    expect(year!.taxComputation?.status).toBe('incomplete')
    expect(year!.taxComputation?.issues.map((issue) => issue.code)).toContain('nj-ira-annuity-contract-unvalued')
    expect(year!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'incomplete' })
  })

  it('keeps line 1 plus line 2 at the opening balance when spending also draws the IRA', () => {
    // A need-based draw W solved inside the funding fixed point leaves line 1
    // and joins line 2, so at a 0% return line 3 stays 200,000 and the QCD's
    // taxable share stays 10,000 x 150,000 / 200,000 = 7,500 whatever W is.
    // Line 8 for the year is (10,000 + W) x 50,000 / 200,000.
    const plan = njQcdPlan(10_000)
    plan.accounts = [traditionalAccount('ira', 200_000, 'p1', 'ira')]
    plan.incomes = []
    plan.expenses.baseAnnual = 20_000
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    const [year] = run(plan, 2027, 2027)
    const pool = year!.acceptedTaxInput?.stateNjIraOwnerPools?.[0]
    expect(pool?.allAnnualDistributions).toBeGreaterThan(10_000 + 20_000 - 0.01)
    expect(pool!.december31IraValue + pool!.allAnnualDistributions).toBeCloseTo(200_000, 6)
    expect(year!.balances.ira).toBeCloseTo(pool!.december31IraValue, 6)
    expect(year!.taxComputation?.issues.map((issue) => issue.code)).not.toContain('nj-ira-projected-year-end-mismatch')
    expect(year!.taxComputation?.issues.map((issue) => issue.code)).not.toContain('nj-qcd-basis-unknown')
    expect(year!.taxComputation?.njIraBasisPools?.[0]).toMatchObject({ status: 'complete', openingBasis: 50_000 })
    expect(year!.taxComputation?.njIraBasisPools?.[0]?.basisConsumed).toBeCloseTo(pool!.allAnnualDistributions * 0.25, 6)
  })

  it('does not carry basis across a year with no Worksheet C', () => {
    // Evidence for 2025 only; the projection starts in 2027. 2026's
    // distributions and recovery are unknown, so 2027 has no line 4b.
    const plan = njQcdPlan(10_000)
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2025, 50_000, 200_000)]
    const [year] = run(plan, 2027, 2027)
    expect(year!.acceptedTaxInput?.stateNjIraOwnerPools).toBeUndefined()
    expect(year!.taxComputation?.status).toBe('incomplete')
    expect(year!.taxComputation?.issues.map((issue) => issue.code)).toContain('nj-qcd-basis-unknown')
  })

  it('keeps a year marked iraBasis unknown incomplete even with a carry', () => {
    const plan = njQcdPlan(10_000)
    plan.stateTaxFacts.iraBasisYearEvidence = [njBasisEvidence(2026, 50_000, 200_000)]
    plan.stateTaxFacts.annualEvidenceCompleteness = [{ taxYear: 2027, state: 'NJ', iraBasis: 'unknown',
      provenance: { source: 'NJ-1040 Worksheet C not prepared', asOf: '2027-12-31' } }]
    const [year] = run(plan, 2027, 2027)
    expect(year!.acceptedTaxInput?.stateNjIraOwnerPools).toBeUndefined()
    expect(year!.taxComputation?.issues.map((issue) => issue.code)).toContain('nj-qcd-basis-unknown')
  })
})

it('leaves a projected New Jersey QCD incomplete when spending also draws the IRA', () => {
  const plan = singlePersonPlan({ dob: '1956-03-01', planningAge: 90, state: 'NJ' })
  plan.accounts = [traditionalAccount('ira', 200_000, 'p1', 'ira')]
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.inflationPct = 0
  plan.expenses.baseAnnual = 20_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.strategies.qcdAnnual = 10_000
  const year = simulatePlan(validatePlan(plan), {
    startYear: 2027, horizonEndYear: 2027, taxCalculator: createStateTaxCalculator({}),
  }).years[0]!
  expect(year.acceptedTaxInput?.stateQcdEventFacts?.some((event) => event.grossIraDistribution === 10_000)).toBe(true)
  expect(year.acceptedTaxInput?.stateNjIraOwnerPools).toBeUndefined()
  expect(year.taxComputation?.status).toBe('incomplete')
  expect(year.taxComputation?.issues.map((issue) => issue.code)).toContain('nj-qcd-basis-unknown')
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


it('derives Utah included Social Security and the 59-10-114 additions the plan holds, keeping a stored assertion', () => {
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
  // With no stored row the plan holds no 59-10-114(1) addition (its
  // tax-exempt interest is counted once, as excluded interest): 0, the same
  // credit, and a complete year.
  plan.stateTaxFacts.householdYearFacts = []
  const derived = simulatePlan(validatePlan(plan),{startYear:2026,horizonEndYear:2026,taxCalculator:calc}).years[0]!
  expect(derived.acceptedTaxInput?.stateHouseholdFacts?.utahSection59_10_114Additions).toBe(0)
  expect(derived.tax).toBeCloseTo(1335,6)
  expect(derived.taxComputation?.status).toBe('complete')
  // A stored 30,000 addition raises MAGI to 65,350: the phase-out of
  // 2.5% x 11,350 = 283.75 exceeds the 238.075 credit, so no credit and
  // 35,350 x 4.45% = 1,573.075.
  plan.stateTaxFacts.householdYearFacts = [{year:2026,utahSection59_10_114Additions:30000}]
  const stored = simulatePlan(validatePlan(plan),{startYear:2026,horizonEndYear:2026,taxCalculator:calc}).years[0]!
  expect(stored.acceptedTaxInput?.stateHouseholdFacts?.utahSection59_10_114Additions).toBe(30000)
  expect(stored.tax).toBeCloseTo(1573.075,6)
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
