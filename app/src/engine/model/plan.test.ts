import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, stateForYear, stateResidencySegmentsForYear, type Plan } from './plan'

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
    const result = parsePlan({ schemaVersion: 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.every((i) => i.includes(':'))).toBe(true)
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
