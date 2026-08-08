import { describe, expect, it } from 'vitest'

import { asUsdCents } from '../actions/money.js'
import {
  createEmptyPlan,
  parsePlan,
  stateForYear,
  stateResidencySegmentsForYear,
  type InheritedAccount,
  type Plan,
} from './plan.js'
import {
  ownedNonRothIraAnnualFilingSourceRecord,
  setAcaYearContract,
  traditionalAccount,
} from '../testing/planFixtures.js'

let counter = 0
const testIds = () => `id-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function validCouplePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'KY',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      {
        id: 'p1',
        name: 'Pat',
        dob: '1962-03-15',
        sex: 'female',
        retirementAge: 65,
        longevity: { planningAge: 94, source: 'model' },
      },
      {
        id: 'p2',
        name: 'Sam',
        dob: '1960-11-02',
        sex: 'male',
        retirementAge: 67,
        longevity: { planningAge: 90, source: 'manual' },
      },
    ],
  }
  plan.accounts = [
    {
      type: 'taxable',
      id: 'a1',
      name: 'Brokerage',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 400_000,
      costBasis: 250_000,
      interestYieldPct: 0,
      dividendYieldPct: 0,
      qualifiedRatio: 0.85,
      reinvestDividends: true,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: 'a2',
      name: '401(k)',
      ownerPersonId: 'p1',
      annualReturnPct: 6,
      kind: 'employer',
      balance: 900_000,
      annualContribution: 12_000,
    },
  ]
  plan.incomes = [
    {
      type: 'socialSecurity',
      id: 's1',
      personId: 'p1',
      piaMonthly: 2400,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  return plan
}

describe('createEmptyPlan', () => {
  it('produces a plan that passes its own schema', () => {
    const result = parsePlan(createEmptyPlan({ newId: testIds, now: fixedNow }))
    expect(result.ok).toBe(true)
  })
})

describe('parsePlan', () => {
  it('rejects malformed ACA family and coverage identity structure', () => {
    const duplicateFamily = validCouplePlan()
    setAcaYearContract(duplicateFamily)
    duplicateFamily.expenses.healthcare.acaYears![0]!.taxFamilyMembers[1]!.personId = 'p1'
    let parsed = parsePlan(duplicateFamily)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('tax-family member ids must be unique')

    const noPrimary = validCouplePlan()
    setAcaYearContract(noPrimary)
    noPrimary.expenses.healthcare.acaYears![0]!.taxFamilyMembers[0]!.relationship = 'dependent'
    parsed = parsePlan(noPrimary)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('exactly one primary')

    const duplicateCovered = validCouplePlan()
    setAcaYearContract(duplicateCovered)
    duplicateCovered.expenses.healthcare.acaYears![0]!.coveredMembers[1]!.personId = 'p1'
    parsed = parsePlan(duplicateCovered)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('covered member ids must be unique')

  })

  it('allows a covered external dependent only when that id belongs to the tax family', () => {
    const plan = validCouplePlan()
    setAcaYearContract(plan)
    const contract = plan.expenses.healthcare.acaYears![0]!
    contract.taxFamilyMembers.push({
      personId: 'dependent',
      relationship: 'dependent',
      requiredToFile: 'notRequired',
      magi: 0,
    })
    contract.coveredMembers[1]!.personId = 'dependent'
    expect(parsePlan(plan).ok).toBe(true)

    contract.coveredMembers[1]!.personId = 'not-in-tax-family'
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('must belong to the ACA tax family')
  })

  it('accepts a populated couple plan', () => {
    expect(parsePlan(validCouplePlan()).ok).toBe(true)
  })

  it('rejects MFJ with one person', () => {
    const plan = validCouplePlan()
    plan.household.people = [plan.household.people[0]!]
    const result = parsePlan(plan)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.join('\n')).toContain('marriedFilingJointly requires exactly two people')
    }
  })

  it('accepts equity compensation accounts with vesting metadata', () => {
    const plan = validCouplePlan()
    plan.accounts[1] = {
      type: 'equityComp',
      id: 'rsu1',
      name: 'RSUs',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 25_000,
      costBasis: 10_000,
      annualContribution: 0,
      vestingMode: 'cliff',
      vestDate: '2028-03-15',
    }
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects cliff-vesting equity compensation without a vest date', () => {
    const plan = validCouplePlan()
    plan.accounts[1] = {
      type: 'equityComp',
      id: 'rsu1',
      name: 'RSUs',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 25_000,
      costBasis: 10_000,
      annualContribution: 0,
      vestingMode: 'cliff',
      vestDate: null,
    }
    const result = parsePlan(plan)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.join('\n')).toContain('cliff-vesting equity compensation requires a vest date')
    }
  })

  it('defaults additive accumulation fields for older saved plans', () => {
    const plan = JSON.parse(JSON.stringify(validCouplePlan())) as Record<string, unknown>
    const assumptions = plan.assumptions as Record<string, unknown>
    delete assumptions.safeWithdrawalRatePct
    plan.incomes = [
      {
        type: 'wages',
        id: 'w1',
        personId: 'p1',
        annualGross: 100_000,
        endAge: null,
      },
    ]

    const result = parsePlan(plan)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.assumptions.safeWithdrawalRatePct).toBe(4)
      expect(result.plan.assumptions.localIncomeTaxPct).toBe(0)
      expect(result.plan.household.hasQualifyingDependent).toBe(false)
      expect(result.plan.incomes[0]?.type).toBe('wages')
      if (result.plan.incomes[0]?.type === 'wages') {
        expect(result.plan.incomes[0].realGrowthPct).toBe(0)
      }
    }
  })

  it('requires a positive safe withdrawal rate', () => {
    const plan = validCouplePlan()
    plan.assumptions.safeWithdrawalRatePct = 0
    expect(parsePlan(plan).ok).toBe(false)
  })

  it('accepts annual upside layers and flexible goal windows', () => {
    const plan = validCouplePlan()
    plan.expenses.baseAnnual = 100_000
    plan.expenses.requiredAnnual = 70_000
    plan.expenses.idealAnnual = 15_000
    plan.expenses.excessAnnual = 5_000
    plan.expenses.oneTimeGoals = [
      {
        id: 'goal',
        label: 'Remodel',
        year: 2035,
        amount: 50_000,
        classification: 'ideal',
        flexibility: 'movable',
        earliestYear: 2033,
        latestYear: 2038,
        priority: 2,
        allowPartialFunding: true,
        minFundingPct: 50,
      },
    ]
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects invalid flexible goal windows and impossible partial funding', () => {
    const plan = validCouplePlan()
    plan.expenses.oneTimeGoals = [
      {
        id: 'goal',
        label: 'Remodel',
        year: 2035,
        amount: 50_000,
        flexibility: 'movable',
        earliestYear: 2036,
        latestYear: 2034,
        allowPartialFunding: true,
        minFundingPct: 100,
      },
    ]
    const result = parsePlan(plan)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const issues = result.issues.join('\n')
      expect(issues).toContain('earliestYear cannot be after latestYear')
      expect(issues).toContain('earliestYear cannot be after the goal year')
      expect(issues).toContain('latestYear cannot be before the goal year')
      expect(issues).toContain('partial funding requires a minimum funding percent below 100')
    }
  })

  it('rejects employer match on IRA accounts', () => {
    const plan = validCouplePlan()
    plan.accounts[1] = {
      type: 'traditional',
      id: 'ira1',
      name: 'IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 10_000,
      annualContribution: 0,
      employerMatch: { matchPct: 100, capPctOfPay: 4 },
    }

    const result = parsePlan(plan)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join('\n')).toContain('Employer match can only be set on employer')
  })

  it('rejects account owner referencing an unknown person', () => {
    const plan = validCouplePlan()
    plan.accounts[1] = { ...plan.accounts[1]!, ownerPersonId: 'ghost' }
    const result = parsePlan(plan)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.join('\n')).toContain('unknown person id "ghost"')
    }
  })

  it('rejects joint ownership for retirement and HSA accounts', () => {
    for (const type of ['traditional', 'roth', 'hsa'] as const) {
      const plan = validCouplePlan()
      plan.accounts[1] = {
        ...plan.accounts[1]!,
        type,
        ownerPersonId: null,
        ...(type === 'hsa' ? {} : { kind: 'ira' }),
      } as Plan['accounts'][number]
      const result = parsePlan(plan)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues.join('\n')).toContain(`${type} accounts must have an individual owner`)
      }
    }
  })

  it('rejects income stream referencing an unknown person', () => {
    const plan = validCouplePlan()
    plan.incomes[0] = { ...plan.incomes[0]!, personId: 'ghost' } as Plan['incomes'][number]
    expect(parsePlan(plan).ok).toBe(false)
  })

  it('rejects negative balances and malformed DOBs', () => {
    const plan = validCouplePlan()
    plan.accounts[0] = { ...plan.accounts[0]!, balance: -1 } as Plan['accounts'][number]
    expect(parsePlan(plan).ok).toBe(false)

    const plan2 = validCouplePlan()
    plan2.household.people[0]!.dob = '03/15/1962'
    expect(parsePlan(plan2).ok).toBe(false)
  })

  it('rejects claim ages outside 62–70', () => {
    const plan = validCouplePlan()
    plan.incomes[0] = {
      ...plan.incomes[0]!,
      claimAge: { years: 71, months: 0 },
    } as Plan['incomes'][number]
    expect(parsePlan(plan).ok).toBe(false)
  })

  it('resolves unsorted state moves by the latest applicable move year', () => {
    const plan = validCouplePlan()
    plan.household.state = 'FL'
    plan.household.stateMoves = [
      { fromYear: 2035, fromMonth: 7, state: 'NY' },
      { fromYear: 2028, fromMonth: 7, state: 'KY' },
      { fromYear: 2040, fromMonth: 7, state: 'TX' },
    ]

    expect(stateForYear(plan.household, 2027)).toBe('FL')
    expect(stateForYear(plan.household, 2028)).toBe('KY')
    expect(stateForYear(plan.household, 2039)).toBe('NY')
    expect(stateForYear(plan.household, 2040)).toBe('TX')
  })

  it('defaults state moves to July and splits the move year by month', () => {
    const raw = JSON.parse(JSON.stringify(validCouplePlan())) as Record<string, unknown>
    const household = raw.household as Record<string, unknown>
    household.state = 'CA'
    household.stateMoves = [{ fromYear: 2030, state: 'NV' }]

    const parsed = parsePlan(raw)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.plan.household.stateMoves[0]!.fromMonth).toBe(7)
    expect(stateResidencySegmentsForYear(parsed.plan.household, 2030)).toEqual([
      { state: 'CA', months: 6 },
      { state: 'NV', months: 6 },
    ])
  })

  it('keeps duplicate state-move years deterministic by using the first matching move', () => {
    const plan = validCouplePlan()
    plan.household.state = 'FL'
    plan.household.stateMoves = [
      { fromYear: 2030, fromMonth: 7, state: 'KY' },
      { fromYear: 2030, fromMonth: 7, state: 'NY' },
    ]

    expect(stateForYear(plan.household, 2030)).toBe('KY')
  })

  it('rejects invalid state-move codes and relation references', () => {
    const badStateMove = validCouplePlan()
    badStateMove.household.stateMoves = [{ fromYear: 2030, fromMonth: 7, state: 'KYY' }]
    expect(parsePlan(badStateMove).ok).toBe(false)

    const badCareEvent = validCouplePlan()
    badCareEvent.careEvents = [{ id: 'care', personId: 'ghost', startAge: 80, durationYears: 2, annualCost: 50_000 }]
    expect(parsePlan(badCareEvent).ok).toBe(false)

    const badBeneficiary = validCouplePlan()
    badBeneficiary.insurance = [
      {
        kind: 'permanentLife',
        id: 'life',
        name: 'Life',
        insured: 'p1',
        beneficiary: 'ghost',
        annualPremium: 0,
        premiumMode: 'paidUp',
        deathBenefit: 100_000,
        cashValue: 0,
        cashValueMode: 'flatRate',
      },
    ]
    expect(parsePlan(badBeneficiary).ok).toBe(false)
  })

  it('round-trips through JSON unchanged', () => {
    const plan = validCouplePlan()
    const result = parsePlan(JSON.parse(JSON.stringify(plan)))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan).toEqual(plan)
  })

  it('rejects nondeductible basis on a non-IRA or inherited traditional account', () => {
    const employerBasis = validCouplePlan()
    ;(employerBasis.accounts[1] as { nondeductibleBasis?: number }).nondeductibleBasis = 5_000
    expect(parsePlan(employerBasis).ok).toBe(false) // a2 is an employer plan

    const iraBasis = validCouplePlan()
    iraBasis.accounts[1] = { ...iraBasis.accounts[1], kind: 'ira', nondeductibleBasis: 5_000 } as Plan['accounts'][number]
    expect(parsePlan(iraBasis).ok).toBe(true)

    const inheritedBasis = validCouplePlan()
    inheritedBasis.accounts[1] = {
      ...inheritedBasis.accounts[1],
      kind: 'ira',
      nondeductibleBasis: 5_000,
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
    } as Plan['accounts'][number]
    expect(parsePlan(inheritedBasis).ok).toBe(false)
  })

  it('requires the cap treatment when HSA reimburse-later is enabled', () => {
    const plan = validCouplePlan()
    plan.accounts.push({
      type: 'hsa',
      id: 'hsa1',
      name: 'HSA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 50_000,
      annualContribution: 0,
      reimburseLater: true,
    } as Plan['accounts'][number])
    expect(parsePlan(plan).ok).toBe(false)
    ;(plan.accounts[plan.accounts.length - 1] as { withdrawalTreatment?: string }).withdrawalTreatment =
      'capByMedicalExpenses'
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('requires a cost basis for property depreciation recapture', () => {
    const plan = validCouplePlan()
    plan.accounts.push({
      type: 'property',
      id: 'home',
      name: 'Home',
      ownerPersonId: null,
      annualReturnPct: null,
      value: 500_000,
      plannedSaleYear: 2030,
      expectedNetProceeds: null,
      depreciationRecapture: 20_000,
    } as Plan['accounts'][number])
    expect(parsePlan(plan).ok).toBe(false)
    ;(plan.accounts[plan.accounts.length - 1] as { costBasis?: number }).costBasis = 300_000
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('accepts an optional taxable safety-net floor', () => {
    const plan = validCouplePlan()
    plan.strategies.taxableSafetyNetFloor = 25_000
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('reports a path for each issue', () => {
    const result = parsePlan({ schemaVersion: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.every((i) => i.includes(':'))).toBe(true)
    }
  })
})

describe('Plan v4 annual filing-source persistence', () => {
  function annualFactsPlan(): Plan {
    const plan = validCouplePlan()
    plan.accounts.push(traditionalAccount('ira-filing', 10_000, 'p1'))
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [
        ownedNonRothIraAnnualFilingSourceRecord(
          plan,
          'p1',
          ['ira-filing'],
        ),
      ],
    }
    return plan
  }

  it('round-trips one authoritative source without deriving it from planning basis', () => {
    const plan = annualFactsPlan()
    const ira = plan.accounts.find((account) => account.id === 'ira-filing')
    if (ira?.type !== 'traditional') throw new Error('expected traditional IRA')
    ira.nondeductibleBasis = 999_999

    const parsed = parsePlan(structuredClone(plan))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.plan.retirementActionAnnualTaxFacts).toEqual(
        plan.retirementActionAnnualTaxFacts,
      )
      expect(
        parsed.plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords[0]!.openingBasis
          .openingBasisAmount,
      ).toBe(0)
    }
  })

  it('requires exact binding and boundary-wide unique source identifiers', () => {
    const mutations: Array<(plan: Plan) => void> = [
      (plan) => {
        const record = plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords[0]!
        record.planId = 'other-plan' as never
      },
      (plan) => {
        plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords[0]!
          .reviewedSourceAccountIds = []
      },
      (plan) => {
        const records = plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords
        records.push(structuredClone(records[0]!))
      },
      (plan) => {
        const first = plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords[0]!
        plan.accounts.push(traditionalAccount('ira-filing-2', 5_000, 'p2'))
        const second = ownedNonRothIraAnnualFilingSourceRecord(
          plan,
          'p2',
          ['ira-filing-2'],
          2030,
          'p2-2030',
        )
        second.sourceRecordId = first.sourceRecordId
        second.sourceEvidenceId = first.sourceEvidenceId
        plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords.push(second)
      },
      (plan) => {
        plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords[0]!
          .sourceRecordId = plan.id
      },
      (plan) => {
        const records = plan.retirementActionAnnualTaxFacts!
          .ownedNonRothIraAnnualFilingSourceRecords
        const second = ownedNonRothIraAnnualFilingSourceRecord(
          plan,
          'p1',
          ['ira-filing'],
          2031,
          'p1-2031',
        )
        second.authority.sourceId = records[0]!.openingBasis.sourceEvidenceId
        records.push(second)
      },
    ]

    for (const mutate of mutations) {
      const plan = annualFactsPlan()
      mutate(plan)
      expect(parsePlan(plan).ok).toBe(false)
    }
  })

  it('requires the exact ordinary federal filing deadline, not merely an April date', () => {
    const plan = annualFactsPlan()
    const record = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-filing'],
      2023,
      'wrong-deadline',
    )
    record.authority.finalizedDate = '2024-04-18'
    record.nondeductibleContributionFacts.completedThroughDate = '2024-04-18'
    record.nondeductibleContributionFacts.deadlineAuthority.deadlineDate = '2024-04-18'
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [record],
    }

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'ordinary contribution deadline must exact-match the supported federal calendar',
      )
    }
  })

  it('rejects malformed dates, cross-year contributions, and unsafe contribution totals', () => {
    const plan = annualFactsPlan()
    const record = plan.retirementActionAnnualTaxFacts!
      .ownedNonRothIraAnnualFilingSourceRecords[0]!
    record.nondeductibleContributionFacts.contributions = [{
      sourceRecordId: 'contribution-record',
      sourceEvidenceId: 'contribution-evidence',
      sourceAccountId: 'ira-filing' as never,
      designatedTaxYear: 2029,
      contributionDate: '2031-04-31',
      nondeductibleContributionAmount: Number.MAX_SAFE_INTEGER as never,
    }, {
      sourceRecordId: 'contribution-record-2',
      sourceEvidenceId: 'contribution-evidence-2',
      sourceAccountId: 'ira-filing' as never,
      designatedTaxYear: 2030,
      contributionDate: '2031-04-15',
      nondeductibleContributionAmount: 1 as never,
    }]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      const issues = parsed.issues.join('\n')
      expect(issues).toContain('expected a real canonical civil date')
      expect(issues).toContain('must designate the source record tax year')
      expect(issues).toContain('exceeds exact safe-integer cents')
    }
  })
})

describe('guaranteed-income and estate-depth fields', () => {
  function planWithAnnuity(purchase: Record<string, unknown>): Plan {
    const plan = validCouplePlan()
    plan.accounts.push({
      type: 'annuity',
      id: 'ann1',
      name: 'SPIA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 1_000,
      colaPct: 0,
      taxablePct: 100,
      // @ts-expect-error partial purchase supplied by the test
      purchase,
    })
    return plan
  }

  it('accepts a non-qualified purchase funded from a taxable account', () => {
    expect(parsePlan(planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'a1', taxQualification: 'nonQualified' })).ok).toBe(true)
  })

  it('accepts a qualified QLAC funded from a traditional account', () => {
    expect(parsePlan(planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'a2', taxQualification: 'qualified', qlac: true })).ok).toBe(true)
  })

  it('rejects a qualified purchase funded from a taxable account', () => {
    expect(parsePlan(planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'a1', taxQualification: 'qualified' })).ok).toBe(false)
  })

  it('rejects a non-qualified purchase funded from a traditional account', () => {
    expect(parsePlan(planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'a2', taxQualification: 'nonQualified' })).ok).toBe(false)
  })

  it('rejects a QLAC that is not a qualified purchase', () => {
    expect(parsePlan(planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'a1', taxQualification: 'nonQualified', qlac: true })).ok).toBe(false)
  })

  /** The shared plan with the contract's start age moved and its owner re-dated. */
  function deferredQualified(startAge: number, opts: { dob?: string; qlac?: boolean } = {}): Plan {
    const plan = planWithAnnuity({
      year: 2030,
      premium: 100_000,
      fundingAccountId: 'a2',
      taxQualification: 'qualified',
      ...(opts.qlac === true ? { qlac: true } : {}),
    })
    if (opts.dob !== undefined) plan.household.people[0]!.dob = opts.dob
    const annuity = plan.accounts.find((a) => a.id === 'ann1')!
    if (annuity.type !== 'annuity') throw new Error('fixture built no annuity')
    annuity.startAge = startAge
    return plan
  }

  it('rejects a qualified purchase that is not a QLAC and defers past the required beginning date', () => {
    // Treas. Reg. 1.401(a)(9)-6(a)(3)(i) requires payments to commence by the
    // required beginning date and (q)(1)(iii) excuses only a QLAC. This owner is
    // born in 1962, so the applicable age is 75 and the last permissible start
    // is 76; a contract starting at 85 has no legal expression. Left admitted,
    // the premium leaves the traditional balance for an account that holds none
    // and the requirement is computed on a base short by the whole premium.
    const parsed = parsePlan(deferredQualified(85))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'a qualified annuity purchase that is not a QLAC cannot defer past the owner\'s required beginning date: it must start paying by age 76',
    )
    // The message has to name controls that exist, or a household cannot act on it.
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'lower "Start age", or tick "QLAC (qualified longevity annuity)"',
    )
  })

  it('accepts the same deferred contract once it is declared a QLAC', () => {
    expect(parsePlan(deferredQualified(85, { qlac: true })).ok).toBe(true)
  })

  it('accepts a qualified purchase that starts in the year the owner may last defer to', () => {
    expect(parsePlan(deferredQualified(76)).ok).toBe(true)
  })

  it('accepts an immediate purchase made after the required beginning date', () => {
    // The rule is about deferral, not about age. An owner who annuitizes at 85
    // passed their required beginning date years ago, so every contract they
    // could buy commences after it; refusing on that date alone would forbid the
    // ordinary immediate annuity, which the regulation allows.
    expect(parsePlan(deferredQualified(85, { dob: '1945-03-15' })).ok).toBe(true)
    // One year of deferral past the purchase is still deferral past the date.
    expect(parsePlan(deferredQualified(86, { dob: '1945-03-15' })).ok).toBe(false)
  })

  it('leaves a non-qualified deferred purchase alone', () => {
    // Section 401(a)(9) does not reach a contract bought with after-tax dollars,
    // and no premium leaves a traditional balance, so there is nothing here for
    // the required-distribution base to lose.
    const plan = planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'a1', taxQualification: 'nonQualified' })
    const annuity = plan.accounts.find((a) => a.id === 'ann1')!
    if (annuity.type !== 'annuity') throw new Error('fixture built no annuity')
    annuity.startAge = 85
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects a QLAC whose payments commence after the owner’s 85th birthday', () => {
    // Treas. Reg. 1.401(a)(9)-6(q)(1)(ii): the contract must provide a specified
    // annuity starting date no later than the first of the month after the 85th
    // anniversary of the owner's birth. This owner was born in March, so that
    // day is April 1 of the year they attain 85, and the projection commences a
    // start age of 86 on January 1 of the year they attain 86 — nine months
    // late. A contract past the ceiling is not a QLAC, so (q)(1)(iii)'s excuse
    // and 1.401(a)(9)-5(b)(4)'s exclusion are both gone with it.
    const parsed = parsePlan(deferredQualified(86, { qlac: true }))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'a QLAC must commence by the first of the month after the owner\'s 85th birthday: it must start paying by age 85',
    )
  })

  it('accepts a QLAC that starts in the last year the owner may defer to', () => {
    expect(parsePlan(deferredQualified(85, { qlac: true })).ok).toBe(true)
  })

  it('gives a December-born owner the extra start age their deadline gives them', () => {
    // The deadline is the first day of the month NEXT FOLLOWING the 85th
    // anniversary. Born in December, that day is January 1 of the next calendar
    // year, which is exactly where the projection commences a start age of 86:
    // the last day the regulation permits, and refusing it would be stricter
    // than the authority for it. A birthday one day earlier gets no such year.
    expect(parsePlan(deferredQualified(86, { qlac: true, dob: '1962-12-01' })).ok).toBe(true)
    expect(parsePlan(deferredQualified(87, { qlac: true, dob: '1962-12-31' })).ok).toBe(false)
    expect(parsePlan(deferredQualified(86, { qlac: true, dob: '1962-11-30' })).ok).toBe(false)
  })

  it('names the other box only where the other box would take the contract', () => {
    // Each refusal has two conceivable remedies and the second is a dead end
    // whenever the other bound refuses the same age too. Unticking QLAC on a
    // start age of 86 lands this 1962-born owner on a required-beginning-date
    // ceiling of 76, so the message says so instead of offering it.
    const deadEnd = parsePlan(deferredQualified(86, { qlac: true }))
    expect(deadEnd.ok ? [] : deadEnd.issues.join('\n')).toContain(
      'unticking "QLAC (qualified longevity annuity)" would not help, because a qualified purchase that is not a QLAC must start paying by age 76',
    )
    // The other way round: an owner who annuitizes at 90 in the purchase year
    // may hold that contract without the QLAC election, because an immediate
    // purchase postpones nothing. Here the untick is a real remedy and the
    // message offers it.
    const realRemedy = parsePlan(deferredQualified(90, { qlac: true, dob: '1940-03-15' }))
    expect(realRemedy.ok).toBe(false)
    expect(realRemedy.ok ? [] : realRemedy.issues.join('\n')).toContain(
      'untick "QLAC (qualified longevity annuity)" — a qualified purchase that is not a QLAC may start as late as age 90 here',
    )
  })

  it('tells a non-QLAC holder that ticking the box would not help either', () => {
    // The mirror of the case above, and the correction the (q)(1)(ii) ceiling
    // forced on the older message: a start age of 90 is past the QLAC ceiling
    // as well, so "tick QLAC" would send the household to a second refusal.
    const parsed = parsePlan(deferredQualified(90))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'ticking "QLAC (qualified longevity annuity)" would not help, because a QLAC must start paying by age 85',
    )
  })

  it('rejects a purchase referencing an unknown funding account', () => {
    expect(parsePlan(planWithAnnuity({ year: 2030, premium: 100_000, fundingAccountId: 'nope', taxQualification: 'nonQualified' })).ok).toBe(false)
  })

  it('rejects a qualified purchase funded from an inherited traditional account', () => {
    // An inherited account is `type: 'traditional'`, so a bare type test used to
    // admit it. The premium would leave the inherited balance for an `annuity`
    // account that carries no `inherited` marker, dropping the 10-year clock on
    // those dollars entirely.
    const plan = planWithAnnuity({ year: 2030, premium: 50_000, fundingAccountId: 'inh1', taxQualification: 'qualified' })
    plan.accounts.push({
      type: 'traditional',
      id: 'inh1',
      name: 'Inherited IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 150_000,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'a qualified annuity purchase must be funded from a traditional account you own (inherited IRA dollars stay in the inherited account)',
    )
  })

  it('accepts per-account estate beneficiary destinations', () => {
    const plan = validCouplePlan()
    ;(plan.accounts[1] as { estateBeneficiary?: unknown }).estateBeneficiary = { destination: 'charity', charityPct: 50 }
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects a charity destination without a charity percent', () => {
    const plan = validCouplePlan()
    ;(plan.accounts[1] as { estateBeneficiary?: unknown }).estateBeneficiary = { destination: 'charity' }
    expect(parsePlan(plan).ok).toBe(false)
  })

  it('accepts a survivor reserve target and heir-tax-by-class override', () => {
    const plan = validCouplePlan()
    plan.strategies.survivorReserveTarget = 300_000
    plan.assumptions.heirTaxByClass = { traditional: 32, hsa: 12 }
    expect(parsePlan(plan).ok).toBe(true)
  })
})

describe('pension lump-sum election', () => {
  // `validCouplePlan` stamps `updatedAtIso` from `fixedNow`, so the document's
  // own as-of year is 2026 throughout this block.
  function planWithElection(
    offer: { amount: number; electionYear: number },
    rolloverAccountId: string,
  ): Plan {
    const plan = validCouplePlan()
    plan.accounts.push({
      type: 'traditional',
      id: 'inh1',
      name: 'Inherited IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 150_000,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true },
    })
    plan.accounts.push({
      type: 'pension',
      id: 'pen1',
      name: 'Company pension',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 50,
      lumpSumOffer: offer,
      lumpSumElection: { rolloverAccountId },
    })
    return plan
  }

  it('accepts an owned traditional target with a future election year', () => {
    expect(parsePlan(planWithElection({ amount: 300_000, electionYear: 2030 }, 'a2')).ok).toBe(true)
  })

  it('accepts an election year equal to the plan’s as-of year', () => {
    expect(parsePlan(planWithElection({ amount: 300_000, electionYear: 2026 }, 'a2')).ok).toBe(true)
  })

  it('refuses an election year already past, naming the repair', () => {
    // Crediting a past election in the first projection year would double-count
    // it: balances are what the household holds today, so a rollover that really
    // happened is already inside the receiving account's entered balance.
    const parsed = parsePlan(planWithElection({ amount: 300_000, electionYear: 2025 }, 'a2'))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'an elected pension lump sum cannot have an election year in the past (if the rollover already happened, clear the election and add its dollars to the receiving account balance)',
    )
  })

  it('leaves an unelected offer with a past election year alone', () => {
    // An offer on record with no election changes nothing in the ledger, and the
    // decision view already ignores a past one. Only the elected shape is refused.
    const plan = planWithElection({ amount: 300_000, electionYear: 2020 }, 'a2')
    const pension = plan.accounts[plan.accounts.length - 1] as { lumpSumElection?: unknown }
    pension.lumpSumElection = undefined
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('fails closed when the plan stamp is unreadable and an election is present', () => {
    // The staleness rule reads the document's own stamp; a stamp it cannot
    // read would otherwise wave any election year through, including the
    // past-year shape the rule exists to refuse.
    const plan = planWithElection({ amount: 300_000, electionYear: 2030 }, 'a2')
    ;(plan as { updatedAtIso: string }).updatedAtIso = 'not-a-timestamp'
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'an elected pension lump sum requires a readable plan timestamp',
    )
  })

  it('refuses a duplicated account id once a rollover election references it', () => {
    // The ownership validation resolves the target through a map where the last
    // duplicate wins, while the simulator moves balances first-match-wins. A
    // duplicated id could therefore validate against one record and move money
    // in the other, so a referenced duplicate is ambiguous and refused — the
    // same protection action-referenced accounts already have.
    const plan = planWithElection({ amount: 300_000, electionYear: 2030 }, 'a2')
    const owned = plan.accounts.find((a) => a.id === 'a2')!
    plan.accounts.push({ ...owned, name: 'Duplicate of a2' })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain('duplicate account id "a2"')
  })

  it('refuses an inherited IRA as the rollover target', () => {
    const parsed = parsePlan(planWithElection({ amount: 300_000, electionYear: 2030 }, 'inh1'))
    expect(parsed.ok).toBe(false)
    expect(parsed.ok ? [] : parsed.issues.join('\n')).toContain(
      'a pension lump sum must roll over into an existing traditional account you own (not an inherited IRA)',
    )
  })

  it('refuses a rollover target that is not a traditional account at all', () => {
    expect(parsePlan(planWithElection({ amount: 300_000, electionYear: 2030 }, 'a1')).ok).toBe(false)
    expect(parsePlan(planWithElection({ amount: 300_000, electionYear: 2030 }, 'nope')).ok).toBe(false)
  })
})

describe('Plan retirement-action persistence', () => {
  function actionPlanRaw(): Record<string, unknown> {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const personId = plan.household.people[0]!.id
    const raw = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
    raw['accounts'] = [
      {
        type: 'traditional',
        id: 'traditional-1',
        name: 'Traditional IRA',
        ownerPersonId: personId,
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'roth-1',
        name: 'Roth IRA',
        ownerPersonId: personId,
        annualReturnPct: null,
        kind: 'ira',
        balance: 50_000,
        annualContribution: 0,
      },
      {
        type: 'traditional',
        id: 'other-owner-traditional',
        name: 'Other owner IRA',
        ownerPersonId: 'other-person',
        annualReturnPct: null,
        kind: 'ira',
        balance: 50_000,
        annualContribution: 0,
      },
    ]
    ;(raw['household'] as Record<string, unknown>)['people'] = [
      ...(plan.household.people as unknown[]),
      {
        id: 'other-person',
        name: 'Other',
        dob: '1971-01-01',
        sex: 'average',
        retirementAge: 65,
        longevity: { planningAge: 95, source: 'manual' },
      },
    ]
    const strategies = raw['strategies'] as Record<string, unknown>
    strategies['retirementActions'] = [
      {
        actionId: 'withdrawal-1',
        kind: 'ordinaryWithdrawal',
        personId,
        year: 2030,
        executionDate: 'malformed-but-preserved',
        executionSequence: 1,
        requestedAmount: 1_000,
        allocations: [
          {
            allocationId: 'withdrawal-allocation',
            sourceAccountId: 'traditional-1',
            requestedAmount: 1_000,
          },
        ],
        purpose: { kind: 'taxPayment', referenceId: 'conversion-1' },
        provenance: { source: 'manual' },
      },
      {
        actionId: 'conversion-1',
        kind: 'rothConversion',
        personId,
        year: 2030,
        executionSequence: 2,
        requestedAmount: 10_000,
        allocations: [
          {
            allocationId: 'conversion-allocation',
            sourceAccountId: 'traditional-1',
            requestedAmount: 10_000,
          },
        ],
        destinationRothAccountId: 'roth-1',
        taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'withdrawal-1' },
        provenance: { source: 'generator', sourceId: 'conversion-generator' },
      },
      {
        actionId: 'qcd-1',
        kind: 'qcd',
        donorPersonId: personId,
        year: 2030,
        executionDate: '2030-12-15',
        executionSequence: 3,
        requestedAmount: 5_000,
        allocation: {
          allocationId: 'qcd-allocation',
          sourceAccountId: 'traditional-1',
          requestedAmount: 5_000,
        },
        charity: {
          designationId: 'charity-1',
          name: 'Community Foundation',
          designationKind: 'eligiblePublicCharity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: true,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
        provenance: { source: 'optimizer', sourceId: 'qcd-optimizer' },
      },
      {
        actionId: 'legacy-withdrawal',
        kind: 'legacyAggregateWithdrawal',
        year: 2027,
        requestedAmount: 30_000,
        legacyCategory: 'traditional',
        provenance: { source: 'migration' },
      },
      {
        actionId: 'legacy-conversion',
        kind: 'legacyAggregateRothConversion',
        year: 2028,
        requestedAmount: 20_000,
        provenance: { source: 'migration' },
      },
      {
        actionId: 'legacy-qcd',
        kind: 'legacyAggregateQcd',
        year: 2029,
        requestedAmount: 8_000,
        legacyField: 'qcdAnnual',
        provenance: { source: 'migration' },
      },
    ]
    return raw
  }

  function actions(raw: Record<string, unknown>): Array<Record<string, unknown>> {
    return (raw['strategies'] as Record<string, unknown>)[
      'retirementActions'
    ] as Array<Record<string, unknown>>
  }

  it('round-trips all current and legacy arms without normalizing submitted facts', () => {
    const raw = actionPlanRaw()
    const result = parsePlan(JSON.parse(JSON.stringify(raw)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.strategies.retirementActions).toEqual(actions(raw))
      expect(result.plan.household.people).toEqual(
        (raw['household'] as Record<string, unknown>)['people'],
      )
      expect(result.plan.accounts).toEqual(raw['accounts'])
      const withdrawal = result.plan.strategies.retirementActions[0]
      expect(
        withdrawal?.kind === 'ordinaryWithdrawal' ? withdrawal.executionDate : undefined,
      ).toBe('malformed-but-preserved')
    }
  })

  it('strips unknown persisted action fields while the direct action contract stays strict', () => {
    const raw = actionPlanRaw()
    const action = actions(raw)[0]!
    action['thirdPartyMetadata'] = { source: 'advisor' }
    ;(action['provenance'] as Record<string, unknown>)['note'] = 'unknown'
    ;(
      (action['allocations'] as Array<Record<string, unknown>>)[0]!
    )['custodianMemo'] = 'unknown'
    ;(action['purpose'] as Record<string, unknown>)['memo'] = 'unknown'

    const result = parsePlan(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const persisted = result.plan.strategies.retirementActions[0] as unknown as Record<
      string,
      unknown
    >
    expect(persisted).not.toHaveProperty('thirdPartyMetadata')
    expect(persisted['provenance']).not.toHaveProperty('note')
    expect(
      (persisted['allocations'] as Array<Record<string, unknown>>)[0],
    ).not.toHaveProperty('custodianMemo')
    expect(persisted['purpose']).not.toHaveProperty('memo')
  })

  it('rejects a persisted conversion whose destination aliases a source', () => {
    const raw = actionPlanRaw()
    const conversion = actions(raw).find((action) =>
      action['kind'] === 'rothConversion')!
    const allocations = conversion['allocations'] as Array<Record<string, unknown>>
    conversion['destinationRothAccountId'] = allocations[0]!['sourceAccountId']

    expect(parsePlan(raw).ok).toBe(false)
  })

  it('defaults an omitted v2 action schedule to empty', () => {
    const raw = actionPlanRaw()
    delete (raw['strategies'] as Record<string, unknown>)['retirementActions']
    const result = parsePlan(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.strategies.retirementActions).toEqual([])
  })

  it('rejects empty and mixed-kind duplicate action IDs before linked diagnostics', () => {
    const empty = actionPlanRaw()
    actions(empty)[0]!['actionId'] = ''
    expect(parsePlan(empty).ok).toBe(false)

    const duplicate = actionPlanRaw()
    actions(duplicate)[3]!['actionId'] = 'conversion-1'
    ;(actions(duplicate)[1]!['taxFunding'] as Record<string, unknown>)[
      'withdrawalActionId'
    ] = 'missing'
    const duplicateResult = parsePlan(duplicate)
    expect(duplicateResult.ok).toBe(false)
    if (!duplicateResult.ok) {
      expect(
        duplicateResult.issues.some((issue) =>
          issue.includes('duplicate retirement action id'),
        ),
      ).toBe(true)
      expect(
        duplicateResult.issues.some((issue) =>
          issue.includes('linked withdrawal must resolve'),
        ),
      ).toBe(false)
    }
  })

  it('rejects missing person, source, destination, and cross-owner references', () => {
    const mutations: Array<(raw: Record<string, unknown>) => void> = [
      (raw) => {
        actions(raw)[0]!['personId'] = 'missing-person'
      },
      (raw) => {
        const allocation = (
          actions(raw)[0]!['allocations'] as Array<Record<string, unknown>>
        )[0]!
        allocation['sourceAccountId'] = 'missing-account'
      },
      (raw) => {
        actions(raw)[1]!['destinationRothAccountId'] = 'missing-roth'
      },
      (raw) => {
        actions(raw)[1]!['destinationRothAccountId'] = 'traditional-1'
      },
      (raw) => {
        const allocation = actions(raw)[2]!['allocation'] as Record<string, unknown>
        allocation['sourceAccountId'] = 'other-owner-traditional'
      },
    ]

    for (const mutate of mutations) {
      const raw = actionPlanRaw()
      mutate(raw)
      expect(parsePlan(raw).ok).toBe(false)
    }
  })

  it('rejects duplicate account IDs before action references can depend on array order', () => {
    const first = actionPlanRaw()
    const firstAccounts = first['accounts'] as Array<Record<string, unknown>>
    firstAccounts.push({
      ...firstAccounts[0],
      ownerPersonId: 'other-person',
    })

    const second = actionPlanRaw()
    const secondAccounts = second['accounts'] as Array<Record<string, unknown>>
    secondAccounts.unshift({
      ...secondAccounts[0],
      ownerPersonId: 'other-person',
    })

    for (const raw of [first, second]) {
      const result = parsePlan(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.includes('duplicate account id'))).toBe(
          true,
        )
      }
    }
  })

  it('rejects duplicate person IDs before action references can depend on array order', () => {
    const first = actionPlanRaw()
    const firstPeople = (
      first['household'] as Record<string, unknown>
    )['people'] as Array<Record<string, unknown>>
    firstPeople.push({ ...firstPeople[0], name: 'Ambiguous duplicate' })

    const second = actionPlanRaw()
    const secondPeople = (
      second['household'] as Record<string, unknown>
    )['people'] as Array<Record<string, unknown>>
    secondPeople.unshift({ ...secondPeople[0], name: 'Ambiguous duplicate' })

    for (const raw of [first, second]) {
      const result = parsePlan(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.includes('duplicate person id'))).toBe(
          true,
        )
      }
    }
  })

  it('requires linked tax funding to resolve the exact same-person/year back-reference', () => {
    const cases: Array<(raw: Record<string, unknown>) => void> = [
      (raw) => {
        ;(actions(raw)[1]!['taxFunding'] as Record<string, unknown>)[
          'withdrawalActionId'
        ] = 'qcd-1'
      },
      (raw) => {
        actions(raw)[0]!['year'] = 2031
      },
      (raw) => {
        actions(raw)[0]!['purpose'] = { kind: 'spending' }
      },
      (raw) => {
        actions(raw)[0]!['purpose'] = {
          kind: 'taxPayment',
          referenceId: 'other-conversion',
        }
      },
    ]
    for (const mutate of cases) {
      const raw = actionPlanRaw()
      mutate(raw)
      const result = parsePlan(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(
          result.issues.some((issue) =>
            issue.includes('linked withdrawal must resolve'),
          ),
        ).toBe(true)
      }
    }
  })
})

describe('Plan v3 retirement-action eligibility facts', () => {
  function factsPlan(): Plan {
    const plan = validCouplePlan()
    plan.accounts.push({
      type: 'traditional',
      id: 'ira-facts',
      name: 'IRA facts source',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 25_000,
      annualContribution: 0,
    })
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [
        {
          evidenceId: 'class-1',
          provenance: { source: 'manual' },
          sourceAccountId: 'ira-facts',
          subtype: 'simple',
          simpleParticipationStartDate: '2024-02-29',
        },
      ],
      sepSimpleActivities: [
        {
          evidenceId: 'activity-1',
          provenance: { source: 'import', sourceId: 'custodian-1' },
          sourceAccountId: 'ira-facts',
          actionTaxYear: 2033,
          planYearEndDate: '2033-12-31',
          employerContributionMadeForPlanYear: false,
        },
      ],
      deductibleIraContributions: [
        {
          evidenceId: 'contribution-1',
          provenance: { source: 'manual' },
          donorPersonId: 'p1',
          taxYear: 2033,
          amountCents: asUsdCents(0),
        },
      ],
    }
    return plan
  }

  it('is absent by default and round-trips explicitly authored facts', () => {
    expect(createEmptyPlan({ newId: testIds, now: fixedNow })).not.toHaveProperty(
      'retirementActionEligibilityFacts',
    )
    const plan = factsPlan()
    const parsed = parsePlan(JSON.parse(JSON.stringify(plan)))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.plan.retirementActionEligibilityFacts).toEqual(
        plan.retirementActionEligibilityFacts,
      )
    }
  })

  it('does not permit runtime alive or prior-QCD-offset evidence in the durable root', () => {
    for (const runtimeField of [
      'personAliveEvidence',
      'priorQcdOffsetEvidence',
    ]) {
      const plan = factsPlan() as unknown as Record<string, unknown>
      const facts = plan['retirementActionEligibilityFacts'] as Record<
        string,
        unknown
      >
      facts[runtimeField] = []
      expect(parsePlan(plan).ok).toBe(false)
    }
  })

  it('rejects duplicate evidence, source, activity-year, and donor-year identities at records', () => {
    const plan = factsPlan()
    const facts = plan.retirementActionEligibilityFacts!
    facts.iraClassifications.push({
      ...facts.iraClassifications[0]!,
      evidenceId: 'class-2',
    })
    facts.sepSimpleActivities.push({
      ...facts.sepSimpleActivities[0]!,
      evidenceId: 'activity-2',
    })
    facts.deductibleIraContributions.push({
      ...facts.deductibleIraContributions[0]!,
      evidenceId: 'activity-1',
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      const issues = parsed.issues.join('\n')
      expect(issues).toContain('duplicate eligibility evidence id')
      expect(issues).toContain('duplicate IRA classification source')
      expect(issues).toContain('duplicate SEP/SIMPLE activity source and action tax year')
      expect(issues).toContain('duplicate deductible IRA contribution donor and tax year')
    }
  })

  it('requires real bound dates, exact cents, and contribution years at/after age 70½', () => {
    const mutations: Array<(plan: Plan) => void> = [
      (plan) => {
        ;(
          plan.retirementActionEligibilityFacts!
            .iraClassifications[0]! as { simpleParticipationStartDate: string }
        ).simpleParticipationStartDate = '2023-02-29'
      },
      (plan) => {
        plan.retirementActionEligibilityFacts!.sepSimpleActivities[0]!
          .planYearEndDate = '2033-02-29'
      },
      (plan) => {
        plan.retirementActionEligibilityFacts!.sepSimpleActivities[0]!
          .planYearEndDate = '2032-12-31'
      },
      (plan) => {
        plan.retirementActionEligibilityFacts!.deductibleIraContributions[0]!
          .amountCents = 1.5 as never
      },
      (plan) => {
        plan.retirementActionEligibilityFacts!.deductibleIraContributions[0]!
          .taxYear = 2031
      },
    ]
    for (const mutate of mutations) {
      const plan = factsPlan()
      mutate(plan)
      expect(parsePlan(plan).ok).toBe(false)
    }
  })

  it('requires classifications and contributions to resolve uniquely and activities to match SEP/SIMPLE', () => {
    const missingSource = factsPlan()
    missingSource.retirementActionEligibilityFacts!.iraClassifications[0]!
      .sourceAccountId = 'missing'
    expect(parsePlan(missingSource).ok).toBe(false)

    const traditionalActivity = factsPlan()
    traditionalActivity.retirementActionEligibilityFacts!.iraClassifications[0] = {
      evidenceId: 'class-1',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-facts',
      subtype: 'traditional',
    }
    expect(parsePlan(traditionalActivity).ok).toBe(false)

    const missingDonor = factsPlan()
    missingDonor.retirementActionEligibilityFacts!.deductibleIraContributions[0]!
      .donorPersonId = 'missing'
    expect(parsePlan(missingDonor).ok).toBe(false)
  })

  it('does not let account array order choose a duplicate classification source', () => {
    for (const duplicateFirst of [false, true]) {
      const plan = factsPlan()
      const duplicate = {
        ...plan.accounts.find((account) => account.id === 'ira-facts')!,
        type: 'cash' as const,
      }
      if (duplicateFirst) plan.accounts.unshift(duplicate as never)
      else plan.accounts.push(duplicate as never)
      const parsed = parsePlan(plan)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) {
        expect(
          parsed.issues.some((issue) =>
            issue.includes('IRA classification source "ira-facts" must resolve uniquely'),
          ),
        ).toBe(true)
      }
    }
  })
})

describe('inherited-IRA beneficiary facts (WS2)', () => {
  const fullBeneficiary = {
    beneficiaryClass: 'designated-individual' as const,
    edbCategory: 'none' as const,
    beneficiaryBirthYear: 1980,
    soleBeneficiary: true,
    provenance: { source: 'custodian statement', asOf: 2026 },
  }

  function withTraditionalInherited(inherited: InheritedAccount): Plan {
    const plan = validCouplePlan()
    plan.accounts[1] = {
      type: 'traditional',
      id: 'inh-trad',
      name: 'Inherited traditional',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 200_000,
      annualContribution: 0,
      inherited,
    } as Plan['accounts'][number]
    return plan
  }

  function withRothInherited(inherited: InheritedAccount): Plan {
    const plan = validCouplePlan()
    plan.accounts.push({
      type: 'roth',
      id: 'inh-roth',
      name: 'Inherited Roth',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 100_000,
      annualContribution: 0,
      inherited,
    } as Plan['accounts'][number])
    return plan
  }

  it('round-trips a traditional inherited account with a full beneficiary block', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: {
        ...fullBeneficiary,
        election: 'none',
        spouseUnlimitedWithdrawalRight: false,
        ownerBirthYear: 1950,
        ownerBirthMonth: 6,
        ownerYearOfDeathRmdSatisfied: true,
        roth5YearStartYear: 2015,
      },
    })
    const serialized = JSON.parse(JSON.stringify(plan))
    const first = parsePlan(serialized)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = parsePlan(JSON.parse(JSON.stringify(first.plan)))
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.plan).toEqual(first.plan)
  })

  it('parses a legacy two-field traditional inherited account unchanged', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2024,
      decedentHadStartedRmds: false,
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const account = parsed.plan.accounts.find((a) => a.id === 'inh-trad')
    expect(account).toMatchObject({
      type: 'traditional',
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
    })
    expect(
      account && account.type === 'traditional' ? account.inherited?.beneficiary : undefined,
    ).toBeUndefined()
  })

  it("rejects remain-beneficiary / treat-as-own when edbCategory is not surviving-spouse", () => {
    for (const election of ['remain-beneficiary', 'treat-as-own'] as const) {
      const plan = withTraditionalInherited({
        ownerDeathYear: 2022,
        decedentHadStartedRmds: false,
        beneficiary: {
          ...fullBeneficiary,
          edbCategory: 'disabled',
          election,
          soleBeneficiary: true,
        },
      })
      const parsed = parsePlan(plan)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) {
        expect(parsed.issues.join('\n')).toContain(
          `election '${election}' requires edbCategory 'surviving-spouse'`,
        )
      }
    }
  })

  it("rejects ten-year-election when edbCategory is none", () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'none',
        election: 'ten-year-election',
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "election 'ten-year-election' requires an EDB category other than 'none'",
      )
    }
  })

  it('accepts ten-year-election for a non-spouse EDB category', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'disabled',
        election: 'ten-year-election',
      },
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects treat-as-own without soleBeneficiary true', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        soleBeneficiary: false,
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "election 'treat-as-own' requires soleBeneficiary true",
      )
    }
  })

  it('rejects treat-as-own when spouseUnlimitedWithdrawalRight is explicitly false', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        soleBeneficiary: true,
        spouseUnlimitedWithdrawalRight: false,
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "election 'treat-as-own' requires spouseUnlimitedWithdrawalRight true",
      )
    }
  })

  it('accepts treat-as-own when spouseUnlimitedWithdrawalRight is absent', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        soleBeneficiary: true,
      },
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects ownerYearOfDeathRmdSatisfied when decedentHadStartedRmds is false', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        ownerYearOfDeathRmdSatisfied: true,
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'ownerYearOfDeathRmdSatisfied applies only when decedentHadStartedRmds is true',
      )
    }
  })

  it('rejects ten-year-election when decedentHadStartedRmds is true', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'disabled',
        election: 'ten-year-election',
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "election 'ten-year-election' applies only when decedentHadStartedRmds is false",
      )
    }
  })

  it('rejects minor-child whose age in the death year is already ≥ 22', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'minor-child',
        beneficiaryBirthYear: 2000, // age 22 in 2022
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "edbCategory 'minor-child' is contradicted by beneficiaryBirthYear",
      )
    }
  })

  it('accepts minor-child under 21 in the death year', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'minor-child',
        beneficiaryBirthYear: 2005, // age 17 in 2022
      },
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('accepts minor-child exactly age 20 in the death year', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'minor-child',
        beneficiaryBirthYear: 2002, // age 20 in 2022
      },
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('accepts minor-child exactly age 21 in the death year (year-precision ambiguity)', () => {
    // Age 21 by year arithmetic may still have been 20 on the date of death.
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'minor-child',
        beneficiaryBirthYear: 2001, // age 21 in 2022
      },
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects beneficiaryBirthYear after ownerDeathYear', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        beneficiaryBirthYear: 2023,
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'beneficiaryBirthYear cannot be after ownerDeathYear',
      )
    }
  })

  it('rejects not-more-than-10-years-younger when birth years show a clear >10 gap', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'not-more-than-10-years-younger',
        ownerBirthYear: 1950,
        beneficiaryBirthYear: 1965, // 15 years younger by year arithmetic
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "edbCategory 'not-more-than-10-years-younger' is contradicted by birth years",
      )
    }
  })

  it('does not reject a year-boundary 10-year gap for not-more-than-10-years-younger', () => {
    // Exactly 10 years by year arithmetic is a birth-date-to-birth-date tie the
    // engine cannot resolve at year precision — not a parse contradiction.
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        edbCategory: 'not-more-than-10-years-younger',
        ownerBirthYear: 1950,
        beneficiaryBirthYear: 1960,
      },
    })
    expect(parsePlan(plan).ok).toBe(true)
  })

  it('rejects an EDB category on a non-designated-individual beneficiary class', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        ...fullBeneficiary,
        beneficiaryClass: 'estate',
        edbCategory: 'surviving-spouse',
      },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        "edbCategory other than 'none' applies only when beneficiaryClass is 'designated-individual'",
      )
    }
  })

  it('still rejects nondeductible basis on an inherited traditional account', () => {
    const plan = withTraditionalInherited({
      ownerDeathYear: 2024,
      decedentHadStartedRmds: false,
      beneficiary: { ...fullBeneficiary },
    })
    ;(plan.accounts.find((a) => a.id === 'inh-trad') as { nondeductibleBasis?: number })
      .nondeductibleBasis = 1_000
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'nondeductible basis is not modeled on inherited IRAs',
      )
    }
  })

  it('rejects any Roth account carrying an inherited block at parse time', () => {
    const plan = withRothInherited({
      ownerDeathYear: 2023,
      decedentHadStartedRmds: false,
      beneficiary: { ...fullBeneficiary },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'inherited Roth accounts are schema-defined (regime matrix K1/K2) but not yet executable',
      )
    }
  })

  it('rejects a Roth inherited block without beneficiary facts', () => {
    const plan = withRothInherited({
      ownerDeathYear: 2023,
      decedentHadStartedRmds: false,
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'an inherited Roth account must carry beneficiary facts',
      )
    }
  })

  it('rejects decedentHadStartedRmds true on a Roth inherited account', () => {
    const plan = withRothInherited({
      ownerDeathYear: 2023,
      decedentHadStartedRmds: true,
      beneficiary: { ...fullBeneficiary },
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain(
        'a Roth inherited account cannot have decedentHadStartedRmds true',
      )
    }
  })
})
