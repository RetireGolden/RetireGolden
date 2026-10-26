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
