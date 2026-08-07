import { describe, expect, it } from 'vitest'

import { asUsdCents } from '../actions/money.js'
import { createEmptyPlan, parsePlan, stateForYear, stateResidencySegmentsForYear, type Plan } from './plan.js'
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
